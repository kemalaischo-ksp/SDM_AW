#!/bin/bash
# Backup harian HRIS AW3 (pg_dump custom format + retensi 14 hari).
# Jadwalkan via cron: 0 2 * * * /path/ke/backup.sh
# Butuh: DATABASE_URL di environment atau .env di folder api/.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f api/.env ]; then set -a; . api/.env; set +a; fi
: "${DATABASE_URL:?DATABASE_URL belum diset}"
: "${BACKUP_DIR:=./backup}"

mkdir -p "$BACKUP_DIR"
TS=$(date +%F_%H%M)
FILE="$BACKUP_DIR/hr30_aw3_$TS.dump"
pg_dump -Fc -f "$FILE" "$DATABASE_URL"
echo "Backup tersimpan: $FILE ($(du -h "$FILE" | cut -f1))"

# Retensi 14 hari
find "$BACKUP_DIR" -name 'hr30_aw3_*.dump' -mtime +14 -delete

# Verifikasi cepat: file dump terbaca pg_restore
pg_restore --list "$FILE" > /dev/null && echo "Verifikasi pg_restore: OK"
