import { Award, BarChart3, Bell, CalendarCheck, CalendarDays, ClipboardCheck, FileText, KeyRound, LayoutDashboard, LogOut, Menu, ScrollText, Search, Settings, User, Users, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { api, bisa, type SessionUser } from "../lib/api";
import { cn } from "../lib/utils";

type NavItem = {
  to: string; label: string; icon: typeof LayoutDashboard; end?: boolean;
  perm?: string; anyPerms?: string[]; roles?: string[];
};

const PENGAJUAN_PERMS = [
  "lembur.ajukan", "reimburse.ajukan", "surat.ajukan", "ubahdata.ajukan", "koreksi.ajukan",
  "lembur.setujui", "reimburse.setujui", "surat.setujui", "ubahdata.setujui", "koreksi.setujui",
];

const NAV_UTAMA: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/profil", label: "Profil Saya", icon: User, roles: ["pegawai", "hr_cabang"] },
  { to: "/karyawan", label: "Karyawan", icon: Users, perm: "karyawan.lihat" },
  { to: "/presensi", label: "Presensi", icon: ClipboardCheck, perm: "presensi.mandiri" },
  { to: "/pengajuan", label: "Pengajuan", icon: FileText, anyPerms: PENGAJUAN_PERMS },
  { to: "/cuti", label: "Cuti", icon: CalendarDays, perm: "cuti.ajukan" },
  { to: "/kinerja", label: "Kinerja", icon: Award, anyPerms: ["kpi.kelola"], roles: ["pegawai"] },
  { to: "/laporan", label: "Laporan", icon: BarChart3, anyPerms: ["laporan.lihat", "absensi.kelola"] },
  { to: "/notifikasi", label: "Notifikasi", icon: Bell },
];

const NAV_ADMIN: NavItem[] = [
  { to: "/absensi", label: "Absensi", icon: CalendarCheck, perm: "absensi.kelola" },
  { to: "/payroll", label: "Payroll", icon: Wallet, perm: "payroll.lihat" },
  { to: "/pengguna", label: "Pengguna", icon: KeyRound, perm: "users.kelola" },
  { to: "/audit", label: "Audit Log", icon: ScrollText, perm: "audit.lihat" },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings, perm: "pengaturan.kelola" },
];

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all",
    isActive
      ? "bg-primary text-white shadow-[0_4px_14px_rgba(225,78,202,.4)]"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  );
}

export function Shell() {
  const nav = useNavigate();
  const loc = useLocation();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    api.me().then(setMe).catch(() => {});
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  const logout = () => {
    api.logout().finally(() => nav("/login", { replace: true }));
  };
  const visible = (n: NavItem) => {
    if (!n.perm && !n.anyPerms && !n.roles) return true;
    if (n.roles && me && n.roles.includes(me.role)) return true;
    if (n.perm && bisa(me, n.perm)) return true;
    if (n.anyPerms && n.anyPerms.some((k) => bisa(me, k))) return true;
    return false;
  };
  const crumb = [...NAV_UTAMA, ...NAV_ADMIN].find((n) => (n.end ? loc.pathname === "/" : loc.pathname.startsWith(n.to)))?.label ?? "Halaman";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <img src={logo} alt="AL-WILDAN" className="h-10 w-10 rounded-full bg-white object-cover shadow-sm" />
        <div className="leading-tight">
          <p className="text-[14px] font-bold text-foreground">HRIS AL-WILDAN</p>
          <p className="glow-brand text-[10px] uppercase tracking-[.18em]">KSP - HOLDING</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        <div>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Main</p>
          <div className="space-y-1">
            {NAV_UTAMA.filter(visible).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Admin</p>
          <div className="space-y-1">
            {NAV_ADMIN.filter(visible).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <div className="flex items-center gap-3 border-t border-sidebar-border p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">
          {(me?.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold text-foreground">{me?.name ?? "…"}</p>
          <p className="text-[11px] text-muted-foreground">{me?.role ?? "…"}</p>
        </div>
        <button onClick={logout} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Keluar">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-sidebar shadow-xl">{sidebar}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 md:px-7">
            <button className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm md:flex">
              <span className="text-muted-foreground">HRIS</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold text-foreground">{crumb}</span>
            </div>
            <button className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden" onClick={() => setOpen(false)} aria-label="Tutup" style={{ display: "none" }}>
              <X className="h-5 w-5" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Search…"
                  className="h-9 w-48 rounded-full border border-input bg-white pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") nav(`/karyawan`);
                  }}
                />
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                {api.useMock ? "Demo" : "Live API"}
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] p-4 md:p-7">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-[1200px] px-4 pb-6 text-xs text-muted-foreground md:px-7">
          HRIS AL-WILDAN · White Dashboard · AW3 BSD City
        </footer>
      </div>
    </div>
  );
}
