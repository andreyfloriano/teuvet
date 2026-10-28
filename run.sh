#!/usr/bin/env bash
# Roda schema.sql + testes de permissão num PostgreSQL local descartável.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres bash tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=teuvet_test_$$
psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/supabase-mock.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/schema.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/permissions.test.sql
