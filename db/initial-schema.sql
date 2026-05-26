-- TerminalOps relational schema (PostgreSQL) — normalized (3NF)
-- Aligned with frontend domain models (client.models.ts, logistics.models.ts).
-- No JSONB for nested aggregates; child tables with explicit FKs.


CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS terminalops;
SET search_path = terminalops, public;

-- =============================================================================
-- Tenants (empresas de logística con suscripción)
-- =============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  subscription_status text NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled')),
  subscription_plan text,
  subscription_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS companies_name_idx ON companies (name);

-- =============================================================================
-- Users & preferences (por empresa)
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text,
  email text,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'coordinator'
    CHECK (role IN ('admin', 'coordinator', 'operator', 'viewer')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, username)
);
CREATE UNIQUE INDEX IF NOT EXISTS app_user_company_email_uniq
  ON app_user (company_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_user_company_id_idx ON app_user (company_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  operational_analysis_enabled boolean NOT NULL DEFAULT true,
  theme_scheme text NOT NULL DEFAULT 'light' CHECK (theme_scheme IN ('light', 'dark')),
  operational_analysis_changed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Clients (core + 1:1 billing/payment + 1:N contacts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  rfc text,
  relationship_started_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clients_company_id_idx ON clients (company_id);
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients (name);

CREATE TABLE IF NOT EXISTS client_billing (
  client_id uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  invoice_legal_name text,
  tax_regime text,
  fiscal_zip text,
  cfdi_use text,
  billing_email text,
  billing_phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_payment_terms (
  client_id uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  has_credit boolean NOT NULL DEFAULT false,
  credit_days integer CHECK (credit_days IS NULL OR credit_days >= 0),
  approximate_credit_amount text,
  commercial_health text NOT NULL DEFAULT 'not_evaluated'
    CHECK (commercial_health IN ('not_evaluated', 'good_standing', 'watch_list', 'restricted')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  phone text,
  email text,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS client_contacts_client_id_idx ON client_contacts (client_id);

-- =============================================================================
-- Operators (core + 1:1 emergency/insurance + 1:N documents)
-- =============================================================================

CREATE TABLE IF NOT EXISTS operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  portal_username text,
  photo_data_url text,
  birth_date date,
  curp text,
  rfc text,
  license_number text,
  license_expires_on date,
  license_type text NOT NULL DEFAULT 'unspecified'
    CHECK (license_type IN ('federal', 'state', 'both', 'unspecified')),
  license_endorsements text,
  phone text,
  phone_secondary text,
  address text,
  company_hire_date date,
  employment_contract_type text,
  status text NOT NULL DEFAULT 'available',
  insurance_kind text NOT NULL DEFAULT 'none'
    CHECK (insurance_kind IN ('none', 'public', 'private')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS operators_company_portal_username_uniq
  ON operators (company_id, portal_username) WHERE portal_username IS NOT NULL;
CREATE INDEX IF NOT EXISTS operators_company_id_idx ON operators (company_id);
CREATE INDEX IF NOT EXISTS operators_status_idx ON operators (status);

CREATE TABLE IF NOT EXISTS operator_emergency_contacts (
  operator_id uuid PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  relationship text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  authorized_medical_info boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operator_public_insurance (
  operator_id uuid PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
  nss text NOT NULL DEFAULT '',
  imss_alta_date date,
  infonavit boolean NOT NULL DEFAULT false,
  infonavit_credit_number text NOT NULL DEFAULT '',
  fonacot boolean NOT NULL DEFAULT false,
  fonacot_credit_number text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operator_private_insurance (
  operator_id uuid PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
  carrier text NOT NULL DEFAULT '',
  policy_number text NOT NULL DEFAULT '',
  valid_from date,
  valid_to date,
  premium_amount text NOT NULL DEFAULT '',
  premium_period text NOT NULL DEFAULT ''
    CHECK (premium_period IN ('', 'monthly', 'annual', 'other')),
  deductible_notes text NOT NULL DEFAULT '',
  plan_summary text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operator_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('operation', 'insurance')),
  added_at date NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS operator_documents_operator_id_idx ON operator_documents (operator_id);

-- =============================================================================
-- Fleet: units & equipment (core + 1:1 profile + maintenance + document refs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plate text NOT NULL,
  type text NOT NULL,
  capacity_kg integer NOT NULL CHECK (capacity_kg >= 0),
  status text NOT NULL,
  serial_number text,
  name text,
  trailer_brand_abbr text,
  trailer_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS units_company_plate_uniq ON units (company_id, plate);
CREATE INDEX IF NOT EXISTS units_company_id_idx ON units (company_id);
CREATE INDEX IF NOT EXISTS units_status_idx ON units (status);

CREATE TABLE IF NOT EXISTS unit_fleet_profiles (
  unit_id uuid PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
  trailer_brand_name text,
  trailer_version text,
  trailer_color text,
  trailer_tenure_mode text CHECK (trailer_tenure_mode IS NULL OR trailer_tenure_mode IN ('owned', 'financed', 'leased', 'managed')),
  trailer_commercial_value numeric(14,2),
  trailer_recurring_payment_amount numeric(14,2),
  trailer_recurring_payment_date date,
  trailer_recurring_installment_count integer CHECK (trailer_recurring_installment_count IS NULL OR trailer_recurring_installment_count >= 0),
  trailer_management_owner_payout numeric(14,2),
  transmission_type text,
  transmission_speeds text,
  gross_vehicle_weight_lb text,
  odometer_km text,
  last_maintenance_date date,
  last_maintenance_type text,
  last_maintenance_cost numeric(14,2),
  last_maintenance_notes text,
  tire_condition text,
  maintenance_alert_by_km boolean,
  maintenance_next_date_override date,
  maintenance_km_interval numeric(10,2),
  maintenance_trip_km_at_last_service numeric(12,2),
  maintenance_km_remaining numeric(12,2),
  verification_phys_mech_date date,
  verification_phys_mech_cost numeric(14,2),
  verification_emissions_date date,
  verification_emissions_cost numeric(14,2),
  verification_double_articulated_applies boolean,
  verification_double_articulated_date date,
  verification_double_articulated_cost numeric(14,2),
  insurance_policy_number text,
  insurance_payment_cadence text,
  insurance_contract_date date,
  insurance_cost numeric(14,2),
  has_gps boolean,
  gps_provider_brand text,
  gps_price numeric(14,2),
  gps_payment_cadence text,
  gps_contract_date date,
  gps_tracking_portal_url text,
  gps_covered_by_insurance_endorsement boolean,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  name text NOT NULL,
  serial_number text NOT NULL,
  last_service_date date,
  plate text,
  type text,
  status text,
  trailer_brand_abbr text,
  trailer_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS equipment_company_id_idx ON equipment (company_id);
CREATE INDEX IF NOT EXISTS equipment_unit_id_idx ON equipment (unit_id);
CREATE INDEX IF NOT EXISTS equipment_status_idx ON equipment (status);

CREATE TABLE IF NOT EXISTS equipment_fleet_profiles (
  equipment_id uuid PRIMARY KEY REFERENCES equipment(id) ON DELETE CASCADE,
  trailer_brand_name text,
  trailer_version text,
  trailer_color text,
  trailer_tenure_mode text CHECK (trailer_tenure_mode IS NULL OR trailer_tenure_mode IN ('owned', 'financed', 'leased', 'managed')),
  trailer_commercial_value numeric(14,2),
  trailer_recurring_payment_amount numeric(14,2),
  trailer_recurring_payment_date date,
  trailer_recurring_installment_count integer CHECK (trailer_recurring_installment_count IS NULL OR trailer_recurring_installment_count >= 0),
  trailer_management_owner_payout numeric(14,2),
  equipment_capacity_tons text,
  equipment_axle_count integer CHECK (equipment_axle_count IS NULL OR equipment_axle_count >= 0),
  equipment_container_slot_config text,
  equipment_tire_count integer CHECK (equipment_tire_count IS NULL OR equipment_tire_count >= 0),
  last_maintenance_date date,
  last_maintenance_type text,
  last_maintenance_cost numeric(14,2),
  last_maintenance_notes text,
  tire_condition text,
  maintenance_alert_by_km boolean,
  maintenance_next_date_override date,
  maintenance_km_interval numeric(10,2),
  maintenance_trip_km_at_last_service numeric(12,2),
  maintenance_km_remaining numeric(12,2),
  verification_phys_mech_date date,
  verification_phys_mech_cost numeric(14,2),
  equipment_operated_by_agency boolean,
  phys_mech_two_year_exempt_start_date date,
  insurance_policy_number text,
  insurance_payment_cadence text,
  insurance_contract_date date,
  insurance_cost numeric(14,2),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Maintenance history (exactly one owner: unit XOR equipment)
CREATE TABLE IF NOT EXISTS fleet_maintenance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE,
  entry_date date,
  entry_type text,
  cost numeric(14,2) CHECK (cost IS NULL OR cost >= 0),
  notes text,
  status text CHECK (status IS NULL OR status IN ('programado', 'concluido')),
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fleet_maintenance_entries_owner_chk CHECK (
    (unit_id IS NOT NULL AND equipment_id IS NULL)
    OR (unit_id IS NULL AND equipment_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS fleet_maintenance_entries_unit_id_idx ON fleet_maintenance_entries (unit_id);
CREATE INDEX IF NOT EXISTS fleet_maintenance_entries_equipment_id_idx ON fleet_maintenance_entries (equipment_id);

CREATE TABLE IF NOT EXISTS fleet_maintenance_entry_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_entry_id uuid NOT NULL REFERENCES fleet_maintenance_entries(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS fleet_maintenance_entry_documents_entry_idx
  ON fleet_maintenance_entry_documents (maintenance_entry_id);

-- Fleet document references (mock: file names only until object storage)
CREATE TABLE IF NOT EXISTS unit_fleet_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  document_kind text NOT NULL
    CHECK (document_kind IN ('maintenance', 'verification', 'policy', 'ownership')),
  file_name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS unit_fleet_documents_unit_id_idx ON unit_fleet_documents (unit_id);

CREATE TABLE IF NOT EXISTS equipment_fleet_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  document_kind text NOT NULL
    CHECK (document_kind IN ('maintenance', 'verification', 'policy', 'ownership')),
  file_name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS equipment_fleet_documents_equipment_id_idx ON equipment_fleet_documents (equipment_id);

-- =============================================================================
-- Trips (maniobras) + convoy + incidents + attachments
-- =============================================================================

CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  maneuver_code text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES operators(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'in_transit', 'completed', 'cancelled')),
  programmed_at timestamptz NOT NULL,
  scheduled_at timestamptz NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('sencillo', 'full', 'plana')),
  load_type text NOT NULL CHECK (load_type IN ('vacio', 'lleno')),
  container_type text NOT NULL CHECK (container_type IN ('20ft', '40ft', '40hc', 'na')),
  cargo_description text,
  approximate_weight_tons text,
  departure_at timestamptz,
  arrived_at timestamptz,
  return_at timestamptz,
  credit_days integer NOT NULL DEFAULT 0 CHECK (credit_days >= 0),
  has_incident boolean NOT NULL DEFAULT false,
  route_distance_km numeric(10,2),
  maneuver_kind text,
  origin_postal_code text,
  origin_city_municipality text,
  origin_locality text,
  destination_postal_code text,
  destination_city_municipality text,
  destination_locality text,
  operator_license_number text,
  operator_license_expires_label text,
  diesel_liters numeric(12,3),
  diesel_amount numeric(14,2),
  casetas_amount numeric(14,2),
  operator_quota numeric(14,2),
  client_charge numeric(14,2),
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('cash', 'transfer', 'check', 'debit_card', 'credit_card')),
  requires_invoice boolean,
  has_client_billing boolean,
  false_maneuver boolean,
  cancellation_note text,
  client_collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trips_company_maneuver_code_uniq ON trips (company_id, maneuver_code);
CREATE INDEX IF NOT EXISTS trips_company_id_idx ON trips (company_id);
CREATE INDEX IF NOT EXISTS trips_status_idx ON trips (status);
CREATE INDEX IF NOT EXISTS trips_unit_id_idx ON trips (unit_id);
CREATE INDEX IF NOT EXISTS trips_operator_id_idx ON trips (operator_id);
CREATE INDEX IF NOT EXISTS trips_client_id_idx ON trips (client_id);
CREATE INDEX IF NOT EXISTS trips_scheduled_at_idx ON trips (scheduled_at);

CREATE TABLE IF NOT EXISTS trip_equipment (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  position smallint NOT NULL DEFAULT 1 CHECK (position BETWEEN 1 AND 2),
  PRIMARY KEY (trip_id, equipment_id)
);
CREATE INDEX IF NOT EXISTS trip_equipment_trip_idx ON trip_equipment (trip_id);
CREATE INDEX IF NOT EXISTS trip_equipment_equipment_idx ON trip_equipment (equipment_id);

CREATE TABLE IF NOT EXISTS trip_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  description text NOT NULL,
  occurred_at timestamptz NOT NULL,
  posted_by text NOT NULL,
  severity text CHECK (severity IS NULL OR severity IN ('critical', 'high', 'medium', 'low')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_incidents_trip_id_idx ON trip_incidents (trip_id);
CREATE INDEX IF NOT EXISTS trip_incidents_occurred_at_idx ON trip_incidents (occurred_at);

CREATE TABLE IF NOT EXISTS trip_attached_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS trip_attached_documents_trip_id_idx ON trip_attached_documents (trip_id);

-- =============================================================================
-- Expenses
-- =============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  category text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'MXN',
  incurred_at timestamptz NOT NULL,
  kind text NOT NULL,
  description text,
  vendor text,
  payment_method text,
  maintenance_target text CHECK (maintenance_target IS NULL OR maintenance_target IN ('unit', 'equipment')),
  insurance_target text CHECK (insurance_target IS NULL OR insurance_target IN ('unit', 'equipment')),
  related_unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  related_equipment_id uuid REFERENCES equipment(id) ON DELETE SET NULL,
  related_operator_id uuid REFERENCES operators(id) ON DELETE SET NULL,
  verification_scope text CHECK (verification_scope IS NULL OR verification_scope IN ('phys_mech', 'emissions', 'double_articulated')),
  is_operational_provision boolean NOT NULL DEFAULT false,
  invoice_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_company_id_idx ON expenses (company_id);
CREATE INDEX IF NOT EXISTS expenses_trip_id_idx ON expenses (trip_id);
CREATE INDEX IF NOT EXISTS expenses_kind_idx ON expenses (kind);
CREATE INDEX IF NOT EXISTS expenses_incurred_at_idx ON expenses (incurred_at);

