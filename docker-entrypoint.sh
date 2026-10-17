#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

cd /app
./node_modules/.bin/prisma migrate deploy

cd /app/.next/standalone
exec "$@"
