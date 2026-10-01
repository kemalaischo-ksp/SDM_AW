-- ============================================================
-- SIM-HR AL WILDAN — Skema Database (PostgreSQL)
-- Konversi dari versi SQLite: SERIAL, NUMERIC(uang), TIMESTAMPTZ, now()
-- ============================================================

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS payrolls CASCADE;
DROP TABLE IF EXISTS payroll_periods CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS units CASCADE;

CREATE TABLE units (
  id      SERIAL PRIMARY KEY,
  nama    TEXT NOT NULL,
  kode    TEXT UNIQUE NOT NULL,
  alamat  TEXT
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'pegawai',
  unit_id       INTEGER REFERENCES units(id),
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE employees (
  id          SERIAL PRIMARY KEY,
  unit_id     INTEGER NOT NULL REFERENCES units(id),
  user_id     TEXT REFERENCES users(id),
  nip         TEXT UNIQUE NOT NULL,
  nama        TEXT NOT NULL,
  jabatan     TEXT,
  no_rekening TEXT,
  aktif       SMALLINT DEFAULT 1,
  -- Komponen gaji arsip SDM (rincian penuh: hanya Super Admin & HR Cabang)
  thp_kotor    NUMERIC(14,2) DEFAULT 0,
  thp_bersih   NUMERIC(14,2) DEFAULT 0,
  total_tk_thr NUMERIC(14,2) DEFAULT 0,
  tk           NUMERIC(14,2) DEFAULT 0,
  thr_bulan    NUMERIC(14,2) DEFAULT 0,
  konfirmasi   TEXT,
  cv_url        TEXT,
  kesehatan_url TEXT,
  arsip_key     TEXT
);

CREATE TABLE payroll_periods (
  id        SERIAL PRIMARY KEY,
  periode   TEXT NOT NULL UNIQUE,
  status    TEXT NOT NULL DEFAULT 'draft',
  locked_by TEXT,
  locked_at TIMESTAMPTZ
);

CREATE TABLE payrolls (
  id                SERIAL PRIMARY KEY,
  period_id         INTEGER NOT NULL REFERENCES payroll_periods(id),
  employee_id       INTEGER NOT NULL REFERENCES employees(id),
  gapok             NUMERIC(14,2) DEFAULT 0,
  tunj_pendidikan   NUMERIC(14,2) DEFAULT 0,
  tunj_jabatan      NUMERIC(14,2) DEFAULT 0,
  transport         NUMERIC(14,2) DEFAULT 0,
  bpjs_kesehatan_in NUMERIC(14,2) DEFAULT 0,
  lain_lain         NUMERIC(14,2) DEFAULT 0,
  pot_thr           NUMERIC(14,2) DEFAULT 0,
  pot_bpjs_tk       NUMERIC(14,2) DEFAULT 0,
  deposit_itba      NUMERIC(14,2) DEFAULT 0,
  punishment        NUMERIC(14,2) DEFAULT 0,
  pinjaman          NUMERIC(14,2) DEFAULT 0,
  total_pendapatan  NUMERIC(14,2) DEFAULT 0,
  total_potongan    NUMERIC(14,2) DEFAULT 0,
  thp               NUMERIC(14,2) DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_id, employee_id)
);

CREATE TABLE audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT,
  aksi       TEXT,
  tabel      TEXT,
  record_id  INTEGER,
  nilai_lama TEXT,
  nilai_baru TEXT,
  ip         TEXT,
  waktu      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documents (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  jenis       TEXT NOT NULL,
  judul       TEXT NOT NULL,
  file_key    TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_emp_unit ON employees(unit_id);
CREATE INDEX idx_pay_period ON payrolls(period_id);
CREATE INDEX idx_audit_waktu ON audit_logs(waktu);
CREATE INDEX idx_doc_emp ON documents(employee_id);
