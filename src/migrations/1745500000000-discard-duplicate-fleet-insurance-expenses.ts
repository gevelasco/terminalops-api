import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  selectDuplicateFleetInsuranceExpenseIds,
  type FleetInsuranceExpenseRow,
} from '../expenses/expenses-insurance-dedup.util';

export class DiscardDuplicateFleetInsuranceExpenses1745500000000
  implements MigrationInterface
{
  name = 'DiscardDuplicateFleetInsuranceExpenses1745500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT
        id,
        company_id,
        insurance_target,
        related_unit_id,
        related_equipment_id,
        amount,
        category,
        incurred_at
      FROM terminalops.expenses
      WHERE kind = 'insurance'
        AND discarded_at IS NULL
      ORDER BY id ASC
    `)) as FleetInsuranceExpenseRow[];

    const discardIds = selectDuplicateFleetInsuranceExpenseIds(rows);
    if (discardIds.length === 0) {
      return;
    }

    await queryRunner.query(
      `
        UPDATE terminalops.expenses
        SET discarded_at = NOW()
        WHERE id = ANY($1::int[])
      `,
      [discardIds],
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Limpieza de datos irreversible.
  }
}
