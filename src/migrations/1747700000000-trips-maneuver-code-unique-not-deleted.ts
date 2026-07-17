import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El folio (maneuver_code) de una maniobra eliminada queda liberado:
 * la unicidad por empresa aplica solo a maniobras no eliminadas, de modo
 * que borrar una maniobra realmente la saca del sistema, folio incluido.
 */
export class TripsManeuverCodeUniqueNotDeleted1747700000000
  implements MigrationInterface
{
  name = 'TripsManeuverCodeUniqueNotDeleted1747700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trips_company_maneuver_code_uniq
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS trips_company_maneuver_code_uniq
      ON terminalops.trips (company_id, maneuver_code)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trips_company_maneuver_code_uniq
    `);
    // Nota: si hubo reutilización de folios entre filas eliminadas y activas,
    // recrear el índice completo podría fallar; se limpia duplicando el sufijo.
    await queryRunner.query(`
      UPDATE terminalops.trips t
      SET maneuver_code = t.maneuver_code || '-del-' || t.id::text
      WHERE t.deleted_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM terminalops.trips o
          WHERE o.company_id = t.company_id
            AND o.maneuver_code = t.maneuver_code
            AND o.id != t.id
        )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS trips_company_maneuver_code_uniq
      ON terminalops.trips (company_id, maneuver_code)
    `);
  }
}
