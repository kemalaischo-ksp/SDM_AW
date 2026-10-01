import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, STATUS_BADGE, STATUS_LABEL } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, bisa, type Employee, type SessionUser } from "../lib/api";
import { rupiah } from "../lib/format";

const F_AWAL = {
  nama_gelar: "", email: "", no_hp: "", posisi_diajukan: "", mapel: "",
  cabang: "", unit_id: "", atasan_id: "", cabang_lainnya: "",
  nip: "", nik_ktp: "", alamat: "", tempat_lahir: "", tgl_lahir: "",
  status_kawin: "", gender: "", transport: "", gaji_diajukan: "", bank_utama: "BSI",
  norek_utama: "", bank_lain: "", norek_lain: "",
};

interface UnitOpt { id: number; nama: string; kode: string; cabang: string | null; cabang_nama: string | null }

export function KaryawanList() {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Employee[] | null>(null);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [f, setF] = useState(F_AWAL);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragAktif, setDragAktif] = useState(false);
  const [namaBerkas, setNamaBerkas] = useState<string | null>(null);
  const [arsipNama, setArsipNama] = useState<string | null>(null);
  const [cvLink, setCvLink] = useState<string | null>(null);
  const [pend, setPend] = useState({ pt: "", prodi: "", ipk: "" });
  const [peng, setPeng] = useState({ p1: "", s1: "", p2: "", s2: "", p3: "", s3: "" });
  const [peringatan, setPeringatan] = useState<string[]>([]);

  const muat = () => api.employees().then(setData).catch((e) => toast(e.message));
  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    muat();
  }, []); // eslint-disable-line

  const bolehTambah = bisa(me, "karyawan.tambah");
  const bolehAkun = bisa(me, "users.kelola");
  const [akunEmp, setAkunEmp] = useState<Employee | null>(null);
  const [fCabang, setFCabang] = useState("");

  const bukaForm = () => {
    api.units().then(setUnits).catch(() => setUnits([]));
    setShowForm(true);
  };

  const cocokUnit = (nama: string, daftar: { id: number; nama: string }[]) => {
    const n = nama.toLowerCase().replace(/[^a-z]/g, "");
    return daftar.find((u) => {
      const m = u.nama.toLowerCase().replace(/[^a-z]/g, "");
      return m === n || m.includes(n) || n.includes(m);
    })?.id;
  };

  const cabangDariDaftar = (daftar: UnitOpt[]) => {
    const peta = new Map<string, string>();
    for (const u of daftar) {
      if (u.cabang && !peta.has(u.cabang)) peta.set(u.cabang, u.cabang_nama || u.cabang);
    }
    return [...peta.entries()].map(([kode, nama]) => ({ kode, nama }));
  };

  const cocokCabangDi = (daftar: UnitOpt[], nama: string) => {
    const n = nama.toLowerCase().replace(/[^a-z0-9]/g, "");
    return cabangDariDaftar(daftar).find((c) => {
      const k = c.kode.toLowerCase();
      const m = c.nama.toLowerCase().replace(/[^a-z0-9]/g, "");
      return m === n || m.includes(n) || n.includes(m) || n.includes(k);
    })?.kode;
  };

  // Daftar cabang unik dari units (kode + nama). LAINNYA selalu terakhir.
  const daftarCabang = useMemo(() => {
    const semua = cabangDariDaftar(units);
    return semua.sort((a, b) => (a.kode === "LAIN" ? 1 : b.kode === "LAIN" ? -1 : a.kode.localeCompare(b.kode)));
  }, [units]);

  const unitsCabang = useMemo(
    () => (f.cabang ? units.filter((u) => u.cabang === f.cabang) : []),
    [units, f.cabang]
  );

  // Calon atasan = karyawan yang sudah ada di cabang yang sama.
  const atasanCabang = useMemo(() => {
    if (!data || !f.cabang) return [];
    return data.filter((e) => e.cabang === f.cabang);
  }, [data, f.cabang]);

  const pilihCabang = (kode: string) => {
    setF((s) => ({ ...s, cabang: kode, unit_id: "", atasan_id: "", cabang_lainnya: "" }));
  };

  const hapusKaryawan = async (e: Employee) => {
    if (!window.confirm(`Hapus permanen ${e.nama_gelar} (NIP ${e.nip})?\nRiwayat absensi/cuti/pengajuan ikut terhapus. Akun loginnya juga dihapus.`)) return;
    try {
      const r = await api.hapusKaryawan(e.id);
      toast(`Karyawan ${r.nip} dihapus.`);
      muat();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const uploadPDF = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast("File harus PDF template Arsip SDM");
      return;
    }
    setParsing(true);
    setNamaBerkas(file.name);
    try {
      const r = await api.parseSDM(file);
      const d = r.data as Record<string, string | number | null>;
      const daftar = units.length ? units : await api.units().catch(() => []);
      if (!units.length && daftar.length) setUnits(daftar);
      // Samakan cabang dulu (dari hasil parse), lalu unit di dalam cabang itu.
      let cabangKode = f.cabang;
      if (d.cabang_nama) {
        const ketemu = cocokCabangDi(daftar, String(d.cabang_nama));
        if (ketemu) cabangKode = ketemu;
      }
      const unitTersedia = cabangKode ? daftar.filter((u) => u.cabang === cabangKode) : daftar;
      const uid = d.unit_nama ? cocokUnit(String(d.unit_nama), unitTersedia) : undefined;
      setF({
        ...F_AWAL,
        cabang: cabangKode,
        unit_id: uid ? String(uid) : "",
        nama_gelar: String(d.nama_gelar ?? ""),
        email: String(d.email ?? ""),
        no_hp: String(d.no_hp ?? ""),
        posisi_diajukan: String(d.posisi_diajukan ?? ""),
        mapel: String(d.mapel ?? ""),
        nik_ktp: String(d.nik_ktp ?? ""),
        alamat: String(d.alamat ?? ""),
        tempat_lahir: String(d.tempat_lahir ?? ""),
        tgl_lahir: String(d.tgl_lahir ?? ""),
        status_kawin: String(d.status_kawin ?? ""),
        transport: String(d.transport ?? ""),
        gaji_diajukan: d.gaji_diajukan != null ? String(d.gaji_diajukan) : "",
        bank_utama: String(d.bank_utama ?? "BSI"),
        norek_utama: String(d.norek_utama ?? ""),
        bank_lain: String(d.bank_lain ?? ""),
        norek_lain: String(d.norek_lain ?? ""),
      });
      const pd = (d.pendidikan ?? null) as { perguruan_tinggi?: string; prodi?: string; ipk?: number } | null;
      if (pd) setPend({ pt: pd.perguruan_tinggi ?? "", prodi: pd.prodi ?? "", ipk: pd.ipk != null ? String(pd.ipk) : "" });
      const pg = (Array.isArray(d.pengalaman) ? d.pengalaman : []) as { deskripsi?: string; salary?: number }[];
      setPeng({
        p1: pg[0]?.deskripsi ?? "", s1: pg[0]?.salary != null ? String(pg[0].salary) : "",
        p2: pg[1]?.deskripsi ?? "", s2: pg[1]?.salary != null ? String(pg[1].salary) : "",
        p3: pg[2]?.deskripsi ?? "", s3: pg[2]?.salary != null ? String(pg[2].salary) : "",
      });
      setArsipNama(r.arsip_nama);
      setCvLink(typeof d.cv_link === "string" ? d.cv_link : null);
      setPeringatan(r.warnings);
      toast(r.warnings.length ? `Terbaca dgn ${r.warnings.length} peringatan — verifikasi dulu` : "PDF terbaca — verifikasi sebelum simpan");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal membaca PDF");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.nama_gelar.trim() || !f.cabang || !f.unit_id) {
      toast("Nama, cabang, dan unit wajib diisi");
      return;
    }
    if (f.cabang === "LAIN" && !f.cabang_lainnya.trim()) {
      toast("Cabang LAINNYA wajib diisi keterangannya");
      return;
    }
    setSaving(true);
    try {
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
      const pengalaman = [
        { deskripsi: peng.p1.trim() || undefined, salary: num(peng.s1) },
        { deskripsi: peng.p2.trim() || undefined, salary: num(peng.s2) },
        { deskripsi: peng.p3.trim() || undefined, salary: num(peng.s3) },
      ].filter((p) => p.deskripsi || p.salary != null);
      const r = await api.createEmployee({
        nama_gelar: f.nama_gelar.trim(),
        unit_id: Number(f.unit_id),
        atasan_id: f.atasan_id ? Number(f.atasan_id) : null,
        cabang_lainnya: f.cabang === "LAIN" ? f.cabang_lainnya.trim() || undefined : undefined,
        email: f.email.trim() || undefined,
        no_hp: f.no_hp.trim() || undefined,
        posisi_diajukan: f.posisi_diajukan.trim() || undefined,
        mapel: f.mapel.trim() || undefined,
        nip: f.nip.trim() || undefined,
        nik_ktp: f.nik_ktp.trim() || undefined,
        alamat: f.alamat.trim() || undefined,
        tempat_lahir: f.tempat_lahir.trim() || undefined,
        tgl_lahir: f.tgl_lahir.trim() || undefined,
        status_kawin: f.status_kawin || undefined,
        gender: f.gender || undefined,
        transport: f.transport.trim() || undefined,
        gaji_diajukan: num(f.gaji_diajukan),
        bank_utama: f.bank_utama.trim() || undefined,
        norek_utama: f.norek_utama.trim() || undefined,
        bank_lain: f.bank_lain.trim() || undefined,
        norek_lain: f.norek_lain.trim() || undefined,
        cv_url: cvLink || undefined,
        arsip_nama: arsipNama || undefined,
        pendidikan: pend.pt.trim() || pend.prodi.trim()
          ? { perguruan_tinggi: pend.pt.trim() || undefined, prodi: pend.prodi.trim() || undefined, ipk: num(pend.ipk) }
          : undefined,
        pengalaman: pengalaman.length ? pengalaman : undefined,
      });
      toast(`Karyawan ditambah (NIP ${r.nip})`);
      setShowForm(false);
      setF(F_AWAL);
      setPend({ pt: "", prodi: "", ipk: "" });
      setPeng({ p1: "", s1: "", p2: "", s2: "", p3: "", s3: "" });
      setArsipNama(null);
      setCvLink(null);
      setPeringatan([]);
      setNamaBerkas(null);
      nav(`/karyawan/${r.nip}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menambah karyawan");
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    const cab = fCabang;
    return data.filter((e) => {
      if (cab && e.cabang !== cab) return false;
      if (!s) return true;
      return `${e.nama_gelar} ${e.nip} ${e.posisi_diajukan}`.toLowerCase().includes(s);
    });
  }, [data, q, fCabang]);

  // Daftar cabang untuk filter (dari data karyawan, bukan units — selalu tersedia).
  const cabangFilter = useMemo(() => {
    if (!data) return [];
    const peta = new Map<string, number>();
    for (const e of data) if (e.cabang) peta.set(e.cabang, (peta.get(e.cabang) ?? 0) + 1);
    return [...peta.entries()]
      .map(([kode, jumlah]) => ({ kode, jumlah }))
      .sort((a, b) => (a.kode === "LAIN" ? 1 : b.kode === "LAIN" ? -1 : a.kode.localeCompare(b.kode)));
  }, [data]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Daftar karyawan</b></p>
          <h1 className="font-display text-2xl font-bold">Karyawan AW3</h1>
        </div>
        <Select value={fCabang} onChange={(e) => setFCabang(e.target.value)} className="max-w-[240px]">
          <option value="">— Semua cabang —</option>
          {cabangFilter.map((c) => (
            <option key={c.kode} value={c.kode}>{c.kode} · {c.jumlah} karyawan</option>
          ))}
        </Select>
        <Input placeholder="Cari nama / NIP / posisi…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        {bolehTambah ? (
          <Button variant="secondary" onClick={bukaForm}>+ Tambah karyawan</Button>
        ) : null}
        {bolehAkun ? <BulkAkunPanel scopeCabang={fCabang || null} muat={muat} /> : null}
      </div>

      {showForm && bolehTambah ? (
        <Card className="wd-card border-primary/40">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">Tambah karyawan baru</CardTitle>
            <input
              ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden"
              onChange={(e) => { const fl = e.target.files?.[0]; if (fl) uploadPDF(fl); }}
            />
            <div
              role="button" tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragAktif(true); }}
              onDragLeave={() => setDragAktif(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragAktif(false);
                const fl = e.dataTransfer.files?.[0];
                if (fl) uploadPDF(fl);
              }}
              className={`mt-3 flex cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed px-4 py-5 text-center text-sm transition-colors ${
                dragAktif ? "border-primary bg-secondary" : "border-input bg-muted/40 hover:border-primary/60 hover:bg-muted/70"
              }`}
            >
              <div>
                <p className="font-semibold text-foreground">
                  {parsing ? "Membaca PDF…" : "Seret PDF Arsip SDM ke sini, atau klik untuk pilih file"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {namaBerkas ? `Berkas: ${namaBerkas}` : "Template PDF SDM — form terisi otomatis, verifikasi sebelum simpan"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {peringatan.length > 0 ? (
              <div className="mt-4 rounded-md border border-warning/40 bg-[#fff8ec] px-3 py-2 text-xs text-foreground">
                <p className="font-bold">Verifikasi sebelum simpan:</p>
                <ul className="list-disc pl-4">{peringatan.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            ) : null}
            <form onSubmit={simpan} className="grid gap-4 pt-4 md:grid-cols-2">
              <Field label="Nama lengkap + gelar *">
                <Input value={f.nama_gelar} onChange={(e) => setF({ ...f, nama_gelar: e.target.value })} placeholder="cth. Ahmad Hidayat, S.Pd." required />
              </Field>
              <Field label="Cabang *">
                <Select value={f.cabang} onChange={(e) => pilihCabang(e.target.value)} required>
                  <option value="">— Pilih cabang —</option>
                  {daftarCabang.map((c) => (
                    <option key={c.kode} value={c.kode}>{c.nama}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Unit *">
                <Select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} required disabled={!f.cabang}>
                  <option value="">{f.cabang ? "— Pilih unit —" : "— Pilih cabang dulu —"}</option>
                  {unitsCabang.map((u) => (
                    <option key={u.id} value={u.id}>{u.nama} ({u.kode})</option>
                  ))}
                </Select>
              </Field>
              <Field label="Atasan langsung (cabang yang sama)">
                <Select value={f.atasan_id} onChange={(e) => setF({ ...f, atasan_id: e.target.value })} disabled={!f.cabang}>
                  <option value="">{atasanCabang.length ? "— Tidak ada / pilih atasan —" : "— Belum ada data atasan di cabang ini —"}</option>
                  {atasanCabang.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama_gelar}{k.posisi_diajukan ? ` · ${k.posisi_diajukan}` : ""}</option>
                  ))}
                </Select>
              </Field>
              {f.cabang === "LAIN" ? (
                <Field label="Keterangan cabang (LAINNYA) *">
                  <Input value={f.cabang_lainnya} onChange={(e) => setF({ ...f, cabang_lainnya: e.target.value })} placeholder="cth. AL-WILDAN 33 …" required />
                </Field>
              ) : null}
              <Field label="Posisi diajukan">
                <Input value={f.posisi_diajukan} onChange={(e) => setF({ ...f, posisi_diajukan: e.target.value })} placeholder="cth. Guru Mata Pelajaran" />
              </Field>
              <Field label="Mapel (opsional)">
                <Input value={f.mapel} onChange={(e) => setF({ ...f, mapel: e.target.value })} placeholder="cth. Diniyyah" />
              </Field>
              <Field label="Email">
                <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nama@alwildan.sch.id" />
              </Field>
              <Field label="No HP" hint="Format 628… tanpa +">
                <Input value={f.no_hp} onChange={(e) => setF({ ...f, no_hp: e.target.value })} placeholder="628…" />
              </Field>
              <Field label="NIK KTP" hint="Sensitif — tersimpan, tak ditampilkan di daftar">
                <Input value={f.nik_ktp} onChange={(e) => setF({ ...f, nik_ktp: e.target.value })} placeholder="16 digit" maxLength={16} />
              </Field>
              <Field label="Tanggal lahir">
                <Input type="date" value={f.tgl_lahir} onChange={(e) => setF({ ...f, tgl_lahir: e.target.value })} />
              </Field>
              <Field label="Alamat domisili">
                <Input value={f.alamat} onChange={(e) => setF({ ...f, alamat: e.target.value })} />
              </Field>
              <Field label="Tempat lahir">
                <Input value={f.tempat_lahir} onChange={(e) => setF({ ...f, tempat_lahir: e.target.value })} />
              </Field>
              <Field label="Status kawin">
                <Select value={f.status_kawin} onChange={(e) => setF({ ...f, status_kawin: e.target.value })}>
                  <option value="">—</option>
                  {["Lajang", "Menikah", "Janda", "Duda"].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Gender">
                <Select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
                  <option value="">—</option>
                  {["Pria", "Perempuan"].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Transport">
                <Input value={f.transport} onChange={(e) => setF({ ...f, transport: e.target.value })} />
              </Field>
              <Field label="Gaji diajukan (Rp)">
                <Input inputMode="numeric" value={f.gaji_diajukan} onChange={(e) => setF({ ...f, gaji_diajukan: e.target.value.replace(/[^0-9]/g, "") })} placeholder="cth. 10000000" />
              </Field>
              <Field label="NIP manual (opsional)" hint="Kosongkan = otomatis">
                <Input value={f.nip} onChange={(e) => setF({ ...f, nip: e.target.value })} placeholder="Otomatis" />
              </Field>
              <Field label="Bank utama">
                <Input value={f.bank_utama} onChange={(e) => setF({ ...f, bank_utama: e.target.value })} placeholder="BSI" />
              </Field>
              <Field label="Norek utama" hint="Sensitif — tersimpan, tak ditampilkan">
                <Input value={f.norek_utama} onChange={(e) => setF({ ...f, norek_utama: e.target.value.replace(/[^0-9]/g, "") })} />
              </Field>
              <Field label="Bank lain">
                <Input value={f.bank_lain} onChange={(e) => setF({ ...f, bank_lain: e.target.value })} placeholder="BNI" />
              </Field>
              <Field label="Norek lain">
                <Input value={f.norek_lain} onChange={(e) => setF({ ...f, norek_lain: e.target.value.replace(/[^0-9]/g, "") })} />
              </Field>
              <Field label="Pendidikan S1 — PT">
                <Input value={pend.pt} onChange={(e) => setPend({ ...pend, pt: e.target.value })} />
              </Field>
              <Field label="Pendidikan S1 — Prodi / IPK">
                <div className="flex gap-2">
                  <Input value={pend.prodi} onChange={(e) => setPend({ ...pend, prodi: e.target.value })} placeholder="Prodi" />
                  <Input value={pend.ipk} onChange={(e) => setPend({ ...pend, ipk: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="IPK" className="max-w-24" />
                </div>
              </Field>
              {[1, 2, 3].map((n) => (
                <Field key={n} label={`Pengalaman ${n}`}>
                  <div className="flex gap-2">
                    <Input
                      value={peng[`p${n}` as "p1"]} onChange={(e) => setPeng({ ...peng, [`p${n}`]: e.target.value })}
                      placeholder="Deskripsi" />
                    <Input
                      value={peng[`s${n}` as "s1"]} onChange={(e) => setPeng({ ...peng, [`s${n}`]: e.target.value.replace(/[^0-9]/g, "") })}
                      placeholder="Salary" className="max-w-32" />
                  </div>
                </Field>
              ))}
              {cvLink ? <p className="text-xs text-muted-foreground md:col-span-2">Link CV terdeteksi: <span className="break-all text-primary">{cvLink}</span></p> : null}
              {arsipNama ? <p className="text-xs text-muted-foreground md:col-span-2">PDF sumber tersimpan sebagai arsip dan akan dilampirkan otomatis.</p> : null}
              <div className="flex items-end gap-2 md:col-span-2">
                <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan (status draft)"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="wd-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border pb-4"><CardTitle className="text-base">{rows.length} karyawan</CardTitle><span className="text-xs uppercase tracking-[.14em] text-muted-foreground">Table list</span></CardHeader>
        <CardContent>
          {!data ? (
            <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIP</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Posisi</TableHead>
                  <TableHead>THP bersih</TableHead>
                  <TableHead>Status</TableHead>
                  {bolehAkun ? <TableHead>Akun</TableHead> : null}
                  {bolehTambah ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.nip}>
                    <TableCell className="tnum font-medium">{e.nip}</TableCell>
                    <TableCell>
                      <Link to={`/karyawan/${e.nip}`} className="font-semibold text-primary hover:underline">
                        {e.nama_gelar}
                      </Link>
                      <p className="text-xs text-muted-foreground">{e.email}</p>
                    </TableCell>
                    <TableCell>{e.posisi_diajukan}{e.mapel ? ` · ${e.mapel}` : ""}</TableCell>
                    <TableCell className="tnum">{rupiah(e.thp_bersih)}</TableCell>
                    <TableCell><Badge variant={STATUS_BADGE[e.status_aktivasi]}>{STATUS_LABEL[e.status_aktivasi]}</Badge></TableCell>
                    {bolehAkun ? (
                      <TableCell>
                        {e.punya_akun ? (
                          <Badge variant="success">Ada</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setAkunEmp(e)}>Buatkan</Button>
                        )}
                      </TableCell>
                    ) : null}
                    {bolehTambah ? (
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => hapusKaryawan(e)}>Hapus</Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {akunEmp && bolehAkun ? (
        <BuatkanAkunDialog
          emp={akunEmp}
          tutup={() => setAkunEmp(null)}
          selesai={() => { setAkunEmp(null); muat(); }}
        />
      ) : null}
    </div>
  );
}

function acakSandi(n = 12) {
  const abjad = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => abjad[x % abjad.length]).join("");
}

function unduhCSV(judul: string, baris: Record<string, string>[]) {
  const cols = baris.length ? Object.keys(baris[0]) : [];
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...baris.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${judul}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

type BarisKredensial = { nip?: string; nama: string; email: string; sandi: string };
type BarisDilewati = { nip?: string; nama: string; alasan: string };

function BulkAkunPanel({ scopeCabang, muat }: { scopeCabang: string | null; muat: () => void }) {
  const [mode, setMode] = useState<"akun" | "reset" | null>(null);
  const [role, setRole] = useState("pegawai");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasil, setHasil] = useState<{ mode: string; dibuat: BarisKredensial[] | null; direset: BarisKredensial[] | null; dilewati: BarisDilewati[] } | null>(null);

  const scopeLabel = scopeCabang ? `cabang ${scopeCabang}` : "semua cabang";

  const jalankan = async (m: "akun" | "reset") => {
    let konfirmasi = "";
    if (m === "akun")
      konfirmasi = `Buatkan akun untuk SEMUA karyawan ${scopeLabel} yang belum punya akun dan punya email?\nKredensial (email+sandi) akan ditampilkan SEPERTI BERIKUT hanya sekali — wajib segera disimpan/dicetak.`;
    else
      konfirmasi = `Acak ulang sandi SEMUA akun ${scopeLabel} yang sudah tertaut karyawan?\nKredensial baru ditampilkan SEKALI saja.`;
    if (!window.confirm(konfirmasi)) return;
    setMode(m);
    setBusy(true);
    setErr(null);
    setHasil(null);
    try {
      if (m === "akun") {
        const r = await api.bulkAkun({ role, password: password || undefined, cabang: scopeCabang ?? undefined });
        setHasil({ mode: "akun", dibuat: r.dibuat, direset: null, dilewati: r.dilewati });
        toast(`Akun dibuat untuk ${r.dibuat.length} karyawan (${r.dilewati.length} dilewati).`);
      } else {
        const r = await api.bulkReset({ cabang: scopeCabang ?? undefined });
        setHasil({ mode: "reset", dibuat: null, direset: r.direset, dilewati: [] });
        toast(`Sandi direset untuk ${r.direset.length} akun.`);
      }
      muat();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const kredensial = hasil?.mode === "akun" ? hasil.dibuat : hasil?.direset;
  const tutupHasil = () => { setHasil(null); setMode(null); };

  return (
    <>
      <Button variant="outline" onClick={() => { setMode("akun"); setHasil(null); setErr(null); }}>
        ⚡ Buatkan akun semua
      </Button>
      <Button variant="outline" onClick={() => { setMode("reset"); setHasil(null); setErr(null); }}>
        ⟳ Reset semua sandi
      </Button>

      {mode && !hasil ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-navy/60 p-4" onClick={() => setMode(null)}>
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold">
              {mode === "akun" ? "Buatkan akun semua" : "Reset semua sandi"} · {scopeLabel}
            </h2>
            {mode === "akun" ? (
              <div className="mt-4 grid gap-4">
                <Field label="Peran default">
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="pegawai">Pegawai</option>
                    <option value="hr_cabang">HR Cabang</option>
                  </Select>
                </Field>
                <Field label="Sandi seragam (kosong = acak per akun)">
                  <div className="flex gap-2">
                    <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 8 karakter" minLength={password ? 8 : undefined} />
                    <Button type="button" variant="outline" onClick={() => setPassword(acakSandi())}>Acak</Button>
                  </div>
                </Field>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Semua akun tertaut karyawan {scopeLabel} akan mendapat sandi baru acak. Master Admin dan akun Anda sendiri tidak ikut.
              </p>
            )}
            {err ? <p className="mt-3 rounded-md bg-[#fbeae8] px-3 py-2 text-sm text-destructive">{err}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMode(null)}>Batal</Button>
              <Button onClick={() => jalankan(mode)} disabled={busy}>
                {busy ? "Memproses…" : mode === "akun" ? "Buatkan akun" : "Reset sandi"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {hasil ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-navy/60 p-4" onClick={tutupHasil}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold">
              {hasil.mode === "akun" ? `Akun dibuat: ${hasil.dibuat?.length ?? 0}` : `Sandi direset: ${hasil.direset?.length ?? 0}`}
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Kredensial hanya tampil sekali — <b>simpan CSV sekarang</b>. Lewat halaman ini, sandi tidak bisa dilihat lagi.
            </p>
            {kredensial && kredensial.length > 0 ? (
              <>
                <div className="mb-3 flex gap-2">
                  <Button size="sm" onClick={() => {
                    unduhCSV(hasil.mode === "akun" ? "akun-karyawan" : "reset-sandi", kredensial.map((k) => ({ nip: k.nip ?? "", nama: k.nama, email: k.email, sandi: k.sandi })));
                  }}>
                    Unduh CSV ({kredensial.length})
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                        <th className="px-3 py-2">Nama</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Sandi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kredensial.map((k) => (
                        <tr key={k.email} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-1.5 font-medium">{k.nama}</td>
                          <td className="px-3 py-1.5 font-mono">{k.email}</td>
                          <td className="px-3 py-1.5 font-mono text-primary">{k.sandi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">Tidak ada yang diproses.</p>
            )}
            {hasil.dilewati.length > 0 ? (
              <div className="mt-3 rounded-md bg-[#fff8ec] px-3 py-2 text-xs">
                <p className="font-bold">Dilewati ({hasil.dilewati.length}):</p>
                <ul className="ml-4 list-disc">
                  {hasil.dilewati.slice(0, 10).map((d, i) => <li key={i}>{d.nama} — {d.alasan}</li>)}
                </ul>
                {hasil.dilewati.length > 10 ? <p>…dan {hasil.dilewati.length - 10} lainnya.</p> : null}
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { unduhCSV(hasil.mode === "akun" ? "akun-karyawan" : "reset-sandi", (kredensial ?? []).map((k) => ({ nip: k.nip ?? "", nama: k.nama, email: k.email, sandi: k.sandi }))); }}>
                Unduh CSV
              </Button>
              <Button onClick={tutupHasil}>Tutup</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function BuatkanAkunDialog({ emp, tutup, selesai }: { emp: Employee; tutup: () => void; selesai: () => void }) {
  const [email, setEmail] = useState(emp.email || "");
  const [role, setRole] = useState("pegawai");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState<{ email: string; role: string; sandi_sementara?: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.buatkanAkun(emp.id, {
        email: email.trim() || undefined,
        password: password || undefined,
        role,
      });
      setHasil({ email: r.email, role: r.role, sandi_sementara: r.sandi_sementara });
      toast("Akun dibuat & tertaut ke karyawan.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal membuat akun");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-navy/60 p-4" onClick={tutup}>
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold">Buatkan akun — {emp.nama_gelar}</h2>
        <p className="mb-4 text-xs text-muted-foreground tnum">
          NIP {emp.nip}{emp.posisi_diajukan ? ` · ${emp.posisi_diajukan}` : ""}. Kosongkan sandi untuk acak otomatis (ditampilkan sekali di sini).
        </p>
        {hasil ? (
          <div className="grid gap-3">
            <div className="rounded-md bg-[#e7f4ec] px-4 py-3 text-sm">
              <p><b>Email:</b> <span className="font-mono">{hasil.email}</span></p>
              <p><b>Peran:</b> {hasil.role}</p>
              {hasil.sandi_sementara ? (
                <p><b>Sandi sementara:</b> <span className="font-mono text-base font-bold">{hasil.sandi_sementara}</span></p>
              ) : (
                <p className="text-muted-foreground">Sandi sesuai yang Anda isi.</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Catat & teruskan ke karyawan — sandi acak hanya tampil sekali.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={tutup}>Tutup</Button>
              <Button onClick={selesai}>Selesai</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <Field label="Email login">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@alwildan.sch.id" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Peran">
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="pegawai">Pegawai</option>
                  <option value="hr_cabang">HR Cabang</option>
                  <option value="master_admin">Master Admin</option>
                </Select>
              </Field>
              <Field label="Sandi (kosong = acak)">
                <div className="flex gap-2">
                  <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 8" minLength={password ? 8 : undefined} />
                  <Button type="button" variant="outline" onClick={() => setPassword(acakSandi())} title="Acak sandi">Acak</Button>
                </div>
              </Field>
            </div>
            {err ? <p className="rounded-md bg-[#fbeae8] px-3 py-2 text-sm text-destructive">{err}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={tutup}>Batal</Button>
              <Button type="submit" disabled={busy}>{busy ? "Membuat…" : "Buat akun"}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
