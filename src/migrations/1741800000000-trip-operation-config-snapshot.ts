import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripOperationConfigSnapshot1741800000000 implements MigrationInterface {
  name = 'TripOperationConfigSnapshot1741800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD COLUMN IF NOT EXISTS operation_configuration_id integer
    REFERENCES terminalops.company_operation_configurations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operation_configuration_name_snapshot text NOT NULL DEFAULT '';
`);

    await queryRunner.query(`
UPDATE terminalops.trips t
SET
  operation_configuration_id = cfg.id,
  operation_configuration_name_snapshot = cfg.name
FROM terminalops.company_operation_configurations cfg
WHERE cfg.company_id = t.company_id
  AND cfg.code = t.operation_type
  AND (t.operation_configuration_name_snapshot IS NULL OR t.operation_configuration_name_snapshot = '');
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET operation_configuration_name_snapshot = initcap(replace(operation_type, '-', ' '))
WHERE operation_configuration_name_snapshot IS NULL
   OR trim(operation_configuration_name_snapshot) = '';
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP COLUMN IF EXISTS operation_configuration_id,
  DROP COLUMN IF EXISTS operation_configuration_name_snapshot;
`);
  }
}
