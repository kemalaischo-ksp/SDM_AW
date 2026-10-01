// ============================================================
// HRIS SDM AL-WILDAN v3.1 — API (Hono + PostgreSQL)
// Melayani frontend statik sdm-v31 + endpoint /api/* dengan RBAC server-side.
// Keamanan yang diadopsi dari HR 3.0: sesi cookie httpOnly server-side,
// anti-CSRF (Origin check), header keamanan, lockout brute-force, rate-limit.
// ============================================================
import { Hono } from "hono";
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

  // Header keamanan dasar
  app.use("*", async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("X-Frame-Options", "DENY");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    c.header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; script-src 'self' 'unsafe-eval' https://cdnjs.cloudflare.com; connect-src 'self'; frame-ancestors 'none'");
    if (secure) c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    await next();
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

  // ===== statik: sdm-v31 (index.html + assets), SPA fallback =====
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}

export default createApp;
