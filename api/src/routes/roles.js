// Peran & preset izin (role_perms) — dikelola Master Admin.
import { Hono } from "hono";
import { requireAuth, PERM_KEYS } from "../rbac.js";
import { logAudit } from "../audit.js";
import { ROLE_META } from "../../seed.js";

export function rolesRoutes(pool) {
  const app = new Hono();

  app.get("/api/roles", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && !perms.has("accounts")) return c.json({ error: "Akses ditolak." }, 403);
    const res = await pool.query("SELECT role, perm_key FROM role_perms ORDER BY role, perm_key");
    const byRole = new Map();
    for (const r of res.rows) {
      if (!byRole.has(r.role)) byRole.set(r.role, []);
      byRole.get(r.role).push(r.perm_key);
    }
    const roles = Object.keys(ROLE_META).map((role) => ({
      role,
      label: ROLE_META[role]?.label || role,
      perms: role === "master" ? [...PERM_KEYS] : byRole.get(role) || [],
    }));
    return c.json({ roles, catalog: PERM_KEYS });
  });

  // Set preset izin per tugas role (master selalu semua izin).
  app.put("/api/roles/:role/perms", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && !perms.has("accounts")) return c.json({ error: "Akses ditolak." }, 403);
    const role = c.req.param("role");
    if (!ROLE_META[role] || role === "master") return c.json({ error: "Role tidak valid / master terkunci." }, 400);
    const body = await c.req.json().catch(() => ({}));
    const list = Array.isArray(body.perms) ? body.perms.filter((k) => PERM_KEYS.includes(k)) : [];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM role_perms WHERE role=$1", [role]);
      for (const k of list) await client.query("INSERT INTO role_perms (role, perm_key) VALUES ($1,$2)", [role, k]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "set_role_perms", rincian: role + " " + list.length + " izin" });
    return c.json({ ok: true, role, perms: list });
  });

  return app;
}
