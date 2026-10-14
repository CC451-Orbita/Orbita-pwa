/* ============================================================
   Interfaz de voz (RF-03, RF-05, RF-06)
   - Reconocimiento: Web Speech API (SpeechRecognition), es-PE.
   - Síntesis: speechSynthesis para leer invitaciones y resúmenes.
   - Comandos de voz: "pedir la palabra", "escribir", "resumen", "paso".
   Si el navegador no soporta voz, la app sigue funcionando por texto (RNF-09).
   ============================================================ */
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, escuchando = false, inicio = 0;

  const COMANDOS = [
    { patron: /pedir (la )?palabra/i, accion: 'pedirPalabra' },
    { patron: /^escribir/i,          accion: 'escribir' },
    { patron: /resumen/i,            accion: 'resumen' },
    { patron: /^paso\b/i,            accion: 'paso' }
  ];

  window.Voz = {
    soportaReconocimiento: !!SR,
    soportaSintesis: 'speechSynthesis' in window,

    escuchar({ alTexto, alComando, alEstado }) {
      if (!SR) { alEstado?.('no-soportado'); return; }
      if (escuchando) { rec.stop(); return; }
      rec = new SR();
      rec.lang = 'es-PE';
      rec.interimResults = true;
      rec.continuous = false;
      inicio = Date.now();
      rec.onstart = () => { escuchando = true; alEstado?.('escuchando'); };
      rec.onend = () => { escuchando = false; alEstado?.('detenido'); };
      rec.onerror = e => { escuchando = false; alEstado?.('error:' + e.error); };
      rec.onresult = e => {
        const r = e.results[e.results.length - 1];
        const texto = r[0].transcript.trim();
        if (!r.isFinal) { alEstado?.('parcial:' + texto); return; }
        const cmd = COMANDOS.find(c => c.patron.test(texto));
        if (cmd) alComando?.(cmd.accion, texto);
        else alTexto?.(texto, (Date.now() - inicio) / 1000);
      };
      rec.start();
    },

    hablar(texto) {
      const p = window.Perfil.obtener();
      if (!p.accesibilidad.vozTTS || !this.soportaSintesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'es-PE';
      u.rate = 1;
      speechSynthesis.speak(u);
    },

    vibrar(patron = [80, 60, 80]) {
      const p = window.Perfil.obtener();
      if (p.accesibilidad.vibracion && navigator.vibrate) navigator.vibrate(patron);
    }
  };
})();
