# HR 3.0 — Web UI Pilot AW3 (Vite + React + Tailwind + shadcn-style)

Tema biru-putih AL-WILDAN, logo `src/assets/logo.png` (dari `HR 3.0/AL-WILDAN.png`).

## Jalankan

```bash
cd "HR 3.0/web"
npm install
npm run dev        # http://localhost:5173
npm run build      # output dist/ → diserve backend Hono (gantikan public/ lama)
```

## Mode data

- Default (**tanpa** `VITE_API_URL`): **mode demo** — data mock 2 sampel AW3
  (`src/lib/api.ts` → `MOCK_EMPLOYEES`), login apa pun lolos.
- Produksi: salin `.env.example` ke `.env`, isi `VITE_API_URL=http://127.0.0.1:3000`,
  sediakan di backend: `POST /api/login`, `GET /api/employees`,
  `POST /api/employees/:id/activate` (status: `diajukan_finance` →
  `diverifikasi_doni` → `aktif`).

## Halaman

| Rute | Isi |
|---|---|
| `/login` | Split art navy + card login |
| `/` | Dashboard: KPI aktif/pending/total THP + daftar perlu perhatian |
| `/karyawan` | Tabel + pencarian (nama/NIP/posisi) |
| `/karyawan/:nip` | Tab Biodata · Aktivasi THP (cek balance ✓/✗, tolak bila tak balance) · Workflow 3-tahap |
| `/payroll` | Rekap THP aktif periode berjalan |
| `/presensi` | Presensi mandiri karyawan (selfie + GPS + radius kantor, masuk/pulang + riwayat 30 hari) |
| `/cuti` | Pengajuan + persetujuan (HR/atasan) + saldo + riwayat (jenis: tahunan/sakit/keluarga/tugas luar/terlambat/melahirkan/lainnya) |
| `/pengajuan` | Tab lembur, reimbursement, surat, ubah-data, koreksi presensi (ajukan + setujui HR/atasan) |
| `/laporan` | Rekap presensi harian/mingguan/bulanan (+telat, pulang cepat, tidak hadir, lembur), karyawan, saldo cuti, payroll + unduh CSV + cetak/PDF |
| `/kinerja` | Penilaian KPI (HR input skor 1–5 + target + rencana kembang; pegawai lihat miliknya) |
| `/notifikasi` | Notifikasi pribadi + pengumuman perusahaan (terbit/arsip HR) |
| `/pengaturan` | Aturan jam kerja, titik & radius kantor, jatah cuti (master_admin) |
| `/profil` | Profil Saya (pegawai: data, rekening, dokumen sudah/belum, riwayat, kontrak, evaluasi) |
| `/karyawan/:nip` | + Tab Data kerja (atasan, tgl masuk, masa kerja, status, foto + unggah) · Riwayat jabatan/gaji · Dokumen (unggah fisik/buka arsip + kedaluwarsa) · Onboarding |
| `/pengguna` | + Tombol Undang (sandi sementara via email/WA) |
| `/pengaturan` | + Kredensial SMTP & gateway WA (rahasia tersamar) |
| `/slip/:nip` | Slip printable (tanpa NIK & norek — sensitif) |

## Komponen `src/components/ui/`

`button`, `card`, `badge` (+ `STATUS_BADGE/LABEL`), `input` (`Input/Label/Field/Select`),
`table`, `tabs` (+ `Skeleton`, `Separator`) — pola shadcn, token di `src/index.css`
(`@theme`: primary `#1D4ED8`, sidebar navy `#0B1E47`, font Plus Jakarta Sans + Inter).

## Catatan backend

Saat `dist/` diserve Hono, tambahkan **SPA fallback** (`GET /karyawan*` → `dist/index.html`)
agar refresh di rute client tidak 404.
