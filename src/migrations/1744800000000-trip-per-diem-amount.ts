import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripPerDiemAmount1744800000000 implements MigrationInterface {
  name = 'TripPerDiemAmount1744800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD COLUMN IF NOT EXISTS per_diem_amount numeric(14,2);
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP COLUMN IF EXISTS per_diem_amount;
`);
  }
}
