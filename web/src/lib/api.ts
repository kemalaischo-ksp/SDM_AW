/* Lapisan API HR 3.0.
 * Mock 2 sampel AW3 hanya untuk DEV tanpa backend (npm run dev tanpa VITE_API_URL).
 * Build produksi tanpa VITE_API_URL = fail-closed (error jelas, bukan demo diam-diam). */

export interface Employee {
  id: number;
  nip: string;
  nama_gelar: string;
  email: string;
  no_hp: string;
  jabatan?: string | null;
  gender?: "Pria" | "Perempuan" | null;
  posisi_diajukan: string;
  mapel: string | null;
  unit: string;
  gaji_diajukan: number;
  alamat?: string | null;
  tempat_lahir?: string | null;
  tgl_lahir?: string | null;
  status_kawin?: string | null;
  transport?: string | null;
  tinggi_cm?: number | null;
  berat_kg?: number | null;
  bank_utama?: string | null;
  norek_utama?: string | null;
  bank_lain?: string | null;
  norek_lain?: string | null;
  kesehatan_url?: string | null;
  thp_kotor: number;
  konfirmasi: string | null;
  thp_bersih: number;
  total_tk_thr: number;
  tk: number;
  thr_bulan: number;
  tmt_aktif: string | null;
  mode_thp: string | null;
  status_aktivasi: "draft" | "diajukan_finance" | "diverifikasi_doni" | "aktif" | "ditolak";
  cv_url: string | null;
  status_kerja?: string | null;
  tgl_masuk?: string | null;
  atasan_id?: number | null;
  atasan_nama?: string | null;
  cabang?: string | null;
  punya_akun?: boolean | number | null;
  foto_url?: string | null;
  kontak_darurat?: string | null;
}

export interface Pendidikan {
  id: number;
  employee_id: number;
  jenjang: "SMA" | "D1" | "D2" | "D3" | "D4" | "S1" | "S2" | "S3";
  perguruan_tinggi: string | null;
  prodi: string | null;
  ipk: number | null;
}

export interface Pengalaman {
  id: number;
  employee_id: number;
  urutan: number;
  deskripsi: string | null;
  salary: number | null;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  unit_id: number | null;
  permissions: string[];
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  unit_id: number | null;
  permissions: string[];
  aktif: number;
}

export interface PermItem {
  key: string;
  label: string;
  bawaan: Record<string, string[]>;
}

export interface Profil {
  id: number; nip: string; nama_gelar: string;
  email: string | null; no_hp: string | null; alamat: string | null;
  tempat_lahir: string | null; tgl_lahir: string | null; status_kawin: string | null;
  posisi_diajukan: string | null; jabatan: string | null; mapel: string | null;
  unit: string | null; cabang: string | null; gaji_diajukan: number | null;
  bank_utama: string | null; norek_utama: string | null; bank_lain: string | null; norek_lain: string | null;
  thp_bersih: number | null; tmt_aktif: string | null; mode_thp: string | null;
  status_aktivasi: string; status_kerja: string | null; tgl_masuk: string | null;
  atasan_id: number | null; atasan_nama: string | null;
  foto_url: string | null; kontak_darurat: string | null;
}

export interface PresensiRow {
  tanggal: string;
  status: string | null;
  check_in: string | null;
  check_out: string | null;
  keterangan: string | null;
  lat_masuk?: number | null;
  lng_masuk?: number | null;
  lat_pulang?: number | null;
  lng_pulang?: number | null;
  foto_masuk_ada?: boolean | null;
  foto_pulang_ada?: boolean | null;
}

export interface PresensiSaya {
  tanggal: string;
  hari_ini: PresensiRow | null;
  riwayat: PresensiRow[];
}

export type JenisPengajuan = "lembur" | "reimbursement" | "surat" | "perubahan-data" | "koreksi-presensi";

export interface PengajuanRow {
  id: number;
  employee_id: number;
  nip?: string;
  nama_gelar?: string;
  tanggal: string;
  status: string;
  keterangan?: string | null;
  jam_mulai?: string | null;
  jam_selesai?: string | null;
  kategori?: string | null;
  nominal?: number | null;
  deskripsi?: string | null;
  bukti_url?: string | null;
  jenis?: string | null;
  keperluan?: string | null;
  nomor?: string | null;
  kolom?: string | null;
  nilai_lama?: string | null;
  nilai_baru?: string | null;
  waktu_baru?: string | null;
  alasan?: string | null;
}

export interface RekapRow {
  employee_id: number; nip: string; nama_gelar: string;
  hadir: number; terlambat: number; pulang_cepat: number;
  izin: number; sakit: number; cuti: number; alpa: number; dinas: number;
  tanpa_keterangan: number; tidak_hadir: number; lembur_kali: number; lembur_jam: number;
}

export interface RekapPresensi {
  bulan: string;
  dari?: string; sampai?: string;
  batas: { masuk: string; toleransi: string; pulang: string };
  hari_kerja: number;
  ringkasan: RekapRow[];
  detail: { employee_id: number; tanggal: string; status: string; check_in: string | null; check_out: string | null }[];
}

export interface CutiSaldo { employee_id: number; tahun: number; jatah: number; terpakai: number; sisa: number }

export interface Statistik {
  total: { total: number; aktif: number; pending: number; pria: number; perempuan: number; tanpa_gender: number; cabang: number };
  per_cabang: { kode: string | null; nama: string; total: number; aktif: number; pending: number; pria: number; perempuan: number; tanpa_gender: number }[];
  per_divisi: { unit: string; total: number; aktif: number; pending: number; pria: number; perempuan: number; tanpa_gender: number }[];
  per_pendidikan: { S3: number; S2: number; S1: number; belum: number };
  gender: { pria: number; perempuan: number; tanpa: number };
}

export interface AkunBaru { ok: boolean; id: string; email: string; role: string; sandi_sementara?: string }

export interface RiwayatJabatan {
  id: number; employee_id: number; tanggal: string;
  jabatan_lama: string | null; jabatan_baru: string | null;
  gaji_lama: number | null; gaji_baru: number | null; keterangan: string | null;
}

export interface Penilaian {
  id: number; employee_id: number; periode: string; target: string | null;
  skor: number | null; catatan: string | null; rencana_kembang: string | null;
}

export interface NotifItem { id: number; judul: string; isi: string | null; dibaca: number; waktu: string }

export interface Pengumuman { id: number; judul: string; isi: string; waktu: string; aktif?: number }

export interface OnboardingItem { id: number; employee_id: number; item: string; selesai: number; selesai_at: string | null }

export interface Dokumen { id: number; employee_id: number; jenis: string; judul: string; file_key: string | null; kedaluwarsa: string | null }

export const bisa = (me: SessionUser | null, key: string) =>
  !!me && (me.role === "master_admin" || me.permissions.includes(key));

const RAW = import.meta.env.VITE_API_URL as string | undefined;
// Kosong = same-origin (produksi: Hono serve frontend + API satu domain).
// Mock 2 sampel hanya bila DEV dan variabel tak diset sama sekali.
const BASE = RAW ?? "";
const ALLOW_MOCK = import.meta.env.DEV && RAW === undefined;

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 1,
    nip: "260001",
    nama_gelar: "Muhammad Muthy Abdullah, S.Pd.",
    email: "muthymuhammad@gmail.com",
    no_hp: "6285886593150",
    posisi_diajukan: "Musyrif (Non-ITBA)",
    mapel: null,
    unit: "SMP-SMA",
    gaji_diajukan: 5000000,
    thp_kotor: 4500000,
    konfirmasi: "Aktif 31 August 2026 (THP BERSIH FULL)",
    thp_bersih: 4115200,
    total_tk_thr: 384800,
    tk: 184800,
    thr_bulan: 200000,
    tmt_aktif: "2026-08-31",
    mode_thp: "FULL",
    status_aktivasi: "aktif",
    cv_url: "https://drive.google.com/file/d/1pJUj7YhgPPo6RPPnnM-QhCqh-VimOHSY/view?usp=drive_link",
  },
  {
    id: 2,
    nip: "260002",
    nama_gelar: "Faqih Ahmad Rizki, B.A.",
    email: "faqih240297@gmail.com",
    no_hp: "6285785027408",
    posisi_diajukan: "Guru Mata Pelajaran",
    mapel: "Diniyyah",
    unit: "SMP-SMA",
    gaji_diajukan: 10000000,
    thp_kotor: 6384800,
    konfirmasi: "Akan dipertimbangkan",
    thp_bersih: 6000000,
    total_tk_thr: 384800,
    tk: 184800,
    thr_bulan: 200000,
    tmt_aktif: null,
    mode_thp: null,
    status_aktivasi: "diajukan_finance",
    cv_url: "https://drive.google.com/file/d/135b5FLwbaAv8cuc5DpBTjgsY769Lm337/view?usp=sharing",
  },
];

/** Presensi mandiri mock (mode demo tanpa backend) — tersimpan di memori sesi. */
let MOCK_PRESENSI: PresensiRow | null = null;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sesiBerakhir() {
  localStorage.removeItem("hr_token");
  window.dispatchEvent(new CustomEvent("hr:toast", { detail: "Sesi berakhir, silakan masuk lagi." }));
  if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // cookie sesi HttpOnly
    ...init,
  });
  if (res.status === 401) {
    sesiBerakhir();
    throw new ApiError(401, "Sesi berakhir");
  }
  if (!res.ok) {
    let msg = `API ${res.status}`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {
      msg = `${msg}: ${await res.text()}`;
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  useMock: ALLOW_MOCK,
  async login(email: string, password: string): Promise<SessionUser> {
    if (ALLOW_MOCK) {
      localStorage.setItem("hr_token", "mock-token");
      return { id: "mock", name: "HR AW3", email, role: "hr_cabang", unit_id: null, permissions: ["karyawan.lihat", "aktivasi.ajukan", "payroll.lihat", "slip.lihat", "presensi.mandiri"] };
    }
    const u = await req<SessionUser>("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
    localStorage.setItem("hr_token", "1");
    return u;
  },
  async logout(): Promise<void> {
    localStorage.removeItem("hr_token");
    if (ALLOW_MOCK) return;
    await req("/api/logout", { method: "POST" });
  },
  async forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
    const msg =
      "Jika email terdaftar, tautan reset sudah dikirim. Hubungi HR holding bila tidak menerima email dalam 10 menit.";
    if (ALLOW_MOCK) return { ok: true, message: msg };
    try {
      await req<{ ok: boolean }>("/api/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      return { ok: true, message: msg };
    } catch (e) {
      // Toleransi bila backend lama/404: tetap beri instruksi aman tanpa bocorkan status akun.
      if (e instanceof ApiError && e.status === 404) return { ok: true, message: msg };
      throw e;
    }
  },
  async resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return { ok: true };
    return req<{ ok: boolean }>("/api/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },
  me(): Promise<SessionUser> {
    if (ALLOW_MOCK)
      return Promise.resolve({ id: "mock", name: "HR AW3", email: "hr.aw3@alwildan.sch.id", role: "hr_cabang", unit_id: null, permissions: ["karyawan.lihat", "aktivasi.ajukan", "payroll.lihat", "slip.lihat", "presensi.mandiri"] });
    return req<SessionUser>("/api/me");
  },
  employees(): Promise<Employee[]> {
    if (ALLOW_MOCK) return Promise.resolve(MOCK_EMPLOYEES.map((e) => ({ ...e })));
    return req("/api/employees");
  },
  createEmployee(body: {
    nama_gelar: string; unit_id: number; email?: string; no_hp?: string;
    posisi_diajukan?: string; mapel?: string; nip?: string;
    gender?: string;
    atasan_id?: number | null; cabang_lainnya?: string;
    nik_ktp?: string; alamat?: string; tempat_lahir?: string; tgl_lahir?: string;
    status_kawin?: string; tinggi_cm?: number | null; berat_kg?: number | null;
    transport?: string; gaji_diajukan?: number | null;
    bank_utama?: string; norek_utama?: string; bank_lain?: string; norek_lain?: string;
    cv_url?: string; arsip_nama?: string;
    pendidikan?: { perguruan_tinggi?: string; prodi?: string; ipk?: number | null };
    pengalaman?: { deskripsi?: string; salary?: number | null }[];
  }): Promise<{ ok: boolean; id: number; nip: string }> {
    if (ALLOW_MOCK) {
      const tahun = String(new Date().getFullYear()).slice(2);
      const nums = MOCK_EMPLOYEES.map((e) => Number(e.nip)).filter((n) => String(n).startsWith(tahun));
      const nip = body.nip?.trim() || `${tahun}${String((nums.length ? Math.max(...nums) % 10000 : 0) + 1).padStart(4, "0")}`;
      const id = Math.max(...MOCK_EMPLOYEES.map((e) => e.id)) + 1;
      MOCK_EMPLOYEES.push({
        id, nip, nama_gelar: body.nama_gelar.trim(), email: body.email?.trim() || `${nip}@alwildan.sch.id`,
        no_hp: body.no_hp?.trim() || "", posisi_diajukan: body.posisi_diajukan?.trim() || "Staff",
        mapel: body.mapel?.trim() || null, unit: "SMP-SMA", gaji_diajukan: 0,
        thp_kotor: 0, konfirmasi: null, thp_bersih: 0, total_tk_thr: 0, tk: 0, thr_bulan: 0,
        tmt_aktif: null, mode_thp: null, status_aktivasi: "draft", cv_url: null,
      });
      return Promise.resolve({ ok: true, id, nip });
    }
    return req("/api/employees", { method: "POST", body: JSON.stringify(body) });
  },
  employee(id: number): Promise<Employee> {
    if (ALLOW_MOCK) {
      const emp = MOCK_EMPLOYEES.find((e) => e.id === id);
      if (!emp) throw new Error("Tidak ditemukan");
      return Promise.resolve({ ...emp });
    }
    return req(`/api/employees/${id}`);
  },
  activate(id: number, body: Partial<Employee> & { catatan?: string }): Promise<Employee> {
    if (ALLOW_MOCK) {
      const emp = MOCK_EMPLOYEES.find((e) => e.id === id);
      if (!emp) throw new Error("Tidak ditemukan");
      Object.assign(emp, body);
      return Promise.resolve({ ...emp });
    }
    return req(`/api/employees/${id}/activate`, { method: "POST", body: JSON.stringify(body) });
  },
  /** Upload PDF template SDM → draft JSON (butuh backend + izin karyawan.tambah). */
  parseSDM(file: File): Promise<{
    ok: boolean; arsip_nama: string;
    data: Record<string, unknown>;
    confidence: Record<string, string>;
    warnings: string[]; ai_dipakai: boolean;
  }> {
    if (ALLOW_MOCK) return Promise.reject(new Error("Mode demo: parse PDF butuh backend."));
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/api/employees/parse`, { method: "POST", body: fd, credentials: "include" }).then(async (res) => {
      if (!res.ok) {
        let msg = `API ${res.status}`;
        try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* abaikan */ }
        throw new ApiError(res.status, msg);
      }
      return res.json();
    });
  },
  users(): Promise<ManagedUser[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req("/api/users");
  },
  audit(): Promise<{ id: number; user_id: string; aksi: string; tabel: string | null; record_id: number | null; nilai_lama: string | null; nilai_baru: string | null; ip: string | null; waktu: string }[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req("/api/audit");
  },
  permCatalog(): Promise<PermItem[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req("/api/permission-catalog");
  },
  createUser(body: { email: string; name: string; role: string; password: string; permissions: string[]; unit_id?: number | null }): Promise<{ ok: boolean; id: string }> {
    if (ALLOW_MOCK) throw new Error("Mode demo: kelola pengguna butuh backend.");
    return req("/api/users", { method: "POST", body: JSON.stringify(body) });
  },
  updateUser(id: string, body: Partial<ManagedUser> & { password?: string }): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) throw new Error("Mode demo: kelola pengguna butuh backend.");
    return req(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  units(): Promise<{ id: number; nama: string; kode: string; cabang: string | null; cabang_nama: string | null }[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req("/api/units");
  },
  absensi(tanggal: string): Promise<{ tanggal: string; rows: { employee_id: number; nip: string; nama_gelar: string; status: string | null; keterangan: string | null }[] }> {
    if (ALLOW_MOCK) return Promise.resolve({ tanggal, rows: MOCK_EMPLOYEES.map((e) => ({ employee_id: e.id, nip: e.nip, nama_gelar: e.nama_gelar, status: "hadir", keterangan: null })) });
    return req(`/api/absensi?tanggal=${tanggal}`);
  },
  catatAbsensi(body: { employee_id: number; tanggal: string; status: string; keterangan?: string }): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req("/api/absensi", { method: "POST", body: JSON.stringify(body) });
  },
  cuti(): Promise<{ id: number; employee_id: number; nip?: string; nama_gelar?: string; jenis: string; tgl_mulai: string; tgl_selesai: string; status: string; keterangan: string | null }[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req("/api/cuti");
  },
  ajukanCuti(body: { jenis: string; tgl_mulai: string; tgl_selesai: string; keterangan?: string }): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req("/api/cuti", { method: "POST", body: JSON.stringify(body) });
  },
  putusCuti(id: number, status: "disetujui" | "ditolak"): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req(`/api/cuti/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  },
  presensiSaya(): Promise<PresensiSaya> {
    if (ALLOW_MOCK) {
      const tgl = new Date().toISOString().slice(0, 10);
      return Promise.resolve({ tanggal: tgl, hari_ini: MOCK_PRESENSI, riwayat: MOCK_PRESENSI ? [{ ...MOCK_PRESENSI }] : [] });
    }
    return req("/api/presensi-saya");
  },
  presensiAksi(aksi: "masuk" | "pulang", extra?: { lat?: number; lng?: number; foto?: string }): Promise<{ ok: boolean; aksi: string; jarak_meter?: number | null }> {
    if (ALLOW_MOCK) {
      const tgl = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      if (aksi === "masuk") {
        if (MOCK_PRESENSI?.check_in) throw new Error("Sudah check-in hari ini");
        MOCK_PRESENSI = { tanggal: tgl, status: "hadir", check_in: now, check_out: null, keterangan: null };
      } else {
        if (!MOCK_PRESENSI?.check_in) throw new Error("Belum check-in hari ini");
        if (MOCK_PRESENSI.check_out) throw new Error("Sudah check-out hari ini");
        MOCK_PRESENSI.check_out = now;
      }
      return Promise.resolve({ ok: true, aksi });
    }
    return req("/api/presensi-saya", { method: "POST", body: JSON.stringify({ aksi, ...extra }) });
  },
  rekapPresensi(opts: { bulan?: string; dari?: string; sampai?: string }): Promise<RekapPresensi> {
    const bulan = opts.bulan ?? new Date().toISOString().slice(0, 7);
    if (ALLOW_MOCK) return Promise.resolve({ bulan, batas: { masuk: "07:00", toleransi: "15", pulang: "16:00" }, hari_kerja: 22, ringkasan: [], detail: [] });
    const q = opts.dari && opts.sampai ? `dari=${opts.dari}&sampai=${opts.sampai}` : `bulan=${opts.bulan ?? bulan}`;
    return req(`/api/rekap-presensi?${q}`);
  },
  cutiSaldo(tahun?: number): Promise<CutiSaldo | CutiSaldo[]> {
    if (ALLOW_MOCK) return Promise.resolve({ employee_id: 0, tahun: tahun ?? 2026, jatah: 12, terpakai: 0, sisa: 12 });
    return req(`/api/cuti-saldo${tahun ? `?tahun=${tahun}` : ""}`);
  },
  setJatahCuti(employee_id: number, tahun: number, jatah: number): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req(`/api/cuti-saldo/${employee_id}`, { method: "PUT", body: JSON.stringify({ tahun, jatah }) });
  },
  riwayatJabatan(employee_id?: number): Promise<RiwayatJabatan[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req(`/api/riwayat-jabatan${employee_id ? `?employee_id=${employee_id}` : ""}`);
  },
  pendidikan(employee_id?: number): Promise<Pendidikan[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req(`/api/pendidikan${employee_id ? `?employee_id=${employee_id}` : ""}`);
  },
  pengalaman(employee_id?: number): Promise<Pengalaman[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req(`/api/pengalaman${employee_id ? `?employee_id=${employee_id}` : ""}`);
  },
  tambahRiwayat(body: { employee_id: number; tanggal?: string; jabatan_baru?: string; gaji_baru?: number; keterangan?: string; terapkan?: boolean }): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req("/api/riwayat-jabatan", { method: "POST", body: JSON.stringify(body) });
  },
  updateDataKerja(id: number, body: { atasan_id?: number | null; tgl_masuk?: string | null; status_kerja?: string; foto_url?: string | null; kontak_darurat?: string | null; gender?: string | null }): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req(`/api/employees/${id}/data-kerja`, { method: "PATCH", body: JSON.stringify(body) });
  },
  statistik(): Promise<Statistik> {
    if (ALLOW_MOCK) return Promise.resolve({
      total: { total: 2, aktif: 1, pending: 1, pria: 1, perempuan: 0, tanpa_gender: 1, cabang: 1 },
      per_cabang: [{ kode: "AW3", nama: "Al-Wildan 3 BSD City", total: 2, aktif: 1, pending: 1, pria: 1, perempuan: 0, tanpa_gender: 1 }],
      per_divisi: [{ unit: "SMP-SMA", total: 2, aktif: 1, pending: 1, pria: 1, perempuan: 0, tanpa_gender: 1 }],
      per_pendidikan: { S3: 0, S2: 0, S1: 2, belum: 0 },
      gender: { pria: 1, perempuan: 0, tanpa: 1 },
    });
    return req("/api/statistik");
  },
  buatkanAkun(id: number, body: { email?: string; password?: string; role?: string }): Promise<AkunBaru> {
    if (ALLOW_MOCK) throw new Error("Mode demo: buatkan akun butuh backend.");
    return req(`/api/employees/${id}/buatkan-akun`, { method: "POST", body: JSON.stringify(body) });
  },
  hapusKaryawan(id: number): Promise<{ ok: boolean; nip: string }> {
    if (ALLOW_MOCK) throw new Error("Mode demo: hapus butuh backend.");
    return req(`/api/employees/${id}`, { method: "DELETE" });
  },
  bulkAkun(body: { role?: string; cabang?: string; password?: string }): Promise<{ ok: boolean; dibuat: { nip: string; nama: string; email: string; sandi: string }[]; dilewati: { nip: string; nama: string; alasan: string }[] }> {
    if (ALLOW_MOCK) throw new Error("Mode demo: bulk akun butuh backend.");
    return req("/api/employees/bulk-akun", { method: "POST", body: JSON.stringify(body) });
  },
  bulkReset(body: { cabang?: string }): Promise<{ ok: boolean; direset: { nip: string; nama: string; email: string; sandi: string }[] }> {
    if (ALLOW_MOCK) throw new Error("Mode demo: bulk reset butuh backend.");
    return req("/api/employees/bulk-reset", { method: "POST", body: JSON.stringify(body) });
  },
  pengajuan(jenis: JenisPengajuan, status?: string): Promise<PengajuanRow[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req(`/api/${jenis}${status ? `?status=${status}` : ""}`);
  },
  ajukanPengajuan(jenis: JenisPengajuan, body: Record<string, unknown>): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req(`/api/${jenis}`, { method: "POST", body: JSON.stringify(body) });
  },
  putusPengajuan(jenis: JenisPengajuan, id: number, status: "disetujui" | "ditolak", extra?: Record<string, unknown>): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req(`/api/${jenis}/${id}`, { method: "PATCH", body: JSON.stringify({ status, ...extra }) });
  },
  penilaian(employee_id?: number): Promise<Penilaian[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req(`/api/penilaian${employee_id ? `?employee_id=${employee_id}` : ""}`);
  },
  simpanPenilaian(body: { employee_id: number; periode: string; target?: string; skor?: number | null; catatan?: string; rencana_kembang?: string }): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req("/api/penilaian", { method: "POST", body: JSON.stringify(body) });
  },
  notifikasi(): Promise<{ belum_dibaca: number; items: NotifItem[] }> {
    if (ALLOW_MOCK) return Promise.resolve({ belum_dibaca: 0, items: [] });
    return req("/api/notifikasi");
  },
  bacaNotifikasi(id?: number): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req("/api/notifikasi/baca", { method: "POST", body: JSON.stringify(id ? { id } : { semua: true }) });
  },
  pengumuman(semua?: boolean): Promise<Pengumuman[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req(`/api/pengumuman${semua ? "?semua=1" : ""}`);
  },
  buatPengumuman(body: { judul: string; isi: string }): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req("/api/pengumuman", { method: "POST", body: JSON.stringify(body) });
  },
  ubahPengumuman(id: number, body: { judul?: string; isi?: string; aktif?: number }): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req(`/api/pengumuman/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  onboarding(employee_id?: number): Promise<OnboardingItem[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req(`/api/onboarding${employee_id ? `?employee_id=${employee_id}` : ""}`);
  },
  centangOnboarding(id: number, selesai: boolean): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req(`/api/onboarding/${id}`, { method: "PATCH", body: JSON.stringify({ selesai }) });
  },
  dokumen(employee_id?: number): Promise<Dokumen[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req(`/api/documents${employee_id ? `?employee_id=${employee_id}` : ""}`);
  },  tambahDokumen(body: { employee_id: number; jenis: string; judul: string; file_key?: string; kedaluwarsa?: string }): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req("/api/documents", { method: "POST", body: JSON.stringify(body) });
  },
  hapusDokumen(id: number): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req(`/api/documents/${id}`, { method: "DELETE" });
  },
  dokumenKedaluwarsa(): Promise<(Dokumen & { nip?: string; nama_gelar?: string })[]> {
    if (ALLOW_MOCK) return Promise.resolve([]);
    return req("/api/documents/kedaluwarsa");
  },
  profilSaya(): Promise<Profil> {
    if (ALLOW_MOCK)
      return Promise.resolve({
        id: 0, nip: "260002", nama_gelar: "Faqih Ahmad Rizki, B.A.",
        email: "faqih240297@gmail.com", no_hp: "6285785027408", alamat: "Tapos Depok",
        tempat_lahir: "Bekasi", tgl_lahir: "1997-02-24", status_kawin: "Menikah",
        posisi_diajukan: "Guru Mata Pelajaran", jabatan: null, mapel: "Diniyyah",
        unit: "SMP-SMA", cabang: "Al-Wildan 3 BSD City", gaji_diajukan: 10000000,
        bank_utama: "BSI", norek_utama: "4949145900", bank_lain: "BNI", norek_lain: "1362328679",
        thp_bersih: 6000000, tmt_aktif: null, mode_thp: null,
        status_aktivasi: "diajukan_finance", status_kerja: "aktif", tgl_masuk: null,
        atasan_id: null, atasan_nama: null, foto_url: null, kontak_darurat: null,
      });
    return req("/api/profil-saya");
  },
  pengaturan(): Promise<Record<string, string>> {
    if (ALLOW_MOCK) return Promise.resolve({ jam_masuk_normal: "07:00", jam_pulang_normal: "16:00", toleransi_telat_menit: "15", kantor_lat: "-6.2850", kantor_lng: "106.6419", radius_meter: "300", jatah_cuti_tahunan: "12" });
    return req("/api/pengaturan");
  },
  simpanPengaturan(nilai: Record<string, string>): Promise<{ ok: boolean }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true });
    return req("/api/pengaturan", { method: "PUT", body: JSON.stringify({ nilai }) });
  },
  undangUser(id: string, via: "email" | "wa", tujuan?: string): Promise<{ ok: boolean; via: string }> {
    if (ALLOW_MOCK) return Promise.resolve({ ok: true, via });
    return req(`/api/users/${id}/undang`, { method: "POST", body: JSON.stringify({ via, tujuan }) });
  },
  uploadArsip(file: File, employee_id?: number): Promise<{ ok: boolean; nama: string; url: string; ukuran: number }> {
    if (ALLOW_MOCK) return Promise.reject(new Error("Mode demo: unggah butuh backend."));
    const fd = new FormData();
    fd.append("file", file);
    if (employee_id) fd.append("employee_id", String(employee_id));
    return fetch(`${BASE}/api/upload`, { method: "POST", body: fd, credentials: "include" }).then(async (res) => {
      if (!res.ok) {
        let msg = `API ${res.status}`;
        try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* abaikan */ }
        throw new ApiError(res.status, msg);
      }
      return res.json();
    });
  },
  /** URL absolut file arsip (siap di-fetch dengan kredensial). */
  arsipPenuh(url: string): string {
    return url.startsWith("http") ? url : `${BASE}${url}`;
  },
  /** Buka file arsip di tab baru (lewat fetch agar cookie sesi terkirim). */
  async bukaArsip(url: string): Promise<void> {
    const res = await fetch(url.startsWith("http") ? url : `${BASE}${url}`, { credentials: "include" });
    if (!res.ok) throw new ApiError(res.status, "Gagal membuka file");
    const obj = URL.createObjectURL(await res.blob());
    window.open(obj, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(obj), 60000);
  },
};

/** Validasi balance THP (cermin CHECK constraint DB). */
export function cekBalance(e: {
  thp_kotor: number;
  thp_bersih: number;
  total_tk_thr: number;
  tk: number;
  thr_bulan: number;
}): string | null {
  if (e.thp_bersih !== e.thp_kotor - e.total_tk_thr)
    return `THP bersih harus = kotor − total (harusnya ${e.thp_kotor - e.total_tk_thr})`;
  if (e.total_tk_thr !== e.tk + e.thr_bulan)
    return `Total TK-THR harus = TK + THR/bulan (harusnya ${e.tk + e.thr_bulan})`;
  return null;
}
