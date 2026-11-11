# Guía de instalación – Órbita

## Requisitos

- Laptop con Windows, macOS o Linux, o un celular Android/iOS.
- Navegador **Google Chrome** o **Microsoft Edge** (recomendado: tienen reconocimiento de voz). Firefox y Safari funcionan sin voz (se usa el aporte escrito).
- Opcional: **Python 3** o **VS Code + Live Server** para servir la app.
- Opcional: una **API key de Gemini** (gratuita en Google AI Studio) u **Ollama** instalado para usar un LLM real.

## Opción 1 – Doble clic (la más rápida)

1. Descarga o clona el repositorio.
2. Abre `index.html` con doble clic.
3. Pulsa **"▶ Ver simulación guiada"**.

> Con `file://` no funcionan el modo *offline* ni la instalación como app. Para eso usa la opción 2.

## Opción 2 – Servidor local (recomendada)

**Con Python:**

```bash
cd orbita-pwa
python -m http.server 8000
```

Abre <http://localhost:8000>.

**Con VS Code:**

1. Instala la extensión **Live Server** (Ritwick Dey).
2. Abre la carpeta `orbita-pwa`.
3. Clic derecho en `index.html` → **Open with Live Server**.

## Instalar como app (PWA)

- **Laptop (Chrome/Edge):** ícono de instalar (⊕) en la barra de direcciones → *Instalar Órbita*.
- **Android:** menú ⋮ → *Agregar a la pantalla principal*.
- **iPhone (Safari):** botón Compartir → *Agregar a inicio*.

Para probar en el celular dentro de la misma red Wi-Fi: `python -m http.server 8000 --bind 0.0.0.0` y entra a `http://<IP-de-tu-laptop>:8000`. El micrófono en el celular requiere HTTPS (por ejemplo, publicando en GitHub Pages).

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

Requiere Node.js 18 o superior (no hay que instalar nada más):

```bash
node tests/run.js
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
3. La app queda en `https://<usuario>.github.io/orbita-pwa/` con HTTPS (voz y PWA funcionan en el celular).
