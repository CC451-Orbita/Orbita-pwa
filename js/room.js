/* ============================================================
   Motor de la reunión + multiusuario (RF-01, RF-02, RF-09 a RF-13)
   - Reproduce el guion simulado (data/simulated.js) en tiempo acelerado.
   - Mide participación por persona y por tema.
   - Al detectar el cierre de un tema abre la "ventana de órbita" (CU-03 v2).
   - Colaboración entre pestañas del mismo navegador con BroadcastChannel
     (en producción se reemplaza por WebSocket/Supabase Realtime sin cambiar la interfaz).
   ============================================================ */
(function () {
  const D = window.ORBITA_DATA;
  const DECISIONES = {
    T1: 'La integración de voz se cierra el viernes; se añade el nombre del hablante a los subtítulos.',
    T2: 'Se aprueba S/ 4 000 para licencias y hosting del piloto (3 meses).',
    T3: 'Se mantiene el lanzamiento del 30 de noviembre con una semana de pruebas con usuarios.'
  };

  let estado = null, timer = null, canal = null, cb = {};
  const CANALES = ['voz', 'texto', 'preparado', 'turno'];
  const colorValido = color => /^#[0-9a-f]{6}$/i.test(color) ? color : '#8C7CF0';

  function nuevoEstado(sala, perfil) {
    const parts = D.participantes.map(p => ({ ...p, habla: 0, ultimo: -99, esTu: false }));
    parts.push({ id: 'tu', nombre: perfil.nombre || 'Tú', color: colorValido(perfil.color), rol: 'Tú', habla: 0, ultimo: -99, esTu: true });
    return {
      sala, participantes: parts, t: 0, idx: 0, temaIdx: 0, pausado: false, ventanaAbierta: false,
      transcripcion: [], aportesTema: {}, decisiones: [], abiertos: [], aportesTu: 0, velocidad: 1, terminada: false
    };
  }

  function participante(id) { return estado.participantes.find(p => p.id === id); }

  function agregarAporte(id, texto, { tema, canalAporte = 'voz', anonimo = false, destacada = false, cierre = false, original } = {}) {
    if (!estado || estado.terminada) return;
    const p = participante(id);
    if (!p) return;
    const temaId = tema || D.agenda[estado.temaIdx]?.id;
    p.ultimo = estado.t;
    if (canalAporte !== 'turno') {
      p.habla += Math.max(2, texto.split(/\s+/).length / 2.5);
      estado.aportesTema[temaId] = estado.aportesTema[temaId] || {};
      estado.aportesTema[temaId][id] = (estado.aportesTema[temaId][id] || 0) + 1;
      if (id === 'tu') estado.aportesTu++;
    }
    const linea = { t: estado.t, id, nombre: anonimo ? 'Aporte anónimo' : p.nombre, color: p.color, texto, tema: temaId, canal: canalAporte, destacada, cierre, original };
    estado.transcripcion.push(linea);
    if (id === 'tu' && canal) canal.postMessage({
      tipo: 'aporte', perfil: { nombre: p.nombre, color: p.color }, texto, tema: temaId, canalAporte, anonimo, de: idLocal
    });
    cb.alAporte?.(linea);
    cb.alCambio?.();
  }

  function contextoDelTema(reunion, tema) {
    const aportes = reunion.transcripcion.filter(l => l.tema === tema.id && !l.cierre);
    const destacados = aportes.filter(l => l.destacada);
    return (destacados.length ? destacados : aportes).slice(-2).map(({ nombre, texto }) => ({
      nombre, texto: texto.length > 160 ? texto.slice(0, 160).replace(/\s+\S*$/, '') + '…' : texto
    }));
  }

  async function abrirVentana(tema) {
    const reunion = estado;
    const vigente = () => estado === reunion && !reunion.terminada && reunion.ventanaAbierta && D.agenda[reunion.temaIdx] === tema;
    estado.pausado = true; estado.ventanaAbierta = true;
    const sinAporte = estado.participantes.filter(p => !(estado.aportesTema[tema.id] || {})[p.id]);
    const total = estado.participantes.reduce((s, p) => s + p.habla, 0) || 1;
    const dominante = estado.participantes.find(p => p.habla / total > 0.45);
    cb.alVentana?.({ tema, sinAporte });

    // Sugerencia privada al dominante (Reverse de SCAMPER)
    if (dominante && (dominante.esTu || !dominante.id.startsWith('remoto-'))) {
      const txt = await window.LLM.generar('sugerenciaDominante', { nombre: dominante.nombre, porcentaje: Math.round(100 * dominante.habla / total) });
      if (!vigente()) return;
      cb.alSugerenciaDominante?.(dominante, txt);
    }

    // Invitaciones privadas
    const contexto = contextoDelTema(reunion, tema);
    const intervenciones = contexto.map(l => `${l.nombre}: ${l.texto}`).join('\n');
    for (const p of sinAporte) {
      if (p.esTu) {
        const pregunta = await window.LLM.generar('invitacion', {
          tema: tema.titulo, nombre: p.nombre, contexto: intervenciones,
          preguntaBase: tema.preguntaInvitacion || tema.pregunta
        });
        if (!vigente()) return;
        cb.alInvitacion?.({ tema, pregunta, contexto });
      } else if (D.respuestasSimuladas[p.id]?.[tema.id]) {
        setTimeout(() => {
          if (!vigente()) return;
          agregarAporte(p.id, D.respuestasSimuladas[p.id][tema.id], { tema: tema.id });
          if (tema.id !== 'T3') {
            const texto = tema.id === 'T1' ? 'Revisar el corte de voz en Safari iOS (60 s).' : 'Verificar el límite de peticiones del plan gratuito del LLM.';
            estado.abiertos.push({ tema: tema.id, texto });
          }
        }, 2600 / estado.velocidad);
      }
    }
    if (!sinAporte.some(p => p.esTu)) setTimeout(() => { if (vigente()) cerrarVentana(); }, 4500 / reunion.velocidad);
  }

  function cerrarVentana() {
    if (!estado || estado.terminada || !estado.ventanaAbierta) return;
    const tema = D.agenda[estado.temaIdx];
    estado.decisiones.push({ tema: tema.id, texto: DECISIONES[tema.id] });
    estado.ventanaAbierta = false; estado.pausado = false;
    estado.temaIdx++;
    cb.alCierreVentana?.(tema);
    if (estado.temaIdx >= D.agenda.length) terminar();
    else cb.alTema?.(D.agenda[estado.temaIdx]);
  }

  function terminar() {
    estado.terminada = true;
    estado.ventanaAbierta = false;
    clearInterval(timer); timer = null;
    canal?.close(); canal = null;
    cb.alFin?.();
  }

  function tick() {
    if (!estado || estado.pausado) return;
    estado.t += 0.25 * estado.velocidad;
    while (estado.idx < D.guion.length && D.guion[estado.idx].t <= estado.t) {
      const l = D.guion[estado.idx++];
      agregarAporte(l.quien, l.texto, { tema: l.tema, destacada: l.destacada, cierre: l.cierre });
      if (l.cierre) { abrirVentana(D.agenda.find(a => a.id === l.tema)); break; }
    }
    cb.alTick?.();
  }

  /* ---------- Multiusuario con BroadcastChannel ---------- */
  const idLocal = Math.random().toString(36).slice(2, 8);
  function conectarCanal(codigo) {
    try {
      canal = new BroadcastChannel('orbita-' + codigo);
      canal.onmessage = ({ data }) => {
        if (!estado || estado.terminada || !data || typeof data.de !== 'string' || data.de === idLocal) return;
        if (!['entrar', 'aporte'].includes(data.tipo) || typeof data.perfil?.nombre !== 'string') return;
        if (data.tipo === 'aporte' && (typeof data.texto !== 'string' || !D.agenda.some(t => t.id === data.tema))) return;
        const id = 'remoto-' + data.de;
        if (!participante(id)) {
          estado.participantes.push({ id, nombre: data.perfil.nombre.slice(0, 20) || 'Invitado', color: colorValido(data.perfil.color), rol: 'Remoto', habla: 0, ultimo: -99, esTu: false });
          cb.alRemoto?.(data.perfil.nombre);
          if (data.tipo === 'entrar') canal.postMessage({ tipo: 'entrar', perfil: { nombre: participante('tu').nombre, color: participante('tu').color }, de: idLocal });
        }
        if (data.tipo === 'aporte') agregarAporte(id, data.texto, {
          tema: data.tema,
          canalAporte: CANALES.includes(data.canalAporte) ? data.canalAporte : 'voz',
          anonimo: data.anonimo === true
        });
        cb.alCambio?.();
      };
      canal.postMessage({ tipo: 'entrar', perfil: { nombre: participante('tu').nombre, color: participante('tu').color }, de: idLocal });
    } catch (e) { canal = null; }
  }

  /* Índice de equilibrio = 1 − coeficiente de Gini de la participación (1 = todos hablaron igual). */
  function indiceEquilibrio(shares) {
    const n = shares.length;
    if (!n) return 1;
    const media = shares.reduce((a, b) => a + b, 0) / n;
    if (!media) return 1;
    let suma = 0;
    for (const a of shares) for (const b of shares) suma += Math.abs(a - b);
    return Math.max(0, 1 - suma / (2 * n * n * media));
  }

  window.Sala = {
    indiceEquilibrio,
    saltarInvitacion() { cerrarVentana(); },
    iniciar(sala, callbacks, { simular = true, compartir = true } = {}) {
      this.salir();
      cb = callbacks;
      estado = nuevoEstado(sala, window.Perfil.obtener());
      if (compartir) conectarCanal(sala.codigo);
      cb.alTema?.(D.agenda[0]);
      if (simular) timer = setInterval(tick, 250);
      cb.alCambio?.();
    },
    salir() { clearInterval(timer); timer = null; canal?.close(); canal = null; estado = null; },
    estado: () => estado,
    velocidad(v) { if (estado) estado.velocidad = v; },
    aporteTu(texto, canalAporte, { anonimo = false, original } = {}) {
      agregarAporte('tu', texto, { canalAporte, anonimo, original });
    },
    responderInvitacion(tipo) { window.Perfil.registrarRespuesta(tipo); if (tipo === 'paso' || tipo === 'sinRespuesta') cerrarVentana(); },
    terminarAporteEnVentana() {
      if (!estado?.ventanaAbierta) return;
      const reunion = estado, tema = estado.temaIdx;
      setTimeout(() => { if (estado === reunion && reunion.temaIdx === tema) cerrarVentana(); }, 1200 / reunion.velocidad);
    },
    forzarFin() { if (estado && !estado.terminada) terminar(); },
    resumenDatos() {
      const total = estado.participantes.reduce((s, p) => s + p.habla, 0) || 1;
      const shares = estado.participantes.map(p => p.habla / total);
      const aportes = estado.transcripcion.filter(l => l.id === 'tu' && l.canal !== 'turno');
      const notasCompartidas = aportes.filter(l => l.canal === 'preparado').length;
      const revision = D.agenda.map(tema => ({
        titulo: tema.titulo,
        aportes: aportes.filter(l => l.tema === tema.id).map(({ canal, texto, original }) => ({ canal, texto, original })),
        acuerdos: estado.decisiones.filter(d => d.tema === tema.id).map(d => d.texto),
        pendientes: estado.abiertos.filter(a => a.tema === tema.id).map(a => a.texto)
      })).filter(tema => tema.aportes.length);
      return {
        decisiones: estado.decisiones.map(d => d.texto),
        abiertos: estado.abiertos.map(a => a.texto),
        equilibrio: indiceEquilibrio(shares), aportesTu: estado.aportesTu, revision,
        notasCompartidas,
        transcripcion: estado.transcripcion.map(l => `${l.nombre}: ${l.texto}`).join('\n'),
        participantes: estado.participantes.map((p, i) => ({ nombre: p.nombre, color: p.color, share: shares[i] })) };
    },
    vistaPlanetas() {
      if (!estado) return [];
      const total = estado.participantes.reduce((s, p) => s + p.habla, 0) || 1;
      return estado.participantes.map(p => ({ ...p, share: p.habla / total, reciente: Math.max(0, 1 - (estado.t - p.ultimo) / 8) }));
    }
  };
})();
