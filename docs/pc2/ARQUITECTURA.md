# Arquitectura de Órbita (modelo C4)

## Nivel 1 – Contexto del sistema

![C4 contexto](img/c4-contexto.png)

```mermaid
C4Context
  title Órbita – Contexto del sistema
  Person(p, "Participante", "Habla, escribe y responde invitaciones privadas")
  Person(f, "Facilitador / Docente", "Crea salas, define agenda, revisa el informe de equidad")
  Person(pd, "Participante con discapacidad", "Subtítulos, lista accesible, aporte escrito, vibración")
  System(o, "Órbita", "PWA que equilibra la participación con voz, LLM e interfaz orbital")
  System_Ext(llm, "Proveedor LLM", "Gemini API o Ollama local")
  System_Ext(voz, "Web Speech API", "Reconocimiento y síntesis de voz del navegador")
  System_Ext(rt, "Tiempo real", "BroadcastChannel (prototipo) / Supabase Realtime (producción)")
  Rel(p, o, "Habla, escribe, responde")
  Rel(f, o, "Crea salas, consulta informes")
  Rel(pd, o, "Usa modos accesibles")
  Rel(o, llm, "Invitaciones y resúmenes", "HTTPS/JSON")
  Rel(o, voz, "Transcribe y lee", "JS API")
  Rel(o, rt, "Sincroniza la sala", "eventos")
```

## Nivel 2 – Contenedores y componentes

![C4 contenedores](img/c4-contenedores.png)

| Componente | Responsabilidad | Requerimientos |
|---|---|---|
| `app.js` | Navegación entre las 10 pantallas, modales accesibles, foco y teclado | RF-22, RF-29, RNF-04 |
| `orbits.js` | Dibuja el sistema solar en SVG; lista accesible equivalente | RF-07, RF-08, RF-19 |
| `room.js` | Mide participación por persona y por tema; detecta cierre de tema; abre la ventana de órbita; multiusuario | RF-01, RF-02, RF-09 a RF-13 |
| `llm.js` | Capa de abstracción: `generar(tarea, datos)` con proveedores Simulado, Gemini y Ollama; *fallback*; validador de tono | RF-11, RF-20, RF-21, RNF-08 |
| `voice.js` | Reconocimiento de voz, comandos, TTS y vibración | RF-04 a RF-06, RF-18 |
| `profile.js` | Perfil persistente que aprende del uso | RF-14 a RF-17 |
| `sw.js` | Caché *offline* del *app shell* | RNF-01 |
| `demo.js` | Simulación guiada del flujo completo con datos simulados | RF-24 |

## Decisiones de arquitectura

1. **Sin framework ni build.** HTML, CSS y JavaScript puros: la app corre en cualquier laptop o celular sin `npm install`, y se publica tal cual en GitHub Pages.
2. **Capa de abstracción del LLM.** Las pantallas nunca llaman a un proveedor directamente. Cambiar de Gemini a Ollama (o a otro) es agregar un objeto con el método `generar()`.
3. **Degradación elegante.** Sin voz → texto. Sin LLM → proveedor simulado. Sin red → caché del service worker. Sin `localStorage` → perfil en memoria.
4. **Privacidad por diseño.** No se guarda audio; las invitaciones son privadas; el perfil vive en el dispositivo.
5. **Tiempo real intercambiable.** El prototipo usa `BroadcastChannel` (mismo navegador); en producción se reemplaza por Supabase Realtime o WebSocket sin cambiar la interfaz de `room.js`.

## Flujo de la ventana de órbita (secuencia)

```mermaid
sequenceDiagram
  participant R as room.js
  participant L as llm.js
  participant U as Usuario (vista privada)
  participant G as Grupo (pantalla compartida)
  R->>R: detecta frase de cierre del tema
  R->>G: señal neutra "Se abre una ventana de órbita"
  R->>L: sugerenciaDominante(Ana, 62%)
  L-->>R: "¿Le cedes la palabra al equipo?" (solo Ana)
  R->>L: invitacion(tema, contexto)
  L-->>R: pregunta concreta (validada)
  R->>U: invitación privada + vibración
  U-->>R: Hablar / Escribir / Paso
  R->>R: registra aporte, actualiza perfil y órbita
  R->>G: cierra tema y guarda decisión
```
