// ============================================================
// HRIS SDM AL-WILDAN v3.1 — API (Hono + PostgreSQL)
// Melayani frontend statik sdm-v31 + endpoint /api/* dengan RBAC server-side.
// Keamanan yang diadopsi dari HR 3.0: sesi cookie httpOnly server-side,
// anti-CSRF (Origin check), header keamanan, lockout brute-force, rate-limit.
// ============================================================
import { Hono } from "hono";
import { posix } from "node:path";
import { getUserBySession, cookieName } from "./sessions.js";
import { authRoutes } from "./routes/auth.js";
import { employeesRoutes } from "./routes/employees.js";
import { attendanceRoutes } from "./routes/attendance.js";
import { requestsRoutes } from "./routes/requests.js";
import { recruitRoutes } from "./routes/recruit.js";
import { activityRoutes } from "./routes/activity.js";
import { accountsRoutes } from "./routes/accounts.js";
import { rolesRoutes } from "./routes/roles.js";
import { mailRoutes } from "./routes/mail.js";
import { chatRoutes } from "./routes/chat.js";

export function createApp(pool, { secure = false, allowedOrigins = [] } = {}) {
  const app = new Hono();

  // ===== middleware umum =====
  // Attach user dari cookie sesi
  app.use("*", async (c, next) => {
    const tok = c.req.header("cookie")?.match(new RegExp(`(?:^|;)\\s*${cookieName(secure)}=([^;]+)`))?.[1];
    const user = tok ? await getUserBySession(pool, tok) : null;
    c.set("user", user);
    c.set("ip", c.req.header("cf-connecting-ip") || c.req.header("x-real-ip") || c.req.header("x-forwarded-for")?.split(",")[0].trim() || "");
    await next();
  });

  // Header keamanan dasar — dipasang SETELAH handler pada respons akhir, karena
  // c.header() tidak ikut ke Response mentah (aset statik / index.html).
  // script-src perlu 'unsafe-inline': frontend memakai skrip inline & ±170 onclick.
  const CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com",
    "worker-src 'self' blob: https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://cdnjs.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  app.use("*", async (c, next) => {
    await next();
    c.res = new Response(c.res.body, c.res); // salin agar header bisa diubah
    const h = c.res.headers;
    h.set("X-Content-Type-Options", "nosniff");
    h.set("Referrer-Policy", "strict-origin-when-cross-origin");
    h.set("X-Frame-Options", "DENY");
    h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    h.set("Content-Security-Policy", CSP);
    if (secure) h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  });

  // Anti-CSRF: semua mutasi wajib Origin/Referer yang bertepatan dgn Host (atau allowlist).
  app.use("*", async (c, next) => {
    const method = c.req.method;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && c.req.path !== "/api/login") {
      const origin = c.req.header("origin") || "";
      const referer = c.req.header("referer") || "";
      const src = origin || referer;
      if (src) {
        try {
          const u = new URL(src);
          const host = c.req.header("host") || "";
          const allow = u.host === host || allowedOrigins.some((o) => o === u.origin);
          if (!allow) return c.json({ error: "Asal permintaan ditolak (CSRF)." }, 403);
        } catch {
          return c.json({ error: "Header Origin/Referer tidak valid." }, 400);
        }
      }
    }
    await next();
  });

  // ===== routes =====
  app.route("/", authRoutes(pool, { secure }));
  app.route("/", employeesRoutes(pool));
  app.route("/", attendanceRoutes(pool));
  app.route("/", requestsRoutes(pool));
  app.route("/", recruitRoutes(pool));
  app.route("/", activityRoutes(pool));
  app.route("/", accountsRoutes(pool));
  app.route("/", rolesRoutes(pool));
  app.route("/", mailRoutes(pool, { secure }));
  app.route("/", chatRoutes(pool));

  app.get("/api/health", (c) => c.json({ ok: true, service: "hr30-v31", time: new Date().toISOString() }));

  // ===== data SDM (PII) — hanya untuk sesi yang sudah login =====
  // data.js (NIK, alamat, gaji, rekening), recruit.js, kesehatan.js tidak boleh publik.
  const PII_FILES = new Set(["/data.js", "/recruit.js", "/kesehatan.js"]);
  app.use("*", async (c, next) => {
    // normalisasi spt adapter aset (decode %xx, //, ../) agar tidak bisa dilewati
    let p = c.req.path;
    try { p = decodeURIComponent(new URL(c.req.url).pathname); } catch { return c.text("Bad request", 400); }
    if (!PII_FILES.has(posix.normalize(p))) return next();
    if (!c.get("user")) {
      return c.text("/* 401: login diperlukan */", 401, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
      });
    }
    const res = await c.env.ASSETS.fetch(c.req.raw);
    const headers = new Headers(res.headers);
    headers.set("cache-control", "private, no-store");
    return new Response(res.body, { status: res.status, headers });
  });

  // ===== statik: sdm-v31 (index.html + assets), SPA fallback =====
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}

export default createApp;
