import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices para GETs pesados: list/calendar de gastos, flota y balance de clientes.
 */
export class OptimizeExpenseTripQueryIndexes1749500000000
  implements MigrationInterface
{
  name = 'OptimizeExpenseTripQueryIndexes1749500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_company_discarded_incurred
        ON terminalops.expenses (company_id, discarded_at, incurred_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_company_kind_discarded
        ON terminalops.expenses (company_id, kind, discarded_at);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_related_unit_id
        ON terminalops.expenses (related_unit_id)
        WHERE related_unit_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_related_equipment_id
        ON terminalops.expenses (related_equipment_id)
        WHERE related_equipment_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_related_operator_id
        ON terminalops.expenses (related_operator_id)
        WHERE related_operator_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_company_status_deleted
        ON terminalops.trips (company_id, status, deleted_at);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_company_client_deleted
        ON terminalops.trips (company_id, client_id, deleted_at)
        WHERE client_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_maint_unit_latest
        ON terminalops.fleet_maintenance_entries (unit_id, sort_order DESC, entry_date DESC)
        WHERE unit_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_maint_equipment_latest
        ON terminalops.fleet_maintenance_entries (equipment_id, sort_order DESC, entry_date DESC)
        WHERE equipment_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_verif_unit_scope_latest
        ON terminalops.fleet_verification_entries (unit_id, scope, sort_order DESC, entry_date DESC)
        WHERE unit_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_verif_equipment_scope_latest
        ON terminalops.fleet_verification_entries (equipment_id, scope, sort_order DESC, entry_date DESC)
        WHERE equipment_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_fleet_verif_equipment_scope_latest;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_fleet_verif_unit_scope_latest;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_fleet_maint_equipment_latest;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_fleet_maint_unit_latest;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_company_client_deleted;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_company_status_deleted;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_expenses_related_operator_id;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_expenses_related_equipment_id;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_expenses_related_unit_id;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_expenses_company_kind_discarded;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_expenses_company_discarded_incurred;`,
    );
  }
}
