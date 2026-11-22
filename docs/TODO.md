# Pendientes de Órbita

Tareas conocidas que faltan para completar la app. Al terminar una, se borra de esta lista en el mismo cambio. Al detectar una nueva, se agrega aquí.

## Funciones

- **Audio y video en la reunión.** Los botones de micrófono y cámara solo cambian de estado en la interfaz; falta transmitir audio y video entre participantes (por ejemplo, con WebRTC y señalización por el WebSocket de la sala). Hasta entonces, no deben presentarse como una llamada en curso. Si una entrega o demo lo requiere antes, conviene ocultarlos.
- **Salas persistentes.** Las salas activas viven en memoria del servidor y se pierden al reiniciarlo. Guardar su estado en SQLite.

## Seguridad

- **Autorización de sesión.** Varias rutas de la API y el WebSocket no verifican quién hace la petición. Añadir un token de sesión y comprobarlo en el servidor.

## Interfaz

- **Barra superior de la reunión en móvil.** Revisar el alto total que ocupa antes del sistema solar.
- **Selectores de registro** (color y canal). Siguen con el estilo nativo del navegador; adaptarlos a `docs/DISENO.md`.
- **Etiquetas con dos puntos** («Canal:», «Usuario:»). Unificar su formato en todos los formularios.
- **Órbitas superpuestas.** Cuando todos están en equilibrio, sus órbitas coinciden y la línea se ve más gruesa que el anillo.
- **Acta con contenido real.** Revisar la pantalla del acta con una minuta generada.
- **Tipografía sin conexión.** Atkinson Hyperlegible Next se carga desde Google Fonts; guardarla en `frontend/vendor/` para que funcione sin internet.
