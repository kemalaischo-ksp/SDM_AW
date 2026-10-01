// Feed aktivitas (global, 200 terbaru).
import { Hono } from "hono";
import { requireAuth } from "../rbac.js";

export function activityRoutes(pool) {
  const app = new Hono();

  app.get("/api/activity", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (user.role === "staff_hr") {
      const res = await pool.query("SELECT * FROM activity WHERE type='rekrut' ORDER BY id DESC LIMIT 200");
      return c.json(res.rows.map(map));
    }
    const res = await pool.query("SELECT * FROM activity ORDER BY id DESC LIMIT 200");
    return c.json(res.rows.map(map));
  });

  return app;
}

const map = (r) => ({
  ts: r.ts, tgl: r.tgl, aksi: r.aksi, type: r.type, col: r.col,
  nama: r.nama, id: r.emp_id, unit: r.unit, ket: r.ket, by: r.by_user,
});
