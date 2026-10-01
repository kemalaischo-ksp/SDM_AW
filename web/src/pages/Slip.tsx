import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import logo from "../assets/logo.png";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { api, type Employee } from "../lib/api";
import { rupiah, tglISOtoID } from "../lib/format";

export function Slip() {
  const { nip } = useParams();
  const [emp, setEmp] = useState<Employee | null>(null);
  useEffect(() => {
    api.employees().then((all) => setEmp(all.find((x) => x.nip === nip) ?? null));
  }, [nip]);

  if (!emp) return <p className="text-sm text-muted-foreground">Memuat…</p>;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 print:hidden">
        <Link to="/payroll" className="text-sm text-primary hover:underline">← Payroll</Link>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => window.print()}>Cetak slip</Button>
      </div>
      <Card className="mx-auto w-full max-w-xl">
        <CardHeader className="flex flex-row items-center gap-4 border-b border-border">
          <img src={logo} alt="AL-WILDAN" className="h-14 w-14 rounded-full bg-white object-cover" />
          <div>
            <p className="font-display text-lg font-bold">Slip Gaji — AL-WILDAN 3 BSD City</p>
            <p className="text-xs text-muted-foreground">Periode Agustus 2026 · NIP <span className="tnum">{emp.nip}</span></p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 text-sm">
          <div className="grid gap-1">
            <p className="font-display text-base font-bold">{emp.nama_gelar}</p>
            <p className="text-muted-foreground">{emp.posisi_diajukan} · {emp.unit}{emp.tmt_aktif ? ` · TMT ${tglISOtoID(emp.tmt_aktif)} (${emp.mode_thp})` : ""}</p>
          </div>
          {[
            ["THP kotor", rupiah(emp.thp_kotor), false],
            ["Potongan TK", `(${rupiah(emp.tk)})`, false],
            ["Potongan THR/bulan", `(${rupiah(emp.thr_bulan)})`, false],
            ["Total potongan (TK-THR)", `(${rupiah(emp.total_tk_thr)})`, false],
            ["THP BERSIH", rupiah(emp.thp_bersih), true],
          ].map(([k, v, bold]) => (
            <div key={k as string} className={`flex justify-between border-b border-border/60 pb-2 tnum ${bold ? "border-t-2 border-foreground pt-2 text-base font-bold" : ""}`}>
              <span className={bold ? "" : "text-muted-foreground"}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Dokumen resmi arsip SDM AW/LM. NIK & nomor rekening tidak dicantumkan di slip.</p>
        </CardContent>
      </Card>
    </div>
  );
}
