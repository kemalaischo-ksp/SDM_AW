// Parser template "Arsip SDM" AL-WILDAN (AW/LM form biodata, PDF text-based).
// Layer 1 deterministik (regex) — tanpa AI, offline, tanpa kirim NIK ke pihak ketiga.
// Layer 2 opsional: aiLengkapi() bila AI_API_URL diset (OpenAI-compatible, cth. Ollama).
// Output: { data, confidence, warnings } — data SELALU perlu verifikasi admin.

const BULAN_ID = {
  januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06",
  juli: "07", agustus: "08", september: "09", oktober: "10", november: "11", desember: "12",
};

const rupiahKeAngka = (s) => {
  if (s == null) return null;
  const d = String(s).replace(/[^0-9]/g, "");
  return d ? Number(d) : null;
};

// Ambil nilai setelah label. Cocokkan label pada kepala baris (sebelum ":")
// agar nilai berisi kata label (cth. "Guru Mata Pelajaran") tidak salah kena.
// Urutan: (1) nilai setelah ":" sebaris, (2) nilai sebaris pisah tab,
// (3) baris berikut yg diawali ":", (4) baris non-kosong berikut.
function ambil(baris, labelRe) {
  const i = baris.findIndex((l) => labelRe.test(l.split(":")[0]));
  if (i < 0) return null;
  const line = baris[i];
  const sesudah = line.split(":").slice(1).join(":").trim();
  if (sesudah && !/^:+$/.test(sesudah)) return sesudah;
  const tab = line.split("\t").map((s) => s.trim()).filter((s) => s && !/^:+$/.test(s));
  if (tab.length > 1 && labelRe.test(tab[0])) return tab.slice(1).join(" ");
  // Nilai di baris berikut hanya bila baris label TAK punya ":" sendiri
  // (kalau ":" ada tapi kosong → datanya memang kosong, jangan comot baris lain).
  if (line.includes(":")) return null;
  for (let j = i + 1; j < Math.min(i + 6, baris.length); j++) {
    const l = baris[j].trim();
    if (!l) continue;
    if (l.startsWith(":")) return l.slice(1).trim();
  }
  for (let j = i + 1; j < Math.min(i + 6, baris.length); j++) {
    const l = baris[j].trim();
    if (!l || /^\d+\.\s*\S/.test(l)) continue;
    return l;
  }
  return null;
}

export function parseSDM(teks) {
  const data = {
    nama_gelar: null, email: null, no_hp: null, nik_ktp: null, alamat: null,
    tempat_lahir: null, tgl_lahir: null, status_kawin: null, transport: null,
    posisi_diajukan: null, mapel: null, unit_nama: null, cabang_nama: null,
    tinggi_cm: null, berat_kg: null, gaji_diajukan: null,
    bank_utama: null, norek_utama: null, bank_lain: null, norek_lain: null,
    cv_link: null, pendidikan: null, pengalaman: [],
  };
  const confidence = {};
  const warnings = [];
  const ok = (k, v, c = "tinggi") => { data[k] = v; confidence[k] = c; };
  const nope = (k, msg) => { confidence[k] = "rendah"; if (msg) warnings.push(msg); };

  const t = String(teks || "");
  if (!t.trim()) return { data, confidence, warnings: ["Teks PDF kosong — pastikan PDF bukan hasil scan gambar."] };
  const baris = t.split(/\r?\n/).map((l) => l.replace(/ {2,}/g, " ").trim());
  const rapat = t.replace(/\s+/g, ""); // untuk link yg terpotong baris
  const datar = t.replace(/\s+/g, " "); // regex lintas baris

  // 1. Nama — baris ":" pertama setelah "Nama Lengkap"
  const nama = ambil(baris, /nama lengkap/i);
  if (nama && nama.length >= 3) ok("nama_gelar", nama);
  else nope("nama_gelar", "Nama tidak terbaca — isi manual.");

  // 2. Email — cocokkan pola email pertama yg utuh
  const email = (t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [])[0];
  if (email) ok("email", email.toLowerCase());
  else nope("email", "Email tidak terbaca.");

  // 3. No HP — dari link wa.me (normalisasi 08.. → 628..)
  const wa = (datar.match(/wa\.me\/(\d{10,14})(?!\d)/i) || [])[1];
  if (wa) {
    const norm = wa.startsWith("08") ? "628" + wa.slice(2) : wa.startsWith("628") ? wa : null;
    if (norm && /^628[0-9]{8,14}$/.test(norm)) ok("no_hp", norm);
    else nope("no_hp", `No WA terbaca (${wa}) tapi format tidak valid.`);
  } else nope("no_hp", "No HP tidak terbaca.");

  // 4. NIK — 16 digit
  const nik = (datar.match(/\b\d{16}\b/) || [])[0];
  if (nik) ok("nik_ktp", nik);
  else nope("nik_ktp", "NIK tidak terbaca ( sensitif — pastikan benar).");

  // 5-9. Domisili, lahir, status, transport
  const alamat = ambil(baris, /alamat domisili/i);
  if (alamat) ok("alamat", alamat); else nope("alamat", "Alamat tidak terbaca.");
  const tpl = ambil(baris, /tempat lahir/i);
  if (tpl) ok("tempat_lahir", tpl); else nope("tempat_lahir", "Tempat lahir tidak terbaca.");
  const tglL = ambil(baris, /tanggal lahir/i);
  if (tglL) {
    const m = tglL.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    const bl = m && BULAN_ID[m[2].toLowerCase()];
    const n = tglL.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); // 10-12-1999 = DD-MM-YYYY
    if (m && bl) ok("tgl_lahir", `${m[3]}-${bl}-${m[1].padStart(2, "0")}`);
    else if (n && +n[2] >= 1 && +n[2] <= 12 && +n[1] >= 1 && +n[1] <= 31)
      ok("tgl_lahir", `${n[3]}-${n[2].padStart(2, "0")}-${n[1].padStart(2, "0")}`, "sedang");
    else nope("tgl_lahir", `Tanggal lahir terbaca ("${tglL}") tapi format tak dikenal.`);
  } else nope("tgl_lahir", "Tanggal lahir tidak terbaca.");
  const st = ambil(baris, /^8\.\s*status|status\s*:/i);
  if (st) {
    const s = /menikah/i.test(st) ? "Menikah" : /janda/i.test(st) ? "Janda" : /duda/i.test(st) ? "Duda" : /lajang|belum/i.test(st) ? "Lajang" : null;
    if (s) ok("status_kawin", s);
    else nope("status_kawin", `Status ("${st}") tak dikenal — pilih manual.`);
  } else nope("status_kawin", "Status kawin tidak terbaca.");
  const tr = ambil(baris, /transport/i);
  if (tr) ok("transport", tr, "sedang"); else nope("transport", "Transport tidak terbaca.");

  // 10-13. Posisi, mapel, unit, cabang
  const pos = ambil(baris, /posisi yang diajukan/i);
  if (pos) ok("posisi_diajukan", pos); else nope("posisi_diajukan", "Posisi tidak terbaca.");
  const mpl = ambil(baris, /mata pelajaran/i);
  if (mpl) ok("mapel", mpl, "sedang");
  const unt = ambil(baris, /12\.\s*unit|^unit\s*:/i);
  if (unt) ok("unit_nama", unt, "sedang"); else nope("unit_nama", "Unit tidak terbaca — pilih manual.");
  const cbg = ambil(baris, /cabang al-wildan/i);
  if (cbg) ok("cabang_nama", cbg, "sedang");

  // 14-15. Tinggi/berat
  const tg = ambil(baris, /tinggi badan/i);
  const tgm = tg && tg.match(/(\d{2,3})/);
  if (tgm) ok("tinggi_cm", Number(tgm[1]), "sedang");
  const br = ambil(baris, /berat badan/i);
  const brm = br && br.match(/(\d{2,3})/);
  if (brm) ok("berat_kg", Number(brm[1]), "sedang");

  // Pendidikan S1
  const pt = ambil(baris, /lulusan.*\(s1\)/i);
  const prodi = ambil(baris, /program studi/i);
  const ipkRaw = ambil(baris, /\bipk\b/i);
  if (pt || prodi || ipkRaw) {
    const ipk = ipkRaw ? Number(String(ipkRaw).replace(",", ".")) : null;
    data.pendidikan = {
      jenjang: "S1",
      perguruan_tinggi: pt || null,
      prodi: prodi || null,
      ipk: ipk != null && ipk >= 0 && ipk <= 4 ? ipk : null,
    };
    confidence.pendidikan = pt && prodi ? "tinggi" : "sedang";
    if (ipkRaw && !(ipk >= 0 && ipk <= 4)) warnings.push(`IPK ("${ipkRaw}") di luar 0–4 — cek manual.`);
  }

  // Pengalaman 17/18/19 — regex lintas baris di seksi pengalaman
  const sek = (datar.match(/pengalaman[\s\S]*?gaji yang diajukan/i) || [])[0] || "";
  const re = /(1[789])\.\s*([^:]+?)\s*:\s*rp\.?\s*([\d.,]+)/gi;
  let m;
  while ((m = re.exec(sek)) && data.pengalaman.length < 3) {
    const salary = rupiahKeAngka(m[3]);
    data.pengalaman.push({
      urutan: data.pengalaman.length + 1,
      deskripsi: m[2].replace(/\s+/g, " ").trim(),
      salary,
    });
  }
  // Buang baris kosong (varian template dgn baris 18/19 kosong)
  data.pengalaman = data.pengalaman.filter((p) => p.deskripsi || p.salary != null);
  data.pengalaman.forEach((p, i) => { p.urutan = i + 1; });
  confidence.pengalaman = data.pengalaman.length ? "sedang" : "rendah";

  // Gaji diajukan
  const gajiM = datar.match(/gaji yang diajukan[\s\S]{0,120}?rp\.?\s*([\d.,]+)/i);
  const gaji = gajiM && rupiahKeAngka(gajiM[1]);
  if (gaji) ok("gaji_diajukan", gaji);
  else nope("gaji_diajukan", "Gaji diajukan tidak terbaca.");

  // Rekening — angka 9–16 digit di dekat label bank (hindari NIK 16 digit via konteks)
  const bsiM = datar.match(/bank bsi[\s\S]{0,160}?(\d{9,15})/i);
  if (bsiM) { ok("bank_utama", "BSI"); ok("norek_utama", bsiM[1]); }
  else {
    const bsiAlt = datar.match(/bank syariah indonesia\)?\s*(\d{9,15})/i);
    if (bsiAlt) { ok("bank_utama", "BSI"); ok("norek_utama", bsiAlt[1]); }
    else nope("norek_utama", "No rekening utama tidak terbaca (sensitif — pastikan benar).");
  }
  const lainN = datar.match(/rekening lain[\s\S]{0,160}?(\d{9,15})/i);
  if (lainN) ok("norek_lain", lainN[1], "sedang");
  const lainB = ambil(baris, /nama bank lain/i);
  if (lainB && /^[A-Za-z& ]{2,30}$/.test(lainB)) {
    ok("bank_lain", lainB.toUpperCase(), "sedang");
  }

  // Link CV (Google Drive) — ambil sampai ID saja agar tak terseret teks tabel
  const cv = (rapat.match(/https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+/) || [])[0];
  if (cv) ok("cv_link", cv, "sedang");

  return { data, confidence, warnings };
}

// Layer 2: minta LLM melengkapi field yg masih null. Fail-open (return data apa adanya bila gagal).
export async function aiLengkapi(teks, data, { url, key, model, timeoutMs = 60000 } = {}) {
  const kurang = Object.entries(data).filter(([k, v]) => (v == null || (Array.isArray(v) && !v.length)) && k !== "pengalaman").map(([k]) => k);
  if (!url || !kurang.length) return { data, ai_dipakai: false };
  const kosong = { ...data };
  delete kosong.pengalaman;
  const prompt =
    "Ekstrak data biodata dari teks formulir SDM berikut ke JSON dengan kunci persis: " + kurang.join(", ") +
    ". Format: tgl_lahir ISO YYYY-MM-DD; no_hp format 628...; angka tanpa titik/koma; null bila tidak ada. Hanya JSON, tanpa penjelasan.\n\n" +
    String(teks).slice(0, 12000);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model: model || "qwen2.5:7b",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Kamu ekstraktor data presisi. Jawab hanya JSON valid." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return { data, ai_dipakai: false };
    const j = await res.json();
    const isi = JSON.parse(j.choices?.[0]?.message?.content || "{}");
    const gabung = { ...data };
    for (const k of kurang) {
      if (isi[k] != null && isi[k] !== "") gabung[k] = isi[k];
    }
    return { data: gabung, ai_dipakai: true };
  } catch {
    return { data, ai_dipakai: false };
  } finally {
    clearTimeout(t);
  }
}
