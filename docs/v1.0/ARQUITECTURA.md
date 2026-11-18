# Arquitectura de Órbita (modelo C4) · v1.0

## Nivel 1 – Contexto del sistema

![C4 contexto](img/c4-contexto.png)

```mermaid
C4Context
  title Órbita – Contexto del sistema
  Person(p, "Participante", "Prepara, habla, escribe y responde invitaciones privadas")
  Person(f, "Facilitador / Docente", "Crea salas y agenda, invita, cierra temas, revisa historial y panel")
  Person(pd, "Participante con discapacidad", "Subtítulos, lista accesible, aporte escrito, vibración")
  System(o, "Órbita", "PWA que equilibra la participación con voz, LLM e interfaz orbital")
  System_Ext(llm, "Proveedor LLM", "Gemini API o Ollama local")
  System_Ext(voz, "Web Speech API y Web Audio", "Reconocimiento, síntesis y análisis de voz del navegador")
  System_Ext(rt, "Supabase Realtime", "Broadcast y presencia entre dispositivos (opcional)")
  Rel(p, o, "Habla, escribe, responde")
  Rel(f, o, "Crea salas, consulta informes")
  Rel(pd, o, "Usa modos accesibles")
  Rel(o, llm, "Invitaciones y resúmenes", "HTTPS/JSON")
  Rel(o, voz, "Transcribe, lee y atribuye", "JS API")
  Rel(o, rt, "Aportes y presencia", "WebSocket")
```

## Nivel 2 – Contenedores

![C4 contenedores](img/c4-contenedores.png)

Órbita es una sola aplicación web estática (sin servidor propio). Los contenedores son:

| Contenedor | Tecnología | Función |
|---|---|---|
| App PWA | HTML, CSS y JavaScript sin *build* | Toda la interfaz y la lógica |
| Service worker | `sw.js` (caché `orbita-v10`) | Funcionamiento *offline* |
| Almacenamiento local | `localStorage` | Perfil, notas, voces inscritas, historial, respuestas SUS |
| Supabase Realtime (opcional) | supabase-js 2 (en `vendor/`) | Canal `orbita-<código>` con broadcast y presencia |
| Proveedor LLM (opcional) | Gemini `gemini-3.5-flash-lite` u Ollama | Invitaciones, sugerencias, resúmenes |

## Nivel 3 – Componentes

| Componente | Responsabilidad | Requerimientos |
|---|---|---|
| `app.js` | Navegación entre 18 vistas, modales accesibles, foco, teclado, micrófono presencial | RF-22, RNF-04 |
| `agenda.js` | Agenda por sala, enlace de invitación, detección de frases de cierre, resumen sin IA | RF-10, RF-29, RF-43 |
| `room.js` | Motor de la reunión: participación por persona y tema, ventana de órbita, reunión real o demo | RF-01, RF-09 a RF-13, RF-45 |
| `realtime.js` | Transporte intercambiable: BroadcastChannel o Supabase Realtime, con respaldo local | RF-02, RF-42, RF-44 |
| `diarizacion.js` | Huella de voz (tono y centroide espectral) y atribución de frases | RF-41, RNF-06 |
| `orbits.js` | Sistema solar en SVG y lista accesible equivalente | RF-07, RF-08, RF-19 |
| `llm.js` | `generar(tarea, datos)` con Simulado, Gemini y Ollama; *fallback*, tono, estilo y límite de 25 palabras | RF-11, RF-20, RF-21, RNF-08 |
| `voice.js` | Reconocimiento (también continuo), comandos, TTS y vibración | RF-04 a RF-06, RF-18 |
| `profile.js` | Perfil persistente que aprende del uso | RF-14 a RF-17 |
| `prep.js` | Preparar la participación y sala de espera | RF-30 a RF-37 |
| `historial.js` | Historial de reuniones, estadísticas del equipo y recomendaciones | RF-25, RF-38, RF-39 |
| `extras.js` + `sus.js` | Tutorial, miembros y QR, inscripción de voces, encuesta SUS | RF-34, RF-40, RF-46 |
| `demo.js` | Simulación guiada (14 pasos) | RF-24 |
| `tests/run.js` | 45 pruebas automáticas sin dependencias | RNF-12 |

## Tiempo real

```mermaid
sequenceDiagram
  participant A as Dispositivo A (facilitador)
  participant T as realtime.js
  participant S as Supabase Realtime
  participant B as Dispositivo B
  A->>T: conectar("ORB-1234", yo)
  T->>S: channel("orbita-ORB-1234") + track(perfil)
  B->>S: se une al mismo canal
  S-->>A: presence sync (B conectado)
  A->>S: broadcast {tipo:"sala", agenda}
  S-->>B: B adopta la agenda del facilitador
  B->>S: broadcast {tipo:"aporte", texto, tema}
  S-->>A: aparece el planeta y el subtítulo de B
  Note over T: si Supabase no responde en 8 s → BroadcastChannel (mismo navegador)
```

`room.js` solo conoce la interfaz `{ enviar(mensaje), cerrar() }`; por eso cambiar de transporte no toca el motor de la reunión. Sin credenciales se usa BroadcastChannel.

## Ventana de órbita en una reunión real

```mermaid
sequenceDiagram
  participant P as Persona (voz o texto)
  participant R as room.js
  participant AN as agenda.js (Analisis)
  participant L as llm.js
  participant Y as Mi dispositivo (vista privada)
  P->>R: "¿Lo aprobamos?"
  R->>AN: esCierre(texto)
  AN-->>R: sí
  R->>R: abre la ventana de órbita (señal neutra para todos)
  alt yo hablé mucho
    R->>L: sugerenciaDominante(%, estilo)
    L-->>Y: sugerencia privada
  else no he aportado en el tema
    R->>L: invitacion(tema, contexto, estilo)
    L-->>Y: pregunta concreta (≤ 25 palabras)
    Y-->>R: Hablar / Escribir / Compartir idea / Paso
  end
  R->>R: cierra el tema y pasa al siguiente
```

Cada dispositivo calcula y muestra solo **su propia** invitación; nadie ve a quién se invitó.

## Modo presencial con una laptop

```mermaid
sequenceDiagram
  participant U as Persona
  participant V as voice.js
  participant D as diarizacion.js
  participant R as room.js
  Note over D: antes: cada persona inscribe 5 s de voz → huella {tono, centroide}
  U->>V: habla
  V-->>D: texto + tiempo (desde, hasta)
  D->>D: huella del tramo y distancia a cada huella inscrita
  D-->>R: persona más parecida + confianza (o quien usa la laptop)
  R->>R: registra el aporte a nombre de esa persona
```

## Decisiones de arquitectura

1. **Sin framework ni build.** Corre en cualquier laptop o celular y se publica tal cual en GitHub Pages.
2. **Capa de abstracción del LLM.** Las pantallas nunca llaman a un proveedor directamente.
3. **Capa de abstracción del tiempo real.** BroadcastChannel y Supabase comparten la misma interfaz; Supabase es opcional.
4. **Degradación elegante.** Sin voz → texto. Sin LLM → simulado. Sin red → caché. Sin Supabase → local. Sin huellas → se atribuye a quien usa el dispositivo.
5. **Privacidad por diseño.** No se guarda audio; invitaciones privadas; perfil, voces e historial en el dispositivo; el enlace solo lleva nombre, modo y agenda.
6. **Lógica separada de la interfaz.** `Agenda`, `Analisis`, `Realtime`, `Diarizacion`, `Historial`, `SUS`, `LLM` y `Sala` se prueban con Node sin navegador.
7. **Sin rankings.** El panel del equipo muestra solo datos agregados.

## Diagrama de pantallas

![Pantallas](img/pantallas.png)

Las fuentes Graphviz están en `docs/diagramas/`.
