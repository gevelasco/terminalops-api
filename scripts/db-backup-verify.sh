#!/usr/bin/env bash
# Prueba de backup + restore en una DB temporal (no toca la DB principal).
#
# Uso:
#   npm run db:backup:verify
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load-env.sh"
load_env_file "$ROOT/.env"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USERNAME:-terminalops-developer}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_DATABASE:-terminalops-dev}"
VERIFY_DB="${VERIFY_DB:-terminalops_backup_verify}"
TMP_DIR="${TMPDIR:-/tmp}/terminalops-backup-verify-$$"
BACKUP_FILE="$TMP_DIR/verify.sql.gz"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "ERROR: DB_PASSWORD vacío." >&2
  exit 1
fi

if [[ -z "$POSTGRES_CONTAINER" ]] && ! command -v pg_dump >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'terminalops-postgres'; then
    POSTGRES_CONTAINER=terminalops-postgres
  fi
fi

if [[ -z "$POSTGRES_CONTAINER" ]] && ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: no hay pg_dump en PATH ni contenedor terminalops-postgres." >&2
  echo "       Corre: npm run docker:up" >&2
  exit 1
fi

run_psql_postgres() {
  local sql="$1"
  if [[ -n "$POSTGRES_CONTAINER" ]]; then
    docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
      psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "$sql"
  else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
      -v ON_ERROR_STOP=1 -c "$sql"
  fi
}

run_psql_db() {
  local db="$1"
  local sql="$2"
  if [[ -n "$POSTGRES_CONTAINER" ]]; then
    docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
      psql -U "$DB_USER" -d "$db" -v ON_ERROR_STOP=1 -At -c "$sql"
  else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db" \
      -v ON_ERROR_STOP=1 -At -c "$sql"
  fi
}

cleanup() {
  rm -rf "$TMP_DIR"
  run_psql_postgres "DROP DATABASE IF EXISTS ${VERIFY_DB};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

mkdir -p "$TMP_DIR"

echo "1/4 Dump de $DB_NAME..."
if [[ -n "$POSTGRES_CONTAINER" ]]; then
  docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --schema=terminalops \
    | gzip -c > "$BACKUP_FILE"
else
  PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --schema=terminalops \
    | gzip -c > "$BACKUP_FILE"
fi

SIZE="$(wc -c < "$BACKUP_FILE" | tr -d ' ')"
echo "   dump ok ($SIZE bytes)"

echo "2/4 Creando DB temporal $VERIFY_DB..."
run_psql_postgres "DROP DATABASE IF EXISTS ${VERIFY_DB};" >/dev/null
run_psql_postgres "CREATE DATABASE ${VERIFY_DB};" >/dev/null

echo "3/4 Restore en temporal..."
if [[ -n "$POSTGRES_CONTAINER" ]]; then
  gunzip -c "$BACKUP_FILE" | docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
    psql -U "$DB_USER" -d "$VERIFY_DB" -v ON_ERROR_STOP=1 >/dev/null
else
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" \
    -U "$DB_USER" -d "$VERIFY_DB" -v ON_ERROR_STOP=1 >/dev/null
fi

echo "4/4 Verificando tablas..."
COUNT="$(run_psql_db "$VERIFY_DB" "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'terminalops';")"

if [[ "${COUNT:-0}" -lt 1 ]]; then
  echo "ERROR: restore no dejó tablas en terminalops." >&2
  exit 1
fi

COMPANIES="$(run_psql_db "$VERIFY_DB" "SELECT count(*) FROM terminalops.companies;" 2>/dev/null || echo 0)"

echo "OK verify: tables=$COUNT companies=$COMPANIES"
echo "Backup/restore probado con éxito (DB temporal eliminada al salir)."