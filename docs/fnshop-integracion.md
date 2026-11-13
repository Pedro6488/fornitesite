# Integración con FN Shop

Entrega automática de regalos de Fortnite con la API de FN Shop
(`https://fnitem.shop/api/v3/service/{acción}`). Plan Basic: 5,000 requests por
periodo. El periodo actual empezó el 2026-11-12 y vence el 2026-12-12.

## Reglas que no se rompen

1. **Solo producción llama a FN Shop.** La key se liga al dominio en su primer
   uso. `FnShopClient` solo hace llamadas reales con `VERCEL_ENV=production`;
   en local, CI y QA responde el simulador (`FNSHOP_SIMULATE=true`).
2. **Un solo lugar habla con la API:** `src/shared/infrastructure/fnshop/fnshop-client.ts`.
   POST form-encoded con `X-Api-Key`; el éxito se lee en `result` y `code`.
3. **Toda llamada queda en la bitácora** (`provider_api_calls`), sin la key.
   La tabla no se puede editar ni borrar; solo se fija `decision` una vez.
4. **Un envío dudoso nunca se reintenta solo.** `gift_outcome_unknown`, un
   timeout o una respuesta ilegible dejan el objeto `unknown` y el pedido en
   «Conciliando». Se resuelve con `order_history` («Conciliar»).
5. **Un objeto no se envía dos veces.** Su fila en `fulfillments` se aparta en
   `sending` antes de llamar a `gift_send`. Si ya está en sending, unknown o
   sent, se salta.

## Flujo y costo

| Paso | Quién | Llamada | Requests |
|---|---|---|---|
| Ver catálogo, objeto, carrito | Cliente | Ninguna (Fortnite-API) | 0 |
| Guardar un ID ya conocido | Cliente | Ninguna (hereda su estado) | 0 |
| Guardar un ID nuevo | Cliente | `friend_add` (valida y envía la solicitud) | 1 |
| «Ya acepté la solicitud» | Cliente | `friend_status` (máx. 3, cada 30 min) | 1 |
| Espera de 48 h, cotizar, crear pedido | — | Ninguna | 0 |
| Pre-vuelo al abrir «Enviar» | Admin | `gift_check` por objeto | 1 por objeto |
| «Enviar ahora» | Admin | `gift_send` por objeto | 1 por objeto |
| «Conciliar» | Admin | `order_history` por objeto dudoso | 1 |
| offerId vencido en el pre-vuelo | Admin | `shop` + `gift_check` | 2 |
| «Verificar key» | Admin | `verify_license` | 0 (nunca cuenta) |

Consumo estimado al volumen actual: ≈ 560 requests al mes (11 %).
Fórmula: `IDs nuevos × 2 + objetos × 2 + ~3 %`.

### Control de cuota

`fnshop-budget.ts` decide antes de cada llamada, con lo registrado en la bitácora
desde `FNSHOP_TERM_STARTS_AT`:

| Uso | Efecto |
|---|---|
| 70 % | Aviso a Telegram |
| 85 % | Los IDs nuevos pasan a revisión manual (`friend_add` bloqueado) |
| 95 % o tope diario (`FNSHOP_DAILY_LIMIT`) | Solo `gift_check`, `gift_send` y `order_history` |
| 100 % | Nada salvo `verify_license` |

## Estados

**ID de entrega** (`game_id_validations.status`): `pending_friendship` (solicitud
enviada, falta que el cliente acepte) → `waiting` (48 h desde que aceptó;
`giftable_at` es la hora exacta) → `ready`. Si FN Shop no está disponible o la
respuesta no es clara: `manual_review` (flujo de siempre). Si la cuenta no existe
o no acepta solicitudes, el cliente ve el motivo y el ID no se guarda.

**Objeto** (`fulfillments.status`): `sending` → `sent` · `unknown` (conciliar) ·
`failed` (rechazado; se puede reintentar).

**Pedido**: `paid → ready_to_send → validating_delivery → delivering →` `delivered`
(todo enviado) · `reconciling` (algún dudoso) · `manual_review` (algún rechazo).
Desde `manual_review`: «Reintentar envío» (envía solo lo que falta), «Marcar como
entregado a mano» o «Iniciar reembolso».

## Qué hace el admin en la consola

- **Por confirmar pago:** «Confirmar pago y enviar regalo». El diálogo hace el
  pre-vuelo y muestra por objeto si se puede enviar, la cuenta remitente y el
  motivo si no. El botón final dice «Enviar ahora — no se puede deshacer» y
  cuántos requests usa. «Solo confirmar pago» queda en «Otras acciones».
- **Con problema:** «Conciliar» para dudosos; «Reintentar envío» para rechazos.
- **`/admin/fnshop`:** cuota, ritmo y días restantes, requests por día y por
  tipo, últimas 100 llamadas, respuestas vistas y exportación JSON/CSV.
- La franja superior muestra la cuota usada.

## Probar en QA (0 requests)

Variables en Vercel → Preview: `FULFILLMENT_MODE=fnshop`, `FNSHOP_SIMULATE=true`,
sin `FNSHOP_API_KEY`. El simulador responde según el gamertag que escribas:

| Gamertag contiene | Resultado |
|---|---|
| (cualquier otro) | Solicitud enviada → «Ya acepté» → espera de 48 h |
| `listo` | Ya es amigo: ID listo para comprar |
| `espera` | Ya es amigo pero faltan 30 h |
| `noexiste` | «No encontramos esa cuenta» |
| `privado` | «Tu cuenta no acepta solicitudes» |
| `dudoso` | El envío queda sin confirmar → «Conciliar» lo encuentra |
| `rechazo` | Epic rechaza la compra → revisión manual |
| `sinsaldo` | Sin paVos → aviso a Telegram y no se envía nada |

Para probar la compra completa sin esperar 48 h usa un gamertag con `listo`.

## Salida a producción (tope: 20 requests)

| # | Prueba | Requests |
|---|---|---|
| 1 | Migraciones `20261113000100`–`400` en producción, con `FULFILLMENT_MODE=manual` | 0 |
| 2 | `FNSHOP_API_KEY` y `FNSHOP_TERM_STARTS_AT` en Vercel → Production; «Verificar key» en `/admin/fnshop` | 0 |
| 3 | `FULFILLMENT_MODE=fnshop`. Guardar un ID propio nuevo (`friend_add`) y aceptar en Fortnite | 1 |
| 4 | «Ya acepté» (`friend_status`) | 1 |
| 5 | 48 h después: pedido con el objeto más barato → pre-vuelo y envío; verificar en Fortnite | 2 |
| 6 | Un pedido de un cliente ya aprobado a mano (entrega por nombre) | 2 |
| 7 | Revisar en `/admin/fnshop` que las respuestas reales coinciden con lo esperado | 0 |

Si una respuesta real difiere de lo esperado, se corrige la lectura en
`fnshop-identity.ts` o `gift-results.ts` y su prueba.

## Bitácora de aprendizaje

Cada llamada guarda petición, respuesta completa, code, duración y la decisión
de nuestro código. Siete vistas la analizan sin tablas derivadas:
`fnshop_contract_catalog`, `fnshop_friendship_timeline`, `fnshop_sender_activity`,
`fnshop_offer_checks`, `fnshop_delivery_outcomes`, `fnshop_latency`,
`fnshop_usage_daily`. Con `FNSHOP_LEARNING_SNAPSHOTS=true` el cron diario agrega
`groups_status` y `shop` cada día y `order_history` cada lunes (~64 al mes).

La bitácora enseña qué hace FN Shop visto desde afuera (contrato, tiempos,
rechazos, reglas de Epic). No enseña cómo habla FN Shop con Epic por dentro.

## Archivos

| Archivo | Qué hace |
|---|---|
| `shared/infrastructure/fnshop/fnshop-client.ts` | Cliente único, bitácora, candado de producción |
| `shared/infrastructure/fnshop/fnshop-budget.ts` | Control de cuota |
| `shared/infrastructure/fnshop/fnshop-simulator.ts` | Respuestas simuladas |
| `features/fnshop/server/get-fnshop-client.ts` | Cliente listo y avisos a Telegram |
| `features/commerce/application/fnshop-identity.ts` | Lectura de `friend_add` y `friend_status` |
| `app/api/identity/validate`, `app/api/identity/confirm-friendship` | ID nuevo y «Ya acepté» |
| `features/fulfillment/application/deliver-order.ts` | Pre-vuelo, envío por objeto y conciliación |
| `features/fulfillment/application/gift-results.ts` | Lectura de `gift_check` y `gift_send` |
| `app/api/admin/orders/[orderId]/preflight`, `deliver`, `reconcile` | Rutas de staff |
| `features/admin/components/send-gift-dialog.tsx`, `fnshop-panel.tsx` | Consola |
| `supabase/migrations/20261113000100`–`400` | Bitácora, identidad, entrega por objeto, vistas |
