// ============================================================
// Calendar tim HR — agenda tersimpan di server (sinkron antar-perangkat).
// Kaldik & estimasi rekrutmen tetap dihitung di frontend; di sini hanya
// agenda manual. RBAC: apps.calendar. Edit/hapus: pembuat atau Master.
// ============================================================
import { Hono } from "hono";
import { requireAuth } from "../rbac.js";

const KATEGORI = new Set(["agenda", "rapat", "deadline", "libur", "ujian", "kaldik"]);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isTime = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const toUI = (r) => ({
  id: r.id, d: r.tgl, end: r.tgl_akhir || null, jam: r.jam || "", t: r.judul, k: r.kategori,
  note: r.catatan || "", by: r.created_by || "", byNama: r.by_nama || "",
  createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
});

function clean(b, partial) {
  const o = {};
  if (!partial || b.t !== undefined) {
    const t = String(b.t || "").trim().slice(0, 160);
    if (!t) return { err: "Judul agenda wajib diisi." };
    o.judul = t;
  }
  if (!partial || b.d !== undefined) {
    if (!isDate(b.d)) return { err: "Tanggal tidak valid." };
    o.tgl = b.d;
  }
  if (b.end !== undefined) {
    if (b.end && !isDate(b.end)) return { err: "Tanggal akhir tidak valid." };
    o.tgl_akhir = b.end || null;
  }
  if (b.jam !== undefined) {
    if (b.jam && !isTime(b.jam)) return { err: "Jam tidak valid (HH:MM)." };
    o.jam = b.jam || null;
  }
  if (b.k !== undefined) o.kategori = KATEGORI.has(b.k) ? b.k : "agenda";
  if (b.note !== undefined) o.catatan = String(b.note || "").slice(0, 1000) || null;
  return { o };
}

export function calendarRoutes(pool) {
  const app = new Hono();
  const guard = async (c, next) => {
    // tim HR (master/kadiv/staff) selalu boleh — sama spt chat; peran lain lewat izin apps.calendar
    const u = c.get("user");
    if (!["master", "kadiv_hr", "staff_hr"].includes(u.role) && !c.get("perms").has("apps.calendar")) return c.json({ error: "Akses ditolak." }, 403);
    await next();
  };

  app.get("/api/calendar", requireAuth(pool), guard, async (c) => {
    const res = await pool.query("SELECT * FROM calendar_events ORDER BY tgl, jam NULLS FIRST, created_at");
    return c.json({ events: res.rows.map(toUI) });
  });

  app.post("/api/calendar", requireAuth(pool), guard, async (c) => {
    const user = c.get("user");
    const { o, err } = clean(await c.req.json().catch(() => ({})), false);
    if (err) return c.json({ error: err }, 400);
    if (o.tgl_akhir && o.tgl_akhir < o.tgl) return c.json({ error: "Tanggal akhir sebelum tanggal mulai." }, 400);
    const id = "ev" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    const now = Date.now();
    const r = await pool.query(
      `INSERT INTO calendar_events (id, tgl, tgl_akhir, jam, judul, kategori, catatan, created_by, by_nama, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
      [id, o.tgl, o.tgl_akhir || null, o.jam || null, o.judul, o.kategori || "agenda", o.catatan || null, user.username, user.nama || user.username, now]
    );
    return c.json({ ok: true, event: toUI(r.rows[0]) });
  });

  const owned = async (c) => {
    const user = c.get("user");
    const ev = (await pool.query("SELECT * FROM calendar_events WHERE id=$1", [c.req.param("id")])).rows[0];
    if (!ev) return { err: c.json({ error: "Agenda tidak ditemukan." }, 404) };
    if (ev.created_by !== user.username && user.role !== "master") return { err: c.json({ error: "Hanya pembuat agenda atau Master yang bisa mengubah." }, 403) };
    return { ev };
  };

  app.patch("/api/calendar/:id", requireAuth(pool), guard, async (c) => {
    const { ev, err: e1 } = await owned(c);
    if (e1) return e1;
    const { o, err } = clean(await c.req.json().catch(() => ({})), true);
    if (err) return c.json({ error: err }, 400);
    const merged = { ...ev, ...o };
    if (merged.tgl_akhir && merged.tgl_akhir < merged.tgl) return c.json({ error: "Tanggal akhir sebelum tanggal mulai." }, 400);
    const r = await pool.query(
      `UPDATE calendar_events SET tgl=$2, tgl_akhir=$3, jam=$4, judul=$5, kategori=$6, catatan=$7, updated_at=$8 WHERE id=$1 RETURNING *`,
      [ev.id, merged.tgl, merged.tgl_akhir || null, merged.jam || null, merged.judul, merged.kategori, merged.catatan || null, Date.now()]
    );
    return c.json({ ok: true, event: toUI(r.rows[0]) });
  });

  app.delete("/api/calendar/:id", requireAuth(pool), guard, async (c) => {
    const { ev, err } = await owned(c);
    if (err) return err;
    await pool.query("DELETE FROM calendar_events WHERE id=$1", [ev.id]);
    return c.json({ ok: true });
  });

  return app;
}
