import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elimina trip_audit_events por completo.
 * El historial de status queda en trips.status / status_changed_at / status_changed_by.
 */
export class DropTripAuditEvents1748500000000 implements MigrationInterface {
  name = 'DropTripAuditEvents1748500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_trip_id;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_company_id;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_audit_events;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.trip_audit_events (
  id serial PRIMARY KEY,
  trip_id integer NOT NULL REFERENCES terminalops.trips(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS idx_trip_audit_events_trip_id
  ON terminalops.trip_audit_events (trip_id, occurred_at DESC);
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS idx_trip_audit_events_company_id
  ON terminalops.trip_audit_events (company_id, occurred_at DESC);
`);
  }
}
