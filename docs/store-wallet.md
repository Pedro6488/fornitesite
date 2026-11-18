# Pavos de la tienda

Saldo interno ligado a `auth.users.id`. No es una recarga al saldo de Epic.

## Cliente

En `/cuenta`, pestaña **Mis pavos**, y en `/pavos` se consulta el saldo, se elige una recarga con barra y se adjunta su comprobante. Solo pueden usarse cuentas autenticadas. Las cantidades van de 100 a 50,000, en incrementos de 100.

Al confirmar objetos, se elige pago habitual o pavos; no se aceptan pagos combinados. El costo en pavos es el total de las líneas de la cotización, calculado en el servidor. No se añade comisión PayPal al gasto de saldo.

## Administración

`/admin/pavos` permite configurar el precio por 100 pavos para México y USA, revisar comprobantes de recargas y consultar saldo, total comprado, utilizado, devuelto e historial de pedidos de cada cliente. Las tarifas comienzan deshabilitadas y sin precio. No se puede cobrar una recarga hasta configurar su región.

Las recargas mexicanas muestran transferencia; las de USA muestran PayPal. Aprobar una recarga registra un crédito una sola vez. Rechazarla requiere un motivo y no aumenta el saldo. La acreditación y el movimiento se guardan en la misma transacción.

### Precio con pavos contra pago habitual

Política: 1 pavo de la tienda equivale a 1 pavo del precio de Fortnite. El pago habitual usa tramos por objeto (`price_rules`) y precios especiales (`offer_price_overrides`); los pavos usan la tarifa de recarga. Por eso, según el objeto, uno u otro puede salir más barato:

- **Checkout:** muestra "Con pavos ahorras $Z" cuando conviene y "el pago habitual sale más barato" cuando no, comparando contra la tarifa de recarga actual (`compareWalletPrice`).
- **Precios especiales:** cada excepción puede marcarse **Bloquear pavos** (`wallet_allowed=false`). La cotización lo indica por línea, el checkout lo explica y la base rechaza la compra (`wallet_not_allowed`). En **Admin → Precios** se avisa cuando con pavos un objeto saldría más barato que su precio especial.
- **USA:** la recarga por PayPal no cobra los $2.30 del pedido habitual. El formulario de la tarifa muestra el neto por cada 100 pavos después de la comisión de PayPal (5.4% + $0.30, en `PAYPAL_PERCENT_BP` y `PAYPAL_FIXED_CENTS`), para que la tarifa la cubra.

### Revisar una recarga

Cada recarga tiene una referencia `RECARGA-XXXXXXXX` (`wallet_topups.reference_code`) que el cliente escribe en el concepto de la transferencia o en la nota de PayPal. Antes de aprobar, el admin busca esa referencia y el importe en el banco o en PayPal. La imagen del comprobante no es prueba suficiente: se puede editar, y el checksum solo detecta archivos idénticos.

### Congelar cuentas y ajustar saldos

En el detalle del cliente (`/admin/pavos`):

- **Congelar cuenta** (`set_wallet_frozen`): bloquea las compras con pavos y conserva el saldo. Pide un motivo. Se usa ante un contracargo, una disputa de PayPal o la sospecha de una cuenta robada. El cliente ve que su saldo está en revisión y el checkout desactiva el pago con pavos. La base también rechaza la compra (`account_frozen`).
- **Ajustar saldo** (`adjust_wallet`): agrega o quita pavos con motivo obligatorio. Queda en el ledger como `adjustment`, con el admin que lo hizo, y en `audit_log`. El saldo nunca queda en negativo: si el cliente ya gastó los pavos, se congela la cuenta en lugar de dejar deuda.

## Entregas y devoluciones

La compra con saldo bloquea la cuenta, valida la propiedad de la sesión, cotización e ID, crea el pedido pagado, descuenta los pavos y encola `wallet.deliver` dentro de una sola transacción PostgreSQL. Un reintento con la misma clave no vuelve a cobrar.

El envío empieza inmediatamente sin aprobación de admin. Se conserva el identificador de cada objeto para evitar regalos repetidos. Si se interrumpe una ejecución, el trabajo se puede recuperar después de cinco minutos. Solo `claim_wallet_job` toma estos trabajos; el worker general los ignora. Tras 8 intentos el trabajo queda `failed` y se avisa al admin por Telegram.

### Falla de la cuenta emisora: devolución al instante y pausa

Los rechazos definitivos, del cliente o de la tienda, devuelven los pavos del objeto al instante. Cuando la falla es de la cuenta emisora o de FN Shop (sin paVos, sin cupo de regalos, sin requests del plan, FN Shop no disponible), además:

1. El pago con pavos se **pausa 30 minutos** (`wallet_settings.paused_until`). La base rechaza compras nuevas (`wallet_paused`), y el checkout y `/pavos` explican que se use el pago habitual.
2. Los objetos de ese pedido que nunca se intentaron se devuelven en ese momento (`refund_wallet_failures(order, true)`), sin esperar una pasada del cron por objeto.
3. Sale un aviso a Telegram. En `/admin/pavos` aparece la pausa con el botón **Reanudar ahora** (`resume_wallet_payments`, solo admin).

Los envíos dudosos (timeout, resultado desconocido) nunca se devuelven solos: se concilian.

### Avisos al cliente por WhatsApp

La tienda no tiene correo configurado, así que no se envían correos. Los avisos se muestran en el sitio: el estado de la recarga y los movimientos en `/pavos`, y los objetos devueltos en la página del pedido. Desde ahí el cliente puede escribirle a la tienda por WhatsApp con la referencia ya escrita.

El admin avisa al cliente con botones que abren WhatsApp con el mensaje redactado (`src/features/wallet/domain/wallet-whatsapp.ts`):

- Al aprobar o rechazar una recarga, con la referencia, el saldo o el motivo.
- En el detalle del cliente: entregas, devoluciones y recargas revisadas.
- En una cuenta congelada.

El teléfono sale del último pedido del cliente o, si no tiene, de su sesión (`wallet_customer_totals.whatsapp`). A un número de 10 dígitos se le agrega la lada del país: 52 para México, 1 para USA.

### Resumen del admin

En `/admin/pavos` (`wallet_admin_summary`) se ven:

- El **pasivo**: la suma de saldos, que son pavos ya cobrados por entregar.
- Lo gastado, acreditado y devuelto hoy (hora de Ciudad de México).
- Las recargas por revisar y las cuentas congeladas.
- Las entregas fallidas o con más de 3 intentos, con enlace a cada pedido.

Una recarga sin comprobante vence a las 48 horas (`expires_at`, estado `expired`). La base rechaza adjuntar un comprobante a una recarga vencida, y el cron de pavos marca las vencidas en cada llamada. Los objetos nunca intentados se reanudan; los resultados inciertos se concilian antes de cualquier nueva acción.

Los rechazos definitivos conocidos se devuelven por objeto una sola vez. Un objeto devuelto queda excluido de los siguientes envíos. Un timeout o la ausencia en el historial no prueban por sí solos que el regalo no se envió: esos casos conservan el saldo debitado y generan aviso operativo para su comprobación. No se marca un reembolso manual desde la ruta genérica de estados.

## Activación por ambiente

1. Aplicar `supabase/migrations/20261117000100_store_wallet.sql` y las migraciones `20261118…` de pavos antes de desplegar el código. Son aditivas: conservan los pedidos externos existentes.
2. Mantener `FULFILLMENT_MODE=fnshop` y un proveedor listo. En QA usar `FNSHOP_SIMULATE=true`; las protecciones existentes evitan llamadas reales fuera de producción.
3. Configurar `CRON_SECRET` y los secrets del workflow `.github/workflows/wallet-cron.yml`, que llama a `/api/internal/wallet` cada cinco minutos (ver «Cola de pavos» en `docs/deployment.md`). Vercel Hobby no admite esa frecuencia, por eso no está en `vercel.json`.
4. Desde Admin → Clientes con pavos, definir las tarifas de MXN y USD y activar únicamente las regiones listas para cobrar.
5. Probar una recarga, aprobación duplicada, compra con saldo, saldo insuficiente y devolución de un rechazo definitivo en QA.

Las tablas de saldo, recargas y movimientos no aceptan acceso directo desde roles `anon` o `authenticated`; las rutas autenticadas usan operaciones de servidor. Los comprobantes se guardan en un bucket privado y el admin recibe enlaces temporales.

## Validación local

`src/features/wallet/server/wallet-transactions.test.ts` aplica todas las migraciones sobre PostgreSQL embebido (PGlite), con Auth y Storage mínimos de prueba. Comprueba acreditación, idempotencia, propiedad, saldo insuficiente, recuperación de trabajos y devoluciones seguras sin tocar Supabase. PGlite es una dependencia exclusiva de desarrollo.
