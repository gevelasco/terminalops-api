import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reconciliación idempotente para deploy (Nov 2025).
 *
 * Alinea PRD cuando `migrations_list` quedó atrás del código pero el binario
 * ya espera columnas nuevas. Cubre los 5xx vistos en:
 * - login (companies.*)
 * - clients/balance-overview (clients.is_active)
 * - trips/map (destination_rates casetas / ruta)
 * - units & equipment (fleet_maintenance_entries.document_file_names)
 *
 * Seguro si migraciones 175296–175328 ya corrieron (IF NOT EXISTS / IF EXISTS).
 */
export class DeploySchemaReconcile1753290000000 implements MigrationInterface {
  name = 'DeploySchemaReconcile1753290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- companies: login + settings ---
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS trip_auto_operational_control_label varchar(80) NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS payment_reminder_days_before integer NOT NULL DEFAULT 5;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP CONSTRAINT IF EXISTS companies_payment_reminder_days_before_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD CONSTRAINT companies_payment_reminder_days_before_chk
        CHECK (payment_reminder_days_before >= 1 AND payment_reminder_days_before <= 15);
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS payment_reminder_days_changed_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS trip_auto_payments_changed_at timestamptz NULL;
    `);
    await queryRunner.query(`
      UPDATE terminalops.companies
      SET payment_reminder_days_changed_at = COALESCE(
            payment_reminder_days_changed_at,
            operational_analysis_changed_at,
            updated_at,
            created_at
          )
      WHERE payment_reminder_days_changed_at IS NULL;
    `);
    await queryRunner.query(`
      UPDATE terminalops.companies
      SET trip_auto_payments_changed_at = COALESCE(
            trip_auto_payments_changed_at,
            operational_analysis_changed_at,
            updated_at,
            created_at
          )
      WHERE trip_auto_payments_changed_at IS NULL;
    `);

    // --- clients: balance-overview, picker ---
    await queryRunner.query(`
      ALTER TABLE terminalops.clients
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS clients_company_id_is_active_idx
        ON terminalops.clients (company_id, is_active);
    `);

    // --- destination_rates: mapa maniobras + tarifas ---
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'terminalops'
            AND table_name = 'destination_rates'
            AND column_name = 'estimated_time_unit'
        ) THEN
          UPDATE terminalops.destination_rates
          SET estimated_arrival_time_value = estimated_arrival_time_value * 24
          WHERE estimated_time_unit = 'days'
            AND estimated_arrival_time_value IS NOT NULL;
          UPDATE terminalops.destination_rates
          SET estimated_return_time_value = estimated_return_time_value * 24
          WHERE estimated_time_unit = 'days'
            AND estimated_return_time_value IS NOT NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP CONSTRAINT IF EXISTS chk_destination_rates_estimated_time_unit;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS estimated_time_unit;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        ADD COLUMN IF NOT EXISTS excluded_toll_plaza_keys jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        ADD COLUMN IF NOT EXISTS route_waypoints jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'terminalops'
            AND table_name = 'destination_rates'
            AND column_name = 'route_toll_plaza_preview'
        ) THEN
          ALTER TABLE terminalops.destination_rates
            RENAME COLUMN route_toll_plaza_preview TO route_toll_plazas;
        ELSIF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'terminalops'
            AND table_name = 'destination_rates'
            AND column_name = 'route_toll_plazas'
        ) THEN
          ALTER TABLE terminalops.destination_rates
            ADD COLUMN route_toll_plazas jsonb NOT NULL DEFAULT '[]'::jsonb;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS operational_distance_km,
        DROP COLUMN IF EXISTS is_round_trip;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.toll_plaza_aliases (
        id serial PRIMARY KEY,
        company_id int NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
        plaza_key varchar(64) NOT NULL,
        display_name varchar(200) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_toll_plaza_aliases_company_key UNIQUE (company_id, plaza_key)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_toll_plaza_aliases_company
        ON terminalops.toll_plaza_aliases (company_id);
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rate_prices
        ADD COLUMN IF NOT EXISTS per_diem_amount numeric(12, 2) NOT NULL DEFAULT 0;
    `);

    // --- fleet: unidades / equipos (historial mantenimiento) ---
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        ADD COLUMN IF NOT EXISTS document_file_names text[] NULL;
    `);

    // --- trips: columnas legacy ---
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS operational_distance_km,
        DROP COLUMN IF EXISTS is_round_trip,
        DROP COLUMN IF EXISTS toll_route_id;
    `);

    // --- tablas muertas (sin entity) ---
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
      DROP TABLE IF EXISTS terminalops.trip_attached_documents;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_trip_id;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_company_id;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_audit_events;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_status_events_created_at_idx;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_status_events_entity_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_status_events;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_maintenance_entry_documents;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reconciliación de deploy: no revierte (evita reintroducir tablas/columnas muertas).
    void queryRunner;
  }
}