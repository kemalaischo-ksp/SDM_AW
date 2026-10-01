import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Skeleton } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, bisa, type SessionUser } from "../lib/api";

const LABEL: Record<string, string> = {
  jam_masuk_normal: "Jam masuk normal (HH:MM)",
  jam_pulang_normal: "Jam pulang normal (HH:MM)",
  toleransi_telat_menit: "Toleransi telat (menit)",
  kantor_lat: "Latitude kantor",
  kantor_lng: "Longitude kantor",
  radius_meter: "Radius presensi GPS (meter, 0 = tanpa batas)",
  jatah_cuti_tahunan: "Jatah cuti tahunan default (hari)",
};

const LABEL_SMTP: Record<string, string> = {
  SMTP_HOST: "Hostname SMTP (cth. smtp.gmail.com)",
  SMTP_PORT: "Port SMTP",
  SMTP_USER: "Username SMTP",
  SMTP_FROM: "Alamat pengirim (kosongkan = SMTP_USER)",
};

const LABEL_WA: Record<string, string> = {
  WA_URL: "Endpoint gateway WA",
};

export function Pengaturan() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [f, setF] = useState<Record<string, string>>({});

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    api.pengaturan().then((d) => { setData(d); setF(d); }).catch((e) => toast(e.message));
  }, []);

  if (me && !bisa(me, "pengaturan.kelola"))
    return <p className="text-sm text-muted-foreground">Halaman ini khusus <b>master_admin</b>.</p>;

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.simpanPengaturan(f);
      toast("Pengaturan tersimpan.");
      setData({ ...f });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Jam kerja, lokasi & jatah</b></p>
        <h1 className="font-display text-2xl font-bold">Pengaturan</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aturan presensi & cuti</CardTitle>
          <CardDescription>Berlaku untuk rekap keterlambatan, radius GPS, dan jatah cuti default.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : (
            <form onSubmit={simpan} className="grid gap-4 md:grid-cols-2">
              {Object.entries(LABEL).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} required />
                </Field>
              ))}
              <div className="md:col-span-2"><Button type="submit">Simpan pengaturan</Button></div>
            </form>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Undangan via email (SMTP)</CardTitle>
          <CardDescription>Kosong = kirim undangan email dinonaktifkan. Password aplikasi disarankan untuk Gmail.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : (
            <form onSubmit={simpan} className="grid gap-4 md:grid-cols-2">
              {Object.entries(LABEL_SMTP).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                </Field>
              ))}
              <Field label="Secure (1 = SMTPS 465, 0 = STARTTLS)">
                <Select value={f.SMTP_SECURE ?? "0"} onChange={(e) => setF({ ...f, SMTP_SECURE: e.target.value })}>
                  <option value="0">0 — STARTTLS</option>
                  <option value="1">1 — SMTPS</option>
                </Select>
              </Field>
              <Field label="Password SMTP (*** = tidak berubah)">
                <Input type="password" value={f.SMTP_PASS ?? ""} onChange={(e) => setF({ ...f, SMTP_PASS: e.target.value })} placeholder={data.SMTP_PASS === "***" ? "Sudah terisi" : "Belum diisi"} />
              </Field>
              <div className="md:col-span-2"><Button type="submit">Simpan pengaturan</Button></div>
            </form>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Undangan via WhatsApp</CardTitle>
          <CardDescription>Gateway format Fonnte (POST target + message, header Authorization = token).</CardDescription>
        </CardHeader>
        <CardContent>
          {!data ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : (
            <form onSubmit={simpan} className="grid gap-4 md:grid-cols-2">
              {Object.entries(LABEL_WA).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                </Field>
              ))}
              <Field label="Token gateway (*** = tidak berubah)">
                <Input type="password" value={f.WA_TOKEN ?? ""} onChange={(e) => setF({ ...f, WA_TOKEN: e.target.value })} placeholder={data.WA_TOKEN === "***" ? "Sudah terisi" : "Belum diisi"} />
              </Field>
              <div className="md:col-span-2"><Button type="submit">Simpan pengaturan</Button></div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
