# Panduan Deploy — HRIS SDM AL-WILDAN v3.1 (branch `v31`)

Stack baru: **Hono + PostgreSQL** di Docker VPS yang sama; frontend
`sdm-v31/index.html` (tampilan baru) diintegrasikan ke API `/api/*`
(data TIDAK lagi localStorage). DNS/Caddy/Cloudflare tidak berubah.

## Persiapan sekali (di VPS)

```bash
cd ~/hr30
git fetch origin && git checkout v31 && git pull origin v31
cp .env.prod.example .env && chmod 600 .env
nano .env        # isi AUTH_SECRET + DB_PASSWORD (openssl rand -base64 32)
# kirim data PII (sekali, jangan via git):
#   dari laptop:
#   scp '5. updatev3.1_SDM-ALWILDAN-deploy/data.js'    ubuntu@IP:~/hr30/sdm-v31/
#   scp '5. updatev3.1_SDM-ALWILDAN-deploy/recruit.js' ubuntu@IP:~/hr30/sdm-v31/
chmod +x deploy_v31.sh
```

## Deploy (tiap update)

```bash
cd ~/hr30 && bash deploy_v31.sh
```

Script: `git pull` → pastikan PII ada → `docker compose up -d --build`
(migrasi+seed idempoten di start) → impor `data.js`(1659)+`recruit.js`(239)
bila tabel kosong → health check.

## Verifikasi

```bash
curl http://127.0.0.1:3000/api/health        # {"ok":true,...}
https://hr.office-alwildan.id → login -> admin / alwildan2026 (WAJIB ganti sandi)
- Upload CSV rekrutmen → tracking; Set Gaji → Ajukan → Setujui → jadi karyawan
- Data Karyawan → Buat Akun / Generate Massal → karyawan login via NIP
- Presensi check-in, tiket, pengajuan, profit-approve
```

## Reset total DB (saat ingin mulai dari nol)

```bash
# backup dulu
docker exec hr30-db pg_dump -U hr30 -d hr30_v31 > /root/hr30_v31_pre.sql
docker compose down -v     # WIPE volume pg (destruktif!)
bash deploy_v31.sh         # schema baru + seed + impor
```

## Rollback ke tampilan React lama / versi sebelumnya

```bash
git checkout main && docker compose up -d --build
# (data di ./data/pg tetap; schema lama beda ⇒ restore pg_dump bila perlu)
```

## Catatan keamanan vs paket statis lama

- Sandi: PBKDF2 server, sesi cookie httpOnly `__Host-hr31_session`, lockout, rate-limit.
- RBAC di-enforce server (bukan hanya sembunyikan menu).
- `data.js`/`recruit.js` TIDAK disajikan publik (data via API, scoped PII).
- Peran: `master`(semua) · `kadiv_hr` · `staff_hr` · `karyawan` + izin per-role/akun.
