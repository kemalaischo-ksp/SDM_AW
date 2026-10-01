-- ============================================================
-- HR 3.0 — Migrasi 003: izin tambahan per pengguna + status aktif
-- - users.permissions : JSONB array kunci izin tambahan (di luar bawaan peran)
-- - users.aktif       : 1 aktif, 0 nonaktif (login ditolak bila 0)
-- Katalog kunci (lihat PERM_CATALOG di api/src/index.js):
--   karyawan.lihat, aktivasi.ajukan, aktivasi.verifikasi, aktivasi.setujui,
--   payroll.lihat, payroll.kunci, slip.lihat, users.kelola, audit.lihat
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS aktif SMALLINT NOT NULL DEFAULT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_permissions_array') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_permissions_array
      CHECK (jsonb_typeof(permissions) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_aktif ON users(aktif);
