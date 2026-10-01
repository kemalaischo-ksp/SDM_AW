#!/usr/bin/env python3
"""Validasi template migrasi HR 3.0 (stdlib only, tanpa dependensi).

Pakai:
  python3 validate_import.py biodata_template.csv aktivasi_template.csv

Aturan (dari Analisis_Sample_Karyawan_dan_Template_Migrasi.md):
- NIP unik, format YYNNNN (6 digit). NIP lama >=6 digit masih diterima DB
  tapi DITOLAK di import baru (harus 6 digit).
- Nama resmi = nama_gelar; selisih ejaan antar file ditolak.
- tgl_lahir/tmt_aktif ISO YYYY-MM-DD; no_hp kanonis 628...; nominal angka bulat.
- aktivasi: thp_bersih = thp_kotor - total_tk_thr dan total = tk + thr.
  Baris tidak balance DITOLAK (bukan dibetulkan diam-diam).
- NIP di aktivasi harus ada di biodata.
Keluar: exit 0 bila semua valid, exit 1 + daftar error bila ada yang ditolak.
"""
import csv
import re
import sys
from datetime import date

NIP_RE = re.compile(r"^[0-9]{6}$")
NIK_RE = re.compile(r"^[0-9]{16}$")
HP_RE = re.compile(r"^628[0-9]{8,14}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def canon_hp(v: str) -> str:
    v = (v or "").strip()
    v = re.sub(r"^https?://wa\.me/", "", v)  # wa.me/0858.. atau wa.me/628..
    v = v.replace("+", "").replace(" ", "").replace("-", "")
    if v.startswith("085"):
        v = "628" + v[3:]
    elif v.startswith("08"):
        v = "628" + v[2:]
    return v


def canon_int(v: str, field: str, errors: list, rowno: int) -> int | None:
    s = re.sub(r"[^0-9]", "", v or "")
    if not s:
        errors.append(f"baris {rowno}: {field} kosong/bukan angka: {v!r}")
        return None
    return int(s)


def parse_iso(v: str, field: str, errors: list, rowno: int):
    v = (v or "").strip()
    if not v:
        return None
    if not DATE_RE.match(v):
        errors.append(f"baris {rowno}: {field} harus YYYY-MM-DD, dapat {v!r}")
        return None
    try:
        y, m, d = map(int, v.split("-"))
        return date(y, m, d)
    except ValueError:
        errors.append(f"baris {rowno}: {field} tanggal tak valid: {v!r}")
        return None


def main(biodata_path: str, aktivasi_path: str) -> int:
    errors: list[str] = []
    bio: dict[str, dict] = {}

    with open(biodata_path, newline="", encoding="utf-8-sig") as f:
        for i, r in enumerate(csv.DictReader(f), start=2):
            nip = (r.get("nip") or "").strip()
            if not NIP_RE.match(nip):
                errors.append(f"biodata baris {i}: nip harus YYNNNN 6 digit, dapat {nip!r}")
                continue
            if nip in bio:
                errors.append(f"biodata baris {i}: nip duplikat {nip}")
                continue
            hp = canon_hp(r.get("no_hp", ""))
            if not HP_RE.match(hp):
                errors.append(f"biodata baris {i}: no_hp tidak valid setelah kanonisasi: {hp!r}")
            nik = (r.get("nik_ktp") or "").strip()
            if not NIK_RE.match(nik):
                errors.append(f"biodata baris {i}: nik_ktp harus 16 digit, dapat {nik!r}")
            parse_iso(r.get("tgl_lahir", ""), "tgl_lahir", errors, i)
            if not (r.get("nama_gelar") or "").strip():
                errors.append(f"biodata baris {i}: nama_gelar wajib")
            if not (r.get("email") or "").strip():
                errors.append(f"biodata baris {i}: email wajib")
            if not (r.get("norek_utama") or "").strip():
                errors.append(f"biodata baris {i}: norek_utama wajib")
            canon_int(r.get("gaji_diajukan", ""), "gaji_diajukan", errors, i)
            bio[nip] = r

    with open(aktivasi_path, newline="", encoding="utf-8-sig") as f:
        for i, r in enumerate(csv.DictReader(f), start=2):
            nip = (r.get("nip") or "").strip()
            if nip not in bio:
                errors.append(f"aktivasi baris {i}: nip {nip!r} tidak ada di biodata")
                continue
            kotor = canon_int(r.get("thp_kotor", ""), "thp_kotor", errors, i)
            bersih = canon_int(r.get("thp_bersih", ""), "thp_bersih", errors, i)
            total = canon_int(r.get("total_tk_thr", ""), "total_tk_thr", errors, i)
            tk = canon_int(r.get("tk", ""), "tk", errors, i)
            thr = canon_int(r.get("thr_bulan", ""), "thr_bulan", errors, i)
            if None not in (kotor, bersih, total, tk, thr):
                if bersih != kotor - total:
                    errors.append(
                        f"aktivasi baris {i} (nip {nip}): DITOLAK thp_bersih {bersih} != "
                        f"thp_kotor {kotor} - total {total}"
                    )
                if total != tk + thr:
                    errors.append(
                        f"aktivasi baris {i} (nip {nip}): DITOLAK total {total} != "
                        f"tk {tk} + thr {thr}"
                    )
            tmt = (r.get("tmt_aktif") or "").strip()
            if tmt:
                parse_iso(tmt, "tmt_aktif", errors, i)
            mode = (r.get("mode_thp") or "").strip()
            if mode and mode not in ("FULL", "PRORATA"):
                errors.append(f"aktivasi baris {i}: mode_thp harus FULL/PRORATA, dapat {mode!r}")

    if errors:
        print(f"DITEMUKAN {len(errors)} ERROR — semua baris terkait DITOLAK:")
        for e in errors:
            print(" -", e)
        return 1
    print(f"OK: {len(bio)} biodata valid, aktivasi balance.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
