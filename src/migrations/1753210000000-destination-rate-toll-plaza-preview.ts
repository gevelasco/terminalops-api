import { MigrationInterface, QueryRunner } from 'typeorm';

export class DestinationRateTollPlazaPreview1753210000000
  implements MigrationInterface
{
  name = 'DestinationRateTollPlazaPreview1753210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        ADD COLUMN IF NOT EXISTS route_toll_plaza_preview JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS route_toll_plaza_preview;
    `);
  }
}