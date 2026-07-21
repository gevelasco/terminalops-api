import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slim de trip_audit_events: solo historial from_status → to_status.
 * Elimina el esquema genérico de audit (event_type, jsonb, actor, etc.) que
 * nunca se generalizó más allá de transiciones de lifecycle.
 */
export class SlimTripAuditEvents1748400000000 implements MigrationInterface {
  name = 'SlimTripAuditEvents1748400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_audit_events
        ADD COLUMN IF NOT EXISTS from_status text,
        ADD COLUMN IF NOT EXISTS to_status text;
    `);

    await queryRunner.query(`
      UPDATE terminalops.trip_audit_events
      SET
        from_status = COALESCE(
          NULLIF(TRIM(old_value->>'status'), ''),
          'unknown'
        ),
        to_status = COALESCE(
          NULLIF(TRIM(new_value->>'status'), ''),
          'unknown'
        )
      WHERE from_status IS NULL OR to_status IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.trip_audit_events
        ALTER COLUMN from_status SET NOT NULL,
        ALTER COLUMN to_status SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.trip_audit_events
        DROP COLUMN IF EXISTS event_type,
        DROP COLUMN IF EXISTS entity,
        DROP COLUMN IF EXISTS field_name,
        DROP COLUMN IF EXISTS old_value,
        DROP COLUMN IF EXISTS new_value,
        DROP COLUMN IF EXISTS reason_code,
        DROP COLUMN IF EXISTS comment,
        DROP COLUMN IF EXISTS actor_user_id,
        DROP COLUMN IF EXISTS actor_display_name,
        DROP COLUMN IF EXISTS source;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_audit_events
        ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'lifecycle.status.changed',
        ADD COLUMN IF NOT EXISTS entity text NOT NULL DEFAULT 'lifecycle',
        ADD COLUMN IF NOT EXISTS field_name text,
        ADD COLUMN IF NOT EXISTS old_value jsonb,
        ADD COLUMN IF NOT EXISTS new_value jsonb,
        ADD COLUMN IF NOT EXISTS reason_code text,
        ADD COLUMN IF NOT EXISTS comment text,
        ADD COLUMN IF NOT EXISTS actor_user_id integer,
        ADD COLUMN IF NOT EXISTS actor_display_name text NOT NULL DEFAULT 'system',
        ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system';
    `);

    await queryRunner.query(`
      UPDATE terminalops.trip_audit_events
      SET
        field_name = 'status',
        old_value = jsonb_build_object('status', from_status),
        new_value = jsonb_build_object('status', to_status),
        reason_code = 'lifecycle_engine',
        comment = 'Transición automática del motor de lifecycle',
        actor_display_name = 'system',
        source = 'system';
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.trip_audit_events
        DROP COLUMN IF EXISTS from_status,
        DROP COLUMN IF EXISTS to_status;
    `);
  }
}
