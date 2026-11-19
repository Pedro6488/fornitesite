## Qué cambia

<!-- Qué ve el cliente, qué ve el admin y qué pasa en segundo plano. -->

## Flujos que toca

<!-- Marca todos los que el cambio puede afectar, aunque sea de lado. -->
- [ ] Pedido habitual (transferencia / PayPal y regalos)
- [ ] Pavos: recarga, revisión o compra con saldo
- [ ] Entregas con FN Shop o la cola de trabajos
- [ ] Avisos (Telegram o WhatsApp)
- [ ] Panel del admin
- [ ] Base de datos (migraciones)

## Avisos

Cada paso en que el cliente queda esperando a la tienda debe avisar al equipo. Por ejemplo, un comprobante subido manda un Telegram.
- [ ] Revisé que cada paso nuevo o cambiado avisa a quien tiene que actuar, igual que el flujo habitual.

## Verificación

**Pruebas automáticas** (las corre quien abre el PR):
- [ ] `npx vitest run`
- [ ] `npx tsc --noEmit`
- [ ] `npx eslint src`
- [ ] `npm run build`
- [ ] Cada error corregido tiene una prueba que falla sin la corrección.

**En QA, por una persona** (no se hace merge a `main` sin esto):
- [ ] Migraciones aplicadas en QA (`migration list --remote=<ref>`).
- [ ] Guion ejecutado y tabla de resultado llena. Para pavos, el guion es [docs/qa-pavos.md](../docs/qa-pavos.md).

| Commit desplegado | Probó | Fecha | Pasos que fallaron |
|---|---|---|---|
| | | | |

**No probado todavía:**
<!-- Escríbelo aquí. "Probado en código" no es lo mismo que "probado en QA". -->
