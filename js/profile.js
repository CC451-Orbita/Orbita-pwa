/* ============================================================
   Perfil persistente y personalización continua (RF-14 a RF-17)
   Se guarda en localStorage y se actualiza con cada reunión:
   preferencias, ritmo de habla, respuestas a invitaciones, emociones declaradas e inferidas.
   ============================================================ */
(function () {
  const CLAVE = 'orbita.perfil.v1';

  const PERFIL_INICIAL = {
    nombre: '',
    color: '#8C7CF0',
    consentimiento: false,
    accesibilidad: { subtitulos: true, bajaEstimulacion: false, altoContraste: false, vozTTS: false, vibracion: true, listaAccesible: false },
    canalPreferido: 'hablar',          // se recalcula con el uso
    toleranciaSilencioSeg: 20,         // tiempo antes de cerrar una invitación sin respuesta
    ritmoPalabrasMin: null,            // se calcula con lo que el usuario dicta
    respuestas: { hablar: 0, escribir: 0, paso: 0, sinRespuesta: 0 },
    emociones: [],                     // {fecha, momento: 'inicio'|'fin', valor, origen: 'declarada'|'inferida'}
    reuniones: 0,
    aportesTotales: 0,
    llm: { proveedor: 'simulado', apiKey: '' }
  };

  let cache = null;

  function cargar() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(CLAVE);
      cache = raw ? Object.assign(structuredClone(PERFIL_INICIAL), JSON.parse(raw)) : structuredClone(PERFIL_INICIAL);
    } catch (e) {
      cache = structuredClone(PERFIL_INICIAL); // modo privado: el perfil vive solo en memoria
    }
    return cache;
  }

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(cache)); } catch (e) { /* sin almacenamiento: seguimos en memoria */ }
  }

  window.Perfil = {
    obtener: cargar,
    actualizar(cambios) { Object.assign(cargar(), cambios); guardar(); },
    actualizarAccesibilidad(cambios) { Object.assign(cargar().accesibilidad, cambios); guardar(); },

    /* Aprendizaje: cada respuesta a una invitación ajusta el canal preferido y la tolerancia. */
    registrarRespuesta(tipo) {
      const p = cargar();
      p.respuestas[tipo] = (p.respuestas[tipo] || 0) + 1;
      const { hablar, escribir } = p.respuestas;
      p.canalPreferido = escribir > hablar ? 'escribir' : 'hablar';
      if (tipo === 'sinRespuesta') p.toleranciaSilencioSeg = Math.min(40, p.toleranciaSilencioSeg + 5);
      if (tipo === 'hablar' || tipo === 'escribir') p.aportesTotales++;
      guardar();
    },

    /* Emoción inferida: muchos "paso" o invitaciones sin respuesta seguidas → posible incomodidad. */
    inferirEmocion() {
      const p = cargar();
      const { paso, sinRespuesta, hablar, escribir } = p.respuestas;
      const evitacion = paso + sinRespuesta;
      if (evitacion >= 3 && evitacion > hablar + escribir) {
        p.emociones.push({ fecha: new Date().toISOString(), momento: 'durante', valor: 'incomodidad', origen: 'inferida' });
        guardar();
        return 'incomodidad';
      }
      return null;
    },

    registrarEmocion(momento, valor) {
      cargar().emociones.push({ fecha: new Date().toISOString(), momento, valor, origen: 'declarada' });
      guardar();
    },

    registrarRitmo(texto, segundos) {
      if (!segundos) return;
      const ppm = Math.round(texto.split(/\s+/).length / (segundos / 60));
      const p = cargar();
      p.ritmoPalabrasMin = p.ritmoPalabrasMin ? Math.round((p.ritmoPalabrasMin + ppm) / 2) : ppm;
      guardar();
    },

    cerrarReunion() { cargar().reuniones++; guardar(); },

    borrarTodo() { try { localStorage.removeItem(CLAVE); } catch (e) {} cache = null; }
  };
})();
