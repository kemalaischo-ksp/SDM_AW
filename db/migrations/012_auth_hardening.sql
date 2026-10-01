-- ============================================================
-- HR 3.0 — Migrasi 012: hardening autentikasi
--  - sessions        : sesi server-side (bisa dicabut, logout-all,
--                      mati otomatis saat ganti/reset kata sandi)
--  - users.failed_attempts / locked_until : lockout per-akun
-- ADDITIVE + idempoten (aman dijalankan ulang).
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,          -- SHA-256 token sesi (token mentah hanya di cookie)
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;