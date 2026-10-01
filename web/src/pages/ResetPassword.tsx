import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import logo from "../assets/logo.png";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (p1 !== p2) throw new Error("Konfirmasi kata sandi tidak sama");
      if (p1.length < 8) throw new Error("Kata sandi minimal 8 karakter");
      await api.resetPassword(token, p1);
      setMsg("Kata sandi berhasil diganti. Silakan login dengan sandi baru.");
      setP1("");
      setP2("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengganti kata sandi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-4 py-5">
        <img src={logo} alt="AL-WILDAN" className="h-9 w-9 rounded-full bg-white object-cover shadow-sm" />
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">HRIS AL-WILDAN</p>
          <p className="text-[11px] uppercase tracking-[.18em] text-muted-foreground">White Dashboard · AW3</p>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1200px] place-items-center px-4 pb-16 pt-6">
        <div className="w-full max-w-[400px]">
          <Card className="wd-card overflow-hidden">
            <div className="wd-gradient-header px-6 pb-6 pt-7 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-white/70">Reset</p>
              <h1 className="mt-1 text-2xl font-bold">Sandi baru</h1>
              <p className="mt-1 text-sm text-white/80">Tautan berlaku 1 jam, satu kali pakai.</p>
            </div>
            <CardContent className="grid gap-4 px-6 py-6">
              {!token ? (
                <p className="rounded-md bg-[#fdeef5] px-3 py-2 text-sm text-destructive">
                  Tautan tidak lengkap (token hilang). Minta tautan baru di halaman{" "}
                  <Link to="/lupa-password" className="font-semibold underline">
                    Lupa Kata Sandi
                  </Link>
                  .
                </p>
              ) : (
                <form onSubmit={submit} className="grid gap-4">
                  <div className="relative">
                    <Lock className="wd-input-icon h-4 w-4" />
                    <Input
                      type="password"
                      value={p1}
                      onChange={(e) => setP1(e.target.value)}
                      placeholder="Kata sandi baru (min. 8 karakter)"
                      className="h-11 pl-10"
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="relative">
                    <Lock className="wd-input-icon h-4 w-4" />
                    <Input
                      type="password"
                      value={p2}
                      onChange={(e) => setP2(e.target.value)}
                      placeholder="Ulangi kata sandi baru"
                      className="h-11 pl-10"
                      required
                      minLength={8}
                    />
                  </div>
                  {err ? (
                    <p className="rounded-md bg-[#fdeef5] px-3 py-2 text-sm text-destructive">{err}</p>
                  ) : null}
                  {msg ? (
                    <p className="rounded-md bg-[#e6faf4] px-3 py-2 text-sm text-success">{msg}</p>
                  ) : null}
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy ? "Menyimpan…" : "Simpan sandi baru"}
                  </Button>
                </form>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Selesai?</span>
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Kembali login
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
