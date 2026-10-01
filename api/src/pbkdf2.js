// PBKDF2-SHA256 — hash & verifikasi kata sandi (cocok dgn seed HR 2.0).
const enc = (s) => new TextEncoder().encode(s);
const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));

export async function hashPassword(password, iterations = 50000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey("raw", enc(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, km, 256);
  return `pbkdf2$${iterations}$${bytesToB64(salt)}$${bytesToB64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  try {
    const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
    if (scheme !== "pbkdf2") return false;
    const iterations = parseInt(iterStr, 10);
    const salt = b64ToBytes(saltB64);
    const expected = b64ToBytes(hashB64);
    const km = await crypto.subtle.importKey("raw", enc(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, km, 256);
    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

// Kebijakan sandi: min 12, wajib huruf+angka, bukan sandi umum.
export function passwordPolicyError(pw) {
  if (!pw || pw.length < 12) return "Sandi minimal 12 karakter.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Sandi wajib memuat huruf dan angka.";
  const common = [
    "password", "alwildan2026", "123456789", "qwerty", "alwildan",
  ];
  if (common.some((c) => pw.toLowerCase().includes(c))) return "Sandi terlalu umum.";
  return null;
}

export function randPassword(len = 12) {
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ", L = "abcdefghijkmnpqrstuvwxyz",
        D = "23456789", S = "!@#$%*?+";
  const all = U + L + D + S;
  const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  let p = [U[rnd(U.length)], L[rnd(L.length)], D[rnd(D.length)], S[rnd(S.length)]];
  for (let i = p.length; i < len; i++) p.push(all[rnd(all.length)]);
  for (let i = p.length - 1; i > 0; i--) { const j = rnd(i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  return p.join("");
}
