import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, bisa, type Employee, type Penilaian, type SessionUser } from "../lib/api";

export function Kinerja() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [kary, setKary] = useState<Employee[]>([]);
  const [empId, setEmpId] = useState<number | "">("");
  const [rows, setRows] = useState<Penilaian[] | null>(null);
  const [f, setF] = useState({ periode: new Date().toISOString().slice(0, 7), target: "", skor: "", catatan: "", rencana_kembang: "" });

  useEffect(() => {
    api.me().then((m) => {
      setMe(m);
      if (m.role === "pegawai") api.penilaian().then(setRows).catch((e) => toast(e.message));
      else api.employees().then(setKary).catch((e) => toast(e.message));
    }).catch(() => {});
  }, []);

  const muat = (id: number) => {
    setRows(null);
    api.penilaian(id).then(setRows).catch((e) => toast(e.message));
  };

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId) { toast("Pilih karyawan dulu."); return; }
    try {
      await api.simpanPenilaian({ employee_id: empId, periode: f.periode, target: f.target || undefined, skor: f.skor ? Number(f.skor) : null, catatan: f.catatan || undefined, rencana_kembang: f.rencana_kembang || undefined });
      toast("Penilaian tersimpan.");
      muat(empId);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  const kelola = bisa(me, "kpi.kelola");
  if (me && me.role !== "pegawai" && !kelola)
    return <p className="text-sm text-muted-foreground">Butuh izin <b>kpi.kelola</b>.</p>;

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Target, skor & pengembangan</b></p>
        <h1 className="font-display text-2xl font-bold">Kinerja</h1>
      </div>
      {kelola ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Input penilaian</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={simpan} className="grid gap-3 md:grid-cols-3 md:items-end">
              <Field label="Karyawan">
                <Select value={empId} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ""; setEmpId(v); if (v) muat(v); }}>
                  <option value="">— pilih —</option>
                  {kary.map((k) => <option key={k.id} value={k.id}>{k.nama_gelar} · {k.nip}</option>)}
                </Select>
              </Field>
              <Field label="Periode (YYYY-MM)"><Input value={f.periode} onChange={(e) => setF({ ...f, periode: e.target.value })} placeholder="2026-09" required /></Field>
              <Field label="Skor (1–5)">
                <Select value={f.skor} onChange={(e) => setF({ ...f, skor: e.target.value })}>
                  <option value="">— belum dinilai —</option>
                  {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Target / KPI"><Input value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="cth. Kehadiran 100%" /></Field>
              <Field label="Catatan atasan"><Input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} /></Field>
              <Field label="Rencana pengembangan"><Input value={f.rencana_kembang} onChange={(e) => setF({ ...f, rencana_kembang: e.target.value })} placeholder="cth. Pelatihan tahsin" /></Field>
              <Button type="submit">Simpan</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{me?.role === "pegawai" ? "Riwayat performa saya" : "Riwayat penilaian"}</CardTitle>
          <CardDescription>{me?.role === "pegawai" ? "Target, skor, dan rencana pengembangan Anda." : "Pilih karyawan untuk melihat riwayat."}</CardDescription>
        </CardHeader>
        <CardContent>
          {!rows ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada penilaian.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Periode</TableHead><TableHead>Target</TableHead><TableHead>Skor</TableHead><TableHead>Catatan</TableHead><TableHead>Rencana kembang</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tnum">{r.periode}</TableCell>
                    <TableCell className="text-xs">{r.target ?? "–"}</TableCell>
                    <TableCell>{r.skor ? <Badge variant={r.skor >= 4 ? "success" : r.skor === 3 ? "warning" : "destructive"}>{r.skor}/5</Badge> : <span className="text-xs text-muted-foreground">–</span>}</TableCell>
                    <TableCell className="text-xs">{r.catatan ?? "–"}</TableCell>
                    <TableCell className="text-xs">{r.rencana_kembang ?? "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
