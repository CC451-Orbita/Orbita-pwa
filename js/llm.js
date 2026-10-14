/* ============================================================
   Capa de abstracción LLM (RF-20)
   Todos los proveedores exponen la misma interfaz: generar({sistema, prompt}) -> Promise<string>.
   Cambiar de proveedor = cambiar una línea en Ajustes. Si un proveedor remoto falla,
   se usa el proveedor simulado (degradación elegante, RNF-09).
   ============================================================ */
(function () {
  const SISTEMA_BASE =
    'Eres el moderador amable de Órbita, una app que equilibra la participación en reuniones. ' +
    'Escribe en español, frases cortas (máximo 25 palabras), tono cálido y nunca punitivo. ' +
    'Nunca menciones que alguien estuvo callado ni compares a las personas.';

  /* ---------- Proveedor simulado (sin red, para demo y pruebas) ---------- */
  const Simulado = {
    nombre: 'Simulado (sin red)',
    async generar({ tarea, datos }) {
      await new Promise(r => setTimeout(r, 350)); // latencia simulada
      switch (tarea) {
        case 'invitacion':
          return datos.preguntaBase || `¿Qué opinas sobre "${datos.tema}"?`;
        case 'sugerenciaDominante':
          return 'Tu órbita está muy cerca del sol. ¿Le cedes la palabra al equipo un momento?';
        case 'resumirAporte':
          return datos.texto.length > 90 ? datos.texto.slice(0, 87).trim() + '…' : datos.texto;
        case 'resumen': {
          const d = datos.decisiones.map(x => '• ' + x).join('\n');
          const a = datos.abiertos.length ? datos.abiertos.map(x => '• ' + x).join('\n') : '• Ninguno';
          return `Decisiones:\n${d}\n\nTemas abiertos:\n${a}`;
        }
        case 'reflexion':
          return datos.aportes > 0
            ? `Tus ${datos.aportes} aporte(s) llegaron antes de cerrar los temas. Eso cambia decisiones.`
            : 'Hoy escuchaste más de lo que hablaste. La próxima ventana de órbita es tuya cuando quieras.';
        default:
          return '';
      }
    }
  };

  /* ---------- Proveedor Gemini (API remota) ---------- */
  const Gemini = {
    nombre: 'Gemini (API remota)',
    modelo: 'gemini-2.5-flash',
    async generar({ tarea, datos, apiKey }) {
      if (!apiKey) throw new Error('Falta la API key de Gemini');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelo}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SISTEMA_BASE }] },
          contents: [{ role: 'user', parts: [{ text: construirPrompt(tarea, datos) }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
        })
      });
      if (!res.ok) throw new Error('Gemini respondió ' + res.status);
      const j = await res.json();
      return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    }
  };

  /* ---------- Proveedor Ollama (LLM local) ---------- */
  const Ollama = {
    nombre: 'Ollama (LLM local)',
    modelo: 'llama3.2',
    async generar({ tarea, datos }) {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.modelo, system: SISTEMA_BASE, prompt: construirPrompt(tarea, datos), stream: false })
      });
      if (!res.ok) throw new Error('Ollama respondió ' + res.status);
      return (await res.json()).response || '';
    }
  };

  function construirPrompt(tarea, d) {
    switch (tarea) {
      case 'invitacion':
        return `Tema en discusión: "${d.tema}". Últimas frases:\n${d.contexto}\n` +
               `Escribe UNA pregunta concreta y abierta para invitar a ${d.nombre} a aportar sobre este tema.`;
      case 'sugerenciaDominante':
        return `${d.nombre} ha hablado el ${d.porcentaje}% del tiempo. Escribe una sugerencia privada y amable para que ceda la palabra, usando la metáfora de órbitas.`;
      case 'resumirAporte':
        return `Resume en una sola línea (máx. 20 palabras) este aporte escrito, sin cambiar su sentido:\n"${d.texto}"`;
      case 'resumen':
        return `Transcripción de la reunión:\n${d.transcripcion}\n\nDevuelve: "Decisiones:" con viñetas y "Temas abiertos:" con viñetas.`;
      case 'reflexion':
        return `El usuario hizo ${d.aportes} aportes en la reunión. Escribe una frase de reflexión positiva y personal.`;
      default:
        return d.texto || '';
    }
  }

  /* ---------- Validador de tono (RNF-08) ---------- */
  function esSeguro(texto) {
    const t = texto.toLowerCase();
    return !window.ORBITA_DATA.terminosProhibidos.some(p => t.includes(p));
  }

  const PROVEEDORES = { simulado: Simulado, gemini: Gemini, ollama: Ollama };

  window.LLM = {
    proveedores: PROVEEDORES,
    ultimoProveedorUsado: 'simulado',
    async generar(tarea, datos) {
      const cfg = window.Perfil.obtener().llm;
      const prov = PROVEEDORES[cfg.proveedor] || Simulado;
      try {
        const texto = (await prov.generar({ tarea, datos, apiKey: cfg.apiKey })).trim();
        if (!texto || !esSeguro(texto)) throw new Error('Respuesta vacía o con tono no permitido');
        this.ultimoProveedorUsado = cfg.proveedor;
        return texto;
      } catch (e) {
        console.warn('[LLM] Fallback a simulado:', e.message);
        this.ultimoProveedorUsado = 'simulado';
        return Simulado.generar({ tarea, datos });
      }
    },
    esSeguro
  };
})();
