import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elimina la configuración legada «china» (redirige a sencillo) y renombra «Full» → «Doble articulado».
 */
export class CleanupOperationConfigCatalog1743100000000
  implements MigrationInterface
{
  name = 'CleanupOperationConfigCatalog1743100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
DELETE FROM terminalops.destination_rate_prices drp_china
USING terminalops.company_operation_configurations ch,
      terminalops.company_operation_configurations se
WHERE lower(ch.code) = 'china'
  AND se.company_id = ch.company_id
  AND lower(se.code) = 'sencillo'
  AND drp_china.operation_configuration_id = ch.id
  AND EXISTS (
    SELECT 1
    FROM terminalops.destination_rate_prices drp_senc
    WHERE drp_senc.destination_rate_id = drp_china.destination_rate_id
      AND drp_senc.operation_configuration_id = se.id
  );
`);

    await queryRunner.query(`
UPDATE terminalops.destination_rate_prices drp
SET operation_configuration_id = se.id
FROM terminalops.company_operation_configurations ch
JOIN terminalops.company_operation_configurations se
  ON se.company_id = ch.company_id AND lower(se.code) = 'sencillo'
WHERE lower(ch.code) = 'china'
  AND drp.operation_configuration_id = ch.id;
`);

    await queryRunner.query(`
DELETE FROM terminalops.toll_route_booth_prices tbp_china
USING terminalops.company_operation_configurations ch,
      terminalops.company_operation_configurations se
WHERE lower(ch.code) = 'china'
  AND se.company_id = ch.company_id
  AND lower(se.code) = 'sencillo'
  AND tbp_china.operation_configuration_id = ch.id
  AND EXISTS (
    SELECT 1
    FROM terminalops.toll_route_booth_prices tbp_senc
    WHERE tbp_senc.booth_id = tbp_china.booth_id
      AND tbp_senc.operation_configuration_id = se.id
  );
`);

    await queryRunner.query(`
UPDATE terminalops.toll_route_booth_prices tbp
SET operation_configuration_id = se.id
FROM terminalops.company_operation_configurations ch
JOIN terminalops.company_operation_configurations se
  ON se.company_id = ch.company_id AND lower(se.code) = 'sencillo'
WHERE lower(ch.code) = 'china'
  AND tbp.operation_configuration_id = ch.id;
`);

    await queryRunner.query(`
UPDATE terminalops.trips t
SET
  operation_configuration_id = se.id,
  operation_type = 'sencillo',
  operation_configuration_name_snapshot = 'Sencillo',
  operation_configuration_version_snapshot = se.version,
  operation_configuration_max_equipment_count_snapshot = 1
FROM terminalops.company_operation_configurations ch
JOIN terminalops.company_operation_configurations se
  ON se.company_id = ch.company_id AND lower(se.code) = 'sencillo'
WHERE t.operation_configuration_id = ch.id
  AND t.company_id = ch.company_id
  AND lower(ch.code) = 'china';
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET
  operation_type = 'sencillo',
  operation_configuration_name_snapshot = 'Sencillo',
  operation_configuration_max_equipment_count_snapshot = 1
WHERE lower(operation_type) = 'china'
   OR lower(trim(operation_configuration_name_snapshot)) = 'china';
`);

    await queryRunner.query(`
DELETE FROM terminalops.company_operation_configurations
WHERE lower(code) = 'china'
   OR lower(trim(name)) = 'china';
`);

    await queryRunner.query(`
UPDATE terminalops.company_operation_configurations
SET name = 'Doble articulado'
WHERE lower(code) = 'full'
  AND trim(name) <> 'Doble articulado';
`);

    await queryRunner.query(`
UPDATE terminalops.trips t
SET operation_configuration_name_snapshot = cfg.name
FROM terminalops.company_operation_configurations cfg
WHERE t.operation_configuration_id = cfg.id
  AND lower(cfg.code) = 'full';
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET operation_configuration_name_snapshot = 'Doble articulado'
WHERE operation_type = 'full'
  AND (
    trim(operation_configuration_name_snapshot) = ''
    OR lower(trim(operation_configuration_name_snapshot)) = 'full'
    OR operation_configuration_name_snapshot ILIKE '%full%'
  );
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
UPDATE terminalops.company_operation_configurations
SET name = 'Full'
WHERE lower(code) = 'full';
`);
  }
}
