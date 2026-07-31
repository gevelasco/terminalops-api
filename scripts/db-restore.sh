#!/usr/bin/env bash
# Restaura un backup .sql.gz en la base configurada (¡destructivo!).
#
# Uso:
#   npm run db:restore -- backups/terminalops-YYYYMMDD-HHMMSS.sql.gz
#   CONFIRM_RESTORE=yes npm run db:restore -- backups/terminalops-latest.sql.gz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load-env.sh"
load_env_file "$ROOT/.env"

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  echo "Uso: $0 <archivo.sql.gz>" >&2
  exit 1
fi
if [[ ! -f "$FILE" ]]; then
  # resolver relativo al root
  if [[ -f "$ROOT/$FILE" ]]; then
    FILE="$ROOT/$FILE"
  else
    echo "ERROR: no existe $FILE" >&2
    exit 1
  fi
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USERNAME:-terminalops-developer}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_DATABASE:-terminalops-dev}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "ERROR: DB_PASSWORD vacío." >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Esto SOBRESCRIBE datos en $DB_NAME @ $DB_HOST:$DB_PORT" >&2
  echo "Re-ejecuta con CONFIRM_RESTORE=yes para continuar." >&2
  exit 1
fi

echo "Restoring $FILE → $DB_NAME"

# Limpia schema app (conserva DB); recrea terminalops.
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1)

if [[ -n "${POSTGRES_CONTAINER:-}" ]]; then
  gunzip -c "$FILE" | docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
else
  PGPASSWORD="$DB_PASSWORD" "${PSQL[@]}" -c "DROP SCHEMA IF EXISTS terminalops CASCADE;"
  PGPASSWORD="$DB_PASSWORD" "${PSQL[@]}" -c "CREATE SCHEMA terminalops;"
  gunzip -c "$FILE" | PGPASSWORD="$DB_PASSWORD" "${PSQL[@]}"
fi

echo "OK restore"
