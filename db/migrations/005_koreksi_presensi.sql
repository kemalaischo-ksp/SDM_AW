-- ============================================================
-- HR 3.0 — Migrasi 005: koreksi presensi (pengajuan perbaikan
-- jam check-in/out oleh karyawan, diterapkan saat disetujui HR).
-- ADDITIVE + idempoten.
-- ============================================================

CREATE TABLE IF NOT EXISTS koreksi_presensi (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL,
  kolom         TEXT NOT NULL CHECK (kolom IN ('check_in','check_out')),
  waktu_baru    TIME NOT NULL,
  alasan        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'diajukan' CHECK (status IN ('diajukan','disetujui','ditolak')),
  disetujui_oleh TEXT REFERENCES users(id),
  waktu         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_koreksi_emp ON koreksi_presensi(employee_id);
