import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, bisa, type SessionUser } from "../lib/api";

const STATUS = ["hadir", "izin", "sakit", "cuti", "alpa", "dinas"];
const BADGE: Record<string, "success" | "warning" | "destructive" | "muted" | "secondary"> = {
  hadir: "success", dinas: "secondary", izin: "warning", sakit: "warning", cuti: "secondary", alpa: "destructive",
};

const hariIni = () => new Date().toISOString().slice(0, 10);

export function Absensi() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [tanggal, setTanggal] = useState(hariIni());
  const [rows, setRows] = useState<{ employee_id: number; nip: string; nama_gelar: string; status: string | null; keterangan: string | null }[] | null>(null);
  const [edit, setEdit] = useState<Record<number, string>>({});

  const muat = (tgl: string) => {
    setRows(null);
    api.absensi(tgl).then((d) => {
      setRows(d.rows);
      setEdit(Object.fromEntries(d.rows.map((r) => [r.employee_id, r.status ?? "hadir"])));
    }).catch((e) => toast(e.message));
  };
  useEffect(() => { api.me().then(setMe).catch(() => {}); muat(tanggal); }, []); // eslint-disable-line

  if (me && !bisa(me, "absensi.kelola")) return <p className="text-sm text-muted-foreground">Butuh izin <b>absensi.kelola</b>.</p>;

  const simpan = async (employee_id: number) => {
    try {
      await api.catatAbsensi({ employee_id, tanggal, status: edit[employee_id] ?? "hadir" });
      toast("Absensi tersimpan.");
      muat(tanggal);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Kehadiran</b></p>
          <h1 className="font-display text-2xl font-bold">Absensi AW3</h1>
        </div>
        <Input type="date" value={tanggal} onChange={(e) => { setTanggal(e.target.value); muat(e.target.value); }} className="max-w-[200px]" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tanggal}</CardTitle>
          <CardDescription>Ubah status lalu Simpan per baris.</CardDescription>
        </CardHeader>
        <CardContent>
          {!rows ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>NIP</TableHead><TableHead>Nama</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.employee_id}>
                    <TableCell className="tnum">{r.nip}</TableCell>
                    <TableCell className="font-medium">{r.nama_gelar}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select value={edit[r.employee_id] ?? "hadir"} onChange={(e) => setEdit((cur) => ({ ...cur, [r.employee_id]: e.target.value }))} className="max-w-[140px]">
                          {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </Select>
                        {r.status ? <Badge variant={BADGE[r.status] ?? "muted"}>{r.status}</Badge> : <Badge variant="muted">belum dicatat</Badge>}
                      </div>
                    </TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => simpan(r.employee_id)}>Simpan</Button></TableCell>
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
