// Sesi server-side — cookie httpOnly, token acak tersimpan di DB.
export const SESSION_HOURS = 8;

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return b64url(b) + Date.now().toString(36);
}

export const cookieName = (secure) =>
  secure ? "__Host-hr31_session" : "hr31_session";

export function cookieHeader(name, token, secure, maxAge = SESSION_HOURS * 3600) {
  const parts = [`${name}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

export async function createSession(pool, user, ip, ua) {
  const token = newToken();
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  await pool.query(
    "INSERT INTO sessions (id, user_id, token, expires_at, created_at, ip, ua) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [newToken(), user.id, token, expires, Date.now(), ip || null, ua || null]
  );
  return { token, expires };
}

export async function destroySession(pool, token) {
  if (!token) return;
  await pool.query("DELETE FROM sessions WHERE token=$1", [token]);
}

export async function destroyUserSessions(pool, userId, exceptToken = null) {
  if (exceptToken) {
    await pool.query("DELETE FROM sessions WHERE user_id=$1 AND token<>$2", [userId, exceptToken]);
  } else {
    await pool.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
  }
}

export function userFromRow(r) {
  return {
    id: r.id,
    username: r.username,
    role: r.role,
    nama: r.nama,
    unit: r.unit || null,
    empId: r.emp_id || null,
    nip: r.nip || null,
    mustChange: !!r.must_change,
    aktif: !!r.aktif,
  };
}

export async function getUserBySession(pool, token) {
  if (!token) return null;
  const now = Date.now();
  // hapus sesi kedaluwarsa (sekali jalan)
  await pool.query("DELETE FROM sessions WHERE expires_at < $1", [now]);
  const res = await pool.query(
    `SELECT u.*, s.token FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token=$1 AND s.expires_at>$2 AND u.aktif=1`,
    [token, now]
  );
  if (!res.rowCount) return null;
  return userFromRow(res.rows[0]);
}
