import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton } from "../components/ui/tabs";
import { toast } from "../components/ui/toaster";
import { api, bisa, type ManagedUser, type PermItem, type SessionUser } from "../lib/api";

const PERAN_LABEL: Record<string, string> = { master_admin: "Master Admin", hr_cabang: "HR Cabang", pegawai: "Pegawai" };

export function Pengguna() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [catalog, setCatalog] = useState<PermItem[] | null>(null);
  const [units, setUnits] = useState<{ id: number; nama: string; kode: string; cabang: string | null }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ManagedUser | "baru" | null>(null);
  const [undang, setUndang] = useState<ManagedUser | null>(null);

  const muat = () => {
    api.me().then(setMe).catch((e) => setErr(e.message));
    Promise.all([api.users(), api.permCatalog(), api.units()])
      .then(([u, c, un]) => { setUsers(u); setCatalog(c); setUnits(un); })
      .catch((e) => setErr(e.message));
  };
  useEffect(muat, []);

  const boleh = bisa(me, "users.kelola");

  if (err) return <p className="rounded-md bg-[#fbeae8] px-4 py-3 text-sm text-destructive">{err}</p>;
  if (!users || !catalog || !me)
    return <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>;
  if (!boleh) return <p className="text-sm text-muted-foreground">Halaman ini butuh izin <b>users.kelola</b>.</p>;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">HRIS · <b className="text-foreground">Pengaturan akses</b></p>
          <h1 className="font-display text-2xl font-bold">Pengguna & hak akses</h1>
        </div>
        <Button onClick={() => setEditing("baru")}>+ Tambah pengguna</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{users.length} pengguna</CardTitle>
          <CardDescription>Izin bawaan peran dikunci — checklist mengatur <b>izin tambahan</b>.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nama</TableHead><TableHead>Peran</TableHead><TableHead>Status</TableHead><TableHead>Izin tambahan</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{PERAN_LABEL[u.role] ?? u.role}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={u.aktif ? "success" : "muted"}>{u.aktif ? "Aktif" : "Nonaktif"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.permissions.length ? u.permissions.join(", ") : "–"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Ubah</Button>
                      <Button size="sm" variant="outline" onClick={() => setUndang(u)} title="Buatkan sandi sementara + kirim via email/WA">Undang</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {undang ? (
        <UndangDialog user={undang} tutup={() => setUndang(null)} />
      ) : null}
      {editing ? (
        <UserDialog
          catalog={catalog}
          units={units}
          awal={editing === "baru" ? null : editing}
          tutup={() => setEditing(null)}
          simpan={async () => { setEditing(null); setUsers(null); muat(); toast("Pengguna tersimpan."); }}
        />
      ) : null}
    </div>
  );
}

function UndangDialog({ user, tutup }: { user: ManagedUser; tutup: () => void }) {
  const [via, setVia] = useState<"email" | "wa">("email");
  const [tujuan, setTujuan] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.undangUser(user.id, via, via === "wa" ? tujuan : undefined);
      setOk(`Undangan terkirim via ${r.via === "wa" ? "WhatsApp" : "email"} ke ${via === "wa" ? tujuan : user.email}. Sandi lama pengguna diganti sandi sementara.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengirim");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-navy/60 p-4" onClick={tutup}>
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold">Undang — {user.name}</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Membuat sandi sementara baru lalu mengirimnya. Butuh SMTP (email) / gateway WA (lihat Pengaturan).
        </p>
        <form onSubmit={kirim} className="grid gap-4">
          <Field label="Kirim via">
            <Select value={via} onChange={(e) => setVia(e.target.value as "email" | "wa")}>
              <option value="email">Email ({user.email})</option>
              <option value="wa">WhatsApp</option>
            </Select>
          </Field>
          {via === "wa" ? (
            <Field label="Nomor WA (cth. 62812…)">
              <Input value={tujuan} onChange={(e) => setTujuan(e.target.value)} required placeholder="628…" />
            </Field>
          ) : null}
          {err ? <p className="rounded-md bg-[#fbeae8] px-3 py-2 text-sm text-destructive">{err}</p> : null}
          {ok ? <p className="rounded-md bg-[#e7f4ec] px-3 py-2 text-sm text-success">{ok}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={tutup}>Tutup</Button>
            <Button type="submit" disabled={busy}>{busy ? "Mengirim…" : "Kirim undangan"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserDialog({ catalog, units, awal, tutup, simpan }: {
  catalog: PermItem[];
  units: { id: number; nama: string; kode: string; cabang: string | null }[];
  awal: ManagedUser | null;
  tutup: () => void;
  simpan: () => void;
}) {
  const baru = !awal;
  const [name, setName] = useState(awal?.name ?? "");
  const [email, setEmail] = useState(awal?.email ?? "");
  const [role, setRole] = useState(awal?.role ?? "hr_cabang");
  const [unitId, setUnitId] = useState(awal?.unit_id ? String(awal.unit_id) : "");
  const [password, setPassword] = useState("");
  const [aktif, setAktif] = useState((awal?.aktif ?? 1) === 1);
  const [extra, setExtra] = useState<string[]>(awal?.permissions ?? []);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const bawaan = useMemo(() => catalog[0]?.bawaan[role] ?? [], [catalog, role]);
  const toggle = (k: string) =>
    setExtra((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const tambahan = extra.filter((k) => !bawaan.includes(k));
      if (baru) await api.createUser({ email, name, role, password, permissions: tambahan, unit_id: unitId ? Number(unitId) : null });
      else {
        const body: Record<string, unknown> = { name, role, permissions: tambahan, aktif: aktif ? 1 : 0, unit_id: unitId ? Number(unitId) : null };
        if (password) body.password = password;
        await api.updateUser(awal!.id, body);
      }
      simpan();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-navy/60 p-4" onClick={tutup}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold">{baru ? "Tambah pengguna" : `Ubah — ${awal?.name}`}</h2>
        <p className="mb-4 text-xs text-muted-foreground">Centang izin tambahan di luar bawaan peran.</p>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Nama"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!baru} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Peran">
              <Select value={role} onChange={(e) => { setRole(e.target.value); }}>
                <option value="hr_cabang">HR Cabang</option>
                <option value="pegawai">Pegawai</option>
                <option value="master_admin">Master Admin</option>
              </Select>
            </Field>
            <Field label="Sandi baru (kosongkan bila tetap)">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={baru} minLength={8} />
            </Field>
          </div>
          <Field label="Unit / penempatan (menentukan cabang yang terlihat)">
            <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">— Tanpa unit (semua, khusus admin) —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.nama}{u.cabang ? ` · ${u.cabang}` : ""}</option>
              ))}
            </Select>
          </Field>
          {!baru ? (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} className="h-4 w-4 accent-[#1d4ed8]" />
              Akun aktif (matikan untuk menonaktifkan login)
            </label>
          ) : null}
          <div className="grid gap-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold">Checklist izin tambahan</p>
            {catalog.map((p) => {
              const isBawaan = bawaan.includes(p.key);
              const checked = isBawaan || extra.includes(p.key);
              return (
                <label key={p.key} className={`flex items-start gap-2 text-sm ${isBawaan ? "opacity-70" : ""}`}>
                  <input
                    type="checkbox" checked={checked} disabled={isBawaan}
                    onChange={() => toggle(p.key)} className="mt-0.5 h-4 w-4 accent-[#1d4ed8]"
                  />
                  <span>
                    {p.label}
                    <span className="ml-1 font-mono text-[11px] text-muted-foreground">{p.key}</span>
                    {isBawaan ? <span className="ml-1 text-[11px] text-muted-foreground">(bawaan peran)</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
          {err ? <p className="rounded-md bg-[#fbeae8] px-3 py-2 text-sm text-destructive">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={tutup}>Batal</Button>
            <Button type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
