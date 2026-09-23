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
FORTNITE_API_BASE_URL
FNSHOP_API_BASE_URL
FNSHOP_API_KEY
MERCADO_PAGO_ACCESS_TOKEN
MERCADO_PAGO_WEBHOOK_SECRET
CRON_SECRET
BANK_NAME
BANK_BENEFICIARY
BANK_CLABE
```

No reutilices credenciales entre QA y producción. Registra en Mercado Pago el webhook `https://DOMINIO/api/webhooks/mercado-pago`.

## Liberación

1. Feature commits en `development`.
2. Ejecutar CI y prueba manual del flujo demo.
3. Merge commit `development → qa-release`.
4. Aplicar migraciones al Supabase QA.
5. Probar catálogo, amistad, Mercado Pago sandbox, transferencia y regalo controlado.
6. Merge commit `qa-release → main`.
7. Aplicar migraciones de producción.
8. Verificar `/health`, cron, webhook y logs.

La autorización comercial de Epic/FN Shop y la aprobación del giro por Mercado Pago siguen siendo gates externos obligatorios.
