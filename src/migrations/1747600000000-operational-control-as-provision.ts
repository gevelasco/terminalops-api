import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marca gastos de control operativo (reserva %) como provisión operativa.
 * Corrige filas históricas creadas con is_operational_provision = false.
 */
export class OperationalControlAsProvision1747600000000
  implements MigrationInterface
{
  name = 'OperationalControlAsProvision1747600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET is_operational_provision = true
      WHERE kind = 'operational_control'
        AND is_operational_provision = false
        AND discarded_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET is_operational_provision = false
      WHERE kind = 'operational_control'
        AND is_operational_provision = true
        AND discarded_at IS NULL
    `);
  }
}
