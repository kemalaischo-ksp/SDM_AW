# Status Proyek & Timeline HRIS AL-WILDAN 3.0 (Pilot AW3)

> Dokumen status hidup — pembaruan terakhir **25 Sep 2026**.
> Menggantikan/melengkapi `TIMELINE_LAUNCHING_AW3.md` (jangkar 21 Sep 2026).
> Target go-live: **2 Nov 2026** di `https://hr.office-alwildan.id`.
> Kode status: `✅ selesai` · `🟡 sebagian` · `⬜ belum` · `🔴 blocker`.

---

## 1. Ringkasan eksekutif

| Aspek | Status | Catatan |
|---|---|---|
| Backend inti (auth, RBAC, aktivasi 3-tahap) | ✅ | Live di staging, terverifikasi curl + browser |
| Frontend (19 halaman operasional) | ✅ | Same-origin build produksi lolos |
| Database (skema + 11 migrasi + seed) | ✅ | Idempoten, upgrade path aman |
| Modul lanjutan (absensi, cuti, pengajuan, KPI, dokumen) | ✅ | Fase 2 & 3 selesai |
| Import SDM otomatis (1.658 baris) | ✅ | Satu perintah + backup + review manual |
| Keamanan data backend | ✅ | RBAC, audit, backup/restore teruji, rate-limit |
| Integrasi email/WA (reset & undangan) | ✅ | Resend + gateway SMTP/Fonnte |
| Infrastruktur produksi (Docker, Caddy, CF) | 🟡 | Paket siap; VPS/DNS/SSL belum final |
| Hardening keamanan lanjutan | 🟡 | 5 item (lihat §5) |
| UAT data riil + tanda tangan HR/Doni/Kemal | ⬜ | Menunggu manusia |
| NIP final 2026 dari HR | 🔴 | Blocker M4 |
| Go-live + hypercare | ⬜ | Setelah UAT & go/no-go |

**Kesimpulan:** pengembangan fitur **~95% selesai**. Sisa pekerjaan bersifat
operasional (UAT, data riil, NIP final) dan hardening keamanan sebelum publik.

---

## 2. Timeline (diperbarui 25 Sep 2026)

| Milestone | Rentang | Status | Progres |
|---|---|---|---|
| M1 — Backend inti & auth | 21–27 Sep | ✅ Selesai 21 Sep | 100% |
| M2 — Integrasi UI↔API + hardening tampilan | 28 Sep–4 Okt | ✅ Selesai 21 Sep (dipercepat) | 100% |
| M3 — Keamanan data backend | 5–11 Okt | ✅ Selesai 21 Sep (dipercepat) | 100% |
| M4 — UAT + data riil AW3 | 12–18 Okt | 🟡 Alat siap, menunggu manusia | 40% |
| M5 — Pre-launch & freeze | 19–25 Okt | 🟡 Paket produksi jadi | 50% |
| M6 — Go-live + hypercare | 26 Okt–2 Nov | ⬜ Belum | 0% |

### M1 — Backend inti & auth ✅
- `POST /api/login` sesi + hash PBKDF2, expiry 8 jam, lockout brute-force.
- `GET /api/employees` + `POST /api/employees/:id/activate` mesin status
  `draft → diajukan_finance → diverifikasi_doni → aktif` (tolak lompat tahap).
- Validasi balance THP server-side + NIP via `next_nip()`.
- Serve `web/dist/` dari Hono + SPA fallback.

### M2 — Integrasi UI↔API ✅
- `VITE_API_URL` + mock dimatikan di build produksi (fail-closed).
- Guard rute, sesi kedaluwarsa → Toast + redirect; kartu user dari `/api/me`.
- NIK KTP & norek tidak pernah dikirim ke frontend.
- Slip gaji mode cetak; responsif desktop + mobile. Bukti: `web/bukti-m2/`.

### M3 — Keamanan data backend ✅
- RBAC 3 peran + scope cabang (uji silang peran → 403).
- `aktivasi_logs` + `audit_logs` setiap perubahan THP/status.
- Backup harian `pg_dump` (retensi 14 hari) + uji restore.
- `.env` di luar repo + permission 600; rate-limit login + header dasar.

### M4 — UAT + data riil AW3 🟡 (alat siap 21 Sep, diperluas 25 Sep)
- ✅ `db/scripts/staging_up.sh`, `PANDUAN_UAT_AW3.md`, `RUNBOOK_OPERASIONAL.md`.
- ✅ `import_sdm.sh` + `import_sdm.py` + migrasi `011` (impor 1.658 baris + review manual).
- ⬜ NIP final 2026 dari HR → `nip_sequences`.
- ⬜ UAT 6 skenario + tanda tangan HR–Doni–Kemal.

### M5 — Pre-launch & freeze 🟡
- ✅ `Dockerfile` multi-stage, `docker-compose.yml` (Postgres + API),
  `.env.prod.example`, `api/migrate.js` mandiri (baseline→001→…→011).
- ⬜ Freeze scope (mulai 19 Okt), go/no-go, rollback teruji, keputusan GO tertulis.

### M6 — Go-live + hypercare ⬜
- Deploy jam sepi, verifikasi login + 1 aktivasi + 1 slip; hypercare 7 hari;
  serah terima akun peran riil; retro.

---

## 3. Status modul yang sudah dikembangkan

### 3.1 Autentikasi & keamanan akun
- ✅ Login sesi (cookie HttpOnly, SameSite=Lax, Secure di prod), logout.
- ✅ **Sesi server-side (migrasi `012`)**: bisa dicabut, logout menghapus sesi di DB,
  ganti/reset sandi otomatis membunuh semua sesi lama.
- ✅ Cookie prefix `__Host-` di produksi (anti cookie-injection).
- ✅ Anti-CSRF: cek `Origin`/`Referer` untuk semua request POST/PUT/PATCH/DELETE.
- ✅ Lockout per-akun (5 gagal → kunci 15 menit) + audit `login_gagal`.
- ✅ Kebijakan sandi: min 12, wajib huruf+angka, tolak sandi umum & memuat email.
- ✅ Lupa & reset kata sandi via **Resend** (token 1x pakai, kedaluwarsa 1 jam, anti-enumerasi).
- ✅ Rate-limit login/forgot/reset (10x/10 menit → 429).
- ✅ Header keamanan dasar + CSP/HSTS/Permissions-Policy.
- ✅ Undangan aktivasi via **email (SMTP/nodemailer)** atau **WhatsApp (gateway Fonnte)**.

### 3.2 Pengguna, peran & izin
- ✅ 3 peran: `master_admin` (semua) · `hr_cabang` (cabangnya) · `pegawai` (miliknya).
- ✅ Katalog **29 izin fitur** + izin tambahan per pengguna (bawaan peran dikunci).
- ✅ Halaman `/pengguna`: buat/edit akun, unit, checklist izin, nonaktifkan akun.
- ✅ Akun sendiri tidak bisa dinonaktifkan/diturunkan.

### 3.3 Master data karyawan
- ✅ Tambah karyawan (Admin pusat) + NIP otomatis `YYNNNN`.
- ✅ Biodata lengkap: NIK (16 digit), alamat, lahir, status kawin, tinggi/berat, bank/norek.
- ✅ Relasi: pendidikan (SMA–S3), pengalaman (maks 3), atasan langsung, cabang & unit.
- ✅ **Import PDF SDM** (`/api/employees/parse`) + AI opsional (OpenAI-compatible/Ollama).
- ✅ **Import batch Excel** satu perintah (1.658 baris) + dedup + `REVIEW_MANUAL.csv`.
- ✅ 32 cabang + unit per jenjang (TK/SD/SMP/SMA) + cabang non-fisik (HOLDING/YAYASAN/LINTAS).

### 3.4 Aktivasi THP 3-tahap
- ✅ Alur `draft → diajukan_finance → diverifikasi_doni → aktif` + tolak.
- ✅ Validasi balance THP server-side (422 bila tak balance) — cermin CHECK DB.
- ✅ Jejak `aktivasi_logs` (siapa, kapan, nilai lama→baru).

### 3.5 Payroll & slip gaji
- ✅ Daftar payroll per periode + scope cabang.
- ✅ Kunci periode (final) + notifikasi slip terbit.
- ✅ Slip gaji mode cetak; pegawai hanya THP bersih miliknya (potongan disembunyikan).

### 3.6 Absensi & presensi
- ✅ Daftar/catat absensi harian (upsert, scope cabang, 6 status).
- ✅ **Presensi mandiri GPS + selfie** (validasi radius kantor via haversine).
- ✅ Rekap presensi: bulanan / mingguan / rentang + hitung terlambat/pulang cepat/lembur.
- ✅ Koreksi presensi (pengajuan karyawan → penerapan otomatis saat disetujui).

### 3.7 Cuti & saldo
- ✅ Ajukan cuti (7 jenis, validasi rentang), setujui/tolak sekali putus.
- ✅ Saldo cuti tahunan + jatah per karyawan; atasan langsung boleh menyetujui bawahan.

### 3.8 Pengajuan seragam (5 jenis)
- ✅ Lembur · Reimbursement · Surat kerja · Perubahan data · Koreksi presensi.
- ✅ Pola seragam: pegawai/menajukan (`*.ajukan`), HR/atasan menyetujui (`*.setujui`).
- ✅ Penerapan otomatis ke `employees`/`absensi` saat disetujui + notifikasi.

### 3.9 Kinerja (KPI)
- ✅ Penilaian per periode (target, skor 1–5, catatan, rencana pengembangan).

### 3.10 Dokumen & arsip
- ✅ Metadata dokumen + monitor kedaluwarsa (60 hari ke depan).
- ✅ Upload arsip (PDF/JPG/PNG/WebP ≤5 MB) nama tak tertebak + cek hak sebelum serve.
- ✅ CV otomatis di-rename ke ID karyawan saat simpan.

### 3.11 Notifikasi & pengumuman
- ✅ Notifikasi dalam aplikasi (belum dibaca + tandai dibaca).
- ✅ Pengumuman (aktif/nonaktif, kelola master_admin & hr_cabang).

### 3.12 Onboarding
- ✅ Checklist 6 item default per karyawan + tandai selesai.

### 3.13 Dashboard & laporan
- ✅ Dashboard ringkas; halaman laporan & rekap.

### 3.14 Pengaturan aplikasi
- ✅ Jam kerja, toleransi telat, lokasi + radius kantor, jatah cuti.
- ✅ Kredensial SMTP/WA (rahasia disamarkan `***` di UI).

### 3.15 Infrastruktur & deploy
- ✅ Docker multi-stage (build web + API + migrasi otomatis), volume arsip & Postgres.
- ✅ Bind `127.0.0.1:3000` (DB/API tidak ter-expose langsung).
- ✅ `migrate.js` idempoten (baseline 00/01 + migrasi 001–011).
- ✅ Panduan deploy Cloudflare + Caddy + runbook operasional.

---

## 4. Statistik proyek (per 25 Sep 2026)

| Item | Jumlah |
|---|---|
| Endpoint API | ±60 (auth, master, aktivasi, absensi, pengajuan, dokumen, dll.) |
| Halaman web | 19 halaman + 3 halaman auth |
| Migrasi DB | 12 (`001`–`012`) + baseline `00_schema`/`01_seed` |
| Izin fitur | 29 kunci |
| Cabang terdaftar | 32 + 3 non-fisik (HOLDING/YAYASAN/LINTAS) |
| Baris SDM terimpor (uji) | 1.658 (data cleansing) |
| Commit | 6 (21–25 Sep 2026) |
| Bukti uji | `web/bukti-m2/`, `web/bukti-fase2/`, `web/bukti-users/` |

---

## 5. Pending & hardening keamanan sebelum go-live

### Blocker operasional
- 🔴 NIP 2026 final dari HR → `nip_sequences`.
- 🟡 UAT 6 skenario + tanda tangan HR/Doni/Kemal.
- 🟡 Akun demo/seed dihapus & sandi diganti sebelum publik.

### Hardening keamanan coding (jelas, wajib)
- ✅ Rate-limit pakai `CF-Connecting-IP`/`X-Real-IP` (helper `clientIp`, anti-spoof XFF).
- ✅ `AUTH_SECRET` fail-fast bila kosong/<32/placeholder saat produksi (`COOKIE_SECURE=1`).
- ✅ Fallback domain diganti ke `hr.office-alwildan.id` (kode + README + `.env.example`).
- ✅ Header `Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy` ditambahkan.
- ✅ Rate-limit `/api/upload` (30/menit) & `/api/employees/parse` (20/menit) per IP.

### Deploy / subdomain
- ⬜ Cloudflare: SSL **Full (strict)** + Always HTTPS + HSTS + Bot Fight Mode + WAF rule
      (`/.env`, `/.git`, `/wp-*` + rate-limit `/api/login`). *Langkah ditulis di `PANDUAN_DEPLOY_CLOUDFLARE.md` Bagian F.*
- ⬜ Caddy reverse proxy (`header_up X-Real-IP`) + UFW (22/80/443) + SSH key-only + fail2ban. *Bagian F.*
- ✅ `rsync` deploy wajib `--exclude '.env'` (jangan bawa kredensial laptop ke VPS).
- ⬜ Backup harian terjadwal di VPS + uji restore produksi.

---

## 6. Riwayat commit

| Tanggal | Commit | Isi |
|---|---|---|
| 23 Sep 2026 | `b532c17` | Initial commit: HR 3.0 (HRIS AL-WILDAN pilot AW3) |
| 23 Sep 2026 | `b630bc0` | Reset kata sandi via Resend + halaman reset-password |
| 23 Sep 2026 | `1c55e6b` | Cabang 27+LAIN per TIC, atasan per cabang, dropzone PDF, login 3 peran, brand KSP-HOLDING |
| 23 Sep 2026 | `df9d203` | Fix docker-compose: pecah baris healthcheck |
| 25 Sep 2026 | `b4c86e2` | Import enrichment SDM 1.658 + tampilkan semua komponen di profil pegawai |
| 25 Sep 2026 | `da207d2` | Import SDM otomatis satu perintah + migrasi 011 |

---

*File acuan status. Perbarui `⬜`→`✅` tiap item selesai. Dokumen terkait:
`TIMELINE_LAUNCHING_AW3.md`, `PANDUAN_UAT_AW3.md`, `RUNBOOK_OPERASIONAL.md`,
`PANDUAN_DEPLOY_CLOUDFLARE.md`, `db/README.md`.*