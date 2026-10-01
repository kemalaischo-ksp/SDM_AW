import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import logo from "../assets/logo.png";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";

const DEMO_ACCOUNTS = [
  { role: "master_admin", label: "Master Admin", name: "Master Admin", email: "admin@alwildan.sch.id", password: "alwildan123" },
  { role: "hr_cabang", label: "HR Cabang", name: "HR SMPIT Insani", email: "hr.insani@alwildan.sch.id", password: "alwildan123" },
  { role: "pegawai", label: "Pegawai", name: "Budi Santoso, S.Pd", email: "budi.santoso@alwildan.sch.id", password: "alwildan123" },
];
// Panel akun demo hanya untuk DEV / mode mock. Di build produksi panel
// disembunyikan kecuali VITE_SHOW_DEMO_LOGIN=1 diset eksplisit.
const SHOW_DEMO =
  api.useMock || import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGIN === "1";

export function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pilihAkun = (a: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(a.email);
    setPassword(a.password);
    setErr(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.login(email, password);
      nav("/", { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login gagal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Guest navbar ala White Dashboard */}
      <header className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-4 py-5">
        <img src={logo} alt="AL-WILDAN" className="h-9 w-9 rounded-full bg-white object-cover shadow-sm" />
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">HRIS AL-WILDAN</p>
          <p className="text-[11px] uppercase tracking-[.18em] text-muted-foreground">White Dashboard · AW3</p>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {api.useMock ? "Mode demo (mock)" : "Terhubung API"}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1200px] place-items-center px-4 pb-16 pt-6">
        <div className="w-full max-w-[400px]">
          <Card className="wd-card overflow-hidden">
            <div className="wd-gradient-header px-6 pb-6 pt-7 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-white/70">Welcome</p>
              <h1 className="mt-1 text-2xl font-bold">Log in</h1>
              <p className="mt-1 text-sm text-white/80">Satu data SDM, cabang sampai holding.</p>
            </div>
            <CardContent className="grid gap-4 px-6 py-6">
              <form onSubmit={submit} className="grid gap-4">
                <div className="relative">
                  <Mail className="wd-input-icon h-4 w-4" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="h-11 pl-10"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="wd-input-icon h-4 w-4" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="h-11 pl-10"
                  />
                </div>
                {err ? (
                  <p className="rounded-md bg-[#fdeef5] px-3 py-2 text-sm text-destructive">{err}</p>
                ) : null}
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Memeriksa…" : "Get Started"}
                </Button>
              </form>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Lupa kata sandi?</span>
                <Link to="/lupa-password" className="font-semibold text-primary hover:underline">
                  Reset password
                </Link>
              </div>
              {api.useMock ? (
                <p className="rounded-md border border-dashed border-input bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Mode demo: email apa pun bisa masuk (tanpa backend).
                </p>
              ) : null}
              {SHOW_DEMO ? (
                <div className="rounded-md border border-dashed border-input bg-muted/50 px-3 py-3">
                  <p className="text-xs font-semibold text-foreground">
                    Akses cepat — 3 peran
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Klik untuk mengisi email + sandi demo lokal, lalu tekan Get Started.
                  </p>
                  <div className="mt-2 grid gap-2">
                    {DEMO_ACCOUNTS.map((a) => (
                      <button
                        key={a.role}
                        type="button"
                        onClick={() => pilihAkun(a)}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-background ${
                          email === a.email ? "border-primary bg-background" : "border-input bg-background/60"
                        }`}
                      >
                        <span>
                          <span className="block font-semibold text-foreground">{a.label}</span>
                          <span className="block text-muted-foreground">{a.name} · {a.email}</span>
                        </span>
                        <span className="ml-2 shrink-0 rounded bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary">
                          {email === a.email ? "dipilih" : "isi"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                    Sandi demo: alwildan123 · wajib diganti sebelum go-live
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            HRIS Holding · Pilot AW3 BSD City
          </p>
        </div>
      </main>
    </div>
  );
}
