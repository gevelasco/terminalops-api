import { MigrationInterface, QueryRunner } from 'typeorm';

/** Normaliza tipos de contenedor: 20ft/40ft → 20dc/40dc; amplía catálogo DC/HC. */
export class TripContainerTypeDcHc1746700000000 implements MigrationInterface {
  name = 'TripContainerTypeDcHc1746700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP CONSTRAINT IF EXISTS trips_container_type_check;
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET container_type = '20dc'
WHERE container_type = '20ft';
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET container_type = '40dc'
WHERE container_type = '40ft';
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD CONSTRAINT trips_container_type_check
  CHECK (container_type IN ('20dc', '20hc', '40dc', '40hc', '45hc', 'na'));
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP CONSTRAINT IF EXISTS trips_container_type_check;
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET container_type = '20ft'
WHERE container_type = '20dc';
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET container_type = '40ft'
WHERE container_type = '40dc';
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET container_type = 'na'
WHERE container_type IN ('20hc', '45hc');
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD CONSTRAINT trips_container_type_check
  CHECK (container_type IN ('20ft', '40ft', '40hc', 'na'));
`);
  }
}
