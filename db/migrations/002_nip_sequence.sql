-- ============================================================
-- HR 3.0 PILOT AW3 — Migrasi 002: sequence NIP YYNNNN
-- NIP = 2 digit tahun masuk + nomor urut masuk tahun itu, zero-pad 4.
-- cth. masuk 2026 urutan 1 -> '260001'. Diinput HR, immutable setelah aktif.
-- PENTING: sebelum seed pilot, konfirmasi angka terakhir tahun berjalan
-- ke HR agar tidak tabrakan dengan NIP lama (lihat README).
-- ============================================================

CREATE TABLE IF NOT EXISTS nip_sequences (
  tahun    CHAR(2) PRIMARY KEY,  -- '26' untuk 2026
  terakhir INT NOT NULL DEFAULT 0 CHECK (terakhir >= 0)
);

CREATE OR REPLACE FUNCTION next_nip(p_tahun CHAR(2)) RETURNS TEXT AS $$
DECLARE
  v_baru INT;
BEGIN
  IF p_tahun IS NULL OR p_tahun !~ '^[0-9]{2}$' THEN
    RAISE EXCEPTION 'tahun harus 2 digit, dapat: %', p_tahun;
  END IF;
  INSERT INTO nip_sequences (tahun, terakhir) VALUES (p_tahun, 1)
  ON CONFLICT (tahun) DO UPDATE SET terakhir = nip_sequences.terakhir + 1
  RETURNING terakhir INTO v_baru;
  IF v_baru > 9999 THEN
    RAISE EXCEPTION 'urutan NIP tahun % habis (>9999)', p_tahun;
  END IF;
  RETURN p_tahun || lpad(v_baru::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
