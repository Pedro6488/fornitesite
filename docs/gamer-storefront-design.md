# SigfriedLootBox — identidad gamer y navegación

Rama local: `feat/gamer-storefront-design`.

## Dirección

Identidad propia: grafito, lima eléctrica y violeta; tipografía condensada Barlow Condensed, arte de los juegos y una portada asimétrica. La referencia inicial de Tlaco se sustituyó por esta dirección gamer a petición del usuario.

Los botones tienen silueta redondeada, estados de foco visibles y respuesta al pulsar. Las tarjetas muestran qué se vende y llevan directamente a cada catálogo. Los precios iniciales de recargas se calculan desde los paquetes existentes. No hay descuentos, urgencias, reseñas ni estadísticas inventados.

## Recorrido

- Accesos a los tres juegos al principio de la pantalla móvil.
- Acceso principal a Fortnite o al último juego visitado, sin redirección automática.
- Navegación entre juegos en un paso; selección activa visible.
- Carrito, checkout, comunidad, cuenta, pedidos y administración usan el mismo escenario en una franja (`GamePageHero` con `slim`) y las piezas de `src/app/site-system.css`: productos en tarjeta con arte y color de rareza; información y formularios en panel con esquina cortada y filo lima.
- Inicio y Fortnite comparten un escenario de videojuego (`game-stage`): selector inclinado, brillo por juego o rareza y rotación que se detiene al elegir una opción, al pasar el cursor o con movimiento reducido. Fortnite muestra objetos reales de la tienda con su precio. El enlace principal de inicio lleva al catálogo.
- Free Fire y Roblox explican que la solicitud continúa en WhatsApp. El carrito se identifica como Fortnite.
- El selector México/USA solo aparece en los recorridos de Fortnite que utilizan precios regionales.
- Se conservan los proveedores y las validaciones comerciales. No se modifica el proceso de pago ni se envían mensajes durante las pruebas.

## Movimiento

Se utiliza `ViewTransition` de React 19.3, disponible en la instalación actual, junto con `transitionTypes` de Next. Cada página tiene su propia frontera de transición; el layout persistente queda fuera.

- Entrada a catálogo o paquete: desplazamiento leve de 22 px, 260 ms.
- Salida: 18 px, 170 ms.
- Regreso mediante “Todos los juegos”: dirección inversa.
- Cambio entre juegos: fundido de 160–210 ms.
- Historial del navegador sin tipo explícito: fundido, sin inventar una dirección.
- Primera entrada a la portada: aparición breve, sin retrasar la interacción.
- Enlaces pendientes: señal visual y estado anunciado con `useLinkStatus`.
- Catálogo de Fortnite y detalle de objeto en carga: pantalla completa de espera, sin precios o productos ficticios.

La aplicación no llama manualmente a `document.startViewTransition`. React coordina el ciclo. En navegadores sin soporte se mantiene la navegación normal. `prefers-reduced-motion: reduce` desactiva desplazamientos, entrada animada, pulsación con escala y animaciones de transición. El overlay de transición deja pasar eventos de puntero.

## Implementación

CSS Modules para la identidad y los componentes; un archivo global pequeño para los pseudo-elementos de View Transitions. Tailwind no fue necesario y no se añadieron dependencias de animación.

La fuente se sirve localmente; licencia OFL incluida en `public/fonts/barlow-condensed/OFL.txt`. Origen: https://github.com/google/fonts/tree/main/ofl/barlowcondensed. Se reutiliza el arte que ya existía en `public/games`.

La comprobación visual se realiza en una copia local temporal para evitar colisiones con el servidor de Windows. Los cambios temporales de `next.config.ts` y `tsconfig.json` se restauraron antes del commit.

## Referencias técnicas

- Guía de la versión instalada: `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`.
- API de React: https://react.dev/reference/react/ViewTransition.
- API de Next Link: https://nextjs.org/docs/app/api-reference/components/link#transitiontypes.

El efecto en conversión debe medirse con clientes; el diseño por sí solo no demuestra un aumento de ventas.

## Verificación realizada

- Build de producción con webpack: correcto, 43 páginas generadas; comprobación TypeScript incluida.
- Suite completa: 30 archivos, 126 pruebas correctas.
- ESLint de los archivos TypeScript modificados: correcto.
- Chromium: transiciones nativas observadas con sus tipos y animaciones de entrada, regreso y cambio de juego. La cabecera queda fuera del movimiento.
- Movimiento reducido: navegación correcta sin animaciones de View Transition.
- Portada a 320, 390, 768 y 1440 px: sin desbordamiento horizontal ni imágenes rotas.
- Fortnite a 390 px: inicio del catálogo aproximadamente a 553 px; selector regional visible. Free Fire y Roblox no muestran ese selector.
- Recuerdo del último juego comprobado; pruebas cubren almacenamiento bloqueado y valores desconocidos.
- Capturas y grabación locales en `output/playwright/gamer-design/`. La grabación `navigation-final.webm` muestra el cambio de juego y el regreso a inicio.

Las comprobaciones de animación se realizaron en Chromium; no sustituyen una revisión en Safari, Firefox y dispositivos físicos.
