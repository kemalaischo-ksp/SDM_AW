# Runbook Operasional HRIS AW3

> Untuk pemegang akses produksi. Baca ini sebelum menyentuh server produksi.

## 1. Arsitektur singkat

- `hr30` (API Hono + serve `web/dist`, 127.0.0.1:3000) ← Caddy (HTTPS) ← browser
- `hr30-db` (PostgreSQL 16, volume `./data/pg`)
- Skema: baseline HR 2.0 → migrasi `001` (HR 3.0 inti) → … → `012` (hardening auth:
  tabel `sessions` + kolom `users.failed_attempts`/`locked_until`). `node migrate.js`
  menerapkan semuanya (idempoten).

## 2. Deploy normal

```bash
cd "HR 3.0"
docker compose up -d --build
curl http://127.0.0.1:3000/api/health
```

## 3. Backup & restore

```bash
# manual + verifikasi
DATABASE_URL=postgres://hr30:PASS@localhost:5432/hr30_aw3 BACKUP_DIR=./backup ./db/scripts/backup.sh
# otomatis: cron 0 2 * * * (lihat db/scripts/backup.sh)
# restore ke DB baru lalu alihkan:
pg_restore -d hr30_aw3_restore backup/hr30_aw3_TGL.dump
```

## 4. Pengguna & darurat akses

- Kelola via UI `/pengguna` (butuh `users.kelola`).
- **Kunci akun cepat** (tanpa UI): `UPDATE users SET aktif=0 WHERE email='...';`
- **Cabut semua sesi (logout paksa)**: `DELETE FROM sessions WHERE user_id='...';`
  (juga otomatis saat ganti/reset sandi). Sesi tersimpan di tabel `sessions`,
  kedaluwarsa 8 jam.
- **Buka lockout akun**: `UPDATE users SET failed_attempts=0, locked_until=NULL WHERE email='...';`
- **Reset sandi darurat**: buat hash via UI `/pengguna` (kolom sandi baru),
  atau bila terkunci total: `node -e` memakai `hashPassword` lalu UPDATE
  `password_hash` langsung (catat di audit manual). Sandi baru wajib ≥12
  karakter, memuat huruf+angka, bukan sandi umum.
- Akun demo/seed (`admin@…`, `hr.insani@…`, sandi `alwildan123`) **wajib
  diganti/dihapus sebelum go-live** (cek M5).

## 5. Insiden umum

| Gejala | Cek | Aksi |
|---|---|---|
| 502 / tak bisa dibuka | `docker compose ps`, `docker compose logs hr30` | restart `hr30`; bila DB down, cek volume `data/pg` penuh? |
| Login gagal massal | jam server, `AUTH_SECRET` berubah? | sesi hangus bila secret diganti — umumkan login ulang |
| Data THP aneh | `SELECT * FROM aktivasi_logs ORDER BY waktu DESC LIMIT 20` | telusuri `oleh_user_id`; koreksi via alur aktivasi (jangan UPDATE langsung) |
| Lupa NIP terakhir | `SELECT * FROM nip_sequences` | sesuaikan manual hanya bila tabrakan |

## 6. Rollback rilis

`data/pg` adalah bind mount → **aman** dari `docker compose down`.
Untuk kembali ke versi sebelumnya: checkout folder rilis lama →
`docker compose up -d --build`. Bila skema sudah bermigrasi maju dan harus
mundur: restore backup pra-rilis ke DB baru, arahkan `DATABASE_URL` ke situ.

## 7. Hypercare (7 hari pasca go-live, tiap pagi)

1. `curl .../api/health` OK?
2. Backup semalam ada + ukuran wajar?
3. `docker compose logs --since 24h hr30 | grep -i error` bersih?
4. Ada aktivasi `ditolak`/gagal yang butuh tindak lanjut HR?
