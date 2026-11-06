// ============================================================================
// MASTER CABANG NASIONAL & NORMALISASI WILAYAH
// Standarisasi 7 Kanwil & Kantor Cabang Operasional Nasional Layanan Pensiunan
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

// Peta sinonim/alias nama cabang & cakupan daerah
const BRANCH_ALIASES = {
  // WIL-1 (Sumbagut)
  "MEDAN": "MEDAN",
  "KOTA MEDAN": "MEDAN",
  "DELI SERDANG": "MEDAN",
  "BINJAI": "MEDAN",
  "KARO": "MEDAN",

  "PEMATANGSIANTAR": "PEMATANGSIANTAR",
  "PEMATANG SIANTAR": "PEMATANGSIANTAR",
  "SIANTAR": "PEMATANGSIANTAR",
  "SIMALUNGUN": "PEMATANGSIANTAR",
  "TOBA": "PEMATANGSIANTAR",
  "TAPANULI": "PEMATANGSIANTAR",
  "ASAHAN": "PEMATANGSIANTAR",
  "TEBING TINGGI": "PEMATANGSIANTAR",

  "NIAS": "NIAS",
  "GUNUNGSITOLI": "NIAS",
  "GUNUNG SITOLI": "NIAS",
  "NIAS SELATAN": "NIAS",
  "NIAS UTARA": "NIAS",
  "NIAS BARAT": "NIAS",

  "BANDA ACEH": "BANDA ACEH",
  "ACEH": "BANDA ACEH",
  "LHOKSEUMAWE": "BANDA ACEH",
  "ACEH BARAT": "BANDA ACEH",

  // WIL-2 (Sumbagtengsel)
  "PEKANBARU": "PEKANBARU",
  "DUMAI": "PEKANBARU",
  "KAMPAR": "PEKANBARU",
  "ROKAN": "PEKANBARU",

  "PADANG": "PADANG",
  "BUKITTINGGI": "PADANG",
  "AGAM": "PADANG",
  "SOLOK": "PADANG",

  "PALEMBANG": "PALEMBANG",
  "OGAN ILIR": "PALEMBANG",
  "BANYUASIN": "PALEMBANG",
  "PRABUMULIH": "PALEMBANG",

  "BANDAR LAMPUNG": "BANDAR LAMPUNG",
  "LAMPUNG": "BANDAR LAMPUNG",
  "METRO": "BANDAR LAMPUNG",
  "LAMPUNG SELATAN": "BANDAR LAMPUNG",

  // WIL-3 (Jabodetabek & Banten)
  "PUSAT": "PUSAT JAKARTA",
  "PUSAT JAKARTA": "PUSAT JAKARTA",
  "JAKARTA": "PUSAT JAKARTA",
  "JAKARTA PUSAT": "PUSAT JAKARTA",
  "JAKARTA SELATAN": "PUSAT JAKARTA",
  "JAKARTA TIMUR": "PUSAT JAKARTA",
  "JAKARTA BARAT": "PUSAT JAKARTA",
  "JAKARTA UTARA": "PUSAT JAKARTA",
  "DKI JAKARTA": "PUSAT JAKARTA",

  "BOGOR": "BOGOR",
  "KOTA BOGOR": "BOGOR",
  "KAB. BOGOR": "BOGOR",
  "DEPOK": "BOGOR",

  "TANGERANG": "TANGERANG",
  "KOTA TANGERANG": "TANGERANG",
  "TANGERANG SELATAN": "TANGERANG",
  "TANGSEL": "TANGERANG",

  "BEKASI": "BEKASI",
  "KOTA BEKASI": "BEKASI",
  "KAB. BEKASI": "BEKASI",

  "SERANG": "SERANG",
  "KOTA SERANG": "SERANG",
  "CILEGON": "SERANG",
  "PANDEGLANG": "SERANG",
  "LEBAK": "SERANG",

  // WIL-4 (Jawa Barat)
  "BANDUNG": "BANDUNG",
  "KOTA BANDUNG": "BANDUNG",
  "KAB. BANDUNG": "BANDUNG",
  "BANDUNG BARAT": "BANDUNG",
  "CIMAHI": "BANDUNG",

  "CIREBON": "CIREBON",
  "KOTA CIREBON": "CIREBON",
  "KAB. CIREBON": "CIREBON",
  "INDRAMAYU": "CIREBON",
  "MAJALENGKA": "CIREBON",
  "KUNINGAN": "CIREBON",

  "TASIKMALAYA": "TASIKMALAYA",
  "KOTA TASIKMALAYA": "TASIKMALAYA",
  "CIAMIS": "TASIKMALAYA",
  "GARUT": "TASIKMALAYA",
  "BANJAR": "TASIKMALAYA",
  "PANGANDARAN": "TASIKMALAYA",

  "SUKABUMI": "SUKABUMI",
  "KOTA SUKABUMI": "SUKABUMI",
  "CIANJUR": "SUKABUMI",

  // WIL-5 (Jawa Tengah & DIY)
  "SEMARANG": "SEMARANG",
  "KOTA SEMARANG": "SEMARANG",
  "KENDAL": "SEMARANG",
  "DEMAK": "SEMARANG",
  "SALATIGA": "SEMARANG",

  "SOLO": "SOLO",
  "SURAKARTA": "SOLO",
  "SUKOHARJO": "SOLO",
  "KLATEN": "SOLO",
  "BOYOLALI": "SOLO",
  "KARANGANYAR": "SOLO",
  "SRAGEN": "SOLO",

  "YOGYAKARTA": "YOGYAKARTA",
  "JOGJA": "YOGYAKARTA",
  "JOGJAKARTA": "YOGYAKARTA",
  "DIY": "YOGYAKARTA",
  "D.I. YOGYAKARTA": "YOGYAKARTA",
  "KOTA YOGYAKARTA": "YOGYAKARTA",
  "SLEMAN": "YOGYAKARTA",
  "BANTUL": "YOGYAKARTA",
  "GUNUNGKIDUL": "YOGYAKARTA",
  "KULON PROGO": "YOGYAKARTA",

  "PURWOKERTO": "PURWOKERTO",
  "BANYUMAS": "PURWOKERTO",
  "CILACAP": "PURWOKERTO",
  "PURBALINGGA": "PURWOKERTO",
  "BANJARNEGARA": "PURWOKERTO",

  // WIL-6 (Jawa Timur, Bali, Nusra)
  "SURABAYA": "SURABAYA",
  "KOTA SURABAYA": "SURABAYA",
  "SIDOARJO": "SURABAYA",
  "GRESIK": "SURABAYA",
  "MOJOKERTO": "SURABAYA",

  "MALANG": "MALANG",
  "KOTA MALANG": "MALANG",
  "BATU": "MALANG",
  "PASURUAN": "MALANG",
  "PROBOLINGGO": "MALANG",

  "JEMBER": "JEMBER",
  "BANYUWANGI": "JEMBER",
  "LUMAJANG": "JEMBER",
  "SITUBONDO": "JEMBER",

  "DENPASAR": "DENPASAR",
  "BALI": "DENPASAR",
  "BADUNG": "DENPASAR",
  "GIANYAR": "DENPASAR",
  "TABANAN": "DENPASAR",
  "BULELENG": "DENPASAR",

  "MATARAM": "MATARAM",
  "LOMBOK": "MATARAM",
  "SUMBAWA": "MATARAM",
  "BIMA": "MATARAM",
  "KUPANG": "MATARAM",

  // WIL-7 (Kalimantan, Sulawesi, Timur)
  "BALIKPAPAN": "BALIKPAPAN",
  "SAMARINDA": "BALIKPAPAN",
  "KUTAI KARTANEGARA": "BALIKPAPAN",
  "KUTAI": "BALIKPAPAN",

  "BANJARMASIN": "BANJARMASIN",
  "BANJARBARU": "BANJARMASIN",
  "BARITO": "BANJARMASIN",

  "MAKASSAR": "MAKASSAR",
  "UJUNG PANDANG": "MAKASSAR",
  "GOWA": "MAKASSAR",
  "MAROS": "MAKASSAR",
  "PAREPARE": "MAKASSAR",
  "BONE": "MAKASSAR",

  "MANADO": "MANADO",
  "MINAHASA": "MANADO",
  "TOMOHON": "MANADO",
  "BITUNG": "MANADO",
  "JAYAPURA": "MANADO",
  "AMBON": "MANADO"
};

/**
 * Normalisasi nama cabang menjadi format kanonikal Master Cabang.
 * Mencegah kegagalan otorisasi atau pencarian akibat inkonsistensi penulisan / spasi / kapitalisasi.
 * @param {string} rawBranch
 * @returns {string}
 */
export function normalizeBranch(rawBranch) {
  if (!rawBranch) return "";
  const cleaned = String(rawBranch)
    .trim()
    .toUpperCase()
    .replace(/[\.\,\-_]/g, " ")
    .replace(/\s+/g, " ");

  if (BRANCH_ALIASES[cleaned]) {
    return BRANCH_ALIASES[cleaned];
  }

  // Cek jika mengandung kata kunci cabang utama
  for (const master of MASTER_BRANCHES) {
    if (cleaned === master || cleaned.startsWith(master + " ") || cleaned.endsWith(" " + master)) {
      return master;
    }
  }

  return cleaned;
}

/**
 * Menentukan cabang kanonikal dari teks kota, teks cabang impor, atau pilihan eksplisit Admin.
 * @param {string} city
 * @param {string} branchHint
 * @param {string} explicitTargetBranch
 * @returns {string}
 */
export function resolveBranchFromCityOrText(city = "", branchHint = "", explicitTargetBranch = "") {
  if (explicitTargetBranch) {
    const norm = normalizeBranch(explicitTargetBranch);
    if (norm) return norm;
  }

  if (branchHint) {
    const norm = normalizeBranch(branchHint);
    if (norm) return norm;
  }

  if (city) {
    const norm = normalizeBranch(city);
    if (norm && MASTER_BRANCHES.includes(norm)) return norm;

    const cityUpper = String(city).toUpperCase();
    for (const [alias, master] of Object.entries(BRANCH_ALIASES)) {
      if (cityUpper.includes(alias)) {
        return master;
      }
    }
  }

  return "BANDUNG"; // Default fallback operasional
}
