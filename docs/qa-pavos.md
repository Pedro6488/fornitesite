# Guion de QA: pavos y pedidos habituales

Un cambio solo cuenta como **verificado** cuando alguien ejecutó este guion en QA y llenó la tabla del final. Las pruebas automáticas cubren el código; aquí se comprueba lo que sí ve cada persona: el cliente, el admin y el Telegram del equipo.

Cada paso dice **quién** lo hace y **qué debe pasar**. Si el resultado no es exactamente el esperado, el paso falla aunque "casi funcione". Anota qué viste y no sigas al merge.

## Antes de empezar

- [ ] `npx supabase migration list --remote=qptoblktlqduublkgsjk` muestra las 6 migraciones de pavos (`20261117000100`, `20261118000100` a `500`) en la columna remota.
- [ ] El deploy de QA en Vercel corresponde al último commit del PR (compara el hash).
- [ ] Variables de Vercel QA:
  - `FULFILLMENT_MODE=fnshop`
  - `FNSHOP_SIMULATE=true`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_ADMIN_CHAT_IDS`
  - `CRON_SECRET`
  - `WHATSAPP_BUSINESS_NUMBER`
- [ ] En Admin → Precios de pavos, México está activo con tarifa, costo por 100 y margen mínimo.
- [ ] Tres ventanas abiertas:
  - **Cliente**: una cuenta normal.
  - **Admin**: una cuenta admin, en otro navegador o en incógnito.
  - **Telegram**: el chat del equipo.

El simulador decide el resultado según el ID de Fortnite que escribas: `listo` se entrega, `rechazo` es rechazado por Epic, `sinsaldo` es una cuenta emisora sin paVos y `dudoso` es un envío con resultado incierto. Nunca se llama a fnitem.shop fuera de producción.

Para correr la cola de pavos sin esperar al cron:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<dominio-qa>/api/internal/wallet
```

## A. Recarga de pavos

| # | Quién | Acción | Debe pasar |
|---|---|---|---|
| A1 | Cliente | En la portada, mover la calculadora y tocar "Quiero N pavos". | Abre `/pavos` con esa misma cantidad. |
| A2 | Cliente | Comprar la recarga. | La página sube sola a "Tu avance" y muestra el aviso verde **"Tu recarga RECARGA-… está creada"** con el monto exacto. Debajo está la tarjeta "Paso 2 · Pendiente de pago" con los datos de pago y botones "Copiar" para la CLABE y la referencia. La calculadora queda plegada en "Quiero otra recarga". |
| A3 | Cliente | Subir un comprobante (JPG, PNG o PDF). | Aviso verde **"Recibimos tu comprobante"**: ya no hay nada más que hacer. La tarjeta cambia a "Paso 3 · Comprobante en revisión", con la referencia, y el título a "Estamos revisando tu pago". La calculadora sigue plegada. |
| A4 | Telegram | Esperar menos de un minuto. | Llega **"🧾 Recarga de pavos por liberar · RECARGA-…"** con los pavos, el regalo, el monto, el correo del cliente y el botón "Abrir en el panel". |
| A5 | Admin | Mirar el menú. | "Recargas de pavos" (en Operación) y la franja superior ("recargas") muestran el contador. La recarga aparece primero en `/admin/pavos`, en "Comprobantes por revisar". |
| A6 | Admin | "Confirmar pago y acreditar pavos". | La recarga sale de la lista y el contador baja. El botón de WhatsApp abre un mensaje con la referencia, los pavos, **el regalo** y el saldo correcto. |
| A7 | Cliente | Recargar `/pavos`. | El saldo subió en pavos más regalo y el paso dice "Listo para comprar". |
| A8 | Admin | Repetir A2–A5 con otra recarga y rechazarla con motivo. | El cliente ve "Recarga rechazada" y el motivo. El WhatsApp del rechazo lleva el motivo. |

## B. Compra con pavos

| # | Quién | Acción | Debe pasar |
|---|---|---|---|
| B0a | Cliente | Mirar el encabezado con sesión iniciada. | Junto al carrito aparece el saldo (por ejemplo "13,500 pavos") y lleva a `/pavos`. El menú de la cuenta dice "Mis pavos · 13,500 disponibles". |
| B0b | Cliente | Agregar objetos y abrir el carrito. | Bajo el total aparece "O págalo con tus pavos" con Tienes / Carrito / Te quedan y la barra. |
| B0c | Cliente | En el checkout, confirmar el precio. | Si el saldo alcanza, "Mis pavos de la tienda" viene marcado y dice "Se descuentan N pavos de tus M". La transferencia dice "Pagas $X". Debajo están Tienes / Este pedido / Te quedan, y el botón final dice "Te quedan N pavos". |
| B0d | Cliente | Repetir con un carrito más caro que el saldo. | Viene marcada la transferencia. La tarjeta de pavos dice "Te faltan N pavos" y, al elegirla, aparece "Recargar N pavos", que abre `/pavos` con esa cantidad. |
| B1 | Cliente | Comprar un objeto con "Mis pavos de la tienda" al ID `listo`. | El saldo baja al instante, también el del encabezado, y el pedido queda pagado sin pedir comprobante. Telegram recibe "🛒 Nuevo pedido … pavos de la tienda". |
| B2 | Quien prueba | Abrir el pedido. La entrega se intenta en el momento de la compra; si sigue "En cola", correr la cola (curl de arriba). | El pedido pasa a entregado. El admin, en el detalle del cliente, ve "Avisar entrega por WhatsApp". |
| B3 | Cliente | Comprar al ID `rechazo`. | Los pavos del objeto vuelven al saldo. El pedido muestra "Pavos devueltos". |
| B4 | Cliente | Comprar al ID `sinsaldo`. | Devolución inmediata. Telegram recibe "⏸️ Pausé el pago con pavos". El checkout ya no deja pagar con pavos y `/admin/pavos` muestra "Reanudar ahora". |
| B5 | Admin | En Clientes con pavos, abrir al cliente y congelar su cuenta con motivo. | El cliente ve "Tu saldo está en revisión" y el checkout no deja pagar con pavos. |
| B6 | Admin | Ajustar el saldo −100 con motivo y después descongelar. | El movimiento aparece con su motivo. Un ajuste mayor que el saldo se rechaza. |

## C. Regresión: pedido habitual (regalos sin pavos)

Este PR tocó el checkout, la cola general de trabajos y los estados del pedido. El flujo habitual tiene que seguir igual.

| # | Quién | Acción | Debe pasar |
|---|---|---|---|
| C1 | Invitado | Agregar un objeto y llegar al checkout. | Se ve el pago habitual y la invitación a los pavos. No hay errores. |
| C2 | Cliente | Pedido habitual por transferencia al ID `listo`. | Telegram recibe "🛒 Nuevo pedido". |
| C3 | Cliente | Subir el comprobante del pedido. | Telegram recibe "🧾 Comprobante recibido". En Pedidos aparece en "comprobantes por revisar". |
| C4 | Admin | Aprobar el pago. | La entrega simulada se hace y el pedido queda entregado, igual que antes del PR. |

## D. Móvil

| # | Acción | Debe pasar |
|---|---|---|
| D1 | Repetir A1–A3 en un teléfono, o con 390 px de ancho. | La calculadora, el formulario del comprobante y los botones se usan sin desplazamiento horizontal. |

## Resultado

| Ambiente | Commit desplegado | Probó | Fecha | Pasos que fallaron | Evidencia |
|---|---|---|---|---|---|
| QA | | | | | Capturas o video de A4, A6, B2, B4 y C3 |

Si algún paso falla:
1. Se corrige.
2. Se agrega una prueba automática que habría fallado.
3. Se vuelve a correr el guion completo.
