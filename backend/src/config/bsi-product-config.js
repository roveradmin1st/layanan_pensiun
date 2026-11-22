// ============================================================================
// BSI PRODUCT CONFIGURATION, RESOLVER & VALIDATOR
// Memisahkan parameter TriBerkah (PP3), Dekade (PP10), dan Pensiun Berkah (PENSIUN)
// tanpa fallback silang antarproduk.
// ============================================================================

import { SIMAS_PENSIUN_PROFILE } from "./bsi-pensiun-simas-20260629.js";

export const BSI_PRODUCT_CODES = Object.freeze(["PP3", "PP10", "PENSIUN"]);
export const BSI_SCHEMA_VERSION = 2;
export const BSI_MIGRATION_ID = "bsi-product-split-2026-11-06-v2";

export const SIMAS_PRAPEN_DEFAULT_INSURANCE = Object.freeze({
  profileId: "simas-prapen-menurun",
  bufferDefaultMonths: 0,
  companyName: "PT Asuransi Simas Jiwa",
  distributionChannel: "Syariah",
  minEntryAge: 45,
  maxEntryAge: 65,
  maxCoverageAge: 75,
  maxInsuranceYears: 20,
  maxPolicyMonths: 240,
  maxUpAge70: 1000000000,
  maxUpAge75: 500000000,
  monthMultipliers: Object.freeze({
    1: 0.2, 2: 0.3, 3: 0.4, 4: 0.5, 5: 0.6,
    6: 0.7, 7: 0.75, 8: 0.875, 9: 1.0, 10: 1.0, 11: 1.0, 12: 1.0
  }),
  decreasingRateTable: Object.freeze({
    45: Object.freeze([3.6, 6.52, 9.28, 12.08, 15.03, 18.24, 21.35, 24.37, 28.02, 31.59, 35.15, 38.24, 41.92, 45.74, 49.54, 53.6, 57.11, 60.6, 64.08, 67.56]),
    46: Object.freeze([3.87, 7.08, 10.09, 13.18, 16.35, 19.79, 23.11, 26.73, 30.37, 34.19, 38.03, 41.6, 45.57, 49.64, 53.72, 58.12, 61.93, 65.72, 69.49, 73.24]),
    47: Object.freeze([4.18, 7.73, 11.01, 14.38, 17.83, 21.57, 25.16, 28.87, 33.36, 37.15, 41.29, 45.16, 49.43, 53.79, 58.17, 62.94, 67.06, 71.15, 75.22, 79.27]),
    48: Object.freeze([4.52, 8.43, 12.0, 15.69, 19.46, 23.52, 27.67, 31.68, 35.95, 40.33, 44.76, 48.93, 53.5, 58.2, 62.92, 68.09, 72.53, 76.94, 81.32, 85.67]),
    49: Object.freeze([4.87, 9.16, 13.05, 17.12, 21.17, 25.52, 29.94, 34.74, 38.96, 43.63, 48.43, 53.23, 58.17, 63.16, 68.23, 73.83, 78.66, 83.44, 88.19, 92.88]),
    50: Object.freeze([5.25, 10.0, 14.24, 18.68, 23.09, 27.81, 32.6, 37.53, 42.8, 47.42, 52.57, 57.78, 63.09, 68.43, 73.88, 79.96, 85.17, 90.34, 95.46, 100.52]),
    51: Object.freeze([5.69, 10.91, 15.53, 20.39, 25.2, 30.32, 35.84, 41.17, 46.13, 51.48, 57.0, 62.61, 68.3, 74.05, 79.91, 86.5, 92.13, 97.7, 103.21, 108.64]),
    52: Object.freeze([6.19, 11.91, 16.95, 22.25, 27.47, 33.02, 38.67, 44.32, 49.96, 55.76, 61.68, 67.69, 73.8, 80.0, 86.28, 93.38, 99.45, 105.41, 111.32, 117.14]),
    53: Object.freeze([6.75, 13.01, 18.51, 24.25, 29.9, 35.86, 41.86, 47.9, 54.01, 60.23, 66.56, 73.02, 79.59, 86.26, 93.03, 100.65, 107.14, 113.53, 119.84, 126.05]),
    54: Object.freeze([7.39, 14.18, 20.14, 26.35, 32.41, 38.78, 45.18, 51.63, 58.17, 64.82, 71.61, 78.56, 85.65, 92.84, 100.1, 108.28, 115.2, 122.04, 128.77, 135.39]),
    55: Object.freeze([8.08, 15.39, 21.81, 28.46, 34.91, 41.68, 48.5, 55.37, 62.35, 69.49, 76.82, 84.31, 91.95, 99.68, 107.5, 116.24, 123.62, 130.9, 138.07, 145.11]),
    56: Object.freeze([8.84, 16.59, 23.44, 30.51, 37.32, 44.5, 51.74, 59.08, 66.59, 74.29, 82.18, 90.26, 98.49, 106.82, 115.08, 124.38, 132.24, 139.98, 147.59, 0]),
    57: Object.freeze([9.61, 17.69, 24.96, 32.43, 39.6, 47.2, 54.92, 62.81, 70.91, 79.23, 87.78, 96.49, 105.34, 114.27, 123.31, 133.21, 141.58, 149.8, 0, 0]),
    58: Object.freeze([10.45, 18.71, 26.37, 34.23, 41.81, 49.9, 58.21, 66.72, 75.5, 84.5, 93.73, 103.12, 112.66, 122.29, 131.98, 142.54, 151.44, 0, 0, 0]),
    59: Object.freeze([11.35, 19.67, 27.74, 36.01, 44.1, 52.81, 61.78, 71.02, 80.52, 90.27, 100.23, 110.37, 120.64, 130.99, 141.43, 152.68, 0, 0, 0, 0]),
    60: Object.freeze([12.34, 20.64, 29.13, 37.98, 46.71, 56.14, 65.88, 75.91, 86.2, 96.76, 107.52, 118.44, 129.5, 140.65, 151.87, 0, 0, 0, 0, 0]),
    61: Object.freeze([13.45, 21.66, 30.78, 40.36, 49.86, 60.12, 70.69, 81.58, 92.75, 104.16, 115.78, 127.56, 139.49, 151.49, 0, 0, 0, 0, 0, 0]),
    62: Object.freeze([14.7, 23.02, 32.98, 43.42, 53.77, 64.94, 76.45, 88.27, 100.36, 112.7, 125.24, 137.96, 150.82, 0, 0, 0, 0, 0, 0, 0]),
    63: Object.freeze([16.11, 25.13, 36.02, 47.44, 58.73, 70.88, 83.37, 96.17, 109.26, 122.6, 136.15, 149.89, 0, 0, 0, 0, 0, 0, 0, 0]),
    64: Object.freeze([17.69, 27.78, 39.78, 51.92, 64.22, 77.42, 90.96, 104.83, 118.97, 133.4, 148.05, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    65: Object.freeze([19.42, 30.25, 43.27, 56.78, 70.14, 84.45, 99.12, 114.12, 129.45, 145.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })
});

export function splitMaturityAgeMonths(totalMonths) {
  const m = Number.isInteger(totalMonths) && totalMonths >= 0 ? totalMonths : 0;
  return {
    years: Math.floor(m / 12),
    months: m % 12
  };
}

export function combineMaturityAgeMonths(years, extraMonths = 0) {
  const y = Number(years);
  const m = extraMonths === undefined || extraMonths === null ? 0 : Number(extraMonths);
  if (!Number.isInteger(y) || y < 45 || y > 90) return null;
  if (!Number.isInteger(m) || m < 0 || m > 11) return null;
  return y * 12 + m;
}

export function createDefaultBsiProducts() {
  const sharedIncomeWeights = {
    gajiPokok: 100.0,
    uangMakan: 90.0,
    tunjanganRutin1Bln: 90.0,
    tunjanganRutin3Bln: 50.0,
    tunjanganLain1Bln: 80.0,
    tht: 75.0
  };
  const sharedPricingTiers = {
    triNettAbove200: { label: "Tri Berkah (PP3) Nett ≥ Rp200 Juta", rateActiveAnnual: 9.25, ratePensionAnnual: 10.50 },
    dekadeNettAbove200: { label: "Dekade Berkah (PP10) Nett ≥ Rp200 Juta", rateActiveAnnual: 9.50, ratePensionAnnual: 10.50 },
    below200: { label: "Plafond < Rp200 Juta", rateActiveAnnual: 10.50, ratePensionAnnual: 11.50 }
  };
  const sharedAtribusiAdjustments = {
    pp10ActiveRateAdd: 0.10,
    pp10PensionRateAdd: 1.00,
    pp10AtribExtraActive: 1.00,
    pp3PokokTetapAktif: 10000
  };
  const sharedPrapenFees = {
    adminRatePercent: 1.0,
    materaiFee: 100000,
    taksasiMmqMarkupPercent: 2.0,
    blokirActiveCount: 1,
    blokirPensionCount: 2
  };

  return {
    PP3: {
      productCode: "PP3",
      code: "PP3",
      productName: "BSI Mitraguna Prapensiun — TriBerkah (PP3)",
      label: "Tri Berkah (Prapen 3 Tahun)",
      shortName: "TriBerkah / PP3",
      policyVersion: "bsi-pp3-240m-74y6m-v1",
      revision: 1,
      updatedAt: "2026-11-06T00:00:00.000Z",
      updatedBy: "MUHAMMAD TEGUH PRANADA (Super Admin)",
      loan: {
        minPlafondAbsolute: 10000000,
        maxPlafondAbsolute: 800000000,
        maxTenorMonths: 240,
        maxMaturityAgeMonths: 894, // 74 tahun 6 bulan
        maximumPrincipalRoundingStep: 1000000
      },
      activePhase: {
        maxMonthsToRetirement: 36,
        bupAgeDefault: 58,
        dbrActivePayroll: 70.0,
        dbrActivePayrollColek: 80.0,
        dbrActiveNonPayroll: 50.0,
        incomeWeights: structuredClone(sharedIncomeWeights)
      },
      retiredPhase: {
        maxInstallmentRatioPercent: 90.0,
        dsrMaxPercent: 90.0
      },
      pricingTiers: structuredClone(sharedPricingTiers),
      atribusiAdjustments: structuredClone(sharedAtribusiAdjustments),
      fees: {
        ...structuredClone(sharedPrapenFees),
        blokirActiveMode: "all_active_months"
      },
      insurance: structuredClone(SIMAS_PRAPEN_DEFAULT_INSURANCE)
    },

    PP10: {
      productCode: "PP10",
      code: "PP10",
      productName: "BSI Mitraguna Prapensiun — Dekade Berkah (PP10)",
      label: "Dekade Berkah (Prapen 10 Tahun)",
      shortName: "Dekade / PP10",
      policyVersion: "bsi-pp10-180m-74y4m-v1",
      revision: 1,
      updatedAt: "2026-11-06T00:00:00.000Z",
      updatedBy: "MUHAMMAD TEGUH PRANADA (Super Admin)",
      loan: {
        minPlafondAbsolute: 10000000,
        maxPlafondAbsolute: 800000000,
        maxTenorMonths: 180,
        maxMaturityAgeMonths: 892, // 74 tahun 4 bulan
        maximumPrincipalRoundingStep: 1000000
      },
      activePhase: {
        maxMonthsToRetirement: 120,
        bupAgeDefault: 58,
        dbrActivePayroll: 70.0,
        dbrActivePayrollColek: 80.0,
        dbrActiveNonPayroll: 50.0,
        incomeWeights: structuredClone(sharedIncomeWeights)
      },
      retiredPhase: {
        maxInstallmentRatioPercent: 90.0,
        dsrMaxPercent: 90.0
      },
      pricingTiers: structuredClone(sharedPricingTiers),
      atribusiAdjustments: structuredClone(sharedAtribusiAdjustments),
      fees: structuredClone(sharedPrapenFees),
      insurance: structuredClone(SIMAS_PRAPEN_DEFAULT_INSURANCE)
    },

    PENSIUN: {
      productCode: "PENSIUN",
      code: "PENSIUN",
      productName: "BSI Pensiun Berkah (Pensiun Murni / Janda)",
      label: "Pensiun Berkah (Pensiun Murni / Janda)",
      shortName: "Pensiun Berkah",
      policyVersion: "bsi-pensiun-blue-20260629-v1",
      revision: 1,
      updatedAt: "2026-11-06T00:00:00.000Z",
      updatedBy: "MUHAMMAD TEGUH PRANADA (Super Admin)",
      loan: {
        minPlafondAbsolute: 1000000,
        maxPlafondAbsolute: SIMAS_PENSIUN_PROFILE.max_sum_assured,
        maxTenorMonths: SIMAS_PENSIUN_PROFILE.max_policy_months,
        maxMaturityAgeMonths: 894, // 74 tahun 6 bulan
        maximumPrincipalRoundingStep: 1000000,
        minBankAgePensiunan: 50,
        minBankAgeJanda: 48
      },
      retiredPhase: {
        allowedRatioPercents: [70, 90],
        defaultRatioPercent: 90.0,
        maxInstallmentRatioPercent: 90.0,
        minInstallmentRatioPercent: 70.0,
        defaultRatioBasis: "DBR",
        spouseFactorWithSpouse: 0.98,
        spouseFactorSingle: 1.0,
        defaultBaseRateAnnual: 10.5,
        maxAttributionPremiumRatioPercent: 70.0
      },
      fees: {
        adminRatePercent: 1.0,
        materaiFee: 100000,
        blokirAtribusiCount: 2,
        blokirRegulerCount: 0,
        taksasiMmqMarkupPercent: 2.0,
        bankAllocatedRatePercent: 2.5,
        flaggingCosts: {
          TASPEN: 665000,
          TASPEN_CTP: 765000,
          ASABRI: 222000,
          DAPEN: 0
        }
      },
      insurance: {
        profileId: SIMAS_PENSIUN_PROFILE.version,
        profileVersion: SIMAS_PENSIUN_PROFILE.version,
        sourceSha256: SIMAS_PENSIUN_PROFILE.source_sha256,
        companyName: "PT Asuransi Simas Jiwa (Simas Pensiun)",
        bufferDefaultMonths: 0,
        minEntryAge: SIMAS_PENSIUN_PROFILE.min_entry_age,
        maxEntryAge: SIMAS_PENSIUN_PROFILE.max_entry_age,
        maxCoverageAge: SIMAS_PENSIUN_PROFILE.max_end_age,
        maxInsuranceYears: 15,
        maxPolicyMonths: SIMAS_PENSIUN_PROFILE.max_policy_months,
        maxSumAssured: SIMAS_PENSIUN_PROFILE.max_sum_assured
      }
    }
  };
}

/**
 * Normalisasi identitas produk BSI sekali pada boundary API / Engine.
 * Menerima objek request atau string kode produk.
 * Dokumentasi alias boundary:
 * - "PP3", "TRI_BERKAH", "TRIBERKAH" -> "PP3"
 * - "PP10", "DEKADE_BERKAH", "DEKADE" -> "PP10"
 * - "PENSIUN", "PENSIUN_BERKAH" -> "PENSIUN"
 * - Omitted pada request prapen standar -> default "PP10" (atau "PENSIUN" jika bsi_mode="pensiun")
 * - Nilai eksplisit selain di atas -> ditolak (valid: false)
 */
export function normalizeBsiProductInput(bodyOrCode, { allowDefaultForEmpty = true } = {}) {
  if (typeof bodyOrCode === "string") {
    const raw = bodyOrCode.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (raw === "PP3" || raw === "TRI_BERKAH" || raw === "TRIBERKAH") {
      return { valid: true, productCode: "PP3" };
    }
    if (raw === "PP10" || raw === "DEKADE_BERKAH" || raw === "DEKADE") {
      return { valid: true, productCode: "PP10" };
    }
    if (raw === "PENSIUN" || raw === "PENSIUN_BERKAH") {
      return { valid: true, productCode: "PENSIUN" };
    }
    if (raw === "" && allowDefaultForEmpty) {
      return { valid: true, productCode: "PP10" };
    }
    return {
      valid: false,
      productCode: null,
      error: `Kode produk BSI '${bodyOrCode}' tidak dikenali. Gunakan PP3, PP10, atau PENSIUN.`
    };
  }

  if (!bodyOrCode || typeof bodyOrCode !== "object" || Array.isArray(bodyOrCode)) {
    return {
      valid: false,
      productCode: null,
      error: "Input produk BSI tidak valid."
    };
  }

  const rawExplicit =
    bodyOrCode.bsi_sub_product ??
    bodyOrCode.sub_product ??
    bodyOrCode.product_code ??
    bodyOrCode.bsi_product;

  if (rawExplicit !== undefined && rawExplicit !== null && String(rawExplicit).trim() !== "") {
    if (typeof rawExplicit !== "string") {
      return {
        valid: false,
        productCode: null,
        error: "Identitas sub-produk BSI harus berupa string (PP3, PP10, atau PENSIUN)."
      };
    }
    return normalizeBsiProductInput(rawExplicit, { allowDefaultForEmpty: false });
  }

  const modeRaw = String(bodyOrCode.bsi_mode || "").trim().toLowerCase();
  if (modeRaw === "pensiun" || modeRaw === "pensiun_berkah") {
    return { valid: true, productCode: "PENSIUN" };
  }

  if (
    bodyOrCode.bsi_retired_type &&
    !bodyOrCode.gaji_pokok &&
    !bodyOrCode.bup_age &&
    !bodyOrCode.bsi_status_gaji
  ) {
    return { valid: true, productCode: "PENSIUN" };
  }

  if (allowDefaultForEmpty) {
    return { valid: true, productCode: "PP10" };
  }

  return {
    valid: false,
    productCode: null,
    error: "Kode produk BSI wajib disebutkan (PP3, PP10, atau PENSIUN)."
  };
}

/**
 * Resolver murni sesuai Bagian 4 command.md:
 * - Menerima kode kanonis PP3, PP10, atau PENSIUN.
 * - Menolak produk tidak dikenal dan konfigurasi produk yang tidak tersedia.
 * - Mengembalikan konfigurasi produk beserta versi aturan dan profil asuransinya.
 * - Tidak mengambil parameter produk lain sebagai fallback.
 */
export function resolveBsiProductConfig(allParams, productCodeOrNormalized) {
  let productCode = productCodeOrNormalized;
  if (productCodeOrNormalized && typeof productCodeOrNormalized === "object") {
    if (!productCodeOrNormalized.valid) {
      const msg =
        productCodeOrNormalized.error ||
        "Kode produk BSI tidak dikenali. Kode kanonis yang diizinkan: PP3, PP10, PENSIUN.";
      return {
        ok: false,
        error_code: "UNKNOWN_BSI_PRODUCT",
        errorCode: "UNKNOWN_BSI_PRODUCT",
        error: msg,
        message: msg,
        detail: msg
      };
    }
    productCode = productCodeOrNormalized.productCode;
  }

  if (typeof productCode !== "string" || !BSI_PRODUCT_CODES.includes(productCode)) {
    const msg = `Produk BSI '${String(productCode)}' tidak terdaftar. Kode kanonis yang diizinkan: PP3, PP10, PENSIUN.`;
    return {
      ok: false,
      error_code: "UNKNOWN_BSI_PRODUCT",
      errorCode: "UNKNOWN_BSI_PRODUCT",
      error: msg,
      message: msg,
      detail: msg
    };
  }

  if (!allParams || typeof allParams !== "object" || !Object.hasOwn(allParams, "bsi_prapen")) {
    const msg = "Konfigurasi mitra bsi_prapen tidak tersedia.";
    return {
      ok: false,
      error_code: "MISSING_BSI_PARTNER",
      errorCode: "MISSING_BSI_PARTNER",
      error: msg,
      message: msg,
      detail: msg
    };
  }

  const bsiPartner = allParams.bsi_prapen;
  const products = bsiPartner?.products;
  if (!products || typeof products !== "object" || !Object.hasOwn(products, productCode)) {
    const msg = `Konfigurasi untuk produk BSI '${productCode}' tidak tersedia.`;
    return {
      ok: false,
      error_code: "MISSING_BSI_PRODUCT_CONFIG",
      errorCode: "MISSING_BSI_PRODUCT_CONFIG",
      error: msg,
      message: msg,
      detail: msg
    };
  }

  const prod = products[productCode];
  const prodCodeActual = prod?.productCode || prod?.code;
  const hasPolicyVersion =
    (typeof prod?.policyVersion === "string" && prod.policyVersion.trim().length > 0) ||
    (typeof prod?.policyVersion === "number" && Number.isFinite(prod.policyVersion));
  if (
    !prod ||
    typeof prod !== "object" ||
    prodCodeActual !== productCode ||
    !hasPolicyVersion ||
    !prod.loan ||
    typeof prod.loan !== "object" ||
    !prod.retiredPhase ||
    typeof prod.retiredPhase !== "object" ||
    !prod.fees ||
    typeof prod.fees !== "object" ||
    !prod.insurance ||
    typeof prod.insurance !== "object"
  ) {
    const msg = `Struktur konfigurasi produk BSI '${productCode}' tidak lengkap atau tidak sah.`;
    return {
      ok: false,
      error_code: "INVALID_BSI_PRODUCT_CONFIG",
      errorCode: "INVALID_BSI_PRODUCT_CONFIG",
      error: msg,
      message: msg,
      detail: msg
    };
  }

  if ((productCode === "PP3" || productCode === "PP10") && (!prod.activePhase || typeof prod.activePhase !== "object")) {
    const msg = `Konfigurasi activePhase untuk produk prapensiun '${productCode}' tidak tersedia.`;
    return {
      ok: false,
      error_code: "INVALID_BSI_PRODUCT_CONFIG",
      errorCode: "INVALID_BSI_PRODUCT_CONFIG",
      error: msg,
      message: msg,
      detail: msg
    };
  }

  const maturitySplit = splitMaturityAgeMonths(prod.loan.maxMaturityAgeMonths);

  return {
    ok: true,
    partnerKey: "bsi_prapen",
    partnerName: bsiPartner.name || "BSI — Mitraguna Prapensiun & Pensiun Berkah",
    partnerShortName: bsiPartner.shortName || "BSI · Prapen & Pensiun",
    schemaVersion: bsiPartner.schemaVersion ?? BSI_SCHEMA_VERSION,
    productCode,
    productName: prod.productName,
    shortName: prod.shortName,
    policyVersion: prod.policyVersion,
    revision: prod.revision ?? 1,
    updatedAt: prod.updatedAt || null,
    updatedBy: prod.updatedBy || null,
    insuranceProfileId: prod.insurance.profileId,
    maturityAgeYears: maturitySplit.years,
    maturityAgeExtraMonths: maturitySplit.months,
    config: prod,
    insuranceProfile: productCode === "PENSIUN" ? SIMAS_PENSIUN_PROFILE : prod.insurance
  };
}

/**
 * Membangun objek produk BSI dari state legacy (digunakan saat migrasi database).
 * Menyalin kustomisasi yang masih berlaku pada PP3 dan PP10, lalu menerapkan
 * koreksi terarah PP3 (tenor 240 bulan, usia akhir 894 bulan, buffer default 0).
 */
export function buildMigratedBsiPartner(existingBsi = {}) {
  const defaults = createDefaultBsiProducts();
  const nowIso = new Date().toISOString();

  // Jika sudah bermigrasi dan memiliki ketiga produk yang valid, pertahankan tanpa menimpa edit
  if (
    existingBsi &&
    existingBsi.migrationId === BSI_MIGRATION_ID &&
    existingBsi.schemaVersion === BSI_SCHEMA_VERSION &&
    existingBsi.products?.PP3 &&
    existingBsi.products?.PP10 &&
    existingBsi.products?.PENSIUN
  ) {
    return { migrated: false, partner: existingBsi };
  }

  const hasLegacyRootFields = Boolean(
    existingBsi &&
      (existingBsi.maxPlafondAbsolute !== undefined ||
        existingBsi.maxTenorMonths !== undefined ||
        existingBsi.maxEndAgeYears !== undefined ||
        existingBsi.dsrPensionMax !== undefined ||
        existingBsi.dbrActivePayroll !== undefined)
  );

  const legacyPlafond =
    Number.isFinite(Number(existingBsi?.maxPlafondAbsolute)) && Number(existingBsi.maxPlafondAbsolute) > 0
      ? Number(existingBsi.maxPlafondAbsolute)
      : 800000000;
  const legacyMinPlafond =
    Number.isFinite(Number(existingBsi?.minPlafondAbsolute)) && Number(existingBsi.minPlafondAbsolute) > 0
      ? Number(existingBsi.minPlafondAbsolute)
      : 10000000;
  const legacyTenorPp10 =
    Number.isInteger(Number(existingBsi?.maxTenorMonths)) && Number(existingBsi.maxTenorMonths) > 0
      ? Number(existingBsi.maxTenorMonths)
      : 180;
  const legacyEndYearsPp10 =
    Number.isInteger(Number(existingBsi?.maxEndAgeYears)) && Number(existingBsi.maxEndAgeYears) >= 55
      ? Number(existingBsi.maxEndAgeYears)
      : 74;
  const legacyEndMonthsPp10 =
    existingBsi?.maxEndAgeMonths !== undefined &&
    existingBsi?.maxEndAgeMonths !== null &&
    Number.isInteger(Number(existingBsi.maxEndAgeMonths)) &&
    Number(existingBsi.maxEndAgeMonths) >= 0 &&
    Number(existingBsi.maxEndAgeMonths) <= 11
      ? Number(existingBsi.maxEndAgeMonths)
      : 4;
  const legacyMaturityMonthsPp10 = legacyEndYearsPp10 * 12 + legacyEndMonthsPp10;

  const legacyBupDefault =
    Number.isInteger(Number(existingBsi?.bupAgeDefault)) && Number(existingBsi.bupAgeDefault) >= 55
      ? Number(existingBsi.bupAgeDefault)
      : 58;
  const legacyDbrPayroll =
    Number.isFinite(Number(existingBsi?.dbrActivePayroll)) && Number(existingBsi.dbrActivePayroll) > 0
      ? Number(existingBsi.dbrActivePayroll)
      : 70.0;
  const legacyDbrColek =
    Number.isFinite(Number(existingBsi?.dbrActivePayrollColek)) && Number(existingBsi.dbrActivePayrollColek) > 0
      ? Number(existingBsi.dbrActivePayrollColek)
      : 80.0;
  const legacyDbrNonPayroll =
    Number.isFinite(Number(existingBsi?.dbrActiveNonPayroll)) && Number(existingBsi.dbrActiveNonPayroll) > 0
      ? Number(existingBsi.dbrActiveNonPayroll)
      : 50.0;
  const legacyDsrPension =
    Number.isFinite(Number(existingBsi?.dsrPensionMax)) && Number(existingBsi.dsrPensionMax) > 0
      ? Number(existingBsi.dsrPensionMax)
      : 90.0;

  const copyPrapenCustomizations = (baseProd) => {
    const prod = structuredClone(baseProd);
    if (!hasLegacyRootFields) return prod;

    prod.loan.maxPlafondAbsolute = legacyPlafond;
    prod.loan.minPlafondAbsolute = legacyMinPlafond;
    prod.activePhase.bupAgeDefault = legacyBupDefault;
    prod.activePhase.dbrActivePayroll = legacyDbrPayroll;
    prod.activePhase.dbrActivePayrollColek = legacyDbrColek;
    prod.activePhase.dbrActiveNonPayroll = legacyDbrNonPayroll;
    prod.retiredPhase.maxInstallmentRatioPercent = legacyDsrPension;

    if (existingBsi.incomeWeights && typeof existingBsi.incomeWeights === "object") {
      prod.activePhase.incomeWeights = {
        ...prod.activePhase.incomeWeights,
        ...structuredClone(existingBsi.incomeWeights)
      };
    }
    if (existingBsi.pricingTiers && typeof existingBsi.pricingTiers === "object") {
      prod.pricingTiers = {
        ...prod.pricingTiers,
        ...structuredClone(existingBsi.pricingTiers)
      };
    }
    if (existingBsi.atribusiAdjustments && typeof existingBsi.atribusiAdjustments === "object") {
      prod.atribusiAdjustments = {
        ...prod.atribusiAdjustments,
        ...structuredClone(existingBsi.atribusiAdjustments)
      };
    }
    if (existingBsi.fees && typeof existingBsi.fees === "object") {
      prod.fees = {
        ...prod.fees,
        ...structuredClone(existingBsi.fees)
      };
    }
    if (existingBsi.simasInsurance && typeof existingBsi.simasInsurance === "object") {
      prod.insurance = {
        ...prod.insurance,
        ...structuredClone(existingBsi.simasInsurance),
        profileId: "simas-prapen-menurun",
        bufferDefaultMonths:
          existingBsi.simasInsurance.bufferDefaultMonths !== undefined
            ? Number(existingBsi.simasInsurance.bufferDefaultMonths)
            : 0
      };
    }
    return prod;
  };

  const pp3 = existingBsi?.products?.PP3
    ? structuredClone(existingBsi.products.PP3)
    : copyPrapenCustomizations(defaults.PP3);

  // Koreksi terarah PP3 sesuai Bagian 5 butir 4 command.md:
  // maksimum tenor 240 bulan dan usia akhir 894 bulan (74 tahun 6 bulan), bufferDefaultMonths 0.
  pp3.productCode = "PP3";
  pp3.loan.maxTenorMonths = 240;
  pp3.loan.maxMaturityAgeMonths = 894;
  pp3.activePhase.maxMonthsToRetirement = 36;
  pp3.insurance.profileId = "simas-prapen-menurun";
  pp3.insurance.bufferDefaultMonths = pp3.insurance.bufferDefaultMonths ?? 0;
  pp3.policyVersion = pp3.policyVersion || "bsi-pp3-240m-74y6m-v1";

  const pp10 = existingBsi?.products?.PP10
    ? structuredClone(existingBsi.products.PP10)
    : copyPrapenCustomizations(defaults.PP10);
  if (!existingBsi?.products?.PP10 && hasLegacyRootFields) {
    pp10.loan.maxTenorMonths = legacyTenorPp10;
    pp10.loan.maxMaturityAgeMonths = legacyMaturityMonthsPp10;
  }
  pp10.productCode = "PP10";
  pp10.activePhase.maxMonthsToRetirement = pp10.activePhase.maxMonthsToRetirement ?? 120;
  pp10.insurance.profileId = "simas-prapen-menurun";
  pp10.insurance.bufferDefaultMonths = pp10.insurance.bufferDefaultMonths ?? 0;
  pp10.policyVersion = pp10.policyVersion || "bsi-pp10-180m-74y4m-v1";

  // PENSIUN dibentuk murni dari profil/konstanta PENSIUN (tidak menyalin batas prapen Rp800jt / 65thn / 20thn)
  const pensiun = existingBsi?.products?.PENSIUN
    ? structuredClone(existingBsi.products.PENSIUN)
    : structuredClone(defaults.PENSIUN);
  pensiun.productCode = "PENSIUN";
  pensiun.policyVersion = pensiun.policyVersion || "bsi-pensiun-blue-20260629-v1";

  const migratedPartner = {
    id: "bsi_prapen",
    code: existingBsi?.code || "BSI-PRAPEN",
    name: "BSI — Mitraguna Prapensiun & Pensiun Berkah",
    shortName: "BSI · Prapen & Pensiun",
    type: existingBsi?.type || "bank_syariah_prapen",
    engine: "bsi_simas",
    active: existingBsi?.active !== false,
    badgeColor: existingBsi?.badgeColor || "teal",
    description:
      "Kalkulator Resmi BSI Mitraguna Prapensiun (Dekade Berkah PP10 & Tri Berkah PP3) serta BSI Pensiun Berkah (Pensiun Murni & Janda — Reguler & Atribusi Premi) terintegrasi Asuransi Simas Jiwa.",
    schemaVersion: BSI_SCHEMA_VERSION,
    migrationId: BSI_MIGRATION_ID,
    migratedAt: nowIso,
    products: {
      PP3: pp3,
      PP10: pp10,
      PENSIUN: pensiun
    }
  };

  return { migrated: true, partner: migratedPartner };
}

function checkNumberRange(val, label, { min, max, integer = false }) {
  if (typeof val !== "number" || !Number.isFinite(val)) {
    return `${label} wajib berupa angka yang valid.`;
  }
  if (integer && !Number.isInteger(val)) {
    return `${label} wajib berupa bilangan bulat.`;
  }
  if (min !== undefined && val < min) {
    return `${label} minimal ${min}.`;
  }
  if (max !== undefined && val > max) {
    return `${label} maksimal ${max}.`;
  }
  return null;
}

const ALLOWED_TOP_KEYS_PRAPEN = new Set([
  "expectedPolicyVersion",
  "expectedRevision",
  "reason",
  "note",
  "loan",
  "activePhase",
  "retiredPhase",
  "pricing",
  "pricingTiers",
  "atribusiAdjustments",
  "fees",
  "insurance",
  // Shorthand flat keys from form if sent directly
  "maxPlafondAbsolute",
  "minPlafondAbsolute",
  "maxTenorMonths",
  "maxMaturityAgeMonths",
  "maxEndAgeYears",
  "maxEndAgeMonths",
  "maxMonthsToRetirement",
  "bupAgeDefault",
  "dbrActivePayroll",
  "dbrPayrollPercent",
  "dbrActivePayrollColek",
  "dbrCommittedPayrollPercent",
  "dbrActiveNonPayroll",
  "dbrNonPayrollPercent",
  "dsrPensionMax",
  "dsrMaxPercent",
  "maxInstallmentRatioPercent",
  "bufferDefaultMonths"
]);

const ALLOWED_TOP_KEYS_PENSIUN = new Set([
  "expectedPolicyVersion",
  "expectedRevision",
  "reason",
  "note",
  "loan",
  "retiredPhase",
  "fees",
  "insurance",
  // Shorthand flat keys from form if sent directly
  "maxPlafondAbsolute",
  "minPlafondAbsolute",
  "maxTenorMonths",
  "maxMaturityAgeMonths",
  "maxEndAgeYears",
  "maxEndAgeMonths",
  "minBankAgePensiunan",
  "minBankAgeJanda",
  "defaultBaseRateAnnual",
  "defaultRatioPercent",
  "maxInstallmentRatioPercent",
  "minInstallmentRatioPercent",
  "spouseFactorWithSpouse",
  "maxAttributionPremiumRatioPercent",
  "maxSumAssured",
  "bufferDefaultMonths"
]);

/**
 * Validasi dan terapkan perubahan parameter produk BSI secara terarah (tanpa Object.assign mentah).
 * Mengembalikan { ok, error, status, updatedProduct, beforeSnapshot, afterSnapshot }.
 */
export function validateAndApplyBsiProductUpdate(currentProduct, productCode, payload, updatedBy = "Super Admin") {
  const fail = (status, error, errorCode = status === 409 ? "POLICY_VERSION_CONFLICT" : "INVALID_PARAMETER_PAYLOAD") => ({
    ok: false,
    status,
    errorCode,
    error_code: errorCode,
    error,
    detail: error
  });

  if (!BSI_PRODUCT_CODES.includes(productCode)) {
    return fail(400, `Produk BSI '${String(productCode)}' tidak valid.`, "UNKNOWN_BSI_PRODUCT");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fail(400, "Payload perubahan parameter produk harus berupa objek JSON.");
  }

  const isPensiun = productCode === "PENSIUN";
  const allowedTop = isPensiun ? ALLOWED_TOP_KEYS_PENSIUN : ALLOWED_TOP_KEYS_PRAPEN;

  for (const k of Object.keys(payload)) {
    if (!allowedTop.has(k)) {
      return fail(400, `Field '${k}' tidak diizinkan pada konfigurasi produk BSI ${productCode}.`);
    }
  }

  // Konflik edit dari snapshot lama (optimistic concurrency control)
  if (
    payload.expectedPolicyVersion !== undefined &&
    payload.expectedPolicyVersion !== null &&
    String(payload.expectedPolicyVersion).trim() !== "" &&
    String(payload.expectedPolicyVersion) !== String(currentProduct.policyVersion)
  ) {
    return fail(
      409,
      `Konflik versi konfigurasi ${productCode}: versi yang dikirim '${payload.expectedPolicyVersion}' sudah usang (versi aktif saat ini: '${currentProduct.policyVersion}'). Muat ulang halaman sebelum menyimpan.`,
      "POLICY_VERSION_CONFLICT"
    );
  }
  if (
    payload.expectedRevision !== undefined &&
    payload.expectedRevision !== null &&
    Number(payload.expectedRevision) !== Number(currentProduct.revision ?? 1)
  ) {
    return fail(
      409,
      `Konflik revisi konfigurasi ${productCode}: revisi yang dikirim (${payload.expectedRevision}) berbeda dengan revisi aktif (${currentProduct.revision ?? 1}).`,
      "POLICY_VERSION_CONFLICT"
    );
  }

  const beforeSnapshot = structuredClone(currentProduct);
  const next = structuredClone(currentProduct);
  const loanIn = payload.loan && typeof payload.loan === "object" && !Array.isArray(payload.loan) ? payload.loan : {};
  const activeIn =
    !isPensiun && payload.activePhase && typeof payload.activePhase === "object" && !Array.isArray(payload.activePhase)
      ? payload.activePhase
      : {};
  const retiredIn =
    payload.retiredPhase && typeof payload.retiredPhase === "object" && !Array.isArray(payload.retiredPhase)
      ? payload.retiredPhase
      : {};
  const feesIn = payload.fees && typeof payload.fees === "object" && !Array.isArray(payload.fees) ? payload.fees : {};
  const insIn =
    payload.insurance && typeof payload.insurance === "object" && !Array.isArray(payload.insurance)
      ? payload.insurance
      : {};

  // Validasi sub-keys pada loan
  const allowedLoanKeys = isPensiun
    ? new Set([
        "minPlafondAbsolute",
        "maxPlafondAbsolute",
        "maxTenorMonths",
        "maxMaturityAgeMonths",
        "maxEndAgeYears",
        "maxEndAgeMonths",
        "maximumPrincipalRoundingStep",
        "minBankAgePensiunan",
        "minBankAgeJanda"
      ])
    : new Set([
        "minPlafondAbsolute",
        "maxPlafondAbsolute",
        "maxTenorMonths",
        "maxMaturityAgeMonths",
        "maxEndAgeYears",
        "maxEndAgeMonths",
        "maximumPrincipalRoundingStep"
      ]);
  for (const k of Object.keys(loanIn)) {
    if (!allowedLoanKeys.has(k)) {
      return fail(400, `Field 'loan.${k}' tidak diizinkan pada produk ${productCode}.`);
    }
  }

  // 1. Loan limits
  const maxPlafondRaw = loanIn.maxPlafondAbsolute ?? payload.maxPlafondAbsolute;
  if (maxPlafondRaw !== undefined) {
    const err = checkNumberRange(maxPlafondRaw, "Batas Plafon Maksimal", {
      min: 1000000,
      max: isPensiun ? 1000000000 : 5000000000,
      integer: true
    });
    if (err) return fail(400, err);
    next.loan.maxPlafondAbsolute = maxPlafondRaw;
  }

  const minPlafondRaw = loanIn.minPlafondAbsolute ?? payload.minPlafondAbsolute;
  if (minPlafondRaw !== undefined) {
    const err = checkNumberRange(minPlafondRaw, "Batas Plafon Minimal", {
      min: 1000000,
      max: next.loan.maxPlafondAbsolute,
      integer: true
    });
    if (err) return fail(400, err);
    next.loan.minPlafondAbsolute = minPlafondRaw;
  }

  if (next.loan.minPlafondAbsolute > next.loan.maxPlafondAbsolute) {
    return fail(400, "Plafon minimal tidak boleh melebihi plafon maksimal.");
  }

  const maxTenorRaw = loanIn.maxTenorMonths ?? payload.maxTenorMonths;
  if (maxTenorRaw !== undefined) {
    const err = checkNumberRange(maxTenorRaw, "Tenor Maksimum (Bulan)", {
      min: 12,
      max: isPensiun ? 180 : 240,
      integer: true
    });
    if (err) return fail(400, err);
    next.loan.maxTenorMonths = maxTenorRaw;
  }

  // Usia akhir: terima maxMaturityAgeMonths langsung ATAU pasangan maxEndAgeYears & maxEndAgeMonths (nilai 0 dipertahankan!)
  const directMaturityMonths = loanIn.maxMaturityAgeMonths ?? payload.maxMaturityAgeMonths;
  const endYearsRaw = loanIn.maxEndAgeYears ?? payload.maxEndAgeYears;
  const endMonthsRaw = loanIn.maxEndAgeMonths ?? payload.maxEndAgeMonths;

  if (directMaturityMonths !== undefined) {
    const err = checkNumberRange(directMaturityMonths, "Batas Usia Jatuh Tempo (Bulan)", {
      min: 55 * 12,
      max: 85 * 12,
      integer: true
    });
    if (err) return fail(400, err);
    next.loan.maxMaturityAgeMonths = directMaturityMonths;
  } else if (endYearsRaw !== undefined || endMonthsRaw !== undefined) {
    const currentSplit = splitMaturityAgeMonths(next.loan.maxMaturityAgeMonths);
    const yearsToUse = endYearsRaw !== undefined ? endYearsRaw : currentSplit.years;
    const monthsToUse = endMonthsRaw !== undefined ? endMonthsRaw : currentSplit.months;
    const errY = checkNumberRange(yearsToUse, "Usia Akhir (Tahun)", { min: 55, max: 85, integer: true });
    if (errY) return fail(400, errY);
    const errM = checkNumberRange(monthsToUse, "Tambahan Bulan Usia Akhir", { min: 0, max: 11, integer: true });
    if (errM) return fail(400, errM);
    next.loan.maxMaturityAgeMonths = yearsToUse * 12 + monthsToUse;
  }

  if (loanIn.maximumPrincipalRoundingStep !== undefined) {
    const err = checkNumberRange(loanIn.maximumPrincipalRoundingStep, "Kelipatan Pembulatan Plafon", {
      min: 100000,
      max: 10000000,
      integer: true
    });
    if (err) return fail(400, err);
    next.loan.maximumPrincipalRoundingStep = loanIn.maximumPrincipalRoundingStep;
  }

  // 2. Active Phase (khusus Prapen PP3 / PP10)
  if (!isPensiun) {
    const maxMonthsToRet = activeIn.maxMonthsToRetirement ?? payload.maxMonthsToRetirement;
    if (maxMonthsToRet !== undefined) {
      const err = checkNumberRange(maxMonthsToRet, "Jendela Maksimum Masa Aktif Menuju Pensiun (Bulan)", {
        min: 1,
        max: 180,
        integer: true
      });
      if (err) return fail(400, err);
      if (maxMonthsToRet >= next.loan.maxTenorMonths) {
        return fail(400, "Jendela masa aktif menuju pensiun harus lebih kecil dari maksimum tenor pembiayaan.");
      }
      next.activePhase.maxMonthsToRetirement = maxMonthsToRet;
    }

    const bupDefault = activeIn.bupAgeDefault ?? payload.bupAgeDefault;
    if (bupDefault !== undefined) {
      const err = checkNumberRange(bupDefault, "Default Usia BUP (Tahun)", {
        min: 55,
        max: 70,
        integer: true
      });
      if (err) return fail(400, err);
      next.activePhase.bupAgeDefault = bupDefault;
    }

    const dbrPayroll =
      activeIn.dbrActivePayroll ??
      activeIn.dbrPayrollPercent ??
      payload.dbrActivePayroll ??
      payload.dbrPayrollPercent;
    if (dbrPayroll !== undefined) {
      const err = checkNumberRange(dbrPayroll, "DBR Masa Aktif Payroll (%)", { min: 1, max: 100 });
      if (err) return fail(400, err);
      next.activePhase.dbrActivePayroll = dbrPayroll;
    }

    const dbrColek =
      activeIn.dbrActivePayrollColek ??
      activeIn.dbrCommittedPayrollPercent ??
      payload.dbrActivePayrollColek ??
      payload.dbrCommittedPayrollPercent;
    if (dbrColek !== undefined) {
      const err = checkNumberRange(dbrColek, "DBR Masa Aktif Comitted Payroll (%)", { min: 1, max: 100 });
      if (err) return fail(400, err);
      next.activePhase.dbrActivePayrollColek = dbrColek;
    }

    const dbrNonPayroll =
      activeIn.dbrActiveNonPayroll ??
      activeIn.dbrNonPayrollPercent ??
      payload.dbrActiveNonPayroll ??
      payload.dbrNonPayrollPercent;
    if (dbrNonPayroll !== undefined) {
      const err = checkNumberRange(dbrNonPayroll, "DBR Masa Aktif Non-Payroll (%)", { min: 1, max: 100 });
      if (err) return fail(400, err);
      next.activePhase.dbrActiveNonPayroll = dbrNonPayroll;
    }

    if (activeIn.incomeWeights !== undefined) {
      if (!activeIn.incomeWeights || typeof activeIn.incomeWeights !== "object" || Array.isArray(activeIn.incomeWeights)) {
        return fail(400, "Bobot penghasilan (incomeWeights) harus berupa objek.");
      }
      for (const [wk, wv] of Object.entries(activeIn.incomeWeights)) {
        if (!Object.hasOwn(next.activePhase.incomeWeights, wk)) {
          return fail(400, `Field incomeWeights.${wk} tidak dikenali.`);
        }
        const err = checkNumberRange(wv, `Bobot ${wk} (%)`, { min: 0, max: 100 });
        if (err) return fail(400, err);
        next.activePhase.incomeWeights[wk] = wv;
      }
    }

    const dsrPen =
      retiredIn.maxInstallmentRatioPercent ??
      retiredIn.dsrMaxPercent ??
      payload.maxInstallmentRatioPercent ??
      payload.dsrMaxPercent ??
      payload.dsrPensionMax;
    if (dsrPen !== undefined) {
      const err = checkNumberRange(dsrPen, "DSR Fase Pasca Pensiun — Prapen (%)", { min: 1, max: 100 });
      if (err) return fail(400, err);
      next.retiredPhase.maxInstallmentRatioPercent = dsrPen;
      next.retiredPhase.dsrMaxPercent = dsrPen;
    }

    const pricingTiersIn = payload.pricingTiers ?? payload.pricing?.tiers;
    if (pricingTiersIn !== undefined) {
      if (!pricingTiersIn || typeof pricingTiersIn !== "object" || Array.isArray(pricingTiersIn)) {
        return fail(400, "pricingTiers harus berupa objek.");
      }
      for (const [tk, tv] of Object.entries(pricingTiersIn)) {
        if (!Object.hasOwn(next.pricingTiers, tk) || !tv || typeof tv !== "object") {
          return fail(400, `Tier pricing '${tk}' tidak valid.`);
        }
        if (tv.rateActiveAnnual !== undefined) {
          const err = checkNumberRange(tv.rateActiveAnnual, `Pricing Aktif (${tk})`, { min: 0.1, max: 50 });
          if (err) return fail(400, err);
          next.pricingTiers[tk].rateActiveAnnual = tv.rateActiveAnnual;
        }
        if (tv.ratePensionAnnual !== undefined) {
          const err = checkNumberRange(tv.ratePensionAnnual, `Pricing Pensiun (${tk})`, { min: 0.1, max: 50 });
          if (err) return fail(400, err);
          next.pricingTiers[tk].ratePensionAnnual = tv.ratePensionAnnual;
        }
      }
    }

    const atribAdjIn = payload.atribusiAdjustments ?? payload.pricing?.atribusiAdjustments;
    if (atribAdjIn !== undefined) {
      if (!atribAdjIn || typeof atribAdjIn !== "object" || Array.isArray(atribAdjIn)) {
        return fail(400, "atribusiAdjustments harus berupa objek.");
      }
      for (const [ak, av] of Object.entries(atribAdjIn)) {
        if (!Object.hasOwn(next.atribusiAdjustments, ak)) {
          return fail(400, `Field atribusiAdjustments.${ak} tidak dikenali.`);
        }
        const err = checkNumberRange(av, `Atribusi Adjustment (${ak})`, { min: 0, max: 10000000 });
        if (err) return fail(400, err);
        next.atribusiAdjustments[ak] = av;
      }
    }
  } else {
    // 3. Khusus Produk PENSIUN
    const minAgePen = loanIn.minBankAgePensiunan ?? payload.minBankAgePensiunan;
    if (minAgePen !== undefined) {
      const err = checkNumberRange(minAgePen, "Usia Minimum Bank Pensiun Sendiri", {
        min: 40,
        max: 70,
        integer: true
      });
      if (err) return fail(400, err);
      next.loan.minBankAgePensiunan = minAgePen;
    }

    const minAgeJanda = loanIn.minBankAgeJanda ?? payload.minBankAgeJanda;
    if (minAgeJanda !== undefined) {
      const err = checkNumberRange(minAgeJanda, "Usia Minimum Bank Pensiun Janda", {
        min: 40,
        max: 70,
        integer: true
      });
      if (err) return fail(400, err);
      next.loan.minBankAgeJanda = minAgeJanda;
    }

    const baseRate = retiredIn.defaultBaseRateAnnual ?? payload.defaultBaseRateAnnual;
    if (baseRate !== undefined) {
      const err = checkNumberRange(baseRate, "Pricing Dasar Pensiun (% p.a.)", { min: 0.1, max: 50 });
      if (err) return fail(400, err);
      next.retiredPhase.defaultBaseRateAnnual = baseRate;
    }

    const maxRatio =
      retiredIn.maxInstallmentRatioPercent ??
      retiredIn.defaultRatioPercent ??
      payload.maxInstallmentRatioPercent ??
      payload.defaultRatioPercent;
    if (maxRatio !== undefined) {
      const err = checkNumberRange(maxRatio, "Rasio DBR/DSR Maksimum Pensiun (%)", { min: 1, max: 100 });
      if (err) return fail(400, err);
      next.retiredPhase.maxInstallmentRatioPercent = maxRatio;
      next.retiredPhase.defaultRatioPercent = maxRatio;
      const minRatio = next.retiredPhase.minInstallmentRatioPercent ?? 70;
      next.retiredPhase.allowedRatioPercents = Array.from(new Set([minRatio, maxRatio])).sort((a, b) => a - b);
    }

    const minRatio = retiredIn.minInstallmentRatioPercent ?? payload.minInstallmentRatioPercent;
    if (minRatio !== undefined) {
      const err = checkNumberRange(minRatio, "Rasio DBR/DSR Opsi Bawah Pensiun (%)", { min: 1, max: 100 });
      if (err) return fail(400, err);
      next.retiredPhase.minInstallmentRatioPercent = minRatio;
      const curMax = next.retiredPhase.maxInstallmentRatioPercent ?? 90;
      next.retiredPhase.allowedRatioPercents = Array.from(new Set([minRatio, curMax])).sort((a, b) => a - b);
    }

    const spouseFactor = retiredIn.spouseFactorWithSpouse ?? payload.spouseFactorWithSpouse;
    if (spouseFactor !== undefined) {
      const err = checkNumberRange(spouseFactor, "Faktor Kapasitas Pasangan", { min: 0.5, max: 1.0 });
      if (err) return fail(400, err);
      next.retiredPhase.spouseFactorWithSpouse = spouseFactor;
    }

    const maxAtribPct =
      retiredIn.maxAttributionPremiumRatioPercent ?? payload.maxAttributionPremiumRatioPercent;
    if (maxAtribPct !== undefined) {
      const err = checkNumberRange(maxAtribPct, "Batas Atribusi Premi terhadap Plafon (%)", { min: 1, max: 100 });
      if (err) return fail(400, err);
      next.retiredPhase.maxAttributionPremiumRatioPercent = maxAtribPct;
    }

    const maxSumAssured = insIn.maxSumAssured ?? payload.maxSumAssured;
    if (maxSumAssured !== undefined) {
      const err = checkNumberRange(maxSumAssured, "Batas Santunan Asuransi Simas Pensiun (Rp)", {
        min: 10000000,
        max: 1000000000,
        integer: true
      });
      if (err) return fail(400, err);
      next.insurance.maxSumAssured = maxSumAssured;
    }
  }

  // 4. Fees & Insurance Buffer
  if (feesIn.adminRatePercent !== undefined) {
    const err = checkNumberRange(feesIn.adminRatePercent, "Biaya Administrasi (%)", { min: 0, max: 20 });
    if (err) return fail(400, err);
    next.fees.adminRatePercent = feesIn.adminRatePercent;
  }
  if (feesIn.materaiFee !== undefined) {
    const err = checkNumberRange(feesIn.materaiFee, "Biaya Materai (Rp)", { min: 0, max: 5000000, integer: true });
    if (err) return fail(400, err);
    next.fees.materaiFee = feesIn.materaiFee;
  }
  if (feesIn.taksasiMmqMarkupPercent !== undefined) {
    const err = checkNumberRange(feesIn.taksasiMmqMarkupPercent, "Markup Taksasi MMQ (%)", { min: 0, max: 50 });
    if (err) return fail(400, err);
    next.fees.taksasiMmqMarkupPercent = feesIn.taksasiMmqMarkupPercent;
  }
  if (!isPensiun) {
    if (feesIn.blokirActiveCount !== undefined) {
      const err = checkNumberRange(feesIn.blokirActiveCount, "Blokir Angsuran Aktif (x)", { min: 0, max: 12, integer: true });
      if (err) return fail(400, err);
      next.fees.blokirActiveCount = feesIn.blokirActiveCount;
    }
    if (feesIn.blokirPensionCount !== undefined) {
      const err = checkNumberRange(feesIn.blokirPensionCount, "Blokir Angsuran Pensiun (x)", { min: 0, max: 12, integer: true });
      if (err) return fail(400, err);
      next.fees.blokirPensionCount = feesIn.blokirPensionCount;
    }
  } else {
    if (feesIn.blokirAtribusiCount !== undefined) {
      const err = checkNumberRange(feesIn.blokirAtribusiCount, "Blokir Angsuran Atribusi (x)", { min: 0, max: 12, integer: true });
      if (err) return fail(400, err);
      next.fees.blokirAtribusiCount = feesIn.blokirAtribusiCount;
    }
  }

  const bufferMonths = insIn.bufferDefaultMonths ?? payload.bufferDefaultMonths;
  if (bufferMonths !== undefined) {
    const err = checkNumberRange(bufferMonths, "Default Buffer Masa Asuransi (Bulan)", {
      min: 0,
      max: 24,
      integer: true
    });
    if (err) return fail(400, err);
    next.insurance.bufferDefaultMonths = bufferMonths;
  }

  const nextRevision = (Number(currentProduct.revision) || 1) + 1;
  const ageSplit = splitMaturityAgeMonths(next.loan.maxMaturityAgeMonths);
  next.revision = nextRevision;
  next.policyVersion = `bsi-${productCode.toLowerCase()}-${next.loan.maxTenorMonths}m-${ageSplit.years}y${ageSplit.months}m-v${nextRevision}`;
  next.updatedAt = new Date().toISOString();
  next.updatedBy = updatedBy;

  return {
    ok: true,
    status: 200,
    updatedProduct: next,
    nextProduct: next,
    beforeSnapshot,
    afterSnapshot: structuredClone(next)
  };
}
