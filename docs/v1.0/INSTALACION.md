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

## Hacer una reunión real

1. Entra con **Comenzar** y completa tu perfil (la primera vez se abre el tutorial).
2. **Crear sala** → escribe el nombre, elige **Videollamada** o **Presencial**, deja el tipo **Reunión real** y edita la agenda (hasta 8 temas).
3. En la sala de espera pulsa **👥 Invitar y miembros**: comparte el **enlace** o el **QR**. Quien lo abre entra directo a esa sala con la misma agenda y puede preparar su participación.
4. En la pantalla de invitar verás quién está conectado. Cuando estén todos, **Entrar a la reunión**.
5. Hablen o escriban. Para cerrar un tema digan una frase como *«¿lo aprobamos?»*, *«pasemos al siguiente punto»* o *«si nadie tiene nada más…»*, o pulsen **Cerrar tema**. Se abre la ventana de órbita y cada quien ve en privado su invitación.
6. Al terminar, el resumen queda en **Historial** y el **Panel del equipo** se actualiza.

Sin configurar Supabase, la reunión conecta **pestañas del mismo navegador** (útil para probar). Para personas en distintos dispositivos, configura Supabase (siguiente sección).

## Conectar dispositivos con Supabase (opcional)

Órbita solo usa los canales de tiempo real de Supabase (*broadcast* y *presencia*); **no necesita tablas ni base de datos**.

1. Crea una cuenta gratuita en <https://supabase.com> y un proyecto nuevo (cualquier región; la más cercana a Perú suele ser São Paulo).
2. En el proyecto, abre **Project Settings → API** (o **API Keys**) y copia:
   - la **Project URL** (`https://xxxxxxxx.supabase.co`);
   - la clave pública **anon** o **publishable**. **Nunca** uses la clave `service_role` / `secret`.
3. En **Realtime → Settings**, deja permitido el acceso a canales públicos (opción por defecto; si está activado «solo canales privados», Órbita no podrá unirse).
4. Pega los datos de una de estas dos formas:
   - **Para todo el equipo:** en `js/config.js` → `supabaseUrl` y `supabaseAnonKey`, y vuelve a publicar la app.
   - **Solo en tu dispositivo:** **Ajustes → Tiempo real entre dispositivos (Supabase)** → pega URL y clave → **Guardar conexión**.
5. Entra a una reunión: arriba debe decir **🌐 Conectado por internet (Supabase)**. Si dice **⚠ Sin Supabase**, Órbita volvió al modo local: revisa la URL, la clave y tu conexión.

Prueba recomendada: abre la sala en la laptop y en un celular (con la app publicada en HTTPS, por ejemplo GitHub Pages), únete con el enlace y escribe un aporte desde cada uno.

## Reunión presencial con una sola laptop (diarización)

1. Crea la sala con modo **Presencial**.
2. En la sala de espera pulsa **🎙 Voces de la sala**. Agrega a cada persona con su nombre (**＋ Agregar**); cada una pulsa **🎙 Inscribir voz (5 s)** y habla de forma natural durante 5 segundos. Inscribe también tu propia voz.
3. Entra a la reunión y activa el micrófono. Cada frase se atribuye a la persona con la voz más parecida; el subtítulo muestra, por ejemplo, *«🎙 Carla (92 % de confianza)»*. Si nadie se parece lo suficiente, se atribuye a quien usa la laptop.

Funciona mejor con voces distintas, un solo micrófono cerca del centro y poco ruido. Es una atribución aproximada: dos voces muy parecidas pueden confundirse. El audio no se guarda; solo se guardan unos números (tono y timbre medios) por persona en este dispositivo.

## Encuesta SUS

**Ajustes → 📋 Encuesta de usabilidad**: 10 preguntas de 1 a 5. Al enviar, la app muestra el puntaje (0–100) y su interpretación, y permite **⬇ Descargar resultados (CSV)**. El protocolo completo está en [PRUEBAS-USABILIDAD.md](PRUEBAS-USABILIDAD.md).

## Probar la preparación de la participación

1. Entra a una sala (por ejemplo **Daily del equipo Atlas** o la tuya). Llegarás a la **Sala de espera**.
2. Pulsa **✎ Preparar mi participación**.
3. Escribe o dicta (🎙) una idea en cada tema. Se guarda sola.
4. Prueba **✨ Hazlo corto**, **🔊 Escuchar** y **🎤 Ensayar**. «Hazlo corto» procesa la nota localmente.
5. Desmarca "Quiero que me inviten…" en un tema para que Órbita no te invite ahí.
6. Vuelve a la sala de espera y pulsa **Entrar a la reunión**: cuando llegue tu ventana de órbita verás tu idea y podrás compartirla con un toque. También está el botón **📝 Mis notas**.

## Ejecutar las pruebas automáticas

Requiere Node.js 18 o superior (no hay que instalar nada más):

```bash
node tests/run.js     # 45 pruebas correctas
```

## Usar un LLM real

**Gemini (remoto).** Entra con **Comenzar**, abre **Ajustes**, selecciona **Gemini**, pega tu clave y pulsa **Probar proveedor**. La prueba envía un ejemplo ficticio y muestra el proveedor de la respuesta. La clave queda en memoria de esa pestaña y se vuelve a ingresar al recargar.

**Ollama (local):**

```bash
ollama pull llama3.2
OLLAMA_ORIGINS="*" ollama serve
```

Luego, Ajustes ⚙ → Proveedor: *Ollama*.

Si el proveedor falla, Órbita usa el respaldo simulado y lo indica. En las salas de demostración el guion y los hablantes siguen siendo simulados aunque se conecte un proveedor real; en una reunión real solo participan personas reales.

## Probar voz real

Abre `http://localhost:8000` en Chrome o Edge y entra con **Comenzar**. En **Preparar mi participación**, pulsa **Dictar**, concede permiso al micrófono y habla. El reconocimiento del navegador puede usar un servicio en línea. Confirma que aparece el texto en tu nota y prueba **Ensayar** para ver duración y ritmo. Para **Escuchar**, habilita una voz local en español en tu dispositivo y sube el volumen. Si falla el reconocimiento, puedes escribir la nota.

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub.
2. *Settings → Pages → Branch: main / root → Save*.
3. La app queda en `https://<usuario>.github.io/orbita-pwa/` con HTTPS (voz y PWA funcionan en el celular).
