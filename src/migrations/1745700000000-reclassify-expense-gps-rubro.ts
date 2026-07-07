import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rubro se deriva de `expenses.kind` (no hay columna rubro).
 * Tras separar Seguros y GPS, reclasifica filas GPS que quedaron con kind incorrecto
 * cuando ambos compartían el rubro «Seguros y GPS».
 */
export class ReclassifyExpenseGpsRubro1745700000000 implements MigrationInterface {
  name = 'ReclassifyExpenseGpsRubro1745700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET
        kind = 'gps',
        insurance_target = NULL,
        updated_at = NOW()
      WHERE discarded_at IS NULL
        AND kind <> 'gps'
        AND (
          LOWER(TRIM(category)) IN (
            'gps / telemetría',
            'gps / telemetria',
            'gps',
            'gps o telemetría',
            'gps o telemetria'
          )
          OR category ILIKE '%gps%'
          OR category ILIKE '%telemetr%'
          OR COALESCE(description, '') ILIKE '%gps%'
          OR COALESCE(description, '') ILIKE '%telemetr%'
          OR COALESCE(vendor, '') ILIKE '%gps%'
        )
        AND NOT (
          description ILIKE 'Pago de póliza%'
          OR category ILIKE '%póliza%'
          OR category ILIKE '%poliza%'
          OR (
            category ILIKE '%seguro%'
            AND category NOT ILIKE '%gps%'
          )
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Reclasificación de datos irreversible.
  }
}
