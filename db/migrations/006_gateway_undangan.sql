-- ============================================================
-- HR 3.0 — Migrasi 006: kunci pengaturan gateway undangan
-- (SMTP email + gateway WhatsApp gaya Fonnte). ADDITIVE.
-- ============================================================

INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES
  ('SMTP_HOST', '', 'Hostname SMTP (cth. smtp.gmail.com)'),
  ('SMTP_PORT', '587', 'Port SMTP'),
  ('SMTP_USER', '', 'Username SMTP'),
  ('SMTP_PASS', '', 'Password/app-password SMTP (rahasia)'),
  ('SMTP_FROM', '', 'Alamat pengirim (default = SMTP_USER)'),
  ('SMTP_SECURE', '0', '1 = SMTPS port 465, 0 = STARTTLS'),
  ('WA_URL', 'https://api.fonnte.com/send', 'Endpoint gateway WA (format Fonnte)'),
  ('WA_TOKEN', '', 'Token gateway WA (rahasia)')
ON CONFLICT (kunci) DO NOTHING;
