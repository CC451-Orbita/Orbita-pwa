# Guía de diseño de Órbita

Esta guía fija la dirección visual de la interfaz web (`frontend/`). Cualquier pantalla nueva o cambio visual debe respetarla. Si una decisión no encaja aquí, se discute y se actualiza esta guía antes de implementarla.

## Idea central

Órbita muestra cómo se reparte la palabra en una reunión. La metáfora es un **sistema solar**: el tema es el sol y cada participante es un planeta. Quien aporta más se acerca al sol; quien aporta poco se aleja. El anillo punteado marca el reparto equilibrado.

Toda la interfaz deriva de esa imagen: fondo de espacio profundo, galaxias tenues, el sol en azafrán y cada persona con su color. El objetivo es que nadie confunda Órbita con una plantilla de panel de administración.

**Vocabulario fijo.** El componente central se llama «sistema solar», nunca «radar». El indicador de reparto se llama «equilibrio», tanto en la barra como en el anillo. La acción de compartir una intervención es «Publicar aporte» y su confirmación debe usar el mismo verbo.

## Paleta

Los valores viven en `frontend/css/orbita.css` (`:root`) y en la configuración de Tailwind de `frontend/index.html`. No se escriben colores sueltos en el marcado: se usan los tokens o las escalas `slate` y `sky` ya ajustadas.

| Token | Valor | Uso |
| --- | --- | --- |
| `--noche` | `#070c1a` | Fondo de la aplicación (espacio profundo) |
| `--superficie` | `#0e1628` | Paneles, menús y diálogos |
| `--trazo` | `#22304d` | Bordes y líneas |
| `--tinta` | `#eaf0fa` | Texto principal |
| `--tinta-suave` | `#9aa8c4` | Texto secundario |
| `--sol` | `#f2a93b` | Azafrán: el tema y la acción principal |
| `--sol-claro` | `#f7c46e` | Estado *hover* del azafrán y foco del teclado |
| `--equilibrio` | `#cdd8ee` | Anillo y medidor de equilibrio |

- **Azafrán con significado.** Solo lo usan el sol, la acción principal de cada pantalla, la vista activa y la mano levantada. No se usa como decoración.
- **Escala `slate`.** Está redefinida con grises teñidos de azul espacio (`950` = `--noche`, `900` = `--superficie`). Cualquier `slate-*` de Tailwind entona con el fondo.
- **Escala `sky`.** Es un azul estelar suave para acentos secundarios (enlaces, etiquetas «Tema 1»). No compite con el azafrán.
- **Rojo.** Solo para errores, estados apagados y la acción de salir («Concluir reunión»).
- **Colores de participantes.** Los elige cada persona al registrarse. No se reutilizan para la interfaz.

## Tipografía

- **Familia única: Atkinson Hyperlegible Next**, diseñada para lectores con baja visión. Se carga desde Google Fonts. Sin conexión, se usa la fuente del sistema.
- **Títulos de pantalla** (`.titulo-pantalla`): peso 300, entre 1,6 y 2,1 rem, interletrado negativo. El titular de la portada (`.portada-titulo`) usa peso 250.
- **Botones y nombres:** peso 700.
- **Tamaño mínimo** de 13 px (`text-xs` está redefinido a 0,8125 rem). No se usan `text-[10px]` ni `text-[11px]`.
- **Sin etiquetas en mayúsculas sostenidas** ni interletrado amplio (`uppercase`, `tracking-wider`). Las únicas excepciones son los campos de código de sala, que convierten a mayúsculas lo que se escribe.
- **Monoespaciada** solo para códigos (`ORB-3772`).

## Botones

Definidos en `orbita.css`. Todos son píldoras (`border-radius: 999px`).

| Clase | Cuándo usarla |
| --- | --- |
| `boton boton-primario` | La acción principal de la pantalla. Una por zona visible. |
| `boton boton-secundario` | Acciones de apoyo: Cancelar, Volver, Compartir, Guardar enlace. |
| `boton boton-icono` | Acciones sin texto visible. Requiere `aria-label` y `title`. |
| `boton boton-peligro` | Salir o cerrar algo para todos («Concluir reunión»). |
| `boton-compacto` | Modificador para acciones dentro de tarjetas o chips. |
| `boton-cuadrado` | Modificador para botones de solo ícono junto a un campo (enviar). |

Reglas:

- El texto del botón dice exactamente qué ocurre («Guardar speech», no «Enviar»).
- **Íconos.** Se usa Lucide (`<i data-lucide="…">`). Cuando el contenido se crea después de cargar, como en las listas con `x-for`, hay que volver a llamar a `lucide.createIcons()` dentro de `$nextTick`.
- **Tamaño táctil.** En pantallas de menos de 1024 px, todo botón mide al menos 44 px de alto.

### Controles de la reunión

- **Selector de vista** (`.selector-vista` + `.opcion-vista`): un solo control con opciones y `aria-pressed`. La opción activa se marca en azafrán. En móvil se convierte en pestañas con ícono y texto corto.
- **Barra de controles de la llamada** (`.controles-reunion` + `.control-llamada`): barra flotante centrada. Cada control muestra un ícono y un texto que cambia con el estado («Silenciado», «Mano levantada»). En pantallas de menos de 640 px, el texto queda solo para lectores de pantalla. `apagado` marca en rojo y `destacado` en azafrán.

## Superficies y formularios

- **Paneles** (`.tarjeta-vidrio`): superficie translúcida con desenfoque y borde `--color-borde`. Las estrellas del fondo se intuyen detrás.
- **Campos de formulario:** esquinas de 0,6 rem. El foco se muestra con un contorno azafrán claro de 2 px. Nunca se quita el contorno de foco sin dar una alternativa visible.
- **Diálogos:** mismos componentes que las pantallas. Se cierran con Escape. La excepción es la invitación del anfitrión, que pide una respuesta explícita.

## Astros: sol y planetas

Módulo compartido `frontend/js/astros.js`, que usan la portada (`portada.js`) y la reunión (`orbits_d3.js`).

- **Sol:** disco más claro en el centro y más oscuro en el borde, granulación fija con `feTurbulence` y una corona amplia. Siempre lleva el rótulo «tema».
- **Planetas:** una capa de luz y sombra que se gira en cada cuadro para que el lado iluminado mire al sol. Tienen una atmósfera tenue del color de la persona. Tu planeta lleva un anillo fino y el rótulo «(tú)».
- **Órbitas:** líneas blancas finas con poca opacidad. El anillo de equilibrio es punteado y más discreto que cualquier órbita.
- **Radio:** `rEq · √(cuota ideal / cuota real)`, la misma regla en la portada y en la reunión.
- **Cambio de órbita:** transferencia suave de 1,8 s con aceleración y frenado. Nunca un salto.
- **Llegada de un participante:** entra como cometa en espiral, en unos 2,6 s, hasta el hueco más amplio entre los planetas que ya están. Los lectores de pantalla anuncian «X se unió a la sala».

## Cielo: galaxias y estrellas

Módulo `frontend/js/cielo.js`. Se activa con `<canvas class="cielo">` y se configura con atributos:

| Lugar | Atributos | Comportamiento |
| --- | --- | --- |
| Portada | `data-cometas="si"` | Banda galáctica, estrellas que titilan, un cometa cada 11 a 20 s |
| Sistema solar de la reunión | `data-intensidad="0.75"` | Galaxia más tenue y sin cometas: en la reunión, el cometa significa que alguien entró |
| Resto de pantallas | `data-intensidad="0.45" data-titileo="no"` | Cielo quieto; se pinta solo al cambiar de tamaño |

## Movimiento y accesibilidad

- **Un solo momento de movimiento por pantalla.** No se añaden entradas animadas a cada tarjeta ni efectos *hover* en todo.
- **«Reducir movimiento» del sistema:** los planetas no giran, los cambios de órbita duran 0,45 s, no hay cometas y el cielo no titila.
- **Modo de baja estimulación** (centro de accesibilidad): además de lo anterior, **desaparecen todas las galaxias** (`body.baja-estimulacion .cielo { display: none }`). El sistema solar sigue visible, sin giro.
- **Alto contraste, texto ampliado y tipografía para dislexia** deben seguir funcionando después de cualquier cambio. Hay que probarlos.
- **Contraste:** el texto secundario debe cumplir WCAG AA (4,5:1) sobre `--superficie`.
- **Elementos interactivos dibujados en SVG** (planetas): `role="button"`, `tabindex="0"`, respuesta a Enter y Espacio, anillo de foco visible y `aria-label` con nombre y porcentaje.

## Textos de la interfaz

- Siguen `.agents/rules/AGENTS.md`: *sentence case*, signos dobles, espacio antes de `%` («100 %»).
- Se escriben desde el punto de vista de quien usa la app. Los mensajes de error dicen qué pasó y cómo resolverlo.
- Una acción conserva su nombre en todo el flujo: el botón de la portada y el del formulario dicen ambos «Iniciar sesión».
- Los datos de ejemplo se identifican como tales («Ejemplo con cuatro participantes»).

## Qué evitar

Estos rasgos hacen que la interfaz parezca genérica:

- Etiquetas en mayúsculas sobre cada bloque, metadatos unidos con «·» o flechas «→» decorativas en cada enlace.
- Tarjetas idénticas con la misma sombra gris y degradados como relleno.
- Nuevos colores de acento fuera de la paleta, o el azafrán usado como adorno.
- Cifras grandes con etiqueta pequeña como recurso por defecto.
- Texto con tono de folleto («plataforma corporativa que optimiza…»).

## Lista de comprobación antes de entregar un cambio visual

1. Revisar la pantalla en escritorio (1280 × 800) y en móvil (375 px), sin desplazamiento horizontal.
2. Activar y desactivar baja estimulación, alto contraste, texto ampliado y tipografía para dislexia.
3. Recorrer los controles con el teclado y comprobar que el foco se ve.
4. Comprobar que la consola no muestra errores nuevos.
5. Si cambia un token o un componente, actualizar esta guía en el mismo cambio.
