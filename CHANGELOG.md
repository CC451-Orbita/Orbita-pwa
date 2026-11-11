# Historial de cambios

## v0.7.0 – PC03 (11 de noviembre de 2026) · prototipo funcional al 70 %

### Nuevo
- **Preparar mi participación (P11)**: por cada tema de la agenda, una pregunta guía generada por el LLM, una nota escrita o dictada con guardado automático, el botón **✨ Hazlo corto** (el LLM resume la idea en una frase), **🔊 Escuchar** (TTS) y **🎤 Ensayar** (mide la duración y el ritmo de habla). Pedido del profesor en la primera presentación.
- **Sala de espera (P12)**: agenda con el estado de preparación, cuenta regresiva, check-in emocional y consejo adaptado ("Es normal. Prepara una idea por tema…").
- **Elegir en qué temas ser invitado**: si el usuario lo desactiva, la ventana de órbita no se abre para él en ese tema y no se avisa a nadie.
- **Idea preparada en la invitación**: la ventana de órbita muestra la nota del tema y permite **compartirla con un toque** (aparece con 📝).
- **Mis notas 📝** durante la reunión.
- **Reflexión personal** con estadísticas de preparación (preparadas, compartidas, ensayos).
- **Pruebas automáticas**: 20 pruebas sin dependencias (`node tests/run.js`) y flujo de GitHub Actions.

### Cambios
- El flujo pasa por la sala de espera: Salas / Crear sala → **Sala de espera** → Reunión.
- La simulación guiada recorre ahora 12 pasos e incluye la preparación.
- Índice de equilibrio extraído a `Sala.indiceEquilibrio()` para poder probarlo.
- Service worker `orbita-v2` (incluye `prep.js`).

## v0.5.0 – PC02 (14 de octubre de 2026) · prototipo de fidelidad media
- 10 pantallas, interfaz orbital, voz, capa LLM (Simulado / Gemini / Ollama), perfil persistente, multiusuario entre pestañas, simulación guiada, PWA.
