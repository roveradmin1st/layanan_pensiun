// ============================================================================
// SERVER-SIDE CALCULATION ENGINE & DOCUMENT GENERATOR
// Mendukung:
// 1. Koperasi AMS2 (Pra Platinum, Platinum, Post Platinum) - Formula PV/PMT
// 2. BSI Prapensiun NOS v1.4.6 (Dekade Berkah PP10 & Tri Berkah PP3) + Simas Jiwa
// 3. Mitra Bank Dinamis (Bank Capital/Aladin, Mandiri Taspen, Bank MNC, BNI, Mestika)
// ============================================================================

function pmt(rateMonthly, nper, pv) {
  if (nper <= 0 || pv <= 0) return 0;
  if (rateMonthly === 0) return pv / nper;
  const f = Math.pow(1 + rateMonthly, nper);
  return (pv * rateMonthly * f) / (f - 1);
}

function pv(rateMonthly, nper, payment) {
  if (nper <= 0 || payment <= 0) return 0;
  if (rateMonthly === 0) return payment * nper;
  const f = Math.pow(1 + rateMonthly, nper);
  return payment * ((f - 1) / (rateMonthly * f));
}

function parseIsoLocalDate(isoStr) {
  if (!isoStr) return null;
  const s = String(isoStr).slice(0, 10);
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function toIsoDateStr(d) {
  if (!d || isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addMonthsClamped(date, months) {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last));
}

export function fullMonths(from, to) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
  if (addMonthsClamped(from, months) > to) months--;
  return months;
}

export function retentionDays(process, tmt) {
  const pday = process.getDate();
  const tday = tmt.getDate();
  if (pday === tday) return { days: 0, error: null };
  if (pday < tday) return { days: tday - pday, error: null };
  const nextMonth = new Date(process.getFullYear(), process.getMonth() + 1, 1);
  const daysInMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  if (tday > daysInMonth) {
    return {
      days: null,
      error: "Tanggal referensi bunga harian tidak tersedia pada bulan kalender berikutnya."
    };
  }
  const reference = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), tday);
  return { days: Math.round((reference - process) / 86400000), error: null };
}

export function roundHalfUp(value, decimals = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = Math.pow(10, decimals);
  const clean = Number((num * factor).toPrecision(12));
  return (clean >= 0 ? Math.floor(clean + 0.5) : Math.ceil(clean - 0.5)) / factor;
}

function pmtWithFv(monthlyRate, nMonths, pvVal, fvVal = 0) {
  if (nMonths <= 0) return 0;
  if (monthlyRate === 0) return (pvVal + fvVal) / nMonths;
  const factor = Math.pow(1 + monthlyRate, nMonths);
  return (monthlyRate * (pvVal * factor + fvVal)) / (factor - 1);
}

function pvWithFv(monthlyRate, nMonths, pmtVal, fvVal = 0) {
  if (nMonths <= 0) return 0;
  if (monthlyRate === 0) return pmtVal * nMonths + fvVal;
  const factor = Math.pow(1 + monthlyRate, nMonths);
  return (pmtVal * (factor - 1) / monthlyRate + fvVal) / factor;
}

function excelRate(nper, pmtVal, pvVal, fvVal = 0, type = 0, guess = 0.01) {
  if (nper <= 0) return 0;
  let r = guess;
  for (let i = 0; i < 100; i++) {
    if (Math.abs(r) < 1e-12) r = 1e-12;
    const factor = Math.pow(1 + r, nper);
    const g = (factor - 1) / r;
    const y = pvVal * factor + pmtVal * (1 + r * type) * g + fvVal;
    const dFactor = nper * Math.pow(1 + r, nper - 1);
    const dg = (dFactor * r - (factor - 1)) / (r * r);
    const dy = pvVal * dFactor + pmtVal * (1 + r * type) * dg + (type ? pmtVal * g : 0);
    if (Math.abs(dy) < 1e-15) break;
    const nextR = r - y / dy;
    if (Math.abs(nextR - r) < 1e-12) return nextR;
    r = nextR;
  }
  return r;
}

function isLastDayOfFeb(dateObj) {
  if (!dateObj || dateObj.getMonth() !== 1) return false;
  const year = dateObj.getFullYear();
  return dateObj.getDate() === new Date(year, 2, 0).getDate();
}

export function days360US(startDate, endDate) {
  let y1 = startDate.getFullYear();
  let m1 = startDate.getMonth() + 1;
  let d1 = startDate.getDate();
  let y2 = endDate.getFullYear();
  let m2 = endDate.getMonth() + 1;
  let d2 = endDate.getDate();

  const startLastFeb = isLastDayOfFeb(startDate);
  const endLastFeb = isLastDayOfFeb(endDate);
  if (startLastFeb && endLastFeb) d2 = 30;
  if (startLastFeb) d1 = 30;
  if (d2 === 31 && d1 >= 30) d2 = 30;
  if (d1 === 31) d1 = 30;
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

export function getNearestAge30_360(dobDate, startDate) {
  if (!dobDate || !startDate || isNaN(dobDate.getTime()) || isNaN(startDate.getTime())) return 0;
  const d360 = days360US(dobDate, startDate);
  if (d360 < 0) return 0;
  return Math.floor((d360 + 180) / 360);
}

export function computeAgeDetail(birthDateIso, processDateIso = new Date().toISOString().slice(0, 10)) {
  const b = parseIsoLocalDate(birthDateIso) || new Date(birthDateIso);
  const p = parseIsoLocalDate(processDateIso) || new Date(processDateIso);
  if (!b || isNaN(b.getTime()) || !p || isNaN(p.getTime())) {
    return { years: 0, months: 0, days: 0, totalMonths: 0, insuranceAge: 0, exactText: "-" };
  }
  let years = p.getFullYear() - b.getFullYear();
  let months = p.getMonth() - b.getMonth();
  let days = p.getDate() - b.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(p.getFullYear(), p.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalMonths = Math.max(0, years * 12 + months);
  const insuranceAge = getNearestAge30_360(b, p);
  const exactText = `${years} Tahun ${months} Bulan ${days} Hari`;
  return { years, months, days, totalMonths, insuranceAge, exactText };
}

export function computeSimasInsurance(plafond, birthDateIso, tenorMonths, simasConfig, options = {}) {
  const procDateIso = options.processDateIso || new Date().toISOString().slice(0, 10);
  const ageDetail = computeAgeDetail(birthDateIso, procDateIso);
  const nearestAge = options.nearestAge !== undefined ? Number(options.nearestAge) : ageDetail.insuranceAge;
  const minEntryAge = Number(simasConfig?.minEntryAge) || 45;
  const maxEntryAge = Number(simasConfig?.maxEntryAge) || 65;
  const maxCoverageAge = Number(simasConfig?.maxCoverageAge) || 75;
  const maxInsuranceYears = Number(simasConfig?.maxInsuranceYears) || 20;
  const maxInsuranceMonths = maxInsuranceYears * 12;

  const bufferMonths = options.bufferMonths !== undefined ? Number(options.bufferMonths) : 6;
  const totalMonths = options.insuranceMonths !== undefined
    ? Number(options.insuranceMonths)
    : Number(tenorMonths || 0) + bufferMonths;
  const monthsValid = Number.isInteger(totalMonths) && totalMonths >= 1 && totalMonths <= maxInsuranceMonths;
  const insYears = Math.floor(Math.max(0, totalMonths) / 12);
  const insRemMonths = Math.max(0, totalMonths) % 12;

  const baseUp = Math.max(0, Number(plafond) || 0);
  const baseUpValid = baseUp > 0;
  const isAtribusi = options.isAtribusi !== undefined ? Boolean(options.isAtribusi) : true;
  const discountPercent = Number(options.discountPercent ?? 0);
  const discountValid = Number.isFinite(discountPercent) && discountPercent >= 0 && discountPercent <= 5;
  const extraEmPercent = Number(options.extraEmPercent ?? 0);
  const emValid = Number.isFinite(extraEmPercent) && extraEmPercent >= 0;

  const ageValid = Number.isInteger(nearestAge) && nearestAge >= minEntryAge && nearestAge <= maxEntryAge;
  const endCoverageAge = (Number(nearestAge) || 0) + insYears + insRemMonths / 12;
  const maxUpAge70 = Number(simasConfig?.maxUpAge70) || 1000000000;
  const maxUpAge75 = Number(simasConfig?.maxUpAge75) || 500000000;
  const maxUpAllowed = (nearestAge > 64 || endCoverageAge > 70) ? maxUpAge75 : maxUpAge70;

  const ageRow = simasConfig?.decreasingRateTable?.[nearestAge];
  let rawRatePerMil = 0;
  let rateLookupValid = false;

  if (ageValid && monthsValid && Array.isArray(ageRow)) {
    if (totalMonths < 12) {
      const mult = simasConfig?.monthMultipliers?.[totalMonths];
      const y1Rate = Number(ageRow[0]);
      if (typeof mult === "number" && mult > 0 && Number.isFinite(y1Rate) && y1Rate > 0) {
        rawRatePerMil = mult * y1Rate;
        rateLookupValid = true;
      }
    } else {
      const y1Rate = Number(ageRow[insYears - 1]);
      if (Number.isFinite(y1Rate) && y1Rate > 0) {
        if (insRemMonths > 0) {
          const y2Rate = Number(ageRow[insYears]);
          if (Number.isFinite(y2Rate) && y2Rate > 0) {
            rawRatePerMil = y1Rate + (y2Rate - y1Rate) * (insRemMonths / 12);
            rateLookupValid = true;
          }
        } else {
          rawRatePerMil = y1Rate;
          rateLookupValid = true;
        }
      }
    }
  }

  const tarifPerMil = (rateLookupValid && discountValid)
    ? roundHalfUp((1 - discountPercent / 100) * rawRatePerMil, 2)
    : 0;
  const effectivePerMilWithEm = tarifPerMil + (tarifPerMil * extraEmPercent) / 100;
  const q = effectivePerMilWithEm / 1000;

  let grossUpValid = true;
  let santunanSetelahAtribusiRaw = baseUp;
  if (isAtribusi) {
    if (!rateLookupValid || q <= 0 || q >= 1) {
      grossUpValid = false;
    } else {
      santunanSetelahAtribusiRaw = baseUp / (1 - q);
    }
  }

  const kontribusiSekaligusRaw = rateLookupValid
    ? (isAtribusi ? (tarifPerMil * santunanSetelahAtribusiRaw) / 1000 : (tarifPerMil * baseUp) / 1000)
    : 0;
  const extraKontribusiRaw = rateLookupValid ? (extraEmPercent * kontribusiSekaligusRaw) / 100 : 0;
  const totalKontribusiRaw = kontribusiSekaligusRaw + extraKontribusiRaw;

  if (isAtribusi && grossUpValid) {
    if (Math.abs((santunanSetelahAtribusiRaw - totalKontribusiRaw) - baseUp) >= 1) {
      grossUpValid = false;
    }
  }

  const santunanSetelahAtribusi = Math.round(santunanSetelahAtribusiRaw);
  const kontribusiSekaligus = Math.round(kontribusiSekaligusRaw);
  const extraKontribusi = Math.round(extraKontribusiRaw);
  const totalKontribusi = Math.round(totalKontribusiRaw);

  const okCoverageAge = endCoverageAge <= maxCoverageAge;
  const okUpLimit = baseUp <= maxUpAllowed && santunanSetelahAtribusiRaw <= maxUpAllowed && santunanSetelahAtribusi <= maxUpAllowed;
  const valid = Boolean(
    ageValid &&
    monthsValid &&
    baseUpValid &&
    discountValid &&
    emValid &&
    rateLookupValid &&
    tarifPerMil > 0 &&
    grossUpValid &&
    okCoverageAge &&
    okUpLimit
  );

  let medicalStatus = "Non Medical Check Up";
  let medicalNote = "Auto Acceptance — Wajib melampirkan KTP yang masih berlaku.";
  if (!ageValid) {
    medicalStatus = "Perhatikan Ketentuan Usia Masuk (45–65 Tahun)";
    medicalNote = "Usia Nearest Birthday di luar rentang 45–65 tahun.";
  } else if (!monthsValid || !okCoverageAge) {
    medicalStatus = "Melebihi Masa Asuransi Maksimum (Usia + Tenor > 75 Thn / > 20 Thn)";
    medicalNote = "Kurangi tenor agar usia jatuh tempo asuransi ≤ 75 tahun.";
  } else if (!rateLookupValid || tarifPerMil <= 0) {
    medicalStatus = "Tarif Asuransi Tidak Tersedia";
    medicalNote = "Kombinasi usia dan masa asuransi tidak memiliki tarif pada tabel Simas.";
  } else if (!okUpLimit) {
    medicalStatus = `Melebihi Maksimum UP (Maks Rp${maxUpAllowed.toLocaleString("id-ID")})`;
    medicalNote = "Turunkan plafon pengajuan sesuai batas uang pertanggungan.";
  } else if (nearestAge >= 56 && santunanSetelahAtribusiRaw > 500000000) {
    medicalStatus = "Medical Check Up (MCU)";
    medicalNote = "Usia ≥ 56 thn dengan Santunan > Rp500 Juta wajib Medical Check Up.";
  } else if (nearestAge >= 51 && santunanSetelahAtribusiRaw > 800000000) {
    medicalStatus = "Medical Check Up (MCU)";
    medicalNote = "Usia 51–55 thn dengan Santunan > Rp800 Juta wajib Medical Check Up.";
  }

  return {
    valid,
    company: simasConfig?.companyName || "PT Asuransi Simas Jiwa",
    entry_age: nearestAge,
    nearest_age: nearestAge,
    end_coverage_age: Number(endCoverageAge.toFixed(1)),
    insurance_months: totalMonths,
    ins_years: insYears,
    ins_rem_months: insRemMonths,
    effective_years: insYears + (insRemMonths > 0 ? 1 : 0),
    rate_permil: tarifPerMil,
    tarif_permil: tarifPerMil,
    santunan_setelah_atribusi: santunanSetelahAtribusi,
    kontribusi_sekaligus: kontribusiSekaligus,
    extra_kontribusi: extraKontribusi,
    premium: totalKontribusi,
    total_kontribusi: totalKontribusi,
    max_up_allowed: maxUpAllowed,
    medical_status: medicalStatus,
    medical_note: medicalNote,
    raw: {
      rawRatePerMil,
      tarifPerMil,
      santunanSetelahAtribusi: santunanSetelahAtribusiRaw,
      kontribusiSekaligus: kontribusiSekaligusRaw,
      extraKontribusi: extraKontribusiRaw,
      totalKontribusi: totalKontribusiRaw
    }
  };
}

function normalizeBsiPayrollStatus(rawStatus, cfg) {
  const dbrPayroll = Number(cfg?.dbrActivePayroll) || 70;
  const dbrColek = Number(cfg?.dbrActivePayrollColek) || 80;
  const dbrNonPayroll = Number(cfg?.dbrActiveNonPayroll) || 50;
  if (rawStatus === undefined || rawStatus === null || rawStatus === "") {
    return { code: "P", key: "payroll", label: "Payroll", valid: true, ceilingPercent: dbrPayroll, defaultPercent: dbrPayroll };
  }
  const cleaned = String(rawStatus).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (cleaned === "p" || cleaned === "payroll" || cleaned === "1. payroll" || cleaned === "payroll (bsi)") {
    return { code: "P", key: "payroll", label: "Payroll", valid: true, ceilingPercent: dbrPayroll, defaultPercent: dbrPayroll };
  }
  if (
    cleaned === "c" ||
    cleaned === "comitted payroll" ||
    cleaned === "committed payroll" ||
    cleaned === "payroll colek" ||
    cleaned === "2. comitted payroll"
  ) {
    return { code: "C", key: "comitted_payroll", label: "Comitted Payroll", valid: true, ceilingPercent: dbrColek, defaultPercent: dbrPayroll };
  }
  if (cleaned === "n" || cleaned === "non payroll" || cleaned === "3. non payroll") {
    return { code: "N", key: "non_payroll", label: "Non Payroll", valid: true, ceilingPercent: dbrNonPayroll, defaultPercent: dbrNonPayroll };
  }
  return { code: "INVALID", key: "invalid", label: String(rawStatus), valid: false, ceilingPercent: 0, defaultPercent: 0 };
}

function resolveBsiBasePricing(plafondAmount, subProduct, cfg, body) {
  const manualAktif = Number(body?.bsi_price_aktif ?? body?.price_aktif ?? body?.rate_active_annual ?? 0);
  const manualPensiun = Number(body?.bsi_price_pensiun ?? body?.price_pensiun ?? body?.rate_pension_annual ?? 0);

  let tierObj = cfg.pricingTiers?.dekadeNettAbove200 || { rateActiveAnnual: 9.5, ratePensionAnnual: 10.5 };
  if (plafondAmount > 0 && plafondAmount < 200000000 && cfg.pricingTiers?.below200) {
    tierObj = cfg.pricingTiers.below200;
  } else if (subProduct === "PP3" && cfg.pricingTiers?.triNettAbove200) {
    tierObj = cfg.pricingTiers.triNettAbove200;
  }
  return {
    baseRateAktifAnnual: manualAktif > 0 ? manualAktif : Number(tierObj.rateActiveAnnual),
    baseRatePensiunAnnual: manualPensiun > 0 ? manualPensiun : Number(tierObj.ratePensionAnnual),
    isManualAktif: manualAktif > 0,
    isManualPensiun: manualPensiun > 0,
    tierLabel: tierObj.label || "-"
  };
}

function computeBsiCandidateMaxPlafond({
  subProduct,
  isAtribusi,
  baseRateAktifAnnual,
  baseRatePensiunAnnual,
  akseptasiAktif,
  akseptasiPensiun,
  tenorAktif,
  tenorPensiun,
  requestedTenor,
  nominalAtribusi,
  cfg
}) {
  if (tenorAktif <= 0 || requestedTenor <= 0) return 0;
  if (tenorPensiun > 0 && akseptasiPensiun <= 0) return 0;
  if (akseptasiAktif <= 0) return 0;

  const maxPlafondAbs = Number(cfg.maxPlafondAbsolute) || 800000000;
  const hasAtrib = isAtribusi && nominalAtribusi > 0;
  const atribPerBulan = requestedTenor > 0 ? nominalAtribusi / requestedTenor : 0;

  if (subProduct === "PP3") {
    const pokokTetap = Number(cfg.atribusiAdjustments?.pp3PokokTetapAktif) || 10000;
    const availAktif = akseptasiAktif - atribPerBulan - pokokTetap;
    if (availAktif <= 0 || baseRateAktifAnnual <= 0) return 0;
    const rawCapAktif = (availAktif * 12) / (baseRateAktifAnnual / 100);
    const capAktif = Math.floor(rawCapAktif / 10000000) * 10000000;

    if (tenorPensiun > 0) {
      const adjPensiun = hasAtrib ? ((Number(cfg.atribusiAdjustments?.pp10PensionRateAdd) || 1.0) / 100) : 0;
      const ratePenCap = (baseRatePensiunAnnual / 100) + adjPensiun;
      const availPensiun = akseptasiPensiun - atribPerBulan;
      if (availPensiun <= 0) return 0;
      const rawCapPensiun = pvWithFv(ratePenCap / 12, tenorPensiun, availPensiun, 0);
      const capPensiun = Math.floor(rawCapPensiun / 10000000) * 10000000;
      return Math.max(0, Math.min(maxPlafondAbs, capAktif, capPensiun));
    }
    return Math.max(0, Math.min(maxPlafondAbs, capAktif));
  }

  const adjAktif = hasAtrib ? ((Number(cfg.atribusiAdjustments?.pp10ActiveRateAdd) ?? 0.1) / 100) : 0;
  const adjPensiun = hasAtrib ? ((Number(cfg.atribusiAdjustments?.pp10PensionRateAdd) ?? 1.0) / 100) : 0;
  const rateAktifCap = (baseRateAktifAnnual / 100) + adjAktif;
  const ratePensiunCap = (baseRatePensiunAnnual / 100) + adjPensiun;

  const availAktif = akseptasiAktif - atribPerBulan;
  if (availAktif <= 0) return 0;
  let pvPen = 0;
  if (tenorPensiun > 0) {
    const availPensiun = akseptasiPensiun - atribPerBulan;
    if (availPensiun <= 0) return 0;
    pvPen = pvWithFv(ratePensiunCap / 12, tenorPensiun, availPensiun, 0);
  }
  const rawPvAkt = pvWithFv(rateAktifCap / 12, tenorAktif, availAktif, pvPen);
  return Math.max(0, Math.min(maxPlafondAbs, Math.floor(rawPvAkt / 1000000) * 1000000));
}

function evaluateBsiCore(body, cfg, defaultProcessDate) {
  const processDateStr = body.process_date || defaultProcessDate || new Date().toISOString().slice(0, 10);
  const procDate = parseIsoLocalDate(processDateStr) || new Date(processDateStr);
  const dobDate = parseIsoLocalDate(body.birth_date);
  const ageObj = computeAgeDetail(body.birth_date, processDateStr);
  const nearestAge = dobDate && procDate ? getNearestAge30_360(dobDate, procDate) : 0;

  const payrollInfo = normalizeBsiPayrollStatus(body.bsi_status_gaji, cfg);
  const subProduct = body.bsi_sub_product === "PP3" ? "PP3" : "PP10";
  const akad = body.bsi_akad === "Murabahah" ? "Murabahah" : "MMQ";
  const skemaRaw = String(body.bsi_skema || "Atribusi");
  const isAtribusi = !skemaRaw.toLowerCase().includes("non") && !skemaRaw.toLowerCase().includes("no_atribusi") && !skemaRaw.toLowerCase().includes("1. no");
  const skema = isAtribusi ? "Atribusi" : "Non-Atribusi";

  const bupAge = Math.max(55, Number(body.bup_age || cfg.bupAgeDefault || 58));
  const explicitBupYear = Number(body.tmt_pensiun_year || body.bup_year) || 0;
  const targetBupYear = explicitBupYear >= 1990
    ? explicitBupYear
    : (dobDate ? dobDate.getFullYear() + bupAge : procDate.getFullYear() + 5);

  let bupDate = null;
  let actualMonthsToBup = 0;
  if (dobDate && procDate) {
    bupDate = new Date(targetBupYear, dobDate.getMonth() + 1, 1);
    const rawDays = (bupDate.getTime() - procDate.getTime()) / (1000 * 60 * 60 * 24);
    actualMonthsToBup = rawDays > 0 ? Math.max(0, Math.round(rawDays / 30.5)) : 0;
  }

  // Rekomendasi produk berdasarkan sisa masa aktif aktual ke BUP
  let recommendedSubProduct = "PP10";
  let recommendedSubProductReason = "Sisa masa aktif > 36 bulan s.d. 120 bulan direkomendasikan menggunakan Dekade Berkah (Prapen 10 Tahun).";
  if (actualMonthsToBup <= 0) {
    recommendedSubProduct = "SUDAH_PENSIUN";
    recommendedSubProductReason = "Debitur telah mencapai/melewati tanggal BUP (0 bulan aktif). Tidak memenuhi syarat Prapensiun.";
  } else if (actualMonthsToBup <= 36) {
    recommendedSubProduct = "PP3";
    recommendedSubProductReason = `Sisa masa aktif ${actualMonthsToBup} bulan (≤ 36 bulan) sangat cocok untuk Tri Berkah (Prapen 3 Tahun — pokok aktif ringan Rp10.000/bln) maupun Dekade Berkah.`;
  } else if (actualMonthsToBup > 120) {
    recommendedSubProduct = "BELUM_MASUK_JENDELA";
    recommendedSubProductReason = `Sisa masa aktif ${actualMonthsToBup} bulan (> 120 bulan / 10 tahun) belum masuk jendela Prapensiun 10 Tahun.`;
  }

  const maxEndMonths = (Number(cfg.maxEndAgeYears) || 74) * 12 + (Number(cfg.maxEndAgeMonths) || 4);
  const endAgeLimitDate = dobDate ? addMonthsClamped(dobDate, maxEndMonths) : null;
  const remainingAgeMonths = (dobDate && procDate && endAgeLimitDate)
    ? Math.max(0, fullMonths(procDate, endAgeLimitDate))
    : Math.max(0, maxEndMonths - ageObj.totalMonths);
  const maxTenor = Math.max(0, Math.min(Number(cfg.maxTenorMonths) || 180, remainingAgeMonths));

  // Komponen Penghasilan Aktif (Sheet Akseptasi B8:G13)
  const gp = Math.max(0, Number(body.gaji_pokok || 0));
  const um = Math.max(0, Number(body.uang_makan || 0));
  const tr1 = Math.max(0, Number(body.tunjangan_rutin_1 || 0));
  const tr3 = Math.max(0, Number(body.tunjangan_rutin_3 || 0));
  const tl1 = Math.max(0, Number(body.tunjangan_lain_1 || 0));
  const tht = Math.max(0, Number(body.tht || 0));
  const fallbackSalary = Math.max(0, Number(body.salary || 0));
  const weights = cfg.incomeWeights || { gajiPokok: 100, uangMakan: 90, tunjanganRutin1Bln: 90, tunjanganRutin3Bln: 50, tunjanganLain1Bln: 80, tht: 75 };

  let recognizedSalaryRaw = fallbackSalary;
  if (gp > 0 || um > 0 || tr1 > 0 || tr3 > 0 || tl1 > 0) {
    recognizedSalaryRaw =
      gp * (Number(weights.gajiPokok) / 100) +
      um * (Number(weights.uangMakan) / 100) +
      tr1 * (Number(weights.tunjanganRutin1Bln) / 100) +
      tr3 * (Number(weights.tunjanganRutin3Bln) / 100) +
      tl1 * (Number(weights.tunjanganLain1Bln) / 100);
  }
  const recognizedSalary = Math.round(recognizedSalaryRaw);
  const thtRecognized = Math.round(tht * ((Number(weights.tht) || 75) / 100));

  const hasExplicitPension =
    body.pension_salary !== undefined && body.pension_salary !== null && String(body.pension_salary).trim() !== ""
      ? true
      : (body.pensiun !== undefined && body.pensiun !== null && String(body.pensiun).trim() !== "");
  const pensionSalary = hasExplicitPension ? Math.max(0, Number(body.pension_salary ?? body.pensiun ?? 0)) : 0;

  const chosenDbr = body.bsi_dbr_chosen !== undefined && body.bsi_dbr_chosen !== null && body.bsi_dbr_chosen !== ""
    ? Number(body.bsi_dbr_chosen)
    : payrollInfo.defaultPercent;
  const dbrActiveRate = payrollInfo.valid ? Math.min(payrollInfo.ceilingPercent, Math.max(0, chosenDbr)) : 0;
  const dsrPensionRate = Number(cfg.dsrPensionMax) || 90;

  const angsuranBsi = Math.max(0, Number(body.angsuran_bsi || 0));
  const angsuranSelainBsi = Math.max(0, Number(body.angsuran_selain_bsi || 0));
  const hasSplitOblig = body.angsuran_bsi !== undefined || body.angsuran_selain_bsi !== undefined;
  const existingInstallment = hasSplitOblig ? (angsuranBsi + angsuranSelainBsi) : Math.max(0, Number(body.existing_installment || 0));

  let akseptasiAktifRaw = 0;
  if (payrollInfo.valid) {
    if (hasSplitOblig) {
      if (payrollInfo.code === "P") {
        akseptasiAktifRaw = (recognizedSalary * (dbrActiveRate / 100) - angsuranSelainBsi) - angsuranBsi;
      } else if (payrollInfo.code === "C") {
        akseptasiAktifRaw = recognizedSalary * (dbrActiveRate / 100) - (angsuranBsi + angsuranSelainBsi);
      } else {
        akseptasiAktifRaw = (recognizedSalary - angsuranSelainBsi) * (dbrActiveRate / 100) - angsuranBsi;
      }
    } else {
      akseptasiAktifRaw = (recognizedSalary - existingInstallment) * (dbrActiveRate / 100);
    }
  }
  const maxInstallmentActive = Math.floor(Math.max(0, akseptasiAktifRaw));
  const maxInstallmentPension = Math.floor(Math.max(0, pensionSalary * (dsrPensionRate / 100)));

  return {
    processDateStr,
    procDate,
    dobDate,
    ageObj,
    nearestAge,
    payrollInfo,
    subProduct,
    akad,
    skema,
    isAtribusi,
    bupAge,
    targetBupYear,
    bupDateStr: bupDate ? toIsoDateStr(bupDate) : "",
    actualMonthsToBup,
    recommendedSubProduct,
    recommendedSubProductReason,
    endAgeLimitDateStr: endAgeLimitDate ? toIsoDateStr(endAgeLimitDate) : "",
    remainingAgeMonths,
    maxTenor,
    gp,
    um,
    tr1,
    tr3,
    tl1,
    tht,
    thtRecognized,
    recognizedSalary,
    recognizedSalaryRaw,
    pensionSalary,
    dbrActiveRate,
    dsrPensionRate,
    angsuranBsi,
    angsuranSelainBsi,
    existingInstallment,
    maxInstallmentActive,
    maxInstallmentPension
  };
}

function evaluateAms2Core(body, cfg) {
  const processDate =
    body.process_date && parseIsoLocalDate(body.process_date)
      ? String(body.process_date).slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const dob = parseIsoLocalDate(body.birth_date);
  const at = parseIsoLocalDate(processDate) || new Date();
  let age = 0;
  if (dob && at) {
    age = at.getFullYear() - dob.getFullYear();
    const m = at.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && at.getDate() < dob.getDate())) age--;
  }
  const ageObj = computeAgeDetail(body.birth_date, processDate);
  const maxEntryAge = Number(cfg.maxEntryAgeYears ?? 84);
  const tier = (cfg.tiers || []).find((t) => age >= t.minAge && age <= t.maxAge) || null;
  const inCategory = age >= 0 && age <= maxEntryAge && !!tier;
  const categoryLabel = inCategory ? tier.name : "Di luar kategori";
  const coopRatePct = inCategory ? Number(tier.coopRateAnnual) : 0;
  const coopRate = inCategory ? coopRatePct / 100 : null;
  const riskRatePct = inCategory ? Number(tier.riskReserveRate) : 0;
  const riskRate = inCategory ? riskRatePct / 100 : 0;

  const maxEndAgeYears = Number(cfg.maxEndAgeYears ?? 84);
  const maxEndAgeMonths = Number(cfg.maxEndAgeMonths ?? 10);
  const maxTenorCap = Number(cfg.maxTenorMonths ?? 120);
  const finalLimit = dob ? addMonthsClamped(dob, maxEndAgeYears * 12 + maxEndAgeMonths) : null;

  let recMaxTenor = 0;
  if (dob && at && finalLimit) {
    const months = (finalLimit.getFullYear() - at.getFullYear()) * 12 + (finalLimit.getMonth() - at.getMonth());
    const candidateEnd = new Date(at);
    candidateEnd.setMonth(candidateEnd.getMonth() + Math.max(0, months));
    recMaxTenor = Math.max(0, months);
    if (candidateEnd > finalLimit) recMaxTenor = Math.max(0, recMaxTenor - 1);
    recMaxTenor = Math.min(maxTenorCap, recMaxTenor);
  }

  const salary = Math.max(0, Number(body.salary || 0));
  const maxInstallmentRatioPct = Number(cfg.maxInstallmentRatio ?? 95);
  const cap = salary * (maxInstallmentRatioPct / 100);
  const recRate = coopRate !== null ? coopRate / 12 : null;
  const maxPlafondAbs = Number(cfg.maxPlafondAbsolute ?? 250000000);
  const step = Number(cfg.plafondRoundingStep ?? 100000) || 100000;

  const reqTenor = Math.max(0, Math.floor(Number(body.tenor || 0)));
  const effectiveTenor = reqTenor > 0 ? Math.min(reqTenor, maxTenorCap, recMaxTenor || maxTenorCap) : recMaxTenor;

  let recMaxPlafon = 0;
  if (salary > 0 && recRate !== null && effectiveTenor > 0) {
    const maxBySalary = cap * ((1 - Math.pow(1 + recRate, -effectiveTenor)) / recRate);
    recMaxPlafon = Math.min(maxPlafondAbs, Math.floor(maxBySalary / step) * step);
  }

  let maxPlafondAtMaxTenor = 0;
  if (salary > 0 && recRate !== null && recMaxTenor > 0) {
    const maxBySalaryFull = cap * ((1 - Math.pow(1 + recRate, -recMaxTenor)) / recRate);
    maxPlafondAtMaxTenor = Math.min(maxPlafondAbs, Math.floor(maxBySalaryFull / step) * step);
  }

  return {
    processDate,
    dob,
    at,
    age,
    ageMonths: ageObj.months,
    inCategory,
    categoryLabel,
    coopRatePct,
    coopRate,
    riskRatePct,
    riskRate,
    finalLimit,
    recMaxTenor,
    effectiveTenor,
    recMaxPlafon,
    maxPlafondAtMaxTenor,
    salary,
    cap,
    maxInstallmentRatioPct,
    maxPlafondAbs,
    maxTenorCap
  };
}

export function calculateMax(body, allParams) {
  const bankKey = body.bank_key || "ams2";
  const cfg = allParams[bankKey] || allParams.ams2;
  const processDate = new Date().toISOString().slice(0, 10);
  const ageObj = computeAgeDetail(body.birth_date, processDate);
  const age = ageObj.years;
  const salary = Math.max(0, Number(body.salary || 0));
  const takeOver = Math.max(0, Number(body.take_over || 0));

  // 1. Koperasi AMS2 (Updated V2)
  if (bankKey === "ams2" || cfg.engine === "ams2") {
    const core = evaluateAms2Core(body, cfg);
    if (!core.inCategory) {
      return {
        processable: false,
        stop_reason: `Usia nasabah (${core.age} tahun) berada di luar kategori usia produk (maksimal ${cfg.maxEntryAgeYears} tahun).`,
        name: body.name,
        process_date: core.processDate,
        age: core.age
      };
    }
    if (core.recMaxTenor <= 0) {
      return {
        processable: false,
        stop_reason: `Sisa masa kredit berdasarkan batas usia jatuh tempo (${cfg.maxEndAgeYears} thn ${cfg.maxEndAgeMonths} bln) sudah melewati batas.`,
        name: body.name,
        process_date: core.processDate,
        age: core.age
      };
    }

    return {
      processable: true,
      stop_reason: null,
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      process_date: core.processDate,
      age: core.age,
      age_months: core.ageMonths,
      category: core.categoryLabel,
      coop_rate: core.coopRatePct,
      bank_rate: cfg.bankRateAnnual,
      risk_pct: core.riskRatePct,
      salary: core.salary,
      max_installment: Math.round(core.cap),
      max_tenor: core.recMaxTenor,
      max_plafond: core.recMaxPlafon,
      rec_max_tenor: core.recMaxTenor,
      rec_max_plafond: core.recMaxPlafon,
      max_plafond_full_tenor: core.maxPlafondAtMaxTenor,
      take_over: takeOver
    };
  }

  // 2. BSI Mitraguna Prima+ Prapensiun (Dekade Berkah PP10 & Tri Berkah PP3 + Simas Jiwa)
  if (bankKey === "bsi_prapen" || cfg.engine === "bsi_simas") {
    const core = evaluateBsiCore(body, cfg, processDate);
    const tenorForCap = Number(body.tenor) > 0
      ? Math.min(core.maxTenor, Math.floor(Number(body.tenor)))
      : core.maxTenor;
    const tenorAktifCap = core.actualMonthsToBup > 0 ? Math.min(tenorForCap, core.actualMonthsToBup) : 0;
    const tenorPensiunCap = Math.max(0, tenorForCap - tenorAktifCap);

    const endCoverageAgePreview = core.nearestAge + Math.floor((tenorForCap + 6) / 12) + ((tenorForCap + 6) % 12) / 12;
    const maxUpAllowed = (core.nearestAge > 64 || endCoverageAgePreview > 70)
      ? (Number(cfg.simasInsurance?.maxUpAge75) || 500000000)
      : (Number(cfg.simasInsurance?.maxUpAge70) || 1000000000);
    const mcuThreshold = core.nearestAge >= 56 ? 500000000 : (core.nearestAge >= 51 ? 800000000 : 1000000000);

    const stopReasons = [];
    if (!core.dobDate) {
      stopReasons.push("Tanggal Lahir wajib diisi.");
    } else if (core.nearestAge < 45 || core.nearestAge > 65) {
      stopReasons.push(`Usia Nearest Birthday (${core.nearestAge} tahun) di luar rentang usia masuk BSI Prapensiun & Asuransi Simas Jiwa (45–65 tahun).`);
    }
    if (core.maxTenor < 12) {
      stopReasons.push(`Sisa tenor ke batas usia ${cfg.maxEndAgeYears} thn ${cfg.maxEndAgeMonths} bln (${core.maxTenor} bulan) kurang dari 12 bulan.`);
    }
    if (core.actualMonthsToBup <= 0) {
      stopReasons.push("Nasabah sudah melewati tanggal BUP Pensiun (0 bulan aktif). Produk Prapensiun memerlukan masa aktif minimal 1 bulan.");
    }

    // Hitung estimasi Plafond Maksimal menggunakan iterasi premi kandidat
    const reqPlafond = Math.max(0, Number(body.plafond || 0));
    const pricing = resolveBsiBasePricing(reqPlafond || 300000000, core.subProduct, cfg, body);
    const manualIns = Math.max(0, Number(body.bsi_manual_insurance || 0));

    let candidateP = reqPlafond > 0 ? reqPlafond : 400000000;
    let maxPlafond = 0;
    if (tenorAktifCap > 0 && core.maxInstallmentActive > 0 && (tenorPensiunCap === 0 || core.maxInstallmentPension > 0)) {
      for (let iter = 0; iter < 5; iter++) {
        const simasCand = computeSimasInsurance(candidateP, body.birth_date, tenorForCap, cfg.simasInsurance, {
          processDateIso: core.processDateStr,
          nearestAge: core.nearestAge,
          isAtribusi: core.isAtribusi,
          discountPercent: body.bsi_discount_pct ?? 0,
          extraEmPercent: body.bsi_extra_em_pct ?? 0
        });
        const atribNominal = !core.isAtribusi ? 0 : (manualIns > 0 ? manualIns : simasCand.total_kontribusi);
        const candPricing = resolveBsiBasePricing(candidateP, core.subProduct, cfg, body);
        maxPlafond = computeBsiCandidateMaxPlafond({
          subProduct: core.subProduct,
          isAtribusi: core.isAtribusi,
          baseRateAktifAnnual: candPricing.baseRateAktifAnnual,
          baseRatePensiunAnnual: candPricing.baseRatePensiunAnnual,
          akseptasiAktif: core.maxInstallmentActive,
          akseptasiPensiun: core.maxInstallmentPension,
          tenorAktif: tenorAktifCap,
          tenorPensiun: tenorPensiunCap,
          requestedTenor: tenorForCap,
          nominalAtribusi: atribNominal,
          cfg
        });
        if (reqPlafond > 0 || maxPlafond <= 0 || Math.abs(maxPlafond - candidateP) < 1000000) break;
        candidateP = maxPlafond;
      }
    }

    const subProductLabel = core.subProduct === "PP3" ? "Tri Berkah (Prapen 3 Tahun)" : "Dekade Berkah (Prapen 10 Tahun)";
    const statusGajiLabel = core.payrollInfo.label;

    return {
      processable: stopReasons.length === 0,
      stop_reason: stopReasons.length > 0 ? stopReasons.join(" ") : null,
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      process_date: core.processDateStr,
      age: core.ageObj.years,
      age_months: core.ageObj.months,
      age_days: core.ageObj.days,
      age_exact_text: core.ageObj.exactText,
      nearest_age: core.nearestAge,
      end_age_limit_date: core.endAgeLimitDateStr,
      bup_age: core.bupAge,
      bup_year: core.targetBupYear,
      bup_date: core.bupDateStr,
      actual_months_to_bup: core.actualMonthsToBup,
      recommended_sub_product: core.recommendedSubProduct,
      recommended_sub_product_reason: core.recommendedSubProductReason,
      max_up_allowed: maxUpAllowed,
      mcu_threshold: mcuThreshold,
      category: `${subProductLabel} • ${statusGajiLabel} • ${core.akad} (${core.skema})`,
      bsi_status_gaji: core.payrollInfo.key,
      bsi_status_gaji_code: core.payrollInfo.code,
      bsi_status_gaji_label: statusGajiLabel,
      bsi_sub_product: core.subProduct,
      bsi_sub_product_label: subProductLabel,
      dbr_active_rate: core.dbrActiveRate,
      dsr_pension_rate: core.dsrPensionRate,
      coop_rate: pricing.baseRatePensiunAnnual,
      bank_rate: pricing.baseRateAktifAnnual,
      salary: core.recognizedSalary,
      salary_raw: salary,
      pension_salary: core.pensionSalary,
      tht: core.tht,
      tht_recognized: core.thtRecognized,
      max_installment: core.maxInstallmentActive,
      max_installment_pension: core.maxInstallmentPension,
      max_tenor: core.maxTenor,
      tenor_aktif_est: tenorAktifCap,
      tenor_pensiun_est: tenorPensiunCap,
      max_plafond: maxPlafond,
      take_over: takeOver
    };
  }

  // 3. Calc Capital — PS3 CAPITAL (DASA CIPTA BERKARYA)
  if (bankKey === "bank_capital" || cfg.engine === "capital_ps3") {
    const procDateStr = body.process_date || processDate;
    const procDate = parseIsoLocalDate(procDateStr);
    const dobDate = parseIsoLocalDate(body.birth_date);
    const tmtDate = parseIsoLocalDate(body.tmt_pensiun_date || body.retirement_date);
    const product = body.capital_product || ""; // 'pra' | 'pensiun'
    const isPensiun = product === "pensiun";
    const paymentType = isPensiun ? "non" : (body.capital_payment_type || ""); // 'gp' | 'non'
    const gpManualRaw = body.capital_gp_manual !== undefined && body.capital_gp_manual !== null ? String(body.capital_gp_manual).trim() : "";
    const rate = (cfg.interestRateAnnual || 10.0) / 100 / 12;
    const maxEndTotalMonths = (cfg.maxEndAgeYears || 74) * 12 + (cfg.maxEndAgeMonths ?? 11);
    const maxGpLimit = cfg.maxGpMonths || 48;

    const errors = [];
    if (!procDate) {
      errors.push("Tanggal proses tidak valid.");
      return {
        processable: false,
        stop_reason: errors.join(" "),
        errors,
        name: body.name,
        process_date: procDateStr,
        age
      };
    }
    if (!dobDate) {
      errors.push("Tanggal Lahir wajib diisi.");
      return {
        processable: false,
        stop_reason: errors.join(" "),
        errors,
        name: body.name,
        process_date: procDateStr,
        age
      };
    }

    const ageLimitDate = addMonthsClamped(dobDate, maxEndTotalMonths);
    const ageLimitStr = toIsoDateStr(ageLimitDate);
    const maxCreditMonths = fullMonths(procDate, ageLimitDate);

    if (dobDate > procDate) errors.push("Tanggal lahir tidak boleh setelah tanggal proses.");
    if (maxCreditMonths <= 0) errors.push("Batas usia kredit sudah tercapai; tenor maksimal tidak positif.");
    if (salary <= 0) errors.push("Isi gaji bulanan untuk menghitung batas angsuran dan plafond.");
    if (!product) errors.push("Pilih produk kredit.");
    if (product === "pra" && !paymentType) errors.push("Pilih tipe angsuran.");
    if (product === "pra" && !tmtDate) errors.push("Isi TMT Pensiun untuk menghitung Tenor PP dan Tenor PV.");

    let ppMonths = isPensiun ? 0 : null;
    let gpMonths = 0;
    let pvMonths = null;
    let maxLoan = null;

    if (!isPensiun && tmtDate && procDate) {
      ppMonths = fullMonths(procDate, tmtDate);
      if (tmtDate < procDate) errors.push("TMT Pensiun tidak boleh sebelum tanggal proses.");
      if (product === "pra" && paymentType === "gp") {
        gpMonths = gpManualRaw === "" ? Math.min(ppMonths, maxGpLimit) : Number(gpManualRaw);
        if (!Number.isInteger(gpMonths) || gpMonths < 0) {
          errors.push("Tenor GP manual harus berupa bilangan bulat nol atau lebih.");
        }
        if (gpManualRaw !== "" && (gpMonths > ppMonths || gpMonths > maxGpLimit)) {
          errors.push(`Tenor GP manual melampaui Tenor PP atau batas ${maxGpLimit} bulan.`);
        }
        if (gpMonths < 1) {
          errors.push("Tenor GP kurang dari 1 bulan; perhitungan simulasi belum dapat ditetapkan secara valid.");
        }
      }
    }

    if (maxCreditMonths > 0 && gpMonths >= 0) {
      pvMonths = maxCreditMonths - gpMonths;
    }
    if (pvMonths !== null && pvMonths <= 0) {
      errors.push("Tenor PV harus lebih dari 0 bulan.");
    }

    const gpManualMismatch = errors.some((e) => e.includes("Tenor GP manual") || e.includes("Tenor GP kurang"));
    const tmtValid = isPensiun ? true : Boolean(tmtDate && procDate && tmtDate >= procDate);
    const typeValid = isPensiun ? true : Boolean(paymentType);
    const canEstimate = Boolean(
      product &&
      typeValid &&
      salary > 0 &&
      pvMonths > 0 &&
      procDate &&
      tmtValid &&
      dobDate <= procDate &&
      maxCreditMonths > 0 &&
      !gpManualMismatch
    );

    if (canEstimate) {
      maxLoan = salary * 0.9 * (1 - Math.pow(1 + rate, -pvMonths)) / rate;
    }

    const paymentCap = salary * 0.9;
    const productLabel = product === "pensiun" ? "Pensiun" : product === "pra" ? "Pra Pensiun" : "-";
    const paymentTypeLabel = product === "pensiun"
      ? "Non Grace Period"
      : paymentType === "gp"
      ? "Grace Period"
      : paymentType === "non"
      ? "Non Grace Period"
      : "-";

    return {
      processable: canEstimate && errors.length === 0,
      stop_reason: errors.length > 0 ? errors.join(" ") : (!canEstimate ? "Data belum cukup untuk menetapkan hasil simulasi yang valid." : null),
      errors,
      can_estimate: canEstimate,
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      process_date: procDateStr,
      age,
      age_months: ageObj.months,
      age_limit_date: ageLimitStr,
      category: `${productLabel} / ${paymentTypeLabel}`,
      capital_product: product,
      capital_product_label: productLabel,
      capital_payment_type: paymentType,
      capital_payment_type_label: paymentTypeLabel,
      tmt_pensiun_date: isPensiun ? "" : (body.tmt_pensiun_date || body.retirement_date || ""),
      capital_gp_manual: gpManualRaw,
      coop_rate: cfg.interestRateAnnual || 10.0,
      bank_rate: cfg.interestRateAnnual || 10.0,
      salary,
      max_installment: Math.round(paymentCap),
      payment_cap: paymentCap,
      max_tenor: maxCreditMonths > 0 ? maxCreditMonths : 0,
      max_credit_months: maxCreditMonths,
      pp_months: ppMonths,
      gp_months: gpMonths,
      pv_months: pvMonths,
      max_plafond: maxLoan !== null ? Math.round(maxLoan) : 0,
      max_loan_exact: maxLoan,
      take_over: 0
    };
  }

  // 3b. Tiga Bermuda Amanah • Bank Mestika (TBA-MSTK 1.0 — DASA Group)
  if (bankKey === "bank_mestika" || cfg.engine === "mestika_tba") {
    const procDateStr = body.process_date || processDate;
    const procDate = parseIsoLocalDate(procDateStr);
    const dobDate = parseIsoLocalDate(body.birth_date);
    const ageLocal = computeAgeDetail(body.birth_date, procDateStr);
    const ageLabel = `${ageLocal.years} thn ${ageLocal.months} bln`;
    const ageDecimal = Number((ageLocal.years + ageLocal.months / 12).toFixed(2));

    const regulerMaxAge = cfg.regulerMaxAgeYears ?? 65;
    const maxEntryAge = cfg.maxEntryAgeYears ?? 69;
    const endAgeYears = cfg.maxEndAgeYears ?? 79;
    const endAgeMonths = cfg.maxEndAgeMonths ?? 11;
    const maxEndTotalMonths = endAgeYears * 12 + endAgeMonths;
    const maxTenorCap = cfg.maxTenorMonths ?? 240;
    const batasPlafond = cfg.maxPlafondAbsolute ?? 500000000;
    const dsrPct = cfg.maxInstallmentRatio ?? 99.0;
    const deductionPct = cfg.pensionDeductionPercent ?? 13.0;

    const salaryType = body.mestika_salary_type === "idpb" ? "idpb" : "pensiun";
    const salaryTypeLabel = salaryType === "idpb" ? "Sesuai Gaji IDPB" : "Sesuai Gaji Pensiun";
    const hasDependents = body.mestika_has_dependents === "ada" ? "ada" : "tidak";
    const dependentType = hasDependents === "ada" ? (body.mestika_dependent_type || "istri") : "";
    const depMap = {
      istri: "Hanya Istri",
      istri_anak_1: "Istri dan Anak 1",
      istri_anak_2: "Istri dan Anak 2",
      istri_anak_3: "Istri dan Anak 3"
    };
    const dependentLabel = hasDependents === "ada"
      ? `Ada Tanggungan (${depMap[dependentType] || "Hanya Istri"})`
      : "Tidak Ada Tanggungan";

    const errors = [];
    if (!procDate) errors.push("Tanggal Proses wajib diisi dengan tanggal valid.");
    if (!dobDate) errors.push("Tanggal Lahir wajib diisi.");
    if (dobDate && procDate && dobDate > procDate) {
      errors.push("Tanggal lahir tidak boleh setelah tanggal proses.");
    }
    if (dobDate && procDate && ageLocal.years >= maxEntryAge) {
      errors.push(`Usia calon debitur (${ageLabel}) telah mencapai ${maxEntryAge} tahun atau lebih (batas usia masuk Bank Mestika adalah di bawah ${maxEntryAge} tahun).`);
    }

    const endAgeDate = dobDate ? addMonthsClamped(dobDate, maxEndTotalMonths) : null;
    const endAgeDateStr = endAgeDate ? toIsoDateStr(endAgeDate) : "";
    const remainingAgeMonths = procDate && endAgeDate ? fullMonths(procDate, endAgeDate) : 0;
    const maxTenor = Math.max(0, Math.min(maxTenorCap, remainingAgeMonths));

    if (dobDate && procDate && maxTenor <= 0) {
      errors.push("Batas usia kredit telah tercapai; sisa tenor tidak positif.");
    }
    if (salary <= 0) {
      errors.push(salaryType === "idpb" ? "Gaji Pokok IDPB wajib diisi dan lebih dari Rp0." : "Gaji Pensiun wajib diisi dan lebih dari Rp0.");
    }

    const isReguler = ageLocal.years < regulerMaxAge;
    const productCode = isReguler ? "reguler" : "reguler_plus";
    const productLabel = isReguler ? "Reguler" : "Reguler Plus";
    const rateAnnual = isReguler ? (cfg.interestRateAnnual ?? 10.0) : (cfg.interestRatePlusAnnual ?? 12.0);
    const rateMonthly = rateAnnual / 100 / 12;

    const basicSalary = salaryType === "pensiun" ? salary * (1 - deductionPct / 100) : salary;
    const paymentCap = basicSalary * (dsrPct / 100);
    const altPlafond = maxTenor > 0 && paymentCap > 0 ? pv(rateMonthly, maxTenor, paymentCap) : 0;
    const maxPlafond = Math.min(batasPlafond, altPlafond);

    return {
      processable: errors.length === 0 && maxTenor > 0 && basicSalary > 0,
      stop_reason: errors.length > 0 ? errors.join(" ") : null,
      errors,
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      process_date: procDateStr,
      age: ageLocal.years,
      age_months: ageLocal.months,
      age_decimal: ageDecimal,
      age_label: ageLabel,
      end_age_date: endAgeDateStr,
      remaining_age_months: remainingAgeMonths,
      category: `Kredit Pensiun • ${productLabel}`,
      product_code: productCode,
      product_label: productLabel,
      salary_type: salaryType,
      salary_type_label: salaryTypeLabel,
      has_dependents: hasDependents,
      dependent_type: dependentType,
      dependent_label: dependentLabel,
      pension_deduction_pct: salaryType === "pensiun" ? deductionPct : 0,
      dsr_pct: dsrPct,
      coop_rate: rateAnnual,
      bank_rate: rateAnnual,
      salary: Math.round(basicSalary),
      salary_input: salary,
      basic_salary_exact: basicSalary,
      payment_cap_exact: paymentCap,
      max_installment: Math.round(paymentCap),
      max_tenor: maxTenor,
      batas_plafond: batasPlafond,
      alt_plafond_exact: altPlafond,
      alt_plafond: Math.round(altPlafond),
      max_plafond_exact: maxPlafond,
      max_plafond: Math.round(maxPlafond),
      take_over: takeOver
    };
  }

  // 4. Mitra Bank Konvensional (Mandiri Taspen, Bank MNC, BNI, Mestika)
  if (age >= (cfg.maxEntryAgeYears || 78)) {
    return {
      processable: false,
      stop_reason: `Usia nasabah (${age} tahun) melewati batas usia masuk ${cfg.name} (${cfg.maxEntryAgeYears} tahun).`,
      name: body.name,
      process_date: processDate,
      age
    };
  }
  const maxEndMonths = (cfg.maxEndAgeYears || 80) * 12 + (cfg.maxEndAgeMonths || 0);
  const maxTenor = Math.min(cfg.maxTenorMonths || 180, Math.max(0, maxEndMonths - ageObj.totalMonths));
  if (maxTenor < 12) {
    return {
      processable: false,
      stop_reason: `Sisa tenor berdasarkan batas usia lunas ${cfg.maxEndAgeYears} tahun kurang dari 12 bulan.`,
      name: body.name,
      process_date: processDate,
      age
    };
  }
  const maxInstallment = Math.floor(salary * ((cfg.maxInstallmentRatio || 90) / 100));
  const rateAnnual = cfg.interestRateAnnual || 12.5;
  const maxPlafond = Math.min(cfg.maxPlafondAbsolute || 300000000, Math.floor(pv(rateAnnual / 100 / 12, maxTenor, maxInstallment)));

  return {
    processable: true,
    stop_reason: null,
    bank_key: bankKey,
    bank_name: cfg.name,
    name: body.name,
    process_date: processDate,
    age,
    age_months: ageObj.months,
    category: `REGULER • ${cfg.shortName.toUpperCase()}`,
    coop_rate: rateAnnual,
    bank_rate: rateAnnual,
    salary,
    max_installment: maxInstallment,
    max_tenor: maxTenor,
    max_plafond: maxPlafond,
    take_over: takeOver
  };
}

export function calculatePreview(body, allParams) {
  const bankKey = body.bank_key || "ams2";
  const cfg = allParams[bankKey] || allParams.ams2;
  const mx = calculateMax(body, allParams);
  const plafond = Math.max(0, Number(body.plafond || mx.max_plafond || 0));
  const tenor = Math.max(1, Number(body.tenor || mx.max_tenor || 12));
  const salary = Math.max(0, Number(body.salary || 0));
  const takeOver = Math.max(0, Number(body.take_over || 0));
  const tlPct = Number(body.tata_laksana_pct ?? cfg.tataLaksanaDefault ?? 0);

  // 1. Koperasi AMS2 (Updated V2 — Tata Laksana 3.5% otomatis tersembunyi & digabung ke Biaya Provisi dan Akuisisi)
  if (bankKey === "ams2" || cfg.engine === "ams2") {
    const core = evaluateAms2Core(body, cfg);
    const principal = Math.max(0, Number(body.plafond || core.recMaxPlafon || 0));
    const n = Math.max(1, Math.floor(Number(body.tenor || core.recMaxTenor || 12)));
    const to = Math.max(0, Number(body.take_over || 0));
    const takeoverType = body.takeover_type === "yes" || to > 0 ? "yes" : "no";

    const bankRatePct = Number(cfg.bankRateAnnual ?? 12);
    const bankRate = bankRatePct / 100;
    const bankRaw = n > 0 && principal > 0 ? pmt(bankRate / 12, n, principal) : 0;
    const instRaw = core.coopRate !== null && n > 0 && principal > 0 ? pmt(core.coopRate / 12, n, principal) : 0;
    const baaRaw = Math.max(0, instRaw - bankRaw);
    const ratioPct = core.salary > 0 ? Number(((instRaw / core.salary) * 100).toFixed(2)) : 0;

    // Provisi & Akuisisi (10%) + Tata Laksana Otomatis Tersembunyi (3.5%) = 13.5%
    const proaqBasePct = Number(cfg.proaqRate ?? 10);
    const tlHiddenPct = Number(cfg.tataLaksanaDefault ?? 3.5);
    const combinedProaqPct = proaqBasePct + tlHiddenPct;
    const proaqRaw = principal * (combinedProaqPct / 100);
    const riskRaw = principal * core.riskRate;
    const adminRaw = principal > 0 ? Number(cfg.adminFee ?? 700000) : 0;
    const totalRaw = proaqRaw + riskRaw + adminRaw;
    const retMult = Number(cfg.retentionMultiplier ?? 3);
    const retRaw = instRaw * retMult;
    const netRaw = principal - totalRaw - to - retRaw;
    const remainingRaw = core.salary - instRaw;
    const end = core.at && n > 0 ? addMonthsClamped(core.at, n) : null;

    const bankInstallment = Math.round(bankRaw);
    const coopInstallment = Math.round(instRaw);
    const baa = Math.round(baaRaw);
    const proaq = Math.round(proaqRaw);
    const risk = Math.round(riskRaw);
    const adminFee = Math.round(adminRaw);
    const tlFee = 0;
    const totalFees = Math.round(totalRaw);
    const retention = Math.round(retRaw);
    const netDisbursement = Math.round(netRaw);
    const remainingSalary = Math.round(remainingRaw);

    const validations = [
      { key: "salary", label: "Gaji bulanan harus lebih dari Rp 0.", ok: core.salary > 0 },
      { key: "plafond", label: "Plafon maksimal Rp 250.000.000.", ok: principal > 0 && principal <= core.maxPlafondAbs },
      { key: "tenor", label: "Tenor maksimal 120 bulan.", ok: n > 0 && n <= core.maxTenorCap },
      { key: "age_cat", label: "Debitur masuk salah satu kategori usia produk.", ok: core.coopRate !== null },
      { key: "ratio", label: "Angsuran koperasi tidak melebihi 95% gaji.", ok: instRaw <= core.cap && instRaw > 0 },
      { key: "end_age", label: "Usia jatuh tempo tidak melebihi 84 tahun 10 bulan.", ok: !!(end && core.finalLimit && end <= core.finalLimit) },
      { key: "net", label: "Pencairan bersih bernilai positif.", ok: netRaw > 0 }
    ];
    const overallOk = validations.every((v) => v.ok);
    const issues = validations.filter((v) => !v.ok).map((v) => v.label);

    return {
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      birth_date: body.birth_date,
      process_date: core.processDate,
      age: core.age,
      category: core.categoryLabel,
      plafond: principal,
      tenor: n,
      bank_rate: bankRatePct,
      coop_rate: core.coopRatePct,
      salary: core.salary,
      take_over: to,
      tata_laksana_pct: tlHiddenPct,
      bank_installment: bankInstallment,
      coop_installment: coopInstallment,
      baa,
      ratio_pct: ratioPct,
      proaq_pct: combinedProaqPct,
      proaq,
      risk_pct: core.riskRatePct,
      risk,
      admin_fee: adminFee,
      tata_laksana_fee: tlFee,
      total_fees: totalFees,
      retention_multiplier: retMult,
      retention,
      net_disbursement: netDisbursement,
      remaining_salary: remainingSalary,
      ams2_details: {
        category_label: core.categoryLabel,
        age_label: `${core.age} tahun`,
        takeover_type: takeoverType,
        takeover_label: takeoverType === "yes" ? "Take Over" : "Non Take Over",
        rec_max_tenor: core.recMaxTenor,
        rec_max_plafond: core.recMaxPlafon,
        max_plafond_full_tenor: core.maxPlafondAtMaxTenor,
        effective_tenor: core.effectiveTenor,
        cap_95: Math.round(core.cap),
        end_date: end ? toIsoDateStr(end) : "",
        final_limit_date: core.finalLimit ? toIsoDateStr(core.finalLimit) : "",
        pic: String(body.pic || cfg.picDefault || "MUHAMMAD TEGUH PRANADA").trim(),
        sales_manager: String(body.sales_manager || "-").trim() || "-",
        sales_manager_hp: String(body.sales_manager_hp || "").trim(),
        marketing: String(body.marketing || "-").trim() || "-",
        marketing_hp: String(body.marketing_hp || "").trim()
      },
      validations,
      overall_ok: overallOk,
      issues
    };
  }

  // 2. BSI Mitraguna Prima+ Prapensiun + Simas Jiwa (Resmi NOS v1.4.6 + Simas Prapensiun)
  if (bankKey === "bsi_prapen" || cfg.engine === "bsi_simas") {
    const core = evaluateBsiCore(body, cfg, mx.process_date);
    const nip = body.nip || "";
    const tmtBekerja = body.bsi_tmt_bekerja || "";
    const minPlafondAbs = Number(cfg.minPlafondAbsolute) || 10000000;
    const maxPlafondAbs = Number(cfg.maxPlafondAbsolute) || 800000000;
    const maxTenorMonths = Number(cfg.maxTenorMonths) || 180;

    const rawTenorInput = Number(body.tenor || mx.max_tenor || 180);
    const okTenorInput = Number.isInteger(rawTenorInput) && rawTenorInput >= 1 && rawTenorInput <= maxTenorMonths;
    const requestedTenor = okTenorInput ? rawTenorInput : Math.max(1, Math.floor(rawTenorInput || 180));

    const maxActiveMonthsLimit = core.subProduct === "PP3" ? 36 : 120;
    const okActiveWindow = core.actualMonthsToBup >= 1 && core.actualMonthsToBup <= maxActiveMonthsLimit;
    const activeMonths = core.actualMonthsToBup > 0 ? Math.min(requestedTenor, core.actualMonthsToBup) : 0;
    const pensionMonths = Math.max(0, requestedTenor - activeMonths);

    const requestedPlafond = Math.max(0, Number(body.plafond || mx.max_plafond || 0));
    const pricing = resolveBsiBasePricing(requestedPlafond, core.subProduct, cfg, body);
    let baseRateAktifAnnual = pricing.baseRateAktifAnnual;
    let baseRatePensiunAnnual = pricing.baseRatePensiunAnnual;

    const insuranceBufferMonths = body.bsi_insurance_buffer_months !== undefined && body.bsi_insurance_buffer_months !== null
      ? Number(body.bsi_insurance_buffer_months)
      : 6;
    const insuranceMonths = body.bsi_insurance_months !== undefined && body.bsi_insurance_months !== null
      ? Number(body.bsi_insurance_months)
      : (requestedTenor + insuranceBufferMonths);
    const discountPercent = Number(body.bsi_discount_pct ?? 0);
    const extraEmPercent = Number(body.bsi_extra_em_pct ?? 0);

    const initialSimas = computeSimasInsurance(requestedPlafond, body.birth_date, requestedTenor, cfg.simasInsurance, {
      processDateIso: core.processDateStr,
      nearestAge: core.nearestAge,
      insuranceMonths,
      isAtribusi: core.isAtribusi,
      discountPercent,
      extraEmPercent
    });

    const manualInsuranceOverride = Math.max(0, Number(body.bsi_manual_insurance || 0));
    const initialNominalAtribusi = !core.isAtribusi
      ? 0
      : (manualInsuranceOverride > 0 ? manualInsuranceOverride : initialSimas.total_kontribusi);

    const maxPlafondAtTenor = computeBsiCandidateMaxPlafond({
      subProduct: core.subProduct,
      isAtribusi: core.isAtribusi,
      baseRateAktifAnnual,
      baseRatePensiunAnnual,
      akseptasiAktif: core.maxInstallmentActive,
      akseptasiPensiun: core.maxInstallmentPension,
      tenorAktif: activeMonths,
      tenorPensiun: pensionMonths,
      requestedTenor,
      nominalAtribusi: initialNominalAtribusi,
      cfg
    });

    // Untuk simulasi preview interaktif: gunakan requestedPlafond untuk menguji kelayakan pengajuan nasabah,
    // tetapi tetap hitung ulang premi bila menggunakan mode cap atau perubahan tier
    const evalPlafond = requestedPlafond;
    const simas = initialSimas;
    const nominalAtribusi = !core.isAtribusi
      ? 0
      : (manualInsuranceOverride > 0 ? manualInsuranceOverride : simas.total_kontribusi);
    const atribusiPerBulan = requestedTenor > 0 ? nominalAtribusi / requestedTenor : 0;

    // Jalur Jadwal Final PP10 (V3:V15) & PP3 (V3:V17)
    let angsuranAktifRaw = 0;
    let angsuranPensiunRaw = 0;
    let priceAtribAktif = baseRateAktifAnnual / 100;
    let priceAtribPensiun = baseRatePensiunAnnual / 100;
    let sisaOsSaatPensiunRaw = 0;
    const fullSchedule = [];
    let overpaymentDetected = false;

    if (evalPlafond > 0 && requestedTenor > 0 && activeMonths > 0) {
      if (core.subProduct === "PP3") {
        const pokokAktifTetap = Number(cfg.atribusiAdjustments?.pp3PokokTetapAktif) || 10000;
        const v3MarginAktifBln = evalPlafond * (baseRateAktifAnnual / 100) / 12;
        const v4AtribBln = atribusiPerBulan;
        priceAtribAktif = ((v3MarginAktifBln + v4AtribBln) / evalPlafond) * 12;
        angsuranAktifRaw = pokokAktifTetap + v3MarginAktifBln + v4AtribBln;
      } else {
        const v3MarginAktifBln = evalPlafond * (baseRateAktifAnnual / 100) / 12;
        const v4AtribBln = atribusiPerBulan;
        const extraActiveAdd = atribusiPerBulan > 0
          ? ((Number(cfg.atribusiAdjustments?.pp10AtribExtraActive) || 1.0) / 100)
          : 0;
        priceAtribAktif = ((v3MarginAktifBln + v4AtribBln) / evalPlafond) * 12 + extraActiveAdd;
        angsuranAktifRaw = core.maxInstallmentActive;
      }

      let currentOs = evalPlafond;
      for (let m = 1; m <= activeMonths; m++) {
        if (currentOs <= 1e-6) {
          overpaymentDetected = true;
          break;
        }
        const openingOs = currentOs;
        const marginBln = openingOs * (priceAtribAktif / 12);
        let pokokBln = angsuranAktifRaw - marginBln;
        let installmentBln = angsuranAktifRaw;

        if (pokokBln <= 0) overpaymentDetected = true;
        if (pokokBln > openingOs + 1e-6) {
          if (m < requestedTenor) overpaymentDetected = true;
          pokokBln = openingOs;
          installmentBln = openingOs + marginBln;
          currentOs = 0;
        } else {
          currentOs = openingOs - pokokBln;
        }

        const openingRounded = Math.round(openingOs);
        const closingRounded = Math.round(currentOs);
        fullSchedule.push({
          month: m,
          phase: "Masa Aktif",
          openingOs: openingRounded,
          principalPayment: openingRounded - closingRounded,
          marginPayment: Math.round(marginBln),
          totalInstallment: Math.round(installmentBln),
          closingOs: closingRounded
        });
      }

      sisaOsSaatPensiunRaw = currentOs;

      if (pensionMonths > 0) {
        if (sisaOsSaatPensiunRaw <= 1e-6) {
          overpaymentDetected = true;
        } else {
          if (core.subProduct === "PP3") {
            const v10SisaOs = sisaOsSaatPensiunRaw;
            const v11AtribBln = atribusiPerBulan;
            const v12BasePenRate = baseRatePensiunAnnual / 100;
            const v13TenorPen = pensionMonths;
            const v14BasePmt = pmtWithFv(v12BasePenRate / 12, v13TenorPen, v10SisaOs, 0);
            const v15CombinedPmt = v11AtribBln + v14BasePmt;
            const rawAnnualPenRate = excelRate(v13TenorPen, -v15CombinedPmt, v10SisaOs) * 12;
            const roundedPenRate = v11AtribBln > 0 ? roundHalfUp(rawAnnualPenRate, 4) : rawAnnualPenRate;
            const penAdd = nominalAtribusi > 0
              ? ((Number(cfg.atribusiAdjustments?.pp10PensionRateAdd) || 1.0) / 100)
              : 0;
            priceAtribPensiun = roundedPenRate + penAdd;
            angsuranPensiunRaw = pmtWithFv(priceAtribPensiun / 12, v13TenorPen, v10SisaOs, 0);
          } else {
            const v12MarginPenBln = sisaOsSaatPensiunRaw * (baseRatePensiunAnnual / 100) / 12;
            const v13AtribBln = atribusiPerBulan;
            priceAtribPensiun = ((v12MarginPenBln + v13AtribBln) / sisaOsSaatPensiunRaw) * 12;
            angsuranPensiunRaw = pmtWithFv(priceAtribPensiun / 12, pensionMonths, sisaOsSaatPensiunRaw, 0);
          }

          let penOs = sisaOsSaatPensiunRaw;
          for (let m = activeMonths + 1; m <= requestedTenor; m++) {
            if (penOs <= 1e-6) {
              overpaymentDetected = true;
              break;
            }
            const openingOs = penOs;
            const marginBln = openingOs * (priceAtribPensiun / 12);
            let pokokBln = angsuranPensiunRaw - marginBln;
            let installmentBln = angsuranPensiunRaw;

            if (m === requestedTenor || pokokBln > openingOs + 1e-6) {
              if (m < requestedTenor && pokokBln > openingOs + 1e-2) overpaymentDetected = true;
              pokokBln = openingOs;
              installmentBln = openingOs + marginBln;
              penOs = 0;
            } else {
              penOs = openingOs - pokokBln;
            }

            const openingRounded = Math.round(openingOs);
            const closingRounded = Math.round(penOs);
            fullSchedule.push({
              month: m,
              phase: "Masa Pensiun",
              openingOs: openingRounded,
              principalPayment: openingRounded - closingRounded,
              marginPayment: Math.round(marginBln),
              totalInstallment: Math.round(installmentBln),
              closingOs: closingRounded
            });
          }
        }
      }
    }

    const schedulePreview = fullSchedule.filter(
      (row) =>
        row.month <= 6 ||
        row.month === activeMonths ||
        row.month === activeMonths + 1 ||
        row.month === requestedTenor
    );

    const activeInstallment = Math.round(angsuranAktifRaw);
    const pensionInstallment = Math.round(angsuranPensiunRaw);
    const sisaOsSaatPensiun = Math.round(sisaOsSaatPensiunRaw);
    const priceAtribAktifPct = roundHalfUp(priceAtribAktif * 100, 2);
    const priceAtribPensiunPct = roundHalfUp(priceAtribPensiun * 100, 2);

    // Jadwal Proyeksi Cair, Start Angsuran, & Selesai Angsuran (Sheet Akseptasi B24:E26)
    const defaultCairDate = new Date(core.procDate.getTime() + 7 * 86400000);
    const cairDateObj = parseIsoLocalDate(body.bsi_proyeksi_cair) || defaultCairDate;
    const cairDateStr = toIsoDateStr(cairDateObj);

    const defaultStartAngsDate = new Date(cairDateObj.getFullYear(), cairDateObj.getMonth() + 1, 1);
    const startAngsuranDate = parseIsoLocalDate(body.bsi_start_angsuran) || defaultStartAngsDate;
    const startAngsuranStr = toIsoDateStr(startAngsuranDate);

    const selesaiAngsuranDate = addMonthsClamped(startAngsuranDate, Math.max(0, requestedTenor - 1));
    const selesaiAngsuranStr = toIsoDateStr(selesaiAngsuranDate);
    const endLoanAgeDetail = computeAgeDetail(body.birth_date, selesaiAngsuranStr);

    // Biaya, Blokir per Produk (F10), Pelunasan & Buka Blokir Lama (F15)
    const adminFeeRaw = evalPlafond * ((Number(cfg.fees?.adminRatePercent) || 1.0) / 100);
    const adminFee = Math.round(adminFeeRaw);
    const materaiFee = evalPlafond > 0 ? (Number(cfg.fees?.materaiFee) || 100000) : 0;
    const insuranceDeductionRaw = core.isAtribusi ? 0 : (simas.raw?.totalKontribusi ?? simas.total_kontribusi);
    const insuranceDeduction = core.isAtribusi ? 0 : simas.total_kontribusi;
    const totalFeesRaw = adminFeeRaw + materaiFee + insuranceDeductionRaw;
    const totalFees = adminFee + materaiFee + insuranceDeduction;

    const blokirActiveCount = core.subProduct === "PP3" ? activeMonths : (Number(cfg.fees?.blokirActiveCount) || 1);
    const blokirPensionCount = pensionMonths > 0 ? (Number(cfg.fees?.blokirPensionCount) || 2) : 0;
    const blokirAktifRaw = angsuranAktifRaw * blokirActiveCount;
    const blokirAktif = Math.round(blokirAktifRaw);
    const blokirPensiunRaw = angsuranPensiunRaw * blokirPensionCount;
    const blokirPensiun = Math.round(blokirPensiunRaw);
    const retentionRaw = blokirAktifRaw + blokirPensiunRaw;
    const retention = Math.round(retentionRaw);

    const pelunasanLama = Math.max(0, Number(body.pelunasan_lama ?? body.take_over ?? 0) || 0);
    const bukaBlokirLama = Math.max(0, Number(body.buka_blokir_lama ?? 0) || 0);

    const netDisbursementRaw = evalPlafond - totalFeesRaw - retentionRaw - pelunasanLama + bukaBlokirLama;
    const netDisbursement = Math.round(netDisbursementRaw);

    const ratioActivePct = core.recognizedSalary > 0
      ? Number((((angsuranAktifRaw + core.existingInstallment) / core.recognizedSalary) * 100).toFixed(2))
      : 0;
    const ratioPensionPct = core.pensionSalary > 0
      ? Number(((angsuranPensiunRaw / core.pensionSalary) * 100).toFixed(2))
      : (pensionMonths > 0 ? 100 : 0);
    const remainingSalary = Math.round(core.recognizedSalary - angsuranAktifRaw);
    const sisaGajiPensiun = Math.round(core.pensionSalary - angsuranPensiunRaw);
    const taksasiMmq = evalPlafond > 0
      ? Math.ceil((evalPlafond * (1 + (Number(cfg.fees?.taksasiMmqMarkupPercent) || 2.0) / 100)) / 1000000) * 1000000
      : 0;

    const subProductLabel = core.subProduct === "PP3" ? "Tri Berkah (Prapen 3 Tahun)" : "Dekade Berkah (Prapen 10 Tahun)";
    const statusGajiLabel = core.payrollInfo.label;

    const okBenefitInput = pensionMonths === 0 || core.pensionSalary > 0;
    const okSchedule = Boolean(!overpaymentDetected && requestedTenor > 0 && fullSchedule.length === requestedTenor);
    const validations = [
      {
        key: "age",
        label: `Usia Nearest Birthday Simas 45–65 thn (Saat ini: ${core.nearestAge} thn)`,
        ok: core.nearestAge >= 45 && core.nearestAge <= 65
      },
      {
        key: "end_age",
        label: `Usia jatuh tempo ≤ ${cfg.maxEndAgeYears} thn ${cfg.maxEndAgeMonths} bln (Maks tenor ${core.maxTenor} bln)`,
        ok: okTenorInput && requestedTenor <= core.maxTenor
      },
      {
        key: "active_tenor",
        label: `Jendela Masa Aktif ${subProductLabel} 1–${maxActiveMonthsLimit} bln (Aktual ke BUP: ${core.actualMonthsToBup} bln)`,
        ok: okActiveWindow
      },
      {
        key: "plafond",
        label: `Plafond Rp${(minPlafondAbs / 1e6).toFixed(0)} Juta s.d. Maks Kapasitas Rp${maxPlafondAtTenor.toLocaleString("id-ID")}`,
        ok: evalPlafond >= minPlafondAbs && evalPlafond <= maxPlafondAtTenor && evalPlafond <= maxPlafondAbs
      },
      {
        key: "dbr_active",
        label: `DBR Masa Aktif (${statusGajiLabel}) ≤ ${core.dbrActiveRate}% (Aktual: ${ratioActivePct}%)`,
        ok: core.payrollInfo.valid && angsuranAktifRaw <= core.maxInstallmentActive + 1 && ratioActivePct <= core.dbrActiveRate + 0.1
      },
      {
        key: "dsr_pension",
        label: `DSR Masa Pensiun ≤ ${core.dsrPensionRate}% Manfaat Pensiun (Aktual: ${ratioPensionPct}%)`,
        ok: pensionMonths === 0 || (okBenefitInput && angsuranPensiunRaw <= core.maxInstallmentPension + 1 && ratioPensionPct <= core.dsrPensionRate + 0.1)
      },
      {
        key: "simas",
        label: `Asuransi Jiwa Simas Prapensiun (${simas.medical_status})`,
        ok: Boolean(simas.valid)
      },
      {
        key: "schedule",
        label: "Jadwal Amortisasi Pokok & Margin Berkesinambungan Penuh",
        ok: okSchedule
      },
      {
        key: "net",
        label: "Terima Bersih Nasabah Positif (≥ Rp0)",
        ok: netDisbursementRaw >= 0 && netDisbursement >= 0
      }
    ];
    const overallOk = validations.every((v) => v.ok);
    validations.push({ key: "overall", label: "Status Kelayakan Akhir BSI NOS v1.4.6 + Simas Jiwa", ok: overallOk });
    const issues = validations.filter((v) => !v.ok && v.key !== "overall").map((v) => `Ketentuan BSI/Simas tidak terpenuhi: ${v.label}`);

    return {
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      nip,
      birth_date: body.birth_date,
      process_date: core.processDateStr,
      age: core.ageObj.years,
      category: `${subProductLabel} • ${statusGajiLabel} • ${core.akad} (${core.skema})`,
      plafond: evalPlafond,
      tenor: requestedTenor,
      bank_rate: baseRateAktifAnnual,
      coop_rate: baseRatePensiunAnnual,
      salary: core.recognizedSalary,
      salary_raw: salary,
      pension_salary: core.pensionSalary,
      take_over: pelunasanLama,
      buka_blokir_lama: bukaBlokirLama,
      tata_laksana_pct: 0,
      bank_installment: activeInstallment,
      coop_installment: pensionInstallment,
      baa: Math.abs(pensionInstallment - activeInstallment),
      ratio_pct: ratioActivePct,
      ratio_pension_pct: ratioPensionPct,
      proaq_pct: cfg.fees?.adminRatePercent || 1.0,
      proaq: adminFee,
      risk_pct: core.isAtribusi ? 0 : Number((simas.rate_permil / 10).toFixed(2)),
      risk: insuranceDeduction,
      admin_fee: materaiFee,
      tata_laksana_fee: 0,
      total_fees: totalFees,
      retention_multiplier: blokirActiveCount + blokirPensionCount,
      retention,
      net_disbursement: netDisbursement,
      remaining_salary: remainingSalary,
      bsi_details: {
        status_gaji: core.payrollInfo.key,
        status_gaji_code: core.payrollInfo.code,
        status_gaji_label: statusGajiLabel,
        sub_product: core.subProduct,
        sub_product_label: subProductLabel,
        akad: core.akad,
        skema: core.skema,
        is_atribusi: core.isAtribusi,
        bup_age: core.bupAge,
        bup_year: core.targetBupYear,
        bup_date: core.bupDateStr,
        actual_months_to_bup: core.actualMonthsToBup,
        recommended_sub_product: core.recommendedSubProduct,
        recommended_sub_product_reason: core.recommendedSubProductReason,
        age_exact_text: core.ageObj.exactText,
        nearest_age: core.nearestAge,
        end_loan_age_text: endLoanAgeDetail.exactText,
        tmt_bekerja: tmtBekerja,
        nip,
        tht: core.tht,
        tht_recognized: core.thtRecognized,
        gaji_pokok: core.gp,
        uang_makan: core.um,
        tunjangan_rutin_1: core.tr1,
        tunjangan_rutin_3: core.tr3,
        tunjangan_lain_1: core.tl1,
        angsuran_bsi: core.angsuranBsi,
        angsuran_selain_bsi: core.angsuranSelainBsi,
        active_months: activeMonths,
        pension_months: pensionMonths,
        base_rate_aktif: baseRateAktifAnnual,
        base_rate_pensiun: baseRatePensiunAnnual,
        price_atrib_aktif_pct: priceAtribAktifPct,
        price_atrib_pensiun_pct: priceAtribPensiunPct,
        margin_aktif: priceAtribAktifPct,
        margin_pensiun: priceAtribPensiunPct,
        max_plafond_at_tenor: maxPlafondAtTenor,
        max_installment_active: core.maxInstallmentActive,
        max_installment_pension: core.maxInstallmentPension,
        active_installment: activeInstallment,
        active_installment_exact: angsuranAktifRaw,
        pension_installment: pensionInstallment,
        pension_installment_exact: angsuranPensiunRaw,
        sisa_os_saat_pensiun: sisaOsSaatPensiun,
        sisa_os_saat_pensiun_exact: sisaOsSaatPensiunRaw,
        sisa_gaji_pensiun: sisaGajiPensiun,
        sisa_gaji_aktif: remainingSalary,
        biaya_adm: adminFee,
        biaya_adm_exact: adminFeeRaw,
        biaya_adm_pct: cfg.fees?.adminRatePercent || 1.0,
        biaya_asuransi: insuranceDeduction,
        biaya_asuransi_exact: insuranceDeductionRaw,
        premi_asuransi_tertanggung: nominalAtribusi || simas.total_kontribusi,
        atribusi_per_bulan: Math.round(atribusiPerBulan),
        atribusi_per_bulan_exact: atribusiPerBulan,
        biaya_materai: materaiFee,
        biaya_materai_exact: materaiFee,
        blokir_active_count: blokirActiveCount,
        blokir_pension_count: blokirPensionCount,
        blokir_aktif: blokirAktif,
        blokir_aktif_exact: blokirAktifRaw,
        blokir_pensiun: blokirPensiun,
        blokir_pensiun_exact: blokirPensiunRaw,
        blokir_angsuran: retention,
        blokir_angsuran_exact: retentionRaw,
        pelunasan_lama: pelunasanLama,
        pelunasan_lama_exact: pelunasanLama,
        buka_blokir_lama: bukaBlokirLama,
        buka_blokir_lama_exact: bukaBlokirLama,
        sisa_pencairan_bersih: netDisbursement,
        sisa_pencairan_bersih_exact: netDisbursementRaw,
        taksasi_mmq: taksasiMmq,
        proyeksi_cair: cairDateStr,
        start_angsuran: startAngsuranStr,
        selesai_angsuran: selesaiAngsuranStr,
        dbr_active_rate: core.dbrActiveRate,
        dsr_pension_rate: core.dsrPensionRate,
        simas,
        schedule_preview: schedulePreview,
        schedule_summary: {
          total_months: fullSchedule.length,
          early_payoff: overpaymentDetected,
          sisa_os_transisi: sisaOsSaatPensiun
        }
      },
      validations,
      overall_ok: overallOk,
      issues
    };
  }

  // 3. Calc Capital — PS3 CAPITAL (DASA CIPTA BERKARYA)
  if (bankKey === "bank_capital" || cfg.engine === "capital_ps3") {
    const procDateStr = body.process_date || mx.process_date;
    const procDate = parseIsoLocalDate(procDateStr);
    const dobDate = parseIsoLocalDate(body.birth_date);
    const tmtDate = parseIsoLocalDate(body.tmt_pensiun_date || body.retirement_date);
    const product = body.capital_product || ""; // 'pra' | 'pensiun'
    const isPensiun = product === "pensiun";
    const paymentType = isPensiun ? "non" : (body.capital_payment_type || ""); // 'gp' | 'non'
    const rate = (cfg.interestRateAnnual || 10.0) / 100 / 12;
    const adminFeeAdj = cfg.adminFee ?? 1000000;

    const amountRaw = body.plafond !== undefined && body.plafond !== null ? String(body.plafond).trim() : "";
    const amountProvided = amountRaw !== "" && Number(body.plafond) > 0;
    const requestedAmount = amountProvided ? Number(body.plafond) : 0;

    const tenorRaw = body.tenor !== undefined && body.tenor !== null ? String(body.tenor).trim() : "";
    const tenorProvided = tenorRaw !== "" && Number(body.tenor) > 0;
    const requestedTenor = tenorProvided ? Number(body.tenor) : 0;

    const rawErrors = [...(mx.errors || [])];
    if (!body.name || !String(body.name).trim()) rawErrors.push("Nama Debitur wajib diisi.");
    if (!dobDate) rawErrors.push("Tanggal Lahir wajib diisi.");
    if (!salary || salary <= 0) rawErrors.push("Gaji Bulanan wajib diisi dan harus lebih dari Rp0.");
    if (!product) rawErrors.push("Produk Kredit wajib dipilih.");
    if (product === "pra" && !paymentType) rawErrors.push("Tipe Angsuran wajib dipilih untuk Pra Pensiun.");
    if (!procDate) rawErrors.push("Tanggal Proses wajib diisi dengan tanggal valid.");
    if (product === "pra" && !tmtDate) rawErrors.push("TMT Pensiun wajib diisi untuk produk Pra Pensiun.");
    const errors = Array.from(new Set(rawErrors));

    const creditMonths = tenorProvided ? requestedTenor : (mx.max_credit_months || 0);
    const warnings = [];
    if (creditMonths > (mx.max_credit_months || 0) && (mx.max_credit_months || 0) > 0) {
      warnings.push("Tenor yang diajukan melebihi tenor maksimal berdasarkan batas usia kredit. Nilai pengajuan tetap digunakan dalam perhitungan.");
    }

    const gpMonths = isPensiun ? 0 : (mx.gp_months || 0);
    const ppMonths = isPensiun ? 0 : (mx.pp_months ?? 0);
    const pvMonths = product === "pra" && paymentType === "gp"
      ? creditMonths - gpMonths
      : creditMonths;

    if (pvMonths <= 0) {
      errors.push("Tenor pengajuan menghasilkan Tenor PV nol atau negatif; simulasi belum dapat ditetapkan.");
    }

    const maxLoan = pvMonths > 0 ? (salary * 0.9 * (1 - Math.pow(1 + rate, -pvMonths)) / rate) : 0;
    const recommendationMaxLoan = mx.max_loan_exact ?? maxLoan;
    const loan = amountProvided ? requestedAmount : maxLoan;
    const regularMonths = pvMonths;
    const actualPayment = regularMonths > 0 ? pmt(rate, regularMonths, loan) : 0;
    const cap = salary * 0.9;
    const paymentWithinCap = actualPayment <= cap + 1e-8;
    const loanWithinMax = loan <= maxLoan + 1e-8;

    if (!paymentWithinCap) warnings.push("Angsuran Aktual melebihi batas maksimal 90% dari Gaji Bulanan.");
    if (!loanWithinMax) warnings.push("Plafond pengajuan melebihi Plafond Maksimal berdasarkan parameter yang ditetapkan.");

    const costRate = isPensiun
      ? ((cfg.costRatePensiunPercent || 21.0) / 100)
      : ((cfg.costRatePraPercent || 20.0) / 100);
    const cost = loan * costRate + adminFeeAdj;

    let r1 = 0;
    let r2 = 0;
    let r3 = 0;
    let retDays = 0;
    const r4 = 2 * actualPayment;

    if (!isPensiun) {
      if (paymentType === "gp") {
        r1 = loan * rate * (gpMonths - 1);
        r2 = ppMonths > gpMonths ? actualPayment * (ppMonths - gpMonths) : 0;
      } else {
        r1 = actualPayment * ppMonths;
      }
      const dayResult = procDate && tmtDate ? retentionDays(procDate, tmtDate) : { days: 0, error: "Tanggal tidak valid." };
      if (dayResult.error) errors.push(dayResult.error);
      retDays = dayResult.days || 0;
      r3 = loan * ((cfg.interestRateAnnual || 10.0) / 100) * retDays / 360;
    }

    // Untuk produk Pensiun: Retensi murni 2x angsuran saja (R1=0, R2=0, R3=0, R4=2xPMT)
    const totalRetention = r1 + r2 + r3 + r4;
    const netCash = loan - cost - totalRetention;
    const salaryLeft = salary - actualPayment;

    if (netCash < 0) warnings.push("Pencairan Bersih negatif; hasil ini tidak menghasilkan pencairan positif.");
    if (salaryLeft < 0) warnings.push("Sisa Gaji Setelah Angsuran negatif.");

    const ratioPct = salary > 0 ? Number(((actualPayment / salary) * 100).toFixed(2)) : 0;
    const productLabel = product === "pensiun" ? "Pensiun" : "Pra Pensiun";
    const paymentTypeLabel = product === "pensiun"
      ? "Non Grace Period"
      : paymentType === "gp"
      ? "Grace Period"
      : "Non Grace Period";

    const validations = [
      { key: "input_valid", label: "Data input & tanggal valid", ok: errors.length === 0 },
      { key: "tenor_max", label: `Tenor kredit ≤ ${mx.max_credit_months || 0} bulan`, ok: creditMonths <= (mx.max_credit_months || 0) && pvMonths > 0 },
      { key: "plafond_max", label: "Plafon pengajuan ≤ Plafon Maksimal", ok: loanWithinMax },
      { key: "payment_cap", label: "Angsuran Aktual ≤ 90% Gaji Bulanan", ok: paymentWithinCap },
      { key: "net_cash", label: "Pencairan Bersih positif (> Rp0)", ok: netCash >= 0 },
      { key: "salary_left", label: "Sisa Gaji Setelah Angsuran positif", ok: salaryLeft >= 0 }
    ];
    const overallOk = errors.length === 0 && warnings.length === 0;
    validations.push({ key: "overall", label: "Status Simulasi PS3 CAPITAL", ok: overallOk });
    const issues = [...errors, ...warnings];

    return {
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      birth_date: body.birth_date,
      process_date: procDateStr,
      age: mx.age,
      category: `${productLabel} / ${paymentTypeLabel}`,
      plafond: Math.round(loan),
      tenor: creditMonths,
      bank_rate: cfg.interestRateAnnual || 10.0,
      coop_rate: cfg.interestRateAnnual || 10.0,
      salary,
      take_over: 0,
      tata_laksana_pct: 0,
      bank_installment: Math.round(actualPayment),
      coop_installment: Math.round(actualPayment),
      baa: 0,
      ratio_pct: ratioPct,
      proaq_pct: Number((costRate * 100).toFixed(0)),
      proaq: Math.round(loan * costRate),
      risk_pct: 0,
      risk: 0,
      admin_fee: adminFeeAdj,
      tata_laksana_fee: 0,
      total_fees: Math.round(cost),
      retention_multiplier: 2,
      retention: Math.round(totalRetention),
      net_disbursement: Math.round(netCash),
      remaining_salary: Math.round(salaryLeft),
      capital_details: {
        product,
        product_label: productLabel,
        payment_type: paymentType,
        payment_type_label: paymentTypeLabel,
        product_and_type_label: `${productLabel} / ${paymentTypeLabel}`,
        tmt_pensiun_date: isPensiun ? "" : (body.tmt_pensiun_date || body.retirement_date || ""),
        process_date: procDateStr,
        age_limit_date: mx.age_limit_date || "",
        credit_months: creditMonths,
        max_credit_months: mx.max_credit_months || 0,
        pp_months: ppMonths,
        gp_months: gpMonths,
        pv_months: pvMonths,
        rec_pv_months: mx.pv_months || 0,
        payment_cap: Math.round(cap),
        recommendation_max_loan: Math.round(recommendationMaxLoan),
        max_loan_pv: Math.round(maxLoan),
        loan: Math.round(loan),
        amount_provided: amountProvided,
        tenor_provided: tenorProvided,
        actual_payment: Math.round(actualPayment),
        cost_rate_pct: Math.round(costRate * 100),
        cost: Math.round(cost),
        r1: Math.round(r1),
        r2: Math.round(r2),
        r3: Math.round(r3),
        r4: Math.round(r4),
        retention_days: retDays,
        total_retention: Math.round(totalRetention),
        net_cash: Math.round(netCash),
        salary_left: Math.round(salaryLeft),
        warnings,
        errors
      },
      validations,
      overall_ok: overallOk,
      issues
    };
  }

  // 3b. Tiga Bermuda Amanah • Bank Mestika (TBA-MSTK 1.0 — DASA Group)
  if (bankKey === "bank_mestika" || cfg.engine === "mestika_tba") {
    const procDateStr = body.process_date || mx.process_date;
    const procDate = parseIsoLocalDate(procDateStr);
    const dobDate = parseIsoLocalDate(body.birth_date);

    const amountRaw = body.plafond !== undefined && body.plafond !== null ? String(body.plafond).trim() : "";
    const amountProvided = amountRaw !== "" && Number(body.plafond) > 0;
    const requestedAmount = amountProvided ? Number(body.plafond) : 0;

    const tenorRaw = body.tenor !== undefined && body.tenor !== null ? String(body.tenor).trim() : "";
    const tenorProvided = tenorRaw !== "" && Number(body.tenor) > 0;
    const requestedTenor = tenorProvided ? Number(body.tenor) : 0;

    const rawErrors = [...(mx.errors || [])];
    if (!body.name || !String(body.name).trim()) rawErrors.push("Nama Debitur wajib diisi.");
    if (!dobDate) rawErrors.push("Tanggal Lahir wajib diisi.");
    if (!procDate) rawErrors.push("Tanggal Proses wajib diisi dengan tanggal valid.");
    if (!salary || salary <= 0) {
      rawErrors.push(mx.salary_type === "idpb" ? "Gaji Pokok IDPB wajib diisi dan lebih dari Rp0." : "Gaji Pensiun wajib diisi dan lebih dari Rp0.");
    }
    const errors = Array.from(new Set(rawErrors));

    const maxTenor = mx.max_tenor || 0;
    const creditMonths = tenorProvided ? requestedTenor : maxTenor;
    const rateAnnual = mx.bank_rate || (cfg.interestRateAnnual ?? 10.0);
    const rateMonthly = rateAnnual / 100 / 12;
    const batasPlafond = cfg.maxPlafondAbsolute ?? 500000000;
    const basicSalary = mx.basic_salary_exact ?? mx.salary ?? salary;
    const paymentCap = mx.payment_cap_exact ?? (basicSalary * ((cfg.maxInstallmentRatio ?? 99.0) / 100));

    const altPlafondAtTenor = creditMonths > 0 && paymentCap > 0 ? pv(rateMonthly, creditMonths, paymentCap) : 0;
    const maxPlafondAtTenor = Math.min(batasPlafond, altPlafondAtTenor);
    const loan = amountProvided ? requestedAmount : maxPlafondAtTenor;
    const actualPayment = creditMonths > 0 && loan > 0 ? pmt(rateMonthly, creditMonths, loan) : 0;

    const costRatePct = cfg.disbursementCostPercent ?? cfg.provisionRatePercent ?? 22.0;
    const cost = loan * (costRatePct / 100);
    const retMult = cfg.retentionMultiplier ?? 3;
    const retentionAmt = retMult * actualPayment;
    const netCash = loan - cost - retentionAmt - takeOver;
    const salaryLeftBasic = basicSalary - actualPayment;
    const salaryLeftPension = salary - actualPayment;
    const ratioPct = basicSalary > 0 ? Number(((actualPayment / basicSalary) * 100).toFixed(2)) : 0;

    const warnings = [];
    if (creditMonths > maxTenor && maxTenor > 0) {
      warnings.push(`Tenor pengajuan (${creditMonths} bulan) melebihi Maksimal Tenor (${maxTenor} bulan).`);
    }
    if (loan > batasPlafond + 1e-6) {
      warnings.push(`Plafond pengajuan melebihi Batas Plafond produk (${fmtRp(batasPlafond)}).`);
    }
    if (actualPayment > paymentCap + 1e-6) {
      warnings.push(`Angsuran melebihi batas DSR ${mx.dsr_pct ?? 99}% dari Gaji Pokok (${fmtRp(paymentCap)}).`);
    }
    if (netCash <= 0) {
      warnings.push("Sisa Bersih pencairan nol atau negatif setelah dipotong Biaya Pencairan, Retensi, dan Take Over.");
    }

    // Tabel referensi produk Reguler (10%) vs Reguler Plus (12%) sesuai lembar TBA-MSTK 1.0
    const regRate = cfg.interestRateAnnual ?? 10.0;
    const plusRate = cfg.interestRatePlusAnnual ?? 12.0;
    const regAlt = creditMonths > 0 && paymentCap > 0 ? pv(regRate / 100 / 12, creditMonths, paymentCap) : 0;
    const plusAlt = creditMonths > 0 && paymentCap > 0 ? pv(plusRate / 100 / 12, creditMonths, paymentCap) : 0;
    const comparison = [
      {
        code: "reguler",
        label: "Reguler (< 65 Thn)",
        rate_pct: regRate,
        cost_pct: costRatePct,
        max_plafond: Math.round(Math.min(batasPlafond, regAlt)),
        alt_plafond: Math.round(regAlt),
        installment: Math.round(creditMonths > 0 && loan > 0 ? pmt(regRate / 100 / 12, creditMonths, loan) : 0),
        cost: Math.round(loan * (costRatePct / 100)),
        active: mx.product_code === "reguler"
      },
      {
        code: "reguler_plus",
        label: "Reguler Plus (65 – < 69 Thn)",
        rate_pct: plusRate,
        cost_pct: costRatePct,
        max_plafond: Math.round(Math.min(batasPlafond, plusAlt)),
        alt_plafond: Math.round(plusAlt),
        installment: Math.round(creditMonths > 0 && loan > 0 ? pmt(plusRate / 100 / 12, creditMonths, loan) : 0),
        cost: Math.round(loan * (costRatePct / 100)),
        active: mx.product_code === "reguler_plus"
      }
    ];

    const validations = [
      { key: "input_valid", label: "Data debitur, tanggal, & gaji valid", ok: errors.length === 0 },
      { key: "age_entry", label: `Usia saat proses < ${cfg.maxEntryAgeYears ?? 69} tahun (${mx.age_label || `${mx.age} thn`})`, ok: mx.age < (cfg.maxEntryAgeYears ?? 69) },
      { key: "tenor_max", label: `Tenor kredit ≤ ${maxTenor} bulan (s.d. usia ${cfg.maxEndAgeYears ?? 79} thn ${cfg.maxEndAgeMonths ?? 11} bln)`, ok: creditMonths > 0 && creditMonths <= maxTenor },
      { key: "plafond_max", label: `Plafond ≤ ${fmtRp(Math.round(maxPlafondAtTenor))}`, ok: loan <= maxPlafondAtTenor + 1e-6 },
      { key: "dsr_cap", label: `Angsuran ≤ DSR ${mx.dsr_pct ?? 99}% Gaji Pokok`, ok: actualPayment <= paymentCap + 1e-6 },
      { key: "net_cash", label: "Sisa Bersih Pencairan positif (> Rp0)", ok: netCash > 0 }
    ];
    const overallOk = errors.length === 0 && warnings.length === 0;
    validations.push({ key: "overall", label: "Status Kelayakan TBA-MSTK Bank Mestika", ok: overallOk });
    const issues = [...errors, ...warnings];

    return {
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      birth_date: body.birth_date,
      process_date: procDateStr,
      age: mx.age,
      category: `Kredit Pensiun • ${mx.product_label || "Reguler"}`,
      plafond: Math.round(loan),
      tenor: creditMonths,
      bank_rate: rateAnnual,
      coop_rate: rateAnnual,
      salary: Math.round(basicSalary),
      take_over: Math.round(takeOver),
      tata_laksana_pct: 0,
      bank_installment: Math.round(actualPayment),
      coop_installment: Math.round(actualPayment),
      baa: 0,
      ratio_pct: ratioPct,
      proaq_pct: costRatePct,
      proaq: Math.round(cost),
      risk_pct: 0,
      risk: 0,
      admin_fee: 0,
      tata_laksana_fee: 0,
      total_fees: Math.round(cost),
      retention_multiplier: retMult,
      retention: Math.round(retentionAmt),
      net_disbursement: Math.round(netCash),
      remaining_salary: Math.round(salaryLeftBasic),
      mestika_details: {
        version: "TBA-MSTK 1.0",
        credit_type: "Kredit Pensiun",
        product_code: mx.product_code || "reguler",
        product_label: mx.product_label || "Reguler",
        age_years: mx.age,
        age_months: mx.age_months,
        age_decimal: mx.age_decimal,
        age_label: mx.age_label,
        process_date: procDateStr,
        end_age_years: cfg.maxEndAgeYears ?? 79,
        end_age_months: cfg.maxEndAgeMonths ?? 11,
        end_age_date: mx.end_age_date || "",
        remaining_age_months: mx.remaining_age_months || 0,
        salary_type: mx.salary_type,
        salary_type_label: mx.salary_type_label,
        salary_input: Math.round(salary),
        pension_deduction_pct: mx.pension_deduction_pct,
        basic_salary: Math.round(basicSalary),
        has_dependents: mx.has_dependents,
        dependent_type: mx.dependent_type,
        dependent_label: mx.dependent_label,
        dsr_pct: mx.dsr_pct ?? 99.0,
        payment_cap: Math.round(paymentCap),
        max_tenor: maxTenor,
        batas_plafond: Math.round(batasPlafond),
        max_plafond: Math.round(maxPlafondAtTenor),
        rec_max_plafond: mx.max_plafond,
        alt_plafond: Math.round(altPlafondAtTenor),
        rec_alt_plafond: mx.alt_plafond,
        amount_provided: amountProvided,
        tenor_provided: tenorProvided,
        loan: Math.round(loan),
        tenor: creditMonths,
        rate_pct: rateAnnual,
        actual_payment: Math.round(actualPayment),
        cost_rate_pct: costRatePct,
        cost: Math.round(cost),
        retention_multiplier: retMult,
        retention: Math.round(retentionAmt),
        take_over: Math.round(takeOver),
        net_cash: Math.round(netCash),
        salary_left_basic: Math.round(salaryLeftBasic),
        salary_left_pension: Math.round(salaryLeftPension),
        comparison,
        warnings,
        errors
      },
      validations,
      overall_ok: overallOk,
      issues
    };
  }

  // 4. Mitra Bank Konvensional
  const rateAnnual = cfg.interestRateAnnual || 12.5;
  const installment = Math.round(pmt(rateAnnual / 100 / 12, tenor, plafond));
  const ratioPct = salary > 0 ? Number(((installment / salary) * 100).toFixed(2)) : 0;
  const proaqPct = cfg.provisionRatePercent || 1.5;
  const riskPct = cfg.insuranceRatePercent || 10.0;
  const proaq = Math.round(plafond * (proaqPct / 100));
  const risk = Math.round(plafond * (riskPct / 100));
  const adminFee = cfg.adminFee || 500000;
  const tlFee = Math.round(plafond * (tlPct / 100));
  const totalFees = proaq + risk + adminFee + tlFee;
  const retention = installment * (cfg.retentionMultiplier || 2);
  const netDisbursement = plafond - totalFees - takeOver - retention;
  const remainingSalary = salary - installment;

  const validations = [
    { key: "age", label: `Usia masuk ≤ ${cfg.maxEntryAgeYears} tahun`, ok: mx.age <= cfg.maxEntryAgeYears },
    { key: "tenor", label: `Tenor ≤ ${cfg.maxTenorMonths} bln & batas usia lunas`, ok: tenor >= 12 && tenor <= mx.max_tenor },
    { key: "plafond", label: `Plafond ≤ Rp${(cfg.maxPlafondAbsolute / 1e6).toFixed(0)} Juta`, ok: plafond <= cfg.maxPlafondAbsolute && plafond <= mx.max_plafond },
    { key: "ratio", label: `DSR Angsuran ≤ ${cfg.maxInstallmentRatio}% gaji`, ok: ratioPct <= cfg.maxInstallmentRatio },
    { key: "net", label: "Sisa pencairan bersih positif (> Rp0)", ok: netDisbursement > 0 }
  ];
  const overallOk = validations.every((v) => v.ok);
  validations.push({ key: "overall", label: "Status Kelayakan Akhir", ok: overallOk });
  const issues = validations.filter((v) => !v.ok && v.key !== "overall").map((v) => `Ketentuan ${cfg.shortName} tidak terpenuhi: ${v.label}`);

  return {
    bank_key: bankKey,
    bank_name: cfg.name,
    name: body.name,
    birth_date: body.birth_date,
    process_date: mx.process_date,
    age: mx.age,
    category: `REGULER • ${cfg.shortName.toUpperCase()}`,
    plafond,
    tenor,
    bank_rate: rateAnnual,
    coop_rate: rateAnnual,
    salary,
    take_over: takeOver,
    tata_laksana_pct: tlPct,
    bank_installment: installment,
    coop_installment: installment,
    baa: 0,
    ratio_pct: ratioPct,
    proaq_pct: proaqPct,
    proaq,
    risk_pct: riskPct,
    risk,
    admin_fee: adminFee,
    tata_laksana_fee: tlFee,
    total_fees: totalFees,
    retention_multiplier: cfg.retentionMultiplier || 2,
    retention,
    net_disbursement: netDisbursement,
    remaining_salary: remainingSalary,
    validations,
    overall_ok: overallOk,
    issues
  };
}

function pdfEscape(str) {
  return String(str ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, " ");
}

function fmtRp(n) {
  return "Rp " + Math.round(Number(n || 0)).toLocaleString("id-ID");
}

function fmtExcelInt(n) {
  const v = Math.round(Number(n || 0));
  const sign = v < 0 ? "-" : "";
  return sign + Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtExcelDec2(n, dashIfZero = false) {
  const num = Number(n || 0);
  if (dashIfZero && Math.abs(num) < 0.005) return "-";
  const sign = num < 0 ? "-" : "";
  const fixed = Math.abs(num).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${intFormatted},${decPart}`;
}

function pdfNumberWidth(str, fontSize) {
  let w = 0;
  for (const ch of String(str || "")) {
    if (ch >= "0" && ch <= "9") w += 0.556 * fontSize;
    else if (ch === "." || ch === "," || ch === ":" || ch === " ") w += 0.278 * fontSize;
    else if (ch === "-") w += 0.333 * fontSize;
    else w += 0.6 * fontSize;
  }
  return w;
}

function fmtDateId(isoStr) {
  const d = parseIsoLocalDate(isoStr);
  if (!d) return isoStr || "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

export function generateSimulationPdfBuffer(sim) {
  const r = sim.result || {};
  const isBsi = r.bank_key === "bsi_prapen" || !!r.bsi_details;
  const isCapital = r.bank_key === "bank_capital" || !!r.capital_details;
  const isMestika = r.bank_key === "bank_mestika" || !!r.mestika_details;
  const isAms2 = r.bank_key === "ams2";
  const bsi = r.bsi_details || {};
  const cap = r.capital_details || {};
  const mst = r.mestika_details || {};
  const lines = [];

  if (isBsi) {
    // Ringkasan Simulasi Modern Profesional BSI Prapensiun (PRA PENSIUN DEKADE BERKAH / TRI BERKAH)
    const isTriBerkah = bsi.sub_product === "PP3";
    const excelHeaderTitle = isTriBerkah ? "PRA PENSIUN TRI BERKAH" : "PRA PENSIUN DEKADE BERKAH";
    const angsAktif = bsi.active_installment_exact ?? bsi.active_installment ?? r.bank_installment ?? 0;
    const angsPensiun = bsi.pension_installment_exact ?? bsi.pension_installment ?? r.coop_installment ?? 0;
    const biayaAdm = bsi.biaya_adm_exact ?? r.proaq ?? 0;
    const biayaAsuransi = bsi.biaya_asuransi_exact ?? (bsi.is_atribusi ? 0 : (r.risk ?? 0));
    const biayaMaterai = bsi.biaya_materai_exact ?? r.admin_fee ?? 100000;
    const bAktifCnt = bsi.blokir_active_count ?? (isTriBerkah ? (bsi.active_months || 1) : 1);
    const bPensiunCnt = bsi.blokir_pension_count ?? 2;
    const blokirAktif = bsi.blokir_aktif_exact ?? (angsAktif * bAktifCnt);
    const blokirPensiun = bsi.blokir_pensiun_exact ?? (angsPensiun * bPensiunCnt);
    const bukaBlokirLama = bsi.buka_blokir_lama_exact ?? bsi.buka_blokir_lama ?? r.buka_blokir_lama ?? 0;
    const pelunasanLama = bsi.pelunasan_lama_exact ?? bsi.pelunasan_lama ?? r.take_over ?? 0;
    const terimaBersih =
      bsi.sisa_pencairan_bersih_exact ??
      (Number(r.plafond || 0) - biayaAdm - biayaAsuransi - biayaMaterai - blokirAktif - blokirPensiun + bukaBlokirLama - pelunasanLama);

    const bsiExcelRows = [
      { type: "header", label: excelHeaderTitle },
      { type: "blank" },
      { type: "text", label: "Nama Nasabah", colon: ":", val: String(r.name || "-").toUpperCase() },
      { type: "num", label: "Plafond", colon: ":", val: fmtExcelInt(r.plafond), boldVal: true },
      { type: "num", label: "Jangka Waktu", colon: ":", val: String(r.tenor || 0) },
      { type: "blank" },
      { type: "num", label: "Angsuran saat Aktif PNS", colon: ":", val: fmtExcelDec2(angsAktif) },
      { type: "num", label: "Angsuran saat Pensiun", colon: ":", val: fmtExcelDec2(angsPensiun) },
      { type: "blank" },
      { type: "section", label: "Biaya" },
      { type: "num", label: `Administrasi (${r.proaq_pct ?? 1}%)`, colon: ":", val: fmtExcelDec2(biayaAdm) },
      { type: "num", label: "Asuransi", colon: ":", val: fmtExcelDec2(biayaAsuransi, true) },
      { type: "num", label: "Materai", colon: ":", val: fmtExcelDec2(biayaMaterai) },
      { type: "blank" },
      { type: "section", label: "Blokir Angsuran" },
      { type: "num", label: `Blokir ${bAktifCnt}x Angs Masa Aktif`, colon: ":", val: fmtExcelDec2(blokirAktif) },
      { type: "num", label: `Blokir ${bPensiunCnt}x Angs Masa Pensiun`, colon: ":", val: fmtExcelDec2(blokirPensiun) },
      { type: "blank" },
      { type: "num", label: "Buka Blokir Yang Lama", colon: ":", val: fmtExcelDec2(bukaBlokirLama, true) },
      { type: "blank" },
      { type: "num", label: "Pelunasan Yang Lama", colon: ":", val: fmtExcelDec2(pelunasanLama, true) },
      { type: "blank" },
      { type: "footer", label: "Terima Bersih", colon: ":", val: fmtExcelDec2(terimaBersih) }
    ];

    const boxX = 75;
    const col1W = 220;
    const col2W = 22;
    const col3W = 203;
    const boxW = col1W + col2W + col3W; // 445
    const rowH = 23;
    const topY = 768;
    const totalH = bsiExcelRows.length * rowH;
    const bottomY = topY - totalH;

    // White background card
    lines.push(`q 1 1 1 rg ${boxX} ${bottomY} ${boxW} ${totalH} re f Q`);

    bsiExcelRows.forEach((row, idx) => {
      const rTop = topY - idx * rowH;
      const rBot = rTop - rowH;
      const textY = rBot + 7;

      // Modern financial palette fills
      if (row.type === "header") {
        // Deep Corporate Emerald (#065F46 -> 0.024 0.373 0.275)
        lines.push(`q 0.024 0.373 0.275 rg ${boxX} ${rBot} ${boxW} ${rowH} re f Q`);
        // Gold accent stripe at bottom of header (#F59E0B -> 0.961 0.620 0.043)
        lines.push(`q 0.961 0.620 0.043 rg ${boxX} ${rBot} ${boxW} 2 re f Q`);
      } else if (row.type === "section") {
        // Subtle Slate/Emerald tint (#F1F5F9 -> 0.945 0.961 0.976)
        lines.push(`q 0.945 0.961 0.976 rg ${boxX} ${rBot} ${boxW} ${rowH} re f Q`);
      } else if (row.type === "footer") {
        // Executive Highlight Footer (#ECFDF5 -> 0.925 0.992 0.961)
        lines.push(`q 0.925 0.992 0.961 rg ${boxX} ${rBot} ${boxW} ${rowH} re f Q`);
        lines.push(`q 0.027 0.553 0.404 RG 1.2 w ${boxX} ${rTop} m ${boxX + boxW} ${rTop} l S Q`);
      }

      // Soft modern divider lines (#E2E8F0 -> 0.886 0.910 0.941)
      if (row.type !== "header") {
        lines.push(`q 0.886 0.910 0.941 RG 0.5 w ${boxX} ${rBot} m ${boxX + boxW} ${rBot} l S Q`);
      }

      const fontSize = row.type === "header" ? 11.5 : row.type === "footer" ? 12 : 10.5;
      const xLabel = boxX + 12;
      const xColon = boxX + col1W + 6;
      const xValLeft = boxX + col1W + col2W + 6;
      const xValRight = boxX + boxW - 12;

      if (row.type === "header") {
        lines.push(`BT /F2 ${fontSize} Tf 1 1 1 rg ${xLabel} ${textY} Td (${pdfEscape(row.label)}) Tj ET`);
      } else if (row.type === "section") {
        lines.push(`BT /F2 10.5 Tf 0.024 0.373 0.275 rg ${xLabel} ${textY} Td (${pdfEscape(row.label)}) Tj ET`);
      } else if (row.type === "text") {
        lines.push(`BT /F1 ${fontSize} Tf 0.20 0.25 0.33 rg ${xLabel} ${textY} Td (${pdfEscape(row.label)}) Tj ET`);
        lines.push(`BT /F1 ${fontSize} Tf 0.40 0.45 0.53 rg ${xColon} ${textY} Td (${pdfEscape(row.colon)}) Tj ET`);
        lines.push(`BT /F2 ${fontSize} Tf 0.09 0.13 0.23 rg ${xValLeft} ${textY} Td (${pdfEscape(row.val)}) Tj ET`);
      } else if (row.type === "num") {
        lines.push(`BT /F1 ${fontSize} Tf 0.20 0.25 0.33 rg ${xLabel} ${textY} Td (${pdfEscape(row.label)}) Tj ET`);
        lines.push(`BT /F1 ${fontSize} Tf 0.40 0.45 0.53 rg ${xColon} ${textY} Td (${pdfEscape(row.colon)}) Tj ET`);
        const isDash = row.val === "-";
        const valFont = row.boldVal ? "F2" : "F1";
        const valX = isDash ? xValRight - 22 : xValRight - pdfNumberWidth(row.val, fontSize);
        lines.push(`BT /${valFont} ${fontSize} Tf 0.09 0.13 0.23 rg ${valX.toFixed(2)} ${textY} Td (${pdfEscape(row.val)}) Tj ET`);
      } else if (row.type === "footer") {
        lines.push(`BT /F2 ${fontSize} Tf 0.024 0.373 0.275 rg ${xLabel} ${textY} Td (${pdfEscape(row.label)}) Tj ET`);
        lines.push(`BT /F2 ${fontSize} Tf 0.024 0.373 0.275 rg ${xColon} ${textY} Td (${pdfEscape(row.colon)}) Tj ET`);
        const valX = xValRight - pdfNumberWidth(row.val, fontSize);
        lines.push(`BT /F2 ${fontSize} Tf 0.024 0.373 0.275 rg ${valX.toFixed(2)} ${textY} Td (${pdfEscape(row.val)}) Tj ET`);
      }
    });

    // Refined outer border (#CBD5E1 -> 0.796 0.835 0.882)
    lines.push(`q 0.796 0.835 0.882 RG 1.2 w ${boxX} ${bottomY} ${boxW} ${totalH} re S Q`);

    // Subtle footer metadata below the table
    lines.push(
      `BT /F1 8 Tf 0.45 0.48 0.55 rg ${boxX} ${bottomY - 20} Td (No. Simulasi: ${pdfEscape(sim.sim_no)}   |   Tanggal: ${pdfEscape(r.process_date || "-")}   |   Layanan Pensiunan) Tj ET`
    );

    const streamContent = lines.join("\n");
    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
      "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
      `6 0 obj\n<< /Length ${Buffer.byteLength(streamContent, "utf8")} >>\nstream\n${streamContent}\nendstream\nendobj\n`
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += obj;
    }
    const xrefOffset = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
  }

  if (isAms2) {
    // Layout Resmi Simulasi AMS V2 — Koperasi Asia Madani Sejahtera
    const ams = r.ams2_details || {};
    const PUR = "0.65 0.35 0.72",
      LAV = "0.96 0.92 0.97",
      ORG = "1 0.56 0.12",
      NAV = "0.07 0.15 0.30",
      BLUE = "0.12 0.31 0.57",
      PALE = "0.93 0.96 0.99",
      WHITE = "1 1 1",
      INK = "0.13 0.17 0.25",
      MUTED = "0.38 0.42 0.49",
      BORDER = "0.84 0.87 0.91",
      GREEN = "0.06 0.43 0.29",
      RED = "0.68 0.12 0.12";
    const rect = (x, y, w, h, color) => {
      lines.push(`${color} rg ${x} ${y} ${w} ${h} re f`);
    };
    const stroke = (x, y, w, h, color, width = 0.6) => {
      lines.push(`${color} RG ${width} w ${x} ${y} ${w} ${h} re S`);
    };
    const ln = (x, y, x2, y2, color, width = 0.5) => {
      lines.push(`${color} RG ${width} w ${x} ${y} m ${x2} ${y2} l S`);
    };
    const t = (x, y, size, s, color = INK, font = "F1") => {
      lines.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(s)}) Tj ET`);
    };
    const wrapped = (s, max) => {
      const a = [];
      let z = String(s ?? "-").replace(/\s+/g, " ").trim() || "-";
      while (z.length > max) {
        let k = z.lastIndexOf(" ", max);
        if (k < 12) k = max;
        a.push(z.slice(0, k));
        z = z.slice(k).trim();
      }
      a.push(z);
      return a;
    };

    const name = String(r.name || "-").replace(/\s+/g, " ").trim() || "-";
    const catDisplay = ams.category_label || r.category || "-";
    const ageDisplay = ams.age_label || (r.age !== undefined ? `${r.age} tahun` : "-");
    const pengajuanDisplay = ams.takeover_label || (Number(r.take_over || 0) > 0 ? "Take Over" : "Non Take Over");

    // Header
    rect(0, 748, 595, 94, NAV);
    rect(0, 748, 9, 94, PUR);
    rect(9, 748, 5, 94, ORG);
    rect(25, 759, 65, 72, WHITE);
    stroke(28, 762, 59, 66, PUR, 1.1);
    rect(32, 804, 51, 18, PUR);
    t(42, 810, 9, "AMS 2", WHITE, "F2");
    t(34, 788, 6.2, "ASIA MADANI", NAV, "F2");
    t(38, 778, 6.2, "SEJAHTERA", ORG, "F2");
    t(41, 768, 5.5, "KOPERASI", MUTED, "F1");

    t(105, 812, 8, "KOPERASI ASIA MADANI SEJAHTERA", WHITE, "F1");
    t(105, 786, 18, "RINCIAN SIMULASI KREDIT", WHITE, "F1");
    t(105, 766, 8, `AMS2 CREDIT CALCULATOR  |  TANGGAL: ${fmtDateId(r.process_date)}`, "0.89 0.92 0.98", "F1");
    rect(478, 779, 91, 32, PUR);
    t(489, 798, 7, "DOKUMEN", WHITE, "F1");
    t(489, 786, 7, "SIMULASI", WHITE, "F1");

    // 01 Informasi Debitur
    rect(27, 674, 541, 60, LAV);
    stroke(27, 674, 541, 60, "0.86 0.78 0.88");
    t(39, 718, 8, "01  INFORMASI DEBITUR", PUR, "F2");
    t(39, 699, 10, `Nama: ${name}`, INK, "F2");
    t(39, 683, 7.5, `Tanggal lahir: ${fmtDateId(r.birth_date)}   |   Usia: ${ageDisplay}   |   Kategori: ${catDisplay}`, MUTED, "F1");
    t(365, 699, 8, `Gaji: ${fmtRp(r.salary)}`, INK, "F2");
    t(365, 683, 7.5, `Pengajuan: ${pengajuanDisplay}`, MUTED, "F1");

    // Primary Summary
    rect(27, 618, 541, 42, NAV);
    rect(27, 618, 4, 42, ORG);
    t(41, 644, 7.5, "ESTIMASI PENCAIRAN BERSIH", "0.88 0.91 0.98", "F2");
    t(41, 627, 15, fmtRp(r.net_disbursement), WHITE, "F2");
    t(354, 644, 7.5, "ANGSURAN KOPERASI / BULAN", "0.88 0.91 0.98", "F2");
    t(354, 627, 13, fmtRp(r.coop_installment), WHITE, "F2");

    // 3 Mini Cards
    const mini = (x, w, label, value) => {
      rect(x, 565, w, 40, PALE);
      stroke(x, 565, w, 40, BORDER);
      t(x + 9, 590, 7, label, MUTED, "F2");
      t(x + 9, 574, 10, value, INK, "F2");
    };
    mini(27, 170, "PLAFON KREDIT", fmtRp(r.plafond));
    mini(210, 170, "TENOR", r.tenor ? `${r.tenor} bulan` : "-");
    mini(393, 175, "SISA GAJI / BULAN", fmtRp(r.remaining_salary));

    // 02 Rincian Biaya & Potongan
    rect(27, 533, 541, 21, PUR);
    t(39, 540, 8, "02  RINCIAN BIAYA & POTONGAN", WHITE, "F2");
    t(451, 540, 7, "NOMINAL (IDR)", WHITE, "F2");
    const costRows = [
      ["Biaya Provisi dan Akuisisi", fmtRp(r.proaq)],
      ["Cadangan Risiko", fmtRp(r.risk)],
      ["Administrasi", fmtRp(r.admin_fee)],
      ["TOTAL BIAYA KREDIT", fmtRp(r.total_fees)],
      ["Take Over", fmtRp(r.take_over || 0)],
      ["Retensi (3 x angsuran koperasi)", fmtRp(r.retention)]
    ];
    let cy = 512;
    costRows.forEach((row, i) => {
      if (i === 3) rect(27, cy - 5, 541, 21, LAV);
      else if (i % 2 === 0) rect(27, cy - 5, 541, 21, "0.985 0.988 0.994");
      t(39, cy + 2, 8, row[0], i === 3 ? PUR : INK, i === 3 ? "F2" : "F1");
      t(445, cy + 2, 8, row[1], i === 3 ? PUR : INK, i === 3 ? "F2" : "F1");
      ln(27, cy - 5, 568, cy - 5, BORDER, 0.35);
      cy -= 22;
    });

    // 03 Validasi Simulasi
    rect(27, 365, 541, 21, PALE);
    t(39, 372, 8, "03  VALIDASI SIMULASI", BLUE, "F2");
    let vy = 350;
    const valList = Array.isArray(r.validations) ? r.validations.filter((v) => v.key !== "overall") : [];
    valList.slice(0, 4).forEach((ch) => {
      const col = ch.ok ? GREEN : RED;
      const tag = ch.ok ? "LULUS" : "PERINGATAN";
      t(40, vy, 6.7, `[${tag}]`, col, "F2");
      const parts = wrapped(ch.label, 79);
      t(91, vy, 7, parts[0], INK, "F1");
      vy -= 12;
      if (parts[1]) {
        t(91, vy, 7, parts[1], INK, "F1");
        vy -= 10;
      }
    });

    // Pernyataan Nasabah
    rect(27, 274, 541, 31, LAV);
    stroke(27, 274, 541, 31, "0.86 0.78 0.88");
    rect(27, 274, 3, 31, ORG);
    t(38, 293, 7.3, "PERNYATAAN NASABAH", PUR, "F2");
    t(38, 281, 6.7, "Saya telah menerima penjelasan simulasi dan memahami bahwa hasil ini merupakan estimasi, bukan persetujuan kredit final.", INK, "F1");

    // 4 Signature Boxes
    const sx = [27, 164, 301, 438],
      sw = 130;
    const picName = ams.pic || "MUHAMMAD TEGUH PRANADA";
    const smName = ams.sales_manager || "-";
    const mktName = ams.marketing || "-";
    const roles = [
      ["PIC KOPERASI", picName],
      ["SALES MANAGER", smName],
      ["MARKETING", mktName],
      ["NASABAH", name]
    ];
    sx.forEach((x, i) => {
      stroke(x, 181, sw, 78, BORDER, 0.6);
      t(x + 7, 244, 6.5, roles[i][0], i === 3 ? ORG : PUR, "F2");
      wrapped(roles[i][1], 22)
        .slice(0, 2)
        .forEach((part, j) => t(x + 7, 232 - j * 9, 6.2, part, INK, "F1"));
      ln(x + 8, 199, x + sw - 8, 199, MUTED, 0.5);
      t(x + 7, 187, 5.7, "Tanda tangan / nama jelas", MUTED, "F1");
    });

    // Footer
    ln(27, 165, 568, 165, ORG, 1.2);
    t(27, 150, 6.7, "Dokumen simulasi untuk konfirmasi awal. Pastikan ketentuan resmi dan seluruh data telah diverifikasi.", MUTED, "F1");
    t(27, 137, 6.5, `PIC: ${picName}  |  Sales Manager: ${smName}  |  Marketing: ${mktName}`, MUTED, "F1");
    t(27, 121, 6.2, "ASIA MADANI SEJAHTERA  -  AMS2 CREDIT CALCULATOR", PUR, "F2");
    t(27, 108, 5.8, "Layanan Pensiunan", MUTED, "F1");

    const streamContent = lines.join("\n");
    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
      "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
      `6 0 obj\n<< /Length ${Buffer.byteLength(streamContent, "utf8")} >>\nstream\n${streamContent}\nendstream\nendobj\n`
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += obj;
    }
    const xrefOffset = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
  }

  const headerTitle = isCapital
    ? "APLIKASI CALC CAPITAL - DASA CIPTA BERKARYA (PS3 CAPITAL)"
    : isMestika
    ? "SIMULASI DASA GROUP - TIGA BERMUDA AMANAH • BANK MESTIKA (TBA-MSTK 1.0)"
    : isAms2
    ? "LAYANAN PENSIUNAN - HASIL SIMULASI KOPERASI AMS2"
    : `LAYANAN PENSIUNAN - HASIL SIMULASI ${(r.bank_name || "").toUpperCase()}`;

  const headerBg = isCapital ? "0.027 0.533 0.494" : isMestika ? "0.118 0.494 0.204" : "0.208 0.063 0.502";
  lines.push(`q ${headerBg} rg 0 760 595 82 re f Q`);
  lines.push(`BT /F2 13 Tf 1 1 1 rg 40 805 Td (${pdfEscape(headerTitle)}) Tj ET`);
  lines.push(`BT /F1 9 Tf 0.9 0.9 0.95 rg 40 785 Td (No. Simulasi: ${pdfEscape(sim.sim_no)}   |   Tanggal Proses: ${pdfEscape(isCapital || isMestika ? fmtDateId(r.process_date) : r.process_date)}   |   Petugas: ${pdfEscape(sim.created_by_name)}) Tj ET`);

  let rows = [];

  if (isMestika) {
    rows = [
      ["INPUT DATA DEBITUR (TBA-MSTK 1.0)", ""],
      ["Nama Debitur", r.name || "-"],
      ["Tanggal Lahir / Usia", `${fmtDateId(r.birth_date)} (${mst.age_label || `${r.age} Tahun`})`],
      ["Produk Kredit (Otomatis)", `Kredit Pensiun - ${mst.product_label || "Reguler"} (Bunga ${r.bank_rate}% p.a.)`],
      ["Jenis Gaji", mst.salary_type_label || "Sesuai Gaji IDPB"],
      ...(mst.salary_type === "pensiun"
        ? [
            ["Gaji Pensiun Diinput", fmtRp(mst.salary_input)],
            [`Estimasi Gaji Pokok (-${mst.pension_deduction_pct ?? 13}%)`, fmtRp(mst.basic_salary)]
          ]
        : [["Gaji Pokok IDPB (Tanpa Tanggungan)", fmtRp(mst.basic_salary ?? r.salary)]]),
      ["Status Tanggungan", `${mst.dependent_label || "Tidak Ada Tanggungan"} (DSR ${mst.dsr_pct ?? 99}%)`],
      ["PARAMETER & ALTERNATIF PLAFOND", ""],
      ["Batas Usia Lunas (79 Thn 11 Bln)", `${fmtDateId(mst.end_age_date)} (Sisa ${mst.remaining_age_months || 0} bln)`],
      ["Maksimal Tenor", `${mst.max_tenor ?? r.tenor} bulan`],
      ["Batas Angsuran (DSR 99% Gaji Pokok)", fmtRp(mst.payment_cap)],
      ["Plafond Maksimal (Batas Plafond)", fmtRp(mst.max_plafond ?? r.plafond)],
      ["Alternatif Plafond (PV Murni 99%)", fmtRp(mst.alt_plafond ?? r.plafond)],
      ["PENGAJUAN & POTONGAN PENCAIRAN", ""],
      ["Plafond Diajukan", fmtRp(r.plafond)],
      ["Tenor Diajukan", `${r.tenor} bulan`],
      ["Angsuran per Bulan", fmtRp(r.coop_installment)],
      [`Biaya Pencairan (${mst.cost_rate_pct ?? 22}%)`, fmtRp(r.total_fees)],
      [`Retensi Angsuran (${mst.retention_multiplier ?? 3}x Angsuran)`, fmtRp(r.retention)],
      ["Pelunasan Take Over (TO)", fmtRp(r.take_over || 0)],
      ["HASIL AKHIR PENCAIRAN", ""],
      ["TERIMA BERSIH / SISA BERSIH", fmtRp(r.net_disbursement)],
      ["SISA GAJI (DARI GAJI POKOK)", fmtRp(r.remaining_salary)]
    ];
  } else if (isCapital) {
    // 100% Terminologi Calc Capital — DASA CIPTA BERKARYA (PS3 CAPITAL)
    const isCapPensiun = cap.product === "pensiun";
    const maxTenorVal = cap.max_credit_months || cap.credit_months || r.tenor || 0;
    const reqTenorVal = cap.credit_months ?? r.tenor ?? 0;
    rows = [
      ["INFORMASI DEBITUR", ""],
      ["Nama Debitur", r.name || "-"],
      ["Tanggal Lahir", fmtDateId(r.birth_date)],
      ["Gaji Bulanan", fmtRp(r.salary)],
      ["Produk Kredit", cap.product_label || (isCapPensiun ? "Pensiun" : "Pra Pensiun")],
      ...(!isCapPensiun && cap.tmt_pensiun_date ? [["TMT Pensiun", fmtDateId(cap.tmt_pensiun_date)]] : []),
      ["RINCIAN TENOR", ""],
      ["Batas Usia Kredit", fmtDateId(cap.age_limit_date)],
      ["Tenor Kredit Maksimal", `${maxTenorVal} bulan`],
      ...(!isCapPensiun ? [["Tenor PP", `${cap.pp_months ?? 0} bulan`]] : []),
      ["Tenor Diajukan", `${reqTenorVal} bulan`],
      ["HASIL SIMULASI", ""],
      ["Batas Angsuran Maksimal (90%)", fmtRp(cap.payment_cap ?? Math.round((r.salary || 0) * 0.9))],
      ["Angsuran Aktual", fmtRp(cap.actual_payment ?? r.coop_installment)],
      ["Plafon Maksimal", fmtRp(cap.max_loan_pv ?? cap.recommendation_max_loan ?? r.plafond)],
      ["Plafon Diajukan", fmtRp(cap.loan ?? r.plafond)],
      ["Biaya Kredit", fmtRp(cap.cost ?? r.total_fees)],
      [isCapPensiun ? "Total Retensi (2x Angsuran)" : "Total Retensi", fmtRp(cap.total_retention ?? r.retention)],
      ["Sisa Bersih", fmtRp(cap.net_cash ?? r.net_disbursement)],
      ["Sisa Gaji Setelah Angsuran", fmtRp(cap.salary_left ?? r.remaining_salary)]
    ];
  } else if (isBsi) {
    // 100% Terminologi Resmi BSI Prapensiun NOS v1.4.6 + Simas Jiwa
    const bAktifCnt = bsi.blokir_active_count ?? (bsi.sub_product === "PP3" ? (bsi.active_months || 1) : 1);
    const bPensiunCnt = bsi.blokir_pension_count ?? 2;
    rows = [
      ["IDENTITAS DEBITUR (BSI PRAPENSIUN NOS v1.4.6)", ""],
      ["Nama Debitur / NIP", `${r.name || "-"} / ${bsi.nip || "-"}`],
      ["Tgl Lahir / Usia Exact & Simas", `${fmtDateId(r.birth_date)} (${bsi.age_exact_text || `${r.age} Tahun`} | Nearest: ${bsi.nearest_age || r.age} Thn)`],
      ["Tipe Produk & Status Payroll", `${bsi.sub_product_label || "Dekade Berkah"} • ${bsi.status_gaji_label || "Payroll"}`],
      ["Akad & Skema Asuransi", `${bsi.akad || "MMQ"} (${bsi.skema || "Atribusi"})`],
      ["PARAMETER PEMBIAYAAN & AKSEPTASI", ""],
      ["Plafond Pembiayaan", fmtRp(r.plafond)],
      ["Tenor Total (Aktif + Pensiun)", `${r.tenor} Bln (${bsi.active_months || 0} Bln Aktif + ${bsi.pension_months || 0} Bln Pensiun)`],
      ["Proyeksi Cair / Mulai - Selesai", `${bsi.proyeksi_cair || "-"} / ${bsi.start_angsuran || "-"} s.d. ${bsi.selesai_angsuran || "-"}`],
      ["Price Saat Aktif (Base / Atrib)", `${bsi.base_rate_aktif ?? r.bank_rate}% / ${bsi.price_atrib_aktif_pct ?? bsi.margin_aktif ?? r.bank_rate}% p.a.`],
      ["Price Saat Pensiun (Base / Atrib)", `${bsi.base_rate_pensiun ?? r.coop_rate}% / ${bsi.price_atrib_pensiun_pct ?? bsi.margin_pensiun ?? r.coop_rate}% p.a.`],
      ["Penghasilan Aktif Diakui / Manfaat Pensiun", `${fmtRp(r.salary)} / ${fmtRp(r.pension_salary)}`],
      ["RINCIAN ANGSURAN & SALDO TRANSISI", ""],
      ["Angsuran Masa Aktif", `${fmtRp(bsi.active_installment || r.bank_installment)} (DBR ${r.ratio_pct}% / Maks ${bsi.dbr_active_rate || 70}%)`],
      ["Sisa OS Saat Pensiun (Transisi)", fmtRp(bsi.sisa_os_saat_pensiun || 0)],
      ["Angsuran Masa Pensiun", `${fmtRp(bsi.pension_installment || r.coop_installment)} (DSR ${r.ratio_pension_pct || 0}% / Maks 90%)`],
      ["RINCIAN BIAYA & KOMPONEN PENCAIRAN", ""],
      [`Biaya Administrasi Bank (${r.proaq_pct}%)`, fmtRp(r.proaq)],
      [`Premi Asuransi Simas Jiwa (${bsi.simas?.tarif_permil ?? bsi.simas?.rate_permil ?? 0} per mil)`, `${fmtRp(bsi.premi_asuransi_tertanggung || 0)} (${bsi.is_atribusi ? "Atribusi Margin" : "Potong Pencairan"})`],
      ["Biaya Materai", fmtRp(r.admin_fee)],
      [`Blokir Angsuran (${bAktifCnt}x Aktif + ${bPensiunCnt}x Pensiun)`, fmtRp(r.retention)],
      ["Pelunasan Yang Lama / Buka Blokir Lama", `-${fmtRp(bsi.pelunasan_lama ?? r.take_over ?? 0)} / +${fmtRp(bsi.buka_blokir_lama ?? r.buka_blokir_lama ?? 0)}`],
      ["HASIL AKHIR PENCAIRAN", ""],
      ["TERIMA BERSIH NASABAH (NET DISBURSEMENT)", fmtRp(r.net_disbursement)],
      ["SISA GAJI AKTIF / SISA GAJI PENSIUN", `${fmtRp(r.remaining_salary)} / ${fmtRp(bsi.sisa_gaji_pensiun || (r.pension_salary - r.coop_installment))}`]
    ];
  } else if (isAms2) {
    // 100% Terminologi Koperasi AMS2
    rows = [
      ["IDENTITAS DEBITUR (KOPERASI AMS2)", ""],
      ["Nama Debitur", r.name],
      ["Tanggal Proses / Usia", `${r.process_date} (${r.age} Tahun)`],
      ["Kategori Produk", r.category],
      ["PARAMETER PENGAJUAN", ""],
      ["Plafond Pembiayaan", fmtRp(r.plafond)],
      ["Tenor Pembiayaan", `${r.tenor} Bulan`],
      ["Bunga Bank", `${r.bank_rate}% per tahun`],
      ["Bunga Koperasi", `${r.coop_rate}% per tahun`],
      ["Gaji Pensiun Bulanan", fmtRp(r.salary)],
      ["RINCIAN ANGSURAN & BIAYA", ""],
      ["Angsuran Bank per Bulan", fmtRp(r.bank_installment)],
      ["Angsuran Koperasi per Bulan", fmtRp(r.coop_installment)],
      ["BAA per Bulan", fmtRp(r.baa)],
      ["Rasio Angsuran Aktual", `${r.ratio_pct}%`],
      [`Biaya PROAQ (${r.proaq_pct}%)`, fmtRp(r.proaq)],
      [`Cadangan Risiko (${r.risk_pct}%)`, fmtRp(r.risk)],
      ["Biaya Administrasi", fmtRp(r.admin_fee)],
      [`Biaya Tata Laksana (${r.tata_laksana_pct}%)`, fmtRp(r.tata_laksana_fee)],
      ["Total Biaya Kredit", fmtRp(r.total_fees)],
      ["Nilai Take Over (TO)", fmtRp(r.take_over)],
      ["Retensi Angsuran (3x Angsuran)", fmtRp(r.retention)],
      ["HASIL AKHIR PENCAIRAN", ""],
      ["TERIMA BERSIH NASABAH (NET DISBURSEMENT)", fmtRp(r.net_disbursement)],
      ["SISA GAJI SETELAH ANGSURAN", fmtRp(r.remaining_salary)]
    ];
  } else {
    // Mitra Bank Konvensional
    rows = [
      [`IDENTITAS DEBITUR (${(r.bank_name || "MITRA BANK").toUpperCase()})`, ""],
      ["Nama Debitur", r.name],
      ["Tanggal Proses / Usia", `${r.process_date} (${r.age} Tahun)`],
      ["Kategori Produk", r.category],
      ["PARAMETER PENGAJUAN KREDIT", ""],
      ["Plafond Kredit", fmtRp(r.plafond)],
      ["Tenor Kredit", `${r.tenor} Bulan`],
      ["Suku Bunga Kredit", `${r.bank_rate}% per tahun`],
      ["Gaji Pensiun Bulanan", fmtRp(r.salary)],
      ["RINCIAN ANGSURAN & BIAYA", ""],
      ["Angsuran Kredit per Bulan", fmtRp(r.coop_installment)],
      ["DSR Angsuran Aktual", `${r.ratio_pct}%`],
      [`Biaya Provisi (${r.proaq_pct}%)`, fmtRp(r.proaq)],
      [`Biaya Asuransi Jiwa (${r.risk_pct}%)`, fmtRp(r.risk)],
      ["Biaya Administrasi Bank", fmtRp(r.admin_fee)],
      ["Total Biaya Kredit", fmtRp(r.total_fees)],
      ["Nilai Take Over (TO)", fmtRp(r.take_over)],
      ["Blokir / Retensi Angsuran", fmtRp(r.retention)],
      ["HASIL AKHIR PENCAIRAN", ""],
      ["TERIMA BERSIH NASABAH (NET DISBURSEMENT)", fmtRp(r.net_disbursement)],
      ["SISA GAJI SETELAH ANGSURAN", fmtRp(r.remaining_salary)]
    ];
  }

  let y = 735;
  for (const [k, v] of rows) {
    if (!v) {
      y -= 8;
      lines.push(`q 0.933 0.969 0.961 rg 40 ${y - 4} 515 18 re f Q`);
      lines.push(`BT /F2 10 Tf ${isCapital ? "0.071 0.239 0.224" : "0.208 0.063 0.502"} rg 46 ${y} Td (${pdfEscape(k)}) Tj ET`);
      y -= 20;
    } else {
      const isHighlightRow =
        isCapital &&
        (k === "Tenor Diajukan" ||
          k === "Plafon Diajukan" ||
          k === "Sisa Bersih" ||
          k === "Sisa Gaji Setelah Angsuran");
      const isStrong =
        isHighlightRow ||
        k.includes("TERIMA BERSIH") ||
        k.includes("SISA GAJI") ||
        k.includes("Sisa Bersih") ||
        k.includes("Pencairan Bersih") ||
        k.includes("Plafon Maksimal") ||
        k.includes("Plafond Maksimal") ||
        k.includes("Angsuran Aktual") ||
        k.includes("Total Retensi");
      if (isHighlightRow) {
        lines.push(`q 0.945 0.988 0.976 rg 40 ${y - 4} 515 16 re f Q`);
      }
      lines.push(`BT /${isStrong ? "F2" : "F1"} 10 Tf 0.1 0.13 0.23 rg 46 ${y} Td (${pdfEscape(k)}) Tj ET`);
      lines.push(`BT /F2 10 Tf ${isStrong ? "0.027 0.533 0.494" : "0.1 0.13 0.23"} rg 360 ${y} Td (${pdfEscape(v)}) Tj ET`);
      y -= 17;
    }
  }

  if (isCapital) {
    // HIGHLIGHT POINT (PLAFON, TENOR, SISA BERSIH, SISA GAJI)
    y -= 10;
    lines.push(`q 0.027 0.533 0.494 rg 40 ${y - 4} 515 20 re f Q`);
    lines.push(`BT /F2 10 Tf 1 1 1 rg 48 ${y + 2} Td (HIGHLIGHT POINT HASIL SIMULASI) Tj ET`);
    y -= 12;

    const hlCards = [
      { label: "PLAFON", val: fmtRp(cap.loan ?? r.plafond), primary: false },
      { label: "TENOR", val: `${cap.credit_months ?? r.tenor ?? 0} Bulan`, primary: false },
      { label: "SISA BERSIH", val: fmtRp(cap.net_cash ?? r.net_disbursement), primary: true },
      { label: "SISA GAJI", val: fmtRp(cap.salary_left ?? r.remaining_salary), primary: true }
    ];

    const cardW = 251;
    const cardH = 44;
    const gapX = 13;
    const gapY = 10;

    hlCards.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = 40 + col * (cardW + gapX);
      const cy = y - (row + 1) * cardH - row * gapY;
      const bgFill = c.primary ? "0.910 0.980 0.965" : "0.965 0.980 0.976";
      const borderCol = c.primary ? "0.027 0.533 0.494" : "0.780 0.855 0.840";
      const valCol = c.primary ? "0.027 0.533 0.494" : "0.071 0.239 0.224";

      lines.push(`q ${bgFill} rg ${cx} ${cy} ${cardW} ${cardH} re f Q`);
      lines.push(`q ${borderCol} RG 0.9 w ${cx} ${cy} ${cardW} ${cardH} re S Q`);
      lines.push(`q 0.027 0.533 0.494 rg ${cx} ${cy} 4 ${cardH} re f Q`);
      lines.push(`BT /F2 8.5 Tf 0.35 0.45 0.43 rg ${cx + 12} ${cy + 28} Td (${pdfEscape(c.label)}) Tj ET`);
      lines.push(`BT /F2 13 Tf ${valCol} rg ${cx + 12} ${cy + 10} Td (${pdfEscape(c.val)}) Tj ET`);
    });

    y -= 2 * cardH + gapY + 18;

    if (Array.isArray(cap.warnings) && cap.warnings.length > 0 && y > 90) {
      lines.push(`q 0.992 0.965 0.898 rg 40 ${y - 4} 515 18 re f Q`);
      lines.push(`BT /F2 9.5 Tf 0.573 0.251 0.055 rg 46 ${y} Td (CATATAN VALIDASI) Tj ET`);
      y -= 18;
      cap.warnings.slice(0, 3).forEach((w, idx) => {
        lines.push(`BT /F1 8.5 Tf 0.45 0.20 0.05 rg 46 ${y} Td (${pdfEscape(`${idx + 1}. ${w}`)}) Tj ET`);
        y -= 14;
      });
    }

    lines.push("BT /F1 8 Tf 0.39 0.46 0.45 rg 40 48 Td (Estimasi simulasi berdasarkan parameter PS3 CAPITAL - DASA CIPTA BERKARYA) Tj ET");
    lines.push("BT /F2 7.5 Tf 0.071 0.239 0.224 rg 40 36 Td (Layanan Pensiunan) Tj ET");
  } else {
    lines.push("BT /F1 8 Tf 0.45 0.48 0.55 rg 40 40 Td (Dokumen ini diterbitkan secara elektronik oleh Layanan Pensiunan Enterprise Navigator.) Tj ET");
  }

  const streamContent = lines.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    `6 0 obj\n<< /Length ${Buffer.byteLength(streamContent, "utf8")} >>\nstream\n${streamContent}\nendstream\nendobj\n`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export function generateSimulationSvgBuffer(sim) {
  const r = sim.result || {};
  const isBsi = r.bank_key === "bsi_prapen" || !!r.bsi_details;
  const isCapital = r.bank_key === "bank_capital" || !!r.capital_details;
  const isMestika = r.bank_key === "bank_mestika" || !!r.mestika_details;
  const isAms2 = r.bank_key === "ams2";
  const bsi = r.bsi_details || {};
  const cap = r.capital_details || {};
  const mst = r.mestika_details || {};

  if (isMestika) {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <rect width="900" height="620" fill="#F4F9F4" rx="18"/>
  <rect width="900" height="105" fill="#165B26" rx="18"/>
  <text x="40" y="45" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="20" font-weight="bold">TIGA BERMUDA AMANAH • BANK MESTIKA (TBA-MSTK 1.0)</text>
  <text x="40" y="75" fill="#DCFCE7" font-family="Arial, sans-serif" font-size="13">${sim.sim_no} • ${r.name || "-"} (${mst.age_label || `${r.age} thn`}) • Kredit Pensiun ${mst.product_label || "Reguler"} (${r.bank_rate}% p.a.)</text>

  <rect x="40" y="125" width="400" height="340" fill="#FFFFFF" stroke="#D1E7D5" rx="12"/>
  <text x="60" y="158" fill="#1E7E34" font-family="Arial, sans-serif" font-size="14" font-weight="bold">PARAMETER &amp; GAJI POKOK (DSR 99%)</text>
  <text x="60" y="192" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Jenis Gaji:</text>
  <text x="415" y="192" text-anchor="end" fill="#172C1B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${mst.salary_type_label || "Sesuai Gaji IDPB"}</text>
  <text x="60" y="222" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Gaji Pokok Diakui:</text>
  <text x="415" y="222" text-anchor="end" fill="#172C1B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(mst.basic_salary ?? r.salary)}</text>
  <text x="60" y="252" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Status Tanggungan:</text>
  <text x="415" y="252" text-anchor="end" fill="#172C1B" font-family="Arial, sans-serif" font-size="12" font-weight="bold">${mst.dependent_label || "Tidak Ada Tanggungan"}</text>
  <text x="60" y="282" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Maksimal Tenor:</text>
  <text x="415" y="282" text-anchor="end" fill="#172C1B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${mst.max_tenor ?? r.tenor} bulan (s.d. 79 thn 11 bln)</text>
  <text x="60" y="312" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Plafond Maksimal (Cap):</text>
  <text x="415" y="312" text-anchor="end" fill="#1E7E34" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(mst.max_plafond ?? r.plafond)}</text>
  <text x="60" y="342" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Alternatif Plafond (PV):</text>
  <text x="415" y="342" text-anchor="end" fill="#172C1B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(mst.alt_plafond ?? r.plafond)}</text>

  <rect x="460" y="125" width="400" height="340" fill="#FFFFFF" stroke="#D1E7D5" rx="12"/>
  <text x="480" y="158" fill="#1E7E34" font-family="Arial, sans-serif" font-size="14" font-weight="bold">PENGAJUAN &amp; POTONGAN PENCAIRAN</text>
  <text x="480" y="192" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Plafond / Tenor:</text>
  <text x="835" y="192" text-anchor="end" fill="#172C1B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.plafond)} / ${r.tenor} bln</text>
  <text x="480" y="222" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Angsuran per Bulan:</text>
  <text x="835" y="222" text-anchor="end" fill="#1E7E34" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.coop_installment)}</text>
  <text x="480" y="252" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Biaya Pencairan (${mst.cost_rate_pct ?? 22}%):</text>
  <text x="835" y="252" text-anchor="end" fill="#172C1B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.total_fees)}</text>
  <text x="480" y="282" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Retensi (${mst.retention_multiplier ?? 3}x Angsuran):</text>
  <text x="835" y="282" text-anchor="end" fill="#172C1B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.retention)}</text>
  <text x="480" y="312" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">Pelunasan Take Over (TO):</text>
  <text x="835" y="312" text-anchor="end" fill="#172C1B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.take_over || 0)}</text>
  <text x="480" y="342" fill="#5F7062" font-family="Arial, sans-serif" font-size="13">DSR Angsuran Aktual:</text>
  <text x="835" y="342" text-anchor="end" fill="#1E7E34" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${r.ratio_pct}% (Maks ${mst.dsr_pct ?? 99}%)</text>

  <rect x="40" y="485" width="820" height="95" fill="#1E7E34" rx="14"/>
  <text x="65" y="520" fill="#DCFCE7" font-family="Arial, sans-serif" font-size="13">SISA BERSIH PENCAIRAN (BANK MESTIKA)</text>
  <text x="65" y="558" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="28" font-weight="bold">${fmtRp(r.net_disbursement)}</text>
  <text x="500" y="520" fill="#DCFCE7" font-family="Arial, sans-serif" font-size="13">SISA GAJI (DARI GAJI POKOK)</text>
  <text x="500" y="558" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="28" font-weight="bold">${fmtRp(r.remaining_salary)}</text>
</svg>`;
    return Buffer.from(svg, "utf8");
  }

  if (isCapital) {
    const isCapPensiun = cap.product === "pensiun";
    const maxTenorVal = cap.max_credit_months || cap.credit_months || r.tenor || 0;
    const reqTenorVal = cap.credit_months ?? r.tenor ?? 0;
    const retRowLabel = isCapPensiun ? "Total Retensi (2x Angsuran):" : "Total Retensi:";
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <rect width="900" height="620" fill="#F4F8F6" rx="18"/>
  <rect width="900" height="105" fill="#123D39" rx="18"/>
  <text x="40" y="45" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="20" font-weight="bold">APLIKASI CALC CAPITAL — DASA CIPTA BERKARYA</text>
  <text x="40" y="75" fill="#DCE9E6" font-family="Arial, sans-serif" font-size="13">${sim.sim_no} • ${r.name || "-"} • ${cap.product_label || (isCapPensiun ? "Pensiun" : "Pra Pensiun")} • PS3 CAPITAL</text>
  
  <rect x="40" y="125" width="400" height="340" fill="#FFFFFF" stroke="#D7E5E1" rx="12"/>
  <text x="60" y="158" fill="#07887E" font-family="Arial, sans-serif" font-size="14" font-weight="bold">INFORMASI &amp; RINCIAN TENOR</text>
  <text x="60" y="192" fill="#647572" font-family="Arial, sans-serif" font-size="13">Nama Debitur:</text>
  <text x="415" y="192" text-anchor="end" fill="#172C2A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${r.name || "-"}</text>
  <text x="60" y="222" fill="#647572" font-family="Arial, sans-serif" font-size="13">Tanggal Lahir:</text>
  <text x="415" y="222" text-anchor="end" fill="#172C2A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtDateId(r.birth_date)}</text>
  <text x="60" y="252" fill="#647572" font-family="Arial, sans-serif" font-size="13">Gaji Bulanan:</text>
  <text x="415" y="252" text-anchor="end" fill="#172C2A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.salary)}</text>
  <text x="60" y="282" fill="#647572" font-family="Arial, sans-serif" font-size="13">Batas Usia Kredit:</text>
  <text x="415" y="282" text-anchor="end" fill="#172C2A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtDateId(cap.age_limit_date)}</text>
  <text x="60" y="312" fill="#647572" font-family="Arial, sans-serif" font-size="13">Tenor Kredit Maksimal:</text>
  <text x="415" y="312" text-anchor="end" fill="#172C2A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${maxTenorVal} bulan</text>
  <text x="60" y="342" fill="#647572" font-family="Arial, sans-serif" font-size="13">Tenor Diajukan:</text>
  <text x="415" y="342" text-anchor="end" fill="#07887E" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${reqTenorVal} bulan</text>

  <rect x="460" y="125" width="400" height="340" fill="#FFFFFF" stroke="#D7E5E1" rx="12"/>
  <text x="480" y="158" fill="#07887E" font-family="Arial, sans-serif" font-size="14" font-weight="bold">HASIL SIMULASI</text>
  <text x="480" y="192" fill="#647572" font-family="Arial, sans-serif" font-size="13">Batas Angsuran Maksimal (90%):</text>
  <text x="835" y="192" text-anchor="end" fill="#172C2A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(cap.payment_cap ?? Math.round((r.salary || 0) * 0.9))}</text>
  <text x="480" y="222" fill="#647572" font-family="Arial, sans-serif" font-size="13">Angsuran Aktual:</text>
  <text x="835" y="222" text-anchor="end" fill="#07887E" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(cap.actual_payment ?? r.coop_installment)}</text>
  <text x="480" y="252" fill="#647572" font-family="Arial, sans-serif" font-size="13">Plafon Maksimal:</text>
  <text x="835" y="252" text-anchor="end" fill="#172C2A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(cap.max_loan_pv ?? cap.recommendation_max_loan ?? r.plafond)}</text>
  <text x="480" y="282" fill="#647572" font-family="Arial, sans-serif" font-size="13">Plafon Diajukan:</text>
  <text x="835" y="282" text-anchor="end" fill="#07887E" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(cap.loan ?? r.plafond)}</text>
  <text x="480" y="312" fill="#647572" font-family="Arial, sans-serif" font-size="13">Biaya Kredit:</text>
  <text x="835" y="312" text-anchor="end" fill="#172C2A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(cap.cost ?? r.total_fees)}</text>
  <text x="480" y="342" fill="#647572" font-family="Arial, sans-serif" font-size="13">${retRowLabel}</text>
  <text x="835" y="342" text-anchor="end" fill="#172C2A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(cap.total_retention ?? r.retention)}</text>

  <rect x="40" y="485" width="820" height="95" fill="#07887E" rx="14"/>
  <text x="60" y="518" fill="#DCE9E6" font-family="Arial, sans-serif" font-size="11" font-weight="bold">HIGHLIGHT: PLAFON</text>
  <text x="60" y="552" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="20" font-weight="bold">${fmtRp(cap.loan ?? r.plafond)}</text>
  <text x="275" y="518" fill="#DCE9E6" font-family="Arial, sans-serif" font-size="11" font-weight="bold">TENOR</text>
  <text x="275" y="552" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="20" font-weight="bold">${reqTenorVal} Bulan</text>
  <text x="430" y="518" fill="#DCE9E6" font-family="Arial, sans-serif" font-size="11" font-weight="bold">SISA BERSIH</text>
  <text x="430" y="552" fill="#B9FFF5" font-family="Arial, sans-serif" font-size="20" font-weight="bold">${fmtRp(cap.net_cash ?? r.net_disbursement)}</text>
  <text x="655" y="518" fill="#DCE9E6" font-family="Arial, sans-serif" font-size="11" font-weight="bold">SISA GAJI</text>
  <text x="655" y="552" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="20" font-weight="bold">${fmtRp(cap.salary_left ?? r.remaining_salary)}</text>
</svg>`;
    return Buffer.from(svg, "utf8");
  }

  if (isBsi) {
    const isTriBerkah = bsi.sub_product === "PP3";
    const excelHeaderTitle = isTriBerkah ? "PRA PENSIUN TRI BERKAH" : "PRA PENSIUN DEKADE BERKAH";
    const angsAktif = bsi.active_installment_exact ?? bsi.active_installment ?? r.bank_installment ?? 0;
    const angsPensiun = bsi.pension_installment_exact ?? bsi.pension_installment ?? r.coop_installment ?? 0;
    const biayaAdm = bsi.biaya_adm_exact ?? r.proaq ?? 0;
    const biayaAsuransi = bsi.biaya_asuransi_exact ?? (bsi.is_atribusi ? 0 : (r.risk ?? 0));
    const biayaMaterai = bsi.biaya_materai_exact ?? r.admin_fee ?? 100000;
    const bAktifCnt = bsi.blokir_active_count ?? (isTriBerkah ? (bsi.active_months || 1) : 1);
    const bPensiunCnt = bsi.blokir_pension_count ?? 2;
    const blokirAktif = bsi.blokir_aktif_exact ?? (angsAktif * bAktifCnt);
    const blokirPensiun = bsi.blokir_pensiun_exact ?? (angsPensiun * bPensiunCnt);
    const bukaBlokirLama = bsi.buka_blokir_lama_exact ?? bsi.buka_blokir_lama ?? r.buka_blokir_lama ?? 0;
    const pelunasanLama = bsi.pelunasan_lama_exact ?? bsi.pelunasan_lama ?? r.take_over ?? 0;
    const terimaBersih =
      bsi.sisa_pencairan_bersih_exact ??
      (Number(r.plafond || 0) - biayaAdm - biayaAsuransi - biayaMaterai - blokirAktif - blokirPensiun + bukaBlokirLama - pelunasanLama);

    const bsiExcelRows = [
      { type: "header", label: excelHeaderTitle },
      { type: "blank" },
      { type: "text", label: "Nama Nasabah", colon: ":", val: String(r.name || "-").toUpperCase() },
      { type: "num", label: "Plafond", colon: ":", val: fmtExcelInt(r.plafond), boldVal: true },
      { type: "num", label: "Jangka Waktu", colon: ":", val: String(r.tenor || 0) },
      { type: "blank" },
      { type: "num", label: "Angsuran saat Aktif PNS", colon: ":", val: fmtExcelDec2(angsAktif) },
      { type: "num", label: "Angsuran saat Pensiun", colon: ":", val: fmtExcelDec2(angsPensiun) },
      { type: "blank" },
      { type: "section", label: "Biaya" },
      { type: "num", label: `Administrasi (${r.proaq_pct ?? 1}%)`, colon: ":", val: fmtExcelDec2(biayaAdm) },
      { type: "num", label: "Asuransi", colon: ":", val: fmtExcelDec2(biayaAsuransi, true) },
      { type: "num", label: "Materai", colon: ":", val: fmtExcelDec2(biayaMaterai) },
      { type: "blank" },
      { type: "section", label: "Blokir Angsuran" },
      { type: "num", label: `Blokir ${bAktifCnt}x Angs Masa Aktif`, colon: ":", val: fmtExcelDec2(blokirAktif) },
      { type: "num", label: `Blokir ${bPensiunCnt}x Angs Masa Pensiun`, colon: ":", val: fmtExcelDec2(blokirPensiun) },
      { type: "blank" },
      { type: "num", label: "Buka Blokir Yang Lama", colon: ":", val: fmtExcelDec2(bukaBlokirLama, true) },
      { type: "blank" },
      { type: "num", label: "Pelunasan Yang Lama", colon: ":", val: fmtExcelDec2(pelunasanLama, true) },
      { type: "blank" },
      { type: "footer", label: "Terima Bersih", colon: ":", val: fmtExcelDec2(terimaBersih) }
    ];

    const rowH = 28;
    const boxX = 24;
    const boxY = 24;
    const col1W = 248;
    const col2W = 24;
    const col3W = 228;
    const boxW = col1W + col2W + col3W; // 500
    const totalH = bsiExcelRows.length * rowH;
    const svgW = boxW + 48;
    const svgH = totalH + 48;

    const svgRows = bsiExcelRows
      .map((row, idx) => {
        const y = boxY + idx * rowH;
        const textY = y + 19;
        let bg = "";
        if (row.type === "header") {
          bg =
            `<rect x="${boxX}" y="${y}" width="${boxW}" height="${rowH}" fill="#065F46"/>` +
            `<rect x="${boxX}" y="${y + rowH - 2}" width="${boxW}" height="2" fill="#F59E0B"/>`;
        } else if (row.type === "section") {
          bg = `<rect x="${boxX}" y="${y}" width="${boxW}" height="${rowH}" fill="#F1F5F9"/>`;
        } else if (row.type === "footer") {
          bg =
            `<rect x="${boxX}" y="${y}" width="${boxW}" height="${rowH}" fill="#ECFDF5"/>` +
            `<line x1="${boxX}" y1="${y}" x2="${boxX + boxW}" y2="${y}" stroke="#078D67" stroke-width="1.5"/>`;
        }

        const hLine =
          row.type !== "header"
            ? `<line x1="${boxX}" y1="${y + rowH}" x2="${boxX + boxW}" y2="${y + rowH}" stroke="#E2E8F0" stroke-width="1"/>`
            : "";

        let content = "";
        if (row.type === "header") {
          content = `<text x="${boxX + 14}" y="${textY}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${row.label}</text>`;
        } else if (row.type === "section") {
          content = `<text x="${boxX + 14}" y="${textY}" fill="#065F46" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${row.label}</text>`;
        } else if (row.type === "text") {
          content =
            `<text x="${boxX + 14}" y="${textY}" fill="#334155" font-family="Arial, sans-serif" font-size="13">${row.label}</text>` +
            `<text x="${boxX + col1W + 6}" y="${textY}" fill="#64748B" font-family="Arial, sans-serif" font-size="13">:</text>` +
            `<text x="${boxX + col1W + col2W + 6}" y="${textY}" fill="#0F172A" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${row.val}</text>`;
        } else if (row.type === "num") {
          const isDash = row.val === "-";
          const valX = isDash ? boxX + boxW - 32 : boxX + boxW - 14;
          content =
            `<text x="${boxX + 14}" y="${textY}" fill="#334155" font-family="Arial, sans-serif" font-size="13">${row.label}</text>` +
            `<text x="${boxX + col1W + 6}" y="${textY}" fill="#64748B" font-family="Arial, sans-serif" font-size="13">:</text>` +
            `<text x="${valX}" y="${textY}" text-anchor="end" fill="#0F172A" font-family="Arial, sans-serif" font-size="13"${row.boldVal ? ' font-weight="bold"' : ""}>${row.val}</text>`;
        } else if (row.type === "footer") {
          content =
            `<text x="${boxX + 14}" y="${textY}" fill="#065F46" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${row.label}</text>` +
            `<text x="${boxX + col1W + 6}" y="${textY}" fill="#065F46" font-family="Arial, sans-serif" font-size="14" font-weight="bold">:</text>` +
            `<text x="${boxX + boxW - 14}" y="${textY}" text-anchor="end" fill="#065F46" font-family="Arial, sans-serif" font-size="15" font-weight="bold">${row.val}</text>`;
        }
        return `${bg}${hLine}${content}`;
      })
      .join("\n  ");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <rect width="${svgW}" height="${svgH}" fill="#F8FAFC"/>
  <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${totalH}" fill="#FFFFFF" rx="10"/>
  ${svgRows}
  <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${totalH}" fill="none" stroke="#CBD5E1" stroke-width="1.5" rx="10"/>
</svg>`;
    return Buffer.from(svg, "utf8");
  }

  // Template AMS2 & Mitra Bank
  const ams = r.ams2_details || {};
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <rect width="900" height="620" fill="#F8F9FC" rx="18"/>
  <rect width="900" height="105" fill="#12264D" rx="18"/>
  <text x="40" y="46" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="20" font-weight="bold">${isAms2 ? "KOPERASI ASIA MADANI SEJAHTERA — RINCIAN SIMULASI KREDIT (AMS2)" : "LAYANAN PENSIUNAN — RINGKASAN SIMULASI RESMI"}</text>
  <text x="40" y="76" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="14">${sim.sim_no} • ${r.name || "-"} • ${ams.category_label || r.category || "-"} • Tanggal: ${fmtDateId(r.process_date)}</text>
  <rect x="40" y="128" width="400" height="335" fill="#FFFFFF" stroke="#E2E8F0" rx="12"/>
  <text x="60" y="162" fill="#8C3D9C" font-family="Arial, sans-serif" font-size="14" font-weight="bold">01 INFORMASI DEBITUR &amp; ANGSURAN</text>
  <text x="60" y="196" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Nama Debitur:</text>
  <text x="415" y="196" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${r.name || "-"}</text>
  <text x="60" y="226" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Tanggal Lahir / Usia:</text>
  <text x="415" y="226" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtDateId(r.birth_date)} (${r.age} tahun)</text>
  <text x="60" y="256" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Kategori / Pengajuan:</text>
  <text x="415" y="256" text-anchor="end" fill="#8C3D9C" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${ams.category_label || r.category || "-"} • ${ams.takeover_label || (Number(r.take_over || 0) > 0 ? "Take Over" : "Non Take Over")}</text>
  <text x="60" y="286" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Gaji Bulanan:</text>
  <text x="415" y="286" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.salary)}</text>
  <text x="60" y="316" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Plafon Kredit / Tenor:</text>
  <text x="415" y="316" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.plafond)} / ${r.tenor} bulan</text>
  <text x="60" y="346" fill="#64748B" font-family="Arial, sans-serif" font-size="13">${isAms2 ? "Angsuran Koperasi / Bulan:" : "Angsuran per Bulan:"}</text>
  <text x="415" y="346" text-anchor="end" fill="#8C3D9C" font-family="Arial, sans-serif" font-size="15" font-weight="bold">${fmtRp(r.coop_installment)}</text>

  <rect x="460" y="128" width="400" height="335" fill="#FFFFFF" stroke="#E2E8F0" rx="12"/>
  <text x="480" y="162" fill="#8C3D9C" font-family="Arial, sans-serif" font-size="14" font-weight="bold">02 RINCIAN BIAYA &amp; POTONGAN</text>
  <text x="480" y="196" fill="#64748B" font-family="Arial, sans-serif" font-size="13">${isAms2 ? "Biaya Provisi dan Akuisisi:" : `Provisi (${r.proaq_pct}%):`}</text>
  <text x="835" y="196" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.proaq)}</text>
  <text x="480" y="226" fill="#64748B" font-family="Arial, sans-serif" font-size="13">${isAms2 ? "Cadangan Risiko:" : `Asuransi Jiwa (${r.risk_pct}%):`}</text>
  <text x="835" y="226" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.risk)}</text>
  <text x="480" y="256" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Administrasi:</text>
  <text x="835" y="256" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.admin_fee)}</text>
  <text x="480" y="286" fill="#8C3D9C" font-family="Arial, sans-serif" font-size="13" font-weight="bold">TOTAL BIAYA KREDIT:</text>
  <text x="835" y="286" text-anchor="end" fill="#8C3D9C" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.total_fees)}</text>
  <text x="480" y="316" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Take Over:</text>
  <text x="835" y="316" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.take_over || 0)}</text>
  <text x="480" y="346" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Retensi (3 x angsuran koperasi):</text>
  <text x="835" y="346" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.retention)}</text>

  <rect x="40" y="485" width="820" height="95" fill="#12264D" rx="14"/>
  <text x="65" y="520" fill="#CBD5E1" font-family="Arial, sans-serif" font-size="13">ESTIMASI PENCAIRAN BERSIH</text>
  <text x="65" y="558" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="28" font-weight="bold">${fmtRp(r.net_disbursement)}</text>
  <text x="500" y="520" fill="#CBD5E1" font-family="Arial, sans-serif" font-size="13">SISA GAJI / BULAN</text>
  <text x="500" y="558" fill="#10B981" font-family="Arial, sans-serif" font-size="28" font-weight="bold">${fmtRp(r.remaining_salary)}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}
