import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quita flags de factura fiscal en perfiles de flota (seguro / GPS).
 * No se usaban en operación; el flag permanece solo en gastos manuales.
 */
export class DropFleetInvoiceRequired1750400000000
  implements MigrationInterface
{
  name = 'DropFleetInvoiceRequired1750400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS insurance_invoice_required,
        DROP COLUMN IF EXISTS gps_invoice_required
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        DROP COLUMN IF EXISTS insurance_invoice_required
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        ADD COLUMN IF NOT EXISTS insurance_invoice_required boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS gps_invoice_required boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        ADD COLUMN IF NOT EXISTS insurance_invoice_required boolean NOT NULL DEFAULT false
    `);
  }
}
