# Guía de instalación – Órbita

## Requisitos

- Laptop con Windows, macOS o Linux, o un celular Android/iOS.
- **Google Chrome** o **Microsoft Edge** para probar la reunión con reconocimiento de voz del navegador. El asistente usa `MediaRecorder` y permite escribir si el navegador no puede grabar.
- **Node.js 22 o superior** para el servidor local y las pruebas.
- Una **API key de Gemini** para el asistente. Puedes gestionarla en [Google AI Studio](https://aistudio.google.com/apikey).

## Opción 1 – Doble clic (la más rápida)

1. Descarga o clona el repositorio.
2. Abre `index.html` con doble clic.
3. Pulsa **"▶ Ver simulación guiada"**.

> Con `file://` no funcionan el modo *offline* ni la instalación como app. Para eso usa la opción 2.

## Opción 2 – Servidor local (recomendada)

```bash
cd Orbita-pwa
npm start
```

Abre <http://localhost:8000>. Puedes usar las pantallas de la reunión y la demo guiada sin configurar una clave.

## Probar el asistente de voz con Gemini

1. Copia `.env.example` a `.env` si todavía no tienes ese archivo. Configura `GEMINI_API_KEY` en `.env`. Git ignora ese archivo.
2. Ejecuta `npm start` desde `Orbita-pwa` y abre <http://localhost:8000>.
3. Pulsa **Comenzar**, entra a **Salas → Asistente de voz** y elige un tema si quieres orientar la conversación.
4. Pulsa **Grabar mensaje**, permite el micrófono y pulsa **Detener grabación** cuando termines. Revisa la transcripción antes de enviarla. La grabación admite hasta 45 segundos.
5. Pulsa **Enviar mensaje**. Lee la respuesta y pulsa **Escuchar última respuesta** para reproducir el audio que genera Gemini.

Si cambias `.env`, reinicia el servidor. El asistente requiere conexión con Gemini y se sirve desde el backend local. Puedes escribir si el micrófono no está disponible.

## Instalar como app (PWA)

- **Laptop (Chrome/Edge):** ícono de instalar (⊕) en la barra de direcciones → *Instalar Órbita*.
- **Android:** menú ⋮ → *Agregar a la pantalla principal*.
- **iPhone (Safari):** botón Compartir → *Agregar a inicio*.

Para probar la PWA de reuniones en el celular, usa la versión estática por HTTPS. El asistente de voz requiere su propio servidor Node.js. El servidor de desarrollo escucha en `127.0.0.1` y se prueba desde el equipo donde se ejecuta.

## Probar el multiusuario

1. Sirve la app con la opción 2.
2. Abre **dos pestañas** en <http://localhost:8000>.
3. Con **Comenzar**, entra con un perfil. En la segunda pestaña abre **Ajustes → Editar perfil** y guarda un nombre de prueba distinto.
4. En ambas, únete a la misma sala (por ejemplo `ORB-4821`) y pulsa **Entrar a la reunión**.
5. Escribe un aporte en la primera. En la segunda deben aparecer el planeta y el subtítulo con el ícono de aporte escrito.

## Probar la preparación de la participación

1. Entra a una sala (por ejemplo **Daily del equipo Atlas**). Llegarás a la **Sala de espera**.
2. Pulsa **✎ Preparar mi participación**.
3. Escribe o dicta (🎙) una idea en cada tema. Se guarda sola.
4. Prueba **✨ Hazlo corto**, **🔊 Escuchar** y **🎤 Ensayar**. «Hazlo corto» procesa la nota localmente.
5. Desmarca "Quiero que me inviten…" en un tema para que Órbita no te invite ahí.
6. Vuelve a la sala de espera y pulsa **Entrar a la reunión**: cuando llegue tu ventana de órbita verás tu idea y podrás compartirla con un toque. También está el botón **📝 Mis notas**.

## Ejecutar las pruebas automáticas

Con Node.js 22 o superior, ejecuta las pruebas sin instalar dependencias.

```bash
npm test
```

## Usar un LLM real

**Gemini (remoto).** Entra con **Comenzar**, abre **Ajustes**, selecciona **Gemini**, pega tu clave y pulsa **Probar proveedor**. La prueba envía un ejemplo ficticio y muestra el proveedor de la respuesta. La clave queda en memoria de esa pestaña y se vuelve a ingresar al recargar.

**Ollama (local):**

```bash
ollama pull llama3.2
OLLAMA_ORIGINS="*" ollama serve
```

Luego, Ajustes ⚙ → Proveedor: *Ollama*.

Si el proveedor falla, Órbita identifica el respaldo como simulado. La agenda de prueba, el guion y los hablantes ficticios siguen siendo simulados cuando se conecta un proveedor real.

## Probar voz real

Abre `http://localhost:8000` en Chrome o Edge y entra con **Comenzar**. En **Preparar mi participación**, pulsa **Dictar**, concede permiso al micrófono y habla. El reconocimiento del navegador puede usar un servicio en línea. Confirma que aparece el texto en tu nota y prueba **Ensayar** para ver duración y ritmo. Para **Escuchar**, habilita una voz local en español en tu dispositivo y sube el volumen. Si falla el reconocimiento, puedes escribir la nota.

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub.
2. *Settings → Pages → Branch: main / root → Save*.
3. La PWA de reuniones queda disponible por HTTPS. GitHub Pages sirve los archivos estáticos. Para el asistente de voz, ejecuta el servidor con la opción 2.
