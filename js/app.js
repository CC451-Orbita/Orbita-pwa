/* ============================================================
   Órbita – controlador de pantallas
   Flujo: Bienvenida → Perfil → Salas → (Crear sala) → Sala de espera ⇄ Preparar → Reunión ⇄ Invitación / Escribir / Mis notas → Resumen → Informe
   ============================================================ */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const D = window.ORBITA_DATA;
  const COLORES = ['#8C7CF0', '#4FC7C2', '#F07CA8', '#F5B94A', '#7FD69A', '#6FA8F5'];
  const historialNav = [];
  let pantallaActual = 'p-bienvenida', salaElegida = null, rafId = null, cuentaTimer = null, ventanaTu = false, temaActual = null;
  let turnoTimer = null, resumenTimer = null;

  /* ---------- Navegación ---------- */
  function ir(id, { atras = false } = {}) {
    if (pantallaActual === 'p-antesala') window.PrepUI.detener();
    if (pantallaActual === 'p-preparar') window.Voz.detener();
    if (pantallaActual === 'p-asistente') window.Asistente.cerrar();
    if (pantallaActual === 'p-reunion' && id !== 'p-reunion') {
      detenerInterfazReunion();
      if (id !== 'p-resumen') window.Sala.salir();
    }
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
    const prev = historialNav.pop();
    if (prev) ir(prev, { atras: true });
  }
  function reiniciar() {
    window.Sala.salir();
    detenerInterfazReunion();
    historialNav.length = 0;
    salaElegida = null;
    temaActual = null;
    datosResumen = null;
    $('#in-aporte').value = '';
    $('#chk-anonimo').checked = false;
    $('#in-apikey').value = '';
    $('#resultado-llm').textContent = '';
    $('#toast').hidden = true;
    aplicarAccesibilidad();
    ir('p-bienvenida', { atras: true });
  }
  window.OrbitaApp = { ir, toast, reiniciar, salaActual: () => salaElegida };

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
  function pintarBienvenida() {
    const consentido = window.Perfil.obtener().consentimiento;
    $('#chk-consentimiento').checked = consentido;
    $('#btn-empezar').disabled = !consentido;
  }
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
    ir('p-antesala');
  });
  $('#btn-unirse').addEventListener('click', () => {
    const cod = $('#in-codigo').value.trim().toUpperCase();
    if (!/^ORB-\d{4}$/.test(cod)) { toast('El código tiene el formato ORB-0000.'); $('#in-codigo').focus(); return; }
    salaElegida = D.salas.find(s => s.codigo === cod) || { codigo: cod, nombre: 'Sala ' + cod, modo: 'videollamada' };
    ir('p-antesala');
  });
  $('#btn-ir-crear').addEventListener('click', () => ir('p-crear'));
  $('#btn-ir-asistente').addEventListener('click', () => ir('p-asistente'));
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
    ir('p-antesala');
  });

  /* ---------- P5 Reunión ---------- */
  function iniciarReunion() {
    aplicarAccesibilidad();
    window.Orbitas.montar($('#orbitas'));
    $('#subtitulos').innerHTML = '<p class="sutil">Esperando que alguien hable…</p>';
    $('#toast-dominante').hidden = true;
    window.Sala.iniciar(salaElegida || D.salas[0], {
      alTema: t => { temaActual = t; $('#tema-actual').textContent = t.titulo; },
      alAporte: l => {
        const s = $('#subtitulos');
        if (s.querySelector('.sutil')) s.innerHTML = '';
        const p = document.createElement('p');
        const icono = l.canal === 'texto' ? ' ✎' : l.canal === 'preparado' ? ' 📝' : '';
        const nombre = document.createElement('b');
        nombre.style.color = l.color;
        nombre.textContent = `${l.nombre}${icono}:`;
        p.append(nombre, ' ' + l.texto);
        s.appendChild(p);
        while (s.children.length > 3) s.firstChild.remove();
      },
      alCambio: dibujar,
      alTick: () => {},
      alVentana: () => { $('#aviso-ambiental').hidden = false; window.Orbitas.ventana(true); },
      alCierreVentana: cerrarInvitacion,
      alSugerenciaDominante: (dom, txt) => {
        const t = $('#toast-dominante');
        t.textContent = dom.esTu ? txt : `Ejemplo para ${dom.nombre}: ${txt}`;
        t.hidden = false;
        clearTimeout(t._h);
        t._h = setTimeout(() => (t.hidden = true), 7000);
      },
      alInvitacion: mostrarInvitacion,
      alRemoto: nombre => toast(`🪐 ${nombre} entró a la sala`),
      alFin: () => {
        detenerInterfazReunion();
        window.Perfil.cerrarReunion();
        resumenTimer = setTimeout(() => ir('p-resumen'), 900);
      }
    }, { compartir: !window.OrbitaDemo?.activo() });
    window.Sala.velocidad(2);
    $$('[data-vel]').forEach(b => b.classList.toggle('activo', b.dataset.vel === '2'));
    animar();
  }
  function dibujar() {
    const planetas = window.Sala.vistaPlanetas();
    const acc = window.Perfil.obtener().accesibilidad;
    window.Orbitas.dibujar(planetas, { bajaEstimulacion: acc.bajaEstimulacion });
    if (acc.listaAccesible) {
      const lista = planetas.map(p =>
        `<li><span class="bola" style="background:${p.color}"></span><span><b>${escapar(p.nombre)}${p.esTu ? ' (tú)' : ''}</b>: ${window.Orbitas.describir(p, planetas.length)}</span></li>`).join('');
      const el = $('#lista-accesible');
      if (el._contenido !== lista) {
        el.innerHTML = lista;
        el._contenido = lista;
      }
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
  function cerrarInvitacion() {
    clearInterval(cuentaTimer);
    clearTimeout(turnoTimer);
    ventanaTu = false;
    $('#aviso-ambiental').hidden = true;
    window.Orbitas.ventana(false);
    cerrarModal('#m-invitacion');
  }
  function detenerInterfazReunion() {
    detenerAnimacion();
    window.Voz.detener();
    $('#btn-mic').classList.remove('escuchando');
    $('#estado-voz').textContent = '';
    cerrarInvitacion();
    while (modales.length) cerrarModal(modales.at(-1).selector);
    clearTimeout(resumenTimer);
  }

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
        $('#estado-voz').textContent = e === 'escuchando' ? 'Te escucho…' : e.startsWith('parcial:') ? e.slice(8) : e.startsWith('error') ? window.Voz.mensajeError(e) : '';
      },
      alTexto: (texto, seg) => { window.Perfil.registrarRitmo(texto, seg); aportar(texto, 'voz'); },
      alComando: accion => {
        if (accion === 'escribir') abrirEscribir();
        else if (accion === 'resumen') { window.Sala.forzarFin(); }
        else if (accion === 'paso' && ventanaTu) responder('paso');
        else if (accion === 'pedirPalabra') { toast('✋ Pediste la palabra: tu planeta brilla para el grupo.'); window.Sala.aporteTu('(pide la palabra)', 'turno'); }
      }
    });
  }
  function aportar(texto, canal, opciones) {
    window.Sala.aporteTu(texto, canal, opciones);
    if (ventanaTu) {
      clearInterval(cuentaTimer);
      clearTimeout(turnoTimer);
      ventanaTu = false;
      cerrarModal('#m-invitacion');
      window.Sala.terminarAporteEnVentana();
      toast('✨ Tu planeta ganó brillo. ¡Gracias por tu aporte!');
    }
  }

  /* Escribir */
  $('#btn-escribir').addEventListener('click', () => abrirEscribir());
  function abrirEscribir() { abrirModal('#m-escribir', '#in-aporte'); }
  $('#btn-cancelar-escribir').addEventListener('click', () => cerrarModal('#m-escribir'));
  $('#btn-enviar-aporte').addEventListener('click', async () => {
    const txt = $('#in-aporte').value.trim();
    if (!txt) { $('#in-aporte').focus(); return; }
    const reunion = window.Sala.estado();
    if (!reunion || reunion.terminada) return;
    const anonimo = $('#chk-anonimo').checked;
    const boton = $('#btn-enviar-aporte');
    const modal = modales.find(m => m.selector === '#m-escribir');
    boton.disabled = true;
    const resumen = await window.LLM.generar('resumirAporte', { texto: txt });
    boton.disabled = false;
    if (window.Sala.estado() !== reunion || reunion.terminada || !modales.includes(modal)) return;
    cerrarModal('#m-escribir'); $('#in-aporte').value = '';
    aportar(resumen, 'texto', { anonimo, original: txt });
  });

  $('#btn-lista').addEventListener('click', () => {
    const p = window.Perfil.obtener();
    window.Perfil.actualizarAccesibilidad({ listaAccesible: !p.accesibilidad.listaAccesible });
    aplicarAccesibilidad(); dibujar();
  });
  $('#btn-terminar').addEventListener('click', () => window.Sala.forzarFin());

  /* ---------- P6 Invitación privada ---------- */
  function mostrarInvitacion({ tema, pregunta, contexto = [] }) {
    const codigo = (salaElegida || D.salas[0]).codigo;
    // El usuario pidió no ser invitado en este tema durante su preparación: se respeta sin avisar a nadie.
    if (!window.Preparacion.quiereInvitacion(codigo, tema.id)) { window.Sala.saltarInvitacion(); return; }
    ventanaTu = true;
    $('#inv-tema').textContent = tema.titulo;
    const lista = $('#inv-contexto');
    lista.replaceChildren(...contexto.map(({ nombre, texto }) => {
      const elemento = document.createElement('li');
      const autor = document.createElement('strong');
      autor.textContent = nombre;
      elemento.append(autor, `: «${texto}»`);
      return elemento;
    }));
    lista.hidden = !contexto.length;
    $('#inv-pregunta').textContent = pregunta;
    const nota = window.Preparacion.notaDe(codigo, tema.id);
    $('#inv-nota').hidden = !nota;
    $('#inv-nota-texto').textContent = nota ? '«' + nota + '»' : '';
    $('#btn-usar-nota').dataset.tema = tema.id;
    const pref = window.Perfil.obtener().canalPreferido;
    const cont = $('#acciones-inv');
    const bH = cont.querySelector('[data-resp=hablar]'), bE = cont.querySelector('[data-resp=escribir]');
    if (pref === 'escribir') { cont.prepend(bE); bE.className = 'btn primario'; bH.className = 'btn secundario'; }
    else { cont.prepend(bH); bH.className = 'btn primario'; bE.className = 'btn secundario'; }
    abrirModal('#m-invitacion', '#inv-titulo');
    $('#m-invitacion .hoja').scrollTop = 0;
    const intervenciones = contexto.map(({ nombre, texto }) => `${nombre} dijo: ${texto}`).join(' ');
    window.Voz.vibrar();
    const leyendo = window.Voz.hablar(`Tu ventana de órbita. ${tema.titulo}. ${intervenciones} ${pregunta}`);
    // Cuenta regresiva: se cierra sola sin avisar a nadie (A3)
    const palabrasContexto = intervenciones.trim().split(/\s+/).filter(Boolean).length;
    const lecturaSeg = Math.ceil(palabrasContexto / (leyendo ? 2 : 4));
    const total = (window.Perfil.obtener().toleranciaSilencioSeg + lecturaSeg) * 1000, ini = Date.now();
    clearInterval(cuentaTimer);
    cuentaTimer = setInterval(() => {
      const r = 1 - (Date.now() - ini) / total;
      $('#inv-cuenta').style.width = Math.max(0, r * 100) + '%';
      if (r <= 0) { clearInterval(cuentaTimer); if (ventanaTu) responder('sinRespuesta'); }
    }, 100);
  }
  $('#acciones-inv').addEventListener('click', e => { const b = e.target.closest('[data-resp]'); if (b) responder(b.dataset.resp); });
  $('#btn-usar-nota').addEventListener('click', () => {
    clearInterval(cuentaTimer); cerrarModal('#m-invitacion');
    window.Perfil.registrarRespuesta('escribir');
    compartirNota($('#btn-usar-nota').dataset.tema);
  });
  function compartirNota(temaId) {
    const codigo = (salaElegida || D.salas[0]).codigo;
    const nota = window.Preparacion.notaDe(codigo, temaId);
    if (!nota) return;
    window.Preparacion.marcarUsada(codigo, temaId);
    window.Voz.hablar(nota);
    aportar(nota, 'preparado');
  }

  /* ---------- Mis notas durante la reunión ---------- */
  $('#btn-notas').addEventListener('click', () => {
    const codigo = (salaElegida || D.salas[0]).codigo;
    const notas = D.agenda.map(a => ({ a, t: window.Preparacion.obtener(codigo)[a.id] })).filter(x => x.t && x.t.nota);
    $('#lista-notas').innerHTML = notas.length ? notas.map(({ a, t }) => `
      <li class="${temaActual && temaActual.id === a.id ? 'actual' : ''}"><span class="etiqueta">${escapar(a.titulo)}${t.usada ? ' · ya compartida' : ''}</span>
        <p>${escapar(t.nota)}</p>
        ${temaActual && temaActual.id === a.id && !t.usada ? `<button class="btn secundario" data-compartir="${a.id}">Compartir ahora</button>` : ''}</li>`).join('')
      : '<li>No preparaste notas para esta reunión. Puedes hacerlo desde la sala de espera la próxima vez.</li>';
    abrirModal('#m-notas');
  });
  $('#lista-notas').addEventListener('click', e => {
    const b = e.target.closest('[data-compartir]'); if (!b) return;
    cerrarModal('#m-notas'); compartirNota(b.dataset.compartir);
  });
  $('#btn-cerrar-notas').addEventListener('click', () => cerrarModal('#m-notas'));
  function responder(tipo) {
    clearInterval(cuentaTimer);
    cerrarModal('#m-invitacion');
    if (tipo === 'hablar' || tipo === 'escribir') {
      // Turno reservado de 60 s: si no llega el aporte, la ventana se cierra sola.
      clearTimeout(turnoTimer);
      turnoTimer = setTimeout(() => {
        if (ventanaTu) { ventanaTu = false; window.Sala.terminarAporteEnVentana(); }
      }, 60000);
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
    const datos = window.Sala.resumenDatos();
    datosResumen = datos;
    const { texto, proveedor, respaldo, aviso } = await window.LLM.generarResultado('resumen', datos);
    if (datosResumen !== datos || pantallaActual !== 'p-resumen') return;
    const { decisiones, abiertos, completo } = window.Markdown.seccionesResumen(texto);
    $('#res-titulo-decisiones').textContent = completo === undefined ? '✅ Decisiones' : 'Resumen generado';
    $('#res-decisiones').innerHTML = completo ?? (decisiones || '<p>Aún no hay decisiones registradas.</p>');
    $('#res-tarjeta-abiertos').hidden = completo !== undefined;
    $('#res-abiertos').innerHTML = abiertos || '<p>Ninguno</p>';
    const eq = Math.round(datosResumen.equilibrio * 100);
    setTimeout(() => ($('#res-medidor').style.width = eq + '%'), 50);
    $('#res-equilibrio').textContent = `Índice de equilibrio: ${eq} / 100 (100 = todos participaron igual).`;
    $('#res-barras').innerHTML = datosResumen.participantes.map(p =>
      `<div class="barra-p"><span>${escapar(p.nombre)}</span><div class="pista"><div style="width:${Math.round(p.share * 100)}%;background:${p.color}"></div></div></div>`).join('');
    $('#res-proveedor').textContent = respaldo ? aviso || 'Falló el proveedor. Se muestra un resumen simulado.' : 'Resumen generado con ' + window.LLM.proveedores[proveedor].nombre;
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
  function pintarRevision(revision) {
    const canales = { voz: 'Voz transcrita', texto: 'Aporte escrito', preparado: 'Idea preparada' };
    const lista = textos => textos.map(texto => `<li>${escapar(texto)}</li>`).join('');
    $('#inf-revision').hidden = !revision.length;
    $('#inf-aportes').innerHTML = revision.map(({ titulo, aportes, acuerdos, pendientes }) => `
      <section class="revision-tema">
        <h4>${escapar(titulo)}</h4>
        <ul class="revision-aportes">
          ${aportes.map(({ canal, texto, original }) => `
            <li><span class="etiqueta">${canales[canal]}</span><p>${escapar(original || texto)}</p>
              ${original && original !== texto ? `<p class="sutil">Resumen publicado · ${escapar(texto)}</p>` : ''}
            </li>`).join('')}
        </ul>
        ${acuerdos.length ? `<h5>Acuerdos del tema simulado</h5><ul>${lista(acuerdos)}</ul>` : ''}
        ${pendientes.length ? `<h5>Pendientes del tema simulado</h5><ul>${lista(pendientes)}</ul>` : ''}
      </section>`).join('');
  }

  function pintarInforme() {
    const p = window.Perfil.obtener();
    const prep = window.Preparacion.estadisticas((salaElegida || D.salas[0]).codigo);
    if (datosResumen) {
      const { aportesTu, notasCompartidas } = datosResumen;
      const aportes = aportesTu === 1 ? '1 aporte' : `${aportesTu} aportes`;
      const notas = notasCompartidas === 1 ? '1 idea preparada' : `${notasCompartidas} ideas preparadas`;
      const registro = aportesTu ? `Registraste ${aportes} en tu última reunión.` : 'No se registraron aportes tuyos en la última reunión.';
      $('#inf-reflexion').textContent = notasCompartidas ? `${registro} Compartiste ${notas}.` : registro;
    } else {
      $('#inf-reflexion').textContent = 'Tu resumen personal estará disponible al terminar una reunión.';
    }
    pintarRevision(datosResumen?.revision || []);
    const hist = [...D.historial];
    if (datosResumen) hist.push({ fecha: 'Última', equilibrio: datosResumen.equilibrio });
    const w = 320, h = 140, pad = 24, n = hist.length;
    const x = i => pad + i * ((w - 2 * pad) / Math.max(1, n - 1)), y = v => h - pad - v * (h - 2 * pad);
    const pts = hist.map((d, i) => `${x(i)},${y(d.equilibrio)}`).join(' ');
    $('#inf-grafico').innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Equilibrio de reuniones de ejemplo${datosResumen ? ' y de la última reunión' : ''}">
      <line x1="${pad}" x2="${w - pad}" y1="${y(0.7)}" y2="${y(0.7)}" stroke="#4FC7C2" stroke-dasharray="4 4" opacity=".6"/>
      <polyline points="${pts}" fill="none" stroke="#8C7CF0" stroke-width="3"/>
      ${hist.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.equilibrio)}" r="5" fill="#F5B94A"/><text x="${x(i)}" y="${h - 6}" font-size="9" fill="#B4ADD6" text-anchor="middle">${d.fecha.slice(5) || d.fecha}</text>`).join('')}
    </svg>`;
    const r = p.respuestas;
    $('#inf-aprendizaje').innerHTML = [
      `Canal preferido: <b>${escapar(p.canalPreferido)}</b> (hablar ${r.hablar} · escribir ${r.escribir} · paso ${r.paso})`,
      `Tiempo de invitación ajustado a <b>${p.toleranciaSilencioSeg} s</b>`,
      p.ritmoPalabrasMin ? `Tu ritmo de habla: <b>${p.ritmoPalabrasMin} palabras/min</b>` : 'Ritmo de habla: se calcula cuando usas el micrófono',
      `Emociones registradas: <b>${p.emociones.length}</b> (${p.emociones.slice(-2).map(e => escapar(e.valor)).join(', ') || '—'})`,
      `Preparación guardada en esta sala: <b>${prep.preparadas}</b> idea(s) preparada(s), ${prep.ensayos} ensayo(s)`
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
    $('#resultado-llm').textContent = '';
  });
  $('#in-apikey').addEventListener('change', e => { const p = window.Perfil.obtener(); p.llm.apiKey = e.target.value.trim(); window.Perfil.actualizar({ llm: p.llm }); });
  $('#btn-probar-llm').addEventListener('click', async () => {
    const p = window.Perfil.obtener();
    const solicitado = p.llm.proveedor;
    const boton = $('#btn-probar-llm');
    boton.disabled = true;
    $('#resultado-llm').textContent = 'Probando…';
    const { texto, proveedor, respaldo, aviso } = await window.LLM.generarResultado('invitacion', { tema: 'Presupuesto del piloto', nombre: 'Diego', contexto: 'Ana: propongo cuatro mil soles.', preguntaBase: '¿Ves algún riesgo en el presupuesto?' });
    boton.disabled = false;
    if (p !== window.Perfil.obtener() || solicitado !== p.llm.proveedor) return;
    const origen = respaldo ? aviso || 'Falló el proveedor. Respuesta simulada' : window.LLM.proveedores[proveedor].nombre;
    $('#resultado-llm').textContent = `[${origen}] ${texto}`;
  });
  $('#btn-editar-perfil').addEventListener('click', () => ir('p-perfil'));
  $('#btn-borrar').addEventListener('click', () => { window.Perfil.borrarTodo(); reiniciar(); toast('Datos borrados.'); });

  /* ---------- Comunes ---------- */
  $('#btn-atras').addEventListener('click', atras);
  $('#btn-ajustes').addEventListener('click', () => ir('p-ajustes'));
  const modales = [];
  const enfocables = el => [...el.querySelectorAll('button, input, textarea')]
    .filter(control => !control.disabled && control.getClientRects().length);
  function abrirModal(selector, foco) {
    if (modales.some(m => m.selector === selector)) return;
    const previo = modales.at(-1);
    const anterior = document.activeElement;
    if (previo) $(previo.selector).hidden = true;
    modales.push({ selector, anterior });
    const el = $(selector);
    el.hidden = false;
    $('#main').inert = $('#barra').inert = true;
    (foco ? $(foco) : enfocables(el)[0])?.focus();
  }
  function cerrarModal(selector) {
    const indice = modales.findIndex(m => m.selector === selector);
    if (indice < 0) return;
    const [{ anterior }] = modales.splice(indice, 1);
    $(selector).hidden = true;
    const siguiente = modales[indice];
    if (siguiente) {
      siguiente.anterior = anterior;
      return;
    }
    const previo = modales.at(-1);
    if (previo) $(previo.selector).hidden = false;
    $('#main').inert = $('#barra').inert = !!previo;
    if (anterior.getClientRects().length && !anterior.disabled) anterior.focus();
    else if (previo) enfocables($(previo.selector))[0]?.focus();
    else $('#main').focus();
  }
  document.addEventListener('keydown', e => {
    const modal = modales.at(-1);
    if (!modal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (modal.selector === '#m-invitacion') responder('paso');
      else cerrarModal(modal.selector);
    } else if (e.key === 'Tab') {
      const controles = enfocables($(modal.selector));
      const primero = controles[0], ultimo = controles.at(-1);
      const actual = document.activeElement;
      if (!controles.includes(actual) || actual === (e.shiftKey ? primero : ultimo)) {
        e.preventDefault();
        (e.shiftKey ? ultimo : primero)?.focus();
      }
    }
  });
  function escapar(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  const alEntrar = {
    'p-bienvenida': pintarBienvenida,
    'p-asistente': () => window.Asistente.abrir(),
    'p-perfil': pintarPerfil, 'p-salas': pintarSalas, 'p-crear': pintarCrear,
    'p-reunion': iniciarReunion, 'p-resumen': pintarResumen, 'p-informe': pintarInforme, 'p-ajustes': pintarAjustes,
    'p-antesala': () => window.PrepUI.pintarAntesala(), 'p-preparar': () => window.PrepUI.pintarPreparar()
  };

  /* Exponer para la simulación guiada */
  window.OrbitaApp.internos = { responder, aportar, abrirEscribir, cerrarModal, mostrarInvitacion, compartirNota };

  aplicarAccesibilidad();
  pintarBienvenida();

  /* PWA: service worker (solo en http/https, no con file://) */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
