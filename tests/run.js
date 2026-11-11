/* ============================================================
   Pruebas automáticas de Órbita (sin dependencias)
   Uso:  node tests/run.js
   Carga los módulos del navegador en un entorno simulado (vm) y verifica
   la lógica de: capa LLM, perfil persistente, preparación, índice de equilibrio y datos simulados.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
let ok = 0, fallos = 0;

function nuevoEntorno(almacen = {}) {
  const localStorage = {
    getItem: k => (k in almacen ? almacen[k] : null),
    setItem: (k, v) => { almacen[k] = String(v); },
    removeItem: k => { delete almacen[k]; }
  };
  const ctx = { console, setTimeout, clearTimeout, localStorage, JSON, Math, Date, Promise };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['data/simulated.js', 'js/profile.js', 'js/llm.js', 'js/room.js', 'js/prep.js']) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  }
  return { w: ctx, almacen };
}

async function prueba(nombre, fn) {
  try { await fn(); ok++; console.log('  ✔ ' + nombre); }
  catch (e) { fallos++; console.log('  ✘ ' + nombre + '\n      → ' + e.message); }
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); }
function verdadero(c, msg) { if (!c) throw new Error(msg || 'condición falsa'); }

(async () => {
  console.log('\nCapa LLM (llm.js) – RF-20, RNF-08, RNF-09');
  await prueba('El validador de tono bloquea términos punitivos', () => {
    const { w } = nuevoEntorno();
    verdadero(!w.LLM.esSeguro('Por fin hablas, tímido'), 'debió bloquear');
    verdadero(w.LLM.esSeguro('¿Ves algún riesgo en el presupuesto?'), 'debió permitir');
  });
  await prueba('El proveedor simulado devuelve la pregunta concreta del tema', async () => {
    const { w } = nuevoEntorno();
    const t = await w.LLM.generar('invitacion', { tema: 'Presupuesto', preguntaBase: '¿Ves algún riesgo?' });
    igual(t, '¿Ves algún riesgo?');
  });
  await prueba('Fallback: Gemini sin API key → proveedor simulado', async () => {
    const { w } = nuevoEntorno();
    w.Perfil.actualizar({ llm: { proveedor: 'gemini', apiKey: '' } });
    const r = await w.LLM.generarResultado('invitacion', { tema: 'X', preguntaBase: 'Pregunta base' });
    igual(r.texto, 'Pregunta base'); igual(r.proveedor, 'simulado'); igual(r.respaldo, true);
    verdadero(r.aviso.includes('Falta la clave de Gemini') && r.aviso.includes('Ajustes'));
  });
  await prueba('"Hazlo corto" conserva la nota en el dispositivo con Gemini activo', async () => {
    const { w } = nuevoEntorno();
    w.Perfil.actualizar({ llm: { proveedor: 'gemini', apiKey: 'clave-de-prueba' } });
    let peticiones = 0;
    w.fetch = () => { peticiones++; throw new Error('Petición inesperada'); };
    w.AbortSignal = AbortSignal;
    const r = await w.LLM.generar('pulirNota', { texto: 'Eh, bueno, o sea, yo creo que deberíamos reservar una parte del presupuesto para hacer pruebas de accesibilidad con usuarios reales porque si no, tipo, después salen errores' });
    igual(peticiones, 0);
    verdadero(!/\b(eh|bueno|o sea|tipo)\b/i.test(r), 'quedaron muletillas: ' + r);
    verdadero(r.split(' ').length <= 20, 'muy largo: ' + r);
    verdadero(/[.…]$/.test(r), 'sin punto final: ' + r);
    igual(r[0], r[0].toUpperCase(), 'mayúscula inicial');
  });

  console.log('\nPerfil persistente (profile.js) – RF-14 a RF-17');
  await prueba('Aprende el canal preferido según las respuestas', () => {
    const { w } = nuevoEntorno();
    w.Perfil.registrarRespuesta('hablar'); w.Perfil.registrarRespuesta('escribir'); w.Perfil.registrarRespuesta('escribir');
    igual(w.Perfil.obtener().canalPreferido, 'escribir');
  });
  await prueba('Ajusta el tiempo de invitación (+5 s, máx. 40 s)', () => {
    const { w } = nuevoEntorno();
    for (let i = 0; i < 6; i++) w.Perfil.registrarRespuesta('sinRespuesta');
    igual(w.Perfil.obtener().toleranciaSilencioSeg, 40);
  });
  await prueba('Infiere incomodidad tras 3 evitaciones seguidas', () => {
    const { w } = nuevoEntorno();
    ['paso', 'paso', 'sinRespuesta'].forEach(t => w.Perfil.registrarRespuesta(t));
    igual(w.Perfil.inferirEmocion(), 'incomodidad');
    igual(w.Perfil.obtener().emociones.at(-1).origen, 'inferida');
  });
  await prueba('Calcula el ritmo de habla (palabras por minuto)', () => {
    const { w } = nuevoEntorno();
    w.Perfil.registrarRitmo('uno dos tres cuatro cinco seis siete ocho nueve diez', 5);
    igual(w.Perfil.obtener().ritmoPalabrasMin, 120);
  });
  await prueba('El perfil persiste entre sesiones (localStorage)', () => {
    const almacen = {};
    nuevoEntorno(almacen).w.Perfil.actualizar({ nombre: 'Anngie' });
    igual(nuevoEntorno(almacen).w.Perfil.obtener().nombre, 'Anngie');
  });
  await prueba('La simulación puede editar y borrar su perfil sin afectar las notas personales', () => {
    const { w, almacen } = nuevoEntorno();
    w.Perfil.actualizar({ nombre: 'Personal' });
    w.Preparacion.guardarNota('ORB-4821', 'T1', 'Nota personal');
    const previo = JSON.stringify(almacen);
    w.Perfil.usarTemporal(true);
    igual(w.Perfil.obtener().nombre, '');
    w.Perfil.actualizar({ nombre: 'Demo' });
    w.Preparacion.guardarNota('ORB-4821', 'T1', 'Nota de ejemplo');
    w.Perfil.borrarTodo();
    w.Perfil.usarTemporal(false);
    igual(JSON.stringify(almacen), previo);
    igual(w.Perfil.obtener().nombre, 'Personal');
    igual(w.Preparacion.notaDe('ORB-4821', 'T1'), 'Nota personal');
  });
  await prueba('Una clave de Gemini existente se conserva solo en memoria de la pestaña', () => {
    const clavePerfil = 'orbita.perfil.v1';
    const almacen = { [clavePerfil]: JSON.stringify({ nombre: 'Ana', llm: { proveedor: 'gemini', apiKey: 'clave-de-prueba' } }) };
    const { w } = nuevoEntorno(almacen);
    igual(w.Perfil.obtener().llm.apiKey, 'clave-de-prueba');
    igual(JSON.parse(almacen[clavePerfil]).llm.apiKey, undefined);
    igual(nuevoEntorno(almacen).w.Perfil.obtener().llm.apiKey, '');
    igual(nuevoEntorno(almacen).w.Perfil.obtener().llm.proveedor, 'gemini');
  });

  console.log('\nPreparación de la participación (prep.js) – RF-30 a RF-36');
  await prueba('Guarda la nota por tema y calcula el progreso', () => {
    const { w } = nuevoEntorno();
    w.Preparacion.guardarNota('ORB-1', 'T1', 'Mi idea');
    const p = w.Preparacion.progreso('ORB-1', w.ORBITA_DATA.agenda);
    igual(p.preparados, 1); igual(p.total, 3);
    igual(w.Preparacion.notaDe('ORB-1', 'T1'), 'Mi idea');
  });
  await prueba('Por defecto acepta invitaciones; se puede desactivar por tema', () => {
    const { w } = nuevoEntorno();
    igual(w.Preparacion.quiereInvitacion('ORB-1', 'T3'), true);
    w.Preparacion.setInvitar('ORB-1', 'T3', false);
    igual(w.Preparacion.quiereInvitacion('ORB-1', 'T3'), false);
  });
  await prueba('La duración estimada usa el ritmo real del usuario', () => {
    const { w } = nuevoEntorno();
    w.Perfil.actualizar({ ritmoPalabrasMin: 60 });
    igual(w.Preparacion.duracionEstimada('una dos tres cuatro cinco seis siete ocho nueve diez'), 10);
  });
  await prueba('Estadísticas: preparadas, compartidas y ensayos', () => {
    const { w } = nuevoEntorno();
    w.Preparacion.guardarNota('ORB-2', 'T1', 'A'); w.Preparacion.guardarNota('ORB-2', 'T2', 'B');
    w.Preparacion.marcarUsada('ORB-2', 'T1'); w.Preparacion.registrarEnsayo('ORB-2', 'T1', 9.6);
    const e = w.Preparacion.estadisticas('ORB-2');
    igual(e.preparadas, 2); igual(e.usadas, 1); igual(e.ensayos, 1);
    igual(w.Preparacion.tema('ORB-2', 'T1').duracionSeg, 10);
  });
  await prueba('Las notas se guardan en el perfil y sobreviven a recargar', () => {
    const almacen = {};
    nuevoEntorno(almacen).w.Preparacion.guardarNota('ORB-3', 'T2', 'Nota persistente');
    igual(nuevoEntorno(almacen).w.Preparacion.notaDe('ORB-3', 'T2'), 'Nota persistente');
  });
  await prueba('Limita la nota a 400 caracteres', () => {
    const { w } = nuevoEntorno();
    w.Preparacion.guardarNota('ORB-4', 'T1', 'x'.repeat(900));
    igual(w.Preparacion.notaDe('ORB-4', 'T1').length, 400);
  });

  console.log('\nMotor de reunión (room.js) – RF-09, RF-23');
  await prueba('Índice de equilibrio = 1 cuando todos hablan igual', () => {
    const { w } = nuevoEntorno();
    igual(w.Sala.indiceEquilibrio([0.25, 0.25, 0.25, 0.25]), 1);
  });
  await prueba('Índice de equilibrio = 0.25 cuando 1 de 4 habla todo', () => {
    const { w } = nuevoEntorno();
    igual(Math.round(w.Sala.indiceEquilibrio([1, 0, 0, 0]) * 100) / 100, 0.25);
  });

  console.log('\nDatos simulados (data/) – RNF-12');
  await prueba('Cada línea del guion pertenece a un tema de la agenda', () => {
    const { w } = nuevoEntorno();
    const ids = w.ORBITA_DATA.agenda.map(a => a.id);
    w.ORBITA_DATA.guion.forEach(l => verdadero(ids.includes(l.tema), 'tema desconocido ' + l.tema));
  });
  await prueba('Cada tema tiene una frase de cierre (dispara la ventana de órbita)', () => {
    const { w } = nuevoEntorno();
    w.ORBITA_DATA.agenda.forEach(a => verdadero(w.ORBITA_DATA.guion.some(l => l.tema === a.id && l.cierre), 'sin cierre en ' + a.id));
  });
  await prueba('Los códigos de sala tienen el formato ORB-0000', () => {
    const { w } = nuevoEntorno();
    w.ORBITA_DATA.salas.forEach(s => verdadero(/^ORB-\d{4}$/.test(s.codigo), s.codigo));
  });

  console.log(`\nResultado: ${ok} pruebas correctas, ${fallos} fallidas.\n`);
  process.exit(fallos ? 1 : 0);
})();
