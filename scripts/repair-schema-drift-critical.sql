-- Repair crítico / seguro: aplica DDL faltante SIN tocar migrations_list.
-- Usar SOLO cuando diagnose-schema-drift.sql muestra:
--   mig_*_recorded = true  AND  objeto real ausente
-- (migrations_list adelantado respecto al schema).
--
-- NO re-ejecuta backfills ni DROP de columnas con lógica de datos.
-- Idempotente: se puede correr varias veces.

BEGIN;

-- ---------------------------------------------------------------------------
-- 174800: load_date / load_place + catálogo (desbloquea TripLifecycle cron)
-- ---------------------------------------------------------------------------
ALTER TABLE terminalops.trips
  ADD COLUMN IF NOT EXISTS load_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS load_place text NULL;

CREATE TABLE IF NOT EXISTS terminalops.trip_load_places (
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_normalized text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_load_places_company_name_normalized_key
    UNIQUE (company_id, name_normalized)
);

CREATE INDEX IF NOT EXISTS trip_load_places_company_id_idx
  ON terminalops.trip_load_places (company_id);
CREATE INDEX IF NOT EXISTS trip_load_places_company_id_is_active_idx
  ON terminalops.trip_load_places (company_id, is_active);

-- ---------------------------------------------------------------------------
-- 174810: empty delivery
-- ---------------------------------------------------------------------------
ALTER TABLE terminalops.trips
  ADD COLUMN IF NOT EXISTS empty_delivery_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS empty_delivery_place text NULL;

-- ---------------------------------------------------------------------------
-- 174860 + 174930 shape: verification entries SIN columna status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terminalops.fleet_verification_entries (
  id serial PRIMARY KEY,
  unit_id int REFERENCES terminalops.units(id) ON DELETE CASCADE,
  equipment_id int REFERENCES terminalops.equipment(id) ON DELETE CASCADE,
  scope text NOT NULL,
  entry_date date,
  cost numeric(14, 2),
  notes text,
  payment_method text,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fleet_verification_entries_subject_chk CHECK (
    (unit_id IS NOT NULL AND equipment_id IS NULL)
    OR (unit_id IS NULL AND equipment_id IS NOT NULL)
  ),
  CONSTRAINT fleet_verification_entries_scope_chk CHECK (
    scope IN ('phys_mech', 'emissions', 'double_articulated')
  )
);

-- Si la tabla ya existía con status (parcial 174860), alinear a 174930:
ALTER TABLE terminalops.fleet_verification_entries
  DROP CONSTRAINT IF EXISTS fleet_verification_entries_status_chk;
ALTER TABLE terminalops.fleet_verification_entries
  DROP COLUMN IF EXISTS status;

CREATE INDEX IF NOT EXISTS idx_fleet_verification_entries_unit_id
  ON terminalops.fleet_verification_entries (unit_id);
CREATE INDEX IF NOT EXISTS idx_fleet_verification_entries_equipment_id
  ON terminalops.fleet_verification_entries (equipment_id);

-- ---------------------------------------------------------------------------
-- 174940: dropear flags de expense si siguen presentes
-- (sin UPDATE de backfill: si las columnas ya no existen, no hace falta)
-- ---------------------------------------------------------------------------
ALTER TABLE terminalops.expenses
  DROP COLUMN IF EXISTS maintenance_target,
  DROP COLUMN IF EXISTS insurance_target,
  DROP COLUMN IF EXISTS verification_scope,
  DROP COLUMN IF EXISTS is_operational_provision;

-- ---------------------------------------------------------------------------
-- 174950: índices de query (IF NOT EXISTS)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_expenses_company_discarded_incurred
  ON terminalops.expenses (company_id, discarded_at, incurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_company_kind_discarded
  ON terminalops.expenses (company_id, kind, discarded_at);
CREATE INDEX IF NOT EXISTS idx_expenses_related_unit_id
  ON terminalops.expenses (related_unit_id)
  WHERE related_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_related_equipment_id
  ON terminalops.expenses (related_equipment_id)
  WHERE related_equipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_related_operator_id
  ON terminalops.expenses (related_operator_id)
  WHERE related_operator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_company_status_deleted
  ON terminalops.trips (company_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_trips_company_client_deleted
  ON terminalops.trips (company_id, client_id, deleted_at)
  WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_maint_unit_latest
  ON terminalops.fleet_maintenance_entries (unit_id, sort_order DESC, entry_date DESC)
  WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_maint_equipment_latest
  ON terminalops.fleet_maintenance_entries (equipment_id, sort_order DESC, entry_date DESC)
  WHERE equipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_verif_unit_scope_latest
  ON terminalops.fleet_verification_entries (unit_id, scope, sort_order DESC, entry_date DESC)
  WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_verif_equipment_scope_latest
  ON terminalops.fleet_verification_entries (equipment_id, scope, sort_order DESC, entry_date DESC)
  WHERE equipment_id IS NOT NULL;

COMMIT;

-- Verificación rápida post-repair:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='terminalops' AND table_name='trips'
--     AND column_name IN ('load_date','load_place','empty_delivery_at');
-- SELECT to_regclass('terminalops.fleet_verification_entries');
