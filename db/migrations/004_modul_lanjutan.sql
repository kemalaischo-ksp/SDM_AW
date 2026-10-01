-- ============================================================
-- HR 3.0 — Migrasi 004: modul lanjutan (komprehensif)
-- ADDITIVE + idempoten (aman dijalankan ulang).
-- Isi: perluasan employees/absensi/documents, pengaturan,
-- cuti_saldo, riwayat_jabatan, lembur, reimbursement, surat,
-- perubahan_data, penilaian, notifikasi, pengumuman, onboarding.
-- ============================================================

-- 1. Employees: foto, atasan, tgl masuk, status kerja, kontak darurat --
ALTER TABLE employees ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS atasan_id INTEGER REFERENCES employees(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tgl_masuk DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status_kerja TEXT NOT NULL DEFAULT 'aktif';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS kontak_darurat TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_status_kerja') THEN
    ALTER TABLE employees ADD CONSTRAINT chk_emp_status_kerja
      CHECK (status_kerja IN ('aktif','cuti','resign','nonaktif'));
  END IF;
END $$;
UPDATE employees SET tgl_masuk = tmt_aktif WHERE tgl_masuk IS NULL AND tmt_aktif IS NOT NULL;

-- 2. Absensi: GPS + selfie (foto = JPEG base64 dataURL, cukup untuk pilot) --
ALTER TABLE absensi ADD COLUMN IF NOT EXISTS lat_masuk DOUBLE PRECISION;
ALTER TABLE absensi ADD COLUMN IF NOT EXISTS lng_masuk DOUBLE PRECISION;
ALTER TABLE absensi ADD COLUMN IF NOT EXISTS foto_masuk TEXT;
ALTER TABLE absensi ADD COLUMN IF NOT EXISTS lat_pulang DOUBLE PRECISION;
ALTER TABLE absensi ADD COLUMN IF NOT EXISTS lng_pulang DOUBLE PRECISION;
ALTER TABLE absensi ADD COLUMN IF NOT EXISTS foto_pulang TEXT;

-- 3. Documents: tanggal kedaluwarsa (KTP, kontrak, dll.) --
ALTER TABLE documents ADD COLUMN IF NOT EXISTS kedaluwarsa DATE;

-- 4. Pengaturan key-value (jam kerja, lokasi kantor, radius, jatah cuti) --
CREATE TABLE IF NOT EXISTS pengaturan (
  kunci      TEXT PRIMARY KEY,
  nilai      TEXT NOT NULL,
  keterangan TEXT
);
INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES
  ('jam_masuk_normal', '07:00', 'Batas masuk normal (HH:MM, WIB) — lewat + toleransi = terlambat'),
  ('jam_pulang_normal', '16:00', 'Batas pulang normal (HH:MM, WIB) — sebelum = pulang cepat'),
  ('toleransi_telat_menit', '15', 'Toleransi keterlambatan (menit)'),
  ('kantor_lat', '-6.2850', 'Latitude titik kantor AW3 (sesuaikan via Pengaturan)'),
  ('kantor_lng', '106.6419', 'Longitude titik kantor AW3 (sesuaikan via Pengaturan)'),
  ('radius_meter', '300', 'Radius presensi GPS dari titik kantor (meter)'),
  ('jatah_cuti_tahunan', '12', 'Jatah cuti tahunan default (hari)')
ON CONFLICT (kunci) DO NOTHING;

-- 5. Saldo cuti per karyawan per tahun --
CREATE TABLE IF NOT EXISTS cuti_saldo (
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tahun       INTEGER NOT NULL,
  jatah       INTEGER NOT NULL DEFAULT 12 CHECK (jatah >= 0),
  UNIQUE(employee_id, tahun)
);
CREATE INDEX IF NOT EXISTS idx_csaldo_emp ON cuti_saldo(employee_id);

-- 6. Riwayat jabatan & gaji --
CREATE TABLE IF NOT EXISTS riwayat_jabatan (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL DEFAULT CURRENT_DATE,
  jabatan_lama  TEXT,
  jabatan_baru  TEXT,
  gaji_lama     NUMERIC(14,2),
  gaji_baru     NUMERIC(14,2),
  keterangan    TEXT,
  oleh_user_id  TEXT REFERENCES users(id),
  waktu         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rjabatan_emp ON riwayat_jabatan(employee_id);

-- 7. Lembur --
CREATE TABLE IF NOT EXISTS lembur (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL,
  jam_mulai     TIME NOT NULL,
  jam_selesai   TIME NOT NULL,
  keterangan    TEXT,
  status        TEXT NOT NULL DEFAULT 'diajukan' CHECK (status IN ('diajukan','disetujui','ditolak')),
  disetujui_oleh TEXT REFERENCES users(id),
  waktu         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lembur_emp ON lembur(employee_id);

-- 8. Reimbursement --
CREATE TABLE IF NOT EXISTS reimbursement (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL,
  kategori      TEXT NOT NULL DEFAULT 'lainnya',
  nominal       NUMERIC(14,2) NOT NULL CHECK (nominal > 0),
  deskripsi     TEXT,
  bukti_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'diajukan' CHECK (status IN ('diajukan','disetujui','ditolak')),
  disetujui_oleh TEXT REFERENCES users(id),
  waktu         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reimburse_emp ON reimbursement(employee_id);

-- 9. Surat kerja (keterangan kerja, pengalaman, dll.) --
CREATE TABLE IF NOT EXISTS surat (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL DEFAULT CURRENT_DATE,
  jenis         TEXT NOT NULL DEFAULT 'keterangan_kerja',
  keperluan     TEXT,
  nomor         TEXT,
  status        TEXT NOT NULL DEFAULT 'diajukan' CHECK (status IN ('diajukan','disetujui','ditolak')),
  disetujui_oleh TEXT REFERENCES users(id),
  waktu         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surat_emp ON surat(employee_id);

-- 10. Perubahan data pribadi (kolom whitelist ditegakkan di API) --
CREATE TABLE IF NOT EXISTS perubahan_data (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL DEFAULT CURRENT_DATE,
  kolom         TEXT NOT NULL,
  nilai_lama    TEXT,
  nilai_baru    TEXT,
  status        TEXT NOT NULL DEFAULT 'diajukan' CHECK (status IN ('diajukan','disetujui','ditolak')),
  disetujui_oleh TEXT REFERENCES users(id),
  waktu         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ubdata_emp ON perubahan_data(employee_id);

-- 11. Penilaian kinerja berkala --
CREATE TABLE IF NOT EXISTS penilaian (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  periode         TEXT NOT NULL,
  target          TEXT,
  skor            SMALLINT CHECK (skor IS NULL OR (skor BETWEEN 1 AND 5)),
  catatan         TEXT,
  rencana_kembang TEXT,
  dinilai_oleh    TEXT REFERENCES users(id),
  waktu           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, periode)
);
CREATE INDEX IF NOT EXISTS idx_nilai_emp ON penilaian(employee_id);

-- 12. Notifikasi dalam aplikasi --
CREATE TABLE IF NOT EXISTS notifikasi (
  id       SERIAL PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  judul    TEXT NOT NULL,
  isi      TEXT,
  dibaca   SMALLINT NOT NULL DEFAULT 0,
  waktu    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifikasi(user_id, dibaca);

-- 13. Pengumuman perusahaan --
CREATE TABLE IF NOT EXISTS pengumuman (
  id          SERIAL PRIMARY KEY,
  judul       TEXT NOT NULL,
  isi         TEXT NOT NULL,
  dibuat_oleh TEXT REFERENCES users(id),
  aktif       SMALLINT NOT NULL DEFAULT 1,
  waktu       TIMESTAMPTZ DEFAULT now()
);

-- 14. Checklist onboarding per karyawan --
CREATE TABLE IF NOT EXISTS onboarding (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  item        TEXT NOT NULL,
  selesai     SMALLINT NOT NULL DEFAULT 0,
  selesai_at  TIMESTAMPTZ,
  UNIQUE(employee_id, item)
);
CREATE INDEX IF NOT EXISTS idx_onboard_emp ON onboarding(employee_id);
