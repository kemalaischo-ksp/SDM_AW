// Request: pengajuan (cuti/izin/resign), tiket helpdesk, perubahan profil.
import { Hono } from "hono";
import { requireAuth } from "../rbac.js";
import { logActivity, logAudit } from "../audit.js";
import { reqToUI } from "../serializers.js";

const now = () => Date.now();
const today = () => new Date().toISOString().slice(0, 10);

export function requestsRoutes(pool) {
  const app = new Hono();

  app.get("/api/requests", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (user.role === "karyawan") {
      const res = await pool.query("SELECT * FROM requests WHERE emp_id=$1 ORDER BY created_at DESC", [user.empId || "__none__"]);
      return c.json(res.rows.map(reqToUI));
    }
    const res = await pool.query("SELECT * FROM requests ORDER BY created_at DESC LIMIT 2000");
    return c.json(res.rows.map(reqToUI));
  });

  app.post("/api/requests", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const kind = body.kind === "tiket" ? "tiket" : body.kind === "profil" ? "profil" : "ajuan";
    let empId = user.empId || "";
    let nama = user.nama;
    let unit = user.unit || "";
    if (user.role !== "karyawan" && body.empId) {
      empId = String(body.empId);
      const e = (await pool.query("SELECT nama, unit FROM employees WHERE id=$1", [empId])).rows[0];
      if (e) { nama = e.nama; unit = e.unit || unit; }
    }
    const rec = {
      id: (kind === "tiket" ? "TKT" : kind === "profil" ? "PRF" : "REQ") + now(),
      kind, empId, nama, unit,
      judul: String(body.judul || "").slice(0, 200),
      cat: String(body.cat || "").slice(0, 80),
      prio: String(body.prio || "").slice(0, 20),
      desc: String(body.desc || "").slice(0, 2000),
      strata: String(body.strata || "").slice(0, 20),
      lampiran: String(body.lampiran || "").slice(0, 255),
      mulai: String(body.mulai || ""),
      selesai: String(body.selesai || ""),
      alasan: String(body.alasan || "").slice(0, 1000),
      changes: body.changes && typeof body.changes === "object" ? JSON.stringify(body.changes) : null,
      tgl: today(),
      waktu: new Date().toLocaleString("id-ID"),
      status: kind === "tiket" ? "Baru" : "Menunggu",
      created_at: now(),
    };
    await pool.query(
      `INSERT INTO requests (id, kind, emp_id, nama, unit, judul, cat, prio, body, strata, lampiran, mulai, selesai, alasan, changes, tgl, waktu, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [rec.id, rec.kind, empId, nama, unit, rec.judul, rec.cat, rec.prio, rec.desc, rec.strata, rec.lampiran, rec.mulai, rec.selesai, rec.alasan, rec.changes, rec.tgl, rec.waktu, rec.status, rec.created_at]
    );
    await logActivity(pool, {
      aksi: kind === "tiket" ? `Tiket: ${rec.judul}` : kind === "profil" ? "Pengajuan Ubah Profil" : `Pengajuan ${rec.judul}`,
      type: kind, nama, empId, unit, ket: rec.alasan || rec.judul, by: nama,
    });
    return c.json({ ok: true, id: rec.id });
  });

  // Keputusan pengajuan: Disetujui / Ditolak. (ajuan & profil)
  app.post("/api/requests/:id/decide", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    const canLeave = perms.has("leave.approve") || user.role === "master" || user.role === "kadiv_hr";
    const canEmp = perms.has("employees.edit") || user.role === "master" || user.role === "kadiv_hr";
    const body = await c.req.json().catch(() => ({}));
    const decision = body.decision === "Ditolak" ? "Ditolak" : "Disetujui";
    const id = c.req.param("id");
    const r = (await pool.query("SELECT * FROM requests WHERE id=$1", [id])).rows[0];
    if (!r) return c.json({ error: "Tidak ditemukan." }, 404);
    if (r.kind === "profil" && !canEmp) return c.json({ error: "Akses ditolak." }, 403);
    if (r.kind === "ajuan" && !canLeave) return c.json({ error: "Akses ditolak." }, 403);

    await pool.query("UPDATE requests SET status=$2 WHERE id=$1", [id, decision]);

    if (decision === "Disetujui") {
      if (r.kind === "profil" && r.changes) {
        // terapkan diff ke data karyawan
        const changes = typeof r.changes === "string" ? JSON.parse(r.changes) : r.changes;
        const e = (await pool.query("SELECT * FROM employees WHERE id=$1", [r.emp_id || ""])).rows[0];
        if (e && changes) {
          const upd = { updated_at: now() };
          const map = {
            nikKtp: "nik_ktp", email: "email", noHp: "no_hp", alamat: "alamat",
            tmpLahir: "tmp_lahir", namaBank: "nama_bank", rekBSI: "rek_bsi",
          };
          for (const [k, v] of Object.entries(changes)) {
            const col = map[k] || k;
            upd[col] = typeof v === "object" && v && "ke" in v ? String(v.ke) : String(v);
          }
          const sets = Object.keys(upd).map((k, i) => `${k}=$${i + 1}`).join(", ");
          await pool.query(`UPDATE employees SET ${sets} WHERE id=$${Object.keys(upd).length + 1}`, [...Object.values(upd), r.emp_id]);
          await logActivity(pool, { aksi: "Perubahan Profil Disetujui", type: "profil", nama: r.nama, empId: r.emp_id, unit: r.unit, ket: "Database diperbarui", by: user.nama });
        }
      }
      if (r.kind === "ajuan" && /resign/i.test(r.judul || "")) {
        const e = (await pool.query("SELECT * FROM employees WHERE id=$1", [r.emp_id || ""])).rows[0];
        if (e) {
          await pool.query("UPDATE employees SET status_kerja='Resign', updated_at=$2 WHERE id=$1", [e.id, now()]);
          await pool.query("INSERT INTO employee_history (emp_id, aksi, tgl, ket, by_user) VALUES ($1,$2,$3,$4,$5)",
            [e.id, "Resign (via pengajuan)", today(), r.alasan || "", user.nama]);
          await logActivity(pool, { aksi: "Resign disetujui", type: "resign", nama: e.nama, empId: e.id, unit: e.unit, ket: r.alasan || "", by: user.nama });
        }
      }
    }
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "request:" + decision, rincian: id });
    return c.json({ ok: true });
  });

  // Respon tiket: Diproses / Selesai.
  app.post("/api/requests/:id/respond", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && !perms.has("ticketing.respond")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const st = body.status === "Selesai" ? "Selesai" : "Diproses";
    const r = (await pool.query("SELECT * FROM requests WHERE id=$1", [id])).rows[0];
    if (!r) return c.json({ error: "Tidak ditemukan." }, 404);
    await pool.query("UPDATE requests SET status=$2 WHERE id=$1", [id, st]);
    await logActivity(pool, { aksi: "Tiket → " + st, type: "tiket", nama: r.nama, empId: r.emp_id, unit: r.unit, ket: r.judul, by: user.nama });
    return c.json({ ok: true });
  });

  return app;
}
