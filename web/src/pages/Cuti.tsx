import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, bisa, type CutiSaldo, type Employee, type SessionUser } from "../lib/api";
import { tglISOtoID } from "../lib/format";

interface Cuti {
  id: number; employee_id: number; nip?: string; nama_gelar?: string;
  jenis: string; tgl_mulai: string; tgl_selesai: string; status: string; keterangan: string | null;
}

const BADGE: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  disetujui: "success", diajukan: "warning", ditolak: "destructive",
};

const JENIS_CUTI: Record<string, string> = {
  tahunan: "Tahunan", sakit: "Sakit", keluarga: "Keluarga", tugas_luar: "Tugas luar",
  terlambat: "Izin terlambat", melahirkan: "Melahirkan", lainnya: "Lainnya",
};

export function Cuti() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Cuti[] | null>(null);
  const [form, setForm] = useState({ jenis: "tahunan", tgl_mulai: "", tgl_selesai: "", keterangan: "" });
  const [saldo, setSaldo] = useState<CutiSaldo | CutiSaldo[] | null>(null);
  const [kary, setKary] = useState<Employee[]>([]);
  const [jatahEdit, setJatahEdit] = useState<Record<number, string>>({});

  const muat = () => {
    api.cuti().then(setRows).catch((e) => toast(e.message));
    api.cutiSaldo().then((d) => {
      setSaldo(d);
      if (Array.isArray(d)) {
        setJatahEdit(Object.fromEntries(d.map((s) => [s.employee_id, String(s.jatah)])));
        api.employees().then(setKary).catch(() => {});
      }
    }).catch(() => {});
  };
  useEffect(() => { api.me().then(setMe).catch(() => {}); muat(); }, []);

  const dapatSetujui = bisa(me, "cuti.setujui");
  const dapatAjukan = bisa(me, "cuti.ajukan");
  // multi = daftar campuran milik sendiri + bawahan (pegawai yang juga atasan)
  const multi = new Set((rows ?? []).map((r) => r.employee_id)).size > 1;

  const ajukan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.ajukanCuti(form);
      toast("Pengajuan cuti terkirim.");
      setForm({ jenis: "tahunan", tgl_mulai: "", tgl_selesai: "", keterangan: "" });
      muat();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  const putus = async (id: number, status: "disetujui" | "ditolak") => {
    try {
      await api.putusCuti(id, status);
      toast(`Cuti ${status}.`);
      muat();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Cuti & izin</b></p>
        <h1 className="font-display text-2xl font-bold">Cuti</h1>
      </div>
      {saldo && !Array.isArray(saldo) ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6 py-4">
            <div>
              <p className="text-xs text-muted-foreground">Saldo cuti tahunan {saldo.tahun}</p>
              <p className="tnum text-2xl font-bold">{saldo.sisa} <span className="text-sm font-normal text-muted-foreground">hari tersisa</span></p>
            </div>
            <p className="tnum text-xs text-muted-foreground">jatah {saldo.jatah} · terpakai {saldo.terpakai}</p>
          </CardContent>
        </Card>
      ) : null}
      {saldo && Array.isArray(saldo) && dapatSetujui ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Saldo cuti karyawan</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Jatah</TableHead><TableHead>Terpakai</TableHead><TableHead>Sisa</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {saldo.map((s) => {
                  const k = kary.find((e) => e.id === s.employee_id);
                  return (
                    <TableRow key={s.employee_id}>
                      <TableCell className="font-medium">{k?.nama_gelar ?? s.employee_id}</TableCell>
                      <TableCell>
                        <Input value={jatahEdit[s.employee_id] ?? String(s.jatah)} onChange={(e) => setJatahEdit((j) => ({ ...j, [s.employee_id]: e.target.value }))} className="max-w-[80px]" inputMode="numeric" />
                      </TableCell>
                      <TableCell className="tnum">{s.terpakai}</TableCell>
                      <TableCell className="tnum font-semibold">{s.sisa}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={async () => {
                          try {
                            await api.setJatahCuti(s.employee_id, s.tahun, Number(jatahEdit[s.employee_id]));
                            toast("Jatah tersimpan.");
                            muat();
                          } catch (e) { toast(e instanceof Error ? e.message : "Gagal"); }
                        }}>Simpan</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      {dapatAjukan ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Ajukan cuti</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={ajukan} className="grid gap-3 md:grid-cols-5 md:items-end">
              <Field label="Jenis">
                <Select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
                  {Object.entries(JENIS_CUTI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Mulai"><Input type="date" value={form.tgl_mulai} onChange={(e) => setForm({ ...form, tgl_mulai: e.target.value })} required /></Field>
              <Field label="Selesai"><Input type="date" value={form.tgl_selesai} onChange={(e) => setForm({ ...form, tgl_selesai: e.target.value })} required /></Field>
              <Field label="Keterangan"><Input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Opsional" /></Field>
              <Button type="submit">Kirim</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dapatSetujui ? "Semua pengajuan cabang" : "Pengajuan saya"}</CardTitle>
          <CardDescription>{dapatSetujui ? "Setujui atau tolak pengajuan yang masih diajukan." : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {!rows ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pengajuan.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                {dapatSetujui || multi ? <TableHead>Nama</TableHead> : null}
                <TableHead>Jenis</TableHead><TableHead>Rentang</TableHead><TableHead>Status</TableHead>
                {dapatSetujui || multi ? <TableHead /> : null}
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    {dapatSetujui || multi ? <TableCell className="font-medium">{r.nama_gelar} <span className="tnum text-xs text-muted-foreground">{r.nip}</span></TableCell> : null}
                    <TableCell>{JENIS_CUTI[r.jenis] ?? r.jenis}</TableCell>
                    <TableCell className="tnum text-xs">{tglISOtoID(r.tgl_mulai)} → {tglISOtoID(r.tgl_selesai)}</TableCell>
                    <TableCell><Badge variant={BADGE[r.status] ?? "muted"}>{r.status}</Badge></TableCell>
                    {dapatSetujui || multi ? (
                      <TableCell>
                        {r.status === "diajukan" ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => putus(r.id, "disetujui")}>Setujui</Button>
                            <Button size="sm" variant="outline" onClick={() => putus(r.id, "ditolak")}>Tolak</Button>
                          </div>
                        ) : null}
                      </TableCell>
                    ) : null}
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
