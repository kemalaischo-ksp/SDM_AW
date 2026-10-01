// Entrypoint Node — HRIS SDM AL-WILDAN v3.1 (PostgreSQL + serve sdm-v31 statik).
import { serve } from "@hono/node-server";
import pg from "pg";
import { createPool } from "./src/db.js";
import { createAssets } from "./adapter/assets.js";
import { createApp } from "./src/index.js";

const isProd = process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "1";
if (isProd) {
  const s = process.env.AUTH_SECRET || "";
  if (s.length < 32 || s.includes("dev-insecure") || s.includes("ganti-dengan") || s.includes("ubah-saya")) {
    console.error("FATAL: AUTH_SECRET wajib ≥32 karakter acak di produksi (openssl rand -base64 32).");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL wajib di produksi.");
    process.exit(1);
  }
}

const pool = createPool(process.env.DATABASE_URL);
const publicDir = process.env.PUBLIC_DIR || new URL("../public-dist", import.meta.url).pathname;

const env = {
  DB: pool,
  ASSETS: createAssets(publicDir),
};

const app = createApp(pool, {
  secure: isProd,
  allowedOrigins: (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean),
});

const port = Number(process.env.PORT || 3000);
try {
  await pool.query("SELECT 1");
} catch (e) {
  console.error("FATAL: tidak dapat terhubung ke PostgreSQL —", e.message);
  process.exit(1);
}

serve({ fetch: (req) => app.fetch(req, env), port }, (info) => {
  console.log(`HRIS SDM AL-WILDAN v3.1 di http://localhost:${info.port} (public: ${publicDir})`);
});
