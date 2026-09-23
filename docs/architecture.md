# Arquitectura

El proyecto usa arquitectura por feature. Cada feature separa dominio, aplicación, infraestructura, componentes y composición server-side.

```text
src/features/
  catalog/
  pricing/
  eligibility/
  checkout/
  orders/
  payments/
  fulfillment/
  auth/
src/shared/
  infrastructure/
  server/
```

## Principios

- El dominio no conoce Next.js, Supabase ni APIs externas.
- Los casos de uso dependen de interfaces del dominio.
- FN Shop, Fortnite-API, Supabase y Mercado Pago son adaptadores reemplazables.
- Los webhooks y entregas son idempotentes.
- El catálogo visual nunca autoriza por sí mismo una compra.
- Una entrega requiere pago validado, estado `ready_to_send` y una comprobación final.

## Fuentes

- Fortnite-API: nombre, arte, rareza y descripción.
- FN Shop: `offerId`, disponibilidad transaccional, cuentas, amistad, cupo, saldo y regalo.
- Supabase: estado interno y auditoría.
- Mercado Pago: pago alojado y confirmación server-to-server.
