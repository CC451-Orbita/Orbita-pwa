/* ============================================================
   Simulación guiada del flujo completo (para la demo y el video).
   Recorre las 12 pantallas con datos simulados y muestra un subtítulo explicativo.
   Se inicia con el botón "Ver simulación guiada" o abriendo index.html?demo=1
   ============================================================ */
(function () {
  const $ = s => document.querySelector(s);
  let ejecucion = null;
  function decir(t) { $('#guia-texto').textContent = t; }
  const clic = sel => $(sel).click();

  async function recorrido(actual) {
    async function dormir(ms) {
      await new Promise(r => setTimeout(r, ms));
      if (ejecucion !== actual) throw new Error('Simulación detenida');
    }
    async function esperar(cond, max = 60000) {
      const limite = Date.now() + max;
      while (!cond()) {
        if (Date.now() > limite) throw new Error('Tiempo de espera agotado');
        await dormir(150);
      }
    }
    async function escribir(input, texto) {
      input.value = '';
      for (const c of texto) { input.value += c; await dormir(28); }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const { ir } = window.OrbitaApp;
    const { aportar } = window.OrbitaApp.internos;

    decir('1/12 · Bienvenida: la persona da su consentimiento. Órbita no guarda audio.');
    await dormir(2500); $('#chk-consentimiento').checked = true; $('#chk-consentimiento').dispatchEvent(new Event('change'));
    await dormir(1200); clic('#btn-empezar');

    decir('2/12 · Perfil: elige nombre, color de su planeta, emoción inicial y accesibilidad.');
    await dormir(1200); await escribir($('#in-nombre'), 'Anngie');
    await dormir(500); $('#colores .color:nth-child(2)').click();
    await dormir(700); $('#emo-inicio [data-emo=normal]').click();
    await dormir(1500); clic('#btn-guardar-perfil');

    decir('3/12 · Salas: puede unirse con un código o crear una sala nueva.');
    await dormir(2500); clic('#btn-ir-crear');
    decir('4/12 · Crear sala: modo, estilo de moderación y agenda. El umbral se calibra solo.');
    await dormir(2800); clic('#btn-iniciar-reunion');

    decir('5/12 · NUEVO · Sala de espera: agenda, cuenta regresiva y cómo llega cada persona.');
    await dormir(2500); $('#emo-antesala [data-emo=nervioso]').click();
    decir('Anngie llega nerviosa: Órbita le sugiere preparar sus ideas antes de entrar.');
    await dormir(3000); clic('#btn-ir-preparar');

    decir('6/12 · NUEVO · Preparar mi participación: una pregunta guía por tema y su idea, solo para ella.');
    await esperar(() => $('#prep-temas [data-tema=T1] [data-nota]'));
    await dormir(1500);
    const t1 = $('#prep-temas [data-tema=T1] [data-nota]');
    await escribir(t1, 'Propongo probar los subtítulos con dos usuarios sordos antes del viernes.');
    await dormir(1200);
    decir('Para el tema 2 escribe una idea larga y pide al asistente "Hazlo corto".');
    const t2 = $('#prep-temas [data-tema=T2] [data-nota]');
    t2.scrollIntoView({ block: 'center' });
    await escribir(t2, 'Eh, bueno, o sea, yo creo que deberíamos reservar una parte del presupuesto para hacer pruebas de accesibilidad con usuarios reales porque si no, tipo, después nos van a salir errores que no vimos y eso cuesta más arreglarlo al final del proyecto.');
    await dormir(800); $('#prep-temas [data-tema=T2] [data-accion=pulir]').click();
    await esperar(() => !$('#prep-temas [data-tema=T2] [data-sugerencia]').hidden);
    await dormir(2500); $('#prep-temas [data-tema=T2] [data-accion=usar]').click();
    decir('En el tema 3 prefiere no ser invitada. Órbita lo respetará.');
    const t3 = $('#prep-temas [data-tema=T3] [data-invitar]');
    t3.scrollIntoView({ block: 'center' });
    await dormir(1800); t3.click();
    await dormir(2200); clic('#btn-prep-listo');

    decir('De vuelta en la sala de espera: 2 de 3 temas preparados. ¡A la reunión!');
    await dormir(3000); clic('#btn-entrar-reunion');

    decir('7/12 · Reunión: cada planeta es una persona. Cerca del sol = habla mucho; lejos = aún no aporta.');
    window.Sala.velocidad(2);
    await esperar(() => !$('#m-invitacion').hidden);
    decir('8/12 · Ventana de órbita privada: Anngie ve su idea preparada y la comparte con un toque.');
    await dormir(3500); clic('#btn-usar-nota');

    decir('Su aporte aparece con 📝. Ana, que domina, recibe en privado una sugerencia para ceder la palabra.');
    await esperar(() => !$('#m-invitacion').hidden);
    decir('Segunda ventana: Anngie elige hablar. (En la demo, su voz se simula con texto).');
    await dormir(2500);
    $('#acciones-inv [data-resp=hablar]').click(); await dormir(600);
    aportar('Sugiero reservar parte del presupuesto para pruebas de accesibilidad con usuarios reales.', 'voz');

    await esperar(() => $('#tema-actual').textContent.includes('lanzamiento'));
    decir('Tema 3: Anngie pidió no ser invitada aquí. Órbita no abre su ventana y no avisa a nadie.');

    await esperar(() => $('#p-resumen').classList.contains('activa'));
    decir('9/12 · Resumen: decisiones, temas abiertos e índice de equilibrio (nivel reflexivo).');
    await dormir(3500); $('#emo-fin [data-emo=escuchado]').click();
    await dormir(1500); clic('#btn-ver-reflexion');
    decir('10/12 · Tu evolución: lo aprendido del perfil y cuántas ideas preparó y compartió.');
    await dormir(5000); ir('p-ajustes');
    decir('11/12 · Ajustes: capa de abstracción del LLM (Simulado, Gemini u Ollama) y borrado de datos.');
    await dormir(4000);
    decir('12/12 · Fin de la simulación ✦ Que todas las voces encuentren su órbita.');
    await dormir(3000);
  }

  async function iniciar() {
    if (ejecucion) return;
    const actual = {};
    ejecucion = actual;
    window.Perfil.usarTemporal(true);
    window.OrbitaApp.reiniciar();
    $('#guia').hidden = false;
    try {
      await recorrido(actual);
    } catch (e) {
      if (ejecucion === actual) {
        detener();
        window.OrbitaApp.toast('La simulación se interrumpió. Puedes iniciarla de nuevo.');
      }
    } finally {
      if (ejecucion === actual) detener();
    }
  }
  function detener() {
    if (!ejecucion) return;
    ejecucion = null;
    $('#guia').hidden = true;
    window.Perfil.usarTemporal(false);
    window.OrbitaApp.reiniciar();
  }

  $('#btn-demo-rapida').addEventListener('click', iniciar);
  $('#btn-salir-guia').addEventListener('click', detener);
  if (new URLSearchParams(location.search).get('demo') === '1') setTimeout(iniciar, 600);
  window.OrbitaDemo = { iniciar, detener, activo: () => !!ejecucion };
})();
