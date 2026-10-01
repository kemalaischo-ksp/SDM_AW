import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, STATUS_BADGE, STATUS_LABEL } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/tabs";
import { api, bisa, type Dokumen, type Employee, type Pengumuman, type PresensiSaya, type Profil, type SessionUser, type Statistik } from "../lib/api";
import { masaKerja, rupiah, tglISOtoID } from "../lib/format";

function Bar({ label, value, maks }: { label: string; value: number; maks: number }) {
  const pct = maks > 0 ? Math.round((value / maks) * 100) : 0;
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{label}</span>
        <span className="tnum text-muted-foreground">{value} · {pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-[#e14eca] to-[#1d8cf8]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<Employee[] | null>(null);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [pres, setPres] = useState<PresensiSaya | null>(null);
  const [mum, setMum] = useState<Pengumuman[]>([]);
  const [dokExp, setDokExp] = useState<(Dokumen & { nip?: string; nama_gelar?: string })[]>([]);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [stat, setStat] = useState<Statistik | null>(null);

  useEffect(() => {
    api.employees().then(setData);
    api.pengumuman().then(setMum).catch(() => {});
    api.me().then((m) => {
      setMe(m);
      if (bisa(m, "laporan.lihat") || bisa(m, "karyawan.lihat"))
        api.statistik().then(setStat).catch(() => {});
      if (m.role === "pegawai") {
        api.profilSaya().then(setProfil).catch(() => {});
        api.presensiSaya().then(setPres).catch(() => {});
      } else {
        if (bisa(m, "presensi.mandiri") && !bisa(m, "absensi.kelola"))
          api.presensiSaya().then(setPres).catch(() => {});
      }
      if (bisa(m, "karyawan.kelola"))
        api.dokumenKedaluwarsa().then(setDokExp).catch(() => {});
    }).catch(() => {});
  }, []);

  if (!data)
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );

  const aktif = data.filter((e) => e.status_aktivasi === "aktif");
  const pending = data.filter((e) => e.status_aktivasi !== "aktif");
  const totalThp = aktif.reduce((s, e) => s + e.thp_bersih, 0);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">AW3 BSD City</b></p>
        <h1 className="font-display text-2xl font-bold">{me?.role === "pegawai" ? "Dashboard saya" : me?.role === "master_admin" ? "Dashboard holding" : "Dashboard cabang"}</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Karyawan aktif", value: String(aktif.length), icon: "👥", tint: "bg-[#fce8f5] text-primary" },
          { label: "Menunggu aktivasi", value: String(pending.length), icon: "⏳", tint: "bg-[#e3f0ff] text-info" },
          { label: "Total THP bersih aktif", value: rupiah(totalThp), icon: "💰", tint: "bg-[#e6faf4] text-success", small: true },
        ].map((s) => (
          <Card key={s.label} className="wd-card">
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl ${s.tint}`}>{s.icon}</div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">{s.label}</p>
                <p className={`tnum truncate font-bold text-foreground ${s.small ? "text-xl" : "text-3xl"}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {stat && me?.role !== "pegawai" ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Total cabang", value: String(stat.total.cabang), icon: "🏫", tint: "bg-[#e3f0ff] text-info" },
              { label: "Pria", value: String(stat.gender.pria), icon: "👨", tint: "bg-[#e3f0ff] text-info" },
              { label: "Perempuan", value: String(stat.gender.perempuan), icon: "👩", tint: "bg-[#fce8f5] text-primary" },
            ].map((s) => (
              <Card key={s.label} className="wd-card">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl ${s.tint}`}>{s.icon}</div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">{s.label}</p>
                    <p className="tnum truncate text-3xl font-bold text-foreground">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="wd-card overflow-hidden">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle>Statistik per cabang</CardTitle>
              <CardDescription>{stat.total.total} karyawan · {stat.total.aktif} aktif · {stat.total.pending} menunggu{stat.gender.tanpa ? ` · ${stat.gender.tanpa} gender belum diisi` : ""}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[.1em] text-muted-foreground">
                    <th className="px-4 py-2">Cabang</th>
                    <th className="px-4 py-2 text-right tnum">Total</th>
                    <th className="px-4 py-2 text-right tnum">Aktif</th>
                    <th className="px-4 py-2 text-right tnum">Pending</th>
                    <th className="px-4 py-2 text-right tnum">Pria</th>
                    <th className="px-4 py-2 text-right tnum">Perempuan</th>
                  </tr>
                </thead>
                <tbody>
                  {stat.per_cabang.map((c) => (
                    <tr key={c.kode ?? c.nama} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2 font-medium">{c.nama}{c.kode && c.kode !== c.nama ? <span className="ml-1 font-mono text-[11px] text-muted-foreground">{c.kode}</span> : null}</td>
                      <td className="px-4 py-2 text-right font-bold tnum">{c.total}</td>
                      <td className="px-4 py-2 text-right text-success tnum">{c.aktif}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground tnum">{c.pending}</td>
                      <td className="px-4 py-2 text-right tnum">{c.pria}</td>
                      <td className="px-4 py-2 text-right tnum">{c.perempuan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="wd-card">
              <CardHeader className="pb-2"><CardTitle>Pendidikan (jenjang tertinggi)</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {[["S3", stat.per_pendidikan.S3], ["S2", stat.per_pendidikan.S2], ["S1", stat.per_pendidikan.S1], ["Belum diisi", stat.per_pendidikan.belum]].map(([label, v]) => (
                  <Bar key={label as string} label={label as string} value={v as number} maks={stat.total.total} />
                ))}
              </CardContent>
            </Card>
            <Card className="wd-card">
              <CardHeader className="pb-2"><CardTitle>Divisi (unit)</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {stat.per_divisi.slice(0, 8).map((d) => (
                  <Bar key={d.unit} label={`${d.unit} (${d.aktif}/${d.total} aktif)`} value={d.total} maks={stat.total.total} />
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
      {me?.role === "pegawai" && profil ? (
        <Card className="wd-card">
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            {profil.foto_url ? (
              <img src={profil.foto_url} alt="Foto profil" className="h-14 w-14 rounded-full border border-border object-cover" />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-xl font-bold text-white">
                {(profil.nama_gelar || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{profil.nama_gelar}</p>
              <p className="text-xs text-muted-foreground">
                {profil.posisi_diajukan || profil.jabatan || "–"} · {profil.unit || "–"} · Masuk {tglISOtoID(profil.tgl_masuk ?? profil.tmt_aktif)} ({masaKerja(profil.tgl_masuk ?? profil.tmt_aktif)})
              </p>
            </div>
            <Badge variant={profil.status_kerja === "aktif" ? "success" : "muted"}>{profil.status_kerja ?? "aktif"}</Badge>
            <Link to="/profil"><Button size="sm" variant="secondary">Lihat profil</Button></Link>
            {bisa(me, "slip.lihat") ? <Link to={`/slip/${profil.nip}`}><Button size="sm">Slip saya</Button></Link> : null}
          </CardContent>
        </Card>
      ) : null}
      {mum.length > 0 ? (
        <Card className="wd-card">
          <CardHeader><CardTitle>Pengumuman</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {mum.slice(0, 3).map((m) => (
              <div key={m.id} className="rounded-md border border-border px-4 py-3">
                <p className="text-sm font-semibold">{m.judul}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.isi}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {dokExp.length > 0 ? (
        <Card className="wd-card">
          <CardHeader>
            <CardTitle>Dokumen segera kedaluwarsa</CardTitle>
            <CardDescription>{dokExp.length} dokumen kedaluwarsa ≤ 60 hari</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {dokExp.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{d.nama_gelar} · {d.judul} ({d.jenis})</span>
                <Badge variant="warning" className="tnum">{tglISOtoID(d.kedaluwarsa)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {me && bisa(me, "presensi.mandiri") && !bisa(me, "absensi.kelola") ? (
        <Card className="wd-card">
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Presensi hari ini · {tglISOtoID(pres?.tanggal ?? null)}
              </p>
              <p className="text-xs text-muted-foreground">
                {!pres
                  ? "Memuat status…"
                  : pres.hari_ini?.check_out
                    ? `Selesai (masuk ${pres.hari_ini.check_in ? new Date(pres.hari_ini.check_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "–"})`
                    : pres.hari_ini?.check_in
                      ? "Sudah check-in — jangan lupa check-out."
                      : "Belum presensi hari ini."}
              </p>
            </div>
            {pres?.hari_ini?.check_in ? <Badge variant="success">sudah masuk</Badge> : <Badge variant="muted">belum presensi</Badge>}
            <Link to="/presensi"><Button size="sm">Buka presensi</Button></Link>
          </CardContent>
        </Card>
      ) : null}
      <Card className="wd-card">
        <CardHeader>
          <CardTitle>Perlu perhatian</CardTitle>
          <CardDescription>Pengajuan aktivasi yang belum selesai</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Semua karyawan sudah aktif. 🎉</p>
          ) : (
            pending.map((e) => (
              <Link
                key={e.nip}
                to={`/karyawan/${e.nip}`}
                className="flex items-center gap-3 rounded-md border border-border px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.nama_gelar}</p>
                  <p className="text-xs text-muted-foreground tnum">NIP {e.nip} · {e.posisi_diajukan}</p>
                </div>
                <Badge variant={STATUS_BADGE[e.status_aktivasi]}>{STATUS_LABEL[e.status_aktivasi]}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
