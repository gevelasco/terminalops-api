import { DataSource } from 'typeorm';
import dataSource from '../config/migration.config';
import { ensureClientDeliveryMultipleSchema } from './database/ensure-client-delivery-multiple';
import { ensureUserModuleAccessGrantableSchema } from './database/ensure-user-module-access-grantable';

/**
 * Advisory lock global para que solo una instancia corra migraciones a la vez.
 * En un deploy con varias réplicas todas ejecutan este paso al mismo tiempo;
 * sin el lock, dos runners intentarían aplicar la misma migración y una
 * fallaría. Con el lock la segunda espera y luego no encuentra nada pendiente.
 */
const MIGRATION_LOCK_KEY = 74_027_002;
const MIGRATION_LOCK_TIMEOUT_MS = 90_000;

async function acquireMigrationLock(ds: DataSource): Promise<boolean> {
  const deadline = Date.now() + MIGRATION_LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const rows = (await ds.query(`SELECT pg_try_advisory_lock($1) AS locked`, [
      MIGRATION_LOCK_KEY,
    ])) as { locked: boolean | string }[];
    const locked = rows[0]?.locked;
    if (locked === true || locked === 't') {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function main() {
  await dataSource.initialize();
  try {
    const locked = await acquireMigrationLock(dataSource);
    if (!locked) {
      throw new Error(
        `No se pudo tomar el lock de migraciones en ${MIGRATION_LOCK_TIMEOUT_MS / 1000}s. Reintenta el deploy.`,
      );
    }
    try {
      const executed = await dataSource.runMigrations();
      console.log(
        executed.length === 0
          ? 'Migrations: none pending'
          : `Migrations: applied ${executed.length} → ${executed
              .map((m) => m.name)
              .join(', ')}`,
      );
      // Hard ensure: unit document storage columns (covers migrations_list drift).
      await dataSource.query(`
        ALTER TABLE terminalops.unit_fleet_documents
          ADD COLUMN IF NOT EXISTS storage_key text NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.unit_fleet_documents
          ADD COLUMN IF NOT EXISTS content_type text NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.unit_fleet_documents
          ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS unit_fleet_documents_storage_key_idx
          ON terminalops.unit_fleet_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: unit_fleet_documents storage columns OK');
      // Hard ensure: equipment document storage columns (covers migrations_list drift).
      await dataSource.query(`
        ALTER TABLE terminalops.equipment_fleet_documents
          ADD COLUMN IF NOT EXISTS storage_key text NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.equipment_fleet_documents
          ADD COLUMN IF NOT EXISTS content_type text NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.equipment_fleet_documents
          ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS equipment_fleet_documents_storage_key_idx
          ON terminalops.equipment_fleet_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: equipment_fleet_documents storage columns OK');
      // Hard ensure: historial mantenimiento (unidades y equipos; migración 175296).
      await dataSource.query(`
        ALTER TABLE terminalops.fleet_maintenance_entries
          ADD COLUMN IF NOT EXISTS document_file_names text[] NULL;
      `);
      console.log('Schema ensure: fleet_maintenance_entries.document_file_names OK');
      // Hard ensure: trip documents table (covers migrations_list drift).
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.trip_documents (
          id serial PRIMARY KEY,
          trip_id integer NOT NULL REFERENCES terminalops.trips(id) ON DELETE CASCADE,
          document_kind text NOT NULL,
          file_name text NOT NULL,
          storage_key text NULL,
          content_type text NULL,
          size_bytes bigint NULL,
          sort_order smallint NOT NULL DEFAULT 0
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS trip_documents_trip_id_idx
          ON terminalops.trip_documents (trip_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS trip_documents_storage_key_idx
          ON terminalops.trip_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: trip_documents OK');
      // Hard ensure: empty_delivery kind on trip_documents CHECK.
      await dataSource.query(`
        ALTER TABLE terminalops.trip_documents
          DROP CONSTRAINT IF EXISTS trip_documents_kind_chk
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.trip_documents
          ADD CONSTRAINT trip_documents_kind_chk CHECK (
            document_kind IN (
              'load',
              'operational_costs',
              'billing',
              'empty_delivery'
            )
          )
      `);
      console.log('Schema ensure: trip_documents empty_delivery kind OK');
      // Hard ensure: expense documents table (covers migrations_list drift).
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.expense_documents (
          id serial PRIMARY KEY,
          expense_id integer NOT NULL
            REFERENCES terminalops.expenses(id) ON DELETE CASCADE,
          file_name text NOT NULL,
          slot text NOT NULL CHECK (slot IN ('receipt')),
          added_at date NOT NULL,
          sort_order smallint NOT NULL DEFAULT 0,
          storage_key text NULL,
          content_type text NULL,
          size_bytes bigint NULL
        );
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.expense_documents
          ADD COLUMN IF NOT EXISTS storage_key text NULL,
          ADD COLUMN IF NOT EXISTS content_type text NULL,
          ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS expense_documents_expense_id_idx
          ON terminalops.expense_documents (expense_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS expense_documents_storage_key_idx
          ON terminalops.expense_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: expense_documents OK');
      // Hard ensure: client documents (covers migrations_list drift).
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.client_documents (
          id serial PRIMARY KEY,
          client_id integer NOT NULL
            REFERENCES terminalops.clients(id) ON DELETE CASCADE,
          file_name text NOT NULL,
          slot text NOT NULL CHECK (slot IN ('fiscal')),
          added_at date NOT NULL,
          sort_order smallint NOT NULL DEFAULT 0,
          storage_key text NULL,
          content_type text NULL,
          size_bytes bigint NULL
        );
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.client_documents
          ADD COLUMN IF NOT EXISTS storage_key text NULL,
          ADD COLUMN IF NOT EXISTS content_type text NULL,
          ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS client_documents_client_id_idx
          ON terminalops.client_documents (client_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS client_documents_storage_key_idx
          ON terminalops.client_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: client_documents OK');
      // Hard ensure: operator documents storage (covers migrations_list drift).
      await dataSource.query(`
        ALTER TABLE terminalops.operator_documents
          ADD COLUMN IF NOT EXISTS storage_key text NULL,
          ADD COLUMN IF NOT EXISTS content_type text NULL,
          ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS operator_documents_storage_key_idx
          ON terminalops.operator_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: operator_documents storage columns OK');
      // Hard ensure: checklist personal por usuario.
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.user_checklist_todos (
          id serial PRIMARY KEY,
          company_id integer NOT NULL
            REFERENCES terminalops.companies(id) ON DELETE CASCADE,
          user_id integer NOT NULL
            REFERENCES terminalops.app_user(id) ON DELETE CASCADE,
          text text NOT NULL,
          completed boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT user_checklist_todos_text_not_blank
            CHECK (btrim(text) <> '')
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS user_checklist_todos_user_company_idx
          ON terminalops.user_checklist_todos (user_id, company_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS user_checklist_todos_company_created_idx
          ON terminalops.user_checklist_todos (company_id, created_at DESC);
      `);
      console.log('Schema ensure: user_checklist_todos OK');
      // Hard ensure: invitation codes one-time.
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.invitation_codes (
          id serial PRIMARY KEY,
          code text NOT NULL,
          purpose text NOT NULL,
          granted_plan text NOT NULL,
          license_months integer NOT NULL,
          max_uses integer NOT NULL DEFAULT 1,
          used_count integer NOT NULL DEFAULT 0,
          is_active boolean NOT NULL DEFAULT true,
          expires_at timestamptz NULL,
          redeemed_at timestamptz NULL,
          redeemed_by_user_id integer NULL
            REFERENCES terminalops.app_user(id) ON DELETE SET NULL,
          redeemed_by_company_id integer NULL
            REFERENCES terminalops.companies(id) ON DELETE SET NULL,
          note text NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT invitation_codes_code_uidx UNIQUE (code),
          CONSTRAINT invitation_codes_purpose_chk
            CHECK (purpose IN ('signup', 'upgrade')),
          CONSTRAINT invitation_codes_plan_chk
            CHECK (granted_plan IN ('basic', 'standard', 'pro')),
          CONSTRAINT invitation_codes_license_months_chk
            CHECK (license_months >= 1 AND license_months <= 120),
          CONSTRAINT invitation_codes_max_uses_chk
            CHECK (max_uses >= 1),
          CONSTRAINT invitation_codes_used_count_chk
            CHECK (used_count >= 0 AND used_count <= max_uses)
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS invitation_codes_available_idx
          ON terminalops.invitation_codes (purpose, is_active)
          WHERE used_count < max_uses AND is_active = true;
      `);
      await dataSource.query(`
        INSERT INTO terminalops.invitation_codes
          (code, purpose, granted_plan, license_months, max_uses, note)
        VALUES
          ('TX9X-BASI-2026-1V4N', 'signup', 'basic', 6, 1, 'Beta alta #1'),
          ('VK7J-BASI-A995-S4UL', 'signup', 'basic', 6, 1, 'Beta alta #2'),
          ('NBBB-BASI-994A-G3RM', 'signup', 'basic', 6, 1, 'Beta alta #3'),
          ('PX8M-PROX-2026-K4QJ', 'upgrade', 'pro', 6, 1, 'Beta upgrade Pro #1'),
          ('W3HN-PROX-B771-M9VR', 'upgrade', 'pro', 6, 1, 'Beta upgrade Pro #2'),
          ('JC5T-PROX-2026-L2XW', 'upgrade', 'pro', 6, 1, 'Beta upgrade Pro #3')
        ON CONFLICT (code) DO NOTHING;
      `);
      console.log('Schema ensure: invitation_codes OK');
      // Hard ensure: trip.created_by (covers duplicate-timestamp skip of 175090).
      await dataSource.query(`
        ALTER TABLE terminalops.trips
          ADD COLUMN IF NOT EXISTS created_by text NULL;
      `);
      console.log('Schema ensure: trips.created_by OK');
      await dataSource.query(`
        ALTER TABLE terminalops.trips
          ADD COLUMN IF NOT EXISTS cargo_category text NOT NULL DEFAULT 'material',
          ADD COLUMN IF NOT EXISTS container_number text NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.trips
          DROP CONSTRAINT IF EXISTS trips_cargo_category_check;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.trips
          ADD CONSTRAINT trips_cargo_category_check
          CHECK (cargo_category IN (
            'contenedor',
            'material',
            'mineral',
            'liquido',
            'maquinaria',
            'rollos'
          ));
      `);
      console.log('Schema ensure: trips.cargo_category OK');
      await dataSource.query(`
        ALTER TABLE terminalops.unit_fleet_profiles
          ADD COLUMN IF NOT EXISTS approximate_performance_km_l numeric(8,2) NULL;
      `);
      console.log('Schema ensure: unit_fleet_profiles.approximate_performance_km_l OK');
      await dataSource.query(`
        ALTER TABLE terminalops.operators
          ADD COLUMN IF NOT EXISTS weekly_pay_day varchar NULL;
      `);
      console.log('Schema ensure: operators.weekly_pay_day OK');
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.trip_containers (
          id serial PRIMARY KEY,
          trip_id integer NOT NULL
            REFERENCES terminalops.trips(id) ON DELETE CASCADE,
          slot smallint NOT NULL CHECK (slot >= 1 AND slot <= 8),
          container_type text NOT NULL DEFAULT 'na',
          container_number text NULL,
          CONSTRAINT trip_containers_trip_slot_unique UNIQUE (trip_id, slot)
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS trip_containers_trip_id_idx
          ON terminalops.trip_containers (trip_id);
      `);
      console.log('Schema ensure: trip_containers OK');
      // Hard ensure: viáticos en tarifas por destino (covers start:dev skip).
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rate_prices
          ADD COLUMN IF NOT EXISTS per_diem_amount numeric(12, 2) NOT NULL DEFAULT 0;
      `);
      console.log('Schema ensure: destination_rate_prices.per_diem_amount OK');
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rate_prices
          ADD COLUMN IF NOT EXISTS axle_count smallint NULL;
      `);
      await dataSource.query(`
        UPDATE terminalops.destination_rate_prices
        SET axle_count = 5
        WHERE axle_count IS NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rate_prices
          DROP CONSTRAINT IF EXISTS chk_destination_rate_prices_axle_count;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rate_prices
          ADD CONSTRAINT chk_destination_rate_prices_axle_count
          CHECK (
            axle_count IS NULL
            OR (axle_count >= 2 AND axle_count <= 12)
          );
      `);
      console.log('Schema ensure: destination_rate_prices.axle_count OK');
      // Hard ensure: tarifas / mapa maniobras (JSONB casetas y ruta).
      // excluded_toll_plaza_keys eliminado: fuente única = route_toll_plazas.
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          DROP COLUMN IF EXISTS excluded_toll_plaza_keys;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          ADD COLUMN IF NOT EXISTS route_waypoints jsonb NOT NULL DEFAULT '[]'::jsonb;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          ADD COLUMN IF NOT EXISTS route_toll_plazas jsonb NOT NULL DEFAULT '[]'::jsonb;
      `);
      await dataSource.query(`
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
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_toll_plaza_aliases_company
          ON terminalops.toll_plaza_aliases (company_id);
      `);
      console.log('Schema ensure: destination_rates toll/route jsonb OK');
      // Hard ensure: tiempos estimados de tarifa solo en horas (drop estimated_time_unit).
      await dataSource.query(`
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
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          DROP CONSTRAINT IF EXISTS chk_destination_rates_estimated_time_unit;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          DROP COLUMN IF EXISTS estimated_time_unit;
      `);
      console.log('Schema ensure: destination_rates.estimated_time_unit dropped OK');
      // Hard ensure: tabla legacy de adjuntos por entrada de mantenimiento.
      await dataSource.query(`
        DROP TABLE IF EXISTS terminalops.fleet_maintenance_entry_documents;
      `);
      console.log('Schema ensure: fleet_maintenance_entry_documents dropped OK');
      // Hard ensure: bitácora de status de flota legacy (sin writers).
      await dataSource.query(`
        DROP INDEX IF EXISTS terminalops.fleet_status_events_created_at_idx;
      `);
      await dataSource.query(`
        DROP INDEX IF EXISTS terminalops.fleet_status_events_entity_idx;
      `);
      await dataSource.query(`
        DROP TABLE IF EXISTS terminalops.fleet_status_events;
      `);
      console.log('Schema ensure: fleet_status_events dropped OK');
      // Hard ensure: modelo toll_routes* legacy (casetas en destination_rates.route_toll_plazas).
      await dataSource.query(`
        DROP TABLE IF EXISTS terminalops.toll_route_booth_prices;
      `);
      await dataSource.query(`
        DROP TABLE IF EXISTS terminalops.toll_route_booths;
      `);
      await dataSource.query(`
        DROP TABLE IF EXISTS terminalops.toll_routes;
      `);
      console.log('Schema ensure: toll_routes* dropped OK');
      await dataSource.query(`
        DROP TABLE IF EXISTS terminalops.trip_attached_documents;
      `);
      await dataSource.query(`
        DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_trip_id;
      `);
      await dataSource.query(`
        DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_company_id;
      `);
      await dataSource.query(`
        DROP TABLE IF EXISTS terminalops.trip_audit_events;
      `);
      console.log('Schema ensure: trip_attached_documents / trip_audit_events dropped OK');
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          DROP COLUMN IF EXISTS operational_distance_km,
          DROP COLUMN IF EXISTS is_round_trip;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.trips
          DROP COLUMN IF EXISTS operational_distance_km,
          DROP COLUMN IF EXISTS is_round_trip,
          DROP COLUMN IF EXISTS toll_route_id;
      `);
      console.log('Schema ensure: legacy trip/rate distance columns dropped OK');
      // Hard ensure: logo + contacto comercial en Cuenta (cotizaciones PDF).
      await dataSource.query(`
        ALTER TABLE terminalops.companies
          ADD COLUMN IF NOT EXISTS logo_data_url text NULL,
          ADD COLUMN IF NOT EXISTS contact_email varchar(160) NULL,
          ADD COLUMN IF NOT EXISTS contact_phone varchar(40) NULL;
      `);
      console.log('Schema ensure: companies.logo_data_url/contact OK');
      // Hard ensure: política de tarifas (login SELECT company.destination_rate_scope).
      await dataSource.query(`
        ALTER TABLE terminalops.companies
          ADD COLUMN IF NOT EXISTS destination_rate_scope varchar(32)
            NOT NULL DEFAULT 'postal_code';
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          ADD COLUMN IF NOT EXISTS destination_scope varchar(32)
            NOT NULL DEFAULT 'postal_code';
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          ADD COLUMN IF NOT EXISTS route_key_incomplete boolean
            NOT NULL DEFAULT false;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          ADD COLUMN IF NOT EXISTS municipality_name text NOT NULL DEFAULT '';
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.destination_rates
          ADD COLUMN IF NOT EXISTS state_name text NOT NULL DEFAULT '';
      `);
      // Reemplaza el unique viejo (CP+locality) por índices por scope.
      // Sin esto, colapsar a estado/municipio (postal/locality vacíos) rompe el GET.
      await dataSource.query(`
        DROP INDEX IF EXISTS terminalops.uq_destination_rates_company_origin_dest_locality;
      `);
      await dataSource.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_scope_postal
        ON terminalops.destination_rates (
          company_id,
          origin_operational_center_id,
          postal_code,
          lower(btrim(locality))
        )
        WHERE destination_scope = 'postal_code'
          AND route_key_incomplete = false;
      `);
      await dataSource.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_scope_municipality
        ON terminalops.destination_rates (
          company_id,
          origin_operational_center_id,
          lower(btrim(state_name)),
          lower(btrim(municipality_name))
        )
        WHERE destination_scope = 'municipality'
          AND route_key_incomplete = false;
      `);
      await dataSource.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_scope_state
        ON terminalops.destination_rates (
          company_id,
          origin_operational_center_id,
          lower(btrim(state_name))
        )
        WHERE destination_scope = 'state'
          AND route_key_incomplete = false;
      `);
      console.log('Schema ensure: destination_rate_scope / rate geo columns + scope indexes OK');
      // Repara tarifas municipio donde quedó el nombre del estado en municipality_name
      // (migración estado → municipio previa).
      await dataSource.query(`
        UPDATE terminalops.destination_rates
        SET
          state_name = CASE
            WHEN btrim(coalesce(state_name, '')) = ''
              THEN btrim(municipality_name)
            ELSE state_name
          END,
          municipality_name = '',
          city_municipality = CASE
            WHEN btrim(coalesce(state_name, '')) = ''
              THEN btrim(municipality_name)
            ELSE btrim(state_name)
          END,
          route_key_incomplete = true
        WHERE destination_scope = 'municipality'
          AND btrim(coalesce(municipality_name, '')) <> ''
          -- Solo líneas sin "muni, estado" (leak de migración). No tocar
          -- capitales homónimas válidas tipo Puebla / Puebla.
          AND position(',' in coalesce(city_municipality, '')) = 0
          AND (
            lower(btrim(municipality_name)) = lower(btrim(coalesce(state_name, '')))
            OR (
              btrim(coalesce(state_name, '')) = ''
              AND lower(btrim(municipality_name)) = lower(btrim(coalesce(city_municipality, '')))
            )
          );
      `);
      console.log('Schema ensure: municipality_name state-leak repair OK');
      // Hard ensure: avisos de pagos (covers migrations_list drift / login SELECT).
      await dataSource.query(`
        ALTER TABLE terminalops.companies
          ADD COLUMN IF NOT EXISTS payment_reminder_days_before integer NOT NULL DEFAULT 5;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.companies
          DROP CONSTRAINT IF EXISTS companies_payment_reminder_days_before_chk;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.companies
          ADD CONSTRAINT companies_payment_reminder_days_before_chk
          CHECK (payment_reminder_days_before >= 1 AND payment_reminder_days_before <= 15);
      `);
      console.log('Schema ensure: companies.payment_reminder_days_before OK');
      await dataSource.query(`
        ALTER TABLE terminalops.companies
          ADD COLUMN IF NOT EXISTS payment_reminder_days_changed_at timestamptz NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.companies
          ADD COLUMN IF NOT EXISTS trip_auto_payments_changed_at timestamptz NULL;
      `);
      await dataSource.query(`
        UPDATE terminalops.companies
        SET payment_reminder_days_changed_at = COALESCE(
              payment_reminder_days_changed_at,
              operational_analysis_changed_at,
              updated_at,
              created_at
            )
        WHERE payment_reminder_days_changed_at IS NULL;
      `);
      await dataSource.query(`
        UPDATE terminalops.companies
        SET trip_auto_payments_changed_at = COALESCE(
              trip_auto_payments_changed_at,
              operational_analysis_changed_at,
              updated_at,
              created_at
            )
        WHERE trip_auto_payments_changed_at IS NULL;
      `);
      console.log(
        'Schema ensure: companies payment/auto-payments changed_at OK',
      );
      // Hard ensure: clientes soft delete (covers drift / balance-overview SELECT).
      await dataSource.query(`
        ALTER TABLE terminalops.clients
          ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS clients_company_id_is_active_idx
          ON terminalops.clients (company_id, is_active);
      `);
      console.log('Schema ensure: clients.is_active OK');
      // Hard ensure: etiqueta gasto control operativo (covers migrations_list drift / login SELECT).
      await dataSource.query(`
        ALTER TABLE terminalops.companies
          ADD COLUMN IF NOT EXISTS trip_auto_operational_control_label varchar(80) NULL;
      `);
      console.log('Schema ensure: companies.trip_auto_operational_control_label OK');
      // Hard ensure: bitácora incident images table.
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.trip_incident_images (
          id serial PRIMARY KEY,
          trip_incident_id integer NOT NULL
            REFERENCES terminalops.trip_incidents(id) ON DELETE CASCADE,
          file_name text NOT NULL,
          storage_key text NULL,
          content_type text NULL,
          size_bytes bigint NULL,
          sort_order smallint NOT NULL DEFAULT 0
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS trip_incident_images_incident_id_idx
          ON terminalops.trip_incident_images (trip_incident_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS trip_incident_images_storage_key_idx
          ON terminalops.trip_incident_images (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: trip_incident_images OK');
      await dataSource.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.refresh_tokens (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id int NOT NULL REFERENCES terminalops.app_user (id) ON DELETE CASCADE,
          jti uuid NOT NULL,
          token_hash text NOT NULL,
          expires_at timestamptz NOT NULL,
          revoked_at timestamptz NULL,
          replaced_by_jti uuid NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await dataSource.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_jti_uidx
          ON terminalops.refresh_tokens (jti);
      `);
      await dataSource.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_hash_uidx
          ON terminalops.refresh_tokens (token_hash);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
          ON terminalops.refresh_tokens (user_id);
      `);
      console.log('Schema ensure: refresh_tokens OK');
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_trips_company_created_alive
          ON terminalops.trips (company_id, created_at DESC)
          WHERE deleted_at IS NULL
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_trips_company_status_created_alive
          ON terminalops.trips (company_id, status, created_at DESC)
          WHERE deleted_at IS NULL
      `);
      console.log('Schema ensure: trips list created_at indexes OK');
      // Hard ensure: IMSS cobertura operadores (covers migrations_list drift).
      await dataSource.query(`
        ALTER TABLE terminalops.operator_public_insurance
          ADD COLUMN IF NOT EXISTS daily_insured_amount numeric(12,2) NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.operator_public_insurance
          ADD COLUMN IF NOT EXISTS salary_type varchar(16) NULL;
      `);
      console.log('Schema ensure: operator_public_insurance IMSS columns OK');
      // Hard ensure: varios destinos por cliente (covers migrations_list drift).
      await ensureClientDeliveryMultipleSchema((sql) => dataSource.query(sql));
      console.log('Schema ensure: client_delivery multiple OK');
      await dataSource.query(`
        ALTER TABLE terminalops.user_preferences
          ADD COLUMN IF NOT EXISTS notification_feed_modules jsonb NULL;
      `);
      console.log('Schema ensure: user_preferences notification_feed_modules OK');
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.user_push_subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL
            REFERENCES terminalops.app_user(id) ON DELETE CASCADE,
          company_id INT NOT NULL
            REFERENCES terminalops.companies(id) ON DELETE CASCADE,
          endpoint TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_agent TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT uq_user_push_subscriptions_endpoint UNIQUE (endpoint)
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_user_id
          ON terminalops.user_push_subscriptions (user_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_company_id
          ON terminalops.user_push_subscriptions (company_id);
      `);
      console.log('Schema ensure: user_push_subscriptions OK');
      await ensureUserModuleAccessGrantableSchema((sql) => dataSource.query(sql));
      console.log('Schema ensure: user_module_access grantable module codes OK');
    } finally {
      await dataSource.query(`SELECT pg_advisory_unlock($1)`, [
        MIGRATION_LOCK_KEY,
      ]);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
