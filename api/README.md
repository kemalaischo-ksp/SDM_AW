# HR 3.0 — API Pilot AW3 (Hono + PostgreSQL)

## Jalankan lokal

```bash
cd "HR 3.0/api"
npm install
cp .env.example .env   # isi DATABASE_URL + AUTH_SECRET
npm run migrate:seed   # 001 + 002 + seed AW3 (butuh skema dasar HR 2.0 dulu)
npm run dev            # http://localhost:3000 (serve API + web/dist)
```

`PUBLIC_DIR` default `../web/dist` — bangun frontend dulu (`npm run build` di `web/`).
Rute non-API otomatis fallback ke `index.html` (SPA).

## Endpoint (M1)

| Method | Endpoint | Peran |
|---|---|---|
| GET | `/api/health` | publik |
| POST | `/api/login` `{email,password}` / `{identifier,password}` | publik (rate-limit 10x/10 mnt + lockout per-akun 5x/15 mnt; sesi server-side, cookie `__Host-` di produksi) |
| POST | `/api/logout` · GET `/api/me` | login (logout mencabut sesi di DB) |
| POST | `/api/forgot-password` `{email}` | publik (rate-limit; selalu respons generik; kirim tautan 1 jam via Resend bila `RESEND_API_KEY` diset) |
| POST | `/api/reset-password` `{token,password≥12}` | publik (rate-limit; token 1x pakai; mencabut semua sesi lama) |
| GET | `/api/employees`, `/api/employees/:id` | scope cabang; tanpa NIK/norek |
| POST | `/api/employees` `{nama_gelar,unit_id,…,atasan_id?,cabang_lainnya?}` | karyawan.tambah (cabang diturunkan dari unit; cabang_lainnya hanya bila unit cabang LAIN) |
| POST | `/api/employees/:id/buatkan-akun` `{email?,password?,role?}` | users.kelola (scope cabang; password kosong = acak 12 char dikembalikan sekali; 409 bila sudah punya akun) |
| POST | `/api/employees/bulk-akun` `{role?,cabang?,password?}` | users.kelola (scope cabang; buatkan akun semua tanpa akun + email valid; kredensial dikembalikan sekali) |
| POST | `/api/employees/bulk-reset` `{cabang?}` | users.kelola (scope cabang; acak ulang semua akun tertaut kecuali master_admin & diri sendiri; dikembalikan sekali) |
| DELETE | `/api/employees/:id` | karyawan.tambah (tolak 422 bila punya payroll / masih atasan; akun tertaut ikut terhapus) |
| GET | `/api/statistik` | laporan.lihat/karyawan.lihat (master_admin semua, hr_cabang cabangnya; per cabang, divisi, pendidikan, gender) |
| POST | `/api/employees/:id/activate` | mesin 3-tahap (bawah) |
| GET | `/api/employees/:id/aktivasi-log` | hr_cabang (cabangnya), master_admin |
| GET | `/api/permission-catalog` | users.kelola (9 izin + bawaan peran) |
| GET | `/api/units` | users.kelola (penempatan unit) |
| GET | `/api/users` | users.kelola |
| POST | `/api/users` `{email,name,role,password≥12,permissions,unit_id}` | users.kelola |
| PATCH | `/api/users/:id` `{name,role,unit_id,permissions,aktif,password}` | users.kelola (tak bisa nonaktifkan diri; ganti sandi mencabut sesi target) |
| GET | `/api/absensi?tanggal=` | absensi.kelola (scope cabang) |
| POST | `/api/absensi` `{employee_id,tanggal,status,keterangan}` | absensi.kelola (upsert) |
| GET | `/api/presensi-saya` | presensi.mandiri (milik sendiri + riwayat 30 hari) |
| GET | `/api/profil-saya` | login tertaut karyawan (data miliknya tanpa NIK; termasuk rekening sendiri) |
| POST | `/api/presensi-saya` `{aksi: masuk/pulang, lat, lng, foto}` | presensi.mandiri (GPS+selfie wajib, radius kantor; 422 bila ganda/di luar radius) |
| GET/PUT | `/api/pengaturan` | pengaturan.kelola (master_admin; jam kerja, titik kantor, radius, jatah cuti) |
| GET | `/api/rekap-presensi?bulan=` | laporan.lihat/absensi.kelola (ringkasan + terlambat/pulang-cepat + tanpa keterangan) |
| GET | `/api/rekap-presensi?dari=&sampai=` | sama — rentang harian/mingguan (ikut lembur disetujui + kolom tidak_hadir) |
| GET | `/api/cuti-saldo` | cuti.ajukan (miliknya) / cuti.setujui (scope cabang) |
| PUT | `/api/cuti-saldo/:employee_id` `{tahun,jatah}` | cuti.setujui |
| GET/POST | `/api/riwayat-jabatan` | baca karyawan.lihat / tulis karyawan.kelola (`terapkan` opsional) |
| PATCH | `/api/employees/:id/data-kerja` `{atasan_id,tgl_masuk,status_kerja,foto_url,kontak_darurat}` | karyawan.kelola |
| GET/POST/PATCH | `/api/lembur`, `/api/reimbursement`, `/api/surat`, `/api/perubahan-data` | ajukan miliknya (`*.ajukan`) / putus scope cabang (`*.setujui` + notifikasi; ubahdata disetujui → diterapkan otomatis) |
| GET/POST/PATCH | `/api/koreksi-presensi` | ajukan koreksi jam check-in/out (`koreksi.ajukan`) / putus (`koreksi.setujui`; disetujui → jam absensi diperbarui otomatis) |
| GET | `/api/cuti` | (lihat tabel endpoint M1 di bawah) |
| PATCH | `/api/cuti/:id` | cuti.setujui (scope) ATAU atasan langsung bawahan tersebut |
| GET/POST | `/api/penilaian` | pegawai (miliknya) / kpi.kelola (scope cabang; skor 1–5) |
| GET/POST | `/api/notifikasi`, `/api/notifikasi/baca` | login (miliknya; pengajuan diputus & payroll dikunci mengirim notif) |
| GET/POST/PATCH | `/api/pengumuman` | baca login / tulis hr_cabang+master_admin |
| GET/PATCH | `/api/onboarding` | baca karyawan.lihat (auto-inisiasi checklist) / tulis karyawan.kelola |
| GET/POST/PATCH/DELETE | `/api/documents` (+ `GET /api/documents/kedaluwarsa`) | baca karyawan.lihat / tulis karyawan.kelola |
| POST | `/api/upload` (multipart `file` + `employee_id?`) | HR scope cabang / pegawai miliknya (PDF/JPG/PNG/WebP ≤5 MB → `/api/arsip/:nama`) |
| GET | `/api/arsip/:nama` | pemilik / HR scope (disajikan inline) |
| POST | `/api/users/:id/undang` `{via: email/wa, tujuan?}` | users.kelola (sandi sementara + kirim SMTP/WA; 422 bila gateway belum dikonfigurasi) |
| GET | `/api/cuti` | cuti.ajukan (miliknya + bawahan bila atasan) / cuti.setujui (cabang) |
| POST | `/api/cuti` `{jenis,tgl_mulai,tgl_selesai,keterangan}` | cuti.ajukan (jenis: tahunan/sakit/keluarga/tugas_luar/terlambat/melahirkan/lainnya) |
| PATCH | `/api/cuti/:id` `{status: disetujui/ditolak}` | cuti.setujui (scope) atau atasan langsung (sekali putus) |

## Izin fitur (migrasi 003)

`users.permissions` = izin **tambahan** di luar bawaan peran (master_admin =
semua; hr_cabang = karyawan.lihat, aktivasi.ajukan, payroll.lihat, slip.lihat;
pegawai = slip.lihat). Tahap aktivasi, kunci payroll, dan audit kini cek izin
(bukan peran keras). Halaman admin `/pengguna` menampilkan checklist ini.
| GET | `/api/payroll?periode=` · POST `/api/payroll/lock` | baca scope / kunci master_admin |
| GET | `/api/audit` | master_admin |

## Mesin aktivasi (`status_aktivasi`)

`draft|ditolak → diajukan_finance` (hr_cabang, master_admin) →
`diverifikasi_doni` (master_admin) → `aktif` (master_admin).
Penolakan (`ditolak`) oleh master_admin dari tahap mana pun.
Aturan keras: angka tak balance → **422**; lompat tahap → **422**;
HR cabang lain → **403**. Tiap transisi menulis `aktivasi_logs` + `audit_logs`.

**Akun:** Doni & Kemal masing-masing memakai akun `master_admin` sendiri
(jejak `oleh_user_id` membedakan orangnya).

## Deploy produksi (Docker)

```bash
cd "HR 3.0"
cp .env.prod.example .env && chmod 600 .env   # isi AUTH_SECRET + DB_PASSWORD
docker compose up -d --build
curl http://127.0.0.1:3000/api/health
```

Reverse proxy (Caddy, HTTPS otomatis) di depan 127.0.0.1:3000:

```
hr.office-alwildan.id {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Real-IP {remote_host}
    }
}
```

Catatan: `docker compose` butuh Docker di server produksi (Mac ini tak ada Docker,
jadi image belum di-build di sini — build pertama terjadi di server).
Rollback: `docker compose down && docker volume rm` TIDAK menghapus `data/pg`
(bind mount aman); untuk kembali ke versi lama, checkout folder versi lama +
`docker compose up -d --build` ulang.

## Backup

```bash
# manual
DATABASE_URL=... BACKUP_DIR=./backup ../db/scripts/backup.sh
# harian via cron
0 2 * * * cd "HR 3.0" && DATABASE_URL=... ./db/scripts/backup.sh
# restore
pg_restore -d hr30_aw3_baru backup/hr30_aw3_TGL.dump
```

## Verifikasi M1 (21 Sep 2026, PostgreSQL 16 lokal — DB test, sudah dibersihkan)

- login admin + daftar pegawai tanpa field sensitif: OK
- angka rusak → 422 `DITOLAK: THP bersih…`: OK
- lompat `diajukan_finance → aktif` → 422: OK
- alur sah doni → kemal → `aktif`: OK (+ jejak 3 baris)
- HR unit lain sentuh AW3 → 403 `Bukan cabang Anda`: OK
- SPA fallback `/karyawan/260002` → 200 halaman UI: OK

## Verifikasi M3 (21 Sep 2026 — DB test, sudah dibersihkan)

- pegawai: daftar = miliknya saja (5 field), detail orang lain 403, activate 403, audit 403: OK
- hr_cabang: daftar = unitnya saja (tanpa AW3): OK
- Doni verifikasi → Kemal aktifkan, jejak `oleh u-doni / u-kemal` berbeda orang: OK
- SQLi login → 401 biasa (parameterized): OK
- 11x login salah → 10× 401 lalu **429**: OK
- header `nosniff / DENY / no-referrer`: OK
- backup `pg_dump -Fc` + restore ke DB kosong: 5 karyawan + status + log utuh: OK
- repo bersih: hanya `.env.example`, tanpa `.env`/rahasia (di-ignore): OK
