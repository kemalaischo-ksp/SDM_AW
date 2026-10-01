# Timeline Launching HRIS Pilot AW3 BSD City

> Target: website pilot live, **aman tampilan** (UI) + **aman data** (backend).
> Jangkar: Senin, 21 Sep 2026. Total **6 minggu** → go-live **2 Nov 2026**.
> Status tiap item: `[ ]` belum · `[x]` selesai.

---

## Ringkasan milestone

| Milestone | Rentang | Keluaran |
|---|---|---|
| M1 — Backend inti & auth | 21–27 Sep | Endpoint aktivasi 3-tahap + login sesi hidup |
| M2 — Integrasi UI↔API + hardening tampilan | 28 Sep–4 Okt | Demo mock dimatikan, UI bicara ke API asli |
| M3 — Keamanan data backend | 5–11 Okt | RBAC, audit, backup/restore teruji |
| M4 — UAT + data riil AW3 | 12–18 Okt | 2 sampel lolos ujung-ke-ujung, NIP final dari HR |
| M5 — Pre-launch & freeze | 19–25 Okt | Check go/no-go lolos, build produksi dikunci |
| M6 — Go-live + hypercare | 26 Okt–2 Nov | Live AW3, pantau 7 hari, serah terima |

---

## M1 — Backend inti & auth (21–27 Sep) — pemilik: engineer — ✅ SELESAI 21 Sep

- [x] `POST /api/login` sesi (ganti mock): hash kata sandi, expiry sesi, lockout brute-force.
- [x] `GET /api/employees` + `POST /api/employees/:id/activate` dengan mesin status
      `draft → diajukan_finance → diverifikasi_doni → aktif` (tolak lompat tahap).
- [x] Validasi server-side: balance THP (cermin CHECK DB) + NIP via `next_nip()`.
- [x] Serve `web/dist/` dari Hono + **SPA fallback** (`/karyawan*` → `index.html`).
- [x] **Exit:** `curl` login→aktivasi→tolak-angka-rusak semuanya berperilaku benar di DB test.
      Bukti: `api/README.md` (bagian Verifikasi M1).

## M2 — Integrasi UI↔API + hardening tampilan (28 Sep–4 Okt) — ✅ SELESAI 21 Sep (dipercepat)

- [x] Set `VITE_API_URL`, matikan jalur mock untuk build produksi (mock hanya `dev`).
      Produksi tanpa URL = fail-closed dengan pesan jelas.
- [x] Guard rute: belum login → `/login`; sesi kedaluwarsa (401) → Toast + redirect.
      Kartu user sidebar tampil dari `/api/me` (bukan statis); logout menghapus cookie server.
- [x] NIK KTP & norek **tidak pernah** dikirim ke frontend (audit response JSON + grep src bersih).
- [x] Slip gaji: mode cetak rapi (print CSS), tanpa data sensitif.
- [x] Responsif: sidebar desktop + nav atas mobile (Tailwind `md:`), diverifikasi DOM + screenshot.
- [x] **Exit:** tur browser penuh lawan API asli tanpa error console.
      Bukti: `web/bukti-m2/` (7 screenshot) + CORS ditambah di `api/src/index.js`.
      Catatan: Lighthouse formal menyusul di M5 (butuh Chrome desktop).

## M3 — Keamanan data backend (5–11 Okt) — ✅ SELESAI 21 Sep (dipercepat)

- [x] RBAC: `master_admin` (semua) · `hr_cabang` (cabangnya) · `pegawai` (miliknya/umum).
      Diuji tiap peran — THP orang lain 403.
- [x] `aktivasi_logs` + `audit_logs` tercatat untuk tiap perubahan THP/status
      (termasuk `oleh_user_id` Doni vs Kemal yang berbeda).
- [x] Backup otomatis harian `pg_dump` (`db/scripts/backup.sh`, retensi 14 hari) +
      **uji restore** ke DB kosong (5 karyawan + status + log utuh).
- [x] Rahasia: hanya `.env.example` di repo; `.env` di-ignore + permission 600 saat dibuat.
- [x] Rate-limit login (10x/10 mnt → 429) + header keamanan dasar.
- [x] **Exit:** simulasi (akses silang peran, THP tak balance, SQLi) semuanya ditolak;
      restore berhasil. Bukti: `api/README.md` (Verifikasi M3).

## M4 — UAT + data riil AW3 (12–18 Okt) — 🟡 MENUNGGU MANUSIA (semua alat siap)

Alat UAT selesai 21 Sep:
- `db/scripts/staging_up.sh` — bangun DB staging dari nol (terverifikasi lokal).
- **`PANDUAN_UAT_AW3.md`** — 6 skenario + tanda tangan HR–Doni–Kemal.
- **`RUNBOOK_OPERASIONAL.md`** — deploy, backup/restore, insiden, rollback, hypercare.

- [ ] **Blocker ditutup:** HR memberi nomor urut NIP 2026 terakhir → `nip_sequences` final.
- [ ] Import CSV riil AW3 via `validate_import.py` (exit 0) → review di UI staging.
- [ ] UAT skenario memakai **`PANDUAN_UAT_AW3.md`** (6 skenario + tanda tangan HR–Doni–Kemal).
- [ ] **Exit:** semua skenario lolos di staging dengan data riil (bukan mock).

## M5 — Pre-launch & freeze (19–25 Okt) — 🟡 SEBAGIAN SIAP (paket produksi jadi)

Paket produksi selesai 21 Sep dan terverifikasi same-origin:
`Dockerfile` (multi-stage: build web + API), `docker-compose.yml`
(PostgreSQL khusus + API), `.env.prod.example`, migrasi mandiri
(`api/migrate.js`: baseline→001→002, tanpa bergantung folder HR 2.0),
verifikasi browser atas build produksi: login + data riil, tanpa error.

- [x] Build produksi final dapat direproduksi (`docker compose up -d --build`).
- [ ] Bekukan scope: tidak ada fitur baru, hanya bug kritis. (mulai 19 Okt)
- [ ] Go/no-go check (semua harus YA):
  1. Backup & restore teruji minggu ini? 2. RBAC lolos? 3. UAT ditandatangani?
  4. NIP final? 5. Akun demo/seed non-produksi dihapus & sandi diganti?
- [ ] Rencana rollback: satu perintah kembali ke build + DB sebelumnya.
- [ ] **Exit:** keputusan GO tertulis dari Kemal.

## M6 — Go-live + hypercare (26 Okt–2 Nov) — pemilik: semua

- [ ] Deploy jam sepi, verifikasi login + 1 aktivasi + 1 slip di produksi.
- [ ] Hypercare 7 hari: cek log error & backup harian tiap pagi.
- [ ] Serah terima: akun peran riil (HR AW3, Doni, Kemal), panduan 1 halaman, kontak darurat.
- [ ] Retro: catat pelajaran untuk replikasi cabang berikutnya.
- [ ] **Exit:** 7 hari tanpa insiden data; dokumen serah terima ditandatangani.

---

## Definisi "AMAN" (kriteria验收)

**Aman tampilan:** tidak ada error console di alur utama · tidak ada data sensitif
(NIK/norek) tampil di layar mana pun · hak tiap peran sesuai (uji silang peran) ·
tampilan rapi di desktop HR & HP · build produksi tanpa jalur mock.

**Aman data:** CHECK balance aktif di DB · transisi status tak bisa dilompati ·
setiap ubah THP tercatat (siapa, kapan, nilai lama→baru) · backup harian + restore
teruji · rahasia di luar repo · rollback siap satu perintah.

---

## Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Nomor urut NIP dari HR telat | M4 tak mulai tanpa ini; pakai NIP sementara hanya di staging |
| Scope merembet (minta fitur baru) | Freeze M5; catat sebagai backlog cabang-2 |
| Satu orang pegang semua (bus factor) | Minimal 2 pemegang akses DB + backup terdokumentasi |
| Data sampel ≠ data riil | UAT wajib data riil AW3, bukan mock |

*File acuan — perbarui `[ ]`→`[x]` tiap selesai. Terakhir diperbarui: 21 Sep 2026.*

## Fitur tambahan (di luar timeline awal, selesai 21 Sep)

**Pengguna & hak akses** (`/pengguna`, butuh `users.kelola`): admin membuat
pengguna (nama, email, peran, unit, kata sandi) + checklist 9 izin tambahan
(bawaan peran dikunci). Izin ditegakkan di API per tahap aktivasi, kunci
payroll, dan audit; tombol UI dinonaktifkan bila izin kurang; akun bisa
dinonaktifkan (login → 403). Terverifikasi curl + browser, bukti
`web/bukti-users/`.

## Fase 2 — Absensi & cuti (selesai 21 Sep, terverifikasi)

Izin baru: `absensi.kelola`, `cuti.ajukan`, `cuti.setujui` (bawaan hr_cabang
ketiganya; pegawai hanya mengajukan). Endpoint: daftar/catat absensi harian
(upsert, scope cabang), ajukan cuti (validasi rentang), setujui/tolak sekali
putus (422 bila diulang). Halaman `/absensi` (tabel + badge + simpan per baris)
dan `/cuti` (form ajukan + tabel persetujuan). Temuan diperbaiki: kolom DATE
dikembalikan sebagai `YYYY-MM-DD` (parser oid 1082) agar tak geser hari di WIB.
Bukti: `web/bukti-fase2/`.
