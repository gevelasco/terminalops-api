#!/usr/bin/env bash
# Exporta el esquema terminalops (+ migrations_list) desde Postgres local (Docker).
# Uso típico: preservar solo Grupo VSC y subirlo a Railway.
#
# Prerrequisitos:
#   - Contenedor terminalops-postgres corriendo (npm run docker:up)
#   - Preferible: solo exista la empresa "Grupo VSC" (migración KeepOnly ya corrida)
#
# Salida: scripts/dumps/grupo-vsc-schema.sql y grupo-vsc-migrations.sql
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/scripts/dumps"
CONTAINER="${POSTGRES_CONTAINER:-terminalops-postgres}"
DB_USER="${DB_USERNAME:-terminalops-developer}"
DB_NAME="${DB_DATABASE:-terminalops-dev}"
DB_PASSWORD="${DB_PASSWORD:-test1234}"

mkdir -p "$OUT"

echo "Checking companies in local DB..."
COMPANIES="$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -At -c "SELECT id || '|' || name FROM terminalops.companies ORDER BY id;")"
echo "$COMPANIES"

if ! echo "$COMPANIES" | grep -qi 'Grupo VSC'; then
  echo "ERROR: no se encontró la empresa Grupo VSC en la DB local." >&2
  exit 1
fi

EXTRA_COUNT="$(echo "$COMPANIES" | grep -vc '^$' || true)"
if [[ "$EXTRA_COUNT" -gt 1 ]]; then
  echo "WARN: hay más de una empresa. El dump incluirá TODAS."
  echo "      Corre primero la migración KeepOnlyGrupoVscTenant en local si solo quieres Grupo VSC."
fi

echo "Dumping terminalops schema..."
docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --schema=terminalops \
  | sed '/^\\restrict /d; /^\\unrestrict/d' \
  > "$OUT/grupo-vsc-schema.sql"

echo "Dumping migrations_list..."
docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl -t public.migrations_list \
  | sed '/^\\restrict /d; /^\\unrestrict/d' \
  > "$OUT/grupo-vsc-migrations.sql"

echo "Done:"
ls -lh "$OUT/grupo-vsc-schema.sql" "$OUT/grupo-vsc-migrations.sql"
echo
echo "Import a Railway (reemplaza DATABASE_URL por la URL pública de Postgres):"
echo "  psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS terminalops CASCADE;'"
echo "  psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -c 'DROP TABLE IF EXISTS public.migrations_list;'"
echo "  psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -f scripts/dumps/grupo-vsc-schema.sql"
echo "  psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -f scripts/dumps/grupo-vsc-migrations.sql"
echo
echo "Login tras import: usuario local (p. ej. gvelascos) con la misma contraseña que en local."
