# Integrasi Produksi — Better Auth + Cloudflare D1
### HRIS SDM AL-WILDAN

Panduan menyambungkan prototipe HRIS (yang kini pakai localStorage) ke backend produksi yang aman: **Better Auth** untuk autentikasi & sesi, **Cloudflare D1** (SQLite) untuk basis data, dijalankan di **Cloudflare Workers**. Arsitektur ini sejalan dengan stack yang sudah Ustadz pakai (Workers + D1).

---

## 1. Arsitektur Target

```
Browser (index.html, data.js, recruit.js)
        │  fetch() JSON + cookie sesi (httpOnly)
        ▼
Cloudflare Worker  ──► Better Auth (login, sesi, hash sandi)
        │
        ▼
Cloudflare D1 (SQLite)  ── tabel: users, employees, accounts,
                            recruit_candidates, requests, activity, sessions
```

Prinsip keamanan yang diperbaiki dari prototipe:
- Sandi di-hash & diverifikasi **di server** (bukan di browser).
- Sesi pakai **cookie httpOnly + SameSite**, tidak bisa dibaca JavaScript.
- **RBAC di-enforce di server** (setiap endpoint cek izin), bukan hanya menyembunyikan menu.
- Data tunggal di D1 → tersinkron antar perangkat & pengguna.

---

## 2. Setup Awal

```bash
npm create cloudflare@latest sdm-alwildan-api
cd sdm-alwildan-api
npm install better-auth
npx wrangler d1 create sdm_alwildan     # catat database_id
```

`wrangler.toml`:
```toml
name = "sdm-alwildan-api"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "DB"
database_name = "sdm_alwildan"
database_id = "<ISI_DARI_OUTPUT_CREATE>"

[vars]
BETTER_AUTH_URL = "https://api.sdm.domainanda.id"

# rahasia: set via `wrangler secret put BETTER_AUTH_SECRET`
```

---

## 3. Skema Tabel D1

Simpan sebagai `schema.sql`, jalankan: `npx wrangler d1 execute sdm_alwildan --file=schema.sql`

```sql
-- ============ AUTH (dikelola Better Auth) ============
CREATE TABLE user (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,
  username      TEXT UNIQUE,          -- NIP untuk karyawan, atau username tim HR
  role          TEXT NOT NULL DEFAULT 'karyawan', -- master|kadiv_hr|staff_hr|karyawan
  unit          TEXT,
  employee_id   TEXT,                 -- FK ke employees.id (nullable utk admin)
  must_change   INTEGER DEFAULT 1,    -- paksa ganti sandi saat login pertama
  created_at    INTEGER NOT NULL
);
CREATE TABLE account (              -- kredensial (hash sandi) — milik Better Auth
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES user(id),
  provider_id   TEXT NOT NULL,        -- 'credential'
  password      TEXT,                 -- hash (scrypt/argon2) oleh Better Auth
  UNIQUE(provider_id, user_id)
);
CREATE TABLE session (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES user(id),
  token         TEXT NOT NULL UNIQUE,
  expires_at    INTEGER NOT NULL,
  ip_address    TEXT, user_agent TEXT
);

-- ============ RBAC (izin berlapis kustom) ============
CREATE TABLE user_permission (        -- override izin per user (opsional)
  user_id  TEXT NOT NULL REFERENCES user(id),
  perm_key TEXT NOT NULL,             -- 'recruitment.edit', dst.
  allowed  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, perm_key)
);

-- ============ DATA SDM ============
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  nip TEXT UNIQUE,                    -- AW.<cabang>.<tahun>.<urut>
  nama TEXT NOT NULL, gender TEXT, gelar TEXT,
  jabatan TEXT, posisi TEXT, unit TEXT, cabang TEXT,
  mapel TEXT, thn_aktif TEXT,
  thp INTEGER DEFAULT 0, gaji_ajuan INTEGER DEFAULT 0,
  thp_kotor INTEGER, thp_bersih INTEGER, tk INTEGER, thr INTEGER,
  nik_ktp TEXT, alamat TEXT, tmp_lahir TEXT, tgl_lahir TEXT, usia TEXT,
  status TEXT, transport TEXT, tinggi TEXT, berat TEXT,
  email TEXT, no_hp TEXT, foto TEXT,
  s1_univ TEXT, s1_prodi TEXT, s1_ipk TEXT, s2_univ TEXT, s3_univ TEXT,
  rek_bsi TEXT, rek_lain TEXT, nama_bank TEXT,
  link_kesehatan TEXT, link_cv TEXT, link_pegawai TEXT,
  gol_darah TEXT, alergi TEXT, riwayat_sakit TEXT, kontak_darurat TEXT,
  status_kerja TEXT DEFAULT 'Aktif',  -- Aktif|Nonaktif|Resign|PTDH
  updated_at INTEGER
);
CREATE TABLE employee_history (       -- riwayat jabatan per tahun + aksi status
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  thn TEXT, aksi TEXT, jabatan TEXT, unit TEXT,
  keterangan TEXT, lampiran TEXT, tgl TEXT, by_user TEXT
);

-- ============ REKRUTMEN ============
CREATE TABLE recruit_candidates (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL, email TEXT, wa TEXT, gender TEXT,
  unit TEXT, cabang_raw TEXT, mapel TEXT, s1 TEXT, s2 TEXT,
  pengajuan INTEGER, thp_kotor INTEGER, thp_bersih INTEGER, thp_set INTEGER,
  tk INTEGER, thr INTEGER, nego TEXT, review TEXT, konfirmasi TEXT,
  status TEXT,                        -- LANJUT|BATAL|HOLD
  pantuhir TEXT,                      -- LULUS PANTUKHIR|AKSELERASI|...
  cv TEXT, kesehatan TEXT, berita_acara TEXT,
  interview TEXT,                     -- Lanjut|Hold|Batal
  interview_note TEXT, interview_tgl TEXT,
  aktivasi TEXT,                      -- (kosong)|diajukan|approved
  tgl_ajuan TEXT, created_by TEXT
);

-- ============ LAYANAN / PENGAJUAN ============
CREATE TABLE requests (               -- tiket, cuti/izin, perubahan profil
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                 -- tiket|ajuan|profil
  employee_id TEXT, nama TEXT, unit TEXT,
  judul TEXT, kategori TEXT, prioritas TEXT, deskripsi TEXT,
  changes TEXT,                       -- JSON diff utk kind=profil
  mulai TEXT, selesai TEXT, alasan TEXT,
  status TEXT DEFAULT 'Menunggu',     -- Menunggu|Diproses|Selesai|Disetujui|Ditolak|Baru
  tgl TEXT, waktu TEXT
);
CREATE TABLE activity (               -- feed aktivitas status
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER, tgl TEXT, aksi TEXT, type TEXT,
  nama TEXT, employee_id TEXT, unit TEXT, keterangan TEXT, by_user TEXT
);
CREATE TABLE attendance (             -- presensi harian (dari SIPRES)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL, tgl TEXT NOT NULL,
  jam_masuk TEXT, jam_pulang TEXT, status TEXT, metode TEXT,
  UNIQUE(employee_id, tgl)
);
```

---

## 4. Konfigurasi Better Auth (Worker)

`src/auth.ts`:
```ts
import { betterAuth } from "better-auth";

export const makeAuth = (env: Env) => betterAuth({
  database: { dialect: "sqlite", db: env.DB },   // adapter D1
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    // login pakai username/NIP, bukan email:
    // aktifkan plugin username Better Auth
  },
  session: {
    cookieName: "sdm_session",
    expiresIn: 60 * 60 * 8,            // 8 jam
    cookie: { httpOnly: true, sameSite: "lax", secure: true },
  },
  rateLimit: { window: 60, max: 5 },  // anti brute-force login
});
```

Peran & izin: simpan `role` di tabel `user`, dan izin kustom di `user_permission`. Buat helper `can(user, key)` di server yang menyalin logika `ROLE_PRESET` dari prototipe.

---

## 5. Endpoint API (contoh)

| Method | Path | Guard | Fungsi |
|---|---|---|---|
| POST | `/api/login` | — | Better Auth sign-in (set cookie) |
| POST | `/api/logout` | sesi | hapus sesi |
| POST | `/api/me/password` | sesi | ganti sandi sendiri |
| GET | `/api/employees` | `employees.view` | daftar karyawan |
| PATCH | `/api/employees/:id` | `employees.edit` | update + tulis `employee_history` |
| POST | `/api/employees/:id/action` | `employees.edit` | mutasi/promosi/resign/PTDH |
| GET | `/api/recruit` | `recruitment.view` | daftar kandidat |
| POST | `/api/recruit/import` | `recruitment.edit` | upload CSV kandidat |
| PATCH | `/api/recruit/:id/interview` | `recruitment.interview` | Lanjut/Hold/Batal |
| POST | `/api/recruit/:id/approve` | `recruitment.approve` | aktivasi → buat `employees` |
| POST | `/api/requests` | sesi | ajukan tiket/cuti/perubahan profil |
| PATCH | `/api/requests/:id` | sesuai jenis | setujui/tolak/proses |
| POST | `/api/accounts/bulk` | `accounts` | generate akun + NIP + sandi acak |

Setiap handler **wajib** memanggil `requireAuth(req)` lalu `requirePerm(user, key)` sebelum menyentuh D1.

---

## 6. Perubahan di Frontend (index.html)

Prototipe sudah memusatkan penyimpanan pada fungsi kecil. Migrasi = ganti isinya jadi `fetch`:

```js
// SEBELUM (localStorage)
function loadAccts(){ return JSON.parse(localStorage.getItem(ACC_KEY))||[] }

// SESUDAH (API)
async function loadAccts(){ const r = await fetch('/api/accounts',{credentials:'include'}); return r.json(); }
```

Fungsi yang perlu diarahkan ke API: `loadAccts/saveAccts`, `loadReq/saveReq`, `loadRecNew/saveRecNew/loadRecOv/saveRecOv`, `loadActivity/pushActivity`, `saveLocal` (employees), `doLogin/logout`, `changeMyPw`, `resetPw`, `createAcct*/generateBulk`, `applyAction`, `approveProfil`, `setInterview`, `approveAktivasi`.
Karena semua sudah async-ready pola pemanggilannya, tinggal tambahkan `await`.

---

## 7. Migrasi Data Awal

- Karyawan: `data.js` (window.EMP_DATA) → `INSERT` ke `employees`. Buat skrip Node membaca JSON lalu batch insert via `wrangler d1 execute`.
- Kandidat: `recruit.js` (window.RECRUIT_DATA) → `recruit_candidates`.
- Akun: generate lewat endpoint `/api/accounts/bulk` (server yang buat hash sandi + NIP).

---

## 8. Checklist Go-Live
- [ ] `BETTER_AUTH_SECRET` di-set via `wrangler secret` (bukan di kode)
- [ ] HTTPS aktif, cookie `secure`
- [ ] Rate-limit login aktif
- [ ] RBAC dicek di setiap endpoint (bukan hanya UI)
- [ ] Sandi admin default diganti
- [ ] `must_change=1` untuk semua akun hasil generate
- [ ] Backup D1 terjadwal (`wrangler d1 export`)
- [ ] Log audit (`activity`) untuk semua aksi sensitif

---
AL-WILDAN ISLAMIC SCHOOL HOLDING · Panduan Integrasi HRIS v1.0
