/* Unduh CSV (kompatibel Excel, UTF-8 + BOM) — laporan dibuat dari data API di sisi klien. */
import { useEffect, useState } from "react";
import { api } from "./api";

/** True bila tautan adalah file arsip internal (/api/arsip/...) yang butuh sesi. */
export const isArsipUrl = (s: string | null | undefined): s is string =>
  !!s && s.startsWith("/api/arsip/");

/** Resolve src gambar: URL biasa langsung, arsip internal via blob berkredensial. */
export function useArsip(src: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (src && !isArsipUrl(src) ? src : null));
  const kunci = isArsipUrl(src) ? src : null;
  useEffect(() => {
    if (!kunci) return;
    let hidup = true;
    let obj = "";
    fetch(api.arsipPenuh(kunci), { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        obj = URL.createObjectURL(await r.blob());
        if (hidup) setUrl(obj);
      })
      .catch(() => { /* biarkan null */ });
    return () => { hidup = false; if (obj) URL.revokeObjectURL(obj); };
  }, [kunci]);
  return kunci ? url : (src ?? null);
}
export function unduhCSV(namaFile: string, header: string[], baris: (string | number | null | undefined)[][]) {
  const sel = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const isi = "﻿" + [header.map(sel).join(";"), ...baris.map((b) => b.map(sel).join(";"))].join("\r\n");
  const blob = new Blob([isi], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = namaFile.endsWith(".csv") ? namaFile : `${namaFile}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

/* Cetak halaman (dialog print browser → simpan sebagai PDF). */
export function cetak() {
  window.print();
}
