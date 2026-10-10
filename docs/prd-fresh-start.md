# Fresh start en PRD — solo esquema

Borrado **total** de datos de negocio. No se conserva historial ni códigos de invitación viejos.

## SQL (Railway Query o psql)

```sql
BEGIN;

TRUNCATE terminalops.refresh_tokens RESTART IDENTITY;
TRUNCATE terminalops.invitation_codes RESTART IDENTITY CASCADE;
TRUNCATE terminalops.companies RESTART IDENTITY CASCADE;

COMMIT;
```

- **`companies` CASCADE** elimina usuarios, clientes, maniobras, flota, gastos, documentos (filas), etc.
- **`invitation_codes`** se vacía a propósito.
- **Queda:** tablas vacías, índices, `migrations_list`, y referencias globales como `fuel_prices` (opcional truncar si quieres cero filas en todo).

## Después del SQL

1. **Bucket S3 / Railway:** vaciar objetos (el SQL no los borra).
2. **Redeploy API** (o reiniciar servicio): `src/migrate.ts` hace `INSERT INTO invitation_codes … ON CONFLICT DO NOTHING` con los códigos beta. Genera códigos nuevos en SQL si ya no quieres esos.
3. **Front** desplegado con `apiUrl` de PRD.
4. Smoke: **sign-up** con código nuevo → operación mínima.

## Script equivalente

```bash
CONFIRM_PRD_WIPE=yes npm run db:prd-wipe-tenants
```

## No usar

Migración TypeORM automática para el wipe (afecta otros entornos al clonar historial).
