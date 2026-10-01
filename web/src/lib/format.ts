export function rupiah(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "–";
  return "Rp" + Number(n).toLocaleString("id-ID");
}

export function tglISOtoID(iso: string | null | undefined): string {
  if (!iso) return "–";
  const [y, m, d] = iso.slice(0, 10).split("-");
  const bulan = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  return `${Number(d)} ${bulan[Number(m) - 1] ?? m} ${y}`;
}

export function masaKerja(iso: string | null | undefined): string {
  if (!iso) return "–";
  const a = new Date(iso);
  const b = new Date();
  let bln = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) bln--;
  if (bln < 0) return "–";
  const th = Math.floor(bln / 12), s = bln % 12;
  return th > 0 ? `${th} thn ${s} bln` : `${s} bln`;
}
