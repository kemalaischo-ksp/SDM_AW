-- ============================================================
-- HR 3.0 — Migrasi 007: token reset kata sandi (lupa password)
-- Satu token satu pakai, kedaluwarsa 1 jam. Hanya HASH token
-- yang disimpan (token mentah hanya ada di email). ADDITIVE.
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pwdreset_user ON password_reset_tokens(user_id);
