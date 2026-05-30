import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientDeliveryLocation1740700000000 implements MigrationInterface {
  name = 'ClientDeliveryLocation1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.client_delivery (
  client_id integer PRIMARY KEY REFERENCES terminalops.clients(id) ON DELETE CASCADE,
  postal_code varchar(5),
  city_municipality text,
  locality text,
  settlement_cons_id varchar(32),
  latitude numeric(10,7),
  longitude numeric(10,7),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.client_delivery;`);
  }
}
