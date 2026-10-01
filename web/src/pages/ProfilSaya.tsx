import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/tabs";
import { api, type Dokumen, type Penilaian, type Profil, type RiwayatJabatan } from "../lib/api";
import { masaKerja, rupiah, tglISOtoID } from "../lib/format";
import { isArsipUrl, useArsip } from "../lib/unduh";

const DOK_WAJIB: { label: string; cocok: string[] }[] = [
  { label: "KTP", cocok: ["ktp"] },
  { label: "KK", cocok: ["kk"] },
  { label: "Ijazah", cocok: ["ijazah"] },
  { label: "Kontrak kerja", cocok: ["kontrak", "spk"] },
];

function Baris({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

export function ProfilSaya() {
  const [p, setP] = useState<Profil | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatJabatan[]>([]);
  const [dok, setDok] = useState<Dokumen[]>([]);
  const [nilai, setNilai] = useState<Penilaian[]>([]);
  const [gagal, setGagal] = useState<string | null>(null);
  const foto = useArsip(p?.foto_url ?? null);

  useEffect(() => {
    api.profilSaya()
      .then((d) => {
        setP(d);
        api.riwayatJabatan().then(setRiwayat).catch(() => {});
        api.dokumen().then(setDok).catch(() => {});
        api.penilaian().then(setNilai).catch(() => {});
      })
      .catch((e) => setGagal(e instanceof Error ? e.message : "Gagal memuat profil"));
  }, []);

  if (gagal) return <p className="text-sm text-muted-foreground">{gagal}</p>;
  if (!p)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-32" /><Skeleton className="h-48" />
      </div>
    );

  const kontrak = dok.filter((d) => ["kontrak", "spk"].includes(d.jenis.toLowerCase()));

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Data & profil saya</b></p>
        <h1 className="font-display text-2xl font-bold">Profil Saya</h1>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-5">
          {foto ? (
            <img src={foto} alt="Foto profil" className="h-20 w-20 rounded-full border border-border object-cover" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full bg-primary text-2xl font-bold text-white">
              {(p.nama_gelar || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{p.nama_gelar}</p>
            <p className="text-sm text-muted-foreground">
              {p.posisi_diajukan || p.jabatan || "–"}{p.mapel ? ` · ${p.mapel}` : ""} · {p.unit || "–"}{p.cabang ? ` · ${p.cabang}` : ""}
            </p>
            <p className="tnum text-xs text-muted-foreground">NIP {p.nip}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant={p.status_kerja === "aktif" ? "success" : "muted"}>{p.status_kerja ?? "aktif"}</Badge>
            <Badge variant={p.status_aktivasi === "aktif" ? "success" : "warning"}>{p.status_aktivasi}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Data karyawan</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-3 text-sm">
              <Baris k="Tanggal masuk" v={tglISOtoID(p.tgl_masuk ?? p.tmt_aktif)} />
              <Baris k="Masa kerja" v={masaKerja(p.tgl_masuk ?? p.tmt_aktif)} />
              <Baris k="Atasan langsung" v={p.atasan_nama ?? "–"} />
              <Baris k="Email" v={p.email ?? "–"} />
              <Baris k="No HP" v={<span className="tnum">{p.no_hp ?? "–"}</span>} />
              <Baris k="Alamat" v={p.alamat ?? "–"} />
              <Baris k="Kontak darurat" v={p.kontak_darurat ?? "–"} />
              <Baris k="TTL" v={`${p.tempat_lahir ?? "–"}, ${tglISOtoID(p.tgl_lahir)}`} />
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">NIK KTP disembunyikan (kebijakan data sensitif).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Rekening & THP</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-3 text-sm">
              <Baris k="Bank utama" v={p.bank_utama ?? "–"} />
              <Baris k="No. rekening" v={<span className="tnum">{p.norek_utama ?? "–"}</span>} />
              {p.bank_lain ? <Baris k="Bank lain" v={p.bank_lain} /> : null}
              {p.norek_lain ? <Baris k="Rek. lain" v={<span className="tnum">{p.norek_lain}</span>} /> : null}
              <Baris k="THP bersih" v={rupiah(p.thp_bersih)} />
              <Baris k="TMT aktif" v={tglISOtoID(p.tmt_aktif)} />
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Rekening salah? Ajukan via menu <b>Pengajuan → Ubah data</b>.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dokumen</CardTitle>
          <CardDescription>Jenis wajib yang sudah dan belum dilengkapi.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {DOK_WAJIB.map((w) => {
            const ada = dok.find((d) => w.cocok.includes(d.jenis.toLowerCase()));
            return (
              <div key={w.label} className="flex items-center gap-3 rounded-md border border-border px-4 py-2.5 text-sm">
                <span className="flex-1 font-medium">{w.label}</span>
                {ada ? (
                  <>
                    <span className="truncate text-xs text-muted-foreground">{ada.judul}</span>
                    <Badge variant="success">lengkap</Badge>
                  </>
                ) : (
                  <Badge variant="warning">belum ada</Badge>
                )}
              </div>
            );
          })}
          {dok.filter((d) => !DOK_WAJIB.some((w) => w.cocok.includes(d.jenis.toLowerCase()))).map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-md border border-border px-4 py-2.5 text-sm">
              <span className="flex-1">{d.judul} <span className="text-xs text-muted-foreground">· {d.jenis}</span></span>
              <Badge variant="secondary">tambahan</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Riwayat jabatan & gaji</CardTitle></CardHeader>
          <CardContent>
            {riwayat.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada riwayat.</p> : (
              <ol className="grid gap-2">
                {riwayat.map((r) => (
                  <li key={r.id} className="rounded-md border border-border px-4 py-3 text-sm">
                    <p className="tnum text-xs text-muted-foreground">{tglISOtoID(r.tanggal)}</p>
                    <p>{r.jabatan_lama || "–"} → <b>{r.jabatan_baru || "–"}</b></p>
                    <p className="tnum text-xs">{rupiah(r.gaji_lama)} → {rupiah(r.gaji_baru)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Riwayat kontrak</CardTitle></CardHeader>
          <CardContent>
            {kontrak.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada kontrak tercatat.</p> : (
              <ol className="grid gap-2">
                {kontrak.map((d) => (
                  <li key={d.id} className="rounded-md border border-border px-4 py-3 text-sm">
                    <p className="font-medium">{d.judul}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.file_key ? (
                        isArsipUrl(d.file_key)
                          ? <button type="button" onClick={() => api.bukaArsip(d.file_key!).catch(() => {})} className="text-primary hover:underline">Buka file</button>
                          : <a href={d.file_key} target="_blank" rel="noreferrer" className="text-primary hover:underline">Buka file</a>
                      ) : "File belum ditautkan"}
                      {d.kedaluwarsa ? ` · s.d. ${tglISOtoID(d.kedaluwarsa)}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Evaluasi internal</CardTitle></CardHeader>
        <CardContent>
          {nilai.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada penilaian.</p> : (
            <ol className="grid gap-2">
              {nilai.map((n) => (
                <li key={n.id} className="rounded-md border border-border px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="tnum font-semibold">{n.periode}</span>
                    {n.skor ? <Badge variant={n.skor >= 4 ? "success" : n.skor === 3 ? "warning" : "destructive"}>{n.skor}/5</Badge> : null}
                  </div>
                  {n.target ? <p className="mt-1 text-xs">Target: {n.target}</p> : null}
                  {n.catatan ? <p className="text-xs text-muted-foreground">Catatan: {n.catatan}</p> : null}
                  {n.rencana_kembang ? <p className="text-xs text-muted-foreground">Pengembangan: {n.rencana_kembang}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
