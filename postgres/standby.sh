#!/bin/sh
set -eu

primary_host="${PRIMARY_HOST:-db}"
primary_port="${PRIMARY_PORT:-5432}"
pguser="${POSTGRES_USER:-ai}"
pgpassword="${POSTGRES_PASSWORD:-ai}"
pgdatabase="${POSTGRES_DB:-ai_chat}"
replicator_password="${REPLICATOR_PASSWORD:-replicator}"
pgdata="${PGDATA:-/var/lib/postgresql/data/pgdata}"

export PGPASSWORD="$pgpassword"
export PGDATA="$pgdata"

echo "waiting for primary ${primary_host}:${primary_port}"
until pg_isready -h "$primary_host" -p "$primary_port" -U "$pguser" -d "$pgdatabase"; do
  sleep 2
done

psql -h "$primary_host" -p "$primary_port" -U "$pguser" -d "$pgdatabase" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '${replicator_password}';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
\$\$;
SQL

if [ ! -s "${pgdata}/PG_VERSION" ]; then
  echo "base backup from ${primary_host}"
  mkdir -p "$pgdata"
  chown postgres:postgres "$pgdata"
  chmod 700 "$pgdata"
  find "$pgdata" -mindepth 1 -maxdepth 1 ! -name lost+found -exec rm -rf {} +
  PGPASSWORD="$replicator_password" gosu postgres pg_basebackup \
    -h "$primary_host" \
    -p "$primary_port" \
    -U replicator \
    -D "$pgdata" \
    -Fp -Xs -P
  touch "${pgdata}/standby.signal"
  printf "primary_conninfo = 'host=%s port=%s user=replicator password=%s'\n" \
    "$primary_host" "$primary_port" "$replicator_password" >> "${pgdata}/postgresql.auto.conf"
  chown -R postgres:postgres "$pgdata"
  chmod 700 "$pgdata"
fi

if [ "${STANDBY_INIT_ONLY:-}" = "1" ]; then
  echo "standby data is ready"
  exit 0
fi

exec gosu postgres postgres -c hot_standby=on
