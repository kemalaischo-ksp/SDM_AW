#!/usr/bin/env python3
"""Import SDM otomatis dari file cleansing Excel ke database HR 3.0.

Membaca sheet Clean_Enriched (bila ada) atau Clean, lalu mencetak
pernyataan SQL ke stdout dalam SATU transaksi (BEGIN/COMMIT) untuk
dieksekusi via psql. Log & ringkasan ke stderr. Nilai ambigu yang tidak
bisa divalidasi otomatis TIDAK ditebak — dicatat ke file review CSV.

Pakai (via import_sdm.sh, bukan langsung):
    python3 import_sdm.py <file.xlsx> [--replace] [--review-out lap.csv] | psql ...

Aturan utama:
- NIP digenerate DB-side via next_nip(YY) dari kolom THN AKTIF (fallback '26').
- NO ACC dipisah: pola nomor HP -> no_hp (628...), selainnya -> norek_utama.
- NIK 16 digit & email di-dedup global (duplikat -> review, bukan insert).
- THP Excel (satu angka) -> thp_kotor = thp_bersih, komponen TK/THR = 0.
- IPK/gaji "0" atau placeholder ("-","Belum","Tidak ada","_",".") = tidak ada data.
- Tanpa --replace: script TIDAK mencetak pernyataan destruktif.
  Penjagaan "tabel sudah terisi" ada di import_sdm.sh (hitung baris
  non-referensi NIP 900xxx).
"""

import argparse
import csv
import re
import sys

try:
    import openpyxl
except ImportError:
    print("GAGAL: butuh modul 'openpyxl'. Install: pip install openpyxl",
          file=sys.stderr)
    sys.exit(2)


# ---------------------------------------------------------------- peta unit
UNIT_TO_CABANG = {
    "Holding": "HOLDING", "Yayasan": "YAYASAN", "Lintas": "LINTAS",
    "AW 1": "AW1", "AW 3": "AW3", "AW 4": "AW4", "AW 5": "AW5",
    "AW 7": "AW7", "AW 8": "AW8", "AW 10": "AW10", "AW 12": "AW12",
    "AW 13": "AW13", "AW 14": "AW14", "AW 15": "AW15", "AW 16": "AW16",
    "AW 20": "AW20", "AW 22": "AW22", "AW 23": "AW23", "AW 24": "AW24",
    "AW 29": "AW29", "AW32": "AW32",
}

BULAN_ID = {
    "januari": 1, "februari": 2, "febuari": 2, "maret": 3, "april": 4,
    "mei": 5, "juni": 6, "juli": 7, "agustus": 8, "september": 9,
    "oktober": 10, "november": 11, "desember": 12,
    "january": 1, "february": 2, "febuary": 2, "march": 3, "may": 5,
    "june": 6, "july": 7, "august": 8, "october": 10,
}
BULAN_RE = "|".join(sorted(BULAN_ID.keys(), key=len, reverse=True))

# Teks placeholder yang berarti "tidak ada data" di kolom bebas
PLACEHOLDER_TXT = {"", "-", "_", ".", "tidak ada", "belum", "none", "0"}

BANK_PATTERNS = [
    (r"MANDIRI", "MANDIRI"), (r"\bBRI\b", "BRI"), (r"\bBCA\b", "BCA"),
    (r"BANK JAGO", "BANK JAGO"), (r"SEABANK", "SEABANK"),
    (r"\bBNI\b", "BNI"), (r"\bBSI\b", "BSI"),
]


# ---------------------------------------------------------------- util umum
def esc(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def clean_txt(v):
    if v is None:
        return None
    s = str(v).strip()
    if s.lower() in PLACEHOLDER_TXT:
        return None
    return s


def norm_gender(g):
    if not g:
        return None
    s = str(g).strip().lower()
    if s.startswith("pria"):
        return "Pria"
    if s.startswith("perempuan"):
        return "Perempuan"
    return None


def norm_year(y):
    if y is None:
        return None
    m = re.match(r"^(19|20)\d{2}$", str(y).strip())
    if not m:
        return None
    n = int(m.group(0))
    return n if 2010 <= n <= 2026 else None


def norm_nik16(v):
    if not v:
        return None
    s = re.sub(r"\D", "", str(v))
    return s if len(s) == 16 else None


def norm_hp(acc):
    if acc is None:
        return None
    s = str(acc).strip()
    if not re.match(r"^\d{8,15}(\.0)?$", s):
        return None
    s = s.split(".")[0]
    if s.startswith("62"):
        cand = s
    elif s.startswith("08"):
        cand = "62" + s[1:]
    elif s.startswith("8"):
        cand = "62" + s
    else:
        return None
    return cand if re.match(r"^628[0-9]{8,14}$", cand) else None


def parse_bank(acc):
    """(nama_bank_atau_None, nomor_atau_None) utk NO ACC berisi teks bank."""
    if not acc or not re.search(r"[A-Za-z]", str(acc)):
        return None, None
    s = str(acc).strip()
    bank = next((nm for pat, nm in BANK_PATTERNS if re.search(pat, s, re.I)),
                None)
    num = re.sub(r"\D", "", s)
    return bank, (num or None)


def norm_status_kawin(v):
    if not v:
        return None
    s = str(v).lower()
    if "menikah" in s:
        return "Menikah"
    if "janda" in s:
        return "Janda"
    if "duda" in s:
        return "Duda"
    if "lajang" in s or "belum" in s:
        return "Lajang"
    return None


def norm_jenjang(g):
    if not g:
        return None
    s = str(g).strip().upper()
    return s if s in ("SMA", "D1", "D2", "D3", "D4", "S1", "S2", "S3") else None


def parse_ipk(v):
    """(float_atau_None, peringatan_atau_None). 0 = tidak ada data."""
    if v is None or v == "":
        return None, None
    if isinstance(v, (int, float)):
        f = float(v)
        return (None, None) if f == 0 else (
            (f, None) if 0 < f <= 4 else (None, f"IPK di luar range ({v})"))
    s = str(v).strip()
    if s in ("-", "0"):
        return None, None
    s2 = s.replace(" ", "")
    if "/" in s2:
        return None, f"IPK skala campuran ({v})"
    try:
        f = float(s2)
    except ValueError:
        return None, f"IPK tidak terbaca ({v})"
    if f == 0:
        return None, None
    return (f, None) if 0 < f <= 4 else (None, f"IPK di luar range 0-4 ({v})")


def parse_money(v):
    """(angka_atau_None, peringatan_atau_None). Rentang/teks -> review."""
    if v is None or v == "":
        return None, None
    if isinstance(v, (int, float)):
        return (None, None) if float(v) == 0 else (float(v), None)
    s = str(v).strip()
    if s in ("-", "0"):
        return None, None
    if re.search(r"[%A-Za-z]", s):
        return None, f"nilai non-angka ({v})"
    if "-" in s.strip("-").replace(".", ""):
        return None, f"rentang nilai ({v})"
    digits = re.sub(r"[^\d]", "", s)
    if not digits or float(digits) == 0:
        return None, None
    return float(digits), None


def parse_tinggi(v):
    if v is None or v == "":
        return None
    try:
        f = float(str(v).replace(",", "."))
    except ValueError:
        return None
    if f < 3:  # kemungkinan satuan meter
        f *= 100
    return round(f) if 100 <= f <= 220 else None


def parse_berat(v):
    if v is None or v == "":
        return None
    try:
        f = float(str(v).replace(",", "."))
    except ValueError:
        return None
    return round(f) if 20 <= f <= 200 else None


def parse_tgl_lahir(raw):
    """String YYYY-MM-DD atau None bila tidak bisa diparse aman."""
    if raw is None:
        return None
    s = str(int(raw)) if isinstance(raw, (int, float)) else str(raw).strip()
    if not s or s in ("-", "0", "None"):
        return None
    low = s.strip().lstrip(",").strip().lower()

    m = re.search(r"(\d{1,2})\D{0,3}(" + BULAN_RE + r")\D{0,3}(\d{4})", low)
    if m:
        d, mo, y = int(m.group(1)), BULAN_ID[m.group(2)], int(m.group(3))
        if d > 31:
            d = int(str(d)[:2])
        if 1 <= d <= 31 and 1900 <= y <= 2015:
            return f"{y:04d}-{mo:02d}-{min(d, 31):02d}"

    only_digits = re.sub(r"\D", "", s)
    if len(only_digits) == 8:
        d, mo, y = (int(only_digits[0:2]), int(only_digits[2:4]),
                    int(only_digits[4:8]))
        if 1 <= d <= 31 and 1 <= mo <= 12 and 1900 <= y <= 2015:
            return f"{y:04d}-{mo:02d}-{d:02d}"
        if 1 <= mo <= 31 and 1 <= d <= 12 and 1900 <= y <= 2015:  # MM-DD-YYYY
            return f"{y:04d}-{d:02d}-{mo:02d}"

    m = re.match(r"^\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})\s*$",
                 s)
    if m:
        d, mo, ys = int(m.group(1)), int(m.group(2)), m.group(3)
        y = (1900 + int(ys)) if len(ys) == 2 and int(ys) >= 30 else (
            (2000 + int(ys)) if len(ys) == 2 else int(ys))
        if 1 <= d <= 31 and 1 <= mo <= 12 and 1900 <= y <= 2015:
            return f"{y:04d}-{mo:02d}-{d:02d}"
        if 1 <= mo <= 31 and 1 <= d <= 12 and 1900 <= y <= 2015:
            return f"{y:04d}-{d:02d}-{mo:02d}"

    m = re.match(r"^\s*(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s*$", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= d <= 31 and 1 <= mo <= 12 and 1900 <= y <= 2015:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    return None


# ------------------------------------------------------- pemetaan header
def norm_header(h):
    return re.sub(r"\s+", " ", str(h or "").strip().lower())


def build_colmap(headers):
    """Peta nama_field -> indeks kolom dari baris header (enrichment)."""
    cmap = {}
    for i, h in enumerate(headers):
        n = norm_header(h)
        if n.startswith("nik ktp"):
            cmap["nik_ktp_src"] = i
        elif n.startswith("alamat"):
            cmap["alamat"] = i
        elif n.startswith("tempat lahir"):
            cmap["tempat_lahir"] = i
        elif n.startswith("tanggal lahir"):
            cmap["tgl_lahir"] = i
        elif n == "status":
            cmap["status_kawin"] = i
        elif n.startswith("transport"):
            cmap["transport"] = i
        elif n.startswith("posisi"):
            cmap["posisi"] = i
        elif n.startswith("mata pelajaran"):
            cmap["mapel_old"] = i
        elif "strata-1" in n or n.startswith("lulusan") and "(s1)" in n:
            cmap["pt_s1"] = i
        elif "program studi (s1)" in n:
            cmap["prodi_s1"] = i
        elif n.startswith("ipk (contoh") or n == "ipk":
            cmap["ipk_s1"] = i
        elif "strata-2" in n or "program studi (s2)" in n:
            cmap["pt_s2" if "strata-2" in n or "lulusan" in n else "prodi_s2"] = i
        elif "ipk s2" in n:
            cmap["ipk_s2"] = i
        elif "strata-3" in n or "program studi (s3)" in n:
            cmap["pt_s3" if "strata-3" in n or "lulusan" in n else "prodi_s3"] = i
        elif "ipk s3" in n:
            cmap["ipk_s3"] = i
        elif n.startswith("pengalaman bekerja 1") or n == "pengalaman bekerja 1":
            cmap["peng1"] = i
        elif "gaji tempat kerja sebelumnya-1" in n:
            cmap["gaji1"] = i
        elif n.startswith("pengalaman bekerja-2"):
            cmap["peng2"] = i
        elif "gaji tempat kerja sebelumnya-2" in n:
            cmap["gaji2"] = i
        elif n.startswith("pengalaman bekerja-3"):
            cmap["peng3"] = i
        elif "gaji tempat kerja sebelumnya-3" in n:
            cmap["gaji3"] = i
        elif n.startswith("gaji yang diajukan"):
            cmap["gaji_diajukan"] = i
        elif n.startswith("no rekening bank syariah"):
            cmap["norek_bsi"] = i
        elif n.startswith("no rekening bank lain"):
            cmap["norek_lain"] = i
        elif n == "nama bank":
            cmap["bank_lain"] = i
        elif n.startswith("tinggi badan"):
            cmap["tinggi"] = i
        elif n.startswith("berat badan"):
            cmap["berat"] = i
        elif n.startswith("email address"):
            cmap["email"] = i
        elif n.startswith("link riwayat kesehatan"):
            cmap["kesehatan"] = i
        elif n == "photo_url":
            cmap["foto"] = i
    return cmap


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description="Import SDM cleansing -> SQL")
    ap.add_argument("xlsx", help="file Excel sumber")
    ap.add_argument("--replace", action="store_true",
                    help="kosongkan tabel employees dulu (butuh backup)")
    ap.add_argument("--review-out", default=None,
                    help="file CSV laporan review manual")
    args = ap.parse_args()

    wb = openpyxl.load_workbook(args.xlsx, data_only=True)
    if "Clean_Enriched" in wb.sheetnames:
        ws = wb["Clean_Enriched"]
    elif "Clean" in wb.sheetnames:
        ws = wb["Clean"]
    else:
        print(f"GAGAL: sheet Clean_Enriched/Clean tidak ada "
              f"(ada: {wb.sheetnames})", file=sys.stderr)
        sys.exit(2)

    # Cari baris header (kolom B berisi NAMA)
    header_idx, headers = None, None
    for r in range(1, 7):
        vals = [c.value for c in ws[r]]
        if len(vals) > 1 and vals[1] and norm_header(vals[1]) == "nama":
            header_idx, headers = r, vals
            break
    if header_idx is None:
        print("GAGAL: baris header (kolom NAMA) tidak ditemukan", file=sys.stderr)
        sys.exit(2)

    rows = [r for r in ws.iter_rows(min_row=header_idx + 1, values_only=True)
            if any(r)]
    cmap = build_colmap(headers)
    enriched = "nik_ktp_src" in cmap
    print(f"sheet={ws.title} baris={len(rows)} enriched={enriched}",
          file=sys.stderr)

    def col(r, key, fallback=None):
        if key in cmap:
            return r[cmap[key]] if cmap[key] < len(r) else None
        return r[fallback] if fallback is not None and fallback < len(r) else None

    # ---- pass 1: kandidat NIK & email (dedup global) ----
    nik_cand, email_cand = {}, {}
    for r in rows:
        n = norm_nik16(col(r, "nik_ktp_src", 2))
        if n:
            nik_cand.setdefault(n, []).append(r[1])
        e = clean_txt(col(r, "email", None))
        if e:
            email_cand.setdefault(e.lower(), []).append(r[1])

    sql = ["BEGIN;"]
    if args.replace:
        # MODE --replace: hapus data SDM riil, tapi PERTAHANKAN baris
        # referensi atasan (NIP 900xxx dari migrasi 010).
        # Tabel anak ber-cascade (pendidikan/pengalaman/absensi/cuti/dll)
        # ikut terhapus otomatis. Dua tabel TANPA cascade (documents,
        # payrolls) + self-FK atasan_id dihapus/dinull-kan eksplisit
        # HANYA untuk baris yang diganti. Anak tabel non-cascade lain
        # di masa depan akan MENOLAK hapus (FK error -> rollback total).
        # Backup pg_dump WAJIB dibuat dulu oleh import_sdm.sh.
        sql += ["CREATE TEMP TABLE _hapus_emp AS "
                "SELECT id FROM employees WHERE nip NOT LIKE '900%';",
                "UPDATE employees SET atasan_id = NULL "
                "WHERE atasan_id IN (SELECT id FROM _hapus_emp);",
                "DELETE FROM documents "
                "WHERE employee_id IN (SELECT id FROM _hapus_emp);",
                "DELETE FROM payrolls "
                "WHERE employee_id IN (SELECT id FROM _hapus_emp);",
                "DELETE FROM employees WHERE id IN (SELECT id FROM _hapus_emp);",
                "DELETE FROM nip_sequences;"]
    review = []
    n_ins = n_pend = n_peng = 0

    for r in rows:
        nu = r[0]
        nama = clean_txt(r[1])
        if not nama:
            continue
        jabatan = clean_txt(r[3]) if len(r) > 3 else None
        gender = norm_gender(r[4]) if len(r) > 4 else None
        gelar = r[5] if len(r) > 5 else None
        mapel = clean_txt(r[6]) if len(r) > 6 else None
        yr = norm_year(r[7]) if len(r) > 7 else None
        no_acc = r[8] if len(r) > 8 else None
        thp = r[9] if len(r) > 9 else 0
        unit_raw = r[10] if len(r) > 10 else None
        cabang = UNIT_TO_CABANG.get(str(unit_raw).strip()
                                    if unit_raw else None, "LAIN")
        yy = f"{yr % 100:02d}" if yr else "26"
        try:
            thp_n = max(0.0, float(thp or 0))
        except (TypeError, ValueError):
            thp_n = 0.0
        tmt = f"{yr}-01-01" if yr else None

        cols = ["unit_id", "cabang_id", "nip", "nama", "nama_gelar",
                "jabatan", "mapel", "aktif", "status_kerja",
                "status_aktivasi", "thp_kotor", "thp_bersih",
                "total_tk_thr", "tk", "thr_bulan"]
        vals = [
            f"(SELECT id FROM units WHERE kode={esc(cabang + '-UMUM')})",
            f"(SELECT id FROM cabangs WHERE kode={esc(cabang)})",
            f"next_nip({esc(yy)})", esc(nama), esc(nama),
            esc(jabatan), esc(mapel), "1", "'aktif'", "'aktif'",
            str(thp_n), str(thp_n), "0", "0", "0"]
        if gender:
            cols.append("gender")
            vals.append(esc(gender))
        if tmt:
            cols += ["tgl_masuk", "tmt_aktif"]
            vals += [esc(tmt), esc(tmt)]

        # NO ACC legacy: HP vs rekening vs teks bank
        hp = norm_hp(no_acc)
        bsi_src = clean_txt(col(r, "norek_bsi", None))
        if hp:
            cols.append("no_hp")
            vals.append(esc(hp))
        if bsi_src:
            cols += ["bank_utama", "norek_utama"]
            vals += ["'BSI'", esc(re.sub(r"\D", "", bsi_src) or bsi_src)]
        elif not hp and clean_txt(no_acc):
            bank_txt, num_txt = parse_bank(no_acc)
            if bank_txt and num_txt:
                cols += ["bank_utama", "norek_utama"]
                vals += [esc(bank_txt), esc(num_txt)]
            elif clean_txt(no_acc):
                cols.append("norek_utama")
                vals.append(esc(str(no_acc).strip()[:60]))
        norek_lain = clean_txt(col(r, "norek_lain", None))
        if norek_lain:
            cols.append("norek_lain")
            vals.append(esc(re.sub(r"\D", "", norek_lain) or norek_lain))
        bank_lain = clean_txt(col(r, "bank_lain", None))
        if bank_lain:
            cols.append("bank_lain")
            vals.append(esc(bank_lain.upper()))

        # NIK KTP (hanya 16 digit valid & unik global)
        raw_nik = col(r, "nik_ktp_src", 2)
        nik_new = norm_nik16(raw_nik)
        if raw_nik and not nik_new:
            review.append((nu, nama, "nik_ktp", raw_nik,
                           "format bukan 16 digit (mungkin no paspor)"))
        elif nik_new:
            if len(nik_cand.get(nik_new, [])) > 1:
                review.append((nu, nama, "nik_ktp", raw_nik,
                               "NIK duplikat di file sumber"))
            else:
                cols.append("nik_ktp")
                vals.append(esc(nik_new))

        # Enrichment 1:1 ---------------------------------------------
        def maybe(key, Sx, parser=None):
            v = col(r, key, None)
            if v is None or (isinstance(v, str) and not v.strip()):
                return None
            if parser:
                return parser(v)
            return clean_txt(v)

        alamat = maybe("alamat", None)
        if alamat:
            cols.append("alamat")
            vals.append(esc(alamat))
        tpl = maybe("tempat_lahir", None)
        if tpl:
            cols.append("tempat_lahir")
            vals.append(esc(tpl))
        tgl_raw = col(r, "tgl_lahir", None)
        if tgl_raw not in (None, ""):
            p = parse_tgl_lahir(tgl_raw)
            if p:
                cols.append("tgl_lahir")
                vals.append(esc(p))
            else:
                review.append((nu, nama, "tgl_lahir", tgl_raw,
                               "format tanggal tidak dikenali"))
        sk = norm_status_kawin(col(r, "status_kawin", None))
        if sk:
            cols.append("status_kawin")
            vals.append(esc(sk))
        elif clean_txt(col(r, "status_kawin", None)):
            review.append((nu, nama, "status_kawin",
                           col(r, "status_kawin", None),
                           "status tidak dikenali"))
        tr = maybe("transport", None)
        if tr:
            cols.append("transport")
            vals.append(esc(tr))
        pos = maybe("posisi", None)
        if pos:
            cols.append("posisi_diajukan")
            vals.append(esc(pos))
        mapel_old = maybe("mapel_old", None)
        if mapel_old and not mapel:
            vals[cols.index("mapel")] = esc(mapel_old)

        pend, peng = [], []

        def jenjang(j, kpt, kprodi, kipk):
            pt = clean_txt(col(r, kpt, None))
            prodi = clean_txt(col(r, kprodi, None))
            iv, iw = parse_ipk(col(r, kipk, None))
            if iw:
                review.append((nu, nama, f"ipk_{j}", col(r, kipk, None), iw))
            if pt or prodi or iv is not None:
                pend.append((j, pt, prodi, iv))

        jenjang("S1", "pt_s1", "prodi_s1", "ipk_s1")
        jenjang("S2", "pt_s2", "prodi_s2", "ipk_s2")
        jenjang("S3", "pt_s3", "prodi_s3", "ipk_s3")
        if norm_jenjang(gelar) and not any(
                p[0] == norm_jenjang(gelar) for p in pend):
            pend.append((norm_jenjang(gelar), None, None, None))

        def pengalaman(u, kd, kg):
            desk = clean_txt(col(r, kd, None))
            gv, gw = parse_money(col(r, kg, None))
            if gw:
                review.append((nu, nama, f"pengalaman_{u}_gaji",
                               col(r, kg, None), gw))
                desk = (f"{desk} [gaji asli: {col(r, kg, None)}]" if desk
                        else f"[gaji asli: {col(r, kg, None)}]")
            if desk or gv is not None:
                peng.append((u, desk, gv))

        pengalaman(1, "peng1", "gaji1")
        pengalaman(2, "peng2", "gaji2")
        pengalaman(3, "peng3", "gaji3")

        gd, gw = parse_money(col(r, "gaji_diajukan", None))
        if gw:
            review.append((nu, nama, "gaji_diajukan",
                           col(r, "gaji_diajukan", None), gw))
        elif gd is not None:
            cols.append("gaji_diajukan")
            vals.append(str(gd))

        tg = parse_tinggi(col(r, "tinggi", None))
        if tg:
            cols.append("tinggi_cm")
            vals.append(str(tg))
        elif clean_txt(col(r, "tinggi", None)):
            review.append((nu, nama, "tinggi_cm", col(r, "tinggi", None),
                           "nilai tidak wajar"))
        br = parse_berat(col(r, "berat", None))
        if br:
            cols.append("berat_kg")
            vals.append(str(br))
        elif clean_txt(col(r, "berat", None)):
            review.append((nu, nama, "berat_kg", col(r, "berat", None),
                           "nilai tidak wajar"))

        email_new = maybe("email", None)
        if email_new:
            email_new = email_new.lower()
            if len(email_cand.get(email_new, [])) > 1:
                review.append((nu, nama, "email", email_new,
                               "email duplikat di file sumber"))
            else:
                cols.append("email")
                vals.append(esc(email_new))

        kes = maybe("kesehatan", None)
        if kes:
            cols.append("kesehatan_url")
            vals.append(esc(kes))
        foto = maybe("foto", None)
        if foto:
            cols.append("foto_url")
            vals.append(esc(foto))

        # ---- tulis INSERT + upsert relasi (pakai id hasil RETURNING) --
        sql.append(f"-- baris #{nu}: {nama}")
        sql.append("DO $$")
        sql.append("DECLARE v_id INT;")
        sql.append("BEGIN")
        sql.append(f"  INSERT INTO employees ({', '.join(cols)}) "
                   f"VALUES ({', '.join(vals)}) RETURNING id INTO v_id;")
        for j, pt, prodi, iv in pend:
            ic = "employee_id, jenjang"
            ivl = f"v_id, {esc(j)}"
            upd = []
            if pt:
                ic += ", perguruan_tinggi"
                ivl += f", {esc(pt)}"
                upd.append(f"perguruan_tinggi = {esc(pt)}")
            if prodi:
                ic += ", prodi"
                ivl += f", {esc(prodi)}"
                upd.append(f"prodi = {esc(prodi)}")
            if iv is not None:
                ic += ", ipk"
                ivl += f", {iv}"
                upd.append(f"ipk = {iv}")
            sql.append(f"  INSERT INTO pendidikan ({ic}) VALUES ({ivl}) "
                       f"ON CONFLICT (employee_id, jenjang) DO " +
                       (f"UPDATE SET {', '.join(upd)};" if upd
                        else "NOTHING;"))
            n_pend += 1
        for u, desk, gv in peng:
            ic, ivl, upd = "employee_id, urutan", f"v_id, {u}", []
            if desk is not None:
                ic += ", deskripsi"
                ivl += f", {esc(desk)}"
                upd.append(f"deskripsi = {esc(desk)}")
            if gv is not None:
                ic += ", salary"
                ivl += f", {gv}"
                upd.append(f"salary = {gv}")
            sql.append(f"  INSERT INTO pengalaman ({ic}) VALUES ({ivl}) "
                       f"ON CONFLICT (employee_id, urutan) DO " +
                       (f"UPDATE SET {', '.join(upd)};" if upd
                        else "NOTHING;"))
            n_peng += 1
        sql.append("END $$;")
        n_ins += 1

    sql.append("COMMIT;")
    print("\n".join(sql))

    review_out = (args.review_out or
                  re.sub(r"\.xlsx?$", "", args.xlsx, flags=re.I) +
                  "_REVIEW_MANUAL.csv")
    with open(review_out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["nu", "nama", "field", "nilai_asli", "alasan"])
        for row in review:
            w.writerow([str(x).replace('"', "'") if x is not None else ""
                        for x in row])
    print(f"insert={n_ins} pendidikan_upsert={n_pend} pengalaman_upsert={n_peng} "
          f"review={len(review)} -> {review_out}", file=sys.stderr)


if __name__ == "__main__":
    main()
