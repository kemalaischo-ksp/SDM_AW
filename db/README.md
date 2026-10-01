# HR 3.0 — DB Pilot AW3 BSD City

## Isi folder

| File | Fungsi |
|---|---|
| `migrations/001_hr30_pilot_aw3.sql` | DDL inti: `cabangs`, perluasan `employees`, `pendidikan`, `pengalaman`, `aktivasi_logs`, stub `absensi`+`cuti` |
| `migrations/002_nip_sequence.sql` | Sequence NIP `YYNNNN` + fungsi `next_nip('26')` |
| `seeds/aw3_pilot.sql` | 2 karyawan sampel ternormalisasi (Muthy aktif, Faqih diajukan) |
| `scripts/biodata_template.csv` | Template biodata (contoh = 2 sampel valid) |
| `scripts/aktivasi_template.csv` | Template aktivasi (contoh = 2 sampel valid) |
| `scripts/validate_import.py` | Validator stdlib-only: `python3 validate_import.py biodata.csv aktivasi.csv` |
| `migrations/011_enrichment_sdm.sql` | Kolom `employees.gender`, jenjang `pendidikan` SMA/D1-D4, cabang non-fisik (HOLDING/YAYASAN/LINTAS), unit `*-UMUM` per cabang |
| `scripts/import_sdm.py` | Generator SQL import SDM dari Excel cleansing (butuh `openpyxl`) |
| `scripts/import_sdm.sh` | Orkestrasi satu langkah: koneksi → migrate → validasi → backup → import |

## Cara pakai

**Fresh pilot:**
```bash
psql -d sim_hr -f <HR2/schema.pg.sql> -f migrations/001_hr30_pilot_aw3.sql \
  -f migrations/002_nip_sequence.sql -f seeds/aw3_pilot.sql
```

**Upgrade DB 2.0 yang sudah ada:** hanya `001` + `002` (tanpa seed).

**Import batch:** isi CSV dari template → `python3 validate_import.py ...` (exit 0 = valid).
Baris tidak balance **ditolak**, bukan dibetulkan diam-diam.

## Import SDM otomatis (file cleansing Excel)

Satu perintah, dari folder `api` (butuh `psql`, `pg_dump`, `python3 + openpyxl`):

```bash
npm run import:sdm -- "<file.xlsx>" [--replace]
```

Tahapan: cek koneksi → `migrate.js` (termasuk `011`) → validasi isi →
backup `pg_dump` → import dalam satu transaksi. Sheet terdeteksi otomatis:
`Clean_Enriched` (46 kolom, bila ada) atau `Clean` (11 kolom dasar).

- **Tanpa `--replace` (default, fail-closed):** ABORT bila sudah ada data
  SDM riil. Baris referensi atasan (NIP `900xxx`, migrasi 010) tidak dihitung.
- **Dengan `--replace`:** backup otomatis ke `db/backup/`, lalu hapus semua
  baris KECUALI referensi atasan `900xxx` (termasuk payroll & dokumen milik
  baris yang diganti; tabel anak ber-cascade ikut terhapus), lalu insert penuh
  1.658 baris: NIP `YYNNNN` via `next_nip()` dari THN AKTIF, NO ACC dipisah
  HP vs rekening, NIK 16-digit & email di-dedup global, THP → kotor=bersih,
  pendidikan S1-S3 + pengalaman 1-3 ke tabel relasi.
- **Nilai ambigu tidak ditebak** — dicatat ke
  `db/backup/<waktu>_<file>_REVIEW_MANUAL.csv` untuk verifikasi HR
  (rentang gaji, IPK skala campuran, NIK duplikat/paspor, email ganda,
  tanggal lahir rusak).

## Verifikasi yang sudah dilakukan (PostgreSQL 16 lokal)

- Fresh install + seed: OK, 2 baris balance (`4115200 = 4500000-384800`, dst.)
- `next_nip('26')` → `260003`: OK
- Insert THP tidak balance: DITOLAK `chk_emp_thp_balance`: OK
- Migrasi idempoten (rerun aman): OK
- Upgrade path dengan NIP lama 12 digit: OK (`nama_gelar` ter-backfill)

## Blocker sebelum produksi

Nomor urut NIP 2026 aktual dari HR belum diketahui — seed memakai `260001/260002`
sementara. Sesuaikan `nip_sequences` + NIP bila HR memberi angka terakhir.
