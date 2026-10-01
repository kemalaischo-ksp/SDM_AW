import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, bisa, type JenisPengajuan, type PengajuanRow, type SessionUser } from "../lib/api";
import { rupiah, tglISOtoID } from "../lib/format";

const BADGE: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  disetujui: "success", diajukan: "warning", ditolak: "destructive",
};

const KOLOM_LABEL: Record<string, string> = {
  no_hp: "No HP", alamat: "Alamat", kontak_darurat: "Kontak darurat", status_kawin: "Status kawin",
  bank_utama: "Bank utama", norek_utama: "No. rekening utama", bank_lain: "Bank lain", norek_lain: "No. rekening lain",
};

const JENIS_SURAT: Record<string, string> = {
  keterangan_kerja: "Keterangan kerja", pengalaman_kerja: "Pengalaman kerja", tugas: "Surat tugas", lainnya: "Lainnya",
};

function Tabel({ rows, dapatSetujui, onPutus, jenis }: {
  rows: PengajuanRow[] | null; dapatSetujui: boolean;
  onPutus: (id: number, status: "disetujui" | "ditolak") => void; jenis: JenisPengajuan;
}) {
  if (!rows) return <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Belum ada pengajuan.</p>;
  // multi = daftar campuran milik sendiri + bawahan (pegawai yang juga atasan);
  // tombol putus tampil juga untuknya — server menolak bila bukan haknya.
  const multi = new Set(rows.map((r) => r.employee_id)).size > 1;
  const tunjukNama = dapatSetujui || multi;
  return (
    <Table>
      <TableHeader><TableRow>
        {tunjukNama ? <TableHead>Nama</TableHead> : null}
        <TableHead>Tanggal</TableHead><TableHead>Rincian</TableHead><TableHead>Status</TableHead>
        {tunjukNama ? <TableHead /> : null}
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            {tunjukNama ? <TableCell className="font-medium">{r.nama_gelar} <span className="tnum text-xs text-muted-foreground">{r.nip}</span></TableCell> : null}
            <TableCell className="tnum text-xs">{tglISOtoID(r.tanggal)}</TableCell>
            <TableCell className="text-xs">
              {jenis === "lembur" ? `${r.jam_mulai?.slice(0, 5)}–${r.jam_selesai?.slice(0, 5)} · ${r.keterangan || "–"}` : null}
              {jenis === "reimbursement" ? `${r.kategori} · ${rupiah(r.nominal ?? 0)} · ${r.deskripsi || "–"}` : null}
              {jenis === "surat" ? `${JENIS_SURAT[r.jenis ?? ""] ?? r.jenis}${r.nomor ? ` · No. ${r.nomor}` : ""} · ${r.keperluan || "–"}` : null}
              {jenis === "perubahan-data" ? `${KOLOM_LABEL[r.kolom ?? ""] ?? r.kolom}: ${r.nilai_lama ?? "–"} → ${r.nilai_baru}` : null}
              {jenis === "koreksi-presensi" ? `${r.kolom === "check_in" ? "Masuk" : "Pulang"} → ${r.waktu_baru?.slice(0, 5)} · ${r.alasan || "–"}` : null}
            </TableCell>
            <TableCell><Badge variant={BADGE[r.status] ?? "muted"}>{r.status}</Badge></TableCell>
            {tunjukNama ? (
              <TableCell>
                {r.status === "diajukan" ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onPutus(r.id, "disetujui")}>Setujui</Button>
                    <Button size="sm" variant="outline" onClick={() => onPutus(r.id, "ditolak")}>Tolak</Button>
                  </div>
                ) : null}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function Pengajuan() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<JenisPengajuan>("lembur");
  const [rows, setRows] = useState<Record<JenisPengajuan, PengajuanRow[] | null>>({
    lembur: null, reimbursement: null, surat: null, "perubahan-data": null, "koreksi-presensi": null,
  });
  const [f, setF] = useState({ tanggal: "", jam_mulai: "", jam_selesai: "", keterangan: "", kategori: "transport", nominal: "", deskripsi: "", bukti_url: "", jenis: "keterangan_kerja", keperluan: "", kolom: "no_hp", nilai_baru: "", koreksi_kolom: "check_in", waktu_baru: "", alasan: "" });

  const muat = (j: JenisPengajuan) => api.pengajuan(j).then((d) => setRows((r) => ({ ...r, [j]: d }))).catch((e) => toast(e.message));
  useEffect(() => { api.me().then(setMe).catch(() => {}); (Object.keys(PENGAJUAN_META) as JenisPengajuan[]).forEach(muat); }, []); // eslint-disable-line

  const kirim = async (e: React.FormEvent, j: JenisPengajuan) => {
    e.preventDefault();
    try {
      const body: Record<string, unknown> =
        j === "lembur" ? { tanggal: f.tanggal, jam_mulai: f.jam_mulai, jam_selesai: f.jam_selesai, keterangan: f.keterangan }
        : j === "reimbursement" ? { tanggal: f.tanggal, kategori: f.kategori, nominal: Number(f.nominal), deskripsi: f.deskripsi, bukti_url: f.bukti_url || undefined }
        : j === "surat" ? { tanggal: f.tanggal, jenis: f.jenis, keperluan: f.keperluan }
        : j === "koreksi-presensi" ? { tanggal: f.tanggal, kolom: f.koreksi_kolom, waktu_baru: f.waktu_baru, alasan: f.alasan }
        : { tanggal: f.tanggal, kolom: f.kolom, nilai_baru: f.nilai_baru };
      await api.ajukanPengajuan(j, body);
      toast("Pengajuan terkirim.");
      muat(j);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  const putus = async (j: JenisPengajuan, id: number, status: "disetujui" | "ditolak") => {
    try {
      const extra: Record<string, unknown> = {};
      if (j === "surat" && status === "disetujui") {
        const nomor = window.prompt("Nomor surat (opsional, kosongkan bila belum ada):", "");
        if (nomor === null) return;
        if (nomor) extra.nomor = nomor;
      }
      await api.putusPengajuan(j, id, status, extra);
      toast(`Pengajuan ${status}.`);
      muat(j);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Lembur, reimbursement, surat, data & koreksi</b></p>
        <h1 className="font-display text-2xl font-bold">Pengajuan</h1>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as JenisPengajuan)}>
        <TabsList>
          {(Object.keys(PENGAJUAN_META) as JenisPengajuan[]).map((j) => (
            <TabsTrigger key={j} value={j}>{PENGAJUAN_META[j].label}</TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(PENGAJUAN_META) as JenisPengajuan[]).map((j) => {
          const meta = PENGAJUAN_META[j];
          const ajukan = bisa(me, meta.ajukan);
          const setujui = bisa(me, meta.setujui);
          if (!ajukan && !setujui) return null;
          return (
            <TabsContent key={j} value={j}>
              <div className="grid gap-5">
                {ajukan ? (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Ajukan {meta.label.toLowerCase()}</CardTitle></CardHeader>
                    <CardContent>
                      <form onSubmit={(e) => kirim(e, j)} className="grid gap-3 md:grid-cols-4 md:items-end">
                        <Field label="Tanggal"><Input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} required /></Field>
                        {j === "lembur" ? (<>
                          <Field label="Mulai"><Input type="time" value={f.jam_mulai} onChange={(e) => setF({ ...f, jam_mulai: e.target.value })} required /></Field>
                          <Field label="Selesai"><Input type="time" value={f.jam_selesai} onChange={(e) => setF({ ...f, jam_selesai: e.target.value })} required /></Field>
                          <Field label="Keterangan"><Input value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} placeholder="Opsional" /></Field>
                        </>) : null}
                        {j === "reimbursement" ? (<>
                          <Field label="Kategori">
                            <Select value={f.kategori} onChange={(e) => setF({ ...f, kategori: e.target.value })}>
                              {["transport", "konsumsi", "operasional", "kesehatan", "lainnya"].map((k) => <option key={k} value={k}>{k}</option>)}
                            </Select>
                          </Field>
                          <Field label="Nominal (Rp)"><Input inputMode="numeric" value={f.nominal} onChange={(e) => setF({ ...f, nominal: e.target.value })} required /></Field>
                          <Field label="Deskripsi"><Input value={f.deskripsi} onChange={(e) => setF({ ...f, deskripsi: e.target.value })} /></Field>
                        </>) : null}
                        {j === "surat" ? (<>
                          <Field label="Jenis">
                            <Select value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value })}>
                              {Object.entries(JENIS_SURAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </Select>
                          </Field>
                          <Field label="Keperluan"><Input value={f.keperluan} onChange={(e) => setF({ ...f, keperluan: e.target.value })} placeholder="cth. Pengajuan KPR" /></Field>
                        </>) : null}
                        {j === "perubahan-data" ? (<>
                          <Field label="Data">
                            <Select value={f.kolom} onChange={(e) => setF({ ...f, kolom: e.target.value })}>
                              {Object.entries(KOLOM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </Select>
                          </Field>
                          <Field label="Nilai baru"><Input value={f.nilai_baru} onChange={(e) => setF({ ...f, nilai_baru: e.target.value })} required /></Field>
                        </>) : null}
                        {j === "koreksi-presensi" ? (<>
                          <Field label="Jam yang dikoreksi">
                            <Select value={f.koreksi_kolom} onChange={(e) => setF({ ...f, koreksi_kolom: e.target.value })}>
                              <option value="check_in">Check-in (masuk)</option>
                              <option value="check_out">Check-out (pulang)</option>
                            </Select>
                          </Field>
                          <Field label="Jam seharusnya"><Input type="time" value={f.waktu_baru} onChange={(e) => setF({ ...f, waktu_baru: e.target.value })} required /></Field>
                          <Field label="Alasan"><Input value={f.alasan} onChange={(e) => setF({ ...f, alasan: e.target.value })} placeholder="cth. Lupa tekan tombol" required /></Field>
                        </>) : null}
                        <Button type="submit">Kirim</Button>
                      </form>
                    </CardContent>
                  </Card>
                ) : null}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{setujui ? "Semua pengajuan" : "Pengajuan saya"}</CardTitle>
                    <CardDescription>{setujui ? "Setujui atau tolak pengajuan yang masih diajukan." : ""}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabel rows={rows[j]} dapatSetujui={setujui} onPutus={(id, s) => putus(j, id, s)} jenis={j} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

const PENGAJUAN_META: Record<JenisPengajuan, { label: string; ajukan: string; setujui: string }> = {
  lembur: { label: "Lembur", ajukan: "lembur.ajukan", setujui: "lembur.setujui" },
  reimbursement: { label: "Reimbursement", ajukan: "reimburse.ajukan", setujui: "reimburse.setujui" },
  surat: { label: "Surat", ajukan: "surat.ajukan", setujui: "surat.setujui" },
  "perubahan-data": { label: "Ubah data", ajukan: "ubahdata.ajukan", setujui: "ubahdata.setujui" },
  "koreksi-presensi": { label: "Koreksi presensi", ajukan: "koreksi.ajukan", setujui: "koreksi.setujui" },
};
