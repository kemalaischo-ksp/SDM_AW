import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton } from "../components/ui/tabs";
import { api, bisa, type SessionUser } from "../lib/api";

export function Audit() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.audit>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    api.audit().then(setRows).catch((e) => setErr(e instanceof Error ? e.message : "Gagal memuat audit"));
  }, []);

  if (me && !bisa(me, "audit.lihat"))
    return <p className="text-sm text-muted-foreground">Butuh izin <b>audit.lihat</b>.</p>;

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Jejak aktivitas</b></p>
        <h1 className="font-display text-2xl font-bold">Audit Log</h1>
      </div>
      <Card className="wd-card overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">{rows ? `${rows.length} aktivitas terakhir` : "Aktivitas terakhir"}</CardTitle>
          <CardDescription>100 baris terbaru dari audit_logs</CardDescription>
        </CardHeader>
        <CardContent>
          {!rows && !err ? (
            <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : rows!.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Waktu</TableHead><TableHead>Aksi</TableHead><TableHead>Tabel</TableHead><TableHead>ID</TableHead><TableHead>Pengguna</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows!.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tnum text-xs">{new Date(r.waktu).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="font-medium">{r.aksi}</TableCell>
                    <TableCell>{r.tabel ?? "–"}</TableCell>
                    <TableCell className="tnum">{r.record_id ?? "–"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.user_id.slice(0, 8)}</TableCell>
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
