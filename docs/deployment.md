# Despliegue

## Ramas y ambientes

| Rama | Uso | Destino |
|---|---|---|
| `development` | Integración continua | Preview de desarrollo |
| `qa-release` | Candidato validado | Preview/QA estable |
| `main` | Producción | Dominio productivo |

Protege las tres ramas en GitHub. Exige `CI / quality`, revisión y conversación resuelta. No permitas push directo a `qa-release` ni `main`.

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
```

`FORTNITE_API_BASE_URL` alimenta el catálogo visual y, si se omite, usa
`https://fortnite-api.com/v2`. En la primera fase, `FULFILLMENT_MODE=manual`
mantiene FN Shop fuera del catálogo y de la salud del servicio. Los objetos
regalables de Fortnite pueden agregarse al carrito con precios calculados en
servidor. Una fase posterior podrá usar `FULFILLMENT_MODE=fnshop` junto con
`FNSHOP_API_KEY` para habilitar validación y entrega automáticas.
`COMMERCE_SESSION_SECRET` debe ser un valor aleatorio exclusivo
de cada ambiente. `ALLOW_DEMO_PROVIDERS` debe permanecer en `false` en producción.

`NEXT_PUBLIC_APP_URL` utiliza `https://www.sigfriedlootbox.com` como respaldo
cuando no está definida. En previews y desarrollo se debe configurar de forma
explícita con el dominio correspondiente para que los retornos de pago apunten
al ambiente correcto.

No reutilices credenciales entre QA y producción. La transferencia bancaria es
el único método de pago expuesto; WhatsApp funciona únicamente como postventa.

## Liberación

1. Feature commits en `development`.
2. Ejecutar CI y pruebas del flujo comercial con proveedores QA.
3. Merge commit `development → qa-release`.
4. Aplicar migraciones al Supabase QA.
5. Probar catálogo, amistad de 48 horas, cotización, transferencia, comprobante privado y entrega controlada.
6. Merge commit `qa-release → main`.
7. Aplicar migraciones de producción.
8. Verificar `/health`, limpieza programada, RLS, URLs firmadas y logs.

La autorización comercial de Epic/FN Shop sigue siendo un gate externo obligatorio.
