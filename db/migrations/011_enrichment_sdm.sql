-- ============================================================
-- HR 3.0 — Migrasi 011: kolom gender, jenjang pendidikan non-S1,
-- cabang non-fisik (Holding/Yayasan/Lintas) + unit UMUM per cabang.
-- Latar: hasil import cleansing SDM 1.658 baris (data master lama).
-- Idempoten: IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ============================================================

-- 1. Kolom gender di employees --------------------------------------
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_gender') THEN
    ALTER TABLE employees ADD CONSTRAINT chk_emp_gender
      CHECK (gender IS NULL OR gender IN ('Pria','Perempuan'));
  END IF;
END $$;

-- 2. Perluas jenjang pendidikan: S1/S2/S3 -> + SMA/D1/D2/D3/D4 ------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pendidikan_jenjang_check') THEN
    ALTER TABLE pendidikan DROP CONSTRAINT pendidikan_jenjang_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pendidikan_jenjang_check') THEN
    ALTER TABLE pendidikan ADD CONSTRAINT pendidikan_jenjang_check
      CHECK (jenjang IN ('SMA','D1','D2','D3','D4','S1','S2','S3'));
  END IF;
END $$;

-- 3. Cabang non-fisik (UNIT di file cleansing: Holding/Yayasan/Lintas)
INSERT INTO cabangs (kode, nama) VALUES ('HOLDING','HOLDING') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('YAYASAN','YAYASAN AL-WILDAN') ON CONFLICT (kode) DO NOTHING;
INSERT INTO cabangs (kode, nama) VALUES ('LINTAS','LINTAS UNIT / TIDAK TETAP') ON CONFLICT (kode) DO NOTHING;
SELECT setval(pg_get_serial_sequence('cabangs','id'), (SELECT max(id) FROM cabangs));

-- 4. Unit UMUM per cabang (penampung staf non-jenjang: Holding,
-- Security, FCS, Investor, dsb. Satu per cabang, dibuat dinamis agar
-- cabang baru di masa depan otomatis dapat unit UMUM.)
INSERT INTO units (nama, kode, cabang_id)
SELECT 'Umum ' || kode, kode || '-UMUM', id FROM cabangs
ON CONFLICT (kode) DO NOTHING;
SELECT setval(pg_get_serial_sequence('units','id'), (SELECT max(id) FROM units));
