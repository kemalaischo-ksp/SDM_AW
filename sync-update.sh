#!/usr/bin/env bash
# sync-update.sh — Terapkan update dari folder staging "1. UPD/" ke root repo.
#
# CARA PAKAI KE DEPAN (tanpa mengubah apa pun yang lain):
#   1) Kerjakan update di folder mana pun; file hasil update taruh di "1. UPD/"
#      dengan struktur path yang sama seperti di repo, contoh:
#        "1. UPD/api/src/routes/mail.js"
#        "1. UPD/sdm-v31/index.html"
#   2) Jalankan dari root repo:  ./sync-update.sh
#      -> semua file di "1. UPD/" disalin ke root repo (menimpa versi lama).
#   3) Commit & push:
#        git add -u && git add docs/ && git commit -m "..." && git push origin v31
#
# Catatan: "1. UPD/" tidak ikut di-commit (folder staging lokal saja, sudah
# di-gitignore). Folder itu aman dibiarkan; isinya dipakai ulang tiap update.
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
STAGING="$REPO/1. UPD"

if [ ! -d "$STAGING" ]; then
  echo "Folder staging tidak ditemukan: $STAGING" >&2
  exit 1
fi

COUNT=0
while IFS= read -r -d '' f; do
  REL="${f#"$STAGING"/}"
  mkdir -p "$REPO/$(dirname "$REL")"
  cp "$f" "$REPO/$REL"
  echo "  diterapkan: $REL"
  COUNT=$((COUNT+1))
done < <(find "$STAGING" -type f -not -name '.DS_Store' -print0)

echo
echo "Selesai — $COUNT file diterapkan ke repo."
echo "Cek perubahan & commit:"
git -C "$REPO" status --porcelain | grep -v '^ D'