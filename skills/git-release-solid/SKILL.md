---
name: git-release-solid
description: "Aplica un flujo Git seguro y trazable para este proyecto: crear ramas, preparar commits, revisar cambios, crear tags y publicar releases con migraciones de base de datos. Úsala cuando se soliciten ramas, commits, PRs, tags, releases o cambios de esquema en Supabase."
---

# Git Release SOLID

Usa este flujo para que cada cambio sea pequeño, reversible y fácil de revisar.

## Antes de modificar Git

1. Inspecciona la rama actual, el estado del árbol y los remotos.
2. Separa los cambios ajenos o sin relación: no los incluyas en el commit.
3. Confirma cuál es la rama base (`main` normalmente) antes de crear una rama.
4. No uses comandos destructivos (`reset --hard`, `checkout --`, borrados masivos) sin aprobación explícita.

## Ramas

Parte de una `main` actualizada y limpia. Crea una rama por responsabilidad:

- `feat/<tema>`: funcionalidad nueva.
- `fix/<tema>`: corrección de un fallo.
- `chore/<tema>`: mantenimiento, configuración o documentación.
- `hotfix/<tema>`: arreglo urgente para producción.

Mantén la rama enfocada. Si una tarea añade automatizaciones y otra cambia el diseño visual, sepáralas en ramas o commits distintos.

## Commits

Haz commits pequeños, coherentes y revisables. Usa mensajes imperativos y explícitos:

```text
feat(notifications): enqueue Telegram alerts for new orders
fix(cart): preserve recovery campaign after cart update
chore(db): add email automation migration
docs(release): document production migration checklist
```

Antes de crear un commit, revisa exactamente los archivos incluidos. No subas secretos, archivos `.env`, tokens, salidas de build ni cambios no relacionados.

## Aplicar SOLID al desarrollo

- **Responsabilidad única:** una ruta, servicio o componente debe atender una sola razón de cambio.
- **Abierto/cerrado:** añade proveedores o clases de eventos mediante interfaces o adaptadores; evita reescribir la lógica estable.
- **Sustitución:** cualquier proveedor de correo o mensajería debe cumplir el mismo contrato de envío.
- **Segregación de interfaces:** usa contratos pequeños; no obligues un proveedor a implementar funciones que no usa.
- **Inversión de dependencias:** las rutas de API dependen de abstracciones y configuración, no de credenciales o SDKs concretos dispersos.

## Migraciones y Supabase de producción

Una migración no se considera un simple cambio local: al aplicarse contra el único proyecto conectado, modifica producción.

1. Prefiere migraciones aditivas y compatibles hacia atrás: nuevas tablas, columnas nullable, índices y políticas.
2. Evita eliminar, renombrar o cambiar tipos de columnas en la misma entrega que cambia el código.
3. Confirma que existe una copia de seguridad recuperable antes de aplicar una migración de riesgo.
4. Aplica primero el esquema y despliega el código inmediatamente después; no despliegues código que dependa de tablas aún inexistentes.
5. Para revertir, primero revierte el código. Restaurar una base de datos completa es último recurso porque puede perder datos posteriores a la copia.
6. Prueba en una rama de base de datos, segundo proyecto o entorno local cuando esté disponible. Si sólo existe producción, usa cuentas y datos de prueba identificables y limita las pruebas.

## Tags y releases

Un tag es una referencia inmutable a un commit; no sustituye una copia de seguridad de Supabase.

1. Crea tags únicamente desde `main`, limpia, revisada y subida al remoto.
2. Antes de una entrega sensible, crea un tag anotado de respaldo, por ejemplo `v0.1.0-pre-automation`.
3. Tras validar la entrega, crea el tag de release, por ejemplo `v0.2.0`.
4. Comprueba que el tag apunta al commit esperado antes de publicarlo.
5. Publica tags sólo con autorización explícita del responsable del repositorio.

## Entrega

Al terminar, reporta: rama, commits incluidos, migraciones pendientes/aplicadas, validaciones realizadas y cualquier riesgo o paso manual restante.
