#!/usr/bin/env bash
# =====================================================================
# Deploy HRIS SDM AL-WILDAN v3.1 — idempoten, aman untuk pull-deploy.
# Jalankan DI VPS (folder repo):  bash deploy_v31.sh
# 1) git pull branch v31   2) cek PII data di sdm-v31/
# 3) docker compose up -d --build (migrate + seed otomatis di start)
# 4) import data keberadaan   5) health check
# =====================================================================
set -euo pipefail

cd "$(dirname "$0")"
LOG(){ printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
ERR(){ printf '\033[1;31m[deploy]\033[0m %s\n' "$*"; exit 1; }

# 1) ambil kode terbaru
LOG "git pull origin v31"
git fetch origin
git checkout v31 2>/dev/null || true
git pull origin v31

# 2) PII data: data.js + recruit.js diimpor SEKALI dari laptop (scp), bukan via git.
if [ ! -f "sdm-v31/data.js" ] || [ ! -f "sdm-v31/recruit.js" ]; then
  ERR "sdm-v31/data.js atau recruit.js belum ada di VPS.
  Kirim dari laptop (SEKALI):
    scp '5. updatev3.1_SDM-ALWILDAN-deploy/data.js'    ubuntu@IP:~/hr30/sdm-v31/
    scp '5. updatev3.1_SDM-ALWILDAN-deploy/recruit.js' ubuntu@IP:~/hr30/sdm-v31/"
fi

# 3) env produksi
if [ ! -f ".env" ]; then
  cp .env.prod.example .env && chmod 600 .env
  ERR "Isi dulu .env (AUTH_SECRET & DB_PASSWORD): nano .env"
fi

# 4) build & jalan (migrate + seed idempoten di CMD container)
LOG "docker compose up -d --build"
docker compose up -d --build

# 5) tunggu sehat
LOG "tunggu container sehat…"
sleep 20
docker compose ps

# 6) impor data bila tabel kosong (idempoten — tabel terisi akan dilewati).
LOG "impor data (data.js + recruit.js → PostgreSQL)"
DBP=$(grep '^DB_PASSWORD=' .env | cut -d'=' -f2- | tr -d '[:space:]"')
docker compose exec -T hr30 sh -c "cd /app && DATABASE_URL='postgres://hr30:${DBP}@hr30-db:5432/hr30_v31' SDM_DATA_DIR=/app/sdm-v31 node db/scripts/import_v31.js"

# 7) health
LOG "health check"
H=$(curl -s http://127.0.0.1:3000/api/health || true)
echo "$H"
case "$H" in
  *"true"*) LOG "Deploy v3.1 OK ✅" ;;
  *) ERR "Health check gagal — cek: docker compose logs --tail 20 hr30" ;;
esac
