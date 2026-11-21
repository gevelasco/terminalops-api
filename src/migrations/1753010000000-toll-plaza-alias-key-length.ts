import { MigrationInterface, QueryRunner } from 'typeorm';

export class TollPlazaAliasKeyLength1753010000000 implements MigrationInterface {
  name = 'TollPlazaAliasKeyLength1753010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.toll_plaza_aliases
        ALTER COLUMN plaza_key TYPE VARCHAR(128);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.toll_plaza_aliases
        ALTER COLUMN plaza_key TYPE VARCHAR(64);
    `);
  }
}