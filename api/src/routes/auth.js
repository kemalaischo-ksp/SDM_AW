// Auth: login (brute-force lockout), logout, /me, ganti sandi sendiri.
// eslint-disable-next-line no-unused-vars
import { Hono } from "hono";
import {
  createSession, destroySession, destroyUserSessions,
  cookieName, cookieHeader, getUserBySession,
} from "../sessions.js";
import { hashPassword, verifyPassword, passwordPolicyError, randPassword, needsRehash, dummyVerify } from "../pbkdf2.js";
import { effPerms } from "../rbac.js";
import { logAudit } from "../audit.js";

const LOCK_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function authRoutes(pool, { secure }) {
  const app = new Hono();
  dummyVerify("").catch(() => {}); // siapkan hash tiruan sejak awal (waktu respons seragam)

  // client IP via header proxy (anti-spoof: hanya percaya CF/X-Real-IP)
  const clientIp = (c) =>
    c.req.header("cf-connecting-ip") || c.req.header("x-real-ip") || c.req.header("x-forwarded-for")?.split(",")[0].trim() || "";

  // rate-limit sederhana per IP (in-memory)
  const hits = new Map();
  const rate = (key, max = 20, windowMs = 10 * 60 * 1000) => {
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || now > rec.reset) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
    if (rec.n >= max) return false;
    rec.n += 1;
    return true;
  };

  app.post("/api/login", async (c) => {
    const ip = clientIp(c);
    if (!rate("login:" + ip)) return c.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, 429);
    const body = await c.req.json().catch(() => ({}));
    const u = String(body.username || "").trim().toLowerCase();
    const p = String(body.password || "");
    if (!u || !p) return c.json({ error: "Username dan sandi wajib diisi." }, 400);
    if (u.length > 120 || p.length > 256) return c.json({ error: "Username atau sandi salah." }, 401);

    const res = await pool.query("SELECT * FROM users WHERE LOWER(username)=$1", [u]);
    if (res.rowCount) {
      const user = res.rows[0];
      if (user.locked_until && user.locked_until > Date.now()) {
        const s = Math.ceil((user.locked_until - Date.now()) / 1000);
        return c.json({ error: `Akun terkunci. Coba lagi dalam ${Math.floor(s / 60)} menit.` }, 423);
      }
      const ok = await verifyPassword(p, user.password_hash);
      if (!ok) {
        const fail = (user.failed_attempts || 0) + 1;
        let locked = null;
        if (fail >= LOCK_ATTEMPTS) locked = Date.now() + LOCK_MS;
        await pool.query(
          "UPDATE users SET failed_attempts=$2, locked_until=$3, updated_at=$4 WHERE id=$1",
          [user.id, fail, locked, Date.now()]
        );
        await logAudit(pool, { userId: user.id, username: user.username, aksi: locked ? "login_gagal_locked" : "login_gagal", rincian: locked ? "lockout 15 mnt" : `percobaan ${fail}/${LOCK_ATTEMPTS}`, ip, ua: c.req.header("user-agent") });
        return c.json({ error: "Username atau sandi salah." }, 401);
      }
      // sukses — hash lama (iterasi rendah) di-upgrade diam-diam ke standar terbaru
      if (needsRehash(user.password_hash)) {
        await pool.query("UPDATE users SET password_hash=$2 WHERE id=$1", [user.id, await hashPassword(p)]);
      }
      await pool.query(
        "UPDATE users SET failed_attempts=0, locked_until=NULL, updated_at=$1 WHERE id=$2",
        [Date.now(), user.id]
      );
      const sess = await createSession(pool, user, ip, c.req.header("user-agent"));
      c.header("set-cookie", cookieHeader(cookieName(secure), sess.token, secure));
      await logAudit(pool, { userId: user.id, username: user.username, aksi: "login_ok", ip, ua: c.req.header("user-agent") });
      return c.json({ ok: true, user: { username: user.username, role: user.role, nama: user.nama, unit: user.unit, empId: user.emp_id, nip: user.nip, mustChange: !!user.must_change } });
    }
    await dummyVerify(p); // samakan waktu respons dgn username yang ada
    return c.json({ error: "Username atau sandi salah." }, 401);
  });

  app.post("/api/logout", async (c) => {
    const token = c.req.header("cookie")?.match(/hr31_session=([^;]+)/)?.[1];
    await destroySession(pool, token);
    c.header("set-cookie", cookieHeader(cookieName(secure), "", secure, 0));
    return c.json({ ok: true });
  });

  app.get("/api/me", async (c) => {
    const token = c.req.header("cookie")?.match(/hr31_session=([^;]+)/)?.[1];
    const user = await getUserBySession(pool, token);
    if (!user) return c.json({ error: "Sesi tidak ada/kedaluwarsa." }, 401);
    const perms = [...(await effPerms(pool, user))];
    delete user.sessionId;
    user.perms = perms;
    if (user.mustChange) user.perms = perms.filter((k) => k !== "accounts");
    return c.json({ ok: true, user });
  });

  app.post("/api/me/password", async (c) => {
    const token = c.req.header("cookie")?.match(/hr31_session=([^;]+)/)?.[1];
    const user = await getUserBySession(pool, token);
    if (!user) return c.json({ error: "Sesi tidak ada/kedaluwarsa." }, 401);
    const body = await c.req.json().catch(() => ({}));
    const cur = String(body.current || "");
    const neu = String(body.password || "");
    if (cur.length > 256) return c.json({ error: "Sandi saat ini salah." }, 400);
    const dbUser = (await pool.query("SELECT password_hash FROM users WHERE id=$1", [user.id])).rows[0];
    if (!(await verifyPassword(cur, dbUser.password_hash))) {
      return c.json({ error: "Sandi saat ini salah." }, 400);
    }
    const err = passwordPolicyError(neu);
    if (err) return c.json({ error: err }, 400);
    if (neu === cur) return c.json({ error: "Sandi baru tidak boleh sama dengan sandi saat ini." }, 400);
    if (neu.toLowerCase().includes(user.username.toLowerCase())) return c.json({ error: "Sandi tidak boleh memuat username." }, 400);
    const ph = await hashPassword(neu);
    await pool.query("UPDATE users SET password_hash=$2, must_change=0, updated_at=$3 WHERE id=$1", [user.id, ph, Date.now()]);
    await destroyUserSessions(pool, user.id, token);
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "ganti_sandi", ip: clientIp(c), ua: c.req.header("user-agent") });
    return c.json({ ok: true });
  });

  // Reset sandi karyawan oleh admin: password acak baru (ditampilkan sekali)
  app.post("/api/me/reset-pw-admin", async (c) => {
    const token = c.req.header("cookie")?.match(/hr31_session=([^;]+)/)?.[1];
    const admin = await getUserBySession(pool, token);
    if (!admin) return c.json({ error: "Sesi kedaluwarsa." }, 401);
    const perms = await effPerms(pool, admin);
    if (!perms.has("accounts")) return c.json({ error: "Akses ditolak." }, 403);
    const body = await c.req.json().catch(() => ({}));
    const target = String(body.username || "").trim();
    if (!target) return c.json({ error: "Username wajib." }, 400);
    const tgt = (await pool.query("SELECT role FROM users WHERE LOWER(username)=$1", [target.toLowerCase()])).rows[0];
    if (!tgt) return c.json({ error: "Akun tidak ditemukan." }, 404);
    if (tgt.role === "master" && admin.role !== "master") return c.json({ error: "Hanya Master Admin yang bisa mereset sandi akun Master." }, 403);
    if (target.toLowerCase() === admin.username.toLowerCase()) return c.json({ error: "Ganti sandi akun sendiri lewat Profil Saya." }, 400);
    const pw = randPassword(12);
    const ph = await hashPassword(pw);
    const upd = await pool.query(
      "UPDATE users SET password_hash=$2, must_change=1, failed_attempts=0, locked_until=NULL, updated_at=$3 WHERE LOWER(username)=$4 RETURNING nama, nip",
      [ph, Date.now(), target.toLowerCase()]
    );
    if (!upd.rowCount) return c.json({ error: "Akun tidak ditemukan." }, 404);
    await pool.query("DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE LOWER(username)=$1)", [target.toLowerCase()]);
    await logAudit(pool, { userId: admin.id, username: admin.username, aksi: "reset_sandi_akun", rincian: target, ip: clientIp(c), ua: c.req.header("user-agent") });
    return c.json({ ok: true, pw, nama: upd.rows[0].nama, nip: upd.rows[0].nip });
  });

  // ===== Keamanan akun sendiri: sesi aktif + riwayat masuk =====
  const meFrom = async (c) => {
    const token = c.req.header("cookie")?.match(/hr31_session=([^;]+)/)?.[1];
    return { token, user: await getUserBySession(pool, token) };
  };

  app.get("/api/me/security", async (c) => {
    const { user } = await meFrom(c);
    if (!user) return c.json({ error: "Sesi tidak ada/kedaluwarsa." }, 401);
    const sess = (await pool.query(
      "SELECT id, ip, ua, created_at, expires_at FROM sessions WHERE user_id=$1 AND expires_at>$2 ORDER BY created_at DESC",
      [user.id, Date.now()]
    )).rows.map((r) => ({ id: r.id, ip: r.ip || "", ua: r.ua || "", createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), current: r.id === user.sessionId }));
    const log = (await pool.query(
      `SELECT ts, aksi, rincian, ip, ua FROM audit_log
        WHERE user_id=$1 AND aksi IN ('login_ok','login_gagal','login_gagal_locked','ganti_sandi','logout_semua','cabut_sesi')
        ORDER BY ts DESC LIMIT 15`,
      [user.id]
    )).rows.map((r) => ({ ts: Number(r.ts), aksi: r.aksi, rincian: r.rincian || "", ip: r.ip || "", ua: r.ua || "" }));
    const pwRow = (await pool.query(
      "SELECT ts FROM audit_log WHERE user_id=$1 AND aksi IN ('ganti_sandi') ORDER BY ts DESC LIMIT 1",
      [user.id]
    )).rows[0];
    return c.json({ ok: true, sessions: sess, log, pwChangedAt: pwRow ? Number(pwRow.ts) : null, hashScheme: "PBKDF2-SHA256 · 600.000 iterasi · salt acak 16 byte" });
  });

  app.post("/api/me/sessions/revoke-others", async (c) => {
    const { token, user } = await meFrom(c);
    if (!user) return c.json({ error: "Sesi tidak ada/kedaluwarsa." }, 401);
    const n = (await pool.query("SELECT COUNT(*)::int AS n FROM sessions WHERE user_id=$1 AND id<>$2", [user.id, user.sessionId])).rows[0].n;
    await destroyUserSessions(pool, user.id, token);
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "logout_semua", rincian: n + " sesi lain dicabut", ip: clientIp(c), ua: c.req.header("user-agent") });
    return c.json({ ok: true, revoked: n });
  });

  app.post("/api/me/sessions/:id/revoke", async (c) => {
    const { user } = await meFrom(c);
    if (!user) return c.json({ error: "Sesi tidak ada/kedaluwarsa." }, 401);
    const id = c.req.param("id");
    if (id === user.sessionId) return c.json({ error: "Gunakan tombol Keluar untuk sesi ini." }, 400);
    const res = await pool.query("DELETE FROM sessions WHERE id=$1 AND user_id=$2", [id, user.id]);
    if (!res.rowCount) return c.json({ error: "Sesi tidak ditemukan." }, 404);
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "cabut_sesi", rincian: "1 sesi dicabut", ip: clientIp(c), ua: c.req.header("user-agent") });
    return c.json({ ok: true });
  });

  return app;
}
