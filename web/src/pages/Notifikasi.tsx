import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Field, Input } from "../components/ui/input";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, type NotifItem, type Pengumuman, type SessionUser } from "../lib/api";
import { tglISOtoID } from "../lib/format";

export function Notifikasi() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [notif, setNotif] = useState<{ belum_dibaca: number; items: NotifItem[] } | null>(null);
  const [mum, setMum] = useState<Pengumuman[] | null>(null);
  const [f, setF] = useState({ judul: "", isi: "" });

  const muat = () => {
    api.notifikasi().then(setNotif).catch((e) => toast(e.message));
    api.pengumuman(me?.role === "master_admin" || me?.role === "hr_cabang").then(setMum).catch(() => setMum([]));
  };
  useEffect(() => { api.me().then(setMe).catch(() => {}); }, []);
  useEffect(() => { muat(); }, [me]); // eslint-disable-line

  const baca = async (id?: number) => {
    await api.bacaNotifikasi(id);
    muat();
    window.dispatchEvent(new CustomEvent("hr:notif"));
  };

  const buat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.buatPengumuman(f);
      toast("Pengumuman diterbitkan.");
      setF({ judul: "", isi: "" });
      muat();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  const arsip = async (id: number, aktif: number) => {
    try {
      await api.ubahPengumuman(id, { aktif });
      muat();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  const kelolaMumum = me?.role === "master_admin" || me?.role === "hr_cabang";

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Info & kabar</b></p>
        <h1 className="font-display text-2xl font-bold">Notifikasi</h1>
      </div>
      <Tabs defaultValue="notif">
        <TabsList>
          <TabsTrigger value="notif">Notifikasi{notif && notif.belum_dibaca > 0 ? ` (${notif.belum_dibaca})` : ""}</TabsTrigger>
          <TabsTrigger value="mum">Pengumuman</TabsTrigger>
        </TabsList>
        <TabsContent value="notif">
          <Card>
            <CardHeader>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <CardTitle className="text-base">Pemberitahuan untuk Anda</CardTitle>
                  <CardDescription>Status pengajuan, slip gaji terbit, dan lainnya.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => baca()}>Tandai semua dibaca</Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!notif ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : notif.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pemberitahuan.</p>
              ) : notif.items.map((n) => (
                <button key={n.id} onClick={() => baca(n.id)} className={`rounded-md border border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 ${n.dibaca ? "opacity-70" : ""}`}>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-semibold">{n.judul}</p>
                    {!n.dibaca ? <Badge variant="default">baru</Badge> : null}
                  </div>
                  {n.isi ? <p className="mt-1 text-xs text-muted-foreground">{n.isi}</p> : null}
                  <p className="tnum mt-1 text-[11px] text-muted-foreground">{new Date(n.waktu).toLocaleString("id-ID")}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="mum">
          <div className="grid gap-5">
            {kelolaMumum ? (
              <Card>
                <CardHeader><CardTitle className="text-base">Terbitkan pengumuman</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={buat} className="grid gap-3">
                    <Field label="Judul"><Input value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} required /></Field>
                    <Field label="Isi"><Input value={f.isi} onChange={(e) => setF({ ...f, isi: e.target.value })} required /></Field>
                    <div><Button type="submit">Terbitkan</Button></div>
                  </form>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader><CardTitle className="text-base">{kelolaMumum ? "Semua pengumuman" : "Pengumuman perusahaan"}</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {!mum ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : mum.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>
                ) : mum.map((m) => (
                  <div key={m.id} className="rounded-md border border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-sm font-semibold">{m.judul}</p>
                      {kelolaMumum && m.aktif === 0 ? <Badge variant="muted">arsip</Badge> : null}
                      {kelolaMumum ? (
                        <Button size="sm" variant="outline" onClick={() => arsip(m.id, m.aktif === 0 ? 1 : 0)}>
                          {m.aktif === 0 ? "Aktifkan" : "Arsipkan"}
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{m.isi}</p>
                    <p className="tnum mt-1 text-[11px] text-muted-foreground">{tglISOtoID(m.waktu)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
