// Employees: daftar (scoped PII), buat, edit, aksi SDM, generate NIP.
import { Hono } from "hono";
import { genNIP, empToUI } from "../serializers.js";
import { requireAuth } from "../rbac.js";
import { logActivity, logAudit } from "../audit.js";

const COL = {
  nama: "nama", jabatan: "jabatan", posisi: "posisi", unit: "unit", cabang: "cabang",
  mapelGuru: "mapel_guru", mapel: "mapel", thnAktif: "thn_aktif", tglAktif: "tgl_aktif",
  gelar: "gelar", gender: "gender", nikKtp: "nik_ktp", status: "status",
  tmpLahir: "tmp_lahir", tglLahir: "tgl_lahir", usia: "usia", transport: "transport",
  alamat: "alamat", email: "email", noHp: "no_hp", tinggi: "tinggi", berat: "berat",
  s1univ: "s1_univ", s1prodi: "s1_prodi", s1ipk: "s1_ipk", s2univ: "s2_univ",
  s2prodi: "s2_prodi", s3univ: "s3_univ", namaBank: "nama_bank", rekBSI: "rek_bsi",
  rekLain: "rek_lain", linkKesehatan: "link_kesehatan", linkCV: "link_cv",
  linkPegawai: "link_pegawai", photo: "photo", golDarah: "gol_darah",
  kontakDarurat: "kontak_darurat", alergi: "alergi", riwayatSakit: "riwayat_sakit",
};
const MONEY = ["thp", "thpKotor", "thpBersih", "thr", "tk", "gajiAjuan"];
const MONEY_COL = { thp: "thp", thpKotor: "thp_kotor", thpBersih: "thp_bersih", thr: "thr", tk: "tk", gajiAjuan: "gaji_ajuan" };

const now = () => Date.now();

async function hydrateOne(pool, id) {
  const rows = (await pool.query("SELECT * FROM employees WHERE id=$1", [id])).rows;
  if (!rows.length) return null;
  return (await hydrateUsers(pool, rows))[0];
}

async function hydrateUsers(pool, rows) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const hist = (await pool.query("SELECT * FROM employee_history WHERE emp_id = ANY($1) ORDER BY id DESC", [ids])).rows;
  const jh = (await pool.query("SELECT * FROM job_history WHERE emp_id = ANY($1) ORDER BY id DESC", [ids])).rows;
  const histBy = new Map(), jhBy = new Map();
  for (const h of hist) {
    if (!histBy.has(h.emp_id)) histBy.set(h.emp_id, []);
    histBy.get(h.emp_id).push({ aksi: h.aksi, tgl: h.tgl, ket: h.ket, file: h.file, byUser: h.by_user });
  }
  for (const h of jh) {
    if (!jhBy.has(h.emp_id)) jhBy.set(h.emp_id, []);
    jhBy.get(h.emp_id).push({ thn: h.thn, jabatan: h.jabatan, unit: h.unit, aksi: h.aksi });
  }
  return rows.map((r) => empToUI(r, histBy.get(r.id) || [], jhBy.get(r.id) || []));
}

export function employeesRoutes(pool) {
  const app = new Hono();

  // Daftar karyawan — scope PII: master/kadiv semua, karyawan hanya dirinya.
  app.get("/api/employees", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (user.role === "karyawan") {
      if (!user.empId) return c.json([]);
      const rows = (await pool.query("SELECT * FROM employees WHERE id=$1", [String(user.empId)])).rows;
      return c.json(await hydrateUsers(pool, rows));
    }
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && !perms.has("employees.view")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const res = await pool.query("SELECT * FROM employees ORDER BY CASE WHEN id ~ '^[0-9]+$' THEN lpad(id,12,'0') ELSE id END");
    return c.json(await hydrateUsers(pool, res.rows));
  });

  // Buat karyawan baru.
  app.post("/api/employees", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && !perms.has("employees.edit")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const col = pickCols(body);
    const nama = String(body.nama || "").trim();
    if (!nama) return c.json({ error: "Nama wajib diisi." }, 400);
    if (!col.unit) return c.json({ error: "Unit / cabang wajib diisi." }, 400);
    const id = await nextEmpId(pool);
    col.id = id;
    col.nama = nama;
    col.created_at = now();
    col.updated_at = now();
    await pool.query(
      `INSERT INTO employees (${Object.keys(col).join(",")}) VALUES (${Object.keys(col).map((_, i) => "$" + (i + 1)).join(",")})`,
      Object.values(col)
    );
    await logActivity(pool, { aksi: "Karyawan Baru Ditambahkan", type: "create", nama, empId: id, unit: col.unit, ket: `oleh ${user.nama}`, by: user.nama });
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "create_employee", rincian: id });
    return c.json(await hydrateOne(pool, id));
  });

  app.patch("/api/employees/:id", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && !perms.has("employees.edit")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const col = pickCols(body);
    if (!Object.keys(col).length) return c.json({ error: "Tidak ada field." }, 400);
    col.updated_at = now();
    const sets = Object.keys(col).map((k, i) => `${k}=$${i + 1}`).join(", ");
    const res = await pool.query(`UPDATE employees SET ${sets} WHERE id=$${Object.keys(col).length + 1} RETURNING id`, [...Object.values(col), id]);
    if (!res.rowCount) return c.json({ error: "Karyawan tidak ditemukan." }, 404);
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "edit_employee", rincian: id });
    return c.json(await hydrateOne(pool, id));
  });

  // Generate NIP (AW.cabang.tahun.urut) — jika belum ada.
  app.post("/api/employees/:id/nip", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && !perms.has("employees.edit")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const id = c.req.param("id");
    const res = await pool.query("SELECT * FROM employees WHERE id=$1", [id]);
    if (!res.rowCount) return c.json({ error: "Karyawan tidak ditemukan." }, 404);
    if (!res.rows[0].nip) {
      const nip = await genNIP(pool, res.rows[0]);
      await pool.query("UPDATE employees SET nip=$2, updated_at=$3 WHERE id=$1", [id, nip, now()]);
    }
    return c.json(await hydrateOne(pool, id));
  });

  // Aksi SDM: mutasi/promosi/demosi/nonaktif/aktif/resign/ptdh.
  app.post("/api/employees/:id/action", requireAuth(pool), async (c) => {
    const user = c.get("user");
    const perms = c.get("perms");
    if (user.role !== "master" && user.role !== "kadiv_hr" && !perms.has("employees.edit")) {
      return c.json({ error: "Akses ditolak." }, 403);
    }
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const type = String(body.type || "");
    const tgl = String(body.tgl || new Date().toISOString().slice(0, 10));
    let ket = String(body.reason || "").trim();
    const file = String(body.file || "");
    const res = await pool.query("SELECT * FROM employees WHERE id=$1", [id]);
    if (!res.rowCount) return c.json({ error: "Karyawan tidak ditemukan." }, 404);
    const e = res.rows[0];
    const thn = (tgl.match(/^(\d{4})/) || [])[1] || String(new Date().getFullYear());

    const ACTIONS = {
      mutasi: { label: "Mutasi Antar Cabang", needUnit: true, sets: { status_kerja: "Aktif" } },
      promosi: { label: "Promosi Jabatan", needJab: true, sets: { status_kerja: "Aktif" } },
      demosi: { label: "Demosi Jabatan", needJab: true, sets: { status_kerja: "Aktif" } },
      nonaktif: { label: "Nonaktifkan", sets: { status_kerja: "Nonaktif" } },
      aktif: { label: "Aktifkan Kembali", sets: { status_kerja: "Aktif" } },
      resign: { label: "Resign", sets: { status_kerja: "Resign" } },
      ptdh: { label: "PTDH (Pemberhentian)", sets: { status_kerja: "PTDH" } },
    };
    const a = ACTIONS[type];
    if (!a) return c.json({ error: "Jenis aksi tidak dikenal." }, 400);

    const updates = { ...a.sets, updated_at: now() };
    if (a.needUnit) {
      const nu = String(body.unit || "").trim();
      if (!nu) return c.json({ error: "Pilih cabang tujuan." }, 400);
      ket = (ket ? ket + " · " : "") + `Mutasi ${e.unit || "—"} → ${nu}`;
      updates.unit = nu;
      updates.cabang = nu;
    }
    if (a.needJab) {
      const nj = String(body.jab || "").trim();
      if (!nj) return c.json({ error: "Isi jabatan baru." }, 400);
      ket = (ket ? ket + " · " : "") + `${type === "demosi" ? "Demosi: " : "Promosi: "}${e.jabatan || "—"} → ${nj}`;
      updates.jabatan = nj;
      updates.posisi = nj;
    }
    await pool.query(
      `UPDATE employees SET ${Object.keys(updates).map((k, i) => `${k}=$${i + 1}`).join(", ")} WHERE id=$${Object.keys(updates).length + 1}`,
      [...Object.values(updates), id]
    );
    await pool.query(
      "INSERT INTO employee_history (emp_id, aksi, tgl, ket, file, by_user) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, a.label, tgl, ket, file, user.nama]
    );
    if (type !== "nonaktif" && type !== "aktif" && type !== "resign" && type !== "ptdh") {
      await pool.query("INSERT INTO job_history (emp_id, thn, jabatan, unit, aksi) VALUES ($1,$2,$3,$4,$5)",
        [id, thn, updates.jabatan || e.jabatan, updates.unit || e.unit, a.label]);
    }
    await logActivity(pool, {
      ts: Date.now(), tgl, aksi: a.label, type, col: a.col || null, nama: e.nama, empId: id, unit: e.unit || e.cabang, ket, by: user.nama,
    });
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "action:" + type, rincian: id + " " + ket });
    return c.json(await hydrateOne(pool, id));
  });

  return app;
}

function pickCols(body) {
  const col = {};
  for (const [camel, snake] of Object.entries(COL)) {
    if (Object.prototype.hasOwnProperty.call(body, camel)) {
      const v = body[camel];
      col[snake] = typeof v === "string" ? v.trim() : v;
    }
  }
  for (const m of MONEY) {
    if (Object.prototype.hasOwnProperty.call(body, m)) {
      const n = parseInt(String(body[m]).replace(/[^\d]/g, ""), 10);
      col[MONEY_COL[m]] = Number.isNaN(n) ? 0 : n;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "statusKerja")) col.status_kerja = String(body.statusKerja || "Aktif");
  return col;
}

async function nextEmpId(pool) {
  const res = await pool.query("SELECT COALESCE(MAX(CASE WHEN id ~ '^[0-9]+$' THEN id::bigint ELSE 0 END),0)+1 AS n FROM employees");
  return String(res.rows[0].n);
}
