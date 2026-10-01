import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, STATUS_BADGE, STATUS_LABEL } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { api, bisa, cekBalance, type Dokumen, type Employee, type OnboardingItem, type Pendidikan, type Pengalaman, type RiwayatJabatan, type SessionUser } from "../lib/api";
import { masaKerja, rupiah, tglISOtoID } from "../lib/format";
import { toast } from "../components/ui/toaster";
import { isArsipUrl, useArsip } from "../lib/unduh";

const TAHAP: Employee["status_aktivasi"][] = ["diajukan_finance", "diverifikasi_doni", "aktif"];

// Acuan "hari ini" untuk badge kedaluwarsa (dievaluasi sekali saat modul dimuat).
const KINI = Date.now();

export function KaryawanDetail() {
  const { nip } = useParams();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState({ thp_kotor: 0, thp_bersih: 0, total_tk_thr: 0, tk: 0, thr_bulan: 0, konfirmasi: "", tmt_aktif: "", mode_thp: "FULL" });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [semuaKary, setSemuaKary] = useState<Employee[]>([]);
  const [riwayat, setRiwayat] = useState<RiwayatJabatan[] | null>(null);
  const [dokumen, setDokumen] = useState<Dokumen[] | null>(null);
  const [onboard, setOnboard] = useState<OnboardingItem[] | null>(null);
  const [pendidikan, setPendidikan] = useState<Pendidikan[] | null>(null);
  const [pengalaman, setPengalaman] = useState<Pengalaman[] | null>(null);
  const [kerja, setKerja] = useState({ atasan_id: "", tgl_masuk: "", status_kerja: "aktif", kontak_darurat: "", foto_url: "", gender: "" });
  const [rj, setRj] = useState({ tanggal: "", jabatan_baru: "", gaji_baru: "", keterangan: "", terapkan: true });
  const [dok, setDok] = useState({ jenis: "KTP", judul: "", file_key: "", kedaluwarsa: "" });
  const fotoTampil = useArsip(kerja.foto_url || emp?.foto_url || null);
  useEffect(() => {
    api.me().then(setMe).catch(() => {});
  }, []);

  const muatTab = (id: number) => {
    api.riwayatJabatan(id).then(setRiwayat).catch(() => setRiwayat([]));
    api.dokumen(id).then(setDokumen).catch(() => setDokumen([]));
    api.onboarding(id).then(setOnboard).catch(() => setOnboard([]));
    api.pendidikan(id).then(setPendidikan).catch(() => setPendidikan([]));
    api.pengalaman(id).then(setPengalaman).catch(() => setPengalaman([]));
  };

  useEffect(() => {
    api.employees().then((all) => {
      const e = all.find((x) => x.nip === nip) ?? null;
      setEmp(e);
      if (e) {
        setForm({ thp_kotor: e.thp_kotor, thp_bersih: e.thp_bersih, total_tk_thr: e.total_tk_thr, tk: e.tk, thr_bulan: e.thr_bulan, konfirmasi: e.konfirmasi ?? "", tmt_aktif: e.tmt_aktif ?? "", mode_thp: e.mode_thp ?? "FULL" });
        setKerja({ atasan_id: e.atasan_id ? String(e.atasan_id) : "", tgl_masuk: e.tgl_masuk ?? "", status_kerja: e.status_kerja ?? "aktif", kontak_darurat: e.kontak_darurat ?? "", foto_url: e.foto_url ?? "", gender: e.gender ?? "" });
        setSemuaKary(all.filter((x) => x.id !== e.id));
        muatTab(e.id);
      }
    });
  }, [nip]);

  if (!emp) return <p className="text-sm text-muted-foreground">Memuat… <Link to="/karyawan" className="text-primary">Kembali</Link></p>;

  const tahapIdx = Math.max(0, TAHAP.indexOf(emp.status_aktivasi === "draft" || emp.status_aktivasi === "ditolak" ? "diajukan_finance" : emp.status_aktivasi));

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: ["konfirmasi", "tmt_aktif", "mode_thp"].includes(k) ? v : Number(v.replace(/[^0-9]/g, "")) || 0 }));

  const simpan = async (next: Employee["status_aktivasi"]) => {
    const msg = cekBalance(form);
    if (msg) {
      setErr(`DITOLAK: ${msg}. Nilai tidak dibetulkan otomatis — perbaiki angka THP.`);
      setOk(null);
      return;
    }
    setErr(null);
    try {
      const updated = await api.activate(emp.id, { ...form, status_aktivasi: next });
      setEmp(updated);
      setOk(`Tersimpan → status ${STATUS_LABEL[next]}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
      setOk(null);
    }
  };

  const kelola = bisa(me, "karyawan.kelola");
  const lihat = bisa(me, "karyawan.lihat");

  const simpanKerja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emp) return;
    try {
      await api.updateDataKerja(emp.id, {
        atasan_id: kerja.atasan_id ? Number(kerja.atasan_id) : null,
        tgl_masuk: kerja.tgl_masuk || null,
        status_kerja: kerja.status_kerja,
        kontak_darurat: kerja.kontak_darurat || null,
        foto_url: kerja.foto_url || null,
        gender: kerja.gender || null,
      });
      toast("Data kerja tersimpan.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  const tambahRiwayat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emp) return;
    try {
      await api.tambahRiwayat({
        employee_id: emp.id, tanggal: rj.tanggal || undefined,
        jabatan_baru: rj.jabatan_baru || undefined,
        gaji_baru: rj.gaji_baru ? Number(rj.gaji_baru) : undefined,
        keterangan: rj.keterangan || undefined, terapkan: rj.terapkan,
      });
      toast("Riwayat tersimpan.");
      setRj({ tanggal: "", jabatan_baru: "", gaji_baru: "", keterangan: "", terapkan: true });
      api.riwayatJabatan(emp.id).then(setRiwayat).catch(() => {});
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  const tambahDok = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emp) return;
    try {
      await api.tambahDokumen({ employee_id: emp.id, jenis: dok.jenis, judul: dok.judul, file_key: dok.file_key || undefined, kedaluwarsa: dok.kedaluwarsa || undefined });
      toast("Dokumen ditambahkan.");
      setDok({ jenis: "KTP", judul: "", file_key: "", kedaluwarsa: "" });
      api.dokumen(emp.id).then(setDokumen).catch(() => {});
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  const unggahBerkas = async (file: File, ke: "dok" | "foto") => {
    if (!emp) return;
    try {
      const r = await api.uploadArsip(file, emp.id);
      if (ke === "dok") setDok((d) => ({ ...d, file_key: r.url }));
      else setKerja((k) => ({ ...k, foto_url: r.url }));
      toast(`Berkas terunggah (${Math.round(r.ukuran / 1024)} KB).`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal mengunggah");
    }
  };

  const bukaBerkas = (file_key: string | null) => {
    if (!file_key) return;
    if (isArsipUrl(file_key)) api.bukaArsip(file_key).catch((e) => toast(e instanceof Error ? e.message : "Gagal membuka"));
    else window.open(file_key, "_blank", "noopener");
  };

  const hapusDok = async (id: number) => {
    if (!window.confirm("Hapus dokumen ini?")) return;
    try {
      await api.hapusDokumen(id);
      setDokumen((d) => (d ?? []).filter((x) => x.id !== id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  const toggleOnboard = async (id: number, selesai: boolean) => {
    try {
      await api.centangOnboarding(id, !selesai);
      setOnboard((o) => (o ?? []).map((x) => (x.id === id ? { ...x, selesai: selesai ? 0 : 1 } : x)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground"><Link to="/karyawan" className="hover:underline">Karyawan</Link> · <b className="text-foreground tnum">NIP {emp.nip}</b></p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold">{emp.nama_gelar}</h1>
          <Badge variant={STATUS_BADGE[emp.status_aktivasi]}>{STATUS_LABEL[emp.status_aktivasi]}</Badge>
        </div>
      </div>

      <Tabs defaultValue="biodata">
        <TabsList>
          <TabsTrigger value="biodata">Biodata</TabsTrigger>
          <TabsTrigger value="pendidikan">Pendidikan & Pengalaman</TabsTrigger>
          <TabsTrigger value="aktivasi">Aktivasi THP</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          {lihat ? <TabsTrigger value="kerja">Data kerja</TabsTrigger> : null}
          {lihat ? <TabsTrigger value="riwayat">Riwayat</TabsTrigger> : null}
          {lihat ? <TabsTrigger value="dokumen">Dokumen</TabsTrigger> : null}
          {lihat ? <TabsTrigger value="onboarding">Onboarding</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="biodata">
          <Card>
            <CardHeader><CardTitle className="text-base">Data lamaran & kontak</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                {[
                  ["Jabatan", emp.jabatan ?? "–"], ["Gender", emp.gender ?? "–"],
                  ["Email", emp.email], ["No HP", emp.no_hp], ["Posisi", emp.posisi_diajukan],
                  ["Mapel", emp.mapel ?? "–"], ["Unit", `${emp.unit} · AW3`], ["Gaji diajukan", rupiah(emp.gaji_diajukan)],
                  ["TMT aktif", tglISOtoID(emp.tmt_aktif)], ["Mode THP", emp.mode_thp ?? "–"],
                  ["Status kerja", emp.status_kerja ?? "aktif"], ["Tgl masuk", tglISOtoID(emp.tgl_masuk)],
                  ["Masa kerja", masaKerja(emp.tgl_masuk ?? emp.tmt_aktif)], ["Atasan", emp.atasan_nama ?? "–"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">NIK KTP disembunyikan (sensitif — tidak tampil di UI).</p>
            </CardContent>
          </Card>

          <Card className="mt-5">
            <CardHeader><CardTitle className="text-base">Domisili & data pribadi</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                {[
                  ["Alamat", emp.alamat ?? "–"],
                  ["Tempat, tgl lahir", `${emp.tempat_lahir ?? "–"}, ${emp.tgl_lahir ? tglISOtoID(emp.tgl_lahir) : "–"}`],
                  ["Status", emp.status_kawin ?? "–"], ["Transport", emp.transport ?? "–"],
                  ["Tinggi badan", emp.tinggi_cm ? `${emp.tinggi_cm} cm` : "–"],
                  ["Berat badan", emp.berat_kg ? `${emp.berat_kg} kg` : "–"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {emp.kesehatan_url ? (
                <p className="mt-4 text-xs">
                  <a href={emp.kesehatan_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Lihat riwayat kesehatan →</a>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="mt-5">
            <CardHeader><CardTitle className="text-base">Rekening bank</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                {[
                  ["Bank utama", emp.bank_utama ?? "–"], ["No. rekening utama", emp.norek_utama ?? "–"],
                  ["Bank lain", emp.bank_lain ?? "–"], ["No. rekening lain", emp.norek_lain ?? "–"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium tnum">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pendidikan">
          <Card>
            <CardHeader><CardTitle className="text-base">Riwayat pendidikan</CardTitle></CardHeader>
            <CardContent>
              {!pendidikan ? <p className="text-sm text-muted-foreground">Memuat…</p> : pendidikan.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data pendidikan.</p>
              ) : (
                <ol className="grid gap-2">
                  {pendidikan.map((p) => (
                    <li key={p.id} className="rounded-md border border-border px-4 py-3 text-sm">
                      <p className="font-medium">{p.jenjang}{p.perguruan_tinggi ? ` · ${p.perguruan_tinggi}` : ""}</p>
                      {p.prodi ? <p className="text-xs text-muted-foreground">{p.prodi}</p> : null}
                      {p.ipk != null ? <p className="tnum text-xs text-muted-foreground">IPK {p.ipk}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          <Card className="mt-5">
            <CardHeader><CardTitle className="text-base">Pengalaman kerja sebelumnya</CardTitle></CardHeader>
            <CardContent>
              {!pengalaman ? <p className="text-sm text-muted-foreground">Memuat…</p> : pengalaman.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data pengalaman kerja.</p>
              ) : (
                <ol className="grid gap-2">
                  {pengalaman.map((p) => (
                    <li key={p.id} className="rounded-md border border-border px-4 py-3 text-sm">
                      <p className="font-medium">{p.deskripsi ?? "–"}</p>
                      {p.salary != null ? <p className="tnum text-xs text-muted-foreground">Gaji: {rupiah(p.salary)}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aktivasi">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Blok aktivasi payroll</CardTitle>
              <CardDescription>Diisi finance cabang → balance dicek otomatis sebelum simpan.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="THP kotor"><Input inputMode="numeric" value={form.thp_kotor} onChange={(e) => set("thp_kotor", e.target.value)} /></Field>
                <Field label="Total (TK-THR)"><Input inputMode="numeric" value={form.total_tk_thr} onChange={(e) => set("total_tk_thr", e.target.value)} /></Field>
                <Field label="THP bersih"><Input inputMode="numeric" value={form.thp_bersih} onChange={(e) => set("thp_bersih", e.target.value)} /></Field>
                <Field label="TK"><Input inputMode="numeric" value={form.tk} onChange={(e) => set("tk", e.target.value)} /></Field>
                <Field label="THR / bulan"><Input inputMode="numeric" value={form.thr_bulan} onChange={(e) => set("thr_bulan", e.target.value)} /></Field>
                <Field label="Konfirmasi"><Input value={form.konfirmasi} onChange={(e) => set("konfirmasi", e.target.value)} /></Field>
                <Field label="TMT aktif"><Input type="date" value={form.tmt_aktif} onChange={(e) => set("tmt_aktif", e.target.value)} /></Field>
                <Field label="Mode THP">
                  <Select value={form.mode_thp} onChange={(e) => set("mode_thp", e.target.value)}>
                    <option value="FULL">FULL</option>
                    <option value="PRORATA">PRORATA</option>
                  </Select>
                </Field>
              </div>
              <div className="rounded-md bg-muted px-4 py-3 text-sm tnum">
                Cek: bersih {rupiah(form.thp_bersih)} {form.thp_bersih === form.thp_kotor - form.total_tk_thr ? "✓" : "✗"} = kotor {rupiah(form.thp_kotor)} − total {rupiah(form.total_tk_thr)} ·
                total {form.total_tk_thr === form.tk + form.thr_bulan ? "✓" : "✗"} = TK {rupiah(form.tk)} + THR {rupiah(form.thr_bulan)}
              </div>
              {err ? <p className="rounded-md bg-[#fbeae8] px-3 py-2 text-sm text-destructive">{err}</p> : null}
              {ok ? <p className="rounded-md bg-[#e7f4ec] px-3 py-2 text-sm text-success">{ok}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={!bisa(me, "aktivasi.ajukan")} title={bisa(me, "aktivasi.ajukan") ? "" : "Butuh izin aktivasi.ajukan"} onClick={() => simpan("diajukan_finance")}>Simpan (Finance)</Button>
                <Button variant="secondary" disabled={!bisa(me, "aktivasi.verifikasi")} title={bisa(me, "aktivasi.verifikasi") ? "" : "Butuh izin aktivasi.verifikasi"} onClick={() => simpan("diverifikasi_doni")}>Verifikasi (Doni)</Button>
                <Button disabled={!bisa(me, "aktivasi.setujui")} title={bisa(me, "aktivasi.setujui") ? "" : "Butuh izin aktivasi.setujui"} onClick={() => simpan("aktif")}>Setujui & Aktifkan (Kemal)</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow">
          <Card>
            <CardHeader><CardTitle className="text-base">Jejak aktivasi</CardTitle></CardHeader>
            <CardContent>
              <ol className="grid gap-3">
                {TAHAP.map((t, i) => {
                  const done = i < tahapIdx || emp.status_aktivasi === "aktif";
                  const cur = TAHAP[tahapIdx] === t && emp.status_aktivasi !== "aktif";
                  return (
                    <li key={t} className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm ${cur ? "border-primary bg-secondary" : "border-border"}`}>
                      <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-success text-white" : cur ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span className="font-medium">{["Finance input THP", "Doni verifikasi balance", "Kemal setuju → aktif"][i]}</span>
                      <Badge variant={done ? "success" : cur ? "default" : "muted"} className="ml-auto">
                        {done ? "Selesai" : cur ? "Posisi kini" : "Menunggu"}
                      </Badge>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {lihat ? (
          <TabsContent value="kerja">
            <Card>
              <CardHeader><CardTitle className="text-base">Data kerja</CardTitle></CardHeader>
              <CardContent>
                {fotoTampil ? <img src={fotoTampil} alt="Foto karyawan" className="mb-4 h-24 w-24 rounded-md border border-border object-cover" /> : null}
                {kelola ? (
                  <form onSubmit={simpanKerja} className="grid gap-3 md:grid-cols-3 md:items-end">
                    <Field label="Atasan langsung">
                      <Select value={kerja.atasan_id} onChange={(e) => setKerja({ ...kerja, atasan_id: e.target.value })}>
                        <option value="">— tidak ada —</option>
                        {(emp.cabang ? semuaKary.filter((k) => k.cabang === emp.cabang) : semuaKary).map((k) => (
                          <option key={k.id} value={k.id}>{k.nama_gelar}{k.posisi_diajukan ? ` · ${k.posisi_diajukan}` : ""}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Tgl masuk"><Input type="date" value={kerja.tgl_masuk} onChange={(e) => setKerja({ ...kerja, tgl_masuk: e.target.value })} /></Field>
                    <Field label="Status kerja">
                      <Select value={kerja.status_kerja} onChange={(e) => setKerja({ ...kerja, status_kerja: e.target.value })}>
                        {["aktif", "cuti", "resign", "nonaktif"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </Select>
                    </Field>
                    <Field label="Kontak darurat"><Input value={kerja.kontak_darurat} onChange={(e) => setKerja({ ...kerja, kontak_darurat: e.target.value })} /></Field>
                    <Field label="Gender">
                      <Select value={kerja.gender} onChange={(e) => setKerja({ ...kerja, gender: e.target.value })}>
                        <option value="">— belum diisi —</option>
                        {["Pria", "Perempuan"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </Select>
                    </Field>
                    <Field label="Foto (URL)"><Input value={kerja.foto_url} onChange={(e) => setKerja({ ...kerja, foto_url: e.target.value })} placeholder="https://…" /></Field>
                    <Field label="atau unggah foto (JPG/PNG ≤5 MB)">
                      <Input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) unggahBerkas(f, "foto"); e.target.value = ""; }} />
                    </Field>
                    <Button type="submit">Simpan</Button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">Perubahan data kerja butuh izin <b>karyawan.kelola</b>.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {lihat ? (
          <TabsContent value="riwayat">
            <Card>
              <CardHeader><CardTitle className="text-base">Riwayat jabatan & gaji</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                {kelola ? (
                  <form onSubmit={tambahRiwayat} className="grid gap-3 md:grid-cols-3 md:items-end">
                    <Field label="Tanggal"><Input type="date" value={rj.tanggal} onChange={(e) => setRj({ ...rj, tanggal: e.target.value })} /></Field>
                    <Field label="Jabatan baru"><Input value={rj.jabatan_baru} onChange={(e) => setRj({ ...rj, jabatan_baru: e.target.value })} /></Field>
                    <Field label="Gaji baru (Rp)"><Input inputMode="numeric" value={rj.gaji_baru} onChange={(e) => setRj({ ...rj, gaji_baru: e.target.value })} /></Field>
                    <Field label="Keterangan"><Input value={rj.keterangan} onChange={(e) => setRj({ ...rj, keterangan: e.target.value })} /></Field>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rj.terapkan} onChange={(e) => setRj({ ...rj, terapkan: e.target.checked })} /> Terapkan ke data kini</label>
                    <Button type="submit">Tambah</Button>
                  </form>
                ) : null}
                {!riwayat ? <p className="text-sm text-muted-foreground">Memuat…</p> : riwayat.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
                ) : (
                  <ol className="grid gap-2">
                    {riwayat.map((r) => (
                      <li key={r.id} className="rounded-md border border-border px-4 py-3 text-sm">
                        <p className="tnum text-xs text-muted-foreground">{tglISOtoID(r.tanggal)}</p>
                        <p>{r.jabatan_lama || "–"} → <b>{r.jabatan_baru || "–"}</b></p>
                        <p className="tnum text-xs">{rupiah(r.gaji_lama)} → {rupiah(r.gaji_baru)}</p>
                        {r.keterangan ? <p className="text-xs text-muted-foreground">{r.keterangan}</p> : null}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {lihat ? (
          <TabsContent value="dokumen">
            <Card>
              <CardHeader><CardTitle className="text-base">Dokumen (KTP, KK, ijazah, kontrak)</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                {kelola ? (
                  <form onSubmit={tambahDok} className="grid gap-3 md:grid-cols-4 md:items-end">
                    <Field label="Jenis">
                      <Select value={dok.jenis} onChange={(e) => setDok({ ...dok, jenis: e.target.value })}>
                        {["KTP", "KK", "Ijazah", "Kontrak", "SK", "Lainnya"].map((j) => <option key={j} value={j}>{j}</option>)}
                      </Select>
                    </Field>
                    <Field label="Judul"><Input value={dok.judul} onChange={(e) => setDok({ ...dok, judul: e.target.value })} required /></Field>
                    <Field label="Tautan file"><Input value={dok.file_key} onChange={(e) => setDok({ ...dok, file_key: e.target.value })} placeholder="URL / kunci arsip" /></Field>
                    <Field label="atau unggah berkas (PDF/JPG/PNG ≤5 MB)">
                      <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) unggahBerkas(f, "dok"); e.target.value = ""; }} />
                    </Field>
                    <Field label="Kedaluwarsa"><Input type="date" value={dok.kedaluwarsa} onChange={(e) => setDok({ ...dok, kedaluwarsa: e.target.value })} /></Field>
                    <Button type="submit">Tambah</Button>
                  </form>
                ) : null}
                {!dokumen ? <p className="text-sm text-muted-foreground">Memuat…</p> : dokumen.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada dokumen — lengkapi KTP, KK, ijazah, dan kontrak.</p>
                ) : (
                  <ol className="grid gap-2">
                    {dokumen.map((d) => {
                      const exp = d.kedaluwarsa ? Math.round((new Date(d.kedaluwarsa).getTime() - KINI) / 86400000) : null;
                      return (
                        <li key={d.id} className="flex items-center gap-3 rounded-md border border-border px-4 py-3 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{d.judul} <span className="text-xs text-muted-foreground">· {d.jenis}</span></p>
                            <p className="text-xs text-muted-foreground">
                              {d.file_key ? <button type="button" onClick={() => bukaBerkas(d.file_key)} className="text-primary hover:underline">Buka file</button> : "Belum ada file"}
                              {d.kedaluwarsa ? ` · s.d. ${tglISOtoID(d.kedaluwarsa)}` : ""}
                            </p>
                          </div>
                          {exp !== null ? (
                            exp < 0 ? <Badge variant="destructive">kedaluwarsa</Badge> : exp <= 30 ? <Badge variant="warning">{exp} hari lagi</Badge> : <Badge variant="success">berlaku</Badge>
                          ) : null}
                          {kelola ? <Button size="sm" variant="outline" onClick={() => hapusDok(d.id)}>Hapus</Button> : null}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {lihat ? (
          <TabsContent value="onboarding">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Checklist onboarding</CardTitle>
                <CardDescription>{(onboard ?? []).filter((o) => o.selesai).length}/{(onboard ?? []).length} selesai</CardDescription>
              </CardHeader>
              <CardContent>
                {!onboard ? <p className="text-sm text-muted-foreground">Memuat…</p> : (
                  <ol className="grid gap-2">
                    {onboard.map((o) => (
                      <li key={o.id} className="flex items-center gap-3 rounded-md border border-border px-4 py-3 text-sm">
                        <input type="checkbox" checked={!!o.selesai} disabled={!kelola} onChange={() => toggleOnboard(o.id, !!o.selesai)} className="h-4 w-4" />
                        <span className={o.selesai ? "text-muted-foreground line-through" : "font-medium"}>{o.item}</span>
                        {o.selesai_at ? <span className="tnum ml-auto text-[11px] text-muted-foreground">{tglISOtoID(o.selesai_at)}</span> : null}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
