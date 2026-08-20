import { MigrationInterface, QueryRunner } from 'typeorm';

/** Quién programó la maniobra (nombre o username del usuario autenticado). */
export class TripCreatedBy1750900000000 implements MigrationInterface {
  name = 'TripCreatedBy1750900000000';

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
