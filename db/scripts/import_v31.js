// Import SDM v3.1 — baca data.js (EMP_DATA) + recruit.js (RECRUIT_DATA) → PostgreSQL.
// Jalankan dari api/:  node db/scripts/import_v31.js [--reset]
//   --reset  : TRUNCATE employees + recruit_candidates dulu (ba ika mau impor ulang).
// Sumber data: folder "5. updatev3.1_SDM-ALWILDAN-deploy" (bisa override:
//   SDM_DATA_DIR=/path/ke/folder   atau  SDM_EMP=/path/data.js SDM_RECRUIT=/path/recruit.js)
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "../../src/db.js";

const url = process.env.DATABASE_URL;
if (!url) { console.error("FATAL: DATABASE_URL wajib diisi."); process.exit(1); }

const dir = process.env.SDM_DATA_DIR || fileURLToPath(new URL("../../5. updatev3.1_SDM-ALWILDAN-deploy", import.meta.url));
const empPath = process.env.SDM_EMP || resolve(dir, "data.js");
const recPath = process.env.SDM_RECRUIT || resolve(dir, "recruit.js");
const reset = process.argv.includes("--reset");

const int = (v) => { const t = String(v ?? "").replace(/[^\d]/g, ""); return t ? parseInt(t, 10) : 0; };
const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

function parseJsVar(text, name) {
  const re = new RegExp(`window\\.${name}\\s*=`, "s");
  const m = text.match(re);
  if (!m) throw new Error(`${name} tidak ditemukan.`);
  const openIdx = text.indexOf("[", m.index);
  const closeIdx = text.lastIndexOf("]");
  if (openIdx < 0 || closeIdx <= openIdx) throw new Error(`${name}: kurung array tidak valid.`);
  return JSON.parse(text.slice(openIdx, closeIdx + 1));
}

async function insertEmployees(pool, rows) {
  if (!rows.length) return 0;
  const cols = [
    "id", "nama", "jabatan", "gender", "gelar", "mapel", "mapel_guru", "thn_aktif", "tgl_aktif",
    "thp", "thp_kotor", "thp_bersih", "thr", "tk", "gaji_ajuan", "unit", "cabang", "posisi",
    "nik_ktp", "alamat", "tmp_lahir", "tgl_lahir", "usia", "status", "transport",
    "tinggi", "berat", "email", "no_hp", "s1_univ", "s1_prodi", "s1_ipk", "s2_univ", "s2_prodi",
    "s3_univ", "rek_bsi", "rek_lain", "nama_bank", "link_kesehatan", "link_cv", "link_pegawai",
    "photo", "status_kerja", "created_at", "updated_at",
  ];
  const placeholders = cols.map((_, i) => "$" + (i + 1)).join(",");
  const now = Date.now();
  const batch = 400;
  let n = 0;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    const values = [];
    for (const e of chunk) {
      values.push(
        str(e.id), str(e.nama), str(e.jabatan), str(e.gender), str(e.gelar), str(e.mapel),
        str(e.mapelGuru), str(e.thnAktif), str(e.tglAktif), int(e.thp), int(e.thpKotor), int(e.thpBersih),
        int(e.thr), int(e.tk), int(e.gajiAjuan), str(e.unit), str(e.cabang), str(e.posisi),
        str(e.nikKtp), str(e.alamat), str(e.tmpLahir), str(e.tglLahir), str(e.usia), str(e.status),
        str(e.transport), str(e.tinggi), str(e.berat), str(e.email), str(e.noHp),
        str(e.s1univ), str(e.s1prodi), str(e.s1ipk), str(e.s2univ), str(e.s2prodi),
        str(e.s3univ), str(e.rekBSI), str(e.rekLain), str(e.namaBank), str(e.linkKesehatan),
        str(e.linkCV), str(e.linkPegawai), str(e.photo), "Aktif", now, now
      );
    }
    const sql = `INSERT INTO employees (${cols.join(",")}) VALUES ${chunk.map((_, j) => `(${placeholders.replace(/\$(\d+)/g, (_, k) => "$" + (j * cols.length + +k))})`).join(",")}`;
    await pool.query(sql, values);
    n += chunk.length;
    console.log(`  karyawan ${n}/${rows.length}`);
  }
  return n;
}

async function insertRecruit(pool, rows) {
  if (!rows.length) return 0;
  const cols = [
    "id", "no", "nama", "email", "wa", "cv", "kesehatan", "gender", "status", "pantuhir",
    "unit", "cabang_raw", "mapel", "s1", "s2", "pengajuan", "review", "thp_kotor",
    "thp_bersih", "tk", "thr", "konfirmasi", "nego", "berita_acara", "created_at",
  ];
  const placeholders = cols.map((_, i) => "$" + (i + 1)).join(",");
  const conflictSet = cols.filter((c) => c !== "id").map((c) => `${c}=EXCLUDED.${c}`).join(", ");
  const now = Date.now();
  const batch = 400;
  let n = 0;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    const values = [];
    for (const c of chunk) {
      values.push(
        str(c.id), str(c.no), str(c.nama), str(c.email), str(c.wa), str(c.cv), str(c.kesehatan),
        str(c.gender), str(c.status), str(c.pantuhir), str(c.unit), str(c.cabangRaw), str(c.mapel),
        str(c.s1), str(c.s2), int(c.pengajuan), str(c.review), int(c.thpKotor),
        int(c.thpBersih), int(c.tk), int(c.thr), str(c.konfirmasi), str(c.nego), str(c.beritaAcara), now
      );
    }
    // upsert: kandidat baru ditambahkan, data existing diperbarui (id acuan)
    const sql = `INSERT INTO recruit_candidates (${cols.join(",")}) VALUES ${chunk.map((_, j) => `(${placeholders.replace(/\$(\d+)/g, (_, k) => "$" + (j * cols.length + +k))})`).join(",")} ON CONFLICT (id) DO UPDATE SET ${conflictSet}`;
    await pool.query(sql, values);
    n += chunk.length;
    console.log(`  kandidat ${n}/${rows.length}`);
  }
  return n;
}

const pool = createPool(url);
try {
  if (reset) {
    await pool.query("TRUNCATE employees CASCADE");
    await pool.query("TRUNCATE recruit_candidates CASCADE");
    console.log("Reset: tabel kosong.");
  }
  const empHave = (await pool.query("SELECT count(*)::int AS n FROM employees")).rows[0].n;
  if (empHave > 0) {
    console.log(`employees sudah terisi (${empHave}). Gunakan --reset untuk impor ulang.`);
  } else {
    const text = await readFile(empPath, "utf8");
    const empRows = parseJsVar(text, "EMP_DATA").filter((e) => e && e.nama);
    console.log(`Memproses ${empRows.length} karyawan dari ${empPath}`);
    await insertEmployees(pool, empRows);
  }

  // kandidat: UPSERT selalu (data recruit.js diperbarui; id acuan tetap)
  const text = await readFile(recPath, "utf8");
  const recRows = parseJsVar(text, "RECRUIT_DATA").filter((r) => r && r.nama);
  console.log(`Memproses ${recRows.length} kandidat dari ${recPath} (upsert)`);
  await insertRecruit(pool, recRows);

  const summary = await pool.query(
    "SELECT (SELECT count(*) FROM employees) e, (SELECT count(*) FROM recruit_candidates) r, (SELECT count(*) FROM users) u"
  );
  console.log("Ringkasan:", summary.rows[0]);
  console.log("Impor selesai.");
} catch (e) {
  console.error("Impor gagal:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
