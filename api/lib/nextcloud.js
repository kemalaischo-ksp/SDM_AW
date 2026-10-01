// Integrasi Nextcloud via WebDAV — menulis ke GROUP/TEAM FOLDER "Arsip SDM".
// Kepemilikan file = folder grup (institusi), BUKAN akun individu. DB hanya simpan referensi (file_key).
// fetchImpl dapat di-inject untuk pengujian.
export function createNextcloud({ baseUrl, user, password, groupFolder = "Arsip SDM", fetchImpl }) {
  const _fetch = fetchImpl || fetch;
  const dav = `${baseUrl.replace(/\/+$/, "")}/remote.php/dav/files/${encodeURIComponent(user)}`;
  const authz = "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
  const root = groupFolder;
  const encPath = (p) => p.split("/").filter(Boolean).map(encodeURIComponent).join("/");

  async function ensureDir(relDir) {
    // Buat tiap segmen folder di bawah root (idempotent).
    const parts = `${root}/${relDir}`.split("/").filter(Boolean);
    let cur = "";
    for (const seg of parts) {
      cur += (cur ? "/" : "") + seg;
      const res = await _fetch(`${dav}/${encPath(cur)}`, { method: "MKCOL", headers: { Authorization: authz } });
      if (![201, 405, 301].includes(res.status)) {
        throw new Error(`Nextcloud MKCOL gagal (${res.status}) pada ${cur}`);
      }
    }
  }

  async function upload(relPath, bytes, contentType = "application/pdf") {
    const dir = relPath.split("/").slice(0, -1).join("/");
    await ensureDir(dir);
    const key = `${root}/${relPath}`;
    const res = await _fetch(`${dav}/${encPath(key)}`, {
      method: "PUT",
      headers: { Authorization: authz, "Content-Type": contentType },
      body: bytes,
    });
    if (![200, 201, 204].includes(res.status)) throw new Error(`Nextcloud upload gagal (${res.status})`);
    return key; // disimpan ke DB sebagai file_key / arsip_key
  }

  async function download(fileKey) {
    const res = await _fetch(`${dav}/${encPath(fileKey)}`, { headers: { Authorization: authz } });
    if (res.status !== 200) throw new Error(`Nextcloud download gagal (${res.status})`);
    return {
      body: res.body ?? (await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  }

  return { ensureDir, upload, download, _dav: dav };
}
