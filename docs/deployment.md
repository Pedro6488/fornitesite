# Despliegue

## Ramas y ambientes

| Rama | Uso | Destino |
|---|---|---|
| `development` | Integración continua | Preview de desarrollo |
| `qa_release` | Candidato validado | Preview/QA estable |
| `main` | Producción | Dominio productivo |

Protege las tres ramas en GitHub. Exige `CI / quality`, revisión y conversación resuelta. No permitas push directo a `qa_release` ni `main`.

## Supabase

1. Crear proyectos separados para QA y producción.
2. Vincular cada proyecto con `npx supabase link --project-ref ...`.
3. Revisar con `npx supabase db diff`.
4. Aplicar con `npx supabase db push` primero en QA y después en producción.
5. Configurar Auth Site URL y redirect `/auth/callback` para cada dominio.
6. Verificar el bucket privado `transfer-receipts` y las políticas RLS.
7. Crear el primer usuario administrador y actualizar `profiles.role = 'admin'` desde el panel seguro.

## Vercel

Importa el repositorio y configura `main` como Production Branch. Las demás ramas generan previews.

Variables requeridas:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
COMMERCE_SESSION_SECRET
FORTNITE_API_BASE_URL
FNSHOP_API_BASE_URL
FNSHOP_API_KEY
FULFILLMENT_MODE=manual
ALLOW_DEMO_PROVIDERS=false
WHATSAPP_BUSINESS_NUMBER
CRON_SECRET
TELEGRAM_BOT_TOKEN
TELEGRAM_ADMIN_CHAT_IDS
RESEND_API_KEY
EMAIL_FROM
```

`FORTNITE_API_BASE_URL` alimenta el catálogo y, si se omite, usa
`https://fortnite-api.com/v2`. El catálogo nunca consulta FN Shop.

`FULFILLMENT_MODE=manual` deja la entrega a mano. `FULFILLMENT_MODE=fnshop`
valida IDs nuevos con `friend_add` y entrega desde la consola con FN Shop
(guía completa en `docs/fnshop-integracion.md`). Variables de FN Shop:

| Variable | Producción | Preview / QA |
|---|---|---|
| `FNSHOP_API_KEY` | La key real | **No se define** |
| `FNSHOP_SIMULATE` | No se define (se ignora) | `true` |
| `FNSHOP_TERM_STARTS_AT` | Fecha de inicio del periodo pagado | Cualquiera |
| `FNSHOP_MONTHLY_LIMIT` / `FNSHOP_DAILY_LIMIT` | `5000` / `300` | Igual |
| `FNSHOP_CATEGORY` | Vacío (todas las cuentas) | Vacío |
| `FNSHOP_LEARNING_SNAPSHOTS` | `true` solo si se aprueba el presupuesto de aprendizaje | `false` |

La key se liga al dominio en su primer uso: el código solo llama a FN Shop
cuando `VERCEL_ENV=production`. En cualquier otro entorno responde el
simulador o, sin él, los IDs quedan en revisión manual.
`COMMERCE_SESSION_SECRET` debe ser un valor aleatorio exclusivo
de cada ambiente. `ALLOW_DEMO_PROVIDERS` debe permanecer en `false` en producción.

Para automatizaciones, configura un bot de Telegram y usa como
`TELEGRAM_ADMIN_CHAT_IDS` una lista separada por comas de chats autorizados. En
Resend, verifica el dominio de `EMAIL_FROM` antes de enviar a clientes reales.
El cron de Hobby ejecuta `/api/internal/jobs` diariamente; Telegram y la
verificación de correo se intentan de inmediato y se reintentan desde la cola.

`NEXT_PUBLIC_APP_URL` utiliza `https://www.sigfriedlootbox.com` como respaldo
cuando no está definida. En previews y desarrollo se debe configurar de forma
explícita con el dominio correspondiente para que los retornos de pago apunten
al ambiente correcto.

No reutilices credenciales entre QA y producción. La transferencia bancaria es
el único método de pago expuesto en el checkout de Fortnite. Free Fire y los
códigos canjeables de Roblox usan formularios que preparan una solicitud por
WhatsApp para coordinar el pago y la entrega con el administrador.

## Liberación

1. Feature commits en `development`.
2. Ejecutar CI y pruebas del flujo comercial con proveedores QA.
3. Merge commit `development → qa_release`.
4. Aplicar migraciones al Supabase QA.
5. Probar catálogo, amistad de 48 horas, cotización, transferencia, comprobante privado y entrega controlada.
6. Merge commit `qa_release → main`.
7. Aplicar migraciones de producción.
8. Verificar `/health`, limpieza programada, RLS, URLs firmadas y logs.

La autorización comercial de Epic/FN Shop sigue siendo un gate externo obligatorio.

### Activar la entrega con FN Shop

1. Aplicar las migraciones `20261113000100` a `20261113000400` en QA y probar
   con `FULFILLMENT_MODE=fnshop` y `FNSHOP_SIMULATE=true` (0 requests).
2. Aplicarlas en producción con `FULFILLMENT_MODE=manual` todavía.
3. Definir en Vercel → Production `FNSHOP_API_KEY` y `FNSHOP_TERM_STARTS_AT`.
4. En la consola, `/admin/fnshop` → «Verificar key» (no gasta cuota; liga el dominio).
5. Cambiar a `FULFILLMENT_MODE=fnshop` y hacer las pruebas de salida de
   `docs/fnshop-integracion.md` (tope de 20 requests).
