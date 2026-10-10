#!/usr/bin/env bash
# Borra TODO dato operativo + invitation_codes. Deja esquema y migrations_list.
# Tras el wipe, un deploy de API vuelve a insertar códigos beta (migrate.ts ON CONFLICT DO NOTHING).
#
#   CONFIRM_PRD_WIPE=yes npm run db:prd-wipe-tenants
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load-env.sh"
load_env_file "$ROOT/.env"

if [[ "${CONFIRM_PRD_WIPE:-}" != "yes" ]]; then
  echo "Abortado: define CONFIRM_PRD_WIPE=yes para confirmar borrado total." >&2
  exit 1
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USERNAME:-terminalops-developer}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_DATABASE:-terminalops-dev}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-}"

if [[ -z "$DB_PASSWORD" && -z "$POSTGRES_CONTAINER" ]]; then
  echo "Falta DB_PASSWORD (o POSTGRES_CONTAINER)." >&2
  exit 1
fi

run_psql() {
  if [[ -n "$POSTGRES_CONTAINER" ]]; then
    docker exec -i "$POSTGRES_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
  else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
  fi
}

echo "==> PRD wipe total (estructura intacta)"
run_psql <<'SQL'
BEGIN;

TRUNCATE terminalops.refresh_tokens RESTART IDENTITY;
TRUNCATE terminalops.invitation_codes RESTART IDENTITY CASCADE;
TRUNCATE terminalops.companies RESTART IDENTITY CASCADE;

COMMIT;
SQL

echo "==> Listo. Vacía S3 si aplica. Redeploy API para re-sembrar invitation_codes (migrate.ts)."
