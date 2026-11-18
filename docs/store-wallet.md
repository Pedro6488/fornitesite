# Pavos de la tienda

Saldo interno ligado a `auth.users.id`. No es una recarga al saldo de Epic.

## Cliente

En `/cuenta`, pestaña **Mis pavos**, y en `/pavos` se consulta el saldo, se elige una recarga con barra y se adjunta su comprobante. Solo pueden usarse cuentas autenticadas. Las cantidades van de 100 a 50,000, en incrementos de 100.

Al confirmar objetos, se elige pago habitual o pavos; no se aceptan pagos combinados. El costo en pavos es el total de las líneas de la cotización, calculado en el servidor. No se añade comisión PayPal al gasto de saldo.

## Administración

`/admin/pavos` permite configurar el precio por 100 pavos para México y USA, revisar comprobantes de recargas y consultar saldo, total comprado, utilizado, devuelto e historial de pedidos de cada cliente. Las tarifas comienzan deshabilitadas y sin precio. No se puede cobrar una recarga hasta configurar su región.

Las recargas mexicanas muestran transferencia; las de USA muestran PayPal. Aprobar una recarga registra un crédito una sola vez. Rechazarla requiere un motivo y no aumenta el saldo. La acreditación y el movimiento se guardan en la misma transacción.

## Entregas y devoluciones

La compra con saldo bloquea la cuenta, valida la propiedad de la sesión, cotización e ID, crea el pedido pagado, descuenta los pavos y encola `wallet.deliver` dentro de una sola transacción PostgreSQL. Un reintento con la misma clave no vuelve a cobrar.

El envío empieza inmediatamente sin aprobación de admin. Se conserva el identificador de cada objeto para evitar regalos repetidos. Si se interrumpe una ejecución, el trabajo se puede recuperar después de cinco minutos. Los objetos nunca intentados se reanudan; los resultados inciertos se concilian antes de cualquier nueva acción.

Los rechazos definitivos conocidos se devuelven por objeto una sola vez. Un objeto devuelto queda excluido de los siguientes envíos. Un timeout o la ausencia en el historial no prueban por sí solos que el regalo no se envió: esos casos conservan el saldo debitado y generan aviso operativo para su comprobación. No se marca un reembolso manual desde la ruta genérica de estados.

## Activación por ambiente

1. Aplicar `supabase/migrations/20261117000100_store_wallet.sql` antes de desplegar el código. Es aditiva: conserva los pedidos externos existentes.
2. Mantener `FULFILLMENT_MODE=fnshop` y un proveedor listo. En QA usar `FNSHOP_SIMULATE=true`; las protecciones existentes evitan llamadas reales fuera de producción.
3. Configurar `CRON_SECRET` y ejecutar `/api/internal/wallet` cada cinco minutos con `Authorization: Bearer <CRON_SECRET>`. `vercel.json` declara ese trabajo; el alojamiento debe admitir dicha frecuencia. Si no la admite, configurar un programador externo equivalente antes de habilitar compras con saldo.
4. Desde Admin → Clientes con pavos, definir las tarifas de MXN y USD y activar únicamente las regiones listas para cobrar.
5. Probar una recarga, aprobación duplicada, compra con saldo, saldo insuficiente y devolución de un rechazo definitivo en QA.

Las tablas de saldo, recargas y movimientos no aceptan acceso directo desde roles `anon` o `authenticated`; las rutas autenticadas usan operaciones de servidor. Los comprobantes se guardan en un bucket privado y el admin recibe enlaces temporales.

## Validación local

`src/features/wallet/server/wallet-transactions.test.ts` aplica todas las migraciones sobre PostgreSQL embebido (PGlite), con Auth y Storage mínimos de prueba. Comprueba acreditación, idempotencia, propiedad, saldo insuficiente, recuperación de trabajos y devoluciones seguras sin tocar Supabase. PGlite es una dependencia exclusiva de desarrollo.
