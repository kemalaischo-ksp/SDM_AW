#!/bin/bash
# Bootstrap DB staging UAT: buat ulang dari nol (baseline + 001..003 + seed uji).
# HANYA untuk staging/demo lokal — JANGAN ke produksi.
# Pakai: ./db/scripts/staging_up.sh [nama_db]   (default: hr30_staging)
set -euo pipefail
DB="${1:-hr30_staging}"
PG="psql -h localhost -U kemal -d postgres"

$PG -c "DROP DATABASE IF EXISTS $DB;" -c "CREATE DATABASE $DB;"
DATABASE_URL="postgres://kemal@localhost:5432/$DB" node api/migrate.js --seed
echo "Staging siap: $DB (baseline + migrasi 001..003 + seed AW3)"
echo "Jalankan API: cd api && DATABASE_URL=postgres://kemal@localhost:5432/$DB AUTH_SECRET=staging-saja PORT=4312 node server.js"
