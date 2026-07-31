#!/usr/bin/env bash
# Backup lógico de Postgres (esquema terminalops + migrations_list).
#
# Uso:
#   npm run db:backup
#   BACKUP_DIR=./backups npm run db:backup
#
# Variables (desde .env o entorno):
#   DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_DATABASE
#   POSTGRES_CONTAINER (opcional: si está set, usa docker exec)
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
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/terminalops-${STAMP}.sql.gz"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-}"

mkdir -p "$BACKUP_DIR"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "ERROR: DB_PASSWORD vacío. Define .env o exporta la variable." >&2
  exit 1
fi

# Si no hay pg_dump local, usa el contenedor Docker de desarrollo.
if [[ -z "$POSTGRES_CONTAINER" ]] && ! command -v pg_dump >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'terminalops-postgres'; then
    POSTGRES_CONTAINER=terminalops-postgres
  fi
fi

echo "Backing up $DB_NAME → $OUT_FILE"

if [[ -n "$POSTGRES_CONTAINER" ]]; then
  docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
      --schema=terminalops \
    | gzip -c > "$OUT_FILE"
else
  PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --schema=terminalops \
    | gzip -c > "$OUT_FILE"
fi

SIZE="$(wc -c < "$OUT_FILE" | tr -d ' ')"
if [[ "$SIZE" -lt 100 ]]; then
  echo "ERROR: backup demasiado pequeño ($SIZE bytes)." >&2
  exit 1
fi

ln -sfn "$(basename "$OUT_FILE")" "$BACKUP_DIR/terminalops-latest.sql.gz"
echo "OK backup ($SIZE bytes)"
echo "$OUT_FILE"
