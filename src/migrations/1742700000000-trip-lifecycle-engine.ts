import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripLifecycleEngine1742700000000 implements MigrationInterface {
  name = 'TripLifecycleEngine1742700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD COLUMN IF NOT EXISTS planned_departure_at timestamptz,
  ADD COLUMN IF NOT EXISTS planned_arrival_at timestamptz,
  ADD COLUMN IF NOT EXISTS planned_completion_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_delayed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delay_phase text,
  ADD COLUMN IF NOT EXISTS delay_departure_minutes integer,
  ADD COLUMN IF NOT EXISTS delay_arrival_minutes integer,
  ADD COLUMN IF NOT EXISTS delay_completion_minutes integer,
  ADD COLUMN IF NOT EXISTS open_incident_count integer NOT NULL DEFAULT 0;
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET
  planned_departure_at = COALESCE(departure_at, scheduled_at, programmed_at),
  planned_arrival_at = COALESCE(
    arrived_at,
    departure_at,
    scheduled_at,
    programmed_at
  ),
  planned_completion_at = COALESCE(
    return_at,
    arrived_at,
    departure_at,
    scheduled_at,
    programmed_at
  )
WHERE planned_departure_at IS NULL
   OR planned_arrival_at IS NULL
   OR planned_completion_at IS NULL;
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET
  planned_arrival_at = planned_departure_at + interval '1 minute'
WHERE planned_arrival_at <= planned_departure_at;
`);

    await queryRunner.query(`
UPDATE terminalops.trips
SET
  planned_completion_at = planned_arrival_at + interval '1 minute'
WHERE planned_completion_at <= planned_arrival_at;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ALTER COLUMN planned_departure_at SET NOT NULL,
  ALTER COLUMN planned_arrival_at SET NOT NULL,
  ALTER COLUMN planned_completion_at SET NOT NULL;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP CONSTRAINT IF EXISTS trips_delay_phase_check;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD CONSTRAINT trips_delay_phase_check
  CHECK (
    delay_phase IS NULL
    OR delay_phase IN ('none', 'departure', 'arrival', 'completion')
  );
`);

    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS idx_trips_lifecycle_scheduled_departure
  ON terminalops.trips (planned_departure_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_trips_lifecycle_in_transit_completion
  ON terminalops.trips (planned_completion_at)
  WHERE status = 'in_transit';
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trip_incidents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by_user_id integer,
  ADD COLUMN IF NOT EXISTS resolution_notes text;
`);

    await queryRunner.query(`
UPDATE terminalops.trip_incidents
SET
  opened_at = COALESCE(opened_at, occurred_at),
  status = CASE
    WHEN trip_id IN (
      SELECT id FROM terminalops.trips
      WHERE status IN ('scheduled', 'in_transit') AND has_incident = true
    ) THEN 'open'
    ELSE 'closed'
  END,
  closed_at = CASE
    WHEN trip_id IN (
      SELECT id FROM terminalops.trips
      WHERE status IN ('scheduled', 'in_transit') AND has_incident = true
    ) THEN NULL
    ELSE COALESCE(closed_at, occurred_at)
  END;
`);

    await queryRunner.query(`
UPDATE terminalops.trips t
SET open_incident_count = COALESCE((
  SELECT COUNT(*)::int
  FROM terminalops.trip_incidents i
  WHERE i.trip_id = t.id AND i.status = 'open'
), 0);
`);

    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.trip_audit_events (
  id serial PRIMARY KEY,
  trip_id integer NOT NULL REFERENCES terminalops.trips(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity text NOT NULL,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  reason_code text,
  comment text,
  actor_user_id integer,
  actor_display_name text NOT NULL DEFAULT 'system',
  source text NOT NULL DEFAULT 'system',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_audit_events_trip_id
  ON terminalops.trip_audit_events (trip_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_audit_events_company_id
  ON terminalops.trip_audit_events (company_id, occurred_at DESC);
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.trip_audit_events;`);

    await queryRunner.query(`
ALTER TABLE terminalops.trip_incidents
  DROP COLUMN IF EXISTS resolution_notes,
  DROP COLUMN IF EXISTS closed_by_user_id,
  DROP COLUMN IF EXISTS closed_at,
  DROP COLUMN IF EXISTS opened_at,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS status;
`);

    await queryRunner.query(`
DROP INDEX IF EXISTS terminalops.idx_trips_lifecycle_in_transit_completion;
DROP INDEX IF EXISTS terminalops.idx_trips_lifecycle_scheduled_departure;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP CONSTRAINT IF EXISTS trips_delay_phase_check;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP COLUMN IF EXISTS open_incident_count,
  DROP COLUMN IF EXISTS delay_completion_minutes,
  DROP COLUMN IF EXISTS delay_arrival_minutes,
  DROP COLUMN IF EXISTS delay_departure_minutes,
  DROP COLUMN IF EXISTS delay_phase,
  DROP COLUMN IF EXISTS is_delayed,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS status_changed_by,
  DROP COLUMN IF EXISTS status_changed_at,
  DROP COLUMN IF EXISTS planned_completion_at,
  DROP COLUMN IF EXISTS planned_arrival_at,
  DROP COLUMN IF EXISTS planned_departure_at;
`);
  }
}
