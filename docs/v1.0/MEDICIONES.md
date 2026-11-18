# Mediciones de Órbita v1.0

Mediciones hechas el **16 de noviembre de 2026** con los scripts del equipo (Playwright + Chromium 153 sin interfaz, render por software, en un contenedor Linux). Un navegador con GPU en una laptop normal debería dar resultados iguales o mejores; **falta repetirlas en los dispositivos reales del equipo** y en Firefox/Safari.

## Resumen

| # | Qué se midió | Requerimiento | Resultado | Estado |
|---|---|---|---|---|
| 1 | Pruebas automáticas (`node tests/run.js`) | RNF-12 | 45 correctas, 0 fallidas | ✅ |
| 2 | Fluidez de la interfaz orbital con 16 participantes | RNF-03 (≥ 30 fps) | 60 fps; dibujo de cada cuadro: mediana 0,4 ms, p95 0,7 ms, máx. 0,9 ms (81 cuadros) | ✅ |
| 3 | Latencia de la invitación (cierre de tema → invitación visible), proveedor simulado | RNF-02 (< 3 s) | 355–357 ms en 5 mediciones | ✅ con Simulado |
| 4 | Latencia con Gemini | RNF-02 | Depende de la red; tiempo máximo de espera 12 s y luego respaldo simulado | 🟡 medir con red real |
| 5 | Sala con 15 participantes (15 pestañas, BroadcastChannel) | RNF-10 | Cada pestaña ve 15 personas y recibe los 15 aportes; todos en 780 ms; 0 errores | ✅ |
| 6 | Diarización con 2 voces sintéticas (118 Hz y 215 Hz) por micrófono simulado | RF-41 | 12/12 frases atribuidas bien; confianza 91–99 % | ✅ aproximado |
| 7 | Accesibilidad automática (axe-core 4.10.2, WCAG 2.0/2.1/2.2 A y AA) | RNF-04 | 0 violaciones en 17 vistas | ✅ automático |
| 8 | Microinteracciones (transiciones CSS) | RNF-14 (≤ 300 ms) | 220 ms | ✅ |
| 9 | Recarga sin conexión (service worker `orbita-v10`) | RNF-01 | La app abre y la demo funciona sin red | ✅ |
| 10 | Respaldo de Supabase ante error o falta de respuesta | RNF-09 | Vuelve a modo local de inmediato ante error, o a los 8 s si no responde (probado con cliente simulado) | ✅ simulado |

## Detalle

### 2. Interfaz orbital
Se abrió una reunión de demostración con 16 planetas y se midió con `requestAnimationFrame` el tiempo entre cuadros y el tiempo de dibujo del SVG durante 81 cuadros.

### 3. Latencia de la invitación
Desde que se detecta la frase de cierre hasta que el modal privado está visible. Con Gemini se suma el tiempo de red; si no responde en 12 s se usa el proveedor simulado.

### 5. Sala con 15 pestañas
Quince pestañas se unieron a la misma sala real; cada una envió un aporte. Se comprobó que todas vieran a las 15 personas conectadas y los 15 aportes. **Limitación:** BroadcastChannel solo conecta pestañas del mismo navegador. Con Supabase el comportamiento es el mismo porque usa la misma interfaz, pero **falta probarlo con dispositivos reales**.

### 6. Diarización
Se generaron dos archivos de voz sintética (`voz-grave.wav`, 118 Hz; `voz-aguda.wav`, 215 Hz) y se usaron como micrófono de Chromium. Se inscribieron las dos voces (5 s cada una) y luego se clasificaron 6 tramos de cada voz.
**Limitación:** voces sintéticas con tonos muy distintos. Con personas reales, ruido y voces parecidas la precisión será menor; **falta medirla con el equipo** (sugerido: 3 personas, 10 frases cada una, contar aciertos).

### 7. Accesibilidad
Vistas auditadas: bienvenida, perfil, salas, crear sala, sala de espera, preparar, miembros, voces, reunión, resumen, tu evolución, historial, panel, ajustes, SUS, tutorial y aporte escrito. Se corrigieron dos problemas: contraste del botón principal (3,36:1 → 4,92:1) y un selector sin nombre accesible.
**Limitación:** la auditoría automática no reemplaza la prueba con lector de pantalla (NVDA o TalkBack), que **falta hacer**.

## Cómo repetirlas

```bash
python3 -m http.server 8000
node tests/run.js
# en DevTools → Performance: grabar 10 s de una reunión de demostración
# Lighthouse → Accessibility y PWA
```

## Pendiente con personas y dispositivos reales

- Prueba SUS con 5 usuarios ([PRUEBAS-USABILIDAD.md](PRUEBAS-USABILIDAD.md)).
- Supabase entre al menos 3 dispositivos distintos.
- Diarización con voces reales.
- Lector de pantalla (NVDA en Windows, TalkBack en Android).
- Firefox y Safari (sin reconocimiento de voz: deben funcionar con aporte escrito).
- Latencia con Gemini en la red de la universidad.
