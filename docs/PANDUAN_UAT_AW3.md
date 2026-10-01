# Panduan UAT HRIS Pilot AW3 (untuk HR cabang, Doni, Kemal)

> Lingkungan: staging (data riil AW3 hasil import, BUKAN produksi).
> Waktu: ±1 jam. Hasil: centang + tanda tangan di bawah.

## Persiapan (engineer, sebelum UAT)

- [ ] DB staging = baseline + 001 + 002, `nip_sequences` = angka final dari HR.
- [ ] Import CSV riil AW3 lolos `validate_import.py` (exit 0).
- [ ] Akun: 1 HR cabang (finance), Doni (`master_admin`), Kemal (`master_admin`).

## Skenario (centang bila sesuai harapan)

| # | Pelaku | Langkah | Harapan | ✓ |
|---|---|---|---|---|
| 1 | Finance | Login, buka karyawan diajukan, isi blok THP Faqih, **Simpan (Finance)** | Status → Diajukan Finance | |
| 2 | Doni | Buka pengajuan, cek angka, **Verifikasi (Doni)** | Status → Verifikasi Doni | |
| 3 | Kemal | Buka hasil verifikasi, **Setujui & Aktifkan** + TMT | Status → Aktif, masuk payroll | |
| 4 | Finance | Isi THP bersih ngawur, Simpan | **DITOLAK** + pesan jelas, data tak berubah | |
| 5 | HR | Buka karyawan cabang lain (bila ada) | **403** Bukan cabang Anda | |
| 6 | Semua | Buka slip gaji karyawan aktif, cetak | Angka = THP bersih; tanpa NIK/norek | |

## Tanda tangan

| Peran | Nama | Tanggal | TTD |
|---|---|---|---|
| HR cabang AW3 | | | |
| Doni (verifikator) | | | |
| Kemal (pimpinan) | | | |

Lolos semua → lanjut M5 (freeze + go/no-go). Ada yang gagal → catat di bawah,
kembalikan ke engineer, UAT diulang untuk skenario itu saja.

### Catatan kegagalan (bila ada)

-
