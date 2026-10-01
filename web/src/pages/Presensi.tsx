import { useEffect, useRef, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, bisa, type PresensiSaya, type SessionUser } from "../lib/api";
import { tglISOtoID } from "../lib/format";

const jam = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "–";

const lokasiSaatIni = (): Promise<{ lat: number; lng: number; akurasi: number }> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Browser tidak mendukung GPS"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, akurasi: Math.round(p.coords.accuracy) }),
      () => reject(new Error("Izin lokasi ditolak — aktifkan GPS & izinkan akses lokasi")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

export function Presensi() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [data, setData] = useState<PresensiSaya | null>(null);
  const [sibuk, setSibuk] = useState<"masuk" | "pulang" | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [loc, setLoc] = useState<{ lat: number; lng: number; akurasi: number } | null>(null);
  const [kamera, setKamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const muat = () => api.presensiSaya().then(setData).catch((e) => toast(e.message));
  useEffect(() => { api.me().then(setMe).catch(() => {}); muat(); }, []);
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  if (me && !bisa(me, "presensi.mandiri"))
    return <p className="text-sm text-muted-foreground">Butuh izin <b>presensi.mandiri</b>.</p>;

  const nyalakanKamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setKamera(true);
    } catch {
      toast("Kamera tidak dapat diakses — izinkan akses kamera di browser");
    }
  };

  const ambilFoto = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    const skala = Math.min(1, 640 / v.videoWidth);
    c.width = Math.round(v.videoWidth * skala);
    c.height = Math.round(v.videoHeight * skala);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    setFoto(c.toDataURL("image/jpeg", 0.65));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setKamera(false);
  };

  const ambilLokasi = async () => {
    try {
      const l = await lokasiSaatIni();
      setLoc(l);
      toast(`Lokasi terkunci (±${l.akurasi} m).`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal mengambil lokasi");
    }
  };

  const catat = async (aksi: "masuk" | "pulang") => {
    let f = foto, l = loc;
    if (!f) { toast("Ambil foto selfie dulu."); return; }
    if (!l) {
      try { l = await lokasiSaatIni(); setLoc(l); }
      catch (e) { toast(e instanceof Error ? e.message : "Gagal mengambil lokasi"); return; }
    }
    setSibuk(aksi);
    try {
      const r = await api.presensiAksi(aksi, { lat: l.lat, lng: l.lng, foto: f });
      toast(aksi === "masuk"
        ? `Check-in tercatat${r.jarak_meter !== null && r.jarak_meter !== undefined ? ` (${r.jarak_meter} m dari kantor)` : ""}. Selamat bekerja!`
        : "Check-out tercatat. Sampai jumpa!");
      setFoto(null);
      muat();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal");
    } finally {
      setSibuk(null);
    }
  };

  const hari = data?.hari_ini ?? null;
  const sudahMasuk = !!hari?.check_in;
  const sudahPulang = !!hari?.check_out;

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Kehadiran mandiri</b></p>
        <h1 className="font-display text-2xl font-bold">Presensi</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hari ini · {tglISOtoID(data?.tanggal ?? null)}</CardTitle>
          <CardDescription>
            {sudahPulang ? "Presensi hari ini selesai." : sudahMasuk ? "Anda sudah check-in. Jangan lupa check-out." : "Foto selfie + lokasi GPS wajib untuk setiap pencatatan."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Masuk</p>
                  <p className="tnum text-xl font-bold">{jam(hari?.check_in ?? null)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pulang</p>
                  <p className="tnum text-xl font-bold">{jam(hari?.check_out ?? null)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1">{hari?.status ? <Badge variant={hari.status === "hadir" ? "success" : "warning"}>{hari.status}</Badge> : <Badge variant="muted">belum presensi</Badge>}</p>
                </div>
              </div>
              {!sudahPulang ? (
                <div className="grid gap-4 rounded-md border border-border p-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <p className="text-sm font-semibold">1. Foto selfie</p>
                    {foto ? (
                      <div className="grid gap-2">
                        <img src={foto} alt="Selfie presensi" className="h-40 w-auto rounded-md border border-border object-cover" />
                        <div><Button size="sm" variant="outline" onClick={() => setFoto(null)}>Ulangi foto</Button></div>
                      </div>
                    ) : kamera ? (
                      <div className="grid gap-2">
                        <video ref={videoRef} autoPlay playsInline muted className="h-40 w-auto rounded-md border border-border bg-black object-cover" />
                        <div><Button size="sm" onClick={ambilFoto}>Ambil foto</Button></div>
                      </div>
                    ) : (
                      <div><Button size="sm" variant="outline" onClick={nyalakanKamera}>Aktifkan kamera</Button></div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <p className="text-sm font-semibold">2. Lokasi GPS</p>
                    {loc ? (
                      <p className="tnum text-sm">{loc.lat.toFixed(6)}, {loc.lng.toFixed(6)} <span className="text-muted-foreground">(±{loc.akurasi} m)</span></p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Belum dikunci.</p>
                    )}
                    <div><Button size="sm" variant="outline" onClick={ambilLokasi}>Kunci lokasi saya</Button></div>
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => catat("masuk")} disabled={sudahMasuk || sibuk !== null}>
                        {sibuk === "masuk" ? "Mencatat…" : "Catat masuk"}
                      </Button>
                      <Button variant="outline" onClick={() => catat("pulang")} disabled={!sudahMasuk || sudahPulang || sibuk !== null}>
                        {sibuk === "pulang" ? "Mencatat…" : "Catat pulang"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat 30 hari</CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : data.riwayat.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat presensi.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead>Masuk</TableHead><TableHead>Pulang</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.riwayat.map((r) => (
                  <TableRow key={r.tanggal}>
                    <TableCell className="tnum">{tglISOtoID(r.tanggal)}</TableCell>
                    <TableCell><Badge variant={r.status === "hadir" ? "success" : "warning"}>{r.status}</Badge></TableCell>
                    <TableCell className="tnum">{jam(r.check_in)}{r.lat_masuk ? <span className="ml-1 text-[11px] text-muted-foreground">·GPS</span> : null}</TableCell>
                    <TableCell className="tnum">{jam(r.check_out)}{r.lat_pulang ? <span className="ml-1 text-[11px] text-muted-foreground">·GPS</span> : null}</TableCell>
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
