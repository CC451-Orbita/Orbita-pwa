/* ============================================================
   Preparación de la participación (RF-30 a RF-36)
   Antes de entrar (o antes de que empiece la reunión) el usuario puede:
   - ver la agenda y una pregunta guía por tema (generada por el LLM),
   - escribir o dictar su idea para cada tema,
   - acortar la nota con una regla local,
   - escucharla (TTS) o ensayarla en voz alta (mide duración y ritmo),
   - decidir en qué temas quiere o no quiere ser invitado.
   Durante la reunión, la ventana de órbita le ofrece "Decir mi idea preparada".
   Todo se guarda en el perfil persistente (solo en su dispositivo).
   ============================================================ */
(function () {
  /* ---------------- Modelo ---------------- */
  function todas() {
    const p = window.Perfil.obtener();
    if (!p.preparaciones) p.preparaciones = {};
    return p.preparaciones;
  }
  function deSala(codigo) {
    const t = todas();
    if (!t[codigo]) t[codigo] = {};
    return t[codigo];
  }
  function deTema(codigo, temaId) {
    const s = deSala(codigo);
    if (!s[temaId]) s[temaId] = { nota: '', invitar: true, ensayos: 0, duracionSeg: null, usada: false, actualizado: null };
    return s[temaId];
  }
  function guardar() { window.Perfil.actualizar({ preparaciones: todas() }); }

  const Preparacion = {
    obtener: deSala,
    tema: deTema,
    guardarNota(codigo, temaId, nota) {
      const t = deTema(codigo, temaId);
      t.nota = String(nota || '').trim().slice(0, 400);
      t.actualizado = new Date().toISOString();
      guardar();
    },
    setInvitar(codigo, temaId, valor) { deTema(codigo, temaId).invitar = !!valor; guardar(); },
    registrarEnsayo(codigo, temaId, segundos) {
      const t = deTema(codigo, temaId);
      t.ensayos++; t.duracionSeg = Math.round(segundos);
      guardar();
    },
    marcarUsada(codigo, temaId) { deTema(codigo, temaId).usada = true; guardar(); },
    notaDe(codigo, temaId) { const t = deSala(codigo)[temaId]; return t && t.nota ? t.nota : ''; },
    quiereInvitacion(codigo, temaId) { const t = deSala(codigo)[temaId]; return t ? t.invitar !== false : true; },
    progreso(codigo, agenda) {
      const s = deSala(codigo);
      const preparados = agenda.filter(a => s[a.id] && s[a.id].nota).length;
      return { preparados, total: agenda.length };
    },
    /* Duración estimada al decir la nota: usa el ritmo real del usuario si existe (personalización). */
    duracionEstimada(nota) {
      const palabras = String(nota || '').trim().split(/\s+/).filter(Boolean).length;
      const ppm = window.Perfil.obtener().ritmoPalabrasMin || 130;
      return Math.max(1, Math.round(palabras / ppm * 60));
    },
    /* Resumen para el informe y el perfil */
    estadisticas(codigo) {
      const s = deSala(codigo);
      const temas = Object.values(s);
      return { preparadas: temas.filter(t => t.nota).length, usadas: temas.filter(t => t.usada).length, ensayos: temas.reduce((a, t) => a + t.ensayos, 0) };
    },
    borrarSala(codigo) { delete todas()[codigo]; guardar(); }
  };
  window.Preparacion = Preparacion;

  /* ---------------- Interfaz (P11 Preparar · P12 Antesala) ---------------- */
  if (typeof document === 'undefined' || !document.querySelector('#p-preparar')) return;
  const $ = s => document.querySelector(s);
  const D = window.ORBITA_DATA;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let cuentaAtras = null;

  function sala() { return window.OrbitaApp.salaActual() || D.salas[0]; }

  /* ---- P12 Antesala (sala de espera) ---- */
  function pintarAntesala() {
    const s = sala();
    $('#ante-nombre').textContent = s.nombre;
    $('#ante-codigo').textContent = s.codigo + ' · ' + (s.modo || 'videollamada');
    const { preparados, total } = Preparacion.progreso(s.codigo, D.agenda);
    $('#ante-progreso').textContent = preparados ? `${preparados} de ${total} temas preparados` : 'Aún no preparaste ningún tema';
    $('#ante-barra').style.width = Math.round(preparados / total * 100) + '%';
    $('#ante-agenda').innerHTML = D.agenda.map(a => {
      const t = Preparacion.obtener(s.codigo)[a.id];
      const icono = t && t.nota ? '✅' : '○';
      const extra = t && t.invitar === false ? ' <small class="sutil">(sin invitaciones)</small>' : '';
      return `<li><span aria-hidden="true">${icono}</span> ${esc(a.titulo)}${extra}</li>`;
    }).join('');
    // Cuenta regresiva simulada (salas sin actividad empiezan en 3 min; las activas ya empezaron)
    clearInterval(cuentaAtras);
    if (s.activa) { $('#ante-reloj').textContent = 'La reunión ya está en curso'; }
    else {
      let seg = 180;
      const pinta = () => { $('#ante-reloj').textContent = seg > 0 ? `Empieza en ${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}` : 'La reunión ya empezó'; };
      pinta(); cuentaAtras = setInterval(() => { seg--; pinta(); if (seg <= 0) clearInterval(cuentaAtras); }, 1000);
    }
    $('#ante-consejo').textContent = preparados === total
      ? '✨ Llegas con todo listo. Tu planeta brillará cuando compartas tus ideas.'
      : 'Preparar tus ideas antes ayuda a hablar con más calma.';
  }
  $('#emo-antesala').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    document.querySelectorAll('#emo-antesala .chip').forEach(c => c.setAttribute('aria-checked', c === b));
    window.Perfil.registrarEmocion('antesala', b.dataset.emo);
    if (b.dataset.emo === 'nervioso') {
      window.Perfil.actualizar({ canalPreferido: 'escribir' });
      $('#ante-consejo').textContent = '💜 Es normal. Prepara una idea por tema: en la reunión podrás compartirla con un toque.';
    }
  });
  $('#btn-ir-preparar').addEventListener('click', () => window.OrbitaApp.ir('p-preparar'));
  $('#btn-entrar-reunion').addEventListener('click', () => { clearInterval(cuentaAtras); window.OrbitaApp.ir('p-reunion'); });

  /* ---- P11 Preparar participación ---- */
  async function pintarPreparar() {
    const s = sala();
    $('#prep-sala').textContent = s.nombre;
    const cont = $('#prep-temas');
    cont.innerHTML = D.agenda.map((a, i) => {
      const t = Preparacion.tema(s.codigo, a.id);
      return `
      <article class="tarjeta tema-prep" data-tema="${a.id}" data-sala="${esc(s.codigo)}">
        <div class="tema-cab"><span class="etiqueta">Tema ${i + 1}</span><span class="estado-tema" aria-live="polite">${t.nota ? '✅ Preparado' : ''}</span></div>
        <h3>${esc(a.titulo)}</h3>
        <p class="pregunta-guia" data-guia>💡 <span>Pensando una pregunta guía…</span></p>
        <label class="campo">Mi idea para este tema
          <textarea rows="3" maxlength="400" data-nota placeholder="Escribe o dicta lo que quieres aportar…">${esc(t.nota)}</textarea>
        </label>
        <p class="sutil" data-duracion>${t.nota ? '⏱ Decirlo te tomará unos ' + Preparacion.duracionEstimada(t.nota) + ' s' : ''}</p>
        <div class="sugerencia" data-sugerencia hidden></div>
        <div class="acciones-prep">
          <button class="chip" data-accion="dictar" aria-label="Dictar mi idea">🎙 Dictar</button>
          <button class="chip" data-accion="pulir">✨ Hazlo corto</button>
          <button class="chip" data-accion="escuchar" aria-label="Escuchar mi idea en voz alta">🔊 Escuchar</button>
          <button class="chip" data-accion="ensayar">🎤 Ensayar</button>
        </div>
        <label class="switch"><input type="checkbox" data-invitar ${t.invitar !== false ? 'checked' : ''}><span>Quiero que me inviten a hablar en este tema</span></label>
      </article>`;
    }).join('');
    actualizarProgreso();
    // Preguntas guía generadas por el LLM, una por tema
    for (const a of D.agenda) {
      const el = cont.querySelector(`[data-tema="${a.id}"] [data-guia] span`);
      if (el) el.textContent = await window.LLM.generar('guiaPreparacion', { tema: a.titulo, preguntaBase: a.pregunta });
      if (!el?.isConnected) break;
    }
  }
  function actualizarProgreso() {
    const { preparados, total } = Preparacion.progreso(sala().codigo, D.agenda);
    $('#prep-progreso').textContent = `${preparados} de ${total} temas preparados`;
    $('#prep-barra').style.width = Math.round(preparados / total * 100) + '%';
    const brillo = 0.35 + 0.65 * (preparados / total);
    $('#prep-planeta').style.opacity = brillo;
    $('#prep-planeta').style.background = `radial-gradient(circle at 35% 30%, #fff8, ${window.Perfil.obtener().color} 45%)`;
    $('#prep-planeta').style.boxShadow = `0 0 ${10 + 30 * preparados / total}px ${window.Perfil.obtener().color}`;
  }

  $('#prep-temas').addEventListener('input', e => {
    const card = e.target.closest('[data-tema]'); if (!card || !e.target.matches('[data-nota]')) return;
    card.querySelector('[data-sugerencia]').hidden = true;
    guardarCard(card, e.target.value);
  });
  function guardarCard(card, texto) {
    Preparacion.guardarNota(card.dataset.sala, card.dataset.tema, texto);
    card.querySelector('[data-duracion]').textContent = texto.trim() ? '⏱ Decirlo te tomará unos ' + Preparacion.duracionEstimada(texto) + ' s' : '';
    card.querySelector('.estado-tema').textContent = texto.trim() ? '✅ Preparado' : '';
    actualizarProgreso();
  }
  $('#prep-temas').addEventListener('change', e => {
    if (!e.target.matches('[data-invitar]')) return;
    const card = e.target.closest('[data-tema]');
    Preparacion.setInvitar(card.dataset.sala, card.dataset.tema, e.target.checked);
    window.OrbitaApp.toast(e.target.checked ? 'Te invitaremos en este tema si no has hablado.' : 'Entendido: no te invitaremos en este tema. Igual puedes hablar cuando quieras.');
  });
  $('#prep-temas').addEventListener('click', e => {
    const b = e.target.closest('[data-accion]'); if (!b) return;
    const card = b.closest('[data-tema]'), area = card.querySelector('[data-nota]');
    const accion = b.dataset.accion, { sala: codigo, tema: temaId } = card.dataset;
    if (accion === 'dictar' || accion === 'ensayar') {
      if (window.OrbitaDemo && window.OrbitaDemo.activo()) return;
      if (!window.Voz.soportaReconocimiento) { window.OrbitaApp.toast('Tu navegador no tiene reconocimiento de voz. Escribe tu idea.'); area.focus(); return; }
      window.Voz.escuchar({
        alEstado: st => {
          b.classList.toggle('escuchando', st === 'escuchando' || st.startsWith('parcial'));
          if (st.startsWith('error')) window.OrbitaApp.toast(window.Voz.mensajeError(st));
        },
        alTexto: (texto, seg) => {
          window.Perfil.registrarRitmo(texto, seg);
          if (accion === 'dictar') {
            area.value = (area.value ? area.value + ' ' + texto : texto).slice(0, area.maxLength);
            area.dispatchEvent(new Event('input', { bubbles: true }));
          }
          else {
            Preparacion.registrarEnsayo(codigo, temaId, seg);
            const ppm = window.Perfil.obtener().ritmoPalabrasMin;
            const msg = seg <= 30 ? `🎉 ${Math.round(seg)} s a ${ppm} palabras/min: claro y breve.` : `⏱ ${Math.round(seg)} s. Prueba "Hazlo corto" para llegar a menos de 30 s.`;
            card.querySelector('[data-duracion]').textContent = msg;
          }
        }
      });
    } else if (accion === 'pulir') {
      if (!area.value.trim()) { window.OrbitaApp.toast('Escribe primero tu idea.'); area.focus(); return; }
      const corto = window.LLM.pulirNota(area.value);
      if (!corto) { window.OrbitaApp.toast('Agrega la idea que quieres conservar.'); area.focus(); return; }
      const sug = card.querySelector('[data-sugerencia]');
      sug.innerHTML = `<p><b>Sugerencia local</b> · ${esc(corto)}</p><div class="fila"><button class="btn texto" data-accion="descartar">Mantener la mía</button><button class="btn secundario" data-accion="usar">Usar esta</button></div>`;
      sug.dataset.texto = corto; sug.hidden = false;
    } else if (accion === 'usar') {
      const sug = card.querySelector('[data-sugerencia]');
      area.value = sug.dataset.texto; sug.hidden = true; guardarCard(card, area.value);
    } else if (accion === 'descartar') {
      card.querySelector('[data-sugerencia]').hidden = true;
    } else if (accion === 'escuchar') {
      if (!area.value.trim()) { window.OrbitaApp.toast('Aún no hay nada que escuchar.'); return; }
      if (!window.Voz.hablar(area.value, { forzar: true, soloLocal: true })) {
        window.OrbitaApp.toast('Activa una voz local en español para escuchar la nota.');
      }
    }
  });
  $('#btn-prep-listo').addEventListener('click', () => {
    const { preparados } = Preparacion.progreso(sala().codigo, D.agenda);
    window.OrbitaApp.toast(preparados ? `✨ ${preparados} idea(s) guardada(s). Las verás en la reunión.` : 'Puedes volver a preparar cuando quieras.');
    window.OrbitaApp.ir('p-antesala');
  });

  window.PrepUI = { pintarAntesala, pintarPreparar, detener: () => clearInterval(cuentaAtras) };
})();
