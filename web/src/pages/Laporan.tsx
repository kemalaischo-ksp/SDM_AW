import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Field, Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, bisa, type CutiSaldo, type Employee, type RekapPresensi, type SessionUser } from "../lib/api";
import { rupiah, tglISOtoID } from "../lib/format";
import { cetak, unduhCSV } from "../lib/unduh";

const bulanIni = () => new Date().toISOString().slice(0, 7);
const hariIni = () => new Date().toISOString().slice(0, 10);
const mingguIni = () => {
  const t = new Date();
  const senin = new Date(t.getTime() - ((t.getDay() + 6) % 7) * 86400000);
  const jan4 = new Date(senin.getFullYear(), 0, 4);
  const senin1 = new Date(jan4.getTime() - ((jan4.getDay() + 6) % 7) * 86400000);
  const w = Math.round((senin.getTime() - senin1.getTime()) / (7 * 86400000)) + 1;
  return `${senin.getFullYear()}-W${String(w).padStart(2, "0")}`;
};
const mingguKeRentang = (w: string): [string, string] | null => {
  const m = w.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const jan4 = new Date(Date.UTC(+m[1], 0, 4));
  const senin1 = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000);
  const awal = new Date(senin1.getTime() + (+m[2] - 1) * 7 * 86400000);
  const akhir = new Date(awal.getTime() + 6 * 86400000);
  return [awal.toISOString().slice(0, 10), akhir.toISOString().slice(0, 10)];
};

export function Laporan() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [bulan, setBulan] = useState(bulanIni());
  const [mode, setMode] = useState<"harian" | "mingguan" | "bulanan">("bulanan");
  const [tglHarian, setTglHarian] = useState(hariIni());
  const [minggu, setMinggu] = useState(mingguIni());
  const [harian, setHarian] = useState<{ tanggal: string; rows: { employee_id: number; nip: string; nama_gelar: string; status: string | null; keterangan: string | null }[] } | null>(null);
  const [rekap, setRekap] = useState<RekapPresensi | null>(null);
  const [kary, setKary] = useState<Employee[] | null>(null);
  const [saldo, setSaldo] = useState<CutiSaldo[] | null>(null);

  useEffect(() => { api.me().then(setMe).catch(() => {}); }, []);
  useEffect(() => { api.employees().then(setKary).catch((e) => toast(e.message)); }, []);
  const muatRekap = (b: string) => {
    setRekap(null);
    api.rekapPresensi({ bulan: b }).then(setRekap).catch((e) => toast(e.message));
  };
  const muatRentang = (dari: string, sampai: string) => {
    setRekap(null);
    api.rekapPresensi({ dari, sampai }).then(setRekap).catch((e) => toast(e.message));
  };
  const muatHarian = (t: string) => {
    setHarian(null);
    api.absensi(t).then(setHarian).catch((e) => toast(e.message));
  };
  const muatSaldo = () => api.cutiSaldo().then((d) => setSaldo(Array.isArray(d) ? d : [])).catch((e) => toast(e.message));
  useEffect(() => { muatRekap(bulan); muatSaldo(); muatHarian(tglHarian); }, []); // eslint-disable-line

  if (me && !bisa(me, "laporan.lihat") && !bisa(me, "absensi.kelola"))
    return <p className="text-sm text-muted-foreground">Butuh izin <b>laporan.lihat</b>.</p>;

  const csvKaryawan = () => unduhCSV(`karyawan-${Date.now()}`, ["NIP", "Nama", "Status kerja", "Status aktivasi", "TMT", "THP bersih"],
    (kary ?? []).map((e) => [e.nip, e.nama_gelar, e.status_kerja ?? "aktif", e.status_aktivasi, e.tmt_aktif ?? "", e.thp_bersih]));
  const csvPresensi = () => {
    if (!rekap) return;
    unduhCSV(`presensi-${rekap.bulan}`, ["NIP", "Nama", "Hadir", "Terlambat", "Pulang cepat", "Izin", "Sakit", "Cuti", "Alpa", "Dinas", "Tanpa keterangan", "Tidak hadir", "Lembur (kali)", "Lembur (jam)"],
      rekap.ringkasan.map((r) => [r.nip, r.nama_gelar, r.hadir, r.terlambat, r.pulang_cepat, r.izin, r.sakit, r.cuti, r.alpa, r.dinas, r.tanpa_keterangan, r.tidak_hadir, r.lembur_kali, r.lembur_jam]));
  };
  const csvHarian = () => {
    if (!harian) return;
    unduhCSV(`presensi-harian-${harian.tanggal}`, ["NIP", "Nama", "Status", "Keterangan"],
      harian.rows.map((r) => [r.nip, r.nama_gelar, r.status ?? "belum dicatat", r.keterangan ?? ""]));
  };
  const csvCuti = () => unduhCSV(`saldo-cuti-${Date.now()}`, ["NIP", "Nama", "Tahun", "Jatah", "Terpakai", "Sisa"],
    (saldo ?? []).map((s) => {
      const k = (kary ?? []).find((e) => e.id === s.employee_id);
      return [k?.nip ?? s.employee_id, k?.nama_gelar ?? "", s.tahun, s.jatah, s.terpakai, s.sisa];
    }));
  const csvPayroll = () => unduhCSV(`payroll-${Date.now()}`, ["NIP", "Nama", "THP kotor", "Potongan", "THP bersih"],
    (kary ?? []).filter((e) => e.status_aktivasi === "aktif").map((e) => [e.nip, e.nama_gelar, e.thp_kotor, e.total_tk_thr, e.thp_bersih]));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Rekap & export</b></p>
          <h1 className="font-display text-2xl font-bold">Laporan</h1>
        </div>
        <Button variant="outline" onClick={cetak}>Cetak / PDF</Button>
      </div>
      <Tabs defaultValue="presensi">
        <TabsList>
          <TabsTrigger value="presensi">Presensi</TabsTrigger>
          <TabsTrigger value="karyawan">Karyawan</TabsTrigger>
          <TabsTrigger value="cuti">Cuti</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>
        <TabsContent value="presensi">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1">
                  <CardTitle className="text-base">
                    {mode === "harian" ? `Kehadiran ${tglISOtoID(tglHarian)}` : `Rekap presensi ${rekap?.bulan ?? ""}`}
                  </CardTitle>
                  <CardDescription>
                    {rekap && mode !== "harian" ? `${rekap.hari_kerja} hari kerja · batas masuk ${rekap.batas.masuk} (+${rekap.batas.toleransi} mnt) · pulang ${rekap.batas.pulang}` : "Pilih periode harian, mingguan, atau bulanan."}
                  </CardDescription>
                </div>
                <div className="flex gap-1 rounded-md bg-muted p-1">
                  {(["harian", "mingguan", "bulanan"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => {
                      setMode(m);
                      if (m === "harian") muatHarian(tglHarian);
                      else if (m === "mingguan") { const r = mingguKeRentang(minggu); if (r) muatRentang(r[0], r[1]); }
                      else muatRekap(bulan);
                    }} className={`rounded-sm px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                      {m[0].toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
                {mode === "harian" ? <Field label="Tanggal"><Input type="date" value={tglHarian} onChange={(e) => { setTglHarian(e.target.value); muatHarian(e.target.value); }} /></Field> : null}
                {mode === "mingguan" ? <Field label="Minggu"><Input type="week" value={minggu} onChange={(e) => { setMinggu(e.target.value); const r = mingguKeRentang(e.target.value); if (r) muatRentang(r[0], r[1]); }} /></Field> : null}
                {mode === "bulanan" ? <Field label="Bulan"><Input type="month" value={bulan} onChange={(e) => { setBulan(e.target.value); muatRekap(e.target.value); }} /></Field> : null}
                <Button variant="outline" onClick={mode === "harian" ? csvHarian : csvPresensi}>Unduh CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              {mode === "harian" ? (
                !harian ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>NIP</TableHead><TableHead>Nama</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {harian.rows.map((r) => (
                        <TableRow key={r.employee_id}>
                          <TableCell className="tnum">{r.nip}</TableCell>
                          <TableCell className="font-medium">{r.nama_gelar}</TableCell>
                          <TableCell>{r.status ? <Badge variant={r.status === "hadir" ? "success" : r.status === "alpa" ? "destructive" : "warning"}>{r.status}</Badge> : <Badge variant="muted">belum dicatat</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : !rekap ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Hadir</TableHead><TableHead>Telat</TableHead><TableHead>Pulkam cepat</TableHead><TableHead>Izin</TableHead><TableHead>Sakit</TableHead><TableHead>Cuti</TableHead><TableHead>Alpa</TableHead><TableHead>Tanpa ket.</TableHead><TableHead>Tidak hadir</TableHead><TableHead>Lembur</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rekap.ringkasan.map((r) => (
                      <TableRow key={r.employee_id}>
                        <TableCell className="font-medium">{r.nama_gelar} <span className="tnum text-xs text-muted-foreground">{r.nip}</span></TableCell>
                        <TableCell className="tnum">{r.hadir}</TableCell>
                        <TableCell className="tnum">{r.terlambat > 0 ? <Badge variant="warning">{r.terlambat}</Badge> : 0}</TableCell>
                        <TableCell className="tnum">{r.pulang_cepat}</TableCell>
                        <TableCell className="tnum">{r.izin}</TableCell>
                        <TableCell className="tnum">{r.sakit}</TableCell>
                        <TableCell className="tnum">{r.cuti}</TableCell>
                        <TableCell className="tnum">{r.alpa > 0 ? <Badge variant="destructive">{r.alpa}</Badge> : 0}</TableCell>
                        <TableCell className="tnum">{r.tanpa_keterangan > 0 ? <Badge variant="muted">{r.tanpa_keterangan}</Badge> : 0}</TableCell>
                        <TableCell className="tnum font-semibold">{r.tidak_hadir}</TableCell>
                        <TableCell className="tnum text-xs">{r.lembur_kali > 0 ? `${r.lembur_kali}× · ${r.lembur_jam} jam` : "–"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="karyawan">
          <Card>
            <CardHeader>
              <div className="flex items-end gap-3">
                <div className="flex-1"><CardTitle className="text-base">Daftar karyawan</CardTitle><CardDescription>{(kary ?? []).length} orang</CardDescription></div>
                <Button variant="outline" onClick={csvKaryawan}>Unduh CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!kary ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>NIP</TableHead><TableHead>Nama</TableHead><TableHead>Status kerja</TableHead><TableHead>Aktivasi</TableHead><TableHead>TMT</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {kary.map((e) => (
                      <TableRow key={e.nip}>
                        <TableCell className="tnum">{e.nip}</TableCell>
                        <TableCell className="font-medium">{e.nama_gelar}</TableCell>
                        <TableCell><Badge variant={e.status_kerja === "aktif" ? "success" : "muted"}>{e.status_kerja ?? "aktif"}</Badge></TableCell>
                        <TableCell className="text-xs">{e.status_aktivasi}</TableCell>
                        <TableCell className="tnum text-xs">{tglISOtoID(e.tmt_aktif)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cuti">
          <Card>
            <CardHeader>
              <div className="flex items-end gap-3">
                <div className="flex-1"><CardTitle className="text-base">Saldo cuti tahunan</CardTitle><CardDescription>Jatah − terpakai (disetujui) = sisa</CardDescription></div>
                <Button variant="outline" onClick={csvCuti}>Unduh CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!saldo ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : saldo.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Jatah</TableHead><TableHead>Terpakai</TableHead><TableHead>Sisa</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {saldo.map((s) => {
                      const k = (kary ?? []).find((e) => e.id === s.employee_id);
                      return (
                        <TableRow key={s.employee_id}>
                          <TableCell className="font-medium">{k?.nama_gelar ?? s.employee_id}</TableCell>
                          <TableCell className="tnum">{s.jatah}</TableCell>
                          <TableCell className="tnum">{s.terpakai}</TableCell>
                          <TableCell className="tnum font-semibold">{s.sisa}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <div className="flex items-end gap-3">
                <div className="flex-1"><CardTitle className="text-base">Rekap THP aktif</CardTitle></div>
                <Button variant="outline" onClick={csvPayroll}>Unduh CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!kary ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>NIP</TableHead><TableHead>Nama</TableHead><TableHead>Kotor</TableHead><TableHead>Bersih</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {kary.filter((e) => e.status_aktivasi === "aktif").map((e) => (
                      <TableRow key={e.nip}>
                        <TableCell className="tnum">{e.nip}</TableCell>
                        <TableCell className="font-medium">{e.nama_gelar}</TableCell>
                        <TableCell className="tnum">{rupiah(e.thp_kotor)}</TableCell>
                        <TableCell className="tnum font-semibold">{rupiah(e.thp_bersih)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
