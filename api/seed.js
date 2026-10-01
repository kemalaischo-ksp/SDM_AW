// Seed HRIS v3.1 — role-perms preset + akun admin awal.
// Dipanggil api/migrate.js (--seed) atau via: node seed.js
import { hashPassword } from "./src/pbkdf2.js";

const now = () => Date.now();

export const ROLE_META = {
  master: { label: "Master Admin (Holding)" },
  kadiv_hr: { label: "KADIV HR" },
  staff_hr: { label: "Staff HR" },
  karyawan: { label: "Karyawan" },
};

// Preset izin per role (cermin ROLE_PRESET UI; master = semua izin).
export const PERM_KEYS = [
  "dashboard",
  "analytics",
  "network",
  "employees.view",
  "employees.edit",
  "attendance",
  "leave.view",
  "leave.approve",
  "payroll",
  "ticketing.view",
  "ticketing.respond",
  "recruitment.view",
  "recruitment.edit",
  "recruitment.interview",
  "apps.email", "apps.chat", "apps.calendar",
  "recruitment.approve",
  "accounts",
];

const ROLE_PRESET = {
  master: PERM_KEYS,
  kadiv_hr: [
    "dashboard", "analytics", "network", "employees.view", "attendance",
    "leave.view", "payroll", "ticketing.view", "ticketing.respond",
    "recruitment.view", "recruitment.edit", "recruitment.interview",
  ],
  staff_hr: ["recruitment.view", "recruitment.interview"],
  karyawan: [],
};

export async function seedRolePerms(client) {
  for (const role of Object.keys(ROLE_PRESET)) {
    for (const key of ROLE_PRESET[role]) {
      await client.query(
        "INSERT INTO role_perms (role, perm_key) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [role, key]
      );
    }
  }
}

export async function seedAdmin(client) {
  const exists = await client.query("SELECT id FROM users WHERE username=$1", ["admin"]);
  if (exists.rowCount) return;
  const ph = await hashPassword("alwildan2026");
  await client.query(
    `INSERT INTO users (id, username, password_hash, role, nama, unit, must_change, aktif, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,1,1,$7,$7)`,
    ["admin-root", "admin", ph, "master", "Kemal Prabowo, M.Si.", "Holding", now()]
  );
  console.log("Akun admin disemai (username=admin, sandi awal=alwildan2026, wajib ganti).");
}

// mode standalone
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  import("pg").then(async ({ default: pg }) => {
    const url = process.env.DATABASE_URL;
    if (!url) { console.error("FATAL: DATABASE_URL wajib diisi."); process.exit(1); }
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    try {
      await seedRolePerms(c);
      await seedAdmin(c);
      console.log("Seed selesai.");
    } finally { await c.end(); }
  });
}
