/* ============================================================
   Motor de la reunión + multiusuario (RF-01, RF-02, RF-09 a RF-13)
   - Reproduce el guion simulado (data/simulated.js) en tiempo acelerado.
   - Mide participación por persona y por tema.
   - Al detectar el cierre de un tema abre la "ventana de órbita" (CU-03 v2).
   - Multiusuario real entre pestañas/dispositivos del mismo origen con BroadcastChannel
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

  function nuevoEstado(sala, perfil) {
    const parts = D.participantes.map(p => ({ ...p, habla: 0, ultimo: -99, esTu: false }));
    parts.push({ id: 'tu', nombre: perfil.nombre || 'Tú', color: perfil.color, rol: 'Tú', habla: 0, ultimo: -99, esTu: true });
    return {
      sala, participantes: parts, t: 0, idx: 0, temaIdx: 0, pausado: false, ventanaAbierta: false,
      transcripcion: [], aportesTema: {}, decisiones: [], abiertos: [], aportesTu: 0, velocidad: 1, terminada: false
    };
  }

  function participante(id) { return estado.participantes.find(p => p.id === id); }

  function agregarAporte(id, texto, { tema, canalAporte = 'voz', remoto = false } = {}) {
    const p = participante(id);
    if (!p) return;
    const temaId = tema || D.agenda[estado.temaIdx]?.id;
    p.habla += Math.max(2, texto.split(/\s+/).length / 2.5);
    p.ultimo = estado.t;
    estado.aportesTema[temaId] = estado.aportesTema[temaId] || {};
    estado.aportesTema[temaId][id] = (estado.aportesTema[temaId][id] || 0) + 1;
    const linea = { t: estado.t, id, nombre: p.nombre, color: p.color, texto, tema: temaId, canal: canalAporte };
    estado.transcripcion.push(linea);
    if (id === 'tu') estado.aportesTu++;
    if (id === 'tu' && !remoto && canal) canal.postMessage({ tipo: 'aporte', perfil: { nombre: p.nombre, color: p.color }, texto, tema: temaId, de: idLocal });
    cb.alAporte?.(linea);
    cb.alCambio?.();
  }

  async function abrirVentana(tema) {
    estado.pausado = true; estado.ventanaAbierta = true;
    const sinAporte = estado.participantes.filter(p => !(estado.aportesTema[tema.id] || {})[p.id]);
    const total = estado.participantes.reduce((s, p) => s + p.habla, 0) || 1;
    const dominante = estado.participantes.find(p => p.habla / total > 0.45);
    cb.alVentana?.({ tema, sinAporte });

    // Sugerencia privada al dominante (Reverse de SCAMPER)
    if (dominante && !dominante.esTu) {
      const txt = await window.LLM.generar('sugerenciaDominante', { nombre: dominante.nombre, porcentaje: Math.round(100 * dominante.habla / total) });
      cb.alSugerenciaDominante?.(dominante, txt);
    }

    // Invitaciones privadas
    const contexto = estado.transcripcion.slice(-3).map(l => `${l.nombre}: ${l.texto}`).join('\n');
    for (const p of sinAporte) {
      if (p.esTu) {
        const pregunta = await window.LLM.generar('invitacion', { tema: tema.titulo, nombre: p.nombre, contexto, preguntaBase: tema.pregunta });
        cb.alInvitacion?.({ tema, pregunta });
      } else if (D.respuestasSimuladas[p.id]?.[tema.id]) {
        setTimeout(() => {
          if (!estado || !estado.ventanaAbierta) return;
          agregarAporte(p.id, D.respuestasSimuladas[p.id][tema.id], { tema: tema.id });
          if (tema.id !== 'T3') estado.abiertos.push(tema.id === 'T1' ? 'Revisar el corte de voz en Safari iOS (60 s).' : 'Verificar el límite de peticiones del plan gratuito del LLM.');
        }, 2600 / estado.velocidad);
      }
    }
    if (!sinAporte.some(p => p.esTu)) setTimeout(() => cerrarVentana(), 4500 / estado.velocidad);
  }

  function cerrarVentana() {
    if (!estado || !estado.ventanaAbierta) return;
    const tema = D.agenda[estado.temaIdx];
    estado.decisiones.push(DECISIONES[tema.id]);
    estado.ventanaAbierta = false; estado.pausado = false;
    estado.temaIdx++;
    cb.alCierreVentana?.(tema);
    if (estado.temaIdx >= D.agenda.length) terminar();
    else cb.alTema?.(D.agenda[estado.temaIdx]);
  }

  function terminar() {
    estado.terminada = true;
    clearInterval(timer); timer = null;
    cb.alFin?.();
  }

  function tick() {
    if (!estado || estado.pausado) return;
    estado.t += 0.25 * estado.velocidad;
    while (estado.idx < D.guion.length && D.guion[estado.idx].t <= estado.t) {
      const l = D.guion[estado.idx++];
      agregarAporte(l.quien, l.texto, { tema: l.tema });
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
        if (!estado || data.de === idLocal) return;
        const id = 'remoto-' + data.de;
        if (!participante(id)) {
          estado.participantes.push({ id, nombre: data.perfil.nombre || 'Invitado', color: data.perfil.color, rol: 'Remoto', habla: 0, ultimo: -99, esTu: false });
          cb.alRemoto?.(data.perfil.nombre);
          if (data.tipo === 'entrar') canal.postMessage({ tipo: 'entrar', perfil: { nombre: participante('tu').nombre, color: participante('tu').color }, de: idLocal });
        }
        if (data.tipo === 'aporte') agregarAporte(id, data.texto, { tema: data.tema, remoto: true });
        cb.alCambio?.();
      };
      canal.postMessage({ tipo: 'entrar', perfil: { nombre: participante('tu').nombre, color: participante('tu').color }, de: idLocal });
    } catch (e) { canal = null; }
  }

  window.Sala = {
    iniciar(sala, callbacks, { simular = true } = {}) {
      this.salir();
      cb = callbacks;
      estado = nuevoEstado(sala, window.Perfil.obtener());
      conectarCanal(sala.codigo);
      cb.alTema?.(D.agenda[0]);
      if (simular) timer = setInterval(tick, 250);
      cb.alCambio?.();
    },
    salir() { clearInterval(timer); timer = null; canal?.close(); canal = null; estado = null; },
    estado: () => estado,
    velocidad(v) { if (estado) estado.velocidad = v; },
    aporteTu(texto, canalAporte) { agregarAporte('tu', texto, { canalAporte }); },
    responderInvitacion(tipo) { window.Perfil.registrarRespuesta(tipo); if (tipo === 'paso' || tipo === 'sinRespuesta') cerrarVentana(); },
    terminarAporteEnVentana() { setTimeout(cerrarVentana, 1200 / (estado?.velocidad || 1)); },
    forzarFin() { if (estado && !estado.terminada) { while (estado.temaIdx < D.agenda.length) { estado.decisiones.push(DECISIONES[D.agenda[estado.temaIdx].id]); estado.temaIdx++; } terminar(); } },
    resumenDatos() {
      const total = estado.participantes.reduce((s, p) => s + p.habla, 0) || 1;
      const shares = estado.participantes.map(p => p.habla / total);
      // Índice de equilibrio: 1 - coeficiente de Gini de la participación
      const n = shares.length; let suma = 0;
      for (const a of shares) for (const b of shares) suma += Math.abs(a - b);
      const gini = suma / (2 * n * n * (1 / n));
      return { decisiones: estado.decisiones, abiertos: estado.abiertos, equilibrio: Math.max(0, 1 - gini), aportesTu: estado.aportesTu,
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
