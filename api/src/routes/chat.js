// ============================================================
// Chat internal HR — server-sync (Admin ⇄ Kadiv HR ⇄ Staff HR)
// Semua pesan tersimpan di DB → sinkron antar-device & peran.
// RBAC: apps.chat (master/kadiv/staff sudah punya via ROLE_PRESET).
// ============================================================
import { Hono } from "hono";
import { requireAuth } from "../rbac.js";

const ROOMS = new Set(["all", "master", "kadiv_hr", "staff_hr"]);
const MAX_HISTORY = 500; // ambil pesan terakhir per room

export function chatRoutes(pool) {
  const app = new Hono();

  const allowed = async (c) => {
    const user = c.get("user");
    if (!user) return false;
    if (user.role === "master" || user.role === "kadiv_hr" || user.role === "staff_hr") return true;
    const perms = c.get("perms");
    return perms && perms.has("apps.chat");
  };

  // GET /api/chat?room=all&after=<ts> → messages (naik, terbaru di bawah)
  app.get("/api/chat", requireAuth(pool), async (c) => {
    if (!(await allowed(c))) return c.json({ error: "Akses ditolak." }, 403);
    const room = c.req.query("room") || "all";
    if (!ROOMS.has(room)) return c.json({ error: "Room tidak valid." }, 400);
    const after = parseInt(c.req.query("after") || "0", 10) || 0;
    const res = await pool.query(
      "SELECT id, room, role, by_user as by, msg, ts FROM chat_messages WHERE room=$1 AND ts>$2 ORDER BY ts ASC LIMIT $3",
      [room, after, MAX_HISTORY]
    );
    return c.json({ room, messages: res.rows, serverTime: Date.now() });
  });

  // POST /api/chat {room, text} → simpan (role pengirim dari sesi, jangan dari body)
  app.post("/api/chat", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (!(await allowed(c))) return c.json({ error: "Akses ditolak." }, 403);
    const b = await c.req.json().catch(() => ({}));
    const room = (b.room || "all") in ROOMS ? b.room : "all";
    if (!ROOMS.has(room)) return c.json({ error: "Room tidak valid." }, 400);
    const text = String(b.text || "").trim().slice(0, 2000);
    if (!text) return c.json({ error: "Pesan kosong." }, 400);
    const ts = Date.now();
    const res = await pool.query(
      "INSERT INTO chat_messages (room, role, by_user, msg, ts) VALUES ($1,$2,$3,$4,$5) RETURNING id, role, by_user as by, msg, ts",
      [room, user.role, user.nama || user.username, text, ts]
    );
    return c.json({ ok: true, message: res.rows[0] });
  });

  // POST /api/chat/clear → hapus riwayat room (khusus master — GAJI: auditable)
  app.post("/api/chat/clear", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (user?.role !== "master") return c.json({ error: "Akses ditolak." }, 403);
    const b = await c.req.json().catch(() => ({}));
    const room = ROOMS.has(b.room) ? b.room : "all";
    await pool.query("DELETE FROM chat_messages WHERE room=$1", [room]);
    return c.json({ ok: true, room, cleared: true });
  });

  return app;
}