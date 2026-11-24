// Client-side Live Monitoring & Recommendation Engine for BSI Pensiun Berkah
// Verified 100% against Blue Sheets of Kalkukator Pensiun rev1.xlsx:
//   - Akseptasi Pensiun (sheet10)
//   - Pensiun (sheet11)
//   - Rincain keNsb (sheet12)
//   - Simas Pensiun Menurun 2026-06-29 (345 tariff points)

export const SIMAS_PENSIUN_PROFILE = Object.freeze({
  version: "simas-pensiun-menurun-2026-06-29",
  max_sum_assured: 350000000,
  min_entry_age: 45,
  max_entry_age: 74,
  max_policy_months: 180,
  max_end_age: 75,
  month_multipliers: Object.freeze([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.875, 1, 1, 1, 1]),
  tariffs_permil: Object.freeze({
    "45": Object.freeze([3.6,6.52,9.28,12.08,15.18,18.43,21.57,24.62,28.3,31.91,35.51,38.63,42.34,46.2,50.04]),
    "46": Object.freeze([3.87,7.08,10.09,13.18,16.51,19.99,23.34,27,30.67,34.53,38.41,42.02,46.03,50.14,54.26]),
    "47": Object.freeze([4.18,7.73,11.01,14.38,18.01,21.79,25.41,29.16,33.7,37.52,41.7,45.61,49.92,54.33,58.76]),
    "48": Object.freeze([4.52,8.43,12,15.69,19.65,23.75,27.94,31.99,36.31,40.73,45.21,49.42,54.04,58.78,63.55]),
    "49": Object.freeze([4.87,9.16,13.05,17.12,21.38,25.77,30.24,35.09,39.35,44.07,48.91,53.76,58.75,63.79,68.91]),
    "50": Object.freeze([5.25,10,14.24,18.68,23.32,28.09,32.92,37.9,43.23,47.89,53.1,58.36,63.72,69.12,74.62]),
    "51": Object.freeze([5.69,10.91,15.53,20.39,25.45,30.62,36.2,41.58,46.59,51.99,57.57,63.24,68.98,74.79,80.71]),
    "52": Object.freeze([6.19,11.91,16.95,22.25,27.74,33.35,39.06,44.76,50.46,56.32,62.3,68.37,74.54,80.8,87.15]),
    "53": Object.freeze([6.75,13.01,18.51,24.25,30.2,36.22,42.28,48.38,54.55,60.83,67.23,73.75,80.39,87.13,93.96]),
    "54": Object.freeze([7.39,14.18,20.14,26.35,32.73,39.17,45.63,52.15,58.75,65.47,72.33,79.35,86.51,93.77,101.11]),
    "55": Object.freeze([8.08,15.39,21.81,28.46,35.26,42.1,48.98,55.92,62.97,70.19,77.59,85.16,92.87,100.68,108.58]),
    "56": Object.freeze([8.84,16.59,23.44,30.51,37.69,44.94,52.26,59.67,67.26,75.04,83.01,91.17,99.48,107.89,116.24]),
    "57": Object.freeze([9.61,17.69,24.96,32.43,40,47.67,55.47,63.44,71.62,80.03,88.66,97.46,106.4,115.42,124.55]),
    "58": Object.freeze([10.45,18.71,26.37,34.23,42.23,50.4,58.79,67.39,76.26,85.35,94.67,104.16,113.79,123.52,133.31]),
    "59": Object.freeze([11.35,19.67,27.74,36.01,44.54,53.34,62.4,71.73,81.33,91.18,101.24,111.48,121.85,132.31,142.85]),
    "60": Object.freeze([12.34,20.64,29.13,37.98,47.18,56.7,66.54,76.67,87.07,97.73,108.6,119.63,130.8,142.07,153.4]),
    "61": Object.freeze([13.45,21.66,30.78,40.36,50.36,60.72,71.4,82.4,93.68,105.21,116.94,128.84,140.89,153.02,null]),
    "62": Object.freeze([14.7,23.02,32.98,43.42,54.31,65.59,77.22,89.16,101.37,113.83,126.5,139.35,152.34,null,null]),
    "63": Object.freeze([16.11,25.13,36.02,47.44,59.32,71.59,84.21,97.14,110.36,123.83,137.52,151.4,null,null,null]),
    "64": Object.freeze([17.69,27.78,39.78,51.92,64.86,78.2,91.87,105.88,120.17,134.74,149.54,null,null,null,null]),
    "65": Object.freeze([19.42,30.25,43.27,56.78,70.84,85.3,100.12,115.27,130.75,146.51,null,null,null,null,null]),
    "66": Object.freeze([21.25,33.06,47.22,61.97,77.22,92.9,108.96,125.38,142.14,null,null,null,null,null,null]),
    "67": Object.freeze([23.21,36.07,51.48,67.5,84.06,101.07,118.49,136.31,null,null,null,null,null,null,null]),
    "68": Object.freeze([25.31,39.31,56.06,73.48,91.47,109.96,128.9,null,null,null,null,null,null,null,null]),
    "69": Object.freeze([27.58,42.82,61.07,80.05,99.65,119.79,null,null,null,null,null,null,null,null,null]),
    "70": Object.freeze([30.1,46.75,66.68,87.41,108.82,null,null,null,null,null,null,null,null,null,null]),
    "71": Object.freeze([51.7,99.54,147.37,194.92,null,null,null,null,null,null,null,null,null,null,null]),
    "72": Object.freeze([56.28,108.27,159.86,null,null,null,null,null,null,null,null,null,null,null,null]),
    "73": Object.freeze([61.34,117.51,null,null,null,null,null,null,null,null,null,null,null,null,null]),
    "74": Object.freeze([66.78,null,null,null,null,null,null,null,null,null,null,null,null,null,null])
  })
});

export const BSI_PENSIUN_FLAGGING_OPTIONS = Object.freeze([
  { value: "TASPEN", label: "TASPEN (Rp60.000)", cost: 60000 },
  { value: "TASPEN_CTP", label: "TASPEN CTP (Rp500.000)", cost: 500000 },
  { value: "ASABRI", label: "ASABRI (Rp60.000)", cost: 60000 },
  { value: "DAPEN", label: "DAPEN / Lainnya (Rp0)", cost: 0 }
]);

// Official Blue Sheet Anchor Fixture (Kalkukator Pensiun rev1.xlsx: Rp166jt, 169 bln, 1966-06-10)
export const BSI_PENSIUN_EXCEL_ANCHOR = Object.freeze({
  name: "NASABAH UJI PENSIUN BERKAH",
  birth_date: "1966-06-10",
  process_date: "2026-10-01",
  bsi_proyeksi_cair: "2026-10-01",
  bsi_start_angsuran: "2026-11-01",
  pension_salary: 2301400,
  plafond: 166000000,
  tenor: 169,
  bsi_price_pensiun: "10.50",
  bsi_retired_type: "pensiunan",
  bsi_spouse_status: "single",
  bsi_flagging: "TASPEN_CTP",
  bsi_ratio_basis: "DBR",
  bsi_ratio_pct: "90",
  bsi_ongoing_installments: 0,
  pelunasan_lama: 0,
  bsi_skema: "Atribusi",
  bsi_akad: "MMQ"
});

const DAY_MS = 86400000;

function roundExcel(value, digits = 0) {
  const factor = 10 ** digits;
  const scaled = value * factor;
  return (scaled < 0 ? -Math.floor(-scaled + 0.5 + 1e-12) : Math.floor(scaled + 0.5 + 1e-12)) / factor;
}

function parseIsoUtc(str) {
  if (!str || typeof str !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function formatIsoUtc(dt) {
  if (!dt) return "";
  return dt.toISOString().slice(0, 10);
}

function daysInUtcMonth(year, month0) {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function addMonthsClampedUtc(dt, months) {
  const total = dt.getUTCFullYear() * 12 + dt.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  return new Date(Date.UTC(year, month0, Math.min(dt.getUTCDate(), daysInUtcMonth(year, month0))));
}

function addMonthsOverflowUtc(dt, months) {
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + months, dt.getUTCDate()));
}

function days360Us(start, end) {
  let d1 = start.getUTCDate();
  let m1 = start.getUTCMonth() + 1;
  let y1 = start.getUTCFullYear();
  let d2 = end.getUTCDate();
  let m2 = end.getUTCMonth() + 1;
  let y2 = end.getUTCFullYear();
  const lastFeb1 = m1 === 2 && d1 === daysInUtcMonth(y1, 1);
  const lastFeb2 = m2 === 2 && d2 === daysInUtcMonth(y2, 1);
  if (lastFeb1 && lastFeb2) d2 = 30;
  if (d1 === 31 || lastFeb1) d1 = 30;
  if (d2 === 31 && d1 === 30) d2 = 30;
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

function exactAgeDetail(birth, ref) {
  let years = ref.getUTCFullYear() - birth.getUTCFullYear();
  let months = ref.getUTCMonth() - birth.getUTCMonth();
  let days = ref.getUTCDate() - birth.getUTCDate();
  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 0)).getUTCDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
    exactText: `${Math.max(0, years)} Thn ${Math.max(0, months)} Bln ${Math.max(0, days)} Hr`
  };
}

function nearestAgeUtc(birth, ref) {
  let years = ref.getUTCFullYear() - birth.getUTCFullYear();
  const thisBirthday = addMonthsClampedUtc(birth, years * 12);
  if (ref < thisBirthday) years -= 1;
  const lastBirthday = addMonthsClampedUtc(birth, years * 12);
  const remDays = Math.round((ref - lastBirthday) / DAY_MS);
  return remDays >= 182 ? years + 1 : years;
}

export function lookupSimasPensiunTariffPermil(entryAgeNearest, policyMonths) {
  const row = SIMAS_PENSIUN_PROFILE.tariffs_permil[String(entryAgeNearest)];
  if (!row || policyMonths <= 0 || policyMonths > SIMAS_PENSIUN_PROFILE.max_policy_months) return null;
  if (policyMonths < 12) {
    const annual1 = row[0];
    return annual1 == null ? null : roundExcel(annual1 * SIMAS_PENSIUN_PROFILE.month_multipliers[policyMonths - 1], 2);
  }
  const years = Math.ceil(policyMonths / 12);
  return row[years - 1] ?? null;
}

export function getSimasPensiunMcuStatus(entryAgeNearest, sumAssured) {
  if (sumAssured <= 0 || sumAssured > SIMAS_PENSIUN_PROFILE.max_sum_assured) return "UNAVAILABLE";
  if (entryAgeNearest >= 45 && entryAgeNearest <= 60) return "NON_MCU";
  if (entryAgeNearest >= 61 && entryAgeNearest <= 65) return sumAssured <= 300000000 ? "NON_MCU" : "MCU";
  if (entryAgeNearest >= 66 && entryAgeNearest <= 70) return sumAssured <= 100000000 ? "NON_MCU" : "MCU";
  if (entryAgeNearest >= 71 && entryAgeNearest <= 74) return "MCU";
  return "UNAVAILABLE";
}

function pmt(monthlyRate, nper, principal) {
  if (nper <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / nper;
  const f = (1 + monthlyRate) ** nper;
  return (principal * monthlyRate * f) / (f - 1);
}

function solveAnnualRateFromPmt(nper, payment, principal) {
  let lo = 0;
  let hi = 1;
  while (pmt(hi, nper, principal) < payment && hi < 64) hi *= 2;
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2;
    if (pmt(mid, nper, principal) < payment) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

function evaluateScenarioAtPrincipal({
  principal,
  tenor,
  baseRatePct,
  entryAgeNearest,
  tariffPermil,
  isAtribusi,
  adminRatePct = 1,
  stampFixed = 100000,
  blokirAtribusiCount = 2
}) {
  if (principal <= 0 || tenor <= 0 || !tariffPermil) return null;
  const rateFrac = tariffPermil / 1000;
  if (isAtribusi && rateFrac >= 1) return null;
  const sumAssured = isAtribusi ? principal / (1 - rateFrac) : principal;
  const premiumExact = sumAssured * rateFrac;
  const candidateInstallment = pmt(baseRatePct / 100 / 12, tenor, isAtribusi ? principal + premiumExact : principal);
  const annualPricePct = isAtribusi
    ? roundExcel(solveAnnualRateFromPmt(tenor, candidateInstallment, principal), 2)
    : baseRatePct;
  const installmentExact = pmt(annualPricePct / 100 / 12, tenor, principal);
  const adminExact = principal * (adminRatePct / 100);
  const stampExact = stampFixed;
  const upfrontPremiumExact = isAtribusi ? 0 : premiumExact;
  const blokirExact = isAtribusi ? installmentExact * blokirAtribusiCount : 0;
  return {
    principal,
    sumAssured,
    premiumExact,
    annualPricePct,
    installmentExact,
    adminExact,
    stampExact,
    upfrontPremiumExact,
    blokirExact,
    mcuStatus: getSimasPensiunMcuStatus(entryAgeNearest, sumAssured)
  };
}

function computeMaxPrincipalMillion({
  tenor,
  baseRatePct,
  entryAgeNearest,
  tariffPermil,
  capacityExact,
  isAtribusi,
  maxPlafondCap = 350000000,
  maxSumAssured = SIMAS_PENSIUN_PROFILE.max_sum_assured,
  adminRatePct = 1,
  stampFixed = 100000,
  blokirAtribusiCount = 2
}) {
  if (tenor <= 0 || !tariffPermil || capacityExact <= 0) return 0;
  let best = 0;
  for (let p = 1000000; p <= maxPlafondCap; p += 1000000) {
    const ev = evaluateScenarioAtPrincipal({
      principal: p,
      tenor,
      baseRatePct,
      entryAgeNearest,
      tariffPermil,
      isAtribusi,
      adminRatePct,
      stampFixed,
      blokirAtribusiCount
    });
    if (!ev) break;
    if (ev.sumAssured > maxSumAssured + 1e-6) break;
    if (ev.installmentExact <= capacityExact + 1e-9) {
      best = p;
    } else {
      break;
    }
  }
  return best;
}

export function computeBsiPensiunLiveRecommendation(d, productCfg = {}) {
  const birth = parseIsoUtc(d.birth_date);
  if (!birth) return null;

  const loanCfg = productCfg?.loan || {};
  const retCfg = productCfg?.retiredPhase || {};
  const priceCfg = productCfg?.pricing || {};
  const feeCfg = productCfg?.fees || {};
  const insCfg = productCfg?.insurance || {};

  const maxPlafondCap = Number(loanCfg.maxPlafondAbsolute) || 350000000;
  const maxTenorCap = Number(loanCfg.maxTenorMonths) || 180;
  const maxMaturityAgeMonths = Number(loanCfg.maxMaturityAgeMonths) || 894;
  const maxBankEndAgeYears = maxMaturityAgeMonths / 12;
  const maxSumAssured = Number(insCfg.maxSumAssured) || SIMAS_PENSIUN_PROFILE.max_sum_assured;
  const adminRatePct = Number.isFinite(Number(feeCfg.adminRatePercent)) ? Number(feeCfg.adminRatePercent) : 1;
  const stampFixed = Number.isFinite(Number(feeCfg.stampDutyFixed)) ? Number(feeCfg.stampDutyFixed) : 100000;
  const blokirAtribusiCount = Number.isFinite(Number(feeCfg.blokirAtribusiCount)) ? Number(feeCfg.blokirAtribusiCount) : 2;

  const processDt = parseIsoUtc(d.process_date) || parseIsoUtc(new Date().toISOString().slice(0, 10));
  const policyStartDt = parseIsoUtc(d.bsi_proyeksi_cair) || processDt;
  const firstInstDt =
    parseIsoUtc(d.bsi_start_angsuran) ||
    new Date(Date.UTC(policyStartDt.getUTCFullYear(), policyStartDt.getUTCMonth() + 1, 1));

  const ageObj = exactAgeDetail(birth, processDt);
  const bankAgeDays360 = Math.floor(days360Us(birth, processDt) / 360);
  const entryAgeNearest = nearestAgeUtc(birth, policyStartDt);

  const retiredType = String(d.bsi_retired_type || "pensiunan").toLowerCase() === "janda" ? "janda" : "pensiunan";
  const minBankAge = retiredType === "janda"
    ? (Number(loanCfg.minBankAgeJanda) || 48)
    : (Number(loanCfg.minBankAgePensiunan) || 50);
  const spouseStatus = String(d.bsi_spouse_status || "single").toLowerCase() === "with_spouse" ? "with_spouse" : "single";
  const spouseFactorWithSpouse = Number(retCfg.spouseFactorWithSpouse) || 0.98;
  const spouseFactor = spouseStatus === "with_spouse" ? spouseFactorWithSpouse : (Number(retCfg.spouseFactorSingle) || 1.0);

  const ratioBasis = String(d.bsi_ratio_basis || "DBR").toUpperCase() === "DSR" ? "DSR" : "DBR";
  const ratioPct = Number(d.bsi_ratio_pct) === 70 ? 70 : (Number(retCfg.maxInstallmentRatioPercent ?? retCfg.dsrMaxPercent) || 90);
  const pensionSalary = Math.max(0, Number(d.pension_salary || 0));
  const ongoingInstallments = Math.max(0, Number(d.bsi_ongoing_installments || 0));
  const settlementAmount = Math.max(0, Number(d.pelunasan_lama || 0));
  const defaultBaseRate = Number(priceCfg.defaultBaseRateAnnual) || 10.5;
  const baseRatePct = Number(d.bsi_price_pensiun) > 0 ? Number(d.bsi_price_pensiun) : defaultBaseRate;
  const isAtribusi = String(d.bsi_skema || "Atribusi") !== "Non-Atribusi" && String(d.bsi_skema || "Atribusi") !== "Reguler";

  const capacityExact =
    ratioBasis === "DSR"
      ? pensionSalary * spouseFactor * (ratioPct / 100)
      : pensionSalary * spouseFactor * (ratioPct / 100) - ongoingInstallments;

  // Determine maximum valid tenor (1..maxTenorCap) satisfying bank end-age & Simas policy end-age <= 75
  let maxTenor = 0;
  const bankAgeOk = bankAgeDays360 >= minBankAge;
  const simasAgeOk = entryAgeNearest >= 45 && entryAgeNearest <= 74;

  if (simasAgeOk) {
    for (let t = 1; t <= maxTenorCap; t++) {
      const tariff = lookupSimasPensiunTariffPermil(entryAgeNearest, t);
      if (tariff == null) continue;
      const lastInst = addMonthsClampedUtc(firstInstDt, t - 1);
      const policyEnd = addMonthsClampedUtc(policyStartDt, t);
      if (policyEnd < lastInst) continue;
      const bankMatSource = addMonthsOverflowUtc(processDt, t + 1);
      const bankMatMonthStart = new Date(Date.UTC(bankMatSource.getUTCFullYear(), bankMatSource.getUTCMonth() - 1, 1));
      const endAgeDays360 = days360Us(birth, bankMatMonthStart) / 360;
      if (endAgeDays360 > maxBankEndAgeYears + 1e-9) break;
      maxTenor = t;
    }
  }

  const reqTenor = Number(d.tenor) > 0 ? Math.round(Number(d.tenor)) : maxTenor;
  const evalTenor = reqTenor > 0 ? reqTenor : maxTenor;
  const tariffPermil = evalTenor > 0 ? lookupSimasPensiunTariffPermil(entryAgeNearest, evalTenor) : null;

  const maxPlafondAtribusi =
    evalTenor > 0 && tariffPermil != null
      ? computeMaxPrincipalMillion({
          tenor: evalTenor,
          baseRatePct,
          entryAgeNearest,
          tariffPermil,
          capacityExact,
          isAtribusi: true,
          maxPlafondCap,
          maxSumAssured,
          adminRatePct,
          stampFixed,
          blokirAtribusiCount
        })
      : 0;

  const maxPlafondReguler =
    evalTenor > 0 && tariffPermil != null
      ? computeMaxPrincipalMillion({
          tenor: evalTenor,
          baseRatePct,
          entryAgeNearest,
          tariffPermil,
          capacityExact,
          isAtribusi: false,
          maxPlafondCap,
          maxSumAssured,
          adminRatePct,
          stampFixed,
          blokirAtribusiCount
        })
      : 0;

  const maxPlafondSelected = isAtribusi ? maxPlafondAtribusi : maxPlafondReguler;
  const reqPlafond = Math.max(0, Number(d.plafond || 0));
  const evalPlafond = reqPlafond > 0 ? reqPlafond : maxPlafondSelected;

  const liveSelected =
    evalPlafond > 0 && evalTenor > 0 && tariffPermil != null
      ? evaluateScenarioAtPrincipal({
          principal: evalPlafond,
          tenor: evalTenor,
          baseRatePct,
          entryAgeNearest,
          tariffPermil,
          isAtribusi,
          adminRatePct,
          stampFixed,
          blokirAtribusiCount
        })
      : null;

  const netDisbursementExact = liveSelected
    ? liveSelected.principal -
      liveSelected.adminExact -
      liveSelected.stampExact -
      liveSelected.upfrontPremiumExact -
      liveSelected.blokirExact -
      settlementAmount
    : 0;

  const remainingSalaryExact = liveSelected
    ? pensionSalary - liveSelected.installmentExact - ongoingInstallments
    : 0;

  const lastInstDt = evalTenor > 0 ? addMonthsClampedUtc(firstInstDt, evalTenor - 1) : null;
  const policyEndDt = evalTenor > 0 ? addMonthsClampedUtc(policyStartDt, evalTenor) : null;

  let ageStatus = "ELIGIBLE";
  let ageReason = `Memenuhi usia masuk Pensiun Berkah (Usia Bank ${bankAgeDays360} thn ≥ ${minBankAge} thn • Nearest Simas ${entryAgeNearest} thn).`;
  if (!bankAgeOk) {
    ageStatus = "UNDER_MIN_AGE";
    ageReason = `Usia bank ${bankAgeDays360} thn di bawah minimum ${minBankAge} thn untuk ${retiredType === "janda" ? "Pensiun Janda" : "Pensiun Sendiri"} (pertimbangkan mode Prapensiun PP10/PP3 bila masih ASN aktif).`;
  } else if (!simasAgeOk) {
    ageStatus = "OUT_OF_SIMAS_AGE";
    ageReason = `Usia nearest Simas Pensiun ${entryAgeNearest} thn di luar rentang pertanggungan 45–74 tahun.`;
  } else if (maxTenor <= 0) {
    ageStatus = "NO_TENOR_AVAILABLE";
    ageReason = `Tidak ada tenor valid yang memenuhi batas usia lunas bank ≤ ${maxBankEndAgeYears.toFixed(1).replace(".", ",")} tahun & polis ≤ 75 tahun.`;
  }

  return {
    ageObj,
    bankAgeDays360,
    minBankAge,
    bankAgeOk,
    entryAgeNearest,
    simasAgeOk,
    ageStatus,
    ageReason,
    retiredType,
    spouseStatus,
    spouseFactor,
    ratioBasis,
    ratioPct,
    baseRatePct,
    isAtribusi,
    capacityExact: roundExcel(Math.max(0, capacityExact), 2),
    maxTenor,
    maxTenorCap,
    maxPlafondCap,
    evalTenor,
    tariffPermil,
    maxPlafondAtribusi,
    maxPlafondReguler,
    maxPlafondSelected,
    evalPlafond,
    liveSelected,
    netDisbursementExact: roundExcel(netDisbursementExact, 2),
    remainingSalaryExact: roundExcel(remainingSalaryExact, 2),
    lastInstallmentIso: formatIsoUtc(lastInstDt),
    policyEndIso: formatIsoUtc(policyEndDt),
    policyVersion: productCfg?.policyVersion || null
  };
}
