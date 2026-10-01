// ============================================================
// Gmail Integration — SERVER-SIDE OAuth (aman)
// Master plan keamanan:
//  • Client ID + Client Secret hanya dari env (GOOGLE_CLIENT_*).
//  • Refresh token di-ENCRYPT (AES-256-GCM, key=HASH(AUTH_SECRET))
//    lalu disimpan di DB — TIDAK pernah sent ke browser.
//  • Access token juga singa di server; lamanya refresh token expires.
//  • Browser hanya:  POST /api/mail/auth-url  → redirect ke Google
//                    GET  /api/mail/oauth/callback (redirect dari Google)
//                    GET  /api/mail/status
//                    POST /api/mail/send
//                    POST /api/mail/disconnect
// ============================================================
import { Hono } from "hono";
import { requireAuth } from "../rbac.js";
import { logActivity, logAudit } from "../audit.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send";
const GMAIL_LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
// Kirim (gmail.send) + baca Kotak Masuk (gmail.readonly). Dipisah spasi.
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";

const b64url = (bytes) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const randUrl = (n = 32) => {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return b64url(b);
};

// ---- AES-256-GCM encrypt/decrypt (key = SHA-256(AUTH_SECRET)) ----
async function encKey(secret) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", d, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptSecret(secret, plain) {
  if (!plain) return "";
  const key = await encKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return "v1:" + Buffer.from(iv).toString("base64") + ":" + Buffer.from(ct).toString("base64");
}
async function decryptSecret(secret, blob) {
  if (!blob || !blob.startsWith("v1:")) return "";
  try {
    const [, ivB64, ctB64] = blob.split(":");
    const key = await encKey(secret);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(ivB64, "base64") },
      key,
      Buffer.from(ctB64, "base64")
    );
    return new TextDecoder().decode(pt);
  } catch {
    return "";
  }
}

const now = () => new Date().toISOString();
const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function mailRoutes(pool, { secure = false } = {}) {
  const app = new Hono();

  // ---- helpers ----
  const cfg = () => ({
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    // redirect_uri: base invers dari env, atau default localhost dev.
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      `${secure ? "https" : "http"}://${process.env.PUBLIC_DOMAIN || "127.0.0.1:3000"}/api/mail/oauth/callback`,
  });

  const hasPermOrMaster = async (c) => {
    const user = c.get("user");
    if (!user) return false;
    if (user.role === "master") return true;
    const perms = c.get("perms");
    return perms && perms.has("apps.email");
  };

  // GET /api/mail/status → { connected, email }
  app.get("/api/mail/status", requireAuth(pool), async (c) => {
    if (!(await hasPermOrMaster(c))) return c.json({ connected: false, error: "Akses ditolak." }, 403);
    const res = await pool.query("SELECT id, email, refresh_enc FROM mail_tokens WHERE id=1");
    const row = res.rows[0];
    const { clientId, clientSecret, redirectUri } = cfg();
    // diagnosa konfigurasi (secret tidak pernah dikirim, hanya ada/tidaknya)
    const diag = {
      clientId: clientId ? clientId.slice(0, 12) + "…" + clientId.slice(-28) : "",
      hasSecret: !!clientSecret && !/^ganti/i.test(clientSecret),
      redirectUri,
    };
    if (!row || !row.refresh_enc) return c.json({ connected: false, diag });
    const dec = await decryptSecret(process.env.AUTH_SECRET, row.refresh_enc);
    return c.json({ connected: !!dec, email: row.email || "", diag });
  });

  // POST /api/mail/auth-url → { url } (PKCE; state stored hashed di DB 10 min)
  app.post("/api/mail/auth-url", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (!(await hasPermOrMaster(c))) return c.json({ error: "Akses ditolak." }, 403);
    const { clientId, redirectUri } = cfg();
    if (!clientId) return c.json({ error: "GOOGLE_CLIENT_ID belum diset di .env (backend)." }, 500);
    const state = randUrl(32);
    const verifier = randUrl(48);
    const ch = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = b64url(new Uint8Array(ch));
    const expires = Date.now() + 10 * 60 * 1000;
    await pool.query(
      `INSERT INTO mail_oauth_state (state, verifier, user_id, expires_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (state) DO UPDATE SET verifier=$2, user_id=$3, expires_at=$4`,
      [state, verifier, user.id, expires]
    );
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    await logAudit(pool, { userId: user.id, username: user.username, aksi: "mail_oauth_start", rincian: redirectUri, ip: c.get("ip") });
    return c.json({ url: GOOGLE_AUTH_URL + "?" + params.toString() });
  });

  // GET /api/mail/oauth/callback?code&state  (redirect dari Google)
  app.get("/api/mail/oauth/callback", async (c) => {
    const code = c.req.query("code") || "";
    const state = c.req.query("state") || "";
    const errQ = c.req.query("error") || "";
    const feBase = process.env.PUBLIC_DOMAIN ? `${secure ? "https" : "http"}://${process.env.PUBLIC_DOMAIN}` : "http://127.0.0.1:3000";
    const fail = (why) => c.redirect(`${feBase}/?mail=oauth-err&why=${encodeURIComponent(String(why).slice(0, 120))}`);
    if (errQ) return fail("google:" + errQ);
    if (!code || !state) return fail("no_code");
    const res = await pool.query("SELECT verifier, user_id, expires_at FROM mail_oauth_state WHERE state=$1", [state]);
    const row = res.rows[0];
    if (!row || Number(row.expires_at) < Date.now()) return fail("state_expired");
    await pool.query("DELETE FROM mail_oauth_state WHERE state=$1", [state]);
    const { clientId, clientSecret, redirectUri } = cfg();
    if (!clientId || !clientSecret || /^ganti/i.test(clientSecret)) return fail("no_secret");
    // token exchange (client_secret hanya dari server)
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: row.verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const tok = await tokenRes.json().catch(() => ({}));
    if (!tok.refresh_token || tok.error) {
      const why = tok.error ? "exchange:" + tok.error : "no_refresh_token";
      await logAudit(pool, { aksi: "mail_oauth_exchange_fail", rincian: why + (tok.error_description ? " — " + tok.error_description : ""), userId: row.user_id });
      return fail(why);
    }
    // response token Google tidak memuat email → ambil dari profil Gmail
    let email = "";
    try {
      const pr = await fetch(GMAIL_PROFILE_URL, { headers: { Authorization: "Bearer " + tok.access_token } });
      if (pr.ok) email = (await pr.json()).emailAddress || "";
    } catch {}
    const enc = await encryptSecret(process.env.AUTH_SECRET, tok.refresh_token);
    await pool.query(
      `INSERT INTO mail_tokens (id, email, refresh_enc, access_token, expires_at, updated_at)
       VALUES (1,$1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET email=$1, refresh_enc=$2, access_token=$3, expires_at=$4, updated_at=$5`,
      [email, enc, tok.access_token || "", Date.now() + (tok.expires_in || 3600) * 1000, Date.now()]
    );
    await logAudit(pool, { aksi: "mail_oauth_connected", rincian: email, userId: row.user_id });
    await logActivity(pool, { aksi: "Gmail tersambung (OAuth)", type: "mail", nama: email, by: "OAuth" });
    return c.redirect(`${feBase}/?mail=connected`);
  });

  // ---- intern: access token siap (refresh bila expires) ----
  async function accessToken() {
    const { clientId, clientSecret } = cfg();
    const res = await pool.query("SELECT refresh_enc, access_token, expires_at, email FROM mail_tokens WHERE id=1");
    const row = res.rows[0];
    if (!row?.refresh_enc) return null;
    const refresh = await decryptSecret(process.env.AUTH_SECRET, row.refresh_enc);
    if (!refresh) return null;
    if (row.access_token && row.expires_at > Date.now() + 2 * 60 * 1000) return { token: row.access_token, email: row.email };
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
        grant_type: "refresh_token",
      }),
    });
    const tok = await tokenRes.json().catch(() => ({}));
    if (!tok.access_token) return null;
    await pool.query("UPDATE mail_tokens SET access_token=$1, expires_at=$2 WHERE id=1", [
      tok.access_token,
      Date.now() + (tok.expires_in || 3600) * 1000,
    ]);
    return { token: tok.access_token, email: row.email };
  }

  // POST /api/mail/send {to, cc, subj, body}  → kirim via Gmail API server-side
  app.post("/api/mail/send", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (!(await hasPermOrMaster(c))) return c.json({ error: "Akses ditolak." }, 403);
    const b = await c.req.json().catch(() => ({}));
    const to = String(b.to || "").trim();
    if (!isEmail(to)) return c.json({ error: "Email tujuan tidak valid." }, 400);
    const cc = String(b.cc || "").trim();
    const subj = String(b.subj || "").slice(0, 200);
    const body = String(b.body || "");
    const g = await accessToken();
    if (!g) return c.json({ error: "Gmail belum susun — klik Susun Gmail di panel Email." }, 409);
    const raw =
      `To: ${to}\r\n` +
      (cc ? `Cc: ${cc}\r\n` : "") +
      `Subject: ${subj}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
      body;
    const sendRes = await fetch(GMAIL_SEND_URL + "?uploadType=media&mimeType=message/rfc822", {
      method: "POST",
      headers: { Authorization: "Bearer " + g.token, "Content-Type": "message/rfc822" },
      body: raw,
    });
    if (!sendRes.ok && sendRes.status === 401) {
      // token baru sekali (race) — retry 1x
      await pool.query("UPDATE mail_tokens SET access_token='', expires_at=0 WHERE id=1");
      const g2 = await accessToken();
      if (g2) {
        const r2 = await fetch(GMAIL_SEND_URL + "?uploadType=media&mimeType=message/rfc822", {
          method: "POST",
          headers: { Authorization: "Bearer " + g2.token, "Content-Type": "message/rfc822" },
          body: raw,
        });
        if (r2.ok) {
          await logActivity(pool, { aksi: "Kirim Email via Gmail", type: "mail", nama: subj, unit: to, ket: "Terkirim ke " + to, by: user.nama });
          return c.json({ ok: true });
        }
        return c.json({ error: "Gmail: " + r2.status }, 502);
      }
      return c.json({ error: "Gmail token gagal refresh — susun lagi." }, 401);
    }
    if (!sendRes.ok) {
      let t = "";
      try { t = (await sendRes.text()).slice(0, 200); } catch {}
      return c.json({ error: "Gmail HTTP " + sendRes.status + " " + t }, 502);
    }
    await logActivity(pool, { aksi: "Kirim Email via Gmail", type: "mail", nama: subj, unit: to, ket: "Terkirim ke " + to, by: user.nama });
    await logAudit(pool, { aksi: "mail_send", rincian: to + " | " + subj, userId: user.id, username: user.username, ip: c.get("ip") });
    return c.json({ ok: true });
  });

  // GET /api/mail/inbox → { connected, email, messages[] }  (butuh scope gmail.readonly)
  app.get("/api/mail/inbox", requireAuth(pool), async (c) => {
    if (!(await hasPermOrMaster(c))) return c.json({ error: "Akses ditolak." }, 403);
    const g = await accessToken();
    if (!g) return c.json({ connected: false, messages: [] });
    const max = Math.min(25, parseInt(c.req.query("max") || "15", 10) || 15);
    const listRes = await fetch(`${GMAIL_LIST_URL}?labelIds=INBOX&maxResults=${max}`, {
      headers: { Authorization: "Bearer " + g.token },
    });
    if (!listRes.ok) {
      let t = "";
      try { t = (await listRes.text()).slice(0, 200); } catch {}
      // 403 umumnya = scope gmail.readonly belum diberikan (perlu sambung ulang)
      return c.json({ error: "Gmail HTTP " + listRes.status + (listRes.status === 403 ? " (scope baca inbox belum diizinkan — putuskan lalu sambungkan ulang)" : " " + t), messages: [] }, listRes.status === 403 ? 403 : 502);
    }
    const listJson = await listRes.json().catch(() => ({}));
    const ids = (listJson.messages || []).map((m) => m.id).slice(0, max);
    const messages = [];
    for (const id of ids) {
      const mr = await fetch(`${GMAIL_LIST_URL}/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
        headers: { Authorization: "Bearer " + g.token },
      });
      if (!mr.ok) continue;
      const mj = await mr.json().catch(() => ({}));
      const h = {};
      ((mj.payload && mj.payload.headers) || []).forEach((x) => { h[x.name.toLowerCase()] = x.value; });
      const fromRaw = h.from || "";
      const nameMatch = fromRaw.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
      const mailMatch = (fromRaw.match(/<([^>]+)>/) || [])[1] || fromRaw.trim();
      messages.push({
        id,
        from: nameMatch || mailMatch,
        fromMail: mailMatch,
        subj: h.subject || "(tanpa subjek)",
        date: h.date || "",
        snippet: mj.snippet || "",
      });
    }
    return c.json({ connected: true, email: g.email, messages });
  });

  // POST /api/mail/disconnect → hapus token
  app.post("/api/mail/disconnect", requireAuth(pool), async (c) => {
    const user = c.get("user");
    if (!(await hasPermOrMaster(c))) return c.json({ error: "Akses ditolak." }, 403);
    await pool.query("DELETE FROM mail_tokens WHERE id=1");
    await logAudit(pool, { aksi: "mail_disconnect", userId: user.id, username: user.username, ip: c.get("ip") });
    return c.json({ ok: true });
  });

  return app;
}