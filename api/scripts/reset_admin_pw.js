// Reset sandi darurat langsung di DB — BYPASS pengecekan "sandi lama".
// Guna: lupa sandi admin, atau field "Sandi Lama" ke-autofill salah oleh browser.
// Jalankan di VPS (dalam container hr30, sudah punya DATABASE_URL):
//   docker compose exec hr30 node scripts/reset_admin_pw.js admin "SandiBaruKuat!2026"
//
// Kebijakan sandi: minimal 12 karakter, wajib huruf + angka, bukan sandi umum.
import { createPool } from "../src/db.js";
import { hashPassword, passwordPolicyError } from "../src/pbkdf2.js";

const [, , username, newPassword] = process.argv;
if (!username || !newPassword) {
  console.error("Pakai: node scripts/reset_admin_pw.js <username> <sandi-baru>");
  process.exit(1);
}
const polErr = passwordPolicyError(newPassword);
if (polErr) {
  console.error("Sandi ditolak kebijakan:", polErr);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL tidak ada di environment container ini.");
  process.exit(1);
}

const pool = createPool(process.env.DATABASE_URL);
try {
  const ph = await hashPassword(newPassword);
  const res = await pool.query(
    `UPDATE users SET password_hash=$2, must_change=0, failed_attempts=0, locked_until=NULL, updated_at=$3
     WHERE LOWER(username)=$1 RETURNING id, username, nama`,
    [username.toLowerCase(), ph, Date.now()]
  );
  if (!res.rowCount) {
    console.error("Akun tidak ditemukan:", username);
    process.exit(1);
  }
  const u = res.rows[0];
  await pool.query("DELETE FROM sessions WHERE user_id=$1", [u.id]);
  console.log(`✓ Sandi diperbarui untuk ${u.nama} (${u.username}). Semua sesi lama dihapus — login ulang.`);
} catch (e) {
  console.error("Gagal:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
