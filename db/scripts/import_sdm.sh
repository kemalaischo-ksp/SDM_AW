#!/usr/bin/env bash
# Import SDM otomatis satu langkah: koneksi -> migrate -> validasi -> backup -> import.
#
# Pakai (dari folder api):
#   npm run import:sdm -- "<file.xlsx>" [--replace]
# atau langsung:
#   bash db/scripts/import_sdm.sh "<file.xlsx>" [--replace]
#
# - Tanpa --replace: ABORT bila sudah ada data SDM riil (baris referensi
#   atasan NIP 900xxx dari migrasi 010 TIDAK dihitung — fail-closed).
# - Dengan --replace: backup pg_dump dulu, lalu hapus semua baris KECUALI
#   referensi atasan 900xxx (termasuk payroll & dokumen milik baris yang
#   diganti — cascade untuk sisanya), lalu insert penuh.
# - Nilai ambigu TIDAK ditebak — dicatat ke laporan review CSV di db/backup/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
XLSX="${1:?Pakai: import_sdm.sh <file.xlsx> [--replace]}"
MODE="${2:-}"

command -v psql >/dev/null || { echo "GAGAL: psql tidak ada di PATH."; exit 2; }
command -v pg_dump >/dev/null || { echo "GAGAL: pg_dump tidak ada di PATH."; exit 2; }
command -v node >/dev/null || { echo "GAGAL: node tidak ada di PATH."; exit 2; }
command -v python3 >/dev/null || { echo "GAGAL: python3 tidak ada di PATH."; exit 2; }
python3 -c "import openpyxl" 2>/dev/null || {
  echo "GAGAL: modul python 'openpyxl' belum ada. Install: pip install openpyxl"
  exit 2
}
[ -f "$XLSX" ] || { echo "GAGAL: file tidak ada: $XLSX"; exit 2; }

# Muat DATABASE_URL dari api/.env (tanpa menimpa env yang sudah ada)
if [ -f "$ROOT/api/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/api/.env"
  set +a
fi
: "${DATABASE_URL:?GAGAL: DATABASE_URL belum diset (cek api/.env).}"

echo "== [1/4] cek koneksi DB"
psql "$DATABASE_URL" -tAc "select 1;" >/dev/null

echo "== [2/4] migrate (dulu, agar skema + tabel guard tersedia)"
DB_DIR="$ROOT/db" node "$ROOT/api/migrate.js"

EMP_COUNT=$(psql "$DATABASE_URL" -tAc \
  "select count(*) from employees where nip NOT LIKE '900%';")
echo "baris SDM riil saat ini (di luar referensi atasan 900xxx): $EMP_COUNT"
if [ "$EMP_COUNT" != "0" ] && [ "$MODE" != "--replace" ]; then
  echo "ABORT: tabel employees sudah terisi ($EMP_COUNT baris data riil)."
  echo "Tambahkan --replace bila memang ingin TIMPA (backup otomatis dibuat dulu;"
  echo "baris referensi atasan NIP 900xxx tetap dipertahankan)."
  exit 1
fi

echo "== [3/4] backup DB"
BACKUP_DIR="$ROOT/db/backup"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
if [ "$MODE" == "--replace" ]; then
  BACKUP_FILE="$BACKUP_DIR/hr30_${STAMP}_before_import.sql"
  pg_dump "$DATABASE_URL" -f "$BACKUP_FILE"
  echo "backup: $BACKUP_FILE"
else
  echo "lewati pg_dump (tabel masih kosong — tidak ada yang perlu dibackup)"
fi

echo "== [4/4] import $XLSX"
BASENAME="$(basename "$XLSX")"
BASENAME="${BASENAME%.*}"
REVIEW_OUT="$BACKUP_DIR/${STAMP}_${BASENAME}_REVIEW_MANUAL.csv"
ARGS=()
[ "$MODE" == "--replace" ] && ARGS+=(--replace)
python3 "$ROOT/db/scripts/import_sdm.py" "$XLSX" "${ARGS[@]}" \
  --review-out "$REVIEW_OUT" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -

echo "SELESAI. Laporan review manual: $REVIEW_OUT"
