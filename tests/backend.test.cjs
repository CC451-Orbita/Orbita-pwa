'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const { crearGemini } = require('../backend/gemini.cjs');
const { crearServidor } = require('../backend/server.cjs');

async function iniciar(t, proveedor) {
  const servidor = crearServidor({ proveedor }).listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise(resolve => servidor.close(resolve)));
  return `http://127.0.0.1:${servidor.address().port}`;
}

function post(base, ruta, cuerpo, headers = {}) {
  return fetch(base + '/api/asistente/' + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(cuerpo)
  });
}

function wavDePrueba() {
  const pcm = 4800;
  const wav = Buffer.alloc(44 + pcm);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(pcm, 40);
  return wav;
}

test('transcribe audio, responde con el historial y devuelve WAV mediante el contrato de Gemini', async t => {
  const clave = 'credencial-ficticia-de-prueba';
  const wav = wavDePrueba();
  const llamadas = [];
  const proveedor = crearGemini({
    clave, modelo: 'gemini-3.5-flash-lite', modeloVoz: 'gemini-3.8-flash-lite-tts', voz: 'Kore',
    async peticion(url, opciones) {
      assert.equal(opciones.headers['x-goog-api-key'], clave);
      const datos = JSON.parse(opciones.body);
      llamadas.push(datos);
      if (url.endsWith('/interactions')) {
        return Response.json({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: wav.toString('base64') }] }] });
      }
      const texto = datos.generationConfig.responseMimeType === 'application/json'
        ? JSON.stringify({ texto: 'Quiero preparar una idea.' })
        : 'Puedes empezar con una propuesta concreta.';
      return Response.json({ candidates: [{ content: { parts: [{ text: texto }] } }] });
    }
  });
  const base = await iniciar(t, proveedor);
  const estado = await fetch(base + '/api/asistente/estado');
  assert.deepEqual(await estado.json(), { configurado: true });
  assert.equal(estado.headers.get('cache-control'), 'no-store');

  const audio = await fetch(base + '/api/asistente/transcribir', {
    method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav
  });
  assert.equal(audio.status, 200);
  assert.deepEqual(await audio.json(), { texto: 'Quiero preparar una idea.' });
  assert.deepEqual(llamadas[0].contents[0].parts[0].inlineData, { mimeType: 'audio/wav', data: wav.toString('base64') });

  const respuesta = await post(base, 'responder', {
    mensaje: '¿Qué sugieres?', tema: 'Avance del sprint',
    historial: [{ rol: 'usuario', texto: 'Hola' }, { rol: 'asistente', texto: '¿Qué tema quieres preparar?' }]
  });
  const { texto } = await respuesta.json();
  assert.equal(texto, 'Puedes empezar con una propuesta concreta.');
  assert.deepEqual(llamadas[1].contents.map(turno => turno.role), ['user', 'model', 'user']);
  assert.match(llamadas[1].contents.at(-1).parts[0].text, /Avance del sprint/);
  assert.ok(!llamadas[1].systemInstruction.parts[0].text.includes('Avance del sprint'));

  const voz = await post(base, 'voz', { texto });
  assert.equal(voz.status, 200);
  assert.equal(voz.headers.get('content-type'), 'audio/wav');
  assert.deepEqual(Buffer.from(await voz.arrayBuffer()), wav);
  assert.equal(llamadas[2].store, false);
  assert.equal(llamadas[2].input[0].content[0].text, texto);
});

test('la app estática funciona y el asistente informa si falta configuración', async t => {
  const base = await iniciar(t, crearGemini({ clave: '' }));
  const index = await fetch(base);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /Asistente de voz/);
  assert.equal((await fetch(base + '/js/asistente.js')).status, 200);
  assert.equal((await fetch(base + '/.env')).status, 404);
  assert.equal((await fetch(base + '/backend/server.cjs')).status, 404);
  const estado = await fetch(base + '/api/asistente/estado');
  assert.deepEqual(await estado.json(), { configurado: false });
  const estadoReunion = await fetch(base + '/api/reunion/estado');
  assert.deepEqual(await estadoReunion.json(), { configurado: false });
  const respuesta = await post(base, 'responder', { mensaje: 'Hola' });
  assert.equal(respuesta.status, 503);
  assert.match((await respuesta.json()).error, /clave de Gemini en el servidor/);
});

test('la reunión usa la clave del servidor y limita las tareas y los datos que envía a Gemini', async t => {
  const llamadas = [];
  const proveedor = crearGemini({ clave: 'clave-ficticia-del-servidor', async peticion(url, opciones) {
    assert.match(url, /:generateContent$/);
    assert.equal(opciones.headers['x-goog-api-key'], 'clave-ficticia-del-servidor');
    llamadas.push(JSON.parse(opciones.body));
    return Response.json({ candidates: [{ content: { parts: [{ text: '## Decisiones\n\n- Probar en Safari.' }] } }] });
  } });
  const base = await iniciar(t, proveedor);
  const estado = await fetch(base + '/api/reunion/estado');
  assert.deepEqual(await estado.json(), { configurado: true });
  const enviar = datos => fetch(base + '/api/reunion/generar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos)
  });
  assert.equal((await enviar({ tarea: 'otraTarea', datos: { texto: 'Texto' } })).status, 400);
  assert.equal((await enviar({ tarea: 'resumen', datos: { transcripcion: {} } })).status, 400);
  const resumen = await enviar({
    tarea: 'resumen', datos: { transcripcion: 'Ana: Quedamos en probar en Safari.', revision: 'Detalle privado' },
    apiKey: 'clave-ficticia-del-participante', sistema: 'Instrucciones personalizadas'
  });
  assert.equal(resumen.status, 200);
  assert.deepEqual(await resumen.json(), { texto: '## Decisiones\n\n- Probar en Safari.' });
  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0].contents[0].parts[0].text, /Ana: Quedamos en probar en Safari/);
  assert.match(llamadas[0].systemInstruction.parts[0].text, /moderador amable/);
  assert.doesNotMatch(JSON.stringify(llamadas[0]), /Detalle privado|clave-ficticia|Instrucciones personalizadas/);
});

test('rechaza un origen externo, un formato incorrecto y datos fuera del límite', async t => {
  const proveedor = crearGemini({ clave: 'ficticia', peticion: () => assert.fail('Solicitud de Gemini inesperada') });
  const base = await iniciar(t, proveedor);
  assert.equal((await post(base, 'responder', { mensaje: 'Hola' }, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await post(base, 'responder', { mensaje: 'x'.repeat(2001) })).status, 400);
  assert.equal((await post(base, 'responder', { mensaje: 'Hola', historial: [{ rol: 'asistente', texto: 'x' }] })).status, 400);
  assert.equal((await post(base, 'transcribir', {})).status, 415);
  const grande = await fetch(base + '/api/asistente/transcribir', {
    method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: Buffer.alloc(2 * 1024 * 1024 + 1)
  });
  assert.equal(grande.status, 413);
});

test('distingue silencio y error de cuota sin publicar el cuerpo del proveedor', async t => {
  let cantidad = 0;
  const proveedor = crearGemini({
    clave: 'credencial-ficticia',
    peticion() {
      if (++cantidad === 1) return Response.json({ candidates: [{ content: { parts: [{ text: '{"texto":""}' }] } }] });
      return Response.json({ diagnostico: 'credencial-ficticia' }, { status: 429 });
    }
  });
  const base = await iniciar(t, proveedor);
  const silencio = await fetch(base + '/api/asistente/transcribir', {
    method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wavDePrueba()
  });
  assert.equal(silencio.status, 422);
  assert.match((await silencio.json()).error, /No se detectó habla/);
  const cuota = await post(base, 'responder', { mensaje: 'Hola' });
  assert.equal(cuota.status, 429);
  assert.doesNotMatch(await cuota.text(), /credencial-ficticia/);
});
