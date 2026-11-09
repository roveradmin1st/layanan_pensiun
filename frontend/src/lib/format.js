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

// ============================================================================
// MASTER CABANG NASIONAL & NORMALISASI
// ============================================================================
export const KANWIL_BRANCHES = [
  {
    code: "WIL-1",
    name: "Sumatera Bagian Utara (Sumbagut)",
    branches: ["MEDAN", "PEMATANGSIANTAR", "NIAS", "BANDA ACEH"]
  },
  {
    code: "WIL-2",
    name: "Sumatera Bagian Tengah & Selatan",
    branches: ["PEKANBARU", "PADANG", "PALEMBANG", "BANDAR LAMPUNG"]
  },
  {
    code: "WIL-3",
    name: "Jabodetabek & Banten",
    branches: ["PUSAT JAKARTA", "BOGOR", "TANGERANG", "BEKASI", "SERANG"]
  },
  {
    code: "WIL-4",
    name: "Jawa Barat",
    branches: ["BANDUNG", "CIREBON", "TASIKMALAYA", "SUKABUMI"]
  },
  {
    code: "WIL-5",
    name: "Jawa Tengah & D.I. Yogyakarta",
    branches: ["SEMARANG", "SOLO", "YOGYAKARTA", "PURWOKERTO"]
  },
  {
    code: "WIL-6",
    name: "Jawa Timur, Bali & Nusa Tenggara",
    branches: ["SURABAYA", "MALANG", "JEMBER", "DENPASAR", "MATARAM"]
  },
  {
    code: "WIL-7",
    name: "Kalimantan, Sulawesi & Indonesia Timur",
    branches: ["BALIKPAPAN", "BANJARMASIN", "MAKASSAR", "MANADO"]
  }
];

export const MASTER_BRANCHES = KANWIL_BRANCHES.flatMap((k) => k.branches);

export function normalizeBranch(rawBranch) {
  if (!rawBranch) return "";
  const cleaned = String(rawBranch)
    .trim()
    .toUpperCase()
    .replace(/[\.\,\-_]/g, " ")
    .replace(/\s+/g, " ");

  if (cleaned.includes("PEMATANG") || cleaned.includes("SIANTAR") || cleaned.includes("SIMALUNGUN")) return "PEMATANGSIANTAR";
  if (cleaned.includes("NIAS") || cleaned.includes("GUNUNGSITOLI") || cleaned.includes("GUNUNG SITOLI")) return "NIAS";
  if (cleaned.includes("MEDAN") || cleaned.includes("DELI SERDANG") || cleaned.includes("BINJAI")) return "MEDAN";
  if (cleaned.includes("ACEH")) return "BANDA ACEH";
  if (cleaned.includes("PEKANBARU") || cleaned.includes("DUMAI")) return "PEKANBARU";
  if (cleaned.includes("PADANG") || cleaned.includes("BUKITTINGGI")) return "PADANG";
  if (cleaned.includes("PALEMBANG")) return "PALEMBANG";
  if (cleaned.includes("LAMPUNG")) return "BANDAR LAMPUNG";
  if (cleaned.includes("JAKARTA") || cleaned === "PUSAT") return "PUSAT JAKARTA";
  if (cleaned.includes("BOGOR") || cleaned.includes("DEPOK")) return "BOGOR";
  if (cleaned.includes("TANGERANG") || cleaned.includes("TANGSEL")) return "TANGERANG";
  if (cleaned.includes("BEKASI")) return "BEKASI";
  if (cleaned.includes("SERANG") || cleaned.includes("CILEGON")) return "SERANG";
  if (cleaned.includes("BANDUNG") || cleaned.includes("CIMAHI")) return "BANDUNG";
  if (cleaned.includes("CIREBON") || cleaned.includes("INDRAMAYU")) return "CIREBON";
  if (cleaned.includes("TASIKMALAYA") || cleaned.includes("CIAMIS") || cleaned.includes("GARUT")) return "TASIKMALAYA";
  if (cleaned.includes("SUKABUMI") || cleaned.includes("CIANJUR")) return "SUKABUMI";
  if (cleaned.includes("SEMARANG") || cleaned.includes("KENDAL")) return "SEMARANG";
  if (cleaned.includes("SOLO") || cleaned.includes("SURAKARTA")) return "SOLO";
  if (cleaned.includes("YOGYA") || cleaned.includes("JOGJA") || cleaned.includes("SLEMAN")) return "YOGYAKARTA";
  if (cleaned.includes("PURWOKERTO") || cleaned.includes("BANYUMAS")) return "PURWOKERTO";
  if (cleaned.includes("SURABAYA") || cleaned.includes("SIDOARJO")) return "SURABAYA";
  if (cleaned.includes("MALANG") || cleaned.includes("BATU")) return "MALANG";
  if (cleaned.includes("JEMBER") || cleaned.includes("BANYUWANGI")) return "JEMBER";
  if (cleaned.includes("DENPASAR") || cleaned.includes("BALI")) return "DENPASAR";
  if (cleaned.includes("MATARAM") || cleaned.includes("LOMBOK")) return "MATARAM";
  if (cleaned.includes("BALIKPAPAN") || cleaned.includes("SAMARINDA")) return "BALIKPAPAN";
  if (cleaned.includes("BANJARMASIN")) return "BANJARMASIN";
  if (cleaned.includes("MAKASSAR") || cleaned.includes("GOWA")) return "MAKASSAR";
  if (cleaned.includes("MANADO") || cleaned.includes("MINAHASA")) return "MANADO";

  return cleaned;
}

