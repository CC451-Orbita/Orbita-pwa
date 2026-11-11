/* ============================================================
   Capa de abstracción LLM (RF-20)
   Todos los proveedores exponen la misma interfaz: generar({sistema, prompt}) -> Promise<string>.
   Cambiar de proveedor = cambiar una línea en Ajustes. Si un proveedor remoto falla,
   se usa el proveedor simulado (degradación elegante, RNF-09).
   ============================================================ */
(function () {
  const Prompts = window.PromptsLLM;

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
    async generar({ tarea, datos }) {
      const mensajeConexion = 'El servidor de Órbita no está disponible. Inicia la app con npm start.';
      let res;
      try {
        res = await fetch('api/reunion/generar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(27000),
          body: JSON.stringify({ tarea, datos: Prompts.seleccionarDatos(tarea, datos) })
        });
      } catch (error) {
        const mensaje = error.name === 'TimeoutError' ? 'El servidor tardó demasiado. Intenta de nuevo.' : mensajeConexion;
        throw Object.assign(new Error(mensaje), { code: 'errorGemini' });
      }
      const respuesta = await res.json().catch(() => null);
      if (!res.ok || typeof respuesta?.texto !== 'string') {
        throw Object.assign(new Error(respuesta?.error || mensajeConexion), { code: 'errorGemini' });
      }
      return respuesta.texto;
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
        body: JSON.stringify({ model: this.modelo, system: Prompts.sistema, prompt: Prompts.construir(tarea, datos), stream: false })
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
        const respuesta = (await PROVEEDORES[proveedor].generar({ tarea, datos })).trim();
        const texto = proveedor !== 'simulado' && tarea !== 'resumen'
          ? window.Markdown.textoPlano(respuesta)
          : respuesta;
        if (!texto || !esSeguro(texto)) throw new Error('Respuesta vacía o con tono no permitido');
        if (tarea === 'invitacion' && REFERENCIA_VAGA.test(texto)) throw new Error('Pregunta con referencia vaga');
        return { texto, proveedor, respaldo: false };
      } catch (e) {
        const aviso = e.code === 'errorGemini'
          ? e.message + ' Se usó el modo simulado.'
          : '';
        return { texto: await Simulado.generar({ tarea, datos }), proveedor: 'simulado', respaldo: proveedor !== 'simulado', aviso };
      }
    },
    esSeguro
  };
})();
