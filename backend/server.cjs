'use strict';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { crearGemini, ErrorServicio } = require('./gemini.cjs');
const { construir } = require('../js/prompts-llm.js');

const RAIZ = path.resolve(__dirname, '..');
const LIMITE_AUDIO = 2 * 1024 * 1024;
const LIMITE_JSON = 64 * 1024;
const TIPOS_AUDIO = new Map([
  ['audio/webm', 'audio/webm'], ['audio/ogg', 'audio/ogg'],
  ['audio/wav', 'audio/wav'], ['audio/mp4', 'audio/m4a'], ['audio/m4a', 'audio/m4a']
]);
const ARCHIVOS = /^\/(?:index\.html|sw\.js|manifest\.webmanifest|(?:css|js|icons|data|vendor)\/[\w./-]+\.(?:js|css|svg|png|json))$/;
const TIPOS_WEB = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json'
};

function enviar(res, estado, tipo, cuerpo) {
  res.writeHead(estado, { 'Content-Type': tipo, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(cuerpo);
}

function json(res, estado, datos) {
  enviar(res, estado, 'application/json; charset=utf-8', JSON.stringify(datos));
}

async function leer(req, limite) {
  if (Number(req.headers['content-length']) > limite) throw new ErrorServicio(413, 'La solicitud supera el tamaño permitido.');
  const partes = [];
  let bytes = 0;
  for await (const parte of req.iterator({ destroyOnReturn: false })) {
    bytes += parte.length;
    if (bytes > limite) throw new ErrorServicio(413, 'La solicitud supera el tamaño permitido.');
    partes.push(parte);
  }
  return Buffer.concat(partes, bytes);
}

function tipo(req) {
  return req.headers['content-type']?.split(';')[0].trim().toLowerCase();
}

async function leerJson(req) {
  if (tipo(req) !== 'application/json') throw new ErrorServicio(415, 'Se esperaba una solicitud JSON.');
  const cuerpo = await leer(req, LIMITE_JSON);
  try {
    const valor = JSON.parse(cuerpo);
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error();
    return valor;
  } catch {
    throw new ErrorServicio(400, 'La solicitud no contiene un objeto JSON válido.');
  }
}

function textoValido(texto, limite) {
  return typeof texto === 'string' && texto.length <= limite && Boolean(texto.trim());
}

function validarConversacion(datos) {
  const { mensaje, tema = '', historial = [] } = datos;
  if (!textoValido(mensaje, 2000)) throw new ErrorServicio(400, 'Escribe un mensaje de hasta 2000 caracteres.');
  if (typeof tema !== 'string' || tema.length > 120) throw new ErrorServicio(400, 'El tema supera el tamaño permitido.');
  if (!Array.isArray(historial) || historial.length > 8 || historial.length % 2 !== 0 ||
      historial.some((turno, i) => turno?.rol !== (i % 2 ? 'asistente' : 'usuario') || !textoValido(turno.texto, 2000))) {
    throw new ErrorServicio(400, 'El historial de la conversación no es válido.');
  }
  return { mensaje: mensaje.trim(), tema: tema.trim(), historial };
}

async function servirArchivo(ruta, req, res) {
  const recurso = ruta === '/' ? '/index.html' : ruta;
  if (!ARCHIVOS.test(recurso) || recurso.split('/').some(parte => parte.startsWith('.'))) {
    return json(res, 404, { error: 'Recurso no encontrado.' });
  }
  if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Método no permitido.' });
  try {
    const archivo = await fs.realpath(path.join(RAIZ, recurso));
    if (!archivo.startsWith(RAIZ + path.sep)) return json(res, 404, { error: 'Recurso no encontrado.' });
    const cuerpo = await fs.readFile(archivo);
    enviar(res, 200, TIPOS_WEB[path.extname(recurso)], req.method === 'HEAD' ? undefined : cuerpo);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return json(res, 404, { error: 'Recurso no encontrado.' });
    throw error;
  }
}

function crearServidor({ proveedor = crearGemini() } = {}) {
  let solicitudes = 0;
  const servidor = http.createServer({ requestTimeout: 30000, headersTimeout: 10000 }, async (req, res) => {
    const host = req.headers.host;
    const puerto = servidor.address()?.port;
    const sufijo = puerto === 80 ? '' : `:${puerto}`;
    if (![`localhost${sufijo}`, `127.0.0.1${sufijo}`].includes(host)) {
      return json(res, 403, { error: 'Abre Órbita desde localhost.' });
    }
    const ruta = req.url.split('?')[0];
    try {
      if (!ruta.startsWith('/api/')) return await servirArchivo(ruta, req, res);
      if ((req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') {
        return json(res, 403, { error: 'La solicitud debe provenir de Órbita.' });
      }
      if (['/api/asistente/estado', '/api/reunion/estado'].includes(ruta) && req.method === 'GET') {
        return json(res, 200, { configurado: proveedor.configurado });
      }
      if (!['/api/asistente/transcribir', '/api/asistente/responder', '/api/asistente/voz', '/api/reunion/generar'].includes(ruta)) {
        return json(res, 404, { error: 'Ruta de la API no encontrada.' });
      }
      if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido.' });
      if (!proveedor.configurado) return json(res, 503, { error: 'Configura la clave de Gemini en el servidor y reinícialo.' });
      if (solicitudes >= 3) return json(res, 429, { error: 'El servicio de IA está ocupado. Intenta de nuevo en unos segundos.' });

      solicitudes++;
      const control = new AbortController();
      res.once('close', () => control.abort());
      try {
        if (ruta.endsWith('/transcribir')) {
          const formato = TIPOS_AUDIO.get(tipo(req));
          if (!formato) throw new ErrorServicio(415, 'Usa una grabación WebM, Ogg, WAV o M4A.');
          const audio = await leer(req, LIMITE_AUDIO);
          if (!audio.length) throw new ErrorServicio(400, 'La grabación está vacía.');
          const texto = await proveedor.transcribir(audio, formato, control.signal);
          return json(res, 200, { texto });
        }
        const datos = await leerJson(req);
        if (ruta === '/api/reunion/generar') {
          const prompt = construir(datos.tarea, datos.datos);
          if (!prompt) throw new ErrorServicio(400, 'La tarea de reunión o sus datos no son válidos.');
          const texto = await proveedor.generarReunion(prompt, control.signal);
          return json(res, 200, { texto });
        }
        if (ruta.endsWith('/responder')) {
          const texto = await proveedor.responder(validarConversacion(datos), control.signal);
          return json(res, 200, { texto });
        }
        if (!textoValido(datos.texto, 2000)) throw new ErrorServicio(400, 'El texto para lectura debe tener hasta 2000 caracteres.');
        const wav = await proveedor.sintetizar(datos.texto.trim(), control.signal);
        return enviar(res, 200, 'audio/wav', wav);
      } finally {
        solicitudes--;
      }
    } catch (error) {
      req.resume();
      if (res.destroyed || res.headersSent) return;
      if (error instanceof ErrorServicio) return json(res, error.estado, { error: error.message });
      json(res, 500, { error: 'El servidor no pudo completar la solicitud.' });
    }
  });
  return servidor;
}

if (require.main === module) {
  const puerto = Number(process.env.ORBITA_PORT || 8000);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new Error('ORBITA_PORT debe ser un puerto válido.');
  crearServidor().listen(puerto, '127.0.0.1', () => {
    console.log(`Órbita disponible en http://localhost:${puerto}`);
  });
}

module.exports = { crearServidor };
