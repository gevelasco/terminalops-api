import { MigrationInterface, QueryRunner } from 'typeorm';

export class EquipmentHitchPosition1741000000000 implements MigrationInterface {
  name = 'EquipmentHitchPosition1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment
      ADD COLUMN IF NOT EXISTS hitch_position text
      CHECK (
        hitch_position IS NULL
        OR hitch_position IN ('lead', 'rear')
      );
    `);
    await queryRunner.query(`
      UPDATE terminalops.equipment
      SET hitch_position = 'lead'
      WHERE unit_id IS NOT NULL AND hitch_position IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment
      DROP COLUMN IF EXISTS hitch_position;
    `);
  }
}
