import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientDefaultPaymentMethod1742000000000 implements MigrationInterface {
  name = 'ClientDefaultPaymentMethod1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.client_payment_terms
  ADD COLUMN IF NOT EXISTS default_payment_method varchar(32);
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.client_payment_terms
  DROP COLUMN IF EXISTS default_payment_method;
`);
  }
}
