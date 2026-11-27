// ============================================================================
// MESIN HITUNG TERISOLASI — BANK BNI FLEKSI PENSIUN (MKSA v4 Jul26)
// Sumber logika & konstanta: backend/src/config/bni-product-config.js
//
// Dokumentasi Satuan, Usia, Tenor & Urutan Pembulatan:
// 1. Satuan Bunga: % p.a. efektif (effectiveRateMonthly = rateAnnualPct / 100 / 12).
// 2. Satuan Premi AJK: permil (‰ = per 1.000 Plafond UP).
//    Subsidi BNI menanggung s.d. 150‰; selisih di atas 150‰ ditanggung nasabah.
// 3. Usia & Tanggal Kalender (menggunakan kalender UTC murni bebas DST):
//    - exactAge = DATEDIF(birthDate, processDate, Y/YM/MD)
//    - entryAgeYears = exactAge.years (key baris lookup tabel AJK CAR, 20..74)
//    - roundedAgeYears = entryAgeYears + 1 (tampilan Kalkulator!D12)
//    - age75Date = EDATE(birthDate, 75 * 12) (clamped ke akhir bulan bila tgl 29 Feb)
//    - remainingServiceMonths = DATEDIF(processDate, age75Date, "M")
//    - maturityDate = EOMONTH(processDate, tenorMonths)
// 4. Tenor Lookup Asuransi:
//    - insuranceTenorYears = Math.ceil(tenorMonths / 12) = ROUNDUP(tenor / 12, 0)
// 5. Urutan Pembulatan (sesuai Excel):
//    - Seluruh perhitungan antara (Plafond Maksimal PV, Angsuran PMT, Sisa Gaji,
//      Biaya Bank, Premi AJK, Total Biaya, Pencairan Bersih, Blokir 3x/1x/10x,
//      dan Terima Bersih) dihitung dengan presisi penuh IEEE-754 floating-point
//      tanpa pembulatan di tengah langkah.
//    - Pembulatan Rupiah bulat (`Math.round` untuk tampilan/summary ringkas dan
//      `Math.floor` bila plafond otomatis diambil dari PV maks) dilakukan hanya
//      pada tahap akhir serialisasi hasil, dengan nilai `_exact` tetap disimpan.
// ============================================================================

import {
  BNI_CONFIRMED_MAX_TENOR_MONTHS,
  BNI_MAX_AGE_LIMIT_YEARS,
  BNI_POLICY_VERSION,
  BNI_SUBSIDY_PERMIL,
  BNI_UNDERWRITING_DESCRIPTIONS,
  BNI_UNDERWRITING_MAX_PLAFOND,
  BNI_UNDERWRITING_REVIEW_MESSAGE,
  getBniFleksiConfig,
  normalizeBniInsuranceScheme,
  normalizeBniProductCode,
  requiresBniUnderwritingReview,
  resolveBniUnderwritingCode
} from "../config/bni-product-config.js";
import { todayWibIso } from "../utils/time-wib.js";

function pmt(rateMonthly, nper, pvVal) {
  if (nper <= 0 || pvVal <= 0) return 0;
  if (rateMonthly === 0) return pvVal / nper;
  const f = Math.pow(1 + rateMonthly, nper);
  return (pvVal * rateMonthly * f) / (f - 1);
}

function pv(rateMonthly, nper, payment) {
  if (nper <= 0 || payment <= 0) return 0;
  if (rateMonthly === 0) return payment * nper;
  const f = Math.pow(1 + rateMonthly, nper);
  return payment * ((f - 1) / (rateMonthly * f));
}

export function parseUtcDate(isoStr) {
  if (!isoStr) return null;
  if (isoStr instanceof Date) {
    return isNaN(isoStr.getTime())
      ? null
      : new Date(Date.UTC(isoStr.getUTCFullYear(), isoStr.getUTCMonth(), isoStr.getUTCDate()));
  }
  const s = String(isoStr).trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    isNaN(d.getTime()) ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

export function formatUtcDate(d) {
  if (!d || isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Parsing opsional tanggal kalender YYYY-MM-DD ketat tanpa overflow kalender. */
export function parseOptionalStrictCalendarDate(raw) {
  if (raw === undefined || raw === null) {
    return { provided: false, valid: true, value: null, date: null };
  }
  if (typeof raw !== "string") {
    return { provided: true, valid: false, value: null, date: null };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { provided: false, valid: true, value: null, date: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { provided: true, valid: false, value: null, date: null };
  }
  const parsed = parseUtcDate(trimmed);
  if (!parsed) {
    return { provided: true, valid: false, value: null, date: null };
  }
  return { provided: true, valid: true, value: formatUtcDate(parsed), date: parsed };
}

// Excel EDATE(startDate, months)
export function edateUtc(date, months) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetFirst = new Date(Date.UTC(y, m + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return new Date(
    Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), Math.min(day, lastDayOfTargetMonth))
  );
}

// Excel EOMONTH(startDate, months)
export function eomonthUtc(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0));
}

// Excel DATEDIF(start, end, "Y" / "YM" / "MD")
export function datedifYMD(start, end) {
  if (!start || !end || end < start) {
    return { years: 0, months: 0, days: 0, totalMonths: 0, text: "0 Tahun 0 Bulan 0 Hari" };
  }
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  let days = end.getUTCDate() - start.getUTCDate();
  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0)).getUTCDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalMonths = years * 12 + months;
  return {
    years,
    months,
    days,
    totalMonths,
    text: `${years} Tahun ${months} Bulan ${days} Hari`
  };
}

// Excel DATEDIF(start, end, "M")
export function datedifTotalMonths(start, end) {
  if (!start || !end || end < start) return 0;
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

function fmtRpId(n) {
  return "Rp " + Math.round(Number(n || 0)).toLocaleString("id-ID");
}

function validateAndResolveBniConfig(partner) {
  const rawCfg = getBniFleksiConfig(partner);
  if (!rawCfg || rawCfg.active === false) {
    return {
      ok: false,
      errorCode: "MISSING_BNI_CONFIG",
      reason: "Kalkulator BNI Fleksi belum aktif atau konfigurasinya tidak tersedia."
    };
  }
  if (!rawCfg.products || typeof rawCfg.products !== "object") {
    return {
      ok: false,
      errorCode: "MISSING_BNI_CONFIG",
      reason: "Konfigurasi daftar produk Bank BNI ('products') hilang."
    };
  }
  if (!rawCfg.insuranceSchemes || typeof rawCfg.insuranceSchemes !== "object") {
    return {
      ok: false,
      errorCode: "MISSING_BNI_CONFIG",
      reason: "Konfigurasi skema asuransi Bank BNI ('insuranceSchemes') hilang."
    };
  }
  if (!Array.isArray(rawCfg.interestRateTiers) || rawCfg.interestRateTiers.length === 0) {
    return {
      ok: false,
      errorCode: "MISSING_BNI_CONFIG",
      reason: "Tabel suku bunga Bank BNI ('interestRateTiers') hilang atau kosong."
    };
  }
  if (
    !rawCfg.ajkMenurunRegRates ||
    typeof rawCfg.ajkMenurunRegRates !== "object" ||
    Object.keys(rawCfg.ajkMenurunRegRates).length === 0
  ) {
    return {
      ok: false,
      errorCode: "MISSING_BNI_CONFIG",
      reason: "Matriks tarif AJK CAR Skema Menurun ('ajkMenurunRegRates') hilang atau kosong."
    };
  }
  const maxPlafondAbsolute = Number(rawCfg.maxPlafondAbsolute ?? BNI_UNDERWRITING_MAX_PLAFOND);
  const maxTenorMonths = Number(rawCfg.maxTenorMonths ?? BNI_CONFIRMED_MAX_TENOR_MONTHS);
  const revision = rawCfg.revision ?? 1;
  if (
    !Number.isSafeInteger(maxPlafondAbsolute) || maxPlafondAbsolute <= 0 ||
    !Number.isSafeInteger(maxTenorMonths) || maxTenorMonths <= 0 ||
    !Number.isSafeInteger(revision) || revision < 1
  ) {
    return { ok: false, errorCode: "MISSING_BNI_CONFIG", reason: "Batas plafon, tenor, atau versi parameter BNI tidak valid." };
  }
  return {
    ok: true,
    cfg: {
      ...rawCfg,
      subsidyPermilCap: Number.isFinite(Number(rawCfg.subsidyPermilCap))
        ? Number(rawCfg.subsidyPermilCap)
        : BNI_SUBSIDY_PERMIL,
      maxInstallmentRatio: Number.isFinite(Number(rawCfg.maxInstallmentRatio))
        ? Number(rawCfg.maxInstallmentRatio)
        : 90,
      maxPlafondAbsolute: Math.min(maxPlafondAbsolute, BNI_UNDERWRITING_MAX_PLAFOND),
      maxTenorMonths: Math.min(maxTenorMonths, BNI_CONFIRMED_MAX_TENOR_MONTHS),
      revision,
      underwritingDescriptions: rawCfg.underwritingDescriptions || { ...BNI_UNDERWRITING_DESCRIPTIONS }
    }
  };
}

function parseOptionalNonNegNumber(raw, { integerOnly = false, fallback = null } = {}) {
  const provided = raw != null && !(typeof raw === "string" && raw.trim() === "");
  if (!provided) return { provided: false, valid: true, value: fallback };
  if (typeof raw !== "number" && typeof raw !== "string") return { provided: true, valid: false, value: 0 };
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || num > Number.MAX_SAFE_INTEGER) return { provided: true, valid: false, value: 0 };
  if (integerOnly && !Number.isInteger(num)) return { provided: true, valid: false, value: 0 };
  return { provided: true, valid: true, value: num };
}

function makeInvalidBniResponse({
  cfg,
  body,
  productDef = null,
  schemeDef = null,
  processDateStr = "",
  ageYears = 0,
  salary = 0,
  takeOver = 0,
  tenor = 0,
  plafond = 0,
  errorCode = "BNI_INVALID_INPUT",
  reason,
  available = true,
  issues = null
}) {
  const safeSalary = Number.isFinite(salary) ? Math.round(Math.max(0, salary)) : 0;
  const safeTakeOver = Number.isFinite(takeOver) ? Math.round(Math.max(0, takeOver)) : 0;
  const safeTenor = Number.isFinite(tenor) ? Math.max(0, Math.floor(tenor)) : 0;
  const safePlafond = Number.isFinite(plafond) ? Math.round(Math.max(0, plafond)) : 0;
  const issueList = Array.isArray(issues) && issues.length > 0 ? issues : [reason];
  return {
    status: "INVALID",
    available,
    processable: false,
    overall_ok: false,
    error_code: errorCode,
    stop_reason: issueList.join(" "),
    errors: issueList,
    bank_key: "bank_bni",
    bank_name: cfg?.name || "Bank BNI — BNI Fleksi Pensiun & Pra Purna",
    policy_version: cfg?.policyVersion || BNI_POLICY_VERSION,
    name: body?.name || "",
    birth_date: body?.birth_date || "",
    process_date: processDateStr,
    age: ageYears,
    category: productDef && schemeDef ? `${productDef.name} • ${schemeDef.label}` : "BNI Fleksi • Tidak Valid",
    plafond: safePlafond,
    tenor: safeTenor,
    max_tenor: 0,
    eval_tenor: 0,
    max_plafond: 0,
    max_plafond_exact: 0,
    bank_rate: 0,
    coop_rate: 0,
    salary: safeSalary,
    take_over: safeTakeOver,
    tata_laksana_pct: productDef?.btlPercent ?? 0,
    bank_installment: 0,
    coop_installment: 0,
    baa: 0,
    ratio_pct: 0,
    proaq_pct: productDef?.provisiPercent ?? 0,
    proaq: 0,
    risk_pct: 0,
    risk: 0,
    admin_fee: productDef?.adminFee ?? 0,
    tata_laksana_fee: 0,
    total_fees: 0,
    retention_multiplier: 0,
    retention: 0,
    net_disbursement: 0,
    remaining_salary: safeSalary,
    validations: [
      ...issueList.map((msg, i) => ({ key: i === 0 ? "input" : `input_${i}`, label: msg, ok: false })),
      { key: "overall", label: "Status Kelayakan Akhir BNI Fleksi (INVALID)", ok: false }
    ],
    issues: issueList
  };
}

function makeUnavailableResponse({
  cfg,
  body,
  productCode,
  productDef,
  schemeCode,
  schemeDef,
  processDateStr,
  ageYears,
  salary,
  tenor,
  plafond,
  errorCode,
  reason,
  sourceCells
}) {
  return {
    status: "UNAVAILABLE",
    available: false,
    processable: false,
    overall_ok: false,
    error_code: errorCode,
    unavailable_reason: reason,
    stop_reason: reason,
    source_cells: sourceCells || productDef?.sourceCells || schemeDef?.tableSheet || "Kalkulator",
    bank_key: "bank_bni",
    bank_name: cfg.name,
    policy_version: cfg.policyVersion || BNI_POLICY_VERSION,
    name: body.name || "",
    birth_date: body.birth_date || "",
    process_date: processDateStr,
    age: ageYears,
    category: productDef ? `${productDef.name} • Belum Tersedia` : "BNI Fleksi • Belum Tersedia",
    plafond: Math.round(Number(plafond || 0)),
    tenor: Number(tenor || 0),
    bank_rate: 0,
    coop_rate: 0,
    salary: Math.round(Number(salary || 0)),
    take_over: Math.round(Math.max(0, Number(body.take_over || 0))),
    tata_laksana_pct: 0,
    bank_installment: 0,
    coop_installment: 0,
    baa: 0,
    ratio_pct: 0,
    proaq_pct: 0,
    proaq: 0,
    risk_pct: 0,
    risk: 0,
    admin_fee: 0,
    tata_laksana_fee: 0,
    total_fees: 0,
    retention_multiplier: 0,
    retention: 0,
    net_disbursement: 0,
    remaining_salary: Math.round(Number(salary || 0)),
    bni_details: {
      status: "UNAVAILABLE",
      available: false,
      unavailable_reason: reason,
      error_code: errorCode,
      source_cells: sourceCells || productDef?.sourceCells || null,
      product_code: productCode,
      product_name: productDef?.name || String(body.bni_product_code || body.product_code || ""),
      insurance_scheme: schemeCode,
      insurance_scheme_label: schemeDef?.label || String(body.bni_insurance_scheme || body.insurance_scheme || "")
    },
    validations: [
      {
        key: "availability",
        label: reason,
        ok: false
      },
      {
        key: "overall",
        label: "Kombinasi produk / tenor / skema belum tersedia di mesin hitung",
        ok: false
      }
    ],
    issues: [reason]
  };
}

export function resolveBniInterestRate(productCode, tenorMonths, cfg) {
  const raw = Number(tenorMonths);
  if (!Number.isInteger(raw) || raw < 1) {
    return { ok: false, errorCode: "BNI_INVALID_TENOR", reason: "Tenor kredit harus berupa bilangan bulat minimal 1 bulan." };
  }
  const n = raw;
  if (n > 240) {
    return {
      ok: false,
      errorCode: "BNI_TENOR_EXCEEDS_240",
      reason: `Tenor pengajuan (${n} bulan) melebihi batas maksimal absolut 240 bulan pada workbook BNI.`,
      sourceCells: "Kalkulator!D18, D28"
    };
  }
  if (n > BNI_CONFIRMED_MAX_TENOR_MONTHS) {
    return {
      ok: false,
      unavailable: true,
      errorCode: "BNI_TENOR_181_240_UNCONFIRMED",
      reason: `Tarif bunga untuk tenor ${n} bulan (rentang 181–240 bulan) belum tersedia karena tabel suku bunga Kalkulator!L52:O61 berakhir eksplisit pada 169–180 bulan (M61=180). Meskipun D18/D28 menyebut 240 bln untuk Pra Purna dan tabel AJK CAR memiliki kolom 16–20 tahun (Q:U), suku bunga resmi 181–240 bulan belum terkonfirmasi oleh klien.`,
      sourceCells: "Kalkulator!L52:O61, D18, D28; AJK UP MENURUN BFP REG!Q2:U56"
    };
  }
  const tiers = cfg?.interestRateTiers;
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return {
      ok: false,
      errorCode: "MISSING_BNI_CONFIG",
      reason: "Tabel suku bunga Bank BNI ('interestRateTiers') tidak ditemukan atau kosong."
    };
  }
  const tier = tiers.find((t) => n >= t.minMonths && n <= t.maxMonths);
  if (!tier) {
    return {
      ok: false,
      errorCode: "MISSING_BNI_CONFIG",
      reason: `Tier suku bunga untuk tenor ${n} bulan tidak ditemukan pada konfigurasi Bank BNI.`
    };
  }
  if (productCode === "1" && tier.purnaRate === null && Array.isArray(tier.purnaOverlapRates)) {
    return {
      ok: false,
      unavailable: true,
      errorCode: "BNI_RATE_OVERLAP_133_144_UNCONFIRMED",
      reason: `Suku bunga BNI Fleksi Reguler (Kode 1) untuk tenor ${n} bulan (rentang 133–144 bulan) belum tersedia karena tumpang tindih rentang pada Kalkulator!L59:O59 (121–144 bln = 12,00% Purna) vs Kalkulator!L60:O60 (133–168 bln = 12,10% Purna). Menunggu konfirmasi klien untuk rentang 133–144 bulan.`,
      sourceCells: "Kalkulator!L59:O60, L14:O15"
    };
  }
  const rateAnnual = productCode === "4" ? tier.praPurnaRate : tier.purnaRate;
  if (rateAnnual === null || rateAnnual === undefined || !Number.isFinite(Number(rateAnnual))) {
    return {
      ok: false,
      errorCode: "MISSING_BNI_CONFIG",
      reason: `Tarif suku bunga produk Kode ${productCode} untuk tenor ${n} bulan tidak tersedia pada konfigurasi.`
    };
  }
  return { ok: true, rateAnnual: Number(rateAnnual), tier };
}

export function lookupBniAjkRate(entryAgeYears, insuranceTenorYears, cfg) {
  const matrix = cfg?.ajkMenurunRegRates;
  if (!matrix || typeof matrix !== "object" || Object.keys(matrix).length === 0) {
    return {
      covered: false,
      missingConfig: true,
      ratePermil: null,
      reason: "Matriks tarif AJK CAR Skema Menurun tidak ditemukan atau kosong pada konfigurasi."
    };
  }
  const ageRow = matrix[entryAgeYears] || matrix[String(entryAgeYears)];
  if (!Array.isArray(ageRow)) {
    return {
      covered: false,
      ratePermil: null,
      reason: `Usia masuk (${entryAgeYears} tahun) berada di luar rentang kepesertaan AJK CAR Skema Menurun (20–74 tahun).`
    };
  }
  const colIdx = insuranceTenorYears - 1;
  if (colIdx < 0 || colIdx >= ageRow.length) {
    return {
      covered: false,
      ratePermil: null,
      reason: `Masa asuransi (${insuranceTenorYears} tahun) berada di luar kolom tabel AJK CAR (1–20 tahun).`
    };
  }
  const ratePermil = ageRow[colIdx];
  if (ratePermil === null || ratePermil === undefined || !Number.isFinite(Number(ratePermil))) {
    return {
      covered: false,
      ratePermil: null,
      reason: `Kombinasi usia masuk ${entryAgeYears} tahun + masa asuransi ${insuranceTenorYears} tahun (${entryAgeYears + insuranceTenorYears} tahun > ${BNI_MAX_AGE_LIMIT_YEARS} tahun) berstatus 'Tidak di Cover' pada tabel AJK CAR.`
    };
  }
  return { covered: true, ratePermil: Number(ratePermil), reason: null };
}

function buildCoreContext(body, rawCfg, defaultProcessDate) {
  const cfgCheck = validateAndResolveBniConfig(rawCfg);
  const rawProcessDate = body.process_date || defaultProcessDate || todayWibIso();
  const procStr = typeof rawProcessDate === "string" ? rawProcessDate.trim().slice(0, 10) : "";
  const procDate = parseUtcDate(procStr);
  const dobStr = typeof body.birth_date === "string" ? body.birth_date.trim().slice(0, 10) : "";
  const dobDate = parseUtcDate(dobStr);

  if (!cfgCheck.ok) {
    return {
      configOk: false,
      configError: cfgCheck,
      cfg: rawCfg,
      procStr,
      procDate,
      dobStr,
      dobDate
    };
  }
  const cfg = cfgCheck.cfg;

  const rawProdCode = body.bni_product_code ?? body.product_code ?? "4";
  const productCode = normalizeBniProductCode(rawProdCode);
  const productDef = productCode ? cfg.products[productCode] || null : null;
  if (productCode && !productDef) {
    return {
      configOk: false,
      configError: {
        errorCode: "MISSING_BNI_CONFIG",
        reason: `Definisi produk BNI Kode ${productCode} hilang dari konfigurasi mitra.`
      },
      cfg,
      procStr,
      procDate,
      dobStr,
      dobDate
    };
  }
  if (
    productDef?.supported === true &&
    (!Number.isFinite(Number(productDef.adminFee)) ||
      !Number.isFinite(Number(productDef.provisiPercent)) ||
      !Number.isFinite(Number(productDef.btlPercent)))
  ) {
    return {
      configOk: false,
      configError: {
        errorCode: "MISSING_BNI_CONFIG",
        reason: `Komponen biaya bank (adminFee/provisiPercent/btlPercent) untuk Kode ${productCode} tidak lengkap.`
      },
      cfg,
      procStr,
      procDate,
      dobStr,
      dobDate
    };
  }

  const rawScheme = body.bni_insurance_scheme ?? body.insurance_scheme ?? "MENURUN";
  const schemeCode = normalizeBniInsuranceScheme(rawScheme);
  const schemeDef = schemeCode ? cfg.insuranceSchemes[schemeCode] || null : null;
  if (schemeCode && !schemeDef) {
    return {
      configOk: false,
      configError: {
        errorCode: "MISSING_BNI_CONFIG",
        reason: `Definisi skema asuransi '${schemeCode}' hilang dari konfigurasi mitra.`
      },
      cfg,
      procStr,
      procDate,
      dobStr,
      dobDate
    };
  }

  const salaryParse = parseOptionalNonNegNumber(body.salary, { fallback: 0 });
  const salaryValid = salaryParse.provided && salaryParse.valid && salaryParse.value > 0;
  const salary = salaryParse.valid ? salaryParse.value : 0;

  const dbrRaw = body.bni_dbr_pct ?? body.dbr_pct;
  const dbrParse = parseOptionalNonNegNumber(dbrRaw, { fallback: cfg.maxInstallmentRatio });
  const dbrPct = dbrParse.valid ? Number(dbrParse.value) : NaN;
  const dbrValid = dbrParse.valid && Number.isFinite(dbrPct) && dbrPct > 0 && dbrPct <= 100;

  const takeOverParse = parseOptionalNonNegNumber(body.take_over, { fallback: 0 });
  const plafondParse = parseOptionalNonNegNumber(body.plafond, { fallback: null });
  const tenorParse = parseOptionalNonNegNumber(body.tenor, { integerOnly: true, fallback: null });
  const blokirAngsParse = parseOptionalNonNegNumber(body.blokir_angsuran_count, {
    integerOnly: true,
    fallback: productDef?.defaultBlokirAngsuran ?? 3
  });
  const blokirTabParse = parseOptionalNonNegNumber(body.blokir_tabungan_count, {
    integerOnly: true,
    fallback: productDef?.defaultBlokirTabungan ?? 1
  });
  const blokirPrapenParse = parseOptionalNonNegNumber(body.blokir_prapensiun_count, {
    integerOnly: true,
    fallback: productDef?.defaultBlokirPrapensiun ?? 0
  });
  const blokirValid = blokirAngsParse.valid && blokirTabParse.valid && blokirPrapenParse.valid;

  // Tanggal Pencairan (rencana/aktual) & TMT Pensiun opsional khusus Pra Purna (Kode 4)
  const isPraPurna = productCode === "4";
  const disbursementDateParse = parseOptionalStrictCalendarDate(body.bni_disbursement_date);
  const tmtPensiunDateParse = parseOptionalStrictCalendarDate(body.bni_tmt_pensiun_date);
  const disbursementDateValid = !isPraPurna || disbursementDateParse.valid;
  const tmtPensiunDateValid = !isPraPurna || tmtPensiunDateParse.valid;
  const disbursementDateStr = isPraPurna && disbursementDateParse.valid ? disbursementDateParse.value : null;
  const tmtPensiunDateStr = isPraPurna && tmtPensiunDateParse.valid ? tmtPensiunDateParse.value : null;

  const ageObj = dobDate && procDate && dobDate <= procDate ? datedifYMD(dobDate, procDate) : null;
  const entryAgeYears = ageObj ? ageObj.years : null;
  const roundedAgeYears = entryAgeYears !== null ? entryAgeYears + 1 : null;
  const age75Date = dobDate ? edateUtc(dobDate, BNI_MAX_AGE_LIMIT_YEARS * 12) : null;
  const age75DateStr = age75Date ? formatUtcDate(age75Date) : "";
  const remainingServiceMonths = dobDate && procDate && age75Date ? datedifTotalMonths(procDate, age75Date) : 0;

  return {
    configOk: true,
    cfg,
    procStr,
    procDate,
    dobStr,
    dobDate,
    rawProdCode,
    rawName: body.name || "",
    productCode,
    productDef,
    rawScheme,
    schemeCode,
    schemeDef,
    salaryParse,
    salaryValid,
    salary,
    dbrPct: dbrValid ? dbrPct : 0,
    dbrValid,
    takeOverParse,
    takeOverValid: takeOverParse.valid,
    takeOver: takeOverParse.value,
    plafondParse,
    tenorParse,
    blokirAngsParse,
    blokirTabParse,
    blokirPrapenParse,
    blokirValid,
    disbursementDateValid,
    tmtPensiunDateValid,
    disbursementDateStr,
    tmtPensiunDateStr,
    ageObj,
    entryAgeYears,
    roundedAgeYears,
    age75Date,
    age75DateStr,
    remainingServiceMonths
  };
}

function checkAvailability(ctx, tenorForCheck, plafondForCheck) {
  if (!ctx.productCode || !ctx.productDef) {
    return makeUnavailableResponse({
      cfg: ctx.cfg,
      body: { name: ctx.rawName, birth_date: ctx.dobStr, take_over: ctx.takeOver, bni_product_code: ctx.rawProdCode },
      productCode: ctx.rawProdCode,
      productDef: null,
      schemeCode: ctx.schemeCode,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      tenor: tenorForCheck,
      plafond: plafondForCheck,
      errorCode: "BNI_PRODUCT_UNKNOWN",
      reason: "Kode produk BNI tidak dikenali. Gunakan Kode 1 (BNI Fleksi Reguler) atau Kode 4 (BNI Fleksi Pra Purna)."
    });
  }

  if (ctx.productDef.supported === false) {
    return makeUnavailableResponse({
      cfg: ctx.cfg,
      body: { name: ctx.rawName, birth_date: ctx.dobStr, take_over: ctx.takeOver },
      productCode: ctx.productCode,
      productDef: ctx.productDef,
      schemeCode: ctx.schemeCode,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      tenor: tenorForCheck,
      plafond: plafondForCheck,
      errorCode: "BNI_PRODUCT_UNAVAILABLE",
      reason: ctx.productDef.unavailableReason,
      sourceCells: ctx.productDef.sourceCells
    });
  }

  if (!ctx.schemeCode || !ctx.schemeDef) {
    return makeUnavailableResponse({
      cfg: ctx.cfg,
      body: { name: ctx.rawName, birth_date: ctx.dobStr, take_over: ctx.takeOver },
      productCode: ctx.productCode,
      productDef: ctx.productDef,
      schemeCode: ctx.rawScheme,
      schemeDef: null,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      tenor: tenorForCheck,
      plafond: plafondForCheck,
      errorCode: "BNI_INSURANCE_SCHEME_UNKNOWN",
      reason: "Skema asuransi BNI tidak dikenali. Saat ini skema Menurun (MENURUN) tersedia."
    });
  }

  if (ctx.schemeDef.supported === false) {
    return makeUnavailableResponse({
      cfg: ctx.cfg,
      body: { name: ctx.rawName, birth_date: ctx.dobStr, take_over: ctx.takeOver },
      productCode: ctx.productCode,
      productDef: ctx.productDef,
      schemeCode: ctx.schemeCode,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      tenor: tenorForCheck,
      plafond: plafondForCheck,
      errorCode: "BNI_INSURANCE_SCHEME_UNAVAILABLE",
      reason: ctx.schemeDef.unavailableReason,
      sourceCells: ctx.schemeDef.tableSheet
    });
  }

  return null;
}

function computeConfirmedMaxTenor(ctx) {
  const rawByService = Math.max(0, ctx.remainingServiceMonths);
  const rawMaxByProduct = ctx.productCode === "4"
    ? Math.min(240, rawByService)
    : Math.min(BNI_CONFIRMED_MAX_TENOR_MONTHS, rawByService);
  let maturitySafeMonths = rawByService;
  if (ctx.procDate && ctx.age75Date) {
    while (maturitySafeMonths > 0 && eomonthUtc(ctx.procDate, maturitySafeMonths) > ctx.age75Date) {
      maturitySafeMonths -= 1;
    }
  }
  let maxConfirmedTenor = Math.min(ctx.cfg.maxTenorMonths, maturitySafeMonths);
  let maxTenorNote = null;

  if (ctx.productCode === "1" && maxConfirmedTenor >= 133 && maxConfirmedTenor <= 144) {
    maxConfirmedTenor = 132;
    maxTenorNote =
      "Tenor maksimal terkonfirmasi diposisikan di 132 bulan karena rentang 133–144 bulan pada Kode 1 berstatus Belum Tersedia akibat tumpang tindih tabel bunga (12,00% vs 12,10%).";
  } else if (maturitySafeMonths > ctx.cfg.maxTenorMonths) {
    maxTenorNote = ctx.cfg.maxTenorMonths < BNI_CONFIRMED_MAX_TENOR_MONTHS
      ? `Tenor dibatasi oleh parameter BNI pada ${ctx.cfg.maxTenorMonths} bulan.`
      : "Dibatasi pada 180 bulan (rentang 181–240 bulan berstatus Belum Tersedia karena tabel suku bunga Kalkulator!L52:O61 berhenti di 180 bulan).";
  } else if (maturitySafeMonths < rawByService) {
    maxTenorNote =
      `Dibatasi ke ${maxConfirmedTenor} bulan agar tanggal jatuh tempo akhir bulan (EOMONTH) tidak melewati batas usia 75 tahun (${ctx.age75DateStr}).`;
  }
  return { maxConfirmedTenor, rawMaxByProduct, maxTenorNote };
}

export function evaluateBniMax(body, rawCfg, defaultProcessDate) {
  return evaluateBniMaxWithContext(body, buildCoreContext(body, rawCfg, defaultProcessDate));
}

function evaluateBniMaxWithContext(body, ctx) {
  if (!ctx.configOk) {
    return makeInvalidBniResponse({
      cfg: ctx.cfg,
      body,
      processDateStr: ctx.procStr,
      errorCode: ctx.configError.errorCode,
      reason: ctx.configError.reason,
      available: false
    });
  }
  const availStop = checkAvailability(ctx, ctx.tenorParse.value || 0, ctx.plafondParse.value || 0);
  if (availStop) return availStop;

  const errors = [];
  if (ctx.tenorParse.provided) {
    if (!ctx.tenorParse.valid || ctx.tenorParse.value < 1) {
      errors.push("Tenor kredit harus berupa bilangan bulat minimal 1 bulan.");
    } else if (ctx.tenorParse.value > 240) {
      errors.push(
        `Tenor pengajuan (${ctx.tenorParse.value} bulan) melebihi batas maksimal absolut 240 bulan pada workbook BNI.`
      );
    } else {
      const rateCheck = resolveBniInterestRate(ctx.productCode, ctx.tenorParse.value, ctx.cfg);
      if (!rateCheck.ok) {
        if (rateCheck.unavailable) {
          return makeUnavailableResponse({
            cfg: ctx.cfg,
            body,
            productCode: ctx.productCode,
            productDef: ctx.productDef,
            schemeCode: ctx.schemeCode,
            schemeDef: ctx.schemeDef,
            processDateStr: ctx.procStr,
            ageYears: ctx.entryAgeYears ?? 0,
            salary: ctx.salary,
            tenor: ctx.tenorParse.value,
            plafond: body.plafond || 0,
            errorCode: rateCheck.errorCode,
            reason: rateCheck.reason,
            sourceCells: rateCheck.sourceCells
          });
        }
        return makeInvalidBniResponse({
          cfg: ctx.cfg,
          body,
          productDef: ctx.productDef,
          schemeDef: ctx.schemeDef,
          processDateStr: ctx.procStr,
          ageYears: ctx.entryAgeYears ?? 0,
          salary: ctx.salary,
          takeOver: ctx.takeOver,
          tenor: ctx.tenorParse.value,
          plafond: body.plafond || 0,
          errorCode: rateCheck.errorCode,
          reason: rateCheck.reason,
          available: rateCheck.errorCode !== "MISSING_BNI_CONFIG"
        });
      }
      if (ctx.tenorParse.value > ctx.cfg.maxTenorMonths) {
        errors.push(`Tenor pengajuan melebihi batas parameter BNI (${ctx.cfg.maxTenorMonths} bulan).`);
      }
    }
  }

  if (!ctx.procDate) errors.push("Tanggal Aplikasi / Proses tidak valid.");
  if (!ctx.dobDate) errors.push("Tanggal Lahir wajib diisi dengan format YYYY-MM-DD yang valid.");
  if (ctx.dobDate && ctx.procDate && ctx.dobDate > ctx.procDate) {
    errors.push("Tanggal lahir tidak boleh setelah tanggal aplikasi.");
  }
  if (!ctx.disbursementDateValid) {
    errors.push("Rencana Tanggal Pencairan BNI Pra Purna harus berupa tanggal kalender YYYY-MM-DD yang valid.");
  }
  if (!ctx.tmtPensiunDateValid) {
    errors.push("TMT Pensiun BNI Pra Purna harus berupa tanggal kalender YYYY-MM-DD yang valid.");
  }
  if (!ctx.dbrValid) {
    errors.push("Persentase DBR harus bernilai antara > 0% hingga 100%.");
  }
  if (!ctx.salaryValid) {
    errors.push("Gaji bulanan harus bernilai numerik dan lebih dari Rp 0.");
  }
  if (!ctx.takeOverValid) {
    errors.push("Nominal Take Over tidak valid atau bernilai negatif.");
  }
  if (!ctx.plafondParse.valid || (ctx.plafondParse.provided && ctx.plafondParse.value <= 0)) {
    errors.push("Plafond pinjaman tidak valid atau tidak bernilai positif.");
  }
  if (!ctx.blokirValid) {
    errors.push("Jumlah blokir harus berupa bilangan bulat non-negatif.");
  }
  if (ctx.entryAgeYears !== null && (ctx.entryAgeYears < 20 || ctx.entryAgeYears > 74)) {
    errors.push(`Usia masuk (${ctx.entryAgeYears} tahun) di luar rentang kepesertaan BNI & AJK CAR (20–74 tahun).`);
  }
  if (ctx.dobDate && ctx.procDate && ctx.remainingServiceMonths < 1) {
    errors.push(`Sisa masa usia ke batas ${BNI_MAX_AGE_LIMIT_YEARS} tahun (${ctx.age75DateStr}) kurang dari 1 bulan.`);
  }

  const { maxConfirmedTenor, rawMaxByProduct, maxTenorNote } = computeConfirmedMaxTenor(ctx);
  if (
    ctx.dobDate &&
    ctx.procDate &&
    ctx.tenorParse.provided &&
    ctx.tenorParse.valid &&
    ctx.tenorParse.value >= 1 &&
    ctx.tenorParse.value <= BNI_CONFIRMED_MAX_TENOR_MONTHS
  ) {
    const reqMaturityDate = eomonthUtc(ctx.procDate, ctx.tenorParse.value);
    if (ctx.remainingServiceMonths < ctx.tenorParse.value || (ctx.age75Date && reqMaturityDate > ctx.age75Date)) {
      errors.push(
        `Tanggal jatuh tempo (${formatUtcDate(reqMaturityDate)}) melewati batas usia ${BNI_MAX_AGE_LIMIT_YEARS} tahun (${ctx.age75DateStr}).`
      );
    }
  }

  const evalTenor =
    errors.length > 0
      ? 0
      : ctx.tenorParse.provided
      ? ctx.tenorParse.value
      : maxConfirmedTenor;

  const rateRes = evalTenor >= 1 ? resolveBniInterestRate(ctx.productCode, evalTenor, ctx.cfg) : { ok: false };
  if (errors.length === 0 && !rateRes.ok && rateRes.errorCode === "MISSING_BNI_CONFIG") {
    return makeInvalidBniResponse({
      cfg: ctx.cfg,
      body,
      productDef: ctx.productDef,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      takeOver: ctx.takeOver,
      tenor: evalTenor,
      plafond: body.plafond || 0,
      errorCode: rateRes.errorCode,
      reason: rateRes.reason,
      available: false
    });
  }

  const effectiveRateAnnual = rateRes.ok ? rateRes.rateAnnual : 0;
  const maxInstallmentExact = ctx.salaryValid && ctx.dbrValid ? ctx.salary * (ctx.dbrPct / 100) : 0;
  const monthlyRate = effectiveRateAnnual / 100 / 12;
  const maxPlafondExact =
    errors.length === 0 && rateRes.ok && evalTenor > 0 && maxInstallmentExact > 0
      ? Math.min(pv(monthlyRate, evalTenor, maxInstallmentExact), ctx.cfg.maxPlafondAbsolute)
      : 0;
  const maxPlafondRoundedDown = Math.floor(maxPlafondExact);

  const ajkYearsForEval = evalTenor > 0 ? Math.ceil(evalTenor / 12) : 0;
  const ajkLookup =
    errors.length === 0 && ctx.entryAgeYears !== null && ajkYearsForEval >= 1
      ? lookupBniAjkRate(ctx.entryAgeYears, ajkYearsForEval, ctx.cfg)
      : { covered: false, ratePermil: null, reason: null };

  if (ajkLookup.missingConfig) {
    return makeInvalidBniResponse({
      cfg: ctx.cfg,
      body,
      productDef: ctx.productDef,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      takeOver: ctx.takeOver,
      tenor: evalTenor,
      errorCode: "MISSING_BNI_CONFIG",
      reason: ajkLookup.reason,
      available: false
    });
  }
  if (ajkLookup.covered === false && ajkLookup.reason && errors.length === 0) {
    errors.push(ajkLookup.reason);
  }

  return {
    status: errors.length === 0 ? "AVAILABLE" : "INVALID",
    available: true,
    processable: errors.length === 0 && maxPlafondRoundedDown > 0 && evalTenor > 0,
    stop_reason: errors.length > 0 ? errors.join(" ") : null,
    errors,
    bank_key: "bank_bni",
    bank_name: ctx.cfg.name,
    policy_version: ctx.cfg.policyVersion || BNI_POLICY_VERSION,
    bni_policy_revision: ctx.cfg.revision,
    name: body.name || "",
    birth_date: ctx.dobStr,
    process_date: ctx.procStr,
    bni_disbursement_date: ctx.disbursementDateStr,
    bni_tmt_pensiun_date: ctx.tmtPensiunDateStr,
    age: ctx.entryAgeYears ?? 0,
    age_months: ctx.ageObj?.months ?? 0,
    age_days: ctx.ageObj?.days ?? 0,
    age_rounded_years: ctx.roundedAgeYears ?? 0,
    age_exact_text: ctx.ageObj?.text || "-",
    age_75_date: ctx.age75DateStr,
    remaining_service_months: ctx.remainingServiceMonths,
    bni_product_code: ctx.productCode,
    bni_product_name: ctx.productDef.name,
    bni_insurance_scheme: ctx.schemeCode,
    bni_insurance_scheme_label: ctx.schemeDef.label,
    category: `${ctx.productDef.name} • ${ctx.schemeDef.label}`,
    bank_rate: effectiveRateAnnual,
    coop_rate: effectiveRateAnnual,
    dbr_pct: ctx.dbrPct,
    salary: Math.round(ctx.salary),
    max_installment_exact: maxInstallmentExact,
    max_installment: Math.round(maxInstallmentExact),
    max_tenor: maxConfirmedTenor,
    eval_tenor: evalTenor,
    excel_raw_max_tenor: rawMaxByProduct,
    max_tenor_note: maxTenorNote,
    max_plafond_exact: maxPlafondExact,
    max_plafond: maxPlafondRoundedDown,
    ajk_rate_permil: ajkLookup.ratePermil,
    ajk_covered: ajkLookup.covered,
    take_over: Math.round(ctx.takeOver)
  };
}

export function evaluateBniPreview(body, rawCfg, defaultProcessDate) {
  const ctx = buildCoreContext(body, rawCfg, defaultProcessDate);
  if (!ctx.configOk) {
    return makeInvalidBniResponse({
      cfg: rawCfg,
      body,
      processDateStr: ctx.procStr,
      errorCode: ctx.configError.errorCode,
      reason: ctx.configError.reason,
      available: false
    });
  }
  const availStop = checkAvailability(
    ctx,
    ctx.tenorParse.provided ? ctx.tenorParse.value : 0,
    ctx.plafondParse.value || 0
  );
  if (availStop) return availStop;

  if (ctx.tenorParse.provided && (!ctx.tenorParse.valid || ctx.tenorParse.value < 1)) {
    return makeInvalidBniResponse({
      cfg: ctx.cfg,
      body,
      productDef: ctx.productDef,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      takeOver: ctx.takeOver,
      tenor: 0,
      plafond: ctx.plafondParse.value || 0,
      errorCode: "BNI_INVALID_TENOR",
      reason: "Tenor kredit harus berupa bilangan bulat minimal 1 bulan."
    });
  }

  const maxRes = evaluateBniMaxWithContext(body, ctx);
  if (
    maxRes.status === "UNAVAILABLE" ||
    maxRes.error_code === "MISSING_BNI_CONFIG" ||
    maxRes.error_code === "BNI_PRODUCT_UNKNOWN" ||
    maxRes.error_code === "BNI_INSURANCE_SCHEME_UNKNOWN"
  ) {
    return maxRes;
  }

  const tenor = ctx.tenorParse.provided ? ctx.tenorParse.value : maxRes.max_tenor;
  if (!Number.isInteger(tenor) || tenor < 1) {
    const reason =
      maxRes.errors?.[0] || "Tenor kredit harus berupa bilangan bulat minimal 1 bulan.";
    return makeInvalidBniResponse({
      cfg: ctx.cfg,
      body,
      productDef: ctx.productDef,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      takeOver: ctx.takeOver,
      tenor: tenor || 0,
      plafond: ctx.plafondParse.value || 0,
      errorCode: "BNI_INVALID_TENOR",
      reason
    });
  }

  const rateRes = resolveBniInterestRate(ctx.productCode, tenor, ctx.cfg);
  if (!rateRes.ok) {
    if (rateRes.unavailable) {
      return makeUnavailableResponse({
        cfg: ctx.cfg,
        body,
        productCode: ctx.productCode,
        productDef: ctx.productDef,
        schemeCode: ctx.schemeCode,
        schemeDef: ctx.schemeDef,
        processDateStr: ctx.procStr,
        ageYears: ctx.entryAgeYears ?? 0,
        salary: ctx.salary,
        tenor,
        plafond: ctx.plafondParse.value || 0,
        errorCode: rateRes.errorCode,
        reason: rateRes.reason,
        sourceCells: rateRes.sourceCells
      });
    }
    return makeInvalidBniResponse({
      cfg: ctx.cfg,
      body,
      productDef: ctx.productDef,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      takeOver: ctx.takeOver,
      tenor,
      plafond: ctx.plafondParse.value || 0,
      errorCode: rateRes.errorCode,
      reason: rateRes.reason,
      available: rateRes.errorCode !== "MISSING_BNI_CONFIG"
    });
  }

  const effectiveRateAnnual = rateRes.rateAnnual;
  const monthlyRate = effectiveRateAnnual / 100 / 12;
  const maxInstallmentExact = ctx.salaryValid && ctx.dbrValid ? ctx.salary * (ctx.dbrPct / 100) : 0;
  const maxPlafondPvExact = pv(monthlyRate, tenor, maxInstallmentExact);
  const maxPlafondExact = Math.min(maxPlafondPvExact, ctx.cfg.maxPlafondAbsolute);

  const plafond = ctx.plafondParse.provided ? ctx.plafondParse.value : Math.floor(maxPlafondExact);
  const maturityDate = ctx.procDate ? eomonthUtc(ctx.procDate, tenor) : null;
  const maturityDateStr = maturityDate ? formatUtcDate(maturityDate) : "";
  const maturityAgeObj =
    ctx.dobDate && maturityDate && maturityDate >= ctx.dobDate
      ? datedifYMD(ctx.dobDate, maturityDate)
      : null;

  const monthlyInstallmentExact = plafond > 0 && tenor > 0 ? pmt(monthlyRate, tenor, plafond) : 0;
  const remainingSalaryExact = ctx.salary - monthlyInstallmentExact;
  const ratioPct = ctx.salary > 0 ? Number(((monthlyInstallmentExact / ctx.salary) * 100).toFixed(2)) : 0;

  // Biaya Bank per Kalkulator!B29 & D29:
  // Kode 1: Admin 80rb + Provisi 0,2% + BTL 3,5% (= 3,7% * Plafond + 80.000)
  // Kode 4: Admin 150rb + Provisi 1,0% + BTL 3,5% (= 4,5% * Plafond + 150.000)
  const adminFee = ctx.productDef.adminFee;
  const provisiExact = plafond * (ctx.productDef.provisiPercent / 100);
  const btlExact = plafond * (ctx.productDef.btlPercent / 100);
  const bankFeesExact = plafond > 0 ? provisiExact + btlExact + adminFee : 0;

  // Asuransi Jiwa Kredit (AJK UP MENURUN BFP REG — CAR)
  const insuranceTenorYears = Math.ceil(tenor / 12);
  const ajkLookup =
    ctx.entryAgeYears !== null
      ? lookupBniAjkRate(ctx.entryAgeYears, insuranceTenorYears, ctx.cfg)
      : { covered: false, ratePermil: null, reason: "Tanggal lahir dan tanggal aplikasi wajib valid." };

  if (ajkLookup.missingConfig) {
    return makeInvalidBniResponse({
      cfg: ctx.cfg,
      body,
      productDef: ctx.productDef,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      takeOver: ctx.takeOver,
      tenor,
      plafond,
      errorCode: "MISSING_BNI_CONFIG",
      reason: ajkLookup.reason,
      available: false
    });
  }

  // Validasi kelayakan input dasar sebelum menghitung pencairan akhir
  const inputDateValid = Boolean(ctx.dobDate && ctx.procDate && ctx.dobDate <= ctx.procDate);
  const inputIssues = [];
  if (!ctx.procDate) inputIssues.push("Tanggal Aplikasi / Proses tidak valid.");
  if (!ctx.dobDate) inputIssues.push("Tanggal Lahir wajib diisi dengan format YYYY-MM-DD yang valid.");
  if (ctx.dobDate && ctx.procDate && ctx.dobDate > ctx.procDate) {
    inputIssues.push("Tanggal lahir tidak boleh setelah tanggal aplikasi.");
  }
  if (!ctx.disbursementDateValid) {
    inputIssues.push("Rencana Tanggal Pencairan BNI Pra Purna harus berupa tanggal kalender YYYY-MM-DD yang valid.");
  }
  if (!ctx.tmtPensiunDateValid) {
    inputIssues.push("TMT Pensiun BNI Pra Purna harus berupa tanggal kalender YYYY-MM-DD yang valid.");
  }
  if (!ctx.salaryValid) inputIssues.push("Gaji bulanan harus bernilai numerik dan lebih dari Rp 0.");
  if (!ctx.dbrValid) inputIssues.push("Persentase DBR harus bernilai antara > 0% hingga 100%.");
  if (!ctx.takeOverValid) inputIssues.push("Nominal Take Over tidak valid atau bernilai negatif.");
  if (!ctx.plafondParse.valid) inputIssues.push("Plafond pinjaman tidak valid atau bernilai negatif.");
  if (!ctx.blokirValid) inputIssues.push("Jumlah blokir harus berupa bilangan bulat non-negatif.");

  if (inputIssues.length > 0) {
    return makeInvalidBniResponse({
      cfg: ctx.cfg,
      body,
      productDef: ctx.productDef,
      schemeDef: ctx.schemeDef,
      processDateStr: ctx.procStr,
      ageYears: ctx.entryAgeYears ?? 0,
      salary: ctx.salary,
      takeOver: ctx.takeOver,
      tenor,
      plafond,
      errorCode: "BNI_INVALID_INPUT",
      reason: inputIssues[0],
      issues: inputIssues
    });
  }

  const subsidyCapPermil = Number(ctx.cfg.subsidyPermilCap ?? BNI_SUBSIDY_PERMIL);
  const ratePermil = ajkLookup.covered ? ajkLookup.ratePermil : 0;
  const bniSubsidyPermil = ajkLookup.covered ? Math.min(ratePermil, subsidyCapPermil) : 0;
  const customerPermil = ajkLookup.covered ? Math.max(0, ratePermil - subsidyCapPermil) : 0;

  const grossAjkPremiumExact = ajkLookup.covered ? (plafond / 1000) * ratePermil : 0;
  const bniSubsidyPremiumExact = ajkLookup.covered ? (plafond / 1000) * bniSubsidyPermil : 0;
  const customerAjkPremiumExact = ajkLookup.covered ? (plafond / 1000) * customerPermil : 0;

  const underwritingCode =
    ctx.entryAgeYears !== null && plafond > 0
      ? resolveBniUnderwritingCode(ctx.entryAgeYears, plafond)
      : null;
  const underwritingDesc = underwritingCode
    ? (ctx.cfg.underwritingDescriptions?.[underwritingCode] || underwritingCode)
    : "TIDAK DICOVER ASURANSI";
  const underwritingRequiresVerification = ajkLookup.covered && requiresBniUnderwritingReview(ctx.entryAgeYears, plafond, underwritingCode);

  const totalFeesExact = bankFeesExact + customerAjkPremiumExact;
  const netBeforeBlokirExact = plafond - totalFeesExact;

  // Blokir Angsuran, Tabungan Wajib, Prapensiun (Kalkulator!B40:D42)
  const blokirAngsuranCount = ctx.blokirAngsParse.value;
  const blokirTabunganCount = ctx.blokirTabParse.value;
  const blokirPrapensiunCount = ctx.blokirPrapenParse.value;

  const blokirAngsuranExact = blokirAngsuranCount * monthlyInstallmentExact;
  const blokirTabunganExact = blokirTabunganCount * monthlyInstallmentExact;
  const blokirPrapensiunExact = blokirPrapensiunCount * monthlyInstallmentExact;
  const totalBlokirExact = blokirAngsuranExact + blokirTabunganExact + blokirPrapensiunExact;
  const totalBlokirCount = blokirAngsuranCount + blokirTabunganCount + blokirPrapensiunCount;

  const terimaBersihBeforeToExact = netBeforeBlokirExact - totalBlokirExact;
  const terimaBersihAfterToExact = terimaBersihBeforeToExact - ctx.takeOver;

  // Validasi Kelayakan sesuai D28 + Tanggal Jatuh Tempo (EOMONTH <= Usia 75) + AJK Cover + Net Cash
  const entryAgeOk = ctx.entryAgeYears !== null && ctx.entryAgeYears >= 20 && ctx.entryAgeYears <= 74;
  const serviceTenorOk = ctx.remainingServiceMonths > 0 && tenor <= ctx.remainingServiceMonths;
  const maturityWithinAge75 = Boolean(maturityDate && ctx.age75Date && maturityDate <= ctx.age75Date);
  const withinTenorLimit = tenor <= ctx.cfg.maxTenorMonths;
  const ajkCoverOk = ajkLookup.covered === true;
  const underwritingOk = Boolean(underwritingCode && ajkCoverOk && !underwritingRequiresVerification);
  const plafondOk = plafond > 0 && plafond <= maxPlafondExact + 1e-6;
  const dbrOk = monthlyInstallmentExact > 0 && monthlyInstallmentExact <= maxInstallmentExact + 1e-6;
  const netOk = terimaBersihAfterToExact > 0;

  const validations = [
    {
      key: "dates_salary",
      label: "Tanggal lahir, tanggal aplikasi, DBR, dan gaji bulanan valid",
      ok: true
    },
    {
      key: "entry_age",
      label: `Usia masuk 20–74 tahun (${ctx.entryAgeYears ?? "-"} tahun)`,
      ok: entryAgeOk
    },
    {
      key: "tenor_service",
      label: !withinTenorLimit
        ? `Tenor (${tenor} bulan) melewati batas parameter BNI (${ctx.cfg.maxTenorMonths} bulan).`
        : maturityWithinAge75
        ? `Tenor (${tenor} bln) ≤ sisa masa usia 75 thn (${ctx.remainingServiceMonths} bln) & jatuh tempo (${maturityDateStr}) ≤ ${ctx.age75DateStr}`
        : `Tanggal jatuh tempo (${maturityDateStr}) melewati batas usia ${BNI_MAX_AGE_LIMIT_YEARS} tahun (${ctx.age75DateStr})`,
      ok: serviceTenorOk && maturityWithinAge75 && withinTenorLimit
    },
    {
      key: "ajk_cover",
      label: ajkCoverOk
        ? `AJK CAR Skema Menurun Cover (${ratePermil}‰ • Subsidi BNI ${bniSubsidyPermil}‰ • Nasabah ${customerPermil.toFixed(2)}‰)`
        : ajkLookup.reason || "Kombinasi usia dan tenor tidak di-cover AJK CAR",
      ok: ajkCoverOk
    },
    {
      key: "underwriting",
      label: underwritingRequiresVerification
        ? BNI_UNDERWRITING_REVIEW_MESSAGE
        : underwritingOk
        ? `Underwriting Medis: ${underwritingCode} (${underwritingDesc})`
        : "Plafon atau usia berada di luar cakupan underwriting CAR.",
      ok: underwritingOk
    },
    {
      key: "plafond",
      label: `Plafon (${fmtRpId(plafond)}) ≤ plafon maksimum (${fmtRpId(maxPlafondExact)})`,
      ok: plafondOk
    },
    {
      key: "dbr",
      label: `Angsuran (${fmtRpId(monthlyInstallmentExact)}) ≤ Batas DBR ${ctx.dbrPct}% (${fmtRpId(maxInstallmentExact)})`,
      ok: dbrOk
    },
    {
      key: "net",
      label: "Terima Bersih setelah Take Over bernilai positif (> Rp0)",
      ok: netOk
    }
  ];

  const overallOk = validations.every((v) => v.ok);
  validations.push({
    key: "overall",
    label: "Status Kelayakan Akhir BNI Fleksi (PASSED / NOT PASSED)",
    ok: overallOk
  });
  const issues = validations.filter((v) => !v.ok && v.key !== "overall").map((v) => v.label);

  const excelD28Status =
    serviceTenorOk && plafond > 0 && plafond <= maxPlafondPvExact + 1e-6 && tenor <= BNI_CONFIRMED_MAX_TENOR_MONTHS && inputDateValid
      ? "PASSED"
      : "NOT PASSED";

  return {
    status: "AVAILABLE",
    available: true,
    processable: overallOk,
    overall_ok: overallOk,
    bank_key: "bank_bni",
    bank_name: ctx.cfg.name,
    policy_version: ctx.cfg.policyVersion || BNI_POLICY_VERSION,
    bni_policy_revision: ctx.cfg.revision,
    name: body.name || "",
    birth_date: ctx.dobStr,
    process_date: ctx.procStr,
    bni_disbursement_date: ctx.disbursementDateStr,
    bni_tmt_pensiun_date: ctx.tmtPensiunDateStr,
    age: ctx.entryAgeYears ?? 0,
    age_months: ctx.ageObj?.months ?? 0,
    age_days: ctx.ageObj?.days ?? 0,
    category: `${ctx.productDef.name} (Kode ${ctx.productCode}) • ${ctx.schemeDef.label}`,
    plafond: Math.round(plafond),
    tenor,
    bank_rate: effectiveRateAnnual,
    coop_rate: effectiveRateAnnual,
    salary: Math.round(ctx.salary),
    take_over: Math.round(ctx.takeOver),
    tata_laksana_pct: ctx.productDef.btlPercent,
    bank_installment: Math.round(monthlyInstallmentExact),
    coop_installment: Math.round(monthlyInstallmentExact),
    baa: 0,
    ratio_pct: ratioPct,
    proaq_pct: ctx.productDef.provisiPercent,
    proaq: Math.round(provisiExact),
    risk_pct: customerPermil / 10, // persen ekivalen porsi AJK nasabah (untuk tampilan konvensional bila perlu)
    risk: Math.round(customerAjkPremiumExact),
    admin_fee: adminFee,
    tata_laksana_fee: Math.round(btlExact),
    total_fees: Math.round(totalFeesExact),
    retention_multiplier: totalBlokirCount,
    retention: Math.round(totalBlokirExact),
    net_disbursement: Math.round(terimaBersihAfterToExact),
    remaining_salary: Math.round(remainingSalaryExact),
    bni_details: {
      status: "AVAILABLE",
      available: true,
      excel_d28_status: excelD28Status,
      bni_disbursement_date: ctx.disbursementDateStr,
      bni_tmt_pensiun_date: ctx.tmtPensiunDateStr,
      product_code: ctx.productCode,
      product_name: ctx.productDef.name,
      insurance_scheme: ctx.schemeCode,
      insurance_scheme_label: ctx.schemeDef.label,
      insurance_underwriter: ctx.schemeDef.underwriter,
      age_exact_text: ctx.ageObj?.text || "-",
      age_rounded_years: ctx.roundedAgeYears ?? 0,
      entry_age_years: ctx.entryAgeYears ?? 0,
      maturity_date: maturityDateStr,
      maturity_age_text: maturityAgeObj?.text || "-",
      age_75_date: ctx.age75DateStr,
      remaining_service_months: ctx.remainingServiceMonths,
      insurance_tenor_years: insuranceTenorYears,
      dbr_pct: ctx.dbrPct,
      max_installment_exact: maxInstallmentExact,
      max_installment: Math.round(maxInstallmentExact),
      max_plafond_exact: maxPlafondExact,
      max_plafond: Math.floor(maxPlafondExact),
      max_plafond_absolute: ctx.cfg.maxPlafondAbsolute,
      effective_rate_annual_pct: effectiveRateAnnual,
      monthly_installment_exact: monthlyInstallmentExact,
      monthly_installment: Math.round(monthlyInstallmentExact),
      remaining_salary_exact: remainingSalaryExact,
      remaining_salary: Math.round(remainingSalaryExact),
      provisi_pct: ctx.productDef.provisiPercent,
      provisi_exact: provisiExact,
      provisi: Math.round(provisiExact),
      btl_pct: ctx.productDef.btlPercent,
      btl_exact: btlExact,
      btl: Math.round(btlExact),
      admin_fee: adminFee,
      bank_fees_exact: bankFeesExact,
      bank_fees: Math.round(bankFeesExact),
      ajk_covered: ajkLookup.covered,
      ajk_rate_permil: ratePermil,
      subsidy_cap_permil: subsidyCapPermil,
      bni_subsidy_permil: bniSubsidyPermil,
      customer_ajk_permil: customerPermil,
      gross_ajk_premium_exact: grossAjkPremiumExact,
      gross_ajk_premium: Math.round(grossAjkPremiumExact),
      bni_subsidy_premium_exact: bniSubsidyPremiumExact,
      bni_subsidy_premium: Math.round(bniSubsidyPremiumExact),
      customer_ajk_premium_exact: customerAjkPremiumExact,
      customer_ajk_premium: Math.round(customerAjkPremiumExact),
      underwriting_code: underwritingCode || "NOT_COVERED",
      underwriting_desc: underwritingDesc,
      underwriting_requires_verification: underwritingRequiresVerification,
      underwriting_review_reason: underwritingRequiresVerification ? BNI_UNDERWRITING_REVIEW_MESSAGE : null,
      total_fees_exact: totalFeesExact,
      total_fees: Math.round(totalFeesExact),
      net_before_blokir_exact: netBeforeBlokirExact,
      net_before_blokir: Math.round(netBeforeBlokirExact),
      blokir_angsuran_count: blokirAngsuranCount,
      blokir_angsuran_exact: blokirAngsuranExact,
      blokir_angsuran: Math.round(blokirAngsuranExact),
      blokir_tabungan_count: blokirTabunganCount,
      blokir_tabungan_exact: blokirTabunganExact,
      blokir_tabungan: Math.round(blokirTabunganExact),
      blokir_prapensiun_count: blokirPrapensiunCount,
      blokir_prapensiun_exact: blokirPrapensiunExact,
      blokir_prapensiun: Math.round(blokirPrapensiunExact),
      total_blokir_count: totalBlokirCount,
      total_blokir_exact: totalBlokirExact,
      total_blokir: Math.round(totalBlokirExact),
      terima_bersih_before_to_exact: terimaBersihBeforeToExact,
      terima_bersih_before_to: Math.round(terimaBersihBeforeToExact),
      take_over: Math.round(ctx.takeOver),
      terima_bersih_after_to_exact: terimaBersihAfterToExact,
      terima_bersih_after_to: Math.round(terimaBersihAfterToExact)
    },
    validations,
    issues
  };
}
