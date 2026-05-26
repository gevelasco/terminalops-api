import { readFileSync } from 'fs';
import { join } from 'path';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialTerminalopsSchema1740400000000 implements MigrationInterface {
  name = 'InitialTerminalopsSchema1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const sqlPath = join(process.cwd(), 'db', 'initial-schema.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS terminalops CASCADE;`);
  }
}
