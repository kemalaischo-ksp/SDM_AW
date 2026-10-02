// ============================================================
// Chat internal HR — server-sync (Admin ⇄ Kadiv HR ⇄ Staff HR)
// Semua pesan tersimpan di DB → sinkron antar-device & peran.
// Fitur: balas (reply), reaksi emoji, edit & hapus pesan sendiri,
// ringkasan per room (pesan terakhir + jumlah belum dibaca).
// RBAC: apps.chat (master/kadiv/staff sudah punya via ROLE_PRESET).
// ============================================================
import { Hono } from "hono";
import { requireAuth } from "../rbac.js";

const ROOMS = ["all", "master", "kadiv_hr", "staff_hr"];
const MAX_HISTORY = 300; // pesan terakhir per room
const EMOJIS = new Set(["👍", "❤️", "😂", "🙏", "✅", "👀"]);

export function chatRoutes(pool) {
  const app = new Hono();

  const allowed = (c) => {
    const user = c.get("user");
    if (!user) return false;
    if (["master", "kadiv_hr", "staff_hr"].includes(user.role)) return true;
    const perms = c.get("perms");
    return !!(perms && perms.has("apps.chat"));
  };
  const guard = async (c, next) => {
    if (!allowed(c)) return c.json({ error: "Akses ditolak." }, 403);
    await next();
  };

  async function loadRoom(room) {
    const res = await pool.query(
      `SELECT * FROM (
         SELECT id, room, role, by_user AS by, by_username AS u, msg, ts, reply_to, edited_at, deleted
           FROM chat_messages WHERE room=$1 ORDER BY ts DESC LIMIT $2
       ) t ORDER BY ts ASC`,
      [room, MAX_HISTORY]
    );
    const ids = res.rows.map((r) => r.id);
    const reacts = ids.length
      ? (await pool.query("SELECT msg_id, emoji, username FROM chat_reactions WHERE msg_id = ANY($1::bigint[])", [ids])).rows
      : [];
    const byMsg = new Map();
    for (const r of reacts) {
      const m = byMsg.get(String(r.msg_id)) || {};
      (m[r.emoji] = m[r.emoji] || []).push(r.username);
      byMsg.set(String(r.msg_id), m);
    }
    return res.rows.map((r) => ({
      id: String(r.id), room: r.room, role: r.role, by: r.by, u: r.u || "",
      msg: r.deleted ? "" : r.msg, ts: Number(r.ts),
      replyTo: r.reply_to ? String(r.reply_to) : null,
      edited: !!r.edited_at, deleted: !!r.deleted,
      reactions: byMsg.get(String(r.id)) || {},
    }));
  }

  // GET /api/chat?room=all → pesan (naik, terbaru di bawah)
  app.get("/api/chat", requireAuth(pool), guard, async (c) => {
    const room = c.req.query("room") || "all";
    if (!ROOMS.includes(room)) return c.json({ error: "Room tidak valid." }, 400);
    return c.json({ room, messages: await loadRoom(room), serverTime: Date.now() });
  });

  // GET /api/chat/summary?seen=<json {room:ts}> → per room: pesan terakhir + unread
  app.get("/api/chat/summary", requireAuth(pool), guard, async (c) => {
    const me = c.get("user");
    let seen = {};
    try { seen = JSON.parse(c.req.query("seen") || "{}") || {}; } catch { seen = {}; }
    const out = {};
    for (const room of ROOMS) {
      const since = Number(seen[room]) || 0;
      const last = (await pool.query(
        "SELECT by_user AS by, msg, ts, deleted FROM chat_messages WHERE room=$1 ORDER BY ts DESC LIMIT 1", [room]
      )).rows[0];
      const unread = (await pool.query(
        "SELECT COUNT(*)::int AS n FROM chat_messages WHERE room=$1 AND ts>$2 AND deleted=0 AND COALESCE(by_username,'')<>$3",
        [room, since, me.username]
      )).rows[0].n;
      out[room] = {
        unread,
        last: last ? { by: last.by, msg: last.deleted ? "" : String(last.msg).slice(0, 80), ts: Number(last.ts), deleted: !!last.deleted } : null,
      };
    }
    return c.json({ rooms: out, serverTime: Date.now() });
  });

  // POST /api/chat {room, text, replyTo?} → simpan (identitas pengirim dari sesi, bukan body)
  app.post("/api/chat", requireAuth(pool), guard, async (c) => {
    const user = c.get("user");
    const b = await c.req.json().catch(() => ({}));
    const room = ROOMS.includes(b.room) ? b.room : "all";
    const text = String(b.text || "").trim().slice(0, 2000);
    if (!text) return c.json({ error: "Pesan kosong." }, 400);
    let replyTo = null;
    if (b.replyTo && /^\d+$/.test(String(b.replyTo))) {
      const ok = (await pool.query("SELECT 1 FROM chat_messages WHERE id=$1 AND room=$2", [b.replyTo, room])).rowCount;
      if (ok) replyTo = String(b.replyTo);
    }
    const res = await pool.query(
      `INSERT INTO chat_messages (room, role, by_user, by_username, msg, ts, reply_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [room, user.role, user.nama || user.username, user.username, text, Date.now(), replyTo]
    );
    return c.json({ ok: true, id: String(res.rows[0].id) });
  });

  const ownMsg = async (c) => {
    const id = c.req.param("id");
    if (!/^\d+$/.test(id)) return { err: c.json({ error: "ID tidak valid." }, 400) };
    const m = (await pool.query("SELECT * FROM chat_messages WHERE id=$1", [id])).rows[0];
    if (!m) return { err: c.json({ error: "Pesan tidak ditemukan." }, 404) };
    return { m };
  };

  // PATCH /api/chat/:id {text} → edit pesan sendiri
  app.patch("/api/chat/:id", requireAuth(pool), guard, async (c) => {
    const user = c.get("user");
    const { m, err } = await ownMsg(c);
    if (err) return err;
    if (m.by_username !== user.username) return c.json({ error: "Hanya bisa mengedit pesan sendiri." }, 403);
    if (m.deleted) return c.json({ error: "Pesan sudah dihapus." }, 400);
    const b = await c.req.json().catch(() => ({}));
    const text = String(b.text || "").trim().slice(0, 2000);
    if (!text) return c.json({ error: "Pesan kosong." }, 400);
    await pool.query("UPDATE chat_messages SET msg=$2, edited_at=$3 WHERE id=$1", [m.id, text, Date.now()]);
    return c.json({ ok: true });
  });

  // DELETE /api/chat/:id → hapus (soft) pesan sendiri; master boleh menghapus pesan siapa pun
  app.delete("/api/chat/:id", requireAuth(pool), guard, async (c) => {
    const user = c.get("user");
    const { m, err } = await ownMsg(c);
    if (err) return err;
    if (m.by_username !== user.username && user.role !== "master") return c.json({ error: "Hanya bisa menghapus pesan sendiri." }, 403);
    await pool.query("UPDATE chat_messages SET deleted=1, msg='' WHERE id=$1", [m.id]);
    await pool.query("DELETE FROM chat_reactions WHERE msg_id=$1", [m.id]);
    return c.json({ ok: true });
  });

  // POST /api/chat/:id/react {emoji} → toggle reaksi
  app.post("/api/chat/:id/react", requireAuth(pool), guard, async (c) => {
    const user = c.get("user");
    const { m, err } = await ownMsg(c);
    if (err) return err;
    if (m.deleted) return c.json({ error: "Pesan sudah dihapus." }, 400);
    const b = await c.req.json().catch(() => ({}));
    const emoji = String(b.emoji || "");
    if (!EMOJIS.has(emoji)) return c.json({ error: "Emoji tidak didukung." }, 400);
    const del = await pool.query("DELETE FROM chat_reactions WHERE msg_id=$1 AND username=$2 AND emoji=$3", [m.id, user.username, emoji]);
    if (!del.rowCount) {
      await pool.query("INSERT INTO chat_reactions (msg_id, username, emoji) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [m.id, user.username, emoji]);
    }
    return c.json({ ok: true, on: !del.rowCount });
  });

  // POST /api/chat/clear → hapus riwayat room (khusus master)
  app.post("/api/chat/clear", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (user?.role !== "master") return c.json({ error: "Akses ditolak." }, 403);
    const b = await c.req.json().catch(() => ({}));
    const room = ROOMS.includes(b.room) ? b.room : "all";
    await pool.query("DELETE FROM chat_messages WHERE room=$1", [room]);
    return c.json({ ok: true, room, cleared: true });
  });

  return app;
}
