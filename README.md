# Drop Shop MX

Aplicación Next.js con arquitectura por features para catálogo, validación de agentes, cobros y entrega controlada de objetos digitales.

## Inicio local

```bash
cp .env.example .env.local
npm ci
npm run dev
```

## Calidad

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Consulta [arquitectura](docs/architecture.md) y [despliegue](docs/deployment.md).

La integración real requiere proyectos de Supabase y Mercado Pago, además de una licencia/API key de FN Shop. Fortnite-API y FN Shop no son APIs oficiales de Epic.

Prueba para ver si sube a deploy
