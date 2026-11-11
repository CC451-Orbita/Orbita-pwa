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
    'Nunca menciones que alguien estuvo callado ni compares a las personas. ' +
    'Usa texto plano salvo cuando se solicite Markdown para un resumen.';

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
          const d = datos.decisiones.map(x => '- ' + x).join('\n');
          const a = datos.abiertos.length ? datos.abiertos.map(x => '- ' + x).join('\n') : 'Ninguno';
          return `## Decisiones\n\n${d}\n\n## Temas abiertos\n\n${a}`;
        }
        case 'guiaPreparacion':
          return datos.preguntaBase || `¿Qué te gustaría aportar sobre "${datos.tema}"?`;
        default:
          return '';
      }
    }
  };

  /* ---------- Proveedor Gemini (API remota) ---------- */
  const Gemini = {
    nombre: 'Gemini (API remota)',
    modelo: 'gemini-3.5-flash-lite',
    async generar({ tarea, datos, apiKey }) {
      if (!apiKey?.trim()) {
        throw Object.assign(new Error('Falta la clave de Gemini'), { code: 'claveGeminiAusente' });
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelo}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(12000),
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
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ model: this.modelo, system: SISTEMA_BASE, prompt: construirPrompt(tarea, datos), stream: false })
      });
      if (!res.ok) throw new Error('Ollama respondió ' + res.status);
      return (await res.json()).response || '';
    }
  };

  /* Versión local de "Hazlo corto" (sin red):
     1) quita muletillas, 2) quita "yo creo que", 3) se queda con la idea principal
     (antes de "porque", "ya que"…), 4) máximo 20 palabras y punto final. */
  const MULETILLAS = /\b(eh+|este|o sea|bueno|pues|digamos|tipo|como que|en plan)\b,?\s*/gi;
  const ARRANQUES = /^(yo\s+)?(creo|pienso|siento|opino)\s+que\s+/i;
  const CONECTORES = /\s(porque|ya que|puesto que|entonces|así que|y eso)\s/i;
  function pulirLocal(texto) {
    let t = String(texto || '').replace(MULETILLAS, '').replace(/\s+/g, ' ').trim().replace(/^[,;:]\s*/, '');
    t = t.replace(ARRANQUES, '');
    const partes = t.split(CONECTORES);
    if (partes.length > 1 && partes[0].split(' ').length >= 6) t = partes[0];
    let palabras = t.split(' ').filter(Boolean);
    if (palabras.length > 20) { palabras = palabras.slice(0, 20); t = palabras.join(' ').replace(/[,;:]$/, '') + '…'; }
    t = t.replace(/[,;:\s]+$/, '');
    if (t && !/[.!?…]$/.test(t)) t += '.';
    if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
    return t;
  }

  function construirPrompt(tarea, d) {
    switch (tarea) {
      case 'invitacion':
        return `Tema en discusión: "${d.tema}". Intervenciones que verá ${d.nombre}:\n${d.contexto || 'No hay intervenciones disponibles.'}\n` +
               'Devuelve una sola pregunta abierta y breve, sin saludo. Si aludes a una propuesta, nombra el dato o la acción concreta. ' +
               'Evita referencias vagas como «esta opción» o «este plan». No inventes hechos ni atribuciones. ' +
               `Si no hay contexto suficiente, formula la pregunta sobre el tema. Pregunta de referencia: ${d.preguntaBase || d.tema}`;
      case 'sugerenciaDominante':
        return `${d.nombre} ha hablado el ${d.porcentaje}% del tiempo. Escribe una sugerencia privada y amable para que ceda la palabra, usando la metáfora de órbitas.`;
      case 'resumirAporte':
        return `Resume en una sola línea (máx. 20 palabras) este aporte escrito, sin cambiar su sentido:\n"${d.texto}"`;
      case 'resumen':
        return `Transcripción de la reunión:\n${d.transcripcion}\n\n` +
               'Resume en Markdown con los encabezados exactos «## Decisiones» y «## Temas abiertos». ' +
               'Usa listas con guiones e incluye solo decisiones y pendientes respaldados por la transcripción. ' +
               'Escribe «Ninguno» si una sección está vacía.';
      case 'guiaPreparacion':
        return `Tema de la agenda: "${d.tema}". Escribe UNA pregunta guía corta que ayude a una persona tímida a preparar su aporte antes de la reunión.`;
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
  const REFERENCIA_VAGA = /\b(?:est[ae]|es[ae]|dich[ao])\s+(?:opción|propuesta|plan|idea|alternativa)\b/i;

  window.LLM = {
    pulirNota: pulirLocal,
    proveedores: PROVEEDORES,
    async generar(tarea, datos) {
      const resultado = await this.generarResultado(tarea, datos);
      if (resultado.respaldo) {
        window.OrbitaApp?.toast(resultado.aviso || 'El proveedor de IA no respondió correctamente. Se usó el modo simulado.');
      }
      return resultado.texto;
    },
    async generarResultado(tarea, datos) {
      if (tarea === 'pulirNota') return { texto: pulirLocal(datos.texto), proveedor: 'local', respaldo: false };
      const cfg = window.Perfil.obtener().llm;
      const proveedor = Object.hasOwn(PROVEEDORES, cfg.proveedor) ? cfg.proveedor : 'simulado';
      try {
        const respuesta = (await PROVEEDORES[proveedor].generar({ tarea, datos, apiKey: cfg.apiKey })).trim();
        const texto = proveedor !== 'simulado' && tarea !== 'resumen'
          ? window.Markdown.textoPlano(respuesta)
          : respuesta;
        if (!texto || !esSeguro(texto)) throw new Error('Respuesta vacía o con tono no permitido');
        if (tarea === 'invitacion' && REFERENCIA_VAGA.test(texto)) throw new Error('Pregunta con referencia vaga');
        return { texto, proveedor, respaldo: false };
      } catch (e) {
        const aviso = e.code === 'claveGeminiAusente'
          ? 'Falta la clave de Gemini. Vuelve a ingresarla en Ajustes. Mientras tanto, se usa el modo simulado.'
          : '';
        return { texto: await Simulado.generar({ tarea, datos }), proveedor: 'simulado', respaldo: proveedor !== 'simulado', aviso };
      }
    },
    esSeguro
  };
})();
