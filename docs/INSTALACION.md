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
3. En cada pestaña crea un perfil con nombre distinto.
4. En ambas, únete a la misma sala (por ejemplo `ORB-4821`).
5. Lo que escribas o digas en una pestaña aparece como un planeta nuevo en la otra.

## Usar un LLM real

**Gemini (remoto):** Ajustes ⚙ → Proveedor: *Gemini* → pega tu API key → *Probar proveedor*.

**Ollama (local):**

```bash
ollama pull llama3.2
OLLAMA_ORIGINS="*" ollama serve
```

Luego, Ajustes ⚙ → Proveedor: *Ollama*.

Si el proveedor falla, Órbita usa automáticamente el proveedor simulado y lo indica en el resumen.

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub.
2. *Settings → Pages → Branch: main / root → Save*.
3. La app queda en `https://<usuario>.github.io/orbita-pwa/` con HTTPS (voz y PWA funcionan en el celular).
