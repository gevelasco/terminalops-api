import { MigrationInterface, QueryRunner } from 'typeorm';

/** Contacto comercial de empresa (correo/teléfono) para cotizaciones PDF. */
export class CompanyContactFields1753390000000 implements MigrationInterface {
  name = 'CompanyContactFields1753390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS contact_email varchar(160) NULL,
        ADD COLUMN IF NOT EXISTS contact_phone varchar(40) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS contact_email,
        DROP COLUMN IF EXISTS contact_phone;
    `);
  }
}
