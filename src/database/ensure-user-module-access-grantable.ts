/**
 * Catálogo RBAC en user_module_access.module_code (debe coincidir con STAFF_GRANTABLE_MODULE_CODES).
 * Idempotente: corrige CHECK desactualizado si la migración 175323 no corrió en prod.
 */
export async function ensureUserModuleAccessGrantableSchema(
  query: (sql: string) => Promise<unknown>,
): Promise<void> {
  await query(`
    ALTER TABLE terminalops.user_module_access
      DROP CONSTRAINT IF EXISTS user_module_access_module_code_check;
  `);

  await query(`
    ALTER TABLE terminalops.user_module_access
      ADD CONSTRAINT user_module_access_module_code_check
      CHECK (
        module_code IN (
          'dashboard',
          'trips',
          'fleet',
          'operators',
          'clients',
          'destination_rates',
          'expenses',
          'reports'
        )
      );
  `);

  await query(`
    INSERT INTO terminalops.user_module_access (user_id, module_code, access_level)
    SELECT c.user_id, 'destination_rates', c.access_level
    FROM terminalops.user_module_access c
    WHERE c.module_code = 'clients'
      AND NOT EXISTS (
        SELECT 1
        FROM terminalops.user_module_access dr
        WHERE dr.user_id = c.user_id
          AND dr.module_code = 'destination_rates'
      );
  `);
}