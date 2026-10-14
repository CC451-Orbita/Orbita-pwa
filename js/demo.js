/* ============================================================
   Simulación guiada del flujo completo (para la demo y el video).
   Recorre las 10 pantallas con datos simulados y muestra un subtítulo explicativo.
   Se inicia con el botón "Ver simulación guiada" o abriendo index.html?demo=1
   ============================================================ */
(function () {
  const $ = s => document.querySelector(s);
  let activo = false;
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  async function esperar(cond, max = 60000) { const ini = Date.now(); while (!cond()) { if (!activo || Date.now() - ini > max) throw new Error('fin'); await dormir(150); } }
  function decir(t) { $('#guia-texto').textContent = t; }
  async function escribir(input, texto) { input.value = ''; for (const c of texto) { input.value += c; await dormir(28); } input.dispatchEvent(new Event('input')); }
  const clic = sel => $(sel).click();

  async function recorrido() {
    const { ir } = window.OrbitaApp;
    const { aportar } = window.OrbitaApp.internos;
    window.Perfil.borrarTodo();
    window.Perfil.actualizarAccesibilidad({ vozTTS: false, listaAccesible: false });

    ir('p-bienvenida');
    decir('1/10 · Bienvenida: la persona da su consentimiento. Órbita no guarda audio.');
    await dormir(2500); $('#chk-consentimiento').checked = true; $('#chk-consentimiento').dispatchEvent(new Event('change'));
    await dormir(1200); clic('#btn-empezar');

    decir('2/10 · Perfil: elige nombre, color de su planeta, emoción inicial y accesibilidad.');
    await dormir(1200); await escribir($('#in-nombre'), 'Anngie');
    await dormir(500); $('#colores .color:nth-child(2)').click();
    await dormir(700); $('#emo-inicio [data-emo=normal]').click();
    await dormir(1500); clic('#btn-guardar-perfil');

    decir('3/10 · Salas: puede unirse con un código o crear una sala nueva.');
    await dormir(2800); clic('#btn-ir-crear');
    decir('4/10 · Crear sala: modo, estilo de moderación y agenda. El umbral se calibra solo.');
    await dormir(3200); clic('#btn-iniciar-reunion');

    decir('5/10 · Reunión: cada planeta es una persona. Cerca del sol = habla mucho; lejos = aún no aporta.');
    window.Sala.velocidad(2);
    await esperar(() => !$('#m-invitacion').hidden);
    decir('6/10 · Ventana de órbita: el tema va a cerrarse. Solo Anngie ve esta invitación privada.');
    await dormir(3000); $('#acciones-inv [data-resp=escribir]').click();
    decir('7/10 · Aporte escrito: cuenta igual que hablar. El LLM lo resume para el grupo.');
    await dormir(800); await escribir($('#in-aporte'), 'Propongo probar los subtítulos con dos usuarios sordos antes del viernes.');
    await dormir(900); clic('#btn-enviar-aporte');

    decir('Ana domina la conversación: recibe una sugerencia privada para ceder la palabra.');
    await esperar(() => !$('#m-invitacion').hidden);
    decir('Segunda ventana: Anngie elige hablar. (En la demo, su voz se simula con texto).');
    await dormir(2500);
    $('#acciones-inv [data-resp=hablar]').click(); await dormir(600);
    aportar('Sugiero reservar parte del presupuesto para pruebas de accesibilidad.', 'voz');

    await esperar(() => !$('#m-invitacion').hidden);
    decir('Tercera ventana: Anngie prefiere no hablar. "Paso esta vez" se respeta sin insistir.');
    await dormir(3000); $('#acciones-inv [data-resp=paso]').click();

    await esperar(() => $('#p-resumen').classList.contains('activa'));
    decir('8/10 · Resumen: decisiones, temas abiertos e índice de equilibrio (nivel reflexivo).');
    await dormir(3500); $('#emo-fin [data-emo=escuchado]').click();
    await dormir(1500); clic('#btn-ver-reflexion');
    decir('9/10 · Tu evolución: lo que Órbita aprendió del perfil (canal preferido, ritmo, emociones).');
    await dormir(5000); ir('p-ajustes');
    decir('10/10 · Ajustes: capa de abstracción del LLM (Simulado, Gemini u Ollama) y borrado de datos.');
    await dormir(4500);
    decir('Fin de la simulación ✦ Que todas las voces encuentren su órbita.');
    await dormir(3000);
  }

  async function iniciar() {
    if (activo) return;
    activo = true; $('#guia').hidden = false;
    try { await recorrido(); } catch (e) { /* salida anticipada */ }
    detener();
  }
  function detener() { activo = false; $('#guia').hidden = true; }

  $('#btn-demo-rapida').addEventListener('click', iniciar);
  $('#btn-salir-guia').addEventListener('click', detener);
  if (new URLSearchParams(location.search).get('demo') === '1') setTimeout(iniciar, 600);
  window.OrbitaDemo = { iniciar, detener, activo: () => activo };
})();
