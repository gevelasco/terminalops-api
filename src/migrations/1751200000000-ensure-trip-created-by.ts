import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quién programó la maniobra (nombre o username del usuario autenticado).
 * Timestamp propio: 175090 ya lo usa InvitationCodes (TypeORM no reejecuta
 * un segundo archivo con el mismo timestamp si el primero ya está en
 * migrations_list).
 */
export class EnsureTripCreatedBy1751200000000 implements MigrationInterface {
  name = 'EnsureTripCreatedBy1751200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS created_by text NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS created_by;
    `);
  }
}
