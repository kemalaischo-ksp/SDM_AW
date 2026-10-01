// Presensi harian: check-in/out mandiri + rekap monitoring per cabang.
import { Hono } from "hono";
import { requireAuth } from "../rbac.js";
import { logActivity } from "../audit.js";

const today = () => new Date().toISOString().slice(0, 10);

export function attendanceRoutes(pool) {
  const app = new Hono();

  // status hari ini miliknya sendiri
  app.get("/api/attendance/today", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (!user.empId) return c.json({ in: "", out: "" });
    const res = await pool.query("SELECT jam_in, jam_out FROM attendance WHERE emp_id=$1 AND tgl=$2", [String(user.empId), today()]);
    if (!res.rowCount) return c.json({ in: "", out: "" });
    return c.json({ in: res.rows[0].jam_in || "", out: res.rows[0].jam_out || "" });
  });

  app.post("/api/attendance/check", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (!user.empId) return c.json({ error: "Akun tidak terhubung ke karyawan." }, 400);
    const body = await c.req.json().catch(() => ({}));
    const which = body.which === "out" ? "out" : "in";
    const t = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const d = today();
    const cur = (await pool.query("SELECT * FROM attendance WHERE emp_id=$1 AND tgl=$2", [String(user.empId), d])).rows[0];
    if (!cur) {
      await pool.query("INSERT INTO attendance (emp_id, tgl, jam_in, jam_out, status) VALUES ($1,$2,$3,$4,$5)",
        [String(user.empId), d, which === "in" ? t : null, which === "out" ? t : null, "Hadir"]);
    } else if (which === "in" && !cur.jam_in) {
      await pool.query("UPDATE attendance SET jam_in=$3 WHERE emp_id=$1 AND tgl=$2", [String(user.empId), d, t]);
    } else if (which === "out" && cur.jam_in && !cur.jam_out) {
      await pool.query("UPDATE attendance SET jam_out=$3 WHERE emp_id=$1 AND tgl=$2", [String(user.empId), d, t]);
    } else {
      return c.json({ error: which === "in" ? "Sudah check-in" : "Sudah check-out / belum check-in" }, 400);
    }
    const row = (await pool.query("SELECT jam_in, jam_out FROM attendance WHERE emp_id=$1 AND tgl=$2", [String(user.empId), d])).rows[0];
    await logActivity(pool, { aksi: which === "in" ? "Check-in" : "Check-out", type: "attendance", nama: user.nama, empId: user.empId, unit: user.unit, ket: t, by: user.nama });
    return c.json({ in: row.jam_in || "", out: row.jam_out || "" });
  });

  // Monitoring: rekap kehadiran per tanggal + filter unit.
  app.get("/api/attendance", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && !perms.has("attendance")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const tgl = c.req.query("tgl") || today();
    const unit = c.req.query("unit");
    let sql = `SELECT a.emp_id, a.tgl, a.jam_in, a.jam_out, a.status, e.nama, e.unit
               FROM attendance a JOIN employees e ON e.id=a.emp_id WHERE a.tgl=$1`;
    const params = [tgl];
    if (unit) { params.push(unit); sql += ` AND e.unit=$2`; }
    sql += " ORDER BY e.unit, e.nama";
    const res = await pool.query(sql, params);
    return c.json(res.rows);
  });

  return app;
}
