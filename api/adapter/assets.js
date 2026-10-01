// Adapter aset statis: meniru env.ASSETS.fetch(request) milik Cloudflare,
// menyajikan berkas dari folder public/. Membuat src/index.js tetap tak berubah.
import { readFile } from "node:fs/promises";
import path from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

export function createAssets(dir) {
  const root = path.resolve(dir);
  return {
    async fetch(req) {
      const url = new URL(req.url);
      let p = decodeURIComponent(url.pathname);
      if (p === "/" || p.endsWith("/")) p += "index.html";
      // cegah path traversal
      const file = path.normalize(path.join(root, p));
      if (!file.startsWith(root)) return new Response("Forbidden", { status: 403 });
      try {
        const data = await readFile(file);
        return new Response(data, {
          headers: { "content-type": MIME[path.extname(file)] || "application/octet-stream" },
        });
      } catch {
        // fallback ke index.html (untuk rute SPA)
        try {
          const data = await readFile(path.join(root, "index.html"));
          return new Response(data, { headers: { "content-type": "text/html; charset=utf-8" } });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      }
    },
  };
}
