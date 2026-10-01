-- ============================================================
-- HR 3.0 PILOT AW3 — Migrasi 001: skema inti pilot
-- Basis: HR 2.0 sim-hr-postgres/schema.pg.sql (tetap dipakai dulu,
-- file ini ADDITIVE agar aman untuk fresh install maupun upgrade).
-- Urutan pakai fresh: schema.pg.sql -> 001 -> 002 -> seeds/aw3_pilot.sql
-- Urutan upgrade DB 2.0 yang sudah ada: 001 -> 002 saja.
-- ============================================================

-- 1. Cabang fisik (baru di 3.0; units = jenjang, cabangs = lokasi) ----
CREATE TABLE IF NOT EXISTS cabangs (
  id     SERIAL PRIMARY KEY,
  kode   TEXT UNIQUE NOT NULL,   -- 'AW3'
  nama   TEXT NOT NULL,          -- 'Al-Wildan 3 BSD City'
  alamat TEXT
);

-- units milik cabang (nullable agar DB 2.0 lama tetap valid)
ALTER TABLE units ADD COLUMN IF NOT EXISTS cabang_id INTEGER REFERENCES cabangs(id);
CREATE INDEX IF NOT EXISTS idx_units_cabang ON units(cabang_id);

-- 2. Perluasan employees (biodata formulir + aktivasi) -----------------
-- Identitas
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nama_gelar TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nama_ktp TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS no_hp TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nik_ktp CHAR(16);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tempat_lahir TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tgl_lahir DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status_kawin TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tinggi_cm SMALLINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS berat_kg SMALLINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS transport TEXT;
-- Lamaran
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cabang_id INTEGER REFERENCES cabangs(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS posisi_diajukan TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mapel TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gaji_diajukan NUMERIC(14,2);
-- Bank
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_utama TEXT DEFAULT 'BSI';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS norek_utama TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_lain TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS norek_lain TEXT;
-- Aktivasi / workflow
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tmt_aktif DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mode_thp TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status_aktivasi TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS diaktifkan_oleh TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS diaktifkan_at TIMESTAMPTZ;

-- Backfill satu kali: nama_gelar dari nama lama bila masih kosong
UPDATE employees SET nama_gelar = nama WHERE nama_gelar IS NULL;

-- Constraint format (NULL lolos CHECK; hanya validasi bila diisi) -----
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_nip_format') THEN
    -- Longgar: NIP lama 12 digit tetap lolos, NIP baru 6 digit YYNNNN lolos.
    -- Aturan 6-digit ditegakkan di next_nip() + script import, bukan di sini.
    ALTER TABLE employees ADD CONSTRAINT chk_emp_nip_format CHECK (nip ~ '^[0-9]{6,18}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_nik_format') THEN
    ALTER TABLE employees ADD CONSTRAINT chk_emp_nik_format CHECK (nik_ktp IS NULL OR nik_ktp ~ '^[0-9]{16}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_nohp_format') THEN
    ALTER TABLE employees ADD CONSTRAINT chk_emp_nohp_format CHECK (no_hp IS NULL OR no_hp ~ '^628[0-9]{8,14}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_status_kawin') THEN
    ALTER TABLE employees ADD CONSTRAINT chk_emp_status_kawin CHECK (status_kawin IS NULL OR status_kawin IN ('Lajang','Menikah','Janda','Duda'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_mode_thp') THEN
    ALTER TABLE employees ADD CONSTRAINT chk_emp_mode_thp CHECK (mode_thp IS NULL OR mode_thp IN ('FULL','PRORATA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_status_aktivasi') THEN
    ALTER TABLE employees ADD CONSTRAINT chk_emp_status_aktivasi CHECK (status_aktivasi IN ('draft','diajukan_finance','diverifikasi_doni','aktif','ditolak'));
  END IF;
  -- Balance THP: baris tidak balance DITOLAK (sesuai keputusan template migrasi)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_thp_balance') THEN
    ALTER TABLE employees ADD CONSTRAINT chk_emp_thp_balance CHECK (thp_bersih = thp_kotor - total_tk_thr);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_tk_thr_balance') THEN
    ALTER TABLE employees ADD CONSTRAINT chk_emp_tk_thr_balance CHECK (total_tk_thr = tk + thr_bulan);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_emp_email') THEN
    ALTER TABLE employees ADD CONSTRAINT uq_emp_email UNIQUE (email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_emp_nik_ktp') THEN
    ALTER TABLE employees ADD CONSTRAINT uq_emp_nik_ktp UNIQUE (nik_ktp);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emp_cabang ON employees(cabang_id);
CREATE INDEX IF NOT EXISTS idx_emp_status ON employees(status_aktivasi);
CREATE INDEX IF NOT EXISTS idx_emp_nama_gelar ON employees(nama_gelar);

-- 3. Pendidikan (1:N) --------------------------------------------------
CREATE TABLE IF NOT EXISTS pendidikan (
  id                SERIAL PRIMARY KEY,
  employee_id       INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  jenjang           TEXT NOT NULL CHECK (jenjang IN ('S1','S2','S3')),
  perguruan_tinggi  TEXT,
  prodi             TEXT,
  ipk               NUMERIC(3,2) CHECK (ipk IS NULL OR (ipk >= 0 AND ipk <= 4)),
  UNIQUE(employee_id, jenjang)
);
CREATE INDEX IF NOT EXISTS idx_pend_emp ON pendidikan(employee_id);

-- 4. Pengalaman (1:N, maks 3 baris per karyawan) -----------------------
CREATE TABLE IF NOT EXISTS pengalaman (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  urutan      SMALLINT NOT NULL CHECK (urutan BETWEEN 1 AND 3),
  deskripsi   TEXT,
  salary      NUMERIC(14,2),
  UNIQUE(employee_id, urutan)
);
CREATE INDEX IF NOT EXISTS idx_peng_emp ON pengalaman(employee_id);

-- 5. Jejak workflow aktivasi (finance -> Doni -> Kemal) ----------------
CREATE TABLE IF NOT EXISTS aktivasi_logs (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  dari_status   TEXT,
  ke_status     TEXT NOT NULL,
  oleh_user_id  TEXT REFERENCES users(id),
  catatan       TEXT,
  waktu         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aktlog_emp ON aktivasi_logs(employee_id);

-- 6. Stub Fase 2 (dibuat sekarang agar tidak refactor; diisi nanti) ----
CREATE TABLE IF NOT EXISTS absensi (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tanggal     DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir','izin','sakit','cuti','alpa','dinas')),
  check_in    TIMESTAMPTZ,
  check_out   TIMESTAMPTZ,
  keterangan  TEXT,
  UNIQUE(employee_id, tanggal)
);
CREATE INDEX IF NOT EXISTS idx_abs_emp_tgl ON absensi(employee_id, tanggal);

CREATE TABLE IF NOT EXISTS cuti (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  jenis       TEXT NOT NULL DEFAULT 'tahunan',
  tgl_mulai   DATE NOT NULL,
  tgl_selesai DATE NOT NULL CHECK (tgl_selesai >= tgl_mulai),
  status      TEXT NOT NULL DEFAULT 'diajukan' CHECK (status IN ('diajukan','disetujui','ditolak','dibatalkan')),
  disetujui_oleh TEXT REFERENCES users(id),
  keterangan  TEXT
);
CREATE INDEX IF NOT EXISTS idx_cuti_emp ON cuti(employee_id);
