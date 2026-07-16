#!/usr/bin/env bash
# Restaura el dump local de Grupo VSC en Postgres de Railway (o cualquier remoto).
#
# Uso:
#   export DATABASE_URL='postgresql://user:pass@host:port/railway'
#   npm run db:import-grupo-vsc
#
# Obtén DATABASE_URL en Railway → Postgres → Variables → DATABASE_URL (o Postgres.DATABASE_PUBLIC_URL)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP_DIR="$ROOT/scripts/dumps"
SCHEMA_SQL="$DUMP_DIR/grupo-vsc-schema.sql"
MIGRATIONS_SQL="$DUMP_DIR/grupo-vsc-migrations.sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: define DATABASE_URL (URL pública de Postgres en Railway)." >&2
  echo "Ejemplo:" >&2
  echo "  export DATABASE_URL='postgresql://postgres:...@....railway.app:5432/railway'" >&2
  echo "  npm run db:import-grupo-vsc" >&2
  exit 1
fi

if [[ ! -f "$SCHEMA_SQL" || ! -f "$MIGRATIONS_SQL" ]]; then
  echo "ERROR: faltan dumps. Corre primero: npm run db:export-grupo-vsc" >&2
  exit 1
fi

echo "This will REPLACE terminalops schema on the target DB with your local Grupo VSC dump."
if [[ "${SKIP_CONFIRM:-}" != "1" ]]; then
  read -r -p "Continue? [y/N] " confirm
  if [[ "${confirm:-}" != "y" && "${confirm:-}" != "Y" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

run_psql() {
  docker run --rm -i \
    -e DATABASE_URL="$DATABASE_URL" \
    -v "$DUMP_DIR:/dumps:ro" \
    postgres:16 \
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
}

echo "1/4 Dropping remote terminalops schema..."
run_psql -c 'DROP SCHEMA IF EXISTS terminalops CASCADE;'
echo "2/4 Dropping remote migrations_list..."
run_psql -c 'DROP TABLE IF EXISTS public.migrations_list;'
echo "3/4 Restoring schema + Grupo VSC data..."
run_psql -f /dumps/grupo-vsc-schema.sql
echo "4/4 Restoring migrations_list..."
run_psql -f /dumps/grupo-vsc-migrations.sql

echo
echo "Verifying..."
run_psql -c "SELECT id, name FROM terminalops.companies;" \
  -c "SELECT id, username, email, role FROM terminalops.app_user;"

echo
echo "Done. Restart the API on Railway, then login with:"
echo "  email: gvelasco@test.com"
echo "  password: (the same as local)"
