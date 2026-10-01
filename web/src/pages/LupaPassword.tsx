import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import logo from "../assets/logo.png";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";

export function LupaPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api.forgotPassword(email.trim());
      setMsg(r.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memproses permintaan");
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
              <h1 className="mt-1 text-2xl font-bold">Forgot password?</h1>
              <p className="mt-1 text-sm text-white/80">Masukkan email akun, kami kirim tautan reset.</p>
            </div>
            <CardContent className="grid gap-4 px-6 py-6">
              <form onSubmit={submit} className="grid gap-4">
                <div className="relative">
                  <Mail className="wd-input-icon h-4 w-4" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email akun"
                    className="h-11 pl-10"
                    required
                  />
                </div>
                {err ? (
                  <p className="rounded-md bg-[#fdeef5] px-3 py-2 text-sm text-destructive">{err}</p>
                ) : null}
                {msg ? (
                  <p className="rounded-md bg-[#e6faf4] px-3 py-2 text-sm text-success">{msg}</p>
                ) : null}
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Mengirim…" : "Kirim tautan reset"}
                </Button>
              </form>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Sudah ingat?</span>
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
