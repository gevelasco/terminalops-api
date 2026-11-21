import { MigrationInterface, QueryRunner } from 'typeorm';

/** Nombre canónico: casetas en ruta de la tarifa (no una “preview” aparte). */
export class DestinationRateRouteTollPlazas1753220000000
  implements MigrationInterface
{
  name = 'DestinationRateRouteTollPlazas1753220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'terminalops'
            AND table_name = 'destination_rates'
            AND column_name = 'route_toll_plaza_preview'
        ) THEN
          ALTER TABLE terminalops.destination_rates
            RENAME COLUMN route_toll_plaza_preview TO route_toll_plazas;
        ELSIF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'terminalops'
            AND table_name = 'destination_rates'
            AND column_name = 'route_toll_plazas'
        ) THEN
          ALTER TABLE terminalops.destination_rates
            ADD COLUMN route_toll_plazas JSONB NOT NULL DEFAULT '[]'::jsonb;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'terminalops'
            AND table_name = 'destination_rates'
            AND column_name = 'route_toll_plazas'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'terminalops'
            AND table_name = 'destination_rates'
            AND column_name = 'route_toll_plaza_preview'
        ) THEN
          ALTER TABLE terminalops.destination_rates
            RENAME COLUMN route_toll_plazas TO route_toll_plaza_preview;
        END IF;
      END $$;
    `);
  }
}