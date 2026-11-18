# Órbita

Aplicación web de CC451 (Interacción Humano Computador, UNI) para preparar y compartir aportes en reuniones. El servidor FastAPI sirve la interfaz, sincroniza las salas por WebSocket y usa SQLite para las cuentas, la planificación y las notas. El estado activo de las salas vive en memoria del servidor.

## Ejecutar en local

Desde la raíz del repositorio, con Python 3.10 o posterior:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Abre <http://127.0.0.1:8000>. El primer arranque crea `orbita.db`. Para usar Gemini, configura `GEMINI_API_KEY` y, si hace falta, `GEMINI_MODEL`. Usa variables de entorno o copia `.env.example` a `.env` y añade `--env-file .env` al comando de Uvicorn.

## Flujo y límites

1. Crea una cuenta, abre una sala, define la agenda y comparte su código. Los participantes deben conectarse al mismo servidor.
2. Prepara tu intervención, escribe o dicta texto en un navegador compatible y comparte tus aportes. El chat, la mano levantada, las invitaciones y los aportes se actualizan en la sala por WebSocket.
3. El radar calcula porcentajes con los segundos declarados por cada aporte. La interfaz asigna 8 s al publicar un aporte formal. El dictado llena campos de texto y la aplicación carece de identificación automática de hablantes.
4. El asistente prepara borradores de aportes y minutas con Gemini. Esta versión usa plantillas cuando falla la consulta o falta la clave. Las minutas deben revisarse antes de usarlas como acta.

La aplicación web actual carece de manifiesto y service worker. El inicio de sesión comprueba la contraseña, pero varias rutas y el WebSocket carecen de autorización de sesión. Usa cuentas de prueba en un entorno local.

## Pruebas

Desde una copia local de pruebas, instala `pytest` y `httpx` y ejecuta `python -m pytest backend/tests`. La suite escribe cuentas de prueba en `orbita.db` y utiliza respuestas de Gemini simuladas.

## Documentación del curso

- [Informe de la PC02](docs/pc2/CC451-PC02-Informe-Orbita.pdf)
- [Informe de la PC03](docs/CC451-PC03-Informe-Orbita.pdf), con su [guía de instalación](docs/INSTALACION.md) y [arquitectura](docs/ARQUITECTURA.md) para la versión en Node.js
- [Informe final incluido en el ZIP](docs/final/CC451-PF-Informe-Orbita.pdf)
- [Arquitectura de la versión estática v1.0](docs/v1.0/ARQUITECTURA.md) y [sus mediciones](docs/v1.0/MEDICIONES.md)
