# Cambios completos de SigfriedLootBox

Fecha: 17 de noviembre de 2026.

Este documento reúne los cambios realizados durante esta conversación, su funcionamiento, las validaciones efectuadas y los pasos que faltan para activar el sistema de pavos.

## 1. Estado de la entrega

- Los cambios anteriores de referencias, contacto, pagos por región y navegación se publicaron en `qa_release`, en el commit `a5d2ee8`.
- La implementación de pavos y sus ajustes de integración están en el repositorio local. Todavía no se han publicado.
- La migración nueva del sistema de pavos se preparó y probó localmente. No se ha aplicado a Supabase.
- No se han definido precios comerciales para las recargas. Las tarifas comienzan sin precio y deshabilitadas.
- No se realizaron cobros, recargas ni envíos reales para validar esta implementación.

## 2. Referencias de entregas

### Carga desde el administrador

Se agregó un formulario en **Admin → Referencias** para publicar una captura de confirmación del chat.

El administrador puede:

- Seleccionar un pedido entregado o pegar su identificador.
- Consultar sugerencias de los últimos 500 pedidos entregados.
- Adjuntar una captura JPG, PNG o WEBP de máximo 5 MB.
- Revisar una vista previa antes de publicar.
- Agregar un comentario opcional de hasta 1,000 caracteres.

El servidor comprueba que el pedido exista, esté entregado y todavía no tenga una referencia. Se registra una referencia por pedido, evitando que se cuente dos veces. Si el registro falla después de subir el archivo, se elimina la imagen de esa operación.

### Publicación de referencias

Las referencias utilizan la misma fuente de datos en:

- El carrusel del inicio.
- La página `/referencias`.
- El listado del administrador.

El carrusel tiene navegación anterior y siguiente, reproducción automática y un control para pausar o reanudar. Respeta la preferencia de movimiento reducido.

La captura se publica como evidencia de entrega. El formulario recuerda ocultar teléfonos y datos personales antes de subirla.

## 3. Contacto guardado

### Teléfono

- Se recupera el teléfono guardado en la sesión comercial y se autocompleta al confirmar la siguiente compra.
- El cliente puede modificarlo.
- El campo acepta únicamente números, con un máximo de 12 dígitos.
- Se mantiene la validación mínima de 8 dígitos.
- El servidor valida el mismo límite; no depende solo del campo del navegador.
- Al fusionar sesiones del usuario se conserva un teléfono guardado cuando la sesión principal todavía no tiene uno.
- Los valores editados en el formulario no se reutilizan al cambiar de sesión.

### Correo electrónico

- Se autocompleta en el carrito y en la confirmación de la compra.
- Se recupera del contacto o pedido más reciente disponible para el usuario o su sesión.
- No necesita estar verificado para volver a mostrarse en el formulario.
- El cliente puede editarlo.
- En el carrito se guarda al continuar, aunque no se activen recordatorios.
- Guardar el correo no equivale a aceptar comunicaciones: los recordatorios conservan su casilla de consentimiento.

## 4. Métodos de pago por región

### México

El pago habitual utiliza transferencia bancaria. Se muestran los datos de banco, beneficiario, CLABE y concepto. PayPal deja de aparecer en el bloque de pago de estos pedidos.

### USA

El pago habitual utiliza únicamente PayPal. No se muestran los datos de transferencia bancaria. El estado pendiente de pago identifica PayPal.

La página del pedido utiliza la moneda guardada al crearlo. Cambiar la región durante el checkout invalida la cotización activa que corresponda a la otra región.

## 5. Mensaje después de recibir el comprobante

Debajo de **Comprobante recibido**, y durante la revisión de transferencia, se muestra:

> Tu pago está en revisión. Una vez que se vea reflejado, enviaremos tu pedido en un plazo de 1 a 10 minutos. Gracias por tu paciencia.

El mensaje permanece asociado al estado del pedido, por lo que no depende únicamente del aviso temporal que aparece al subir el archivo.

## 6. Tienda enfocada en Fortnite

- Se retiraron los accesos a Free Fire y Roblox de la presentación principal del inicio y de su carrusel.
- El inicio utiliza objetos del catálogo de Fortnite para su presentación.
- Se ajustaron los textos del inicio, las preguntas frecuentes, los metadatos, el encabezado y el pie de página para enfocarse en Fortnite.
- La barra de navegación de juegos muestra únicamente Fortnite.
- El enlace **Todos los juegos** se cambió por **Inicio**, con destino `/`.

Las rutas históricas de Free Fire y Roblox siguen existiendo en el código. Ocultar sus accesos no elimina esas páginas ni sus datos.

## 7. Sistema de pavos de la tienda

### Qué representan

Los pavos son saldo interno asociado a la cuenta autenticada del cliente. Se utilizan para comprar objetos dentro de SigfriedLootBox. No se acreditan como saldo de pavos en la cuenta de Epic.

El saldo pertenece al usuario identificado por `auth.users.id`; no se confía en un saldo enviado por el navegador ni guardado en almacenamiento local.

### Acceso del cliente

Se agregaron:

- La pestaña **Mis pavos** dentro de `/cuenta`.
- La página `/pavos`.
- Un acceso **Mis pavos · comprar saldo** en el menú de usuarios con sesión iniciada.
- El selector de región en las páginas de cuenta y pavos.

Si una persona no tiene sesión iniciada, la página le ofrece iniciar sesión para consultar o comprar saldo.

## 8. Compra de pavos

### Selector de cantidad

La pantalla muestra:

- Saldo disponible.
- Una barra deslizable para elegir cuántos pavos comprar.
- Cantidades de 100 a 50,000 pavos, en incrementos de 100.
- Accesos rápidos a 1,000, 3,500, 5,000 y 13,500 pavos.
- Precio total de la recarga.
- Saldo estimado que tendrá el cliente después de acreditar el pago.

La cantidad inicial seleccionada es 3,500 pavos. Estas cantidades son parámetros de la interfaz y no constituyen precios comerciales.

### Tarifas

El administrador puede configurar un precio por cada 100 pavos para:

- México, en MXN.
- USA, en USD.

Cada región puede habilitarse o deshabilitarse por separado. Mientras no exista una tarifa activa, la interfaz muestra **Precio por definir** y bloquea la creación de recargas.

El servidor vuelve a calcular el precio. Si la tarifa cambió respecto a lo que vio el cliente, la solicitud se rechaza para que revise el importe actualizado. Las recargas ya creadas conservan su precio registrado.

### Pago y acreditación

1. El cliente crea la solicitud de recarga con su cantidad y región.
2. El sistema registra el importe que debe pagar.
3. México muestra transferencia bancaria; USA muestra PayPal.
4. El cliente adjunta un comprobante JPG, PNG o PDF de máximo 5 MB.
5. La recarga queda como **Comprobante en revisión**.
6. El administrador comprueba el pago.
7. Al aprobarlo, el sistema acredita los pavos y registra el movimiento en una sola transacción.

Aprobar nuevamente la misma recarga no acredita saldo adicional. Rechazarla requiere un motivo y no aumenta el saldo. Un comprobante idéntico no puede registrarse en otra recarga.

### Estados de una recarga

- **Pendiente de pago:** se creó y todavía no tiene comprobante.
- **Comprobante en revisión:** espera la revisión del administrador.
- **Pavos acreditados:** el pago se confirmó y el saldo se agregó.
- **Recarga rechazada:** no se acreditó; se muestra el motivo registrado.

## 9. Compra de objetos con pavos

Al confirmar un pedido, el cliente autenticado elige una opción:

- Pago habitual: transferencia en México o PayPal en USA.
- Pago con sus pavos disponibles.

No se permiten pagos combinados. El cliente paga todo el pedido con saldo o todo el pedido mediante el método habitual.

### Saldo suficiente

Ejemplo:

- Saldo inicial: 3,500 pavos.
- Costo del pedido: 1,500 pavos.
- Saldo después de comprar: 2,000 pavos.

El sistema valida la sesión, el usuario, el ID receptor, la cotización y la disponibilidad actual de los objetos. El costo en pavos se obtiene de las líneas guardadas de la cotización.

Después, en una sola transacción PostgreSQL:

1. Bloquea la cuenta de saldo para evitar gastos simultáneos sobre los mismos pavos.
2. Comprueba que alcance para el pedido completo.
3. Crea el pedido como pagado.
4. Descuenta los pavos.
5. Registra el movimiento de compra.
6. Crea el trabajo de entrega automática.

Una misma clave de compra no vuelve a descontar saldo. El pago con pavos no agrega comisión PayPal al gasto de saldo.

### Saldo insuficiente

- El botón de pago con pavos queda bloqueado.
- Se informa que el saldo no cubre el pedido completo.
- Se ofrece recargar o elegir el método habitual.
- El servidor también rechaza la operación si no alcanza el saldo.
- No se crea el pedido con saldo, no se descuenta nada y no se inicia el envío.
- La cuenta tiene una restricción de base de datos que impide saldo negativo.

## 10. Envío automático

Las compras pagadas con pavos no necesitan que el administrador apruebe el pago ni autorice el envío. El sistema intenta iniciar la entrega inmediatamente después de registrar la compra.

Se reutiliza la integración de FN Shop y se conserva el identificador de cada objeto para evitar regalos duplicados.

Si el proveedor automático está deshabilitado o no está disponible al intentar crear la compra, el servidor no descuenta saldo. El cliente puede elegir el pago habitual.

Si el pedido ya se pagó y después aparece un problema de entrega, se conserva su seguimiento mediante la cola y los registros por objeto.

### Recuperación de trabajos

- La entrega queda registrada como un trabajo `wallet.deliver` en la base de datos.
- Un solo worker puede reclamar un trabajo vigente.
- Un trabajo interrumpido puede recuperarse después de cinco minutos.
- Los objetos todavía no intentados pueden reanudarse.
- Los objetos enviados o con un intento incierto no se vuelven a enviar automáticamente.
- Los fallos de un aviso de Telegram no convierten una compra ya registrada en un error de creación del pedido.

## 11. Devoluciones de pavos

Los rechazos definitivos conocidos de la integración pueden devolver los pavos correspondientes a cada objeto no enviado.

La devolución:

- Se registra una sola vez por objeto.
- Aumenta el saldo del mismo cliente.
- Genera un movimiento de devolución.
- Marca el objeto como devuelto para impedir su reenvío.
- Permite resolver pedidos con algunos objetos enviados y otros devueltos.

Un timeout, un resultado desconocido o la ausencia de un regalo en el historial no bastan para asegurar que no se entregó. Esos casos no provocan una devolución automática: se comprueba el resultado y se genera un aviso operativo cuando requieren atención.

La ruta genérica de cambios de estado del admin bloquea convertir estos pedidos en pedidos de transferencia, cancelarlos o marcarlos como reembolsados sin el proceso correspondiente a sus objetos.

## 12. Apartado del administrador: Clientes con pavos

La nueva pantalla está en `/admin/pavos`.

### Tarifas

- Precio por 100 pavos en MXN y USD.
- Activación independiente de cada región.
- Registro de los cambios de configuración en auditoría.

### Comprobantes pendientes

- Cliente asociado a la recarga.
- Cantidad de pavos solicitados.
- Importe y moneda que debe haberse recibido.
- Acceso temporal al comprobante privado.
- Nota de revisión.
- Botón para confirmar el pago y acreditar los pavos.
- Botón para rechazar la recarga con un motivo.

### Saldos de clientes

- Identificación del cliente.
- Total de pavos comprados.
- Total de pavos utilizados.
- Total de pavos devueltos.
- Saldo disponible.
- Búsqueda entre los últimos 500 clientes mostrados.

Los totales provienen de todos los movimientos registrados, no únicamente de las filas visibles del historial.

### Detalle del cliente

- Recargas y sus estados.
- Movimientos de entrada y salida.
- Pedidos pagados con pavos.
- ID de Fortnite al que se dirige la entrega.
- Objetos comprados y costo en pavos.
- Objetos cuyos pavos se devolvieron.
- Estado general del envío y errores registrados.
- Enlace al detalle completo de cada pedido.

El detalle muestra los últimos 200 registros de cada tipo. El perfil del cliente muestra sus últimas 100 recargas y 100 movimientos.

## 13. Integración con pedidos existentes

- Se añadió `payment_source` para distinguir un pago habitual de un pago con saldo.
- Los pedidos anteriores permanecen como `external`.
- Los pedidos pagados con pavos guardan `wallet_vbucks`.
- El resumen del pedido muestra el importe en pavos y explica que la entrega es automática.
- Los pedidos pagados con saldo no muestran un formulario para subir otro comprobante.
- Los objetos devueltos se identifican como **Pavos devueltos**.
- Los importes del admin distinguen pavos de dinero.
- Los tickets de compra muestran pavos cuando ese fue el medio utilizado.
- Los avisos de nuevos pedidos al admin identifican las compras con pavos y el envío automático.

El proceso habitual de transferencia o PayPal sigue disponible y conserva su revisión de pago.

## 14. Base de datos nueva

Archivo de migración:

```text
supabase/migrations/20261117000100_store_wallet.sql
```

### Tablas

- `wallet_accounts`: saldo de cada usuario.
- `wallet_rates`: tarifas por región.
- `wallet_topups`: solicitudes de recarga y revisión de comprobantes.
- `wallet_ledger`: movimientos de recarga, compra y devolución.

### Vista

- `wallet_customer_totals`: saldo y totales acumulados para el administrador.

### Columnas agregadas

- `orders.payment_source`.
- `orders.wallet_vbucks`.
- `order_items.wallet_refunded`.

### Funciones transaccionales

- `create_wallet_topup`: crea una recarga con tarifa y precio verificados.
- `review_wallet_topup`: aprueba o rechaza una recarga y evita acreditaciones duplicadas.
- `create_wallet_order`: descuenta saldo, crea el pedido y encola su entrega.
- `refund_wallet_failures`: devuelve saldo de rechazos definitivos por objeto.
- `claim_wallet_job`: reclama o recupera un trabajo de entrega.
- `claim_wallet_delivery_item`: reclama un objeto antes de enviarlo y comprueba que no esté devuelto.

### Almacenamiento y permisos

- Bucket privado `wallet-receipts` para comprobantes.
- Enlaces temporales para que el administrador abra los archivos.
- Las tablas y funciones de movimientos no aceptan operaciones directas de los roles `anon` o `authenticated`.
- Las rutas de servidor verifican al usuario o al administrador antes de operar.
- El servidor utiliza funciones restringidas al rol de servicio para modificar los saldos.

## 15. Rutas agregadas

### Páginas

```text
/pavos
/admin/pavos
```

### API del cliente

```text
GET  /api/wallet
POST /api/wallet/topups
POST /api/wallet/topups/[topupId]/receipt
```

### API del administrador

```text
GET  /api/admin/wallet
GET  /api/admin/wallet?userId=<id-del-cliente>
POST /api/admin/wallet
```

### Trabajo programado

```text
GET /api/internal/wallet
```

Requiere autenticación con `CRON_SECRET`.

## 16. Archivos principales de la implementación de pavos

### Funcionalidad nueva

```text
src/features/wallet/domain/wallet.ts
src/features/wallet/components/use-wallet.ts
src/features/wallet/components/wallet-panel.tsx
src/features/wallet/components/admin-wallet.tsx
src/features/wallet/components/wallet.module.css
src/features/wallet/server/context.ts
src/features/wallet/server/deliver-wallet-order.ts
src/features/wallet/server/wallet-jobs.ts
src/app/pavos/page.tsx
src/app/admin/pavos/page.tsx
src/app/api/wallet/route.ts
src/app/api/wallet/topups/route.ts
src/app/api/wallet/topups/[topupId]/receipt/route.ts
src/app/api/admin/wallet/route.ts
src/app/api/internal/wallet/route.ts
supabase/migrations/20261117000100_store_wallet.sql
```

### Integraciones y ajustes

```text
src/app/api/cart-orders/route.ts
src/app/api/admin/orders/route.ts
src/app/api/admin/orders/[orderId]/route.ts
src/app/api/admin/orders/[orderId]/status/route.ts
src/features/cart/components/cart-checkout-form.tsx
src/features/auth/components/account-access.tsx
src/features/auth/components/account-header-menu.tsx
src/features/admin/application/format.ts
src/features/admin/components/admin-shell.tsx
src/features/admin/components/orders-board.tsx
src/features/admin/components/order-detail.tsx
src/features/fulfillment/application/deliver-order.ts
src/features/fulfillment/infrastructure/supabase-delivery-store.ts
src/features/notifications/server/providers.ts
src/features/orders/domain/order.ts
src/features/orders/infrastructure/supabase-order-repository.ts
src/features/orders/components/order-status.tsx
src/features/orders/components/delivery-ticket-actions.tsx
src/features/storefront/components/storefront-header.tsx
src/app/site-system.css
vercel.json
package.json
package-lock.json
```

También se corrigieron dos errores que detectó ESLint en cambios anteriores: la selección aleatoria de objetos del inicio y el manejo de la vista previa de capturas del admin.

Se agregó `@electric-sql/pglite` exclusivamente como dependencia de desarrollo para probar las transacciones sobre PostgreSQL local.

## 17. Validaciones realizadas

- Suite completa del proyecto aprobada: 47 archivos de pruebas, con 264 pruebas en esa ejecución.
- Pruebas adicionales del checkout y resumen de pedidos aprobadas después de agregar los casos específicos de pago con pavos.
- Revisión de TypeScript aprobada.
- Compilación de producción aprobada.
- ESLint sin errores; permanecen cuatro advertencias sobre imágenes en componentes del admin.
- Comprobación de diferencias sin errores de espacios.

### Pruebas específicas de pavos

Las pruebas locales cubren:

- Aplicación de las migraciones en PostgreSQL embebido.
- Acreditar una recarga una sola vez.
- Rechazar revisiones sin comprobante o sin rol de administrador.
- No aumentar saldo por una recarga rechazada.
- Descontar saldo una sola vez por compra.
- Crear el pedido pagado y su trabajo de entrega dentro de la transacción.
- Rechazar compras con saldo insuficiente sin consumir la cotización.
- Evitar que un segundo pedido gaste saldo utilizado por otro.
- Rechazar el uso de la sesión de otro usuario.
- Rechazar compras para un destinatario que ya no está listo.
- Devolver un rechazo definitivo una sola vez.
- Impedir reenviar un objeto devuelto.
- No devolver saldo automáticamente por resultados inciertos o regalos ya enviados.
- Rechazar recargas sin tarifa o con un precio manipulado.
- Impedir modificaciones directas de saldo desde el rol autenticado.
- Reclamar trabajos una sola vez y recuperar trabajos interrumpidos.
- Iniciar la entrega como sistema, sin confirmar otra transferencia.
- Mostrar el selector de compra y bloquearlo cuando falta precio o sesión.
- Bloquear el pago si el saldo no cubre todo el pedido.
- Seleccionar un solo método y enviar `paymentSource: "wallet"` cuando corresponde.

La revisión visual en navegador quedó pendiente porque el acceso al navegador de pruebas de esta sesión no estuvo disponible. Las pruebas de componentes no sustituyen esa revisión visual ni una compra de prueba de extremo a extremo en QA.

## 18. Pasos pendientes para activar pavos

1. Revisar y aplicar `20261117000100_store_wallet.sql` en el Supabase del ambiente objetivo antes de desplegar el código que depende de ella.
2. Publicar la implementación en la rama y ambiente que se decida.
3. Habilitar la entrega automática con `FULFILLMENT_MODE=fnshop` y una integración de FN Shop lista para ese ambiente.
4. En QA, mantener `FNSHOP_SIMULATE=true` para validar sin regalos reales.
5. Configurar `CRON_SECRET`.
6. Ejecutar `/api/internal/wallet` cada cinco minutos con autorización de servidor. `vercel.json` ya declara esa frecuencia; el alojamiento debe admitirla. Si no la admite, configurar un programador externo equivalente.
7. Definir el precio por cada 100 pavos en México y USA desde **Admin → Clientes con pavos**.
8. Activar únicamente las regiones que estén listas para cobrar.
9. Hacer una prueba completa en QA: recarga, comprobante, aprobación, compra con saldo, entrega y consulta del historial.
10. Revisar la presentación en escritorio y móvil antes de habilitarlo para clientes reales.

Ejemplo de variables de configuración, sin valores secretos:

```text
FULFILLMENT_MODE=fnshop
FNSHOP_SIMULATE=true
CRON_SECRET=<secreto-del-ambiente>
```

La simulación corresponde a QA. La configuración de producción debe revisarse por separado antes de permitir entregas reales.

## 19. Documentación complementaria

- `docs/store-wallet.md`: guía técnica de funcionamiento y activación.
- `docs/deployment.md`: configuración general de ambientes y despliegue.

## 20. Elementos que no forman parte de esta publicación

Los archivos temporales de análisis del catálogo, como `fn-shop.json`, `live-catalog.json`, `live-fortnite.html`, `tmp-entry-*.json` y `tmp-shop-report.txt`, permanecen separados de la implementación. Tampoco se incluyen credenciales ni archivos `.env` en este documento.
