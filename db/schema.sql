-- =====================================================================
-- HRIS SDM AL-WILDAN v3.1 — skema fresh (PostgreSQL 16)
-- Sumber kebenaran: UI sdm-v31 + import data.js / recruit.js.
-- Idempoten: CREATE ... IF NOT EXISTS (dijalankan tiap start container).
-- Dipanggil oleh api/migrate.js.
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'karyawan',  -- master|kadiv_hr|staff_hr|karyawan
  nama            TEXT NOT NULL DEFAULT '',
  unit            TEXT,
  emp_id          TEXT,
  nip             TEXT UNIQUE,
  must_change     INTEGER NOT NULL DEFAULT 0,
  aktif           INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    BIGINT,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  ip         TEXT,
  ua         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);

-- Izin berlapis: preset per role (bisa dikustom master) + override per pengguna.
CREATE TABLE IF NOT EXISTS role_perms (
  role     TEXT NOT NULL,
  perm_key TEXT NOT NULL,
  PRIMARY KEY (role, perm_key)
);

CREATE TABLE IF NOT EXISTS user_perms (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perm_key TEXT NOT NULL,
  allowed  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, perm_key)
);

CREATE TABLE IF NOT EXISTS employees (
  id          TEXT PRIMARY KEY,           -- id string (pola data.js "1".."1659")
  nip         TEXT UNIQUE,                -- AW.<cabang>.<tahun>.<urutan>, dihasilkan server
  nama        TEXT NOT NULL,
  jabatan     TEXT,
  gender      TEXT,
  gelar       TEXT,
  mapel       TEXT,
  mapel_guru  TEXT,
  thn_aktif   TEXT,
  tgl_aktif   TEXT,
  thp         BIGINT NOT NULL DEFAULT 0,
  thp_kotor   BIGINT NOT NULL DEFAULT 0,
  thp_bersih  BIGINT NOT NULL DEFAULT 0,
  thr         BIGINT NOT NULL DEFAULT 0,
  tk          BIGINT NOT NULL DEFAULT 0,
  gaji_ajuan  BIGINT NOT NULL DEFAULT 0,
  unit        TEXT,
  cabang      TEXT,
  posisi      TEXT,
  nik_ktp     TEXT,
  alamat      TEXT,
  tmp_lahir   TEXT,
  tgl_lahir   TEXT,
  usia        TEXT,
  status      TEXT,
  transport   TEXT,
  tinggi      TEXT,
  berat       TEXT,
  email       TEXT,
  no_hp       TEXT,
  s1_univ     TEXT,
  s1_prodi    TEXT,
  s1_ipk      TEXT,
  s2_univ     TEXT,
  s2_prodi    TEXT,
  s3_univ     TEXT,
  rek_bsi     TEXT,
  rek_lain    TEXT,
  nama_bank   TEXT,
  link_kesehatan TEXT,
  link_cv     TEXT,
  link_pegawai TEXT,
  photo       TEXT,
  gol_darah       TEXT,
  kontak_darurat  TEXT,
  alergi          TEXT,
  riwayat_sakit   TEXT,
  status_kerja TEXT NOT NULL DEFAULT 'Aktif', -- Aktif|Nonaktif|Resign|PTDH
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emp_unit ON employees(unit);
CREATE INDEX IF NOT EXISTS idx_emp_status ON employees(status_kerja);

CREATE TABLE IF NOT EXISTS employee_history (
  id      BIGSERIAL PRIMARY KEY,
  emp_id  TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  aksi    TEXT NOT NULL,
  tgl     TEXT,
  ket     TEXT,
  file    TEXT,
  by_user TEXT
);
CREATE INDEX IF NOT EXISTS idx_eh_emp ON employee_history(emp_id);

CREATE TABLE IF NOT EXISTS job_history (
  id      BIGSERIAL PRIMARY KEY,
  emp_id  TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  thn     TEXT,
  jabatan TEXT,
  unit    TEXT,
  aksi    TEXT
);
CREATE INDEX IF NOT EXISTS idx_jh_emp ON job_history(emp_id);

CREATE TABLE IF NOT EXISTS recruit_candidates (
  id            TEXT PRIMARY KEY,          -- "C1".., kandidat baru pakai "N<ts>"
  no            TEXT,
  nama          TEXT NOT NULL,
  email         TEXT,
  wa            TEXT,
  cv            TEXT,
  kesehatan     TEXT,
  gender        TEXT,
  status        TEXT,
  pantuhir      TEXT,
  unit          TEXT,
  cabang_raw    TEXT,
  mapel         TEXT,
  s1            TEXT,
  s2            TEXT,
  pengajuan     BIGINT NOT NULL DEFAULT 0,
  review        TEXT,
  thp_kotor     BIGINT NOT NULL DEFAULT 0,
  thp_set       BIGINT NOT NULL DEFAULT 0,
  konfirmasi    TEXT,
  thp_bersih    BIGINT NOT NULL DEFAULT 0,
  tk            BIGINT NOT NULL DEFAULT 0,
  thr           BIGINT NOT NULL DEFAULT 0,
  nego          TEXT,
  berita_acara  TEXT,
  interview     TEXT,                   -- Lanjut|Hold|Batal
  interview_note TEXT,
  interview_tgl TEXT,
  interview_by  TEXT,
  interview_log JSONB,                  -- [{tgl,hasil,note,by}]
  pantuhir_note TEXT,
  estimasi      TEXT,
  estimasi_aktif TEXT,
  estimasi_note TEXT,
  aktivasi      TEXT NOT NULL DEFAULT '',   -- '' | diajukan | approved
  tgl_ajuan     TEXT,
  created_by    TEXT,
  created_at    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recruit_status ON recruit_candidates(status);
CREATE INDEX IF NOT EXISTS idx_recruit_aktivasi ON recruit_candidates(aktivasi);

CREATE TABLE IF NOT EXISTS recruit_log (
  id            BIGSERIAL PRIMARY KEY,
  candidate_id  TEXT,
  tgl           TEXT,
  aksi          TEXT NOT NULL,
  note          TEXT,
  by_user       TEXT,
  created_at    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recruit_log_cand ON recruit_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_recruit_log_ts ON recruit_log(created_at DESC);

-- Migrasi nyaman utk DB existing: kolom baru ditambahkan bila blm ada (idempoten).
ALTER TABLE recruit_candidates ADD COLUMN IF NOT EXISTS interview_by  TEXT;
ALTER TABLE recruit_candidates ADD COLUMN IF NOT EXISTS interview_log JSONB;
ALTER TABLE recruit_candidates ADD COLUMN IF NOT EXISTS pantuhir_note TEXT;
ALTER TABLE recruit_candidates ADD COLUMN IF NOT EXISTS estimasi       TEXT;
ALTER TABLE recruit_candidates ADD COLUMN IF NOT EXISTS estimasi_aktif TEXT;
ALTER TABLE recruit_candidates ADD COLUMN IF NOT EXISTS estimasi_note  TEXT;

CREATE TABLE IF NOT EXISTS requests (
  id         TEXT PRIMARY KEY,           -- REQ/TKT/PRF + timestamp
  kind       TEXT NOT NULL,              -- ajuan | tiket | profil
  emp_id     TEXT,
  nama       TEXT,
  unit       TEXT,
  judul      TEXT,
  cat        TEXT,
  prio       TEXT,
  body       TEXT,
  strata     TEXT,
  lampiran   TEXT,
  mulai      TEXT,
  selesai    TEXT,
  alasan     TEXT,
  changes    JSONB,                      -- profil: {field:{dari,ke}}
  tgl        TEXT,
  waktu      TEXT,
  status     TEXT NOT NULL DEFAULT 'Baru',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_req_kind ON requests(kind, status);

CREATE TABLE IF NOT EXISTS activity (
  id      BIGSERIAL PRIMARY KEY,
  ts      BIGINT,
  tgl     TEXT,
  aksi    TEXT,
  type    TEXT,
  col     TEXT,
  nama    TEXT,
  emp_id  TEXT,
  unit    TEXT,
  ket     TEXT,
  by_user TEXT
);
CREATE INDEX IF NOT EXISTS idx_act_ts ON activity(ts DESC);

CREATE TABLE IF NOT EXISTS attendance (
  id      BIGSERIAL PRIMARY KEY,
  emp_id  TEXT NOT NULL,
  tgl     TEXT NOT NULL,
  jam_in  TEXT,
  jam_out TEXT,
  status  TEXT,
  UNIQUE (emp_id, tgl)
);
CREATE INDEX IF NOT EXISTS idx_att_tgl ON attendance(tgl);

CREATE TABLE IF NOT EXISTS audit_log (
  id       BIGSERIAL PRIMARY KEY,
  ts       BIGINT NOT NULL,
  user_id  TEXT,
  username TEXT,
  aksi     TEXT NOT NULL,
  rincian  TEXT,
  ip       TEXT,
  ua       TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);

-- Migrasi nyaman utk requests existing (idempoten; kolom strata/lampiran).
ALTER TABLE requests ADD COLUMN IF NOT EXISTS strata     TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS lampiran   TEXT;

-- ============ GMAIL OAuth (server-side, aman) ============
-- refresh token ENCRYPT (AES-256-GCM, key=HASH(AUTH_SECRET)); access token singa di server.
CREATE TABLE IF NOT EXISTS mail_tokens (
  id            INTEGER PRIMARY KEY,          -- selalu 1 (singleton)
  email         TEXT NOT NULL DEFAULT '',
  refresh_enc   TEXT NOT NULL DEFAULT '',      -- encrypted refresh token
  access_token  TEXT NOT NULL DEFAULT '',     -- access token (server-side)
  expires_at    BIGINT NOT NULL DEFAULT 0,    -- access token expiry (ms)
  updated_at    BIGINT NOT NULL DEFAULT 0
);

-- state PKCE oauth (10 menit, one-time)
CREATE TABLE IF NOT EXISTS mail_oauth_state (
  state      TEXT PRIMARY KEY,
  verifier   TEXT NOT NULL,
  user_id    TEXT,
  expires_at BIGINT NOT NULL DEFAULT 0
);

-- ============ CHAT internal HR (server-sync) ============
CREATE TABLE IF NOT EXISTS chat_messages (
  id      BIGSERIAL PRIMARY KEY,
  room    TEXT NOT NULL DEFAULT 'all',
  role    TEXT NOT NULL,
  by_user TEXT NOT NULL,
  msg     TEXT NOT NULL,
  ts      BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chat_room_ts ON chat_messages(room, ts);
