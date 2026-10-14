/* ============================================================
   Órbita – controlador de pantallas
   Flujo: Bienvenida → Perfil → Salas → (Crear sala) → Reunión ⇄ Invitación / Escribir → Resumen → Informe
   ============================================================ */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const D = window.ORBITA_DATA;
  const COLORES = ['#8C7CF0', '#4FC7C2', '#F07CA8', '#F5B94A', '#7FD69A', '#6FA8F5'];
  const historialNav = [];
  let pantallaActual = 'p-bienvenida', salaElegida = null, rafId = null, cuentaTimer = null, ventanaTu = false;

  /* ---------- Navegación ---------- */
  function ir(id, { atras = false } = {}) {
    if (!atras && pantallaActual !== id) historialNav.push(pantallaActual);
    $$('.pantalla').forEach(p => p.classList.toggle('activa', p.id === id));
    pantallaActual = id;
    $('#barra').hidden = id === 'p-bienvenida';
    $('#titulo-barra').textContent = $('#' + id).dataset.titulo;
    $('#main').focus({ preventScroll: true });
    window.scrollTo(0, 0);
    (alEntrar[id] || (() => {}))();
  }
  function atras() {
    if (pantallaActual === 'p-reunion') { if (!confirmarSalida()) return; }
    const prev = historialNav.pop();
    if (prev) ir(prev, { atras: true });
  }
  function confirmarSalida() { window.Sala.salir(); detenerAnimacion(); return true; }
  window.OrbitaApp = { ir, toast };

  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), ms);
  }

  function aplicarAccesibilidad() {
    const a = window.Perfil.obtener().accesibilidad;
    document.body.classList.toggle('alto-contraste', a.altoContraste);
    document.body.classList.toggle('baja-estimulacion', a.bajaEstimulacion);
    document.body.classList.toggle('sin-subtitulos', !a.subtitulos);
    $('#lista-accesible').hidden = !a.listaAccesible;
  }

  /* ---------- P1 Bienvenida ---------- */
  $('#chk-consentimiento').addEventListener('change', e => ($('#btn-empezar').disabled = !e.target.checked));
  $('#btn-empezar').addEventListener('click', () => {
    window.Perfil.actualizar({ consentimiento: true });
    ir(window.Perfil.obtener().nombre ? 'p-salas' : 'p-perfil');
  });

  /* ---------- P2 Perfil ---------- */
  function pintarPerfil() {
    const p = window.Perfil.obtener();
    $('#in-nombre').value = p.nombre;
    $('#colores').innerHTML = COLORES.map(c => `<button class="color" role="radio" aria-label="Color ${c}" aria-checked="${c === p.color}" data-color="${c}" style="background:${c}"></button>`).join('');
    $('#planeta-preview').style.background = `radial-gradient(circle at 35% 30%, #fff8, ${p.color} 45%)`;
    $('#planeta-preview').style.color = p.color;
    $$('[data-acc]').forEach(i => (i.checked = !!p.accesibilidad[i.dataset.acc]));
  }
  $('#colores').addEventListener('click', e => {
    const b = e.target.closest('.color'); if (!b) return;
    window.Perfil.actualizar({ color: b.dataset.color });
    $$('#colores .color').forEach(c => c.setAttribute('aria-checked', c === b));
    $('#planeta-preview').style.background = `radial-gradient(circle at 35% 30%, #fff8, ${b.dataset.color} 45%)`;
    $('#planeta-preview').style.color = b.dataset.color;
  });
  $('#emo-inicio').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    $$('#emo-inicio .chip').forEach(c => c.setAttribute('aria-checked', c === b));
    window.Perfil.registrarEmocion('inicio', b.dataset.emo);
    if (b.dataset.emo === 'nervioso') { window.Perfil.actualizar({ canalPreferido: 'escribir' }); toast('Pondremos "Escribir" como primera opción en tus invitaciones.'); }
  });
  $$('[data-acc]').forEach(i => i.addEventListener('change', () => { window.Perfil.actualizarAccesibilidad({ [i.dataset.acc]: i.checked }); aplicarAccesibilidad(); }));
  $('#btn-guardar-perfil').addEventListener('click', () => {
    const nombre = $('#in-nombre').value.trim();
    if (!nombre) { $('#in-nombre').focus(); toast('Escribe tu nombre para crear tu planeta.'); return; }
    window.Perfil.actualizar({ nombre });
    ir('p-salas');
  });

  /* ---------- P3 Salas ---------- */
  function pintarSalas() {
    const p = window.Perfil.obtener();
    $('#saludo').textContent = `Hola, ${p.nombre || 'invitado'} 👋`;
    const aprend = [];
    if (p.reuniones) aprend.push(`${p.reuniones} reunión(es) contigo`);
    if (p.canalPreferido === 'escribir') aprend.push('prefieres aportar por escrito');
    $('#aprendizaje').textContent = aprend.length ? 'Órbita recuerda: ' + aprend.join(' · ') : 'Únete a una sala o crea una nueva.';
    $('#lista-salas').innerHTML = D.salas.map(s => `
      <li><button data-codigo="${s.codigo}">
        <span><b>${s.nombre}</b><small>${s.codigo} · ${s.modo} · ${s.integrantes} personas</small></span>
        <span class="punto ${s.activa ? '' : 'off'}" aria-label="${s.activa ? 'En curso' : 'Sin actividad'}"></span>
      </button></li>`).join('');
  }
  $('#lista-salas').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    salaElegida = D.salas.find(s => s.codigo === b.dataset.codigo);
    ir('p-reunion');
  });
  $('#btn-unirse').addEventListener('click', () => {
    const cod = $('#in-codigo').value.trim().toUpperCase();
    if (!/^ORB-\d{4}$/.test(cod)) { toast('El código tiene el formato ORB-0000.'); $('#in-codigo').focus(); return; }
    salaElegida = D.salas.find(s => s.codigo === cod) || { codigo: cod, nombre: 'Sala ' + cod, modo: 'videollamada' };
    ir('p-reunion');
  });
  $('#btn-ir-crear').addEventListener('click', () => ir('p-crear'));
  $('#btn-ir-informe').addEventListener('click', () => ir('p-informe'));

  /* ---------- P4 Crear sala ---------- */
  function pintarCrear() {
    $('#agenda-crear').innerHTML = D.agenda.map(a => `<li>${a.titulo}</li>`).join('');
    $('#codigo-nuevo').textContent = 'ORB-' + String(Math.floor(1000 + Math.random() * 9000));
  }
  $$('#p-crear .segmentado').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('.seg'); if (!b) return;
    g.querySelectorAll('.seg').forEach(s => { s.classList.toggle('activo', s === b); s.setAttribute('aria-checked', s === b); });
  }));
  $('#btn-iniciar-reunion').addEventListener('click', () => {
    salaElegida = { codigo: $('#codigo-nuevo').textContent, nombre: $('#in-sala-nombre').value || 'Mi reunión', modo: $('#p-crear .seg.activo').dataset.modo };
    ir('p-reunion');
  });

  /* ---------- P5 Reunión ---------- */
  function iniciarReunion() {
    aplicarAccesibilidad();
    window.Orbitas.montar($('#orbitas'));
    $('#subtitulos').innerHTML = '<p class="sutil">Esperando que alguien hable…</p>';
    $('#toast-dominante').hidden = true;
    window.Sala.iniciar(salaElegida || D.salas[0], {
      alTema: t => { $('#tema-actual').textContent = t.titulo; },
      alAporte: l => {
        const s = $('#subtitulos');
        if (s.querySelector('.sutil')) s.innerHTML = '';
        const p = document.createElement('p');
        p.innerHTML = `<b style="color:${l.color}">${l.nombre}${l.canal === 'texto' ? ' ✎' : ''}:</b> ${escapar(l.texto)}`;
        s.appendChild(p);
        while (s.children.length > 3) s.firstChild.remove();
      },
      alCambio: dibujar,
      alTick: () => {},
      alVentana: () => { $('#aviso-ambiental').hidden = false; window.Orbitas.ventana(true); },
      alCierreVentana: () => { $('#aviso-ambiental').hidden = true; window.Orbitas.ventana(false); cerrarModal('#m-invitacion'); },
      alSugerenciaDominante: (dom, txt) => {
        const t = $('#toast-dominante');
        t.innerHTML = `<b>Vista privada de ${dom.nombre}:</b> “${escapar(txt)}”`;
        t.hidden = false; setTimeout(() => (t.hidden = true), 7000);
      },
      alInvitacion: mostrarInvitacion,
      alRemoto: nombre => toast(`🪐 ${nombre} entró a la sala`),
      alFin: () => { detenerAnimacion(); window.Perfil.cerrarReunion(); setTimeout(() => ir('p-resumen'), 900); }
    });
    window.Sala.velocidad(2);
    $$('[data-vel]').forEach(b => b.classList.toggle('activo', b.dataset.vel === '2'));
    animar();
  }
  function dibujar() {
    const planetas = window.Sala.vistaPlanetas();
    const acc = window.Perfil.obtener().accesibilidad;
    window.Orbitas.dibujar(planetas, { bajaEstimulacion: acc.bajaEstimulacion });
    if (acc.listaAccesible) {
      $('#lista-accesible').innerHTML = planetas.map(p =>
        `<li><span class="bola" style="background:${p.color}"></span><span><b>${p.nombre}${p.esTu ? ' (tú)' : ''}</b>: ${window.Orbitas.describir(p, planetas.length)}</span></li>`).join('');
    }
  }
  function animar() {
    detenerAnimacion();
    let ultimo = 0;
    const paso = ts => {
      if (ts - ultimo > 50) { window.Orbitas.avanzarGiro(window.Sala.vistaPlanetas()); dibujar(); ultimo = ts; }
      rafId = requestAnimationFrame(paso);
    };
    rafId = requestAnimationFrame(paso);
  }
  function detenerAnimacion() { cancelAnimationFrame(rafId); rafId = null; }

  $$('[data-vel]').forEach(b => b.addEventListener('click', () => {
    window.Sala.velocidad(+b.dataset.vel);
    $$('[data-vel]').forEach(x => x.classList.toggle('activo', x === b));
  }));

  /* Voz */
  $('#btn-mic').addEventListener('click', () => usarMicrofono());
  function usarMicrofono() {
    if (window.OrbitaDemo && window.OrbitaDemo.activo()) return; // en la simulación la voz se simula
    if (!window.Voz.soportaReconocimiento) { toast('Tu navegador no soporta voz. Usa "Escribir" (cuenta igual).'); abrirEscribir(); return; }
    window.Voz.escuchar({
      alEstado: e => {
        $('#btn-mic').classList.toggle('escuchando', e === 'escuchando' || e.startsWith('parcial'));
        $('#estado-voz').textContent = e === 'escuchando' ? 'Te escucho…' : e.startsWith('parcial:') ? e.slice(8) : e.startsWith('error') ? 'No se pudo usar el micrófono. Prueba "Escribir".' : '';
      },
      alTexto: (texto, seg) => { window.Perfil.registrarRitmo(texto, seg); aportar(texto, 'voz'); },
      alComando: accion => {
        if (accion === 'escribir') abrirEscribir();
        else if (accion === 'resumen') { window.Sala.forzarFin(); }
        else if (accion === 'paso' && ventanaTu) responder('paso');
        else if (accion === 'pedirPalabra') { toast('✋ Pediste la palabra: tu planeta brilla para el grupo.'); window.Sala.aporteTu('(pide la palabra)', 'voz'); }
      }
    });
  }
  function aportar(texto, canal) {
    window.Sala.aporteTu(texto, canal);
    if (ventanaTu) { ventanaTu = false; cerrarModal('#m-invitacion'); window.Sala.terminarAporteEnVentana(); toast('✨ Tu planeta ganó brillo. ¡Gracias por tu aporte!'); }
  }

  /* Escribir */
  $('#btn-escribir').addEventListener('click', () => abrirEscribir());
  function abrirEscribir() { abrirModal('#m-escribir'); setTimeout(() => $('#in-aporte').focus(), 50); }
  $('#btn-cancelar-escribir').addEventListener('click', () => cerrarModal('#m-escribir'));
  $('#btn-enviar-aporte').addEventListener('click', async () => {
    const txt = $('#in-aporte').value.trim();
    if (!txt) { $('#in-aporte').focus(); return; }
    const resumen = await window.LLM.generar('resumirAporte', { texto: txt });
    cerrarModal('#m-escribir'); $('#in-aporte').value = '';
    if ($('#chk-anonimo').checked) {
      const nombreReal = window.Sala.estado().participantes.find(p => p.id === 'tu');
      const n = nombreReal.nombre; nombreReal.nombre = 'Aporte anónimo'; aportar(resumen, 'texto'); nombreReal.nombre = n;
    } else aportar(resumen, 'texto');
  });

  $('#btn-lista').addEventListener('click', () => {
    const p = window.Perfil.obtener();
    window.Perfil.actualizarAccesibilidad({ listaAccesible: !p.accesibilidad.listaAccesible });
    aplicarAccesibilidad(); dibujar();
  });
  $('#btn-terminar').addEventListener('click', () => window.Sala.forzarFin());

  /* ---------- P6 Invitación privada ---------- */
  function mostrarInvitacion({ pregunta }) {
    ventanaTu = true;
    $('#inv-pregunta').textContent = pregunta;
    const pref = window.Perfil.obtener().canalPreferido;
    const cont = $('#acciones-inv');
    const bH = cont.querySelector('[data-resp=hablar]'), bE = cont.querySelector('[data-resp=escribir]');
    if (pref === 'escribir') { cont.prepend(bE); bE.className = 'btn primario'; bH.className = 'btn secundario'; }
    else { cont.prepend(bH); bH.className = 'btn primario'; bE.className = 'btn secundario'; }
    abrirModal('#m-invitacion');
    window.Voz.vibrar(); window.Voz.hablar('Tu ventana de órbita. ' + pregunta);
    // Cuenta regresiva: se cierra sola sin avisar a nadie (A3)
    const total = window.Perfil.obtener().toleranciaSilencioSeg * 1000, ini = Date.now();
    clearInterval(cuentaTimer);
    cuentaTimer = setInterval(() => {
      const r = 1 - (Date.now() - ini) / total;
      $('#inv-cuenta').style.width = Math.max(0, r * 100) + '%';
      if (r <= 0) { clearInterval(cuentaTimer); if (ventanaTu) responder('sinRespuesta'); }
    }, 100);
  }
  $('#acciones-inv').addEventListener('click', e => { const b = e.target.closest('[data-resp]'); if (b) responder(b.dataset.resp); });
  function responder(tipo) {
    clearInterval(cuentaTimer);
    cerrarModal('#m-invitacion');
    if (tipo === 'hablar' || tipo === 'escribir') {
      // Turno reservado de 60 s: si no llega el aporte, la ventana se cierra sola.
      setTimeout(() => { if (ventanaTu) { ventanaTu = false; window.Sala.terminarAporteEnVentana(); } }, 60000);
    }
    if (tipo === 'hablar') { window.Perfil.registrarRespuesta('hablar'); toast('🎙 Tienes 60 s reservados. Nadie te interrumpirá.'); usarMicrofono(); return; }
    if (tipo === 'escribir') { window.Perfil.registrarRespuesta('escribir'); abrirEscribir(); return; }
    ventanaTu = false;
    window.Sala.responderInvitacion(tipo);
    if (window.Perfil.inferirEmocion() === 'incomodidad') toast('Puedes aportar por escrito cuando quieras. Sin presión. 💜', 3500);
    else if (tipo === 'paso') toast('Entendido. No volveremos a invitarte en este tema.');
  }

  /* ---------- P8 Resumen ---------- */
  let datosResumen = null;
  async function pintarResumen() {
    if (!window.Sala.estado()) return;
    datosResumen = window.Sala.resumenDatos();
    const texto = await window.LLM.generar('resumen', datosResumen);
    const partes = texto.split(/Temas abiertos:/i);
    const lineas = s => (s || '').split('\n').map(x => x.replace(/^[•\-*]\s*/, '').replace(/^Decisiones:/i, '').trim()).filter(Boolean);
    $('#res-decisiones').innerHTML = lineas(partes[0]).map(x => `<li>${escapar(x)}</li>`).join('');
    $('#res-abiertos').innerHTML = lineas(partes[1]).map(x => `<li>${escapar(x)}</li>`).join('') || '<li>Ninguno</li>';
    const eq = Math.round(datosResumen.equilibrio * 100);
    setTimeout(() => ($('#res-medidor').style.width = eq + '%'), 50);
    $('#res-equilibrio').textContent = `Índice de equilibrio: ${eq} / 100 (100 = todos participaron igual).`;
    $('#res-barras').innerHTML = datosResumen.participantes.map(p =>
      `<div class="barra-p"><span>${escapar(p.nombre)}</span><div class="pista"><div style="width:${Math.round(p.share * 100)}%;background:${p.color}"></div></div></div>`).join('');
    $('#res-proveedor').textContent = 'Resumen generado con: ' + window.LLM.proveedores[window.LLM.ultimoProveedorUsado].nombre;
  }
  $('#emo-fin').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    $$('#emo-fin .chip').forEach(c => c.classList.toggle('activo', c === b));
    window.Perfil.registrarEmocion('fin', b.dataset.emo);
  });
  $('#btn-ver-reflexion').addEventListener('click', () => ir('p-informe'));
  $('#btn-guardar-transcripcion').addEventListener('click', () => {
    if (!datosResumen) return;
    const blob = new Blob([datosResumen.transcripcion], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'orbita-transcripcion.txt'; a.click();
    toast('Transcripción guardada en tu dispositivo.');
  });

  /* ---------- P9 Informe ---------- */
  async function pintarInforme() {
    const p = window.Perfil.obtener();
    const aportes = datosResumen ? datosResumen.aportesTu : 0;
    $('#inf-reflexion').textContent = await window.LLM.generar('reflexion', { aportes });
    const hist = [...D.historial];
    if (datosResumen) hist.push({ fecha: 'Hoy', equilibrio: datosResumen.equilibrio, aportesTu: aportes });
    const w = 320, h = 140, pad = 24, n = hist.length;
    const x = i => pad + i * ((w - 2 * pad) / Math.max(1, n - 1)), y = v => h - pad - v * (h - 2 * pad);
    const pts = hist.map((d, i) => `${x(i)},${y(d.equilibrio)}`).join(' ');
    $('#inf-grafico').innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución del equilibrio en tus reuniones">
      <line x1="${pad}" x2="${w - pad}" y1="${y(0.7)}" y2="${y(0.7)}" stroke="#4FC7C2" stroke-dasharray="4 4" opacity=".6"/>
      <polyline points="${pts}" fill="none" stroke="#8C7CF0" stroke-width="3"/>
      ${hist.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.equilibrio)}" r="5" fill="#F5B94A"/><text x="${x(i)}" y="${h - 6}" font-size="9" fill="#B4ADD6" text-anchor="middle">${d.fecha.slice(5) || d.fecha}</text>`).join('')}
    </svg>`;
    const r = p.respuestas;
    $('#inf-aprendizaje').innerHTML = [
      `Canal preferido: <b>${p.canalPreferido}</b> (hablar ${r.hablar} · escribir ${r.escribir} · paso ${r.paso})`,
      `Tiempo de invitación ajustado a <b>${p.toleranciaSilencioSeg} s</b>`,
      p.ritmoPalabrasMin ? `Tu ritmo de habla: <b>${p.ritmoPalabrasMin} palabras/min</b>` : 'Ritmo de habla: se calcula cuando usas el micrófono',
      `Emociones registradas: <b>${p.emociones.length}</b> (${p.emociones.slice(-2).map(e => e.valor).join(', ') || '—'})`,
      `Aportes totales: <b>${p.aportesTotales}</b> en ${p.reuniones} reunión(es)`
    ].map(t => `<li>${t}</li>`).join('');
  }
  $('#btn-volver-salas').addEventListener('click', () => { historialNav.length = 0; ir('p-salas'); });

  /* ---------- P10 Ajustes ---------- */
  function pintarAjustes() {
    const { llm } = window.Perfil.obtener();
    $('#sel-proveedor').value = llm.proveedor; $('#in-apikey').value = llm.apiKey;
    $('#campo-key').hidden = llm.proveedor !== 'gemini';
  }
  $('#sel-proveedor').addEventListener('change', e => {
    const p = window.Perfil.obtener(); p.llm.proveedor = e.target.value; window.Perfil.actualizar({ llm: p.llm }); pintarAjustes();
  });
  $('#in-apikey').addEventListener('change', e => { const p = window.Perfil.obtener(); p.llm.apiKey = e.target.value.trim(); window.Perfil.actualizar({ llm: p.llm }); });
  $('#btn-probar-llm').addEventListener('click', async () => {
    $('#resultado-llm').textContent = 'Probando…';
    const t = await window.LLM.generar('invitacion', { tema: 'Presupuesto del piloto', nombre: 'Diego', contexto: 'Ana: propongo cuatro mil soles.', preguntaBase: '¿Ves algún riesgo en el presupuesto?' });
    $('#resultado-llm').textContent = `[${window.LLM.proveedores[window.LLM.ultimoProveedorUsado].nombre}] ${t}`;
  });
  $('#btn-editar-perfil').addEventListener('click', () => ir('p-perfil'));
  $('#btn-borrar').addEventListener('click', () => { window.Perfil.borrarTodo(); historialNav.length = 0; toast('Datos borrados.'); ir('p-bienvenida'); });

  /* ---------- Comunes ---------- */
  $('#btn-atras').addEventListener('click', atras);
  $('#btn-ajustes').addEventListener('click', () => ir('p-ajustes'));
  let ultimoFoco = null;
  function abrirModal(sel) { ultimoFoco = document.activeElement; $(sel).hidden = false; $(sel).querySelector('button, textarea')?.focus(); }
  function cerrarModal(sel) { $(sel).hidden = true; ultimoFoco?.focus?.(); }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#m-escribir').hidden) cerrarModal('#m-escribir');
    else if (!$('#m-invitacion').hidden) responder('paso');
  });
  function escapar(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  const alEntrar = {
    'p-perfil': pintarPerfil, 'p-salas': pintarSalas, 'p-crear': pintarCrear,
    'p-reunion': iniciarReunion, 'p-resumen': pintarResumen, 'p-informe': pintarInforme, 'p-ajustes': pintarAjustes
  };

  /* Exponer para la simulación guiada */
  window.OrbitaApp.internos = { responder, aportar, abrirEscribir, cerrarModal, mostrarInvitacion };

  aplicarAccesibilidad();
  if (window.Perfil.obtener().consentimiento) $('#chk-consentimiento').checked = true, ($('#btn-empezar').disabled = false);

  /* PWA: service worker (solo en http/https, no con file://) */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
