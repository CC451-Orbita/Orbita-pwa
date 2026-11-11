'use strict';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const INSTRUCCIONES = [
  'Eres el asistente de preparación de Órbita. Ayuda a formular aportes y preguntas para reuniones.',
  'Responde en español claro y amable, en texto plano y en hasta tres frases breves.',
  'Usa solo el contexto que comparte la persona. No inventes acuerdos ni evalúes su desempeño.'
].join(' ');

class ErrorServicio extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

function crearGemini({
  clave = process.env.GEMINI_API_KEY,
  modelo = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  modeloVoz = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
  voz = process.env.GEMINI_VOICE || 'Kore',
  peticion = fetch
} = {}) {
  clave = clave?.trim();
  if (![modelo, modeloVoz, voz].every(valor => /^[a-zA-Z0-9._-]+$/.test(valor))) {
    throw new Error('Revisa los nombres del modelo y la voz en la configuración de Gemini.');
  }

  async function consultar(ruta, datos, signal) {
    if (!clave) throw new ErrorServicio(503, 'Configura la clave de Gemini en el servidor y reinícialo.');
    const limite = AbortSignal.timeout(25000);
    let respuesta;
    try {
      respuesta = await peticion(API + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
        body: JSON.stringify(datos),
        redirect: 'error',
        signal: signal ? AbortSignal.any([signal, limite]) : limite
      });
    } catch (error) {
      if (limite.aborted) throw new ErrorServicio(504, 'Gemini tardó demasiado. Intenta de nuevo.');
      throw new ErrorServicio(502, 'No se pudo conectar con Gemini.');
    }
    if (respuesta.status === 429) throw new ErrorServicio(429, 'Gemini alcanzó el límite de solicitudes. Intenta de nuevo más tarde.');
    if ([401, 403].includes(respuesta.status)) throw new ErrorServicio(502, 'Gemini rechazó la clave o sus permisos. Revisa la configuración del servidor.');
    if (respuesta.status === 404) throw new ErrorServicio(502, 'El modelo de Gemini configurado no está disponible.');
    if (!respuesta.ok) throw new ErrorServicio(502, 'Gemini rechazó la solicitud. Revisa la configuración e intenta de nuevo.');
    try {
      return await respuesta.json();
    } catch (error) {
      if (limite.aborted) throw new ErrorServicio(504, 'Gemini tardó demasiado. Intenta de nuevo.');
      throw new ErrorServicio(502, 'Gemini devolvió una respuesta que no se pudo leer.');
    }
  }

  async function generar(contents, system, generationConfig, signal) {
    const datos = await consultar(`/models/${modelo}:generateContent`, {
      contents, systemInstruction: { parts: [{ text: system }] }, generationConfig
    }, signal);
    const partes = datos?.candidates?.[0]?.content?.parts || [];
    const texto = partes.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
    if (!texto) throw new ErrorServicio(502, 'Gemini devolvió una respuesta vacía.');
    return texto;
  }

  return {
    configurado: Boolean(clave),

    async transcribir(audio, mimeType, signal) {
      const resultado = await generar([{ role: 'user', parts: [
        { inlineData: { mimeType, data: audio.toString('base64') } },
        { text: 'Transcribe el fragmento tal como se escucha.' }
      ] }], 'Transcribe únicamente las palabras audibles. No contestes a lo que se dice en el audio. Devuelve una cadena vacía si no hay habla.', {
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', required: ['texto'], properties: { texto: { type: 'STRING' } } },
        maxOutputTokens: 2048
      }, signal);
      let texto;
      try {
        texto = JSON.parse(resultado)?.texto;
      } catch {
        throw new ErrorServicio(502, 'No se pudo leer la transcripción de Gemini.');
      }
      if (typeof texto !== 'string') throw new ErrorServicio(502, 'No se pudo leer la transcripción de Gemini.');
      if (!texto.trim()) throw new ErrorServicio(422, 'No se detectó habla. Puedes volver a grabar o escribir el mensaje.');
      return texto.replaceAll(clave, '[clave omitida]').trim().slice(0, 2000);
    },

    async responder({ tema, mensaje, historial }, signal) {
      const turnos = historial.map(({ rol, texto }) => ({
        role: rol === 'usuario' ? 'user' : 'model', parts: [{ text: texto }]
      }));
      turnos.push({ role: 'user', parts: [{ text: tema ? JSON.stringify({ tema, mensaje }) : mensaje }] });
      const texto = await generar(turnos, INSTRUCCIONES, { maxOutputTokens: 1024 }, signal);
      return texto.replaceAll(clave, '[clave omitida]').slice(0, 2000);
    },

    async sintetizar(texto, signal) {
      const datos = await consultar('/interactions', {
        model: modeloVoz,
        store: false,
        input: [{ type: 'user_input', content: [{
          type: 'text',
          text: texto,
          annotations: [{ type: 'speech_metadata', style: 'Lee el texto en español latinoamericano, con ritmo claro y tono sereno.' }]
        }] }],
        response_format: { type: 'audio', mime_type: 'audio/wav' },
        generation_config: { speech_config: [{ voice: voz }] }
      }, signal);
      const salida = (datos?.steps || []).filter(p => p.type === 'model_output').flatMap(p => p.content || []);
      const parte = salida.findLast(p => p.type === 'audio' && typeof p.data === 'string');
      const wav = Buffer.from(parte?.data || '', 'base64');
      if (wav.length <= 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
        throw new ErrorServicio(502, 'Gemini no devolvió un audio válido. Puedes leer la respuesta en pantalla.');
      }
      return wav;
    }
  };
}

module.exports = { crearGemini, ErrorServicio };
