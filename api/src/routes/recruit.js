// Rekrutmen: daftar kandidat, import CSV (parsing di sisi klien), patch
// data/set gaji, interview akhir, pengajuan & persetujuan aktivasi → karyawan.
import { Hono } from "hono";
import { requireAuth } from "../rbac.js";
import { candToUI } from "../serializers.js";
import { genNIP } from "../serializers.js";
import { logActivity, logAudit } from "../audit.js";

const now = () => Date.now();
const money = (v) => { const t = String(v ?? "").replace(/[^\d]/g, ""); return t ? parseInt(t, 10) : 0; };

const CAND_COLS = {
  no: "no", nama: "nama", email: "email", wa: "wa", cv: "cv", kesehatan: "kesehatan",
  gender: "gender", status: "status", pantuhir: "pantuhir", unit: "unit", cabangRaw: "cabang_raw",
  mapel: "mapel", s1: "s1", s2: "s2", review: "review", konfirmasi: "konfirmasi",
  nego: "nego", beritaAcara: "berita_acara", interview: "interview",
  interviewNote: "interview_note", interviewTgl: "interview_tgl", interviewBy: "interview_by",
  pantuhirNote: "pantuhir_note", estimasi: "estimasi", estimasiAktif: "estimasi_aktif", estimasiNote: "estimasi_note",
  aktivasi: "aktivasi", tglAjuan: "tgl_ajuan",
};
const CAND_JSON = { interviewLog: "interview_log" };
const CAND_MONEY = { pengajuan: "pengajuan", thpKotor: "thp_kotor", thpSet: "thp_set", thpBersih: "thp_bersih", tk: "tk", thr: "thr" };

export function recruitRoutes(pool) {
  const app = new Hono();

  app.get("/api/recruit", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && user.role !== "staff_hr" && !perms.has("recruitment.view")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const res = await pool.query("SELECT * FROM recruit_candidates ORDER BY no NULLS LAST, nama");
    return c.json(res.rows.map(candToUI));
  });

  // Import massal dari hasil parsing CSV (array objek kandidat).
  app.post("/api/recruit/bulk", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && !perms.has("recruitment.edit")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return c.json({ error: "Tidak ada kandidat." }, 400);
    const t = now();
    let n = 0;
    for (const it of items) {
      if (!it?.nama) continue;
      const id = "N" + t + n;
      await pool.query(
        `INSERT INTO recruit_candidates
          (id, no, nama, email, wa, cv, kesehatan, gender, status, pantuhir, unit, cabang_raw, mapel,
           s1, s2, pengajuan, review, thp_kotor, thp_set, thp_bersih, tk, thr, konfirmasi, nego, berita_acara, tgl_ajuan, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
        [id, it.no || "", String(it.nama || ""), it.email || "", it.wa || "", it.cv || "", it.kesehatan || "",
         it.gender || "", it.status || "LANJUT", it.pantuhir || "", it.unit || "", it.cabangRaw || "", it.mapel || "",
         it.s1 || "", it.s2 || "", money(it.pengajuan), it.review || "", money(it.thpKotor), money(it.thpSet), money(it.thpBersih),
         money(it.tk), money(it.thr), it.konfirmasi || "", it.nego || "", it.beritaAcara || "",
         new Date().toISOString().slice(0, 10), user.nama, t]
      );
      n++;
    }
    await logActivity(pool, { aksi: `Upload ${n} Kandidat Baru (CSV)`, type: "rekrut", nama: n + " kandidat", unit: "—", ket: "via import", by: user.nama });
    const res = await pool.query("SELECT * FROM recruit_candidates ORDER BY no NULLS LAST, nama");
    return c.json(res.rows.map(candToUI));
  });

  // Patch kandidat (recSet): status, review, pantuhir, set gaji, konfirmasi, dll.
  app.patch("/api/recruit/:id", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && user.role !== "staff_hr" && !perms.has("recruitment.interview")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const patch = {};
    for (const [camel, snake] of Object.entries(CAND_COLS)) {
      if (Object.prototype.hasOwnProperty.call(body, camel)) patch[snake] = body[camel];
    }
    for (const [camel, snake] of Object.entries(CAND_JSON)) {
      if (Object.prototype.hasOwnProperty.call(body, camel)) patch[snake] = JSON.stringify(body[camel] || []);
    }
    for (const [camel, snake] of Object.entries(CAND_MONEY)) {
      if (Object.prototype.hasOwnProperty.call(body, camel)) patch[snake] = money(body[camel]);
    }
    if (Object.prototype.hasOwnProperty.call(body, "aktivasi")) patch.aktivasi = String(body.aktivasi || "");
    if (!Object.keys(patch).length) return c.json({ error: "Tidak ada field." }, 400);
    const sets = Object.keys(patch).map((k, i) => `${k}=$${i + 1}`).join(", ");
    const res = await pool.query(`UPDATE recruit_candidates SET ${sets} WHERE id=$${Object.keys(patch).length + 1} RETURNING *`, [...Object.values(patch), id]);
    if (!res.rowCount) return c.json({ error: "Kandidat tidak ditemukan." }, 404);
    return c.json(candToUI(res.rows[0]));
  });

  // Interview akhir: Lanjut / Hold / Batal (catatan opsional).
  app.post("/api/recruit/:id/interview", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && user.role !== "staff_hr" && !perms.has("recruitment.interview")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const val = ["Lanjut", "Hold", "Batal"].includes(body.value) ? body.value : null;
    if (!val) return c.json({ error: "Nilai tidak valid." }, 400);
    const res = await pool.query(
      `UPDATE recruit_candidates SET interview=$2, interview_note=$3, interview_tgl=$4 WHERE id=$1 RETURNING *`,
      [id, val, String(body.note || ""), new Date().toISOString().slice(0, 10)]
    );
    if (!res.rowCount) return c.json({ error: "Kandidat tidak ditemukan." }, 404);
    const cdd = res.rows[0];
    await logActivity(pool, { aksi: `Interview: ${val}`, type: "rekrut", nama: cdd.nama, unit: cdd.unit, ket: body.note || "", by: user.nama });
    return c.json(candToUI(cdd));
  });

  // Aktivasi: 'diajukan' (KADIV/Staff) → 'approved' (Master) → jadikan karyawan.
  app.post("/api/recruit/:id/aktivasi", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    const body = await c.req.json().catch(() => ({}));
    const action = body.action === "approved" ? "approved" : "diajukan";
    if (action === "approved") {
      if (user.role !== "master" && !perms.has("recruitment.approve")) return c.json({ error: "Akses ditolak." }, 403);
    } else if (user.role !== "master" && user.role !== "kadiv_hr" && !perms.has("recruitment.edit")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const id = c.req.param("id");
    const cdd = (await pool.query("SELECT * FROM recruit_candidates WHERE id=$1", [id])).rows[0];
    if (!cdd) return c.json({ error: "Kandidat tidak ditemukan." }, 404);
    if (action === "diajukan") {
      if (cdd.aktivasi === "approved") return c.json({ error: "Sudah aktif." }, 400);
      await pool.query("UPDATE recruit_candidates SET aktivasi='diajukan', tgl_ajuan=COALESCE(tgl_ajuan,$2) WHERE id=$1", [id, new Date().toISOString().slice(0, 10)]);
      await logActivity(pool, { aksi: "Ajukan Aktivasi Kandidat", type: "rekrut", nama: cdd.nama, unit: cdd.unit, ket: "Menunggu persetujuan Master Admin", by: user.nama });
      return c.json(candToUI({ ...cdd, aktivasi: "diajukan", tgl_ajuan: cdd.tgl_ajuan || new Date().toISOString().slice(0, 10) }));
    }
    // approve → konversi jadi karyawan
    const thp = Number(cdd.thp_set || cdd.thp_bersih || cdd.pengajuan || 0);
    const empId = await nextEmpId(pool);
    const year = String(new Date().getFullYear());
    const jabatan = cdd.mapel ? "Guru Mata Pelajaran" : "Karyawan";
    const empRow = {
      id: empId, nama: cdd.nama, unit: cdd.unit || "", cabang: cdd.cabang_raw || cdd.unit || "",
      jabatan, posisi: jabatan, mapel: cdd.mapel || "", mapel_guru: cdd.mapel || "",
      thn_aktif: year, thp, thp_bersih: thp, email: cdd.email || "",
      s1_univ: cdd.s1 || "", link_kesehatan: cdd.kesehatan || "", link_cv: cdd.cv || "",
      status_kerja: "Aktif", created_at: now(), updated_at: now(),
    };
    const nip = await genNIP(pool, empRow);
    empRow.nip = nip;
    await pool.query(
      `INSERT INTO employees (${Object.keys(empRow).join(",")}) VALUES (${Object.keys(empRow).map((_, i) => "$" + (i + 1)).join(",")})`,
      Object.values(empRow)
    );
    await pool.query(
      "INSERT INTO job_history (emp_id, thn, jabatan, unit, aksi) VALUES ($1,$2,$3,$4,$5)",
      [empId, year, jabatan, empRow.unit, "Aktivasi rekrutmen"]
    );
    await pool.query("UPDATE recruit_candidates SET aktivasi='approved' WHERE id=$1", [id]);
    await logActivity(pool, { aksi: "Aktivasi Disetujui → Karyawan", type: "rekrut", nama: cdd.nama, empId, unit: cdd.unit, ket: `NIP ${nip} · ${thp}`, by: user.nama });
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "recruit_approve", rincian: id + " → " + empId });
    return c.json({ ok: true, empId, nip });
  });

  // ----- Log aktivitas rekrutmen (recLog) — mirror lintas user -----
  app.get("/api/recruit/log", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    // staff_hr & atau role HR/master dapat lihat; karyawan tidak.
    if (user.role === "karyawan" && !perms.has("recruitment.view")) return c.json({ error: "Akses ditolak." }, 403);
    const res = await pool.query(
      "SELECT rl.id, rl.candidate_id, rl.tgl, rl.aksi, rl.note, rl.by_user, rl.created_at, rc.nama, rc.unit FROM recruit_log rl LEFT JOIN recruit_candidates rc ON rc.id=rl.candidate_id ORDER BY rl.id DESC LIMIT 300"
    );
    return c.json(res.rows.map((r) => ({
      ts: r.created_at, tgl: r.tgl, id: r.candidate_id, nama: r.nama || "", unit: r.unit || "",
      aksi: r.aksi, note: r.note || "", by: r.by_user || "",
    })));
  });

  app.post("/api/recruit/log", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const cand = String(body.id || "");
    if (cand) {
      const cdd = (await pool.query("SELECT nama, unit FROM recruit_candidates WHERE id=$1", [cand])).rows[0];
      if (cdd) {
        await logActivity(pool, {
          aksi: String(body.aksi || "Update Kandidat"),
          type: "rekrut", nama: cdd.nama, empId: cand, unit: cdd.unit,
          ket: String(body.note || ""), by: user.nama,
        });
      }
    }
    await pool.query(
      "INSERT INTO recruit_log (candidate_id, tgl, aksi, note, by_user, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [cand || null, new Date().toISOString().slice(0, 10), String(body.aksi || "Update"), String(body.note || ""), user.nama, Date.now()]
    );
    return c.json({ ok: true });
  });

  return app;
}

async function nextEmpId(pool) {
  const res = await pool.query("SELECT COALESCE(MAX(CASE WHEN id ~ '^[0-9]+$' THEN id::bigint ELSE 0 END),0)+1 AS n FROM employees");
  return String(res.rows[0].n);
}
