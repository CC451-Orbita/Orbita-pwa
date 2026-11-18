# Protocolo de pruebas de usabilidad (SUS) · Órbita v1.0

> **Estado:** instrumento listo; **falta aplicarlo**. Los resultados se registran solo después de hacer las sesiones con personas reales. No se deben completar con datos inventados.

## Objetivo

Medir la usabilidad percibida de Órbita con la **System Usability Scale (SUS)** (Brooke, 1996) y detectar problemas en las tareas principales. Metas: **SUS promedio ≥ 75** y **un usuario nuevo entra a una sala en menos de 60 s** (RNF-11); además, **≥ 80 % de tareas completadas sin ayuda**. Como referencia, 68 es el promedio de la industria.

## Participantes

- **5 personas** (con 5 usuarios se detecta la mayoría de problemas de usabilidad; Nielsen, 2000).
- Perfil: estudiantes o trabajadores que participan en reuniones o trabajos en grupo. Idealmente al menos 1 persona que suela hablar poco y 1 que suela hablar mucho.
- Códigos anónimos: **P1 a P5**. No se registran nombres en los resultados.

## Materiales

- Laptop con Chrome o Edge y la app servida (`python3 -m http.server 8000`) o publicada en GitHub Pages.
- Un segundo dispositivo o pestaña para el moderador (hace de otro participante).
- Hoja de observación (tabla de abajo) y cronómetro.
- Encuesta SUS dentro de la app: **Ajustes → 📋 Encuesta de usabilidad**, o la calculadora en Excel [`final/CC451-PF-SUS-Calculadora.xlsx`](../final/CC451-PF-SUS-Calculadora.xlsx).

## Roles del equipo

| Rol | Quién | Qué hace |
|---|---|---|
| Moderador | (definir) | Lee el guion y las tareas; no ayuda salvo que la persona lleve 2 min bloqueada |
| Observador | (definir) | Anota tiempos, errores, comentarios y si la tarea se completó |
| Participante simulado | (definir) | Se une a la sala desde otro dispositivo y dice la frase de cierre |

## Procedimiento (≈ 20 min por persona)

1. **Bienvenida y consentimiento (2 min).** Explicar que se evalúa la app, no a la persona; que puede pensar en voz alta y retirarse cuando quiera; que no se graba audio.
2. **Tareas (12 min).** Leer una tarea a la vez. Pedir que piense en voz alta.
3. **Encuesta SUS (3 min).** La persona responde las 10 preguntas en la app con su código (P1…P5).
4. **Entrevista breve (3 min).** ¿Qué fue lo más fácil? ¿Lo más confuso? ¿Cómo te sentiste al recibir la invitación privada?

## Tareas

| # | Tarea (se lee tal cual) | Éxito si… | Funciones evaluadas |
|---|---|---|---|
| T1 | «Crea tu perfil y entra a la sala *Daily del equipo Atlas*.» | Llega a la sala de espera; **medir el tiempo (meta < 60 s, RNF-11)** | P1, P2, P3, tutorial |
| T2 | «Crea una reunión real llamada *Trabajo final* con dos temas: *Presentación* y *Reparto de tareas*.» | La sala queda creada con esos 2 temas | P4, agenda editable |
| T3 | «Invita a tu compañero (el moderador) a la sala.» | Comparte el enlace o muestra el QR y ve a la otra persona conectada | P16, presencia |
| T4 | «Antes de empezar, prepara una idea corta para el primer tema.» | Guarda una nota y usa *Hazlo corto* o *Ensayar* | P11 |
| T5 | «Entra a la reunión y espera. Cuando aparezca algo para ti, responde como prefieras.» (el moderador dice *«¿lo aprobamos?»*) | Responde a la invitación privada (hablar, escribir, compartir idea o paso) | P5, P6, P7 |
| T6 | «Cierra el tema actual y termina la reunión.» | Usa *Cerrar tema* y llega al resumen | P5, P8 |
| T7 | «Busca esta reunión en el historial y mira cómo va el equipo.» | Abre el detalle en Historial y luego el Panel del equipo | P14, P13 |
| T8 | «Activa el modo de alto contraste.» | Lo activa en Ajustes | P10, accesibilidad |

## Hoja de observación

| Participante | Tarea | ¿Completó? (Sí / Con ayuda / No) | Tiempo (s) | Errores | Comentarios |
|---|---|---|---|---|---|
| P1 | T1 | | | | |
| … | … | | | | |

## Cálculo del SUS

Cada pregunta se responde de 1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo).

- Preguntas **impares** (1, 3, 5, 7, 9): aporte = respuesta − 1.
- Preguntas **pares** (2, 4, 6, 8, 10): aporte = 5 − respuesta.
- **SUS = suma de aportes × 2,5** (0 a 100).

La app y la calculadora en Excel lo hacen automáticamente.

### Las 10 preguntas

1. Creo que me gustaría usar Órbita con frecuencia.
2. Encontré Órbita innecesariamente compleja.
3. Pensé que Órbita era fácil de usar.
4. Creo que necesitaría el apoyo de una persona técnica para poder usar Órbita.
5. Encontré que las distintas funciones de Órbita estaban bien integradas.
6. Pensé que había demasiada inconsistencia en Órbita.
7. Imagino que la mayoría de las personas aprendería a usar Órbita muy rápidamente.
8. Encontré Órbita muy difícil de usar.
9. Me sentí con mucha confianza usando Órbita.
10. Necesité aprender muchas cosas antes de poder empezar a usar Órbita.

### Interpretación (Bangor, Kortum y Miller, 2009)

| Puntaje | Interpretación |
|---|---|
| ≥ 85 | Excelente |
| 73 – 84 | Buena |
| 52 – 72 | Aceptable |
| < 52 | Por mejorar |

## Resultados

*(Completar después de las sesiones.)*

| Participante | SUS | Tiempo T1 (s) | Tareas completadas sin ayuda | Comentario principal |
|---|---|---|---|---|
| P1 | | | / 8 | |
| P2 | | | / 8 | |
| P3 | | | / 8 | |
| P4 | | | / 8 | |
| P5 | | | / 8 | |
| **Promedio** | | | | |

**Problemas encontrados y cambios propuestos:** *(completar)*

## Referencias

- Brooke, J. (1996). SUS: A “quick and dirty” usability scale. En *Usability Evaluation in Industry*. Taylor & Francis.
- Bangor, A., Kortum, P. y Miller, J. (2009). Determining what individual SUS scores mean. *Journal of Usability Studies, 4*(3), 114–123.
- Nielsen, J. (2000). *Why you only need to test with 5 users*. Nielsen Norman Group.
