# Analisis Sample Karyawan & Template Migrasi Data

> Sumber: `3. SAMPLE KARYAWAN/` — 2 file:
> - `AKTIVASI - Muhammad Muthy Abdullah, S.Pd. - AW3.pdf`
> - `Al-Wildan 3 BSD City_Faqih Ahmad Rizki _Diniyyah.pdf`
>
> Keputusan yang dikunci:
> - **NIP** = 2 digit tahun masuk + nomor urut masuk di tahun itu, diinput HR.
> - **Aktivasi payroll** = finance input → Doni verifikasi → Kemal setuju.

---

## 1. Struktur data di 2 PDF sample

Kedua file berpola sama (formulir biodata + lembar aktivasi):

| Kelompok | Field yang ada |
|---|---|
| Identitas | Nama + gelar, email, tanggal pengisian, No HP (link wa.me), NIK KTP, alamat domisili, tempat/tanggal lahir, usia, status kawin, transport, tinggi/berat badan |
| Lamaran | Posisi diajukan, mata pelajaran (cth. Diniyyah), unit (SMP-SMA), cabang |
| Pendidikan | S1 (perguruan tinggi, prodi, IPK); S2, S3 (kosong di sample) |
| Pengalaman | s.d. 3 riwayat + nominal salary masing-masing |
| Gaji | Gaji yang diajukan; Rek BSI + rekening lain sementara + nama bank lain |
| **Blok AKTIVASI (diisi pusat)** | Status + TMT (cth. "Aktif 31 August 2026, THP BERSIH FULL"); tabel: NAMA \| THP KOTOR \| KONFIRMASI \| THP BERSIH \| TOTAL (TK-THR) \| TK \| THR/bulan; kontak; link CV (Drive) + link kesehatan (Docs); kode arsip `AW/LM/kem/21-22/Arsip SDM` |

**Temuan penting:** blok aktivasi ini pasangan 1:1 dengan kolom `employees`
di sim-hr-postgres (`thp_kotor, thp_bersih, total_tk_thr, tk, thr_bulan,
konfirmasi, cv_url, kesehatan_url, aktif`) dan endpoint
`POST /api/employees/:id/activate` — jadi alur "pusat input → finance
aktivasi payroll" memang sudah didukung backend, tinggal dipakai.

### Contoh angka (terverifikasi balance)

- Muhammad Muthy Abdullah: THP kotor 4.500.000 − total (TK-THR) 384.800
  = THP bersih 4.115.200 ✓ ; TK 184.800 + THR/bulan 200.000 = 384.800 ✓
- Faqih Ahmad Rizki: THP kotor 6.384.800, konfirmasi "Akan
  dipertimbangkan", THP bersih 6.000.000, total 384.800
  (TK 184.800 + THR 200.000) ✓

---

## 2. Masalah kualitas data (harus ditangani template)

- Ejaan nama tidak konsisten: file "Faqih Ahmad **Rizki**" vs tabel
  aktivasi "Faqih Ahmad **Rizky**" — penentu nama resmi harus satu sumber.
- Format tanggal campur: `10-12-1999`, `24 Februari 1997`,
  `Mon Aug 31 2026 00:00:00 GMT+0700`.
- No HP berupa link `wa.me/085886593150` (ada yang masih format `0858…`,
  ada `62858…`).
- Nominal berupa teks `Rp. 4.550.000,-` — harus dinormalisasi ke angka.
- S2/S3 kosong (nullable, wajar).

---

## 3. Template migrasi (1 file Excel, 3 sheet)

### Sheet `biodata` — diisi HR pusat/Doni, 1 baris per karyawan

| Kolom | Wajib | Aturan |
|---|---|---|
| nip | Ya (HR) | Format `YYNNNN`: 2 digit tahun masuk + urut masuk tahun itu, zero-pad 4 digit (cth. masuk 2026 urutan 1 → `260001`); unik, tidak boleh diubah setelah aktif |
| nama_gelar, nama_ktp | Ya | Nama resmi = `nama_gelar`; selisih ejaan ditolak saat validasi |
| email, no_hp | Ya | no_hp dinormalisasi ke `628…` (tanpa link) |
| nik_ktp | Ya | 16 digit, unik; **tidak tampil di slip/laporan** (sensitif) |
| alamat, tempat_lahir, tgl_lahir (YYYY-MM-DD) | Ya | Tanggal ISO, usia dihitung sistem |
| status_kawin, transport | Opsional | — |
| cabang (AW3…), unit (SD/SMP/SMA/Boarding), posisi_diajukan, mapel | Ya | Kode standar sesuai SO |
| pend_s1_pt, pend_s1_prodi, pend_s1_ipk (+S2/S3, opsional) | S1 wajib | IPK desimal 0–4 |
| pengalaman_1..3 + salary_1..3 | Opsional | Salary angka bulat |
| gaji_diajukan | Ya | Angka bulat |
| bank_utama, norek_utama, bank_lain, norek_lain | Utama wajib | — |

### Sheet `aktivasi` — diisi finance cabang, dikunci ke NIP yang sudah ada di `biodata`

`nip | thp_kotor | konfirmasi | thp_bersih | total_tk_thr | tk | thr_bulan | tmt_aktif (YYYY-MM-DD) | mode_thp (FULL/PRORATA) | cv_url | kesehatan_url | kode_arsip`

Validasi otomatis: `thp_bersih = thp_kotor − total_tk_thr` dan
`total_tk_thr = tk + thr_bulan`. Baris yang tidak balance **ditolak**,
bukan dibetulkan diam-diam.

### Sheet `petunjuk` — daftar kode cabang/unit, format tanggal, contoh 1 baris valid.

---

## 4. Alur aktivasi

```
HR pusat input biodata (status: draft/nonaktif, NIP terbit)
   → Finance cabang isi sheet aktivasi / form aktivasi (blok THP + TMT)
   → Doni verifikasi (cek balance THP + kelengkapan)
   → Kemal setuju → status Aktif, masuk payroll periode berjalan
```

Ini = workflow `rekrutmen/aktivasi` (pimpinan → Doni → Kemal),
dengan tahap finance sebagai penginput.

---

## 5. Gap schema yang harus ditambah saat implementasi

Kolom baru di `employees`: `nik_ktp, alamat, tempat_lahir, tgl_lahir,
status_kawin, no_hp, mapel, posisi_diajukan, gaji_diajukan, bank_lain,
norek_lain, tmt_aktif, mode_thp, nip` (sebagai identitas tampil), plus
tabel `pendidikan` dan `pengalaman` (1:N per karyawan). Link CV/kesehatan
tetap URL Drive tahap awal, migrasi ke Nextcloud menyusul.

Rencana implementasi: (1) tambah kolom/tabel + endpoint aktivasi 3-tahap +
notifikasi Doni/Kemal; (2) skrip import template Excel → validasi → draft;
(3) uji dengan 2 sample ini sebagai data uji pertama (NIP mis. `260001`,
`260002` bila urutan 1–2 tahun 2026 — konfirmasi nomor urut aktualnya ke HR).

**Keputusan yang masih terbuka:** nomor urut NIP tahun berjalan saat ini
sudah sampai berapa (agar sequence tidak tabrakan dengan NIP lama), dan
apakah NIP lama dengan format berbeda ikut dinormalisasi.
