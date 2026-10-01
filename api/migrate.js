// Migrator HRIS v3.1 — menerapkan db/schema.sql (idempoten).
// Jalankan dari api/:  node migrate.js      (up / inisialisasi schema)
//    opsi:            --seed               (tambah seed admin)
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL;
const schemaPath = new URL("./db/schema.sql", import.meta.url);
const doSeed = process.argv.includes("--seed");

if (!url) {
  console.error("FATAL: DATABASE_URL wajib diisi.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const sql = await readFile(schemaPath, "utf8");
  await client.query(sql);
  console.log("Skema HRIS v3.1 diterapkan (idempotent).");

  if (doSeed) {
    const { seedAdmin, seedRolePerms } = await import("./seed.js");
    await seedRolePerms(client);
    await seedAdmin(client);
  }
  console.log("Migrasi HR 3.1 selesai.");
} catch (e) {
  console.error("Migrasi gagal:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
