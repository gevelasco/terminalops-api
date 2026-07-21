import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Alinea status de operadores al vocabulario canónico:
 * available | scheduled | in_use | leave | incapacitated
 * (inactive = is_active=false; maintenance no aplica a operadores)
 */
export class AlignOperatorStatusAndInsurance1748900000000
  implements MigrationInterface
{
  name = 'AlignOperatorStatusAndInsurance1748900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE terminalops.operators
      SET status = 'in_use'
      WHERE lower(btrim(coalesce(status, ''))) IN ('in_transit', 'on_route');
    `);
    await queryRunner.query(`
      UPDATE terminalops.operators
      SET status = 'available'
      WHERE lower(btrim(coalesce(status, ''))) NOT IN (
        'available',
        'scheduled',
        'in_use',
        'leave',
        'incapacitated'
      );
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        DROP CONSTRAINT IF EXISTS operators_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        ADD CONSTRAINT operators_status_chk
        CHECK (status IN (
          'available',
          'scheduled',
          'in_use',
          'leave',
          'incapacitated'
        ));
    `);

    // Limpia satélite de cobertura que no corresponde al kind actual
    await queryRunner.query(`
      DELETE FROM terminalops.operator_private_insurance p
      USING terminalops.operators o
      WHERE p.operator_id = o.id
        AND o.insurance_kind IS DISTINCT FROM 'private';
    `);
    await queryRunner.query(`
      DELETE FROM terminalops.operator_public_insurance p
      USING terminalops.operators o
      WHERE p.operator_id = o.id
        AND o.insurance_kind IS DISTINCT FROM 'public';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        DROP CONSTRAINT IF EXISTS operators_status_chk;
    `);
  }
}
