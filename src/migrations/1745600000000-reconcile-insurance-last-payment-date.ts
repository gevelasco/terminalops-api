import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReconcileInsuranceLastPaymentDate1745600000000
  implements MigrationInterface
{
  name = 'ReconcileInsuranceLastPaymentDate1745600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE terminalops.unit_fleet_profiles ufp
      SET insurance_last_payment_date = synced.latest_date
      FROM (
        SELECT DISTINCT ON (e.related_unit_id)
          e.related_unit_id,
          (e.incurred_at AT TIME ZONE 'America/Mexico_City')::date AS latest_date
        FROM terminalops.expenses e
        WHERE e.kind = 'insurance'
          AND e.discarded_at IS NULL
          AND e.insurance_target = 'unit'
          AND e.related_unit_id IS NOT NULL
          AND e.description ILIKE 'Pago de póliza%'
        ORDER BY e.related_unit_id, e.incurred_at DESC
      ) synced
      WHERE ufp.unit_id = synced.related_unit_id
    `);

    await queryRunner.query(`
      UPDATE terminalops.unit_fleet_profiles
      SET insurance_last_payment_date = NULL
      WHERE insurance_last_payment_date IS NOT NULL
        AND unit_id NOT IN (
          SELECT DISTINCT e.related_unit_id
          FROM terminalops.expenses e
          WHERE e.kind = 'insurance'
            AND e.discarded_at IS NULL
            AND e.insurance_target = 'unit'
            AND e.related_unit_id IS NOT NULL
            AND e.description ILIKE 'Pago de póliza%'
        )
    `);

    await queryRunner.query(`
      UPDATE terminalops.equipment_fleet_profiles efp
      SET insurance_last_payment_date = synced.latest_date
      FROM (
        SELECT DISTINCT ON (e.related_equipment_id)
          e.related_equipment_id,
          (e.incurred_at AT TIME ZONE 'America/Mexico_City')::date AS latest_date
        FROM terminalops.expenses e
        WHERE e.kind = 'insurance'
          AND e.discarded_at IS NULL
          AND e.insurance_target = 'equipment'
          AND e.related_equipment_id IS NOT NULL
          AND e.description ILIKE 'Pago de póliza%'
        ORDER BY e.related_equipment_id, e.incurred_at DESC
      ) synced
      WHERE efp.equipment_id = synced.related_equipment_id
    `);

    await queryRunner.query(`
      UPDATE terminalops.equipment_fleet_profiles
      SET insurance_last_payment_date = NULL
      WHERE insurance_last_payment_date IS NOT NULL
        AND equipment_id NOT IN (
          SELECT DISTINCT e.related_equipment_id
          FROM terminalops.expenses e
          WHERE e.kind = 'insurance'
            AND e.discarded_at IS NULL
            AND e.insurance_target = 'equipment'
            AND e.related_equipment_id IS NOT NULL
            AND e.description ILIKE 'Pago de póliza%'
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Reconciliación de datos irreversible.
  }
}
