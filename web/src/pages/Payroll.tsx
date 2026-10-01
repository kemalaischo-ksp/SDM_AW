import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api, bisa, type Employee, type SessionUser } from "../lib/api";
import { rupiah } from "../lib/format";

export function Payroll() {
  const [data, setData] = useState<Employee[] | null>(null);
  const [me, setMe] = useState<SessionUser | null>(null);
  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    api.employees().then((all) => setData(all.filter((e) => e.status_aktivasi === "aktif")));
  }, []);

  if (me && !bisa(me, "payroll.lihat"))
    return <p className="text-sm text-muted-foreground">Butuh izin <b>payroll.lihat</b> untuk membuka rekap cabang.</p>;

  const total = (data ?? []).reduce((s, e) => s + e.thp_bersih, 0);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Payroll cabang</b></p>
          <h1 className="font-display text-2xl font-bold">Payroll Agustus 2026</h1>
        </div>
        <Button variant="secondary">Unduh rekap</Button>
        {bisa(me, "payroll.kunci") ? <Button>Kunci periode</Button> : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">THP karyawan aktif</CardTitle>
          <CardDescription>Total <b className="tnum">{rupiah(total)}</b> untuk {(data ?? []).length} karyawan</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>NIP</TableHead><TableHead>Nama</TableHead><TableHead>Kotor</TableHead><TableHead>Pot. TK-THR</TableHead><TableHead>Bersih</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((e) => (
                <TableRow key={e.nip}>
                  <TableCell className="tnum">{e.nip}</TableCell>
                  <TableCell className="font-medium">{e.nama_gelar}</TableCell>
                  <TableCell className="tnum">{rupiah(e.thp_kotor)}</TableCell>
                  <TableCell className="tnum">{rupiah(e.total_tk_thr)}</TableCell>
                  <TableCell className="tnum font-semibold">{rupiah(e.thp_bersih)}</TableCell>
                  <TableCell><Link to={`/slip/${e.nip}`} className="text-sm font-semibold text-primary hover:underline">Slip</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
