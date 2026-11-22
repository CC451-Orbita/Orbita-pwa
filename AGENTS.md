# Guía de trabajo en Órbita

Instrucciones para personas y agentes de IA que trabajan en este repositorio.

## Documentos de referencia

Leerlos antes de modificar la parte correspondiente:

- **Diseño visual e interacción: [`docs/DISENO.md`](docs/DISENO.md).** Es obligatorio en cualquier cambio de `frontend/`: paleta, tipografía, botones, sistema solar, galaxias, movimiento y accesibilidad. Si un cambio altera un token o un componente, la guía se actualiza en el mismo cambio.
- **Redacción de textos de la interfaz y de la documentación: [`.agents/rules/AGENTS.md`](.agents/rules/AGENTS.md).**
- **Pendientes: [`docs/TODO.md`](docs/TODO.md).** Revisarlo antes de empezar una tarea, por si ya está registrada o depende de otra. Al terminar una tarea, quitarla de la lista; al encontrar una nueva, agregarla.
- **Arquitectura e instalación:** [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y [`docs/INSTALACION.md`](docs/INSTALACION.md). Describen versiones anteriores; el código actual manda cuando difieren.

## Qué es Órbita

Aplicación web de CC451 para preparar y compartir aportes en reuniones. Un servidor FastAPI sirve la interfaz, sincroniza las salas por WebSocket y guarda cuentas, planificación y notas en SQLite (`orbita.db`). Las salas activas viven en memoria: se pierden al reiniciar el servidor.

```
backend/app/     API FastAPI, salas en memoria, base SQLite y servicio de Gemini
backend/tests/   pruebas con pytest
frontend/        index.html (Alpine.js + Tailwind), css/orbita.css y js/
docs/            informes del curso, arquitectura y guía de diseño
```

Módulos del frontend:

- `js/app.js`: estado y lógica de pantallas.
- `js/api.js`: cliente REST y WebSocket.
- `js/orbits_d3.js`: sistema solar de la reunión.
- `js/astros.js`: sol y planetas compartidos.
- `js/portada.js`: ejemplo interactivo de la portada.
- `js/cielo.js`: galaxias de fondo.

## Ejecutar en local

Desde la raíz del repositorio, con Python 3.10 o posterior:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --env-file .env
```

La aplicación queda en <http://127.0.0.1:8000>. `.claude/launch.json` tiene la misma configuración para la vista previa de Claude Code. Después de cambiar CSS o JS, recargar forzando la actualización (Ctrl+Shift+R): el navegador guarda en caché los archivos estáticos.

Pruebas: `.venv/bin/python -m pytest backend/tests` (requiere `pytest` y `httpx`). La suite escribe cuentas de prueba en `orbita.db`.

## Trabajo en conjunto

Este repositorio lo modifican varias personas y agentes. Para no pisarse:

- **Antes de editar, revisar `git status`.** Puede haber cambios ajenos sin commit en los mismos archivos: se trabaja encima de ellos, nunca se revierten ni se descartan sin preguntar.
- **Cambios acotados:** una tarea por cambio. No se reformatean archivos completos ni se renombran identificadores internos sin motivo.
- **No hacer commit, push ni publicar nada sin que la persona responsable lo pida.** Al terminar, informar qué archivos cambiaron, qué se comprobó y qué queda pendiente.
- **Al tomar una decisión de diseño nueva,** registrarla en `docs/DISENO.md` para que el resto la conozca.

## Reglas del proyecto

- **Datos de demostración.** Solo se usan para demos y se marcan como tales en la interfaz (por ejemplo, el sistema solar de la portada). No sustituyen una función de la app ni se documentan como parte de ella.
- **Gemini.** Las respuestas de Gemini se usan como borradores. Si la consulta falla o falta la clave, la app usa plantillas, y eso debe quedar visible. No se inventan respuestas presentadas como reales.
- **Secretos.** `GEMINI_API_KEY` va en `.env` o en variables de entorno. `.env`, `.venv/`, `orbita.db` y `orbita-pwa.zip` no se suben al repositorio ni se incluyen en entregas.
- **Datos de prueba** con nombres identificables («Usuario de prueba», `prueba_ui`). Nunca datos personales reales.
- **Seguridad conocida.** Varias rutas y el WebSocket no verifican la sesión. No se amplía esa superficie, y si se toca, se documenta.

## Verificar un cambio

1. Levantar el servidor y recorrer el flujo afectado en el navegador: portada, acceso, mis reuniones, crear sala, speech, sala de espera, reunión y acta.
2. En cambios visuales, aplicar la lista de comprobación de `docs/DISENO.md`.
3. En cambios de backend, ejecutar las pruebas.
4. Informar con resultados reales: qué se probó, qué falló y qué no se pudo comprobar.
