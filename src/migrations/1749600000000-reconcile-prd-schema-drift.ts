import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reconciliación idempotente del schema PRD cuando `migrations_list` está
 * adelantado respecto al DDL real (p.ej. restore de dump).
 *
 * Solo DDL seguro (IF EXISTS / IF NOT EXISTS). Sin backfills de datos.
 * En DBs ya alineadas (local) es no-op.
 */
export class ReconcilePrdSchemaDrift1749600000000
  implements MigrationInterface
{
  name = 'ReconcilePrdSchemaDrift1749600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Adds (pre-PRD / early) ---
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS tagline varchar NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_asset_tenure
        ADD COLUMN IF NOT EXISTS recurring_payment_cadence varchar NULL,
        ADD COLUMN IF NOT EXISTS recurring_last_payment_date date NULL,
        ADD COLUMN IF NOT EXISTS tenure_beneficiary TEXT;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.expenses
        ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.units
        ADD COLUMN IF NOT EXISTS transport_type text NULL;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trips_company_maneuver_code_uniq;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS trips_company_maneuver_code_uniq
        ON terminalops.trips (company_id, maneuver_code)
        WHERE deleted_at IS NULL;
    `);

    // --- 174800 / 174810 trips load + empty delivery ---
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS load_date timestamptz NULL,
        ADD COLUMN IF NOT EXISTS load_place text NULL,
        ADD COLUMN IF NOT EXISTS empty_delivery_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS empty_delivery_place text NULL;
    `);
    await queryRunner.query(`
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
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_load_places_company_id_idx
        ON terminalops.trip_load_places (company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_load_places_company_id_is_active_idx
        ON terminalops.trip_load_places (company_id, is_active);
    `);

    // --- 174820 cleanup trips legacy columns ---
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP CONSTRAINT IF EXISTS trips_delay_phase_check;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS origin,
        DROP COLUMN IF EXISTS destination,
        DROP COLUMN IF EXISTS operator_license_number,
        DROP COLUMN IF EXISTS operator_license_expires_label,
        DROP COLUMN IF EXISTS is_round_trip,
        DROP COLUMN IF EXISTS operation_configuration_name_snapshot,
        DROP COLUMN IF EXISTS operation_configuration_version_snapshot,
        DROP COLUMN IF EXISTS operation_configuration_max_equipment_count_snapshot,
        DROP COLUMN IF EXISTS operator_name_snapshot,
        DROP COLUMN IF EXISTS unit_operational_code_snapshot,
        DROP COLUMN IF EXISTS diesel_price_per_liter_at_creation,
        DROP COLUMN IF EXISTS toll_calculation_mode,
        DROP COLUMN IF EXISTS toll_route_id,
        DROP COLUMN IF EXISTS route_toll_amount,
        DROP COLUMN IF EXISTS is_delayed,
        DROP COLUMN IF EXISTS delay_phase,
        DROP COLUMN IF EXISTS delay_departure_minutes,
        DROP COLUMN IF EXISTS delay_arrival_minutes,
        DROP COLUMN IF EXISTS delay_completion_minutes,
        DROP COLUMN IF EXISTS operational_distance_km,
        DROP COLUMN IF EXISTS open_incident_count;
    `);

    // --- 174830 slim trip_incidents ---
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trip_incidents_occurred_at_idx;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_incidents
        DROP CONSTRAINT IF EXISTS trip_incidents_severity_check;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_incidents
        DROP COLUMN IF EXISTS occurred_at,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS category,
        DROP COLUMN IF EXISTS opened_at,
        DROP COLUMN IF EXISTS closed_at,
        DROP COLUMN IF EXISTS closed_by_user_id,
        DROP COLUMN IF EXISTS resolution_notes,
        DROP COLUMN IF EXISTS severity;
    `);

    // --- 174840/174850 audit events (drop table; skip slim) ---
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_trip_id;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_company_id;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_audit_events;
    `);

    // --- 174860 + 174930 verification entries (final shape: no status) ---
    await queryRunner.query(`
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
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_verification_entries
        DROP CONSTRAINT IF EXISTS fleet_verification_entries_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_verification_entries
        DROP COLUMN IF EXISTS status;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_verification_entries_unit_id
        ON terminalops.fleet_verification_entries (unit_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_verification_entries_equipment_id
        ON terminalops.fleet_verification_entries (equipment_id);
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS last_maintenance_date,
        DROP COLUMN IF EXISTS last_maintenance_type,
        DROP COLUMN IF EXISTS last_maintenance_cost,
        DROP COLUMN IF EXISTS last_maintenance_notes,
        DROP COLUMN IF EXISTS maintenance_alert_by_km,
        DROP COLUMN IF EXISTS maintenance_next_date_override,
        DROP COLUMN IF EXISTS maintenance_km_interval,
        DROP COLUMN IF EXISTS maintenance_trip_km_at_last_service,
        DROP COLUMN IF EXISTS maintenance_km_remaining,
        DROP COLUMN IF EXISTS verification_phys_mech_date,
        DROP COLUMN IF EXISTS verification_phys_mech_cost,
        DROP COLUMN IF EXISTS verification_emissions_date,
        DROP COLUMN IF EXISTS verification_emissions_cost,
        DROP COLUMN IF EXISTS verification_double_articulated_date,
        DROP COLUMN IF EXISTS verification_double_articulated_cost;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        DROP COLUMN IF EXISTS last_maintenance_date,
        DROP COLUMN IF EXISTS last_maintenance_type,
        DROP COLUMN IF EXISTS last_maintenance_cost,
        DROP COLUMN IF EXISTS last_maintenance_notes,
        DROP COLUMN IF EXISTS maintenance_alert_by_km,
        DROP COLUMN IF EXISTS maintenance_next_date_override,
        DROP COLUMN IF EXISTS maintenance_km_interval,
        DROP COLUMN IF EXISTS maintenance_trip_km_at_last_service,
        DROP COLUMN IF EXISTS maintenance_km_remaining,
        DROP COLUMN IF EXISTS verification_phys_mech_date,
        DROP COLUMN IF EXISTS verification_phys_mech_cost,
        DROP COLUMN IF EXISTS equipment_operated_by_agency,
        DROP COLUMN IF EXISTS phys_mech_two_year_exempt_start_date;
    `);

    // --- 174870 fleet status events ---
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_status_events_created_at_idx;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_status_events_entity_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_status_events;
    `);

    // --- 174880 operators portal_username ---
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.operators_company_portal_username_uniq;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.operators_portal_username_key;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        DROP COLUMN IF EXISTS portal_username;
    `);

    // --- 174890 operators status check (recreate safely) ---
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        DROP CONSTRAINT IF EXISTS operators_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        ADD CONSTRAINT operators_status_chk
        CHECK (status IN (
          'available', 'scheduled', 'in_use', 'leave', 'incapacitated'
        ));
    `);

    // --- 174910 toll routes + destination_rates ---
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_route_booth_prices;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_route_booths;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_routes;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS operational_distance_km,
        DROP COLUMN IF EXISTS is_round_trip;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.uq_destination_rates_company_origin_dest_locality;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_company_origin_dest_locality
        ON terminalops.destination_rates (
          company_id,
          origin_operational_center_id,
          postal_code,
          lower(btrim(locality))
        );
    `);

    // --- 174920 client flags ---
    await queryRunner.query(`
      ALTER TABLE terminalops.client_payment_terms
        DROP COLUMN IF EXISTS commercial_health;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        DROP COLUMN IF EXISTS is_unpriced_route;
    `);

    // --- 174930 residual ---
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_attached_documents;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_maintenance_entry_documents;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.units
        DROP COLUMN IF EXISTS capacity_tons;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        DROP CONSTRAINT IF EXISTS fleet_maintenance_entries_status_check;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        DROP COLUMN IF EXISTS status;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment
        DROP COLUMN IF EXISTS last_service_date;
    `);

    // --- 174940 expense relation flags ---
    await queryRunner.query(`
      ALTER TABLE terminalops.expenses
        DROP COLUMN IF EXISTS maintenance_target,
        DROP COLUMN IF EXISTS insurance_target,
        DROP COLUMN IF EXISTS verification_scope,
        DROP COLUMN IF EXISTS is_operational_provision;
    `);

    // --- 174950 query indexes ---
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_company_discarded_incurred
        ON terminalops.expenses (company_id, discarded_at, incurred_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_company_kind_discarded
        ON terminalops.expenses (company_id, kind, discarded_at);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_related_unit_id
        ON terminalops.expenses (related_unit_id)
        WHERE related_unit_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_related_equipment_id
        ON terminalops.expenses (related_equipment_id)
        WHERE related_equipment_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_related_operator_id
        ON terminalops.expenses (related_operator_id)
        WHERE related_operator_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_company_status_deleted
        ON terminalops.trips (company_id, status, deleted_at);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_company_client_deleted
        ON terminalops.trips (company_id, client_id, deleted_at)
        WHERE client_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_maint_unit_latest
        ON terminalops.fleet_maintenance_entries (unit_id, sort_order DESC, entry_date DESC)
        WHERE unit_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_maint_equipment_latest
        ON terminalops.fleet_maintenance_entries (equipment_id, sort_order DESC, entry_date DESC)
        WHERE equipment_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_verif_unit_scope_latest
        ON terminalops.fleet_verification_entries (unit_id, scope, sort_order DESC, entry_date DESC)
        WHERE unit_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_verif_equipment_scope_latest
        ON terminalops.fleet_verification_entries (equipment_id, scope, sort_order DESC, entry_date DESC)
        WHERE equipment_id IS NOT NULL;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible by design: this migration only reconciles drift forward.
  }
}
