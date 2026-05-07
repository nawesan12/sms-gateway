-- Post-migration SQL for tokens feature (multi-tenant).
-- Multi-tenant: cada User tiene 1 fila en token_balance (PK = userId).
-- No hay CHECK constraint: la unicidad la garantiza el PK natural userId.
-- El seed/onboarding crea la fila al generar el access link del cliente.

-- (intencionalmente vacío — Prisma migrate maneja las tablas y FKs)
