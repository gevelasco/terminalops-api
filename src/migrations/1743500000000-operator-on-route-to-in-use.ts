import { MigrationInterface, QueryRunner } from 'typeorm';

/** Operadores: `on_route` → `in_use` (misma semántica: «En curso»). */
export class OperatorOnRouteToInUse1743500000000 implements MigrationInterface {
  name = 'OperatorOnRouteToInUse1743500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
UPDATE terminalops.operators
SET status = 'in_use'
WHERE status = 'on_route';
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
UPDATE terminalops.operators
SET status = 'on_route'
WHERE status = 'in_use'
  AND id IN (
    SELECT DISTINCT t.operator_id
    FROM terminalops.trips t
    WHERE t.operator_id IS NOT NULL
      AND t.status = 'in_transit'
  );
`);
  }
}
