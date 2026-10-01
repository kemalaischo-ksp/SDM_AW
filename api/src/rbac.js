// RBAC bersumber dari DB (role_perms + override user_perms) —
// dicek di SERVER di setiap endpoint, bukan hanya sembunyikan menu UI.
export const PERM_KEYS = [
  "dashboard", "analytics", "network",
  "employees.view", "employees.edit",
  "attendance", "leave.view", "leave.approve",
  "payroll", "ticketing.view", "ticketing.respond",
  "recruitment.view", "recruitment.edit", "recruitment.interview", "recruitment.approve",
  "apps.email", "apps.chat", "apps.calendar",
  "accounts",
];

export const PERM_CATALOG = [
  { key: "dashboard", label: "Dashboard HR", desc: "Ringkasan SDM, tren, heatmap, aktivitas" },
  { key: "analytics", label: "Analitik SDM", desc: "Grafik demografi, pendidikan, biaya per cabang" },
  { key: "network", label: "Jaringan SDM", desc: "Peta relasi Holding–Cabang–Karyawan" },
  { key: "employees.view", label: "Lihat Data Karyawan", desc: "Melihat seluruh data karyawan" },
  { key: "employees.edit", label: "Edit Data Karyawan", desc: "Menambah/mengubah data, aksi mutasi/promosi/status" },
  { key: "attendance", label: "Presensi", desc: "Monitoring & rekap kehadiran per cabang" },
  { key: "leave.view", label: "Lihat Cuti & Izin", desc: "Melihat pengajuan cuti/izin" },
  { key: "leave.approve", label: "Setujui Cuti & Izin", desc: "Menyetujui/menolak pengajuan" },
  { key: "payroll", label: "Slip Gaji / Payroll", desc: "Melihat & cetak slip, ringkasan payroll" },
  { key: "ticketing.view", label: "Lihat Ticketing", desc: "Melihat tiket helpdesk" },
  { key: "ticketing.respond", label: "Respon Ticketing", desc: "Memproses & menyelesaikan tiket" },
  { key: "recruitment.view", label: "Lihat Rekrutmen", desc: "Melihat proses rekrutmen & aktivasi" },
  { key: "recruitment.edit", label: "Edit Rekrutmen", desc: "Kelola kandidat, set gaji, ajukan aktivasi" },
  { key: "recruitment.interview", label: "Update Interview Akhir", desc: "Tetapkan hasil interview: Lanjut / Hold (nego) / Batal" },
  { key: "recruitment.approve", label: "Approve Aktivasi (Master)", desc: "Menyetujui aktivasi kandidat jadi karyawan" },
  { key: "apps.email", label: "Apps · Email (Gmail)", desc: "Inbox Gmail Holding & aktivasi pengajuan via email (khusus Admin Pusat)" },
  { key: "apps.chat", label: "Apps · Diskusi/Chat", desc: "Chat internal Admin ⇄ Kadiv HR ⇄ Staff HR" },
  { key: "apps.calendar", label: "Apps · Calendar", desc: "Kalender proses rekrutmen & kaldik AL-WILDAN" },
  { key: "accounts", label: "Manajemen Akun & Hak Akses", desc: "Buat akun, atur role & izin berlapis" },
];

export async function effPerms(pool, user) {
  // master selalu punya semua izin (mencegah kunci diri sendiri).
  if (user.role === "master") return new Set(PERM_KEYS);
  const res = await pool.query(
    `SELECT perm_key, allowed FROM user_perms WHERE user_id=$1`,
    [user.id]
  );
  const over = new Map(res.rows.map((r) => [r.perm_key, !!r.allowed]));
  const rp = await pool.query(`SELECT perm_key FROM role_perms WHERE role=$1`, [user.role]);
  const out = new Set();
  for (const r of rp.rows) {
    const o = over.get(r.perm_key);
    if (o === undefined) out.add(r.perm_key);
    else if (o) out.add(r.perm_key);
    // allowed=0 → tidak ditambahkan
  }
  for (const [k, v] of over) if (v && PERM_KEYS.includes(k)) out.add(k);
  return out;
}

export async function can(pool, user, key) {
  if (!user) return false;
  const perms = await effPerms(pool, user);
  return perms.has(key) || perms.has("all_area") === true; // reserved
}

export function requirePerm(pool, ...keys) {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Belum masuk (sesi tidak ada/kedaluwarsa)." }, 401);
    const perms = await effPerms(pool, user);
    const ok = keys.some((k) => perms.has(k));
    if (!ok) return c.json({ error: "Akses ditolak (izin kurang)." }, 403);
    c.set("perms", perms);
    await next();
  };
}

export function requireAuth(pool) {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Belum masuk (sesi tidak ada/kedaluwarsa)." }, 401);
    c.set("perms", await effPerms(pool, user));
    await next();
  };
}
