// Manajemen akun & hak akses: buat/persen/bolk/ubah/hapus + override izin.
import { Hono } from "hono";
import { requireAuth, PERM_KEYS } from "../rbac.js";
import { hashPassword, randPassword } from "../pbkdf2.js";
import { genNIP, acctToUI } from "../serializers.js";
import { logActivity, logAudit } from "../audit.js";

const now = () => Date.now();

async function requireAccountPerm(user, perms, c) {
  if (user.role !== "master" && !perms.has("accounts")) {
    return c.json({ error: "Akses ditolak." }, 403);
  }
  return null;
}

export function accountsRoutes(pool) {
  const app = new Hono();

  app.get("/api/accounts", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    const deny = await requireAccountPerm(user, perms, c);
    if (deny) return deny;
    if (user.role !== "master" && !perms.has("accounts")) return c.json({ error: "Akses ditolak." }, 403);
    const res = await pool.query("SELECT * FROM users ORDER BY role='master' DESC, username");
    return c.json(res.rows.map(acctToUI));
  });

  // Buat akun tunggal: (A) untuk karyawan via empId (username=NIP), atau
  // (B) akun tim HR via username+nama+role+unit (+ izin kustom).
  app.post("/api/accounts", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    const deny = await requireAccountPerm(user, perms, c);
    if (deny) return deny;
    const body = await c.req.json().catch(() => ({}));

    if (body.username) {
      const username = String(body.username || "").trim().toLowerCase();
      const nama = String(body.nama || "").trim();
      if (!username || !nama) return c.json({ error: "Nama & username wajib." }, 400);
      if (!/^[a-z0-9._-]+$/.test(username)) return c.json({ error: "Username hanya huruf kecil, angka, titik, - dan _." }, 400);
      if ((await pool.query("SELECT 1 FROM users WHERE username=$1", [username])).rowCount) {
        return c.json({ error: "Username sudah dipakai." }, 400);
      }
      const role = ["master", "kadiv_hr", "staff_hr", "karyawan"].includes(body.role) ? body.role : "staff_hr";
      const unit = String(body.unit || "Holding");
      const pw = randPassword(12);
      const ph = await hashPassword(pw);
      const uid = "u" + now() + Math.floor(Math.random() * 9e5);
      await pool.query(
        `INSERT INTO users (id, username, password_hash, role, nama, unit, must_change, aktif, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,1,1,$7,$7)`,
        [uid, username, ph, role, nama, unit, now()]
      );
      if (Array.isArray(body.perms)) {
        for (const key of body.perms) {
          if (!PERM_KEYS.includes(key)) continue;
          await pool.query("INSERT INTO user_perms (user_id, perm_key, allowed) VALUES ($1,$2,1)", [uid, key]);
        }
      }
      await logAudit(pool, { userId: user.id, username: user.username, aksi: "create_hr_account", rincian: username + " (" + role + ") " + unit, ip: c.get("ip"), ua: c.req.header("user-agent") });
      const accs = (await pool.query("SELECT * FROM users ORDER BY role='master' DESC, username")).rows.map(acctToUI);
      return c.json({ cred: { nama, u: username, pw, nip: "" }, accounts: accs });
    }

    // (A) akun karyawan
    const emp = (await pool.query("SELECT * FROM employees WHERE id=$1", [String(body.empId || "")])).rows[0];
    if (!emp) return c.json({ error: "Karyawan tidak ada." }, 404);
    let nip = emp.nip;
    if (!nip) { nip = await genNIP(pool, emp); await pool.query("UPDATE employees SET nip=$2 WHERE id=$1", [emp.id, nip]); }
    const exists = (await pool.query("SELECT 1 FROM users WHERE username=$1", [nip])).rowCount;
    if (exists) return c.json({ error: "Karyawan ini sudah punya akun." }, 400);
    const pw = randPassword(12);
    const ph = await hashPassword(pw);
    await pool.query(
      `INSERT INTO users (id, username, password_hash, role, nama, unit, emp_id, nip, must_change, aktif, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,1,$9,$9)`,
      ["u" + now() + Math.floor(Math.random() * 9e5), nip, ph, "karyawan", emp.nama, emp.unit, emp.id, nip, now()]
    );
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "create_account", rincian: nip, ip: c.get("ip"), ua: c.req.header("user-agent") });
    const accs = (await pool.query("SELECT * FROM users ORDER BY role='master' DESC, username")).rows.map(acctToUI);
    return c.json({ cred: { nama: emp.nama, u: nip, pw, nip }, accounts: accs });
  });

  // Buat massal untuk semua karyawan (opsional per unit). Password ditampilkan sekali.
  app.post("/api/accounts/bulk", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    const deny = await requireAccountPerm(user, perms, c);
    if (deny) return deny;
    const body = await c.req.json().catch(() => ({}));
    const unitFilter = String(body.unit || "");
    const target = (await pool.query(
      `SELECT e.* FROM employees e
        LEFT JOIN users u ON u.emp_id=e.id
       WHERE u.id IS NULL ${unitFilter ? "AND e.unit=$1" : ""}
       ORDER BY CASE WHEN e.id ~ '^[0-9]+$' THEN lpad(e.id,12,'0') ELSE e.id END`,
      unitFilter ? [unitFilter] : []
    )).rows;
    const creds = [];
    for (const emp of target) {
      let nip = emp.nip;
      if (!nip) { nip = await genNIP(pool, emp); await pool.query("UPDATE employees SET nip=$2 WHERE id=$1", [emp.id, nip]); }
      if ((await pool.query("SELECT 1 FROM users WHERE username=$1", [nip])).rowCount) continue;
      const pw = randPassword(12);
      const ph = await hashPassword(pw);
      await pool.query(
        `INSERT INTO users (id, username, password_hash, role, nama, unit, emp_id, nip, must_change, aktif, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,1,$9,$9)`,
        ["u" + now() + Math.floor(Math.random() * 9e5), nip, ph, "karyawan", emp.nama, emp.unit, emp.id, nip, now()]
      );
      creds.push({ nama: emp.nama, u: nip, pw, nip });
    }
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "bulk_accounts", rincian: creds.length + " akun", ip: c.get("ip"), ua: c.req.header("user-agent") });
    const accs = (await pool.query("SELECT * FROM users ORDER BY role='master' DESC, username")).rows.map(acctToUI);
    return c.json({ count: creds.length, creds, accounts: accs });
  });

  async function findUser(c) {
    const username = c.req.param("username");
    const res = await pool.query("SELECT * FROM users WHERE LOWER(username)=$1", [String(username).toLowerCase()]);
    return { user: res.rows[0], username };
  }

  // Reset sandi (password acak baru, tampil sekali, wajib ganti).
  app.post("/api/accounts/:username/reset", requireAuth(pool), async (c) => {
    const me = c.get("user");
    const perms = c.get("perms");
    const deny = await requireAccountPerm(me, perms, c);
    if (deny) return deny;
    const { user, username } = await findUser(c);
    if (!user) return c.json({ error: "Akun tidak ditemukan." }, 404);
    const pw = randPassword(12);
    const ph = await hashPassword(pw);
    await pool.query("UPDATE users SET password_hash=$2, must_change=1, failed_attempts=0, locked_until=NULL, updated_at=$3 WHERE id=$1", [user.id, ph, now()]);
    await pool.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    await logAudit(pool, { userId: me.id, username: me.username, aksi: "reset_sandi", rincian: username, ip: c.get("ip"), ua: c.req.header("user-agent") });
    const cred = { nama: user.nama, u: user.username, pw, nip: user.nip || "" };
    const accs = (await pool.query("SELECT * FROM users ORDER BY role='master' DESC, username")).rows.map(acctToUI);
    return c.json({ cred, accounts: accs });
  });

  app.delete("/api/accounts/:username", requireAuth(pool), async (c) => {
    const me = c.get("user");
    const perms = c.get("perms");
    const deny = await requireAccountPerm(me, perms, c);
    if (deny) return deny;
    const { user, username } = await findUser(c);
    if (!user) return c.json({ error: "Akun tidak ditemukan." }, 404);
    if (user.role === "master" || me.id === user.id) return c.json({ error: "Akun master/utama tidak bisa dihapus." }, 400);
    await pool.query("DELETE FROM user_perms WHERE user_id=$1", [user.id]);
    await pool.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    await pool.query("DELETE FROM users WHERE id=$1", [user.id]);
    await logAudit(pool, { userId: me.id, username: me.username, aksi: "delete_account", rincian: username });
    const accs = (await pool.query("SELECT * FROM users ORDER BY role='master' DESC, username")).rows.map(acctToUI);
    return c.json({ ok: true, accounts: accs });
  });

  app.post("/api/accounts/:username/role", requireAuth(pool), async (c) => {
    const me = c.get("user");
    const perms = c.get("perms");
    const deny = await requireAccountPerm(me, perms, c);
    if (deny) return deny;
    const { user, username } = await findUser(c);
    if (!user) return c.json({ error: "Akun tidak ditemukan." }, 404);
    const body = await c.req.json().catch(() => ({}));
    const role = ["master", "kadiv_hr", "staff_hr", "karyawan"].includes(body.role) ? body.role : null;
    if (!role) return c.json({ error: "Peran tidak valid." }, 400);
    if (user.role === "master" || me.id === user.id) return c.json({ error: "Peran akun utama tidak bisa diubah." }, 400);
    await pool.query("UPDATE users SET role=$2, updated_at=$3 WHERE id=$1", [user.id, role, now()]);
    await logAudit(pool, { userId: me.id, username: me.username, aksi: "set_role", rincian: username + " → " + role });
    const accs = (await pool.query("SELECT * FROM users ORDER BY role='master' DESC, username")).rows.map(acctToUI);
    return c.json({ ok: true, accounts: accs });
  });

  // Override izin per pengguna (toggle). allowed=0 → cabut, 1 → tambah.
  app.post("/api/accounts/:username/perms", requireAuth(pool), async (c) => {
    const me = c.get("user");
    const perms = c.get("perms");
    const deny = await requireAccountPerm(me, perms, c);
    if (deny) return deny;
    const { user, username } = await findUser(c);
    if (!user) return c.json({ error: "Akun tidak ditemukan." }, 404);
    if (user.role === "master" || me.id === user.id) return c.json({ error: "Izin akun utama terkunci." }, 400);
    const body = await c.req.json().catch(() => ({}));
    const key = String(body.perm_key || "");
    if (!PERM_KEYS.includes(key)) return c.json({ error: "Izin tidak dikenal." }, 400);
    const allowed = body.allowed ? 1 : 0;
    await pool.query(
      `INSERT INTO user_perms (user_id, perm_key, allowed) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, perm_key) DO UPDATE SET allowed=$3`,
      [user.id, key, allowed]
    );
    await logAudit(pool, { userId: me.id, username: me.username, aksi: "set_perm", rincian: username + " " + key + (allowed ? " +" : " -") });
    const accs = (await pool.query("SELECT * FROM users ORDER BY role='master' DESC, username")).rows.map(acctToUI);
    return c.json({ ok: true, accounts: accs });
  });

  return app;
}
