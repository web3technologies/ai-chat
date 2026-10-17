#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "OPENAI_API_KEY is not set. The agent will stay quiet." >&2
fi

cd /app
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/tsx scripts/seedUsers.ts

cd /app/.next/standalone
exec "$@"
