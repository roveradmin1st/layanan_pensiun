export const rp = (v) => (v == null || v === "" ? "-" : "Rp" + Math.round(Number(v)).toLocaleString("id-ID"));
export const pct = (v) => (v == null ? "-" : `${Number(v).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`);

export const fmtDate = (iso) => {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

export const ddmmyyyyToIso = (s) => {
  const str = (s || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00`);
    return isNaN(d.getTime()) ? null : str;
  }
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(iso);
  return isNaN(d) || d.toISOString().slice(0, 10) !== iso ? null : iso;
};

export const STATUS = {
  baru: { label: "Baru", cls: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200" },
  follow_up: { label: "Follow-up", cls: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200" },
  proses: { label: "Dalam Proses", cls: "bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-200" },
  berhasil: { label: "Berhasil", cls: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200" },
  gagal: { label: "Gagal", cls: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200" },
};

export const ROLE_LABEL = {
  super_admin: "Super Admin",
  admin_ops: "Admin Operasional",
  admin_branch: "Admin Cabang/Mitra",
  sales_manager: "Sales Manager",
  marketing: "Marketing",
};
export const isAdmin = (u) => u && ["super_admin", "admin_ops", "admin_branch", "sales_manager"].includes(u.role);
export const isCentralAdmin = (u) => u && (u.role === "super_admin" || u.role === "admin_ops");

export const COPYRIGHT_1 = "© Layanan Pensiunan";
export const COPYRIGHT_2 = "";

