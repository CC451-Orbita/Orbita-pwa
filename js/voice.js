/* ============================================================
   Interfaz de voz (RF-03, RF-05, RF-06)
   - Reconocimiento: Web Speech API (SpeechRecognition), es-PE.
   - Síntesis: speechSynthesis para leer invitaciones y resúmenes.
   - Comandos de voz: "pedir la palabra", "escribir", "resumen", "paso".
   Si el navegador no soporta voz, la app sigue funcionando por texto (RNF-09).
   ============================================================ */
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;

  const COMANDOS = [
    { patron: /^pedir (la )?palabra[.!?]?$/i, accion: 'pedirPalabra' },
    { patron: /^escribir[.!?]?$/i,           accion: 'escribir' },
    { patron: /^resumen[.!?]?$/i,            accion: 'resumen' },
    { patron: /^paso[.!?]?$/i,               accion: 'paso' }
  ];

  window.Voz = {
    soportaReconocimiento: !!SR,
    soportaSintesis: 'speechSynthesis' in window,
    mensajeError(estado) {
      if (estado === 'error:no-speech') return 'No se detectó voz. Intenta otra vez o escribe.';
      if (estado === 'error:not-allowed') return 'Permite el acceso al micrófono en el navegador o escribe.';
      if (estado === 'error:network') return 'El reconocimiento de voz perdió la conexión. Intenta otra vez o escribe.';
      return 'No se pudo usar el micrófono. Puedes escribir.';
    },

    escuchar({ alTexto, alComando, alEstado }) {
      if (!SR) { alEstado?.('no-soportado'); return; }
      if (rec) { rec.stop(); return; }
      const sesion = new SR();
      rec = sesion;
      sesion.lang = 'es-PE';
      sesion.interimResults = true;
      sesion.continuous = false;
      let inicio = Date.now();
      let huboResultado = false;
      function terminar(estado) {
        if (rec !== sesion) return;
        rec = null;
        alEstado?.(estado);
      }
      sesion.onstart = () => { if (rec === sesion) alEstado?.('escuchando'); };
      sesion.onspeechstart = () => { inicio = Date.now(); };
      sesion.onend = () => terminar(huboResultado ? 'detenido' : 'error:no-speech');
      sesion.onerror = e => terminar('error:' + e.error);
      sesion.onresult = e => {
        if (rec !== sesion) return;
        const r = e.results[e.results.length - 1];
        const texto = r[0].transcript.trim();
        if (!r.isFinal) { alEstado?.('parcial:' + texto); return; }
        if (!texto) return;
        huboResultado = true;
        const cmd = alComando && COMANDOS.find(c => c.patron.test(texto));
        if (cmd) alComando(cmd.accion, texto);
        else alTexto?.(texto, Math.max(0.1, (Date.now() - inicio) / 1000));
      };
      try { sesion.start(); } catch (e) { terminar('error:' + e.name); }
    },

    detener() {
      const sesion = rec;
      rec = null;
      sesion?.abort();
      if (this.soportaSintesis) speechSynthesis.cancel();
    },

    hablar(texto, { forzar = false, soloLocal = false } = {}) {
      const p = window.Perfil.obtener();
      if ((!p.accesibilidad.vozTTS && !forzar) || !this.soportaSintesis) return false;
      const u = new SpeechSynthesisUtterance(texto);
      if (soloLocal) {
        const voces = speechSynthesis.getVoices().filter(voz => voz.localService);
        const voz = voces.find(v => v.lang.toLowerCase() === 'es-pe') || voces.find(v => /^es(?:-|$)/i.test(v.lang));
        if (!voz) return false;
        u.voice = voz;
      }
      u.lang = u.voice?.lang || 'es-PE';
      u.rate = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      return true;
    },

    vibrar(patron = [80, 60, 80]) {
      const p = window.Perfil.obtener();
      if (p.accesibilidad.vibracion && navigator.vibrate) navigator.vibrate(patron);
    }
  };
})();
