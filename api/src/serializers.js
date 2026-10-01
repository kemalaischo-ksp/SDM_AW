// Serializer: baris DB → objek yang dikonsumsi UI sdm-v31 (camelCase) dan
// helper NIP / unitCode (sumber tunggal, cermin logika genNIP di UI).

export const unitCode = (u) => {
  const m = String(u || "").match(/(\d+)/);
  if (m) return m[1].padStart(2, "0");
  const t = String(u || "").toUpperCase();
  if (t.includes("HOLDING")) return "HO";
  if (t.includes("LINTAS")) return "LX";
  if (t.includes("YAYASAN")) return "YY";
  return "XX";
};

export async function genNIP(pool, emp) {
  const cab = unitCode(emp.unit);
  const thn = /^\d{4}$/.test(emp.thn_aktif || "") ? emp.thn_aktif : String(new Date().getFullYear());
  const prefix = `AW.${cab}.${thn}.`;
  const res = await pool.query(
    "SELECT nip FROM employees WHERE nip LIKE $1 ORDER BY nip DESC LIMIT 1",
    [prefix + "%"]
  );
  let seq = 1;
  if (res.rowCount) {
    const last = res.rows[0].nip.split(".").pop();
    const n = parseInt(last, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  // pastikan tak bentrok
  for (;; seq++) {
    const candidate = prefix + String(seq).padStart(4, "0");
    const chk = await pool.query("SELECT 1 FROM employees WHERE nip=$1", [candidate]);
    if (!chk.rowCount) return candidate;
  }
}

const int = (v) => (v === null || v === undefined || v === "" ? 0 : parseInt(v, 10) || 0);

export function empToUI(row, riwayat = [], riwayatJabatan = []) {
  return {
    id: row.id,
    nip: row.nip || "",
    nama: row.nama,
    jabatan: row.jabatan || "",
    gender: row.gender || "",
    gelar: row.gelar || "",
    mapel: row.mapel || "",
    mapelGuru: row.mapel_guru || "",
    thnAktif: row.thn_aktif || "",
    tglAktif: row.tgl_aktif || "",
    thp: int(row.thp),
    thpKotor: int(row.thp_kotor),
    thpBersih: int(row.thp_bersih),
    thr: int(row.thr),
    tk: int(row.tk),
    gajiAjuan: int(row.gaji_ajuan),
    unit: row.unit || "",
    cabang: row.cabang || "",
    posisi: row.posisi || "",
    nikKtp: row.nik_ktp || "",
    alamat: row.alamat || "",
    tmpLahir: row.tmp_lahir || "",
    tglLahir: row.tgl_lahir || "",
    usia: row.usia || "",
    status: row.status || "",
    transport: row.transport || "",
    tinggi: row.tinggi || "",
    berat: row.berat || "",
    email: row.email || "",
    noHp: row.no_hp || "",
    s1univ: row.s1_univ || "",
    s1prodi: row.s1_prodi || "",
    s1ipk: row.s1_ipk || "",
    s2univ: row.s2_univ || "",
    s2prodi: row.s2_prodi || "",
    s3univ: row.s3_univ || "",
    rekBSI: row.rek_bsi || "",
    rekLain: row.rek_lain || "",
    namaBank: row.nama_bank || "",
    linkKesehatan: row.link_kesehatan || "",
    linkCV: row.link_cv || "",
    linkPegawai: row.link_pegawai || "",
    photo: row.photo || "",
    golDarah: row.gol_darah || "",
    kontakDarurat: row.kontak_darurat || "",
    alergi: row.alergi || "",
    riwayatSakit: row.riwayat_sakit || "",
    statusKerja: row.status_kerja || "Aktif",
    riwayat,
    riwayatJabatan,
    _local: false,
  };
}

export function candToUI(r) {
  return {
    id: r.id,
    no: r.no || "",
    nama: r.nama,
    email: r.email || "",
    wa: r.wa || "",
    cv: r.cv || "",
    kesehatan: r.kesehatan || "",
    gender: r.gender || "",
    status: r.status || "",
    pantuhir: r.pantuhir || "",
    unit: r.unit || "",
    cabangRaw: r.cabang_raw || "",
    mapel: r.mapel || "",
    s1: r.s1 || "",
    s2: r.s2 || "",
    pengajuan: int(r.pengajuan),
    review: r.review || "",
    thpKotor: int(r.thp_kotor),
    thpSet: int(r.thp_set),
    konfirmasi: r.konfirmasi || "",
    thpBersih: int(r.thp_bersih),
    tk: int(r.tk),
    thr: int(r.thr),
    nego: r.nego || "",
    beritaAcara: r.berita_acara || "",
    interview: r.interview || "",
    interviewNote: r.interview_note || "",
    interviewTgl: r.interview_tgl || "",
    interviewBy: r.interview_by || "",
    interviewLog: Array.isArray(r.interview_log) ? r.interview_log : (typeof r.interview_log === "string" && r.interview_log ? JSON.parse(r.interview_log) : []),
    pantuhirNote: r.pantuhir_note || "",
    estimasi: r.estimasi || "",
    estimasiAktif: r.estimasi_aktif || "",
    estimasiNote: r.estimasi_note || "",
    aktivasi: r.aktivasi || "",
    tglAjuan: r.tgl_ajuan || "",
    _up: false,
  };
}

export function reqToUI(r) {
  return {
    id: r.id,
    kind: r.kind,
    empId: r.emp_id || "",
    nama: r.nama || "",
    unit: r.unit || "",
    judul: r.judul || "",
    cat: r.cat || "",
    prio: r.prio || "",
    desc: r.body || "",
    strata: r.strata || "",
    lampiran: r.lampiran || "",
    mulai: r.mulai || "",
    selesai: r.selesai || "",
    alasan: r.alasan || "",
    changes: r.changes || null,
    tgl: r.tgl || "",
    waktu: r.waktu || "",
    status: r.status || "Baru",
  };
}

export function acctToUI(r) {
  return {
    u: r.username,
    role: r.role,
    nama: r.nama,
    unit: r.unit || "",
    empId: r.emp_id || "",
    nip: r.nip || "",
    mustChange: !!r.must_change,
    aktif: !!r.aktif,
  };
}
