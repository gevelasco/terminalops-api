import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperationConfigVersionAndTripSnapshot1741900000000
  implements MigrationInterface
{
  name = 'OperationConfigVersionAndTripSnapshot1741900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.company_operation_configurations
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
`);

    await queryRunner.query(`
UPDATE terminalops.company_operation_configurations
SET version = 1
WHERE version IS NULL;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD COLUMN IF NOT EXISTS operation_configuration_version_snapshot integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS operation_configuration_max_equipment_count_snapshot smallint NOT NULL DEFAULT 1;
`);

    await queryRunner.query(`
UPDATE terminalops.trips t
SET
  operation_configuration_version_snapshot = cfg.version,
  operation_configuration_max_equipment_count_snapshot = cfg.max_equipment_count
FROM terminalops.company_operation_configurations cfg
WHERE t.operation_configuration_id = cfg.id;
`);

    await queryRunner.query(`
UPDATE terminalops.trips t
SET
  operation_configuration_version_snapshot = cfg.version,
  operation_configuration_max_equipment_count_snapshot = cfg.max_equipment_count
FROM terminalops.company_operation_configurations cfg
WHERE cfg.company_id = t.company_id
  AND cfg.code = t.operation_type
  AND t.operation_configuration_id IS NULL;
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET operation_configuration_max_equipment_count_snapshot = 1
WHERE operation_configuration_max_equipment_count_snapshot IS NULL
   OR operation_configuration_max_equipment_count_snapshot < 1;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.company_operation_configurations
  DROP COLUMN IF EXISTS version;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP COLUMN IF EXISTS operation_configuration_version_snapshot,
  DROP COLUMN IF EXISTS operation_configuration_max_equipment_count_snapshot;
`);
  }
}
