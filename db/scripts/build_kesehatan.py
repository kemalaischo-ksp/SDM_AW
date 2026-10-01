#!/usr/bin/env python3
"""Build sdm-v31/kesehatan.js dari xlsx Google Form "PENDATAAN RIWAYAT KESEHATAN".

Data form kotor → dedupe per nama (respons terbaru) → dicocokkan ke nama SDM di
sdm-v31/data.js (exact / fuzzy / review). Hasil dibaca frontend sebagai
window.HEALTH_Q + window.HEALTH_DATA. File output berisi PII kesehatan →
JANGAN di-commit (sudah di .gitignore); kirim ke VPS via scp seperti data.js.

Pakai (dari root repo):
  python3 db/scripts/build_kesehatan.py ["path/ke/form.xlsx"]
"""
import difflib
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
XLSX = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "2. troubleshooting" / "PENDATAAN RIWAYAT KESEHATAN_R (Respons) (1).xlsx"
DATA_JS = ROOT / "sdm-v31" / "data.js"
OUT = ROOT / "sdm-v31" / "kesehatan.js"

# kolom xlsx (0-based)
C_TS, C_PHOTO, C_NAMA, C_GENDER, C_BB, C_TB = 0, 2, 3, 4, 5, 6
C_KD_NAMA, C_KD_HUB, C_KD_ALAMAT, C_KD_TELP = 8, 9, 10, 11
Q_FIRST, Q_LAST = 12, 59          # 48 pertanyaan YA/TIDAK
C_KET, C_DOC = 60, 62
Q_ALERGI = 13 - Q_FIRST           # "Riwayat reaksi atas obat, makanan, atau sengatan"
Q_KELUARGA = 12 - Q_FIRST         # "Riwayat penyakit dalam keluarga"

# label pendek untuk 48 pertanyaan (urutan = kolom 12..59)
HEALTH_Q = [
    "Riwayat penyakit keluarga", "Alergi obat/makanan/sengatan", "Gatal/flu musiman",
    "Kelemahan motorik/sensorik", "Lemah otot/lumpuh", "Pusing berputar",
    "Sakit kepala/migrain", "Epilepsi/kejang", "Pingsan", "Tumor/kista/benjolan",
    "Masalah gigi/gusi", "Tekanan darah >130/90", "Nyeri dada", "Dada terasa ditekan",
    "Berdebar-debar", "Terengah saat aktivitas", "Ke spesialis jantung",
    "Batuk kronis >3 bulan", "Sesak/mengi", "Diabetes/gula darah",
    "Masalah pencernaan/empedu", "Muntah darah", "Wasir/BAB berdarah",
    "Gangguan saluran kencing", "Nafsu makan turun", "Gangguan mata",
    "Kacamata/lensa kontak", "Pendengaran turun", "Gagap", "Flu berkepanjangan",
    "Tenggorokan/gondok", "Gangguan organ reproduksi (L)", "Gangguan mens/payudara (P)",
    "Cairan/nyeri kemaluan", "Masalah kulit menahun", "Ke dokter kulit kelamin",
    "Luka baru", "Gangguan sendi", "Gangguan tulang/retak", "Pen/pelat pada tulang",
    "Sakit punggung/leher", "Pendarahan/kelainan darah", "Luka kepala/gegar otak",
    "Pernah operasi", "Ke psikolog/psikiater", "Sulit fokus bekerja",
    "Cemas berlebihan", "Penyakit lain (termasuk Covid-19)",
]
assert len(HEALTH_Q) == Q_LAST - Q_FIRST + 1

GELAR = re.compile(
    r"\b(prof|dr|drs|dra|ir|hj|h|ust|ustadz|ustadzah|lc|ma|amd|amk|bsc|bba|ba|mm|msi|"
    r"s\s?pd\s?i?|s\s?ag|s\s?h\s?i?|s\s?e\s?i?|s\s?kom|s\s?si|s\s?psi|s\s?sos|s\s?ip|s\s?s|s\s?t|"
    r"s\s?ak|s\s?hum|s\s?kep|s\s?km|s\s?farm|s\s?gz|s\s?ked|s\s?th\s?i|s\s?sy|s\s?ikom|s\s?ds|s\s?tr|"
    r"m\s?pd\s?i?|m\s?ag|m\s?si|m\s?m|m\s?e\s?sy|m\s?ed|m\s?h\s?i?|m\s?a|m\s?kom|m\s?psi|m\s?sc|"
    r"m\s?hum|a\s?md|b\s?a)\b"
)


def norm(n):
    n = str(n or "").lower().split(",")[0]
    n = re.sub(r"[^a-z ]", " ", n)
    n = GELAR.sub(" ", n)
    return " ".join(n.split())


def txt(v):
    s = "" if v is None else str(v).strip()
    return "" if s.lower() in ("none", "nan", "-", "0", "0.0") else s


def num(v):
    s = txt(v)
    try:
        f = float(s.replace(",", "."))
        return str(int(f)) if f == int(f) else str(f)
    except ValueError:
        return s


def phone(v):
    """No. HP: xlsx sering menyimpan sbg angka → nol depan hilang (8133… → 08133…)."""
    s = num(v)
    d = re.sub(r"[^\d+]", "", s)
    if d.startswith("8"):
        d = "0" + d
    return d or s


def gender_of(v):
    s = txt(v).lower()
    return "P" if s.startswith("p") or "wanita" in s else ("L" if s.startswith("l") or "pria" in s else "")


def score(a, b):
    """(skor 0..1, skor_kuat). Skor = max(ratio, token-sort, subset token);
    skor_kuat hanya dari ratio/token-sort — subset saja tidak cukup untuk auto-cocok."""
    if not a or not b:
        return 0.0, 0.0
    r1 = difflib.SequenceMatcher(None, a, b).ratio()
    r2 = difflib.SequenceMatcher(None, " ".join(sorted(a.split())), " ".join(sorted(b.split()))).ratio()
    ta, tb = set(a.split()), set(b.split())
    small, big = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    r3 = 0.0
    if len(small) >= 2 and small <= big:
        r3 = 0.93 if a.split()[0] == b.split()[0] else 0.9
    return max(r1, r2, r3), max(r1, r2)


def load_emp():
    t = DATA_JS.read_text(encoding="utf-8")
    emp = json.loads(t[t.index("["): t.rindex("]") + 1])
    return [e for e in emp if e.get("nama")]


def main():
    emp = load_emp()
    E = [(norm(e["nama"]), e) for e in emp]
    by_norm = {}
    for n, e in E:
        by_norm.setdefault(n, []).append(e)

    ws = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)["Form Responses 1"]
    rows = [r for r in list(ws.iter_rows(values_only=True))[1:] if len(r) > C_NAMA and txt(r[C_NAMA])]
    latest = {}
    for r in rows:
        k = norm(r[C_NAMA])
        if k and (k not in latest or str(r[C_TS]) > str(latest[k][C_TS])):
            latest[k] = r

    out, stat = [], {"exact": 0, "fuzzy": 0, "review": 0, "tanpa_kandidat": 0}
    for i, (k, r) in enumerate(sorted(latest.items(), key=lambda kv: kv[0])):
        g = gender_of(r[C_GENDER])
        scored = []
        for n, e in E:
            s, strong = score(k, n)
            if s < 0.6:
                continue
            eg = gender_of(e.get("gender"))
            if g and eg:
                adj = 0.02 if g == eg else -0.05
                s, strong = s + adj, strong + adj
            scored.append((min(s, 1.0), e, strong))
        scored.sort(key=lambda x: -x[0])
        cands = [{"id": str(e["id"]), "s": round(s, 3)} for s, e, _ in scored[:3]]

        emp_id, match = "", "review"
        exact = by_norm.get(k, [])
        if len(exact) == 1:
            emp_id, match = str(exact[0]["id"]), "exact"
        elif not exact and scored and scored[0][2] >= 0.92 and (len(scored) < 2 or scored[1][0] < scored[0][0] - 0.04):
            emp_id, match = str(scored[0][1]["id"]), "fuzzy"
        stat[match] += 1
        if match == "review" and not cands:
            stat["tanpa_kandidat"] += 1

        yes = [q for q in range(Q_LAST - Q_FIRST + 1) if txt(r[Q_FIRST + q]).upper() == "YA"]
        ts = txt(r[C_TS])[:10]
        out.append({
            "hid": f"h{i + 1}",
            "nama": txt(r[C_NAMA]),
            "ts": ts,
            "gender": g,
            "bb": num(r[C_BB]),
            "tb": num(r[C_TB]),
            "kd": {"nama": txt(r[C_KD_NAMA]), "hub": txt(r[C_KD_HUB]), "telp": phone(r[C_KD_TELP]), "alamat": txt(r[C_KD_ALAMAT])},
            "y": yes,
            "ket": txt(r[C_KET]) if len(r) > C_KET else "",
            "doc": txt(r[C_DOC]) if len(r) > C_DOC else "",
            "photo": txt(r[C_PHOTO]),
            "empId": emp_id,
            "match": match,
            "cands": cands,
        })

    js = (
        "// AUTO-GENERATED oleh db/scripts/build_kesehatan.py — berisi PII kesehatan, JANGAN di-commit.\n"
        f"window.HEALTH_Q={json.dumps(HEALTH_Q, ensure_ascii=False)};\n"
        f"window.HEALTH_QI={{alergi:{Q_ALERGI},keluarga:{Q_KELUARGA}}};\n"
        f"window.HEALTH_DATA={json.dumps(out, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    OUT.write_text(js, encoding="utf-8")
    print(f"Respons form: {len(rows)} · nama unik: {len(latest)} · karyawan SDM: {len(emp)}")
    print(f"Cocok pasti: {stat['exact']} · mirip kuat: {stat['fuzzy']} · perlu review: {stat['review']} "
          f"(tanpa kandidat: {stat['tanpa_kandidat']})")
    print(f"→ {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
