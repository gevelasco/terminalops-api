-- Diagnóstico: schema real vs migrations_list (Railway / Postgres)
-- Schema de negocio: terminalops | historial TypeORM: public.migrations_list
-- Ejecutar en Query / psql y guardar el resultado.

\echo '=== 1. Últimas migraciones registradas ==='
SELECT id, timestamp, name
FROM public.migrations_list
ORDER BY id DESC
LIMIT 25;

\echo '=== 2. Migraciones PRD (>= 174800) en migrations_list ==='
SELECT id, timestamp, name
FROM public.migrations_list
WHERE timestamp::text LIKE '1748%'
   OR timestamp::text LIKE '1749%'
   OR name ILIKE '%LoadDate%'
   OR name ILIKE '%Verification%'
   OR name ILIKE '%ExpenseRelation%'
   OR name ILIKE '%OptimizeExpense%'
ORDER BY timestamp, id;

\echo '=== 3. trips: columnas críticas ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'terminalops'
  AND table_name = 'trips'
  AND column_name IN (
    'load_date', 'load_place',
    'empty_delivery_at', 'empty_delivery_place',
    'origin', 'destination', 'operational_distance_km'
  )
ORDER BY column_name;

\echo '=== 4. trip_load_places existe? ==='
SELECT to_regclass('terminalops.trip_load_places') AS trip_load_places;

\echo '=== 5. fleet_verification_entries ==='
SELECT to_regclass('terminalops.fleet_verification_entries') AS fleet_verification_entries;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'terminalops'
  AND table_name = 'fleet_verification_entries'
ORDER BY ordinal_position;

\echo '=== 6. expenses: flags legacy (deben NO existir tras 174940) ==='
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'terminalops'
  AND table_name = 'expenses'
  AND column_name IN (
    'maintenance_target',
    'insurance_target',
    'verification_scope',
    'is_operational_provision'
  )
ORDER BY column_name;

\echo '=== 7. Tablas que deberían haberse DROPeado ==='
SELECT c.relname AS leftover_table
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'terminalops'
  AND c.relkind = 'r'
  AND c.relname IN (
    'trip_audit_events',
    'fleet_status_events',
    'toll_routes',
    'toll_route_booths',
    'toll_route_booth_prices',
    'trip_attached_documents',
    'fleet_maintenance_entry_documents'
  )
ORDER BY 1;

\echo '=== 8. Índices de performance 174950 ==='
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'terminalops'
  AND indexname IN (
    'idx_expenses_company_discarded_incurred',
    'idx_expenses_company_kind_discarded',
    'idx_expenses_related_unit_id',
    'idx_expenses_related_equipment_id',
    'idx_expenses_related_operator_id',
    'idx_trips_company_status_deleted',
    'idx_trips_company_client_deleted',
    'idx_fleet_maint_unit_latest',
    'idx_fleet_maint_equipment_latest',
    'idx_fleet_verif_unit_scope_latest',
    'idx_fleet_verif_equipment_scope_latest'
  )
ORDER BY 1;

\echo '=== 9. Drift summary (esperado vs real) ==='
SELECT
  EXISTS (
    SELECT 1 FROM public.migrations_list
    WHERE name = 'TripLoadDatePlace1748000000000'
  ) AS mig_174800_recorded,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'terminalops'
      AND table_name = 'trips'
      AND column_name = 'load_date'
  ) AS col_load_date_exists,
  EXISTS (
    SELECT 1 FROM public.migrations_list
    WHERE name = 'FleetVerificationEntriesAndSlimProfiles1748600000000'
  ) AS mig_174860_recorded,
  to_regclass('terminalops.fleet_verification_entries') IS NOT NULL
    AS table_verification_exists,
  EXISTS (
    SELECT 1 FROM public.migrations_list
    WHERE name = 'SlimExpenseRelationFlags1749400000000'
  ) AS mig_174940_recorded,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'terminalops'
      AND table_name = 'expenses'
      AND column_name = 'verification_scope'
  ) AS col_verification_scope_still_present,
  EXISTS (
    SELECT 1 FROM public.migrations_list
    WHERE name = 'OptimizeExpenseTripQueryIndexes1749500000000'
  ) AS mig_174950_recorded,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'terminalops'
      AND indexname = 'idx_expenses_company_discarded_incurred'
  ) AS idx_expenses_list_exists;
