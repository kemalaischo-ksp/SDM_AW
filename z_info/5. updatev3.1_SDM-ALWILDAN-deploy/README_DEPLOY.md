# SDM AL-WILDAN — HRIS Holding (Paket Deploy Statis)

Paket ini berisi aplikasi HRIS AL-WILDAN siap di-host sebagai **web statis** (tanpa server aplikasi). Cocok untuk VPS (Nginx/Apache), Cloudflare Pages, atau layanan hosting statis lain.

## Isi paket
- `index.html`   — aplikasi utama (Holding + Portal Karyawan + Rekrutmen + RBAC)
- `data.js`      — data karyawan (window.EMP_DATA)
- `recruit.js`   — data kandidat rekrutmen (window.RECRUIT_DATA)
- `logo.png`     — logo AL-WILDAN
- `template_rekrutmen.csv` — template upload kandidat rekrutmen

## Cara deploy cepat

### A. VPS + Nginx
1. Salin semua file ke folder web, mis. `/var/www/sdm-alwildan/`.
2. Contoh server block Nginx:
   ```nginx
   server {
       listen 80;
       server_name sdm.domainanda.id;
       root /var/www/sdm-alwildan;
       index index.html;
       location / { try_files $uri $uri/ /index.html; }
   }
   ```
3. `sudo nginx -t && sudo systemctl reload nginx`. Aktifkan HTTPS dengan `certbot --nginx`.

### B. Cloudflare Pages / hosting statis
- Upload seluruh isi folder (ZIP) — set `index.html` sebagai halaman utama. Tidak perlu build step.

## Akun demo
- **Master Admin:** `admin` / `alwildan2026`
- **Karyawan:** username = NIP (buat via menu Manajemen Akun → Generate), sandi awal `aw2026`.

> Ganti sandi admin default segera setelah deploy (menu Profil Saya).

## PENTING — Keamanan produksi
Versi ini adalah **prototipe fungsional**. Autentikasi & data disimpan di **browser (localStorage)** tiap perangkat, dengan sandi di-hash SHA-256. Ini cukup untuk demo & finalisasi alur, TETAPI **belum aman untuk data produksi lintas pengguna** (data tidak tersinkron antar-perangkat, dan keamanan sisi-klien bisa dilihat siapa pun).

Untuk produksi, sambungkan ke backend:
1. **Autentikasi:** ganti login localStorage → **Better Auth** (sesi server-side, cookie httpOnly, rate-limit, wajib-ganti-sandi).
2. **Database:** pindahkan data karyawan/akun/rekrutmen/tiket/pengajuan → **Cloudflare D1** (atau PostgreSQL). Ganti fungsi `loadAccts/saveAccts/loadReq/saveReq/loadRecNew/…` dengan panggilan API.
3. **Sinkronisasi:** semua perubahan (mutasi, aktivasi, pengajuan profil, tiket) lewat endpoint API agar konsisten antar-pengguna & perangkat.
4. **RBAC:** enforce izin (`can()`) juga di sisi server, bukan hanya UI.

Struktur data sudah rapi & terpusat lewat fungsi-fungsi kecil, jadi migrasi ke API tinggal mengganti implementasi penyimpanannya.

---
AL-WILDAN ISLAMIC SCHOOL HOLDING · Modul HRIS v1.1
