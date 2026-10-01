import { useEffect, useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { Shell } from "./components/layout";
import { Toaster } from "./components/ui/toaster";
import { api } from "./lib/api";
import { Absensi } from "./pages/Absensi";
import { Audit } from "./pages/Audit";
import { Cuti } from "./pages/Cuti";
import { Dashboard } from "./pages/Dashboard";
import { KaryawanDetail } from "./pages/KaryawanDetail";
import { KaryawanList } from "./pages/KaryawanList";
import { Kinerja } from "./pages/Kinerja";
import { Laporan } from "./pages/Laporan";
import { Login } from "./pages/Login";
import { LupaPassword } from "./pages/LupaPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Notifikasi } from "./pages/Notifikasi";
import { Pengajuan } from "./pages/Pengajuan";
import { Pengaturan } from "./pages/Pengaturan";
import { Presensi } from "./pages/Presensi";
import { ProfilSaya } from "./pages/ProfilSaya";
import { Payroll } from "./pages/Payroll";
import { Pengguna } from "./pages/Pengguna";
import { Slip } from "./pages/Slip";

function Guard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"cek" | "ok" | "tolak">(
    localStorage.getItem("hr_token") ? "cek" : "tolak"
  );
  useEffect(() => {
    if (state !== "cek") return;
    api
      .me()
      .then(() => setState("ok"))
      .catch(() => {
        localStorage.removeItem("hr_token");
        setState("tolak");
      });
  }, [state]);
  if (state === "tolak") return <Navigate to="/login" replace />;
  if (state === "cek") return <p className="p-8 text-sm text-muted-foreground">Memeriksa sesi…</p>;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Toaster />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/lupa-password" element={<LupaPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<Guard><Shell /></Guard>}>
          <Route index element={<Dashboard />} />
          <Route path="profil" element={<ProfilSaya />} />
          <Route path="karyawan" element={<KaryawanList />} />
          <Route path="karyawan/:nip" element={<KaryawanDetail />} />
          <Route path="absensi" element={<Absensi />} />
          <Route path="presensi" element={<Presensi />} />
          <Route path="pengajuan" element={<Pengajuan />} />
          <Route path="laporan" element={<Laporan />} />
          <Route path="kinerja" element={<Kinerja />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="pengaturan" element={<Pengaturan />} />
          <Route path="cuti" element={<Cuti />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="slip/:nip" element={<Slip />} />
          <Route path="pengguna" element={<Pengguna />} />
          <Route path="audit" element={<Audit />} />
        </Route>
      </Routes>
    </Router>
  );
}
