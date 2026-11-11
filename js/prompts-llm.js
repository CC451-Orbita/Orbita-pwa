(function () {
  const sistema =
    'Eres el moderador amable de Órbita, una app que equilibra la participación en reuniones. ' +
    'Escribe en español, frases cortas (máximo 25 palabras), tono cálido y nunca punitivo. ' +
    'Nunca menciones que alguien estuvo callado ni compares a las personas. ' +
    'Usa texto plano salvo cuando se solicite Markdown para un resumen.';

  const tareas = {
    invitacion: {
      campos: ['tema', 'nombre', 'contexto', 'preguntaBase'],
      prompt: d => `Tema en discusión: "${d.tema}". Intervenciones que verá ${d.nombre}:\n${d.contexto || 'No hay intervenciones disponibles.'}\n` +
        'Devuelve una sola pregunta abierta y breve, sin saludo. Si aludes a una propuesta, nombra el dato o la acción concreta. ' +
        'Evita referencias vagas como «esta opción» o «este plan». No inventes hechos ni atribuciones. ' +
        `Si no hay contexto suficiente, formula la pregunta sobre el tema. Pregunta de referencia: ${d.preguntaBase || d.tema}`
    },
    sugerenciaDominante: {
      campos: ['nombre', 'porcentaje'],
      prompt: d => `${d.nombre} ha hablado el ${d.porcentaje}% del tiempo. Escribe una sugerencia privada y amable para que ceda la palabra, usando la metáfora de órbitas.`
    },
    resumirAporte: {
      campos: ['texto'],
      prompt: d => `Resume en una sola línea (máx. 20 palabras) este aporte escrito, sin cambiar su sentido:\n"${d.texto}"`
    },
    resumen: {
      campos: ['transcripcion'],
      prompt: d => `Transcripción de la reunión:\n${d.transcripcion}\n\n` +
        'Resume en Markdown con los encabezados exactos «## Decisiones» y «## Temas abiertos». ' +
        'Usa listas con guiones e incluye solo decisiones y pendientes respaldados por la transcripción. ' +
        'Escribe «Ninguno» si una sección está vacía.'
    },
    guiaPreparacion: {
      campos: ['tema'],
      prompt: d => `Tema de la agenda: "${d.tema}". Escribe UNA pregunta guía corta que ayude a una persona tímida a preparar su aporte antes de la reunión.`
    }
  };

  function seleccionarDatos(tarea, datos) {
    if (typeof tarea !== 'string' || !Object.hasOwn(tareas, tarea) || !datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
    const campos = tareas[tarea].campos.map(campo => [campo, datos[campo] ?? '']);
    if (campos.some(([campo, valor]) => campo === 'porcentaje'
      ? !Number.isInteger(valor) || valor < 0 || valor > 100
      : typeof valor !== 'string')) return null;
    return Object.fromEntries(campos);
  }

  const prompts = {
    sistema,
    seleccionarDatos,
    construir(tarea, datos) {
      const seleccion = seleccionarDatos(tarea, datos);
      return seleccion && tareas[tarea].prompt(seleccion);
    }
  };

  if (typeof module === 'object' && module.exports) module.exports = prompts;
  else window.PromptsLLM = prompts;
})();
