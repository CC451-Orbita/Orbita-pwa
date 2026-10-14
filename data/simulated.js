/* Datos simulados de Órbita (también disponibles en data/*.json).
   Se cargan como script clásico para que la app funcione incluso abriendo index.html con doble clic. */
window.ORBITA_DATA = {
  participantes: [
    { id: 'ana',   nombre: 'Ana',   rol: 'Jefa de proyecto',   color: '#F2A65A', estilo: 'dominante' },
    { id: 'bruno', nombre: 'Bruno', rol: 'Desarrollador',      color: '#5AC8C8', estilo: 'equilibrado' },
    { id: 'carla', nombre: 'Carla', rol: 'Diseñadora UX',      color: '#C08CF0', estilo: 'equilibrado' },
    { id: 'diego', nombre: 'Diego', rol: 'Analista (nuevo)',   color: '#7FB77E', estilo: 'silencioso' }
  ],

  salas: [
    { codigo: 'ORB-4821', nombre: 'Daily del equipo Atlas', modo: 'videollamada', integrantes: 5, activa: true },
    { codigo: 'ORB-1093', nombre: 'Revisión de presupuesto Q4', modo: 'presencial', integrantes: 7, activa: true },
    { codigo: 'ORB-7755', nombre: 'Clase CC451 – grupo 3', modo: 'videollamada', integrantes: 3, activa: false }
  ],

  agenda: [
    { id: 'T1', titulo: 'Avance del sprint', pregunta: '¿Qué bloqueo te preocupa más de este sprint?' },
    { id: 'T2', titulo: 'Presupuesto del piloto', pregunta: '¿Ves algún riesgo en el presupuesto propuesto para el piloto?' },
    { id: 'T3', titulo: 'Fecha de lanzamiento', pregunta: '¿La fecha del 30 de noviembre es realista desde tu área?' }
  ],

  /* Guion de la reunión simulada. t = segundo (tiempo acelerado), tema = id de la agenda.
     'cierre: true' marca una frase que anuncia el cierre de un tema (dispara la ventana de órbita). */
  guion: [
    { t: 1,  quien: 'ana',   tema: 'T1', texto: 'Buenos días a todos. Empecemos con el avance del sprint, yo les cuento rápido.' },
    { t: 4,  quien: 'ana',   tema: 'T1', texto: 'Terminamos el login y el módulo de salas; falta la integración con la API de voz.' },
    { t: 7,  quien: 'bruno', tema: 'T1', texto: 'La integración de voz está casi lista, solo faltan pruebas en Safari.' },
    { t: 10, quien: 'ana',   tema: 'T1', texto: 'Perfecto. Entonces asumimos que el viernes queda cerrada.' },
    { t: 13, quien: 'carla', tema: 'T1', texto: 'Ojo que los subtítulos aún no muestran el nombre del hablante.' },
    { t: 16, quien: 'ana',   tema: 'T1', texto: 'Bien, lo anotamos. Si nadie más tiene nada, cerramos este tema.', cierre: true },
    { t: 24, quien: 'ana',   tema: 'T2', texto: 'Pasemos al presupuesto del piloto: propongo cuatro mil soles para licencias.' },
    { t: 27, quien: 'ana',   tema: 'T2', texto: 'Con eso cubrimos la API del modelo de lenguaje y el hosting por tres meses.' },
    { t: 30, quien: 'bruno', tema: 'T2', texto: 'Me parece razonable si usamos el plan gratuito de hosting al inicio.' },
    { t: 33, quien: 'ana',   tema: 'T2', texto: 'Listo, ¿lo aprobamos así?', cierre: true },
    { t: 41, quien: 'ana',   tema: 'T3', texto: 'Último punto: la fecha de lanzamiento del 30 de noviembre.' },
    { t: 44, quien: 'carla', tema: 'T3', texto: 'Desde diseño llegamos, pero necesitamos una semana de pruebas con usuarios.' },
    { t: 47, quien: 'ana',   tema: 'T3', texto: 'Entonces mantenemos la fecha y metemos las pruebas en la última semana. Cerramos.', cierre: true }
  ],

  /* Lo que "dicen" los participantes simulados cuando aceptan la invitación. */
  respuestasSimuladas: {
    diego: {
      T1: 'Yo veo un riesgo con Safari: en iOS el reconocimiento de voz se corta a los 60 segundos.',
      T2: 'El plan gratuito del modelo tiene límite de peticiones; con 15 personas por sala lo superamos en una hora.',
      T3: null
    }
  },

  /* Historial simulado para el informe de equidad. */
  historial: [
    { fecha: '2026-09-29', sala: 'Daily del equipo Atlas', equilibrio: 0.48, aportesTu: 1 },
    { fecha: '2026-10-02', sala: 'Daily del equipo Atlas', equilibrio: 0.55, aportesTu: 2 },
    { fecha: '2026-10-06', sala: 'Revisión de presupuesto Q4', equilibrio: 0.61, aportesTu: 2 },
    { fecha: '2026-10-09', sala: 'Daily del equipo Atlas', equilibrio: 0.70, aportesTu: 3 }
  ],

  /* Términos que el validador bloquea en mensajes del LLM (RNF-08: tono no punitivo). */
  terminosProhibidos: ['callado', 'no has dicho nada', 'tímido', 'obligatorio', 'debes hablar', 'silencioso', 'por fin']
};
