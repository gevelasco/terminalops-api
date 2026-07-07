#!/bin/sh
set -e

HOST="${DB_HOST:-db}"
PORT="${DB_PORT:-5432}"

echo "Waiting for Postgres at $HOST:$PORT..."
until nc -z "$HOST" "$PORT"; do
  sleep 1
done
echo "Postgres is up."

echo "Running migrations..."
npm run migration:run:server

if [ ! -f dist/src/main.js ]; then
  echo "ERROR: dist/src/main.js not found. Image build is incomplete."
  exit 1
fi

echo "Starting API..."
exec node dist/src/main.js
