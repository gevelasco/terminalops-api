import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sustituye el código legado `full` por `doble-articulado` en catálogo y maniobras.
 *
 * No se vuelve a crear `trips_operation_type_check`: `operation_type` sigue el catálogo
 * por empresa y puede incluir códigos distintos a sencillo / doble / plana.
 */
export class RenameFullToDobleArticulado1752300000000 implements MigrationInterface {
  name = 'RenameFullToDobleArticulado1752300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP CONSTRAINT IF EXISTS trips_operation_type_check;
    `);

    await queryRunner.query(`
      UPDATE terminalops.company_operation_configurations
      SET code = 'doble-articulado'
      WHERE lower(code) = 'full';
    `);

    await queryRunner.query(`
      UPDATE terminalops.trips
      SET operation_type = 'doble-articulado'
      WHERE lower(trim(operation_type)) = 'full';
    `);

    await queryRunner.query(`
      UPDATE terminalops.trips t
      SET operation_type = cfg.code
      FROM terminalops.company_operation_configurations cfg
      WHERE t.operation_configuration_id = cfg.id
        AND lower(trim(t.operation_type)) = 'full'
        AND lower(cfg.code) = 'doble-articulado';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE terminalops.company_operation_configurations
      SET code = 'full'
      WHERE lower(code) = 'doble-articulado';
    `);

    await queryRunner.query(`
      UPDATE terminalops.trips
      SET operation_type = 'full'
      WHERE lower(trim(operation_type)) = 'doble-articulado';
    `);
  }
}
