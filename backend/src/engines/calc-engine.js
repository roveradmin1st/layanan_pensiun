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

export function computeAgeDetail(birthDateIso, processDateIso = new Date().toISOString().slice(0, 10)) {
  const b = new Date(birthDateIso);
  const p = new Date(processDateIso);
  if (isNaN(b.getTime())) return { years: 0, months: 0, totalMonths: 0, insuranceAge: 0 };
  let years = p.getFullYear() - b.getFullYear();
  let months = p.getMonth() - b.getMonth();
  const days = p.getDate() - b.getDate();
  if (days < 0) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalMonths = Math.max(0, years * 12 + months);
  const insuranceAge = months >= 6 ? years + 1 : years;
  return { years, months, totalMonths, insuranceAge };
}

export function computeSimasInsurance(plafond, birthDateIso, tenorMonths, simasConfig) {
  const ageDetail = computeAgeDetail(birthDateIso);
  const entryAge = Math.min(Math.max(ageDetail.insuranceAge, simasConfig.minEntryAge), simasConfig.maxEntryAge);
  const fullYears = Math.floor(tenorMonths / 12);
  const remMonths = tenorMonths % 12;
  const mult = remMonths > 0 ? (simasConfig.monthMultipliers[remMonths] ?? 1.0) : 0;
  const effectiveYears = Math.min(simasConfig.maxInsuranceYears, Math.ceil(tenorMonths / 12));

  const row = simasConfig.decreasingRateTable[entryAge] || simasConfig.decreasingRateTable[55];
  let ratePerMil = 0;
  if (fullYears <= 0) {
    ratePerMil = (row[0] || 0) * (mult || 1);
  } else if (remMonths === 0) {
    ratePerMil = row[Math.min(fullYears - 1, row.length - 1)] || 0;
  } else {
    const rLow = row[Math.min(fullYears - 1, row.length - 1)] || 0;
    const rHigh = row[Math.min(fullYears, row.length - 1)] || rLow;
    ratePerMil = rLow + mult * (rHigh - rLow);
  }
  const ratePermilRounded = Number(ratePerMil.toFixed(3));
  const premium = Math.round((plafond / 1000) * ratePermilRounded);
  return {
    company: simasConfig.companyName,
    entry_age: entryAge,
    effective_years: effectiveYears,
    rate_permil: ratePermilRounded,
    premium
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

  // 1. Koperasi AMS2
  if (bankKey === "ams2" || cfg.engine === "ams2") {
    if (age >= cfg.maxEntryAgeYears) {
      return {
        processable: false,
        stop_reason: `Usia nasabah (${age} tahun) telah mencapai/melewati batas usia maksimal masuk (${cfg.maxEntryAgeYears} tahun).`,
        name: body.name,
        process_date: processDate,
        age
      };
    }
    const maxEndMonths = cfg.maxEndAgeYears * 12 + (cfg.maxEndAgeMonths || 0);
    const remainingAgeMonths = maxEndMonths - ageObj.totalMonths;
    const maxTenor = Math.min(cfg.maxTenorMonths, remainingAgeMonths);
    if (maxTenor < 12) {
      return {
        processable: false,
        stop_reason: `Sisa masa kredit berdasarkan batas usia (${cfg.maxEndAgeYears} thn ${cfg.maxEndAgeMonths} bln) kurang dari 12 bulan.`,
        name: body.name,
        process_date: processDate,
        age
      };
    }
    const tier = cfg.tiers.find((t) => age >= t.minAge && age <= t.maxAge) || cfg.tiers[cfg.tiers.length - 1];
    const coopRate = tier.coopRateAnnual;
    const maxInstallment = Math.floor(salary * (cfg.maxInstallmentRatio / 100));
    const pvMax = pv(coopRate / 100 / 12, maxTenor, maxInstallment);
    const maxPlafond = Math.min(cfg.maxPlafondAbsolute, Math.floor(pvMax));

    if (takeOver > maxPlafond) {
      return {
        processable: false,
        stop_reason: `Nilai Take Over (Rp${takeOver.toLocaleString("id-ID")}) melebihi Plafond Maksimal (Rp${maxPlafond.toLocaleString("id-ID")}).`,
        name: body.name,
        process_date: processDate,
        age
      };
    }

    return {
      processable: true,
      stop_reason: null,
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      process_date: processDate,
      age,
      age_months: ageObj.months,
      category: tier.name.toUpperCase(),
      coop_rate: coopRate,
      bank_rate: cfg.bankRateAnnual,
      risk_pct: tier.riskReserveRate,
      salary,
      max_installment: maxInstallment,
      max_tenor: maxTenor,
      max_plafond: maxPlafond,
      take_over: takeOver
    };
  }

  // 2. BSI Mitraguna Prima+ Prapensiun (Dekade Berkah PP10 & Tri Berkah PP3 + Simas Jiwa)
  if (bankKey === "bsi_prapen" || cfg.engine === "bsi_simas") {
    const statusGaji = body.bsi_status_gaji || (body.bsi_sub_product === "PP3" ? "non_payroll" : "payroll");
    const subProduct = body.bsi_sub_product || (statusGaji === "non_payroll" ? "PP3" : "PP10");
    const akad = body.bsi_akad || "MMQ"; // MMQ | Murabahah
    const skema = body.bsi_skema || "Non-Atribusi"; // Atribusi | Non-Atribusi
    const bupAge = Number(body.bup_age || cfg.bupAgeDefault || 58);
    const maxEndMonths = cfg.maxEndAgeYears * 12 + (cfg.maxEndAgeMonths || 0);
    const remainingAgeMonths = maxEndMonths - ageObj.totalMonths;
    const maxTenor = Math.min(cfg.maxTenorMonths, remainingAgeMonths);

    if (age < 45 || age > 65 || maxTenor < 12) {
      return {
        processable: false,
        stop_reason: `Usia nasabah (${age} tahun) di luar rentang usia masuk BSI Prapensiun & Asuransi Simas Jiwa (45–65 tahun).`,
        name: body.name,
        process_date: processDate,
        age
      };
    }

    // Hitung pendapatan aktif terbobot BSI jika komponen rincian diberikan (Gambar 2)
    const gp = Number(body.gaji_pokok || 0);
    const um = Number(body.uang_makan || 0);
    const tr1 = Number(body.tunjangan_rutin_1 || 0);
    const tr3 = Number(body.tunjangan_rutin_3 || 0);
    const tl1 = Number(body.tunjangan_lain_1 || 0);
    const tht = Number(body.tht || 0);
    const weights = cfg.incomeWeights || { gajiPokok: 100, uangMakan: 90, tunjanganRutin1Bln: 90, tunjanganRutin3Bln: 50, tunjanganLain1Bln: 80 };

    let recognizedSalary = salary;
    if (gp > 0 || um > 0 || tr1 > 0) {
      recognizedSalary = Math.round(
        (gp * (weights.gajiPokok / 100)) +
        (um * (weights.uangMakan / 100)) +
        (tr1 * (weights.tunjanganRutin1Bln / 100)) +
        (tr3 * (weights.tunjanganRutin3Bln / 100)) +
        (tl1 * (weights.tunjanganLain1Bln / 100))
      );
    }
    if (recognizedSalary <= 0) recognizedSalary = salary;

    const pensionSalary = Number(body.pension_salary || body.pensiun || Math.round((gp || salary) * 0.75));

    // DBR Aktif: 70% untuk Payroll (BSI), 50% untuk Non Payroll
    const dbrActiveRate = statusGaji === "non_payroll"
      ? (cfg.dbrActiveNonPayroll || 50.0)
      : (cfg.dbrActivePayroll || 70.0);

    const maxInstallmentActive = Math.floor(recognizedSalary * (dbrActiveRate / 100));
    const maxInstallmentPension = Math.floor(pensionSalary * (cfg.dsrPensionMax / 100));
    const tierPricing = subProduct === "PP3" ? cfg.pricingTiers.triNettAbove200 : cfg.pricingTiers.dekadeNettAbove200;
    let rateAnnual = tierPricing.rateActiveAnnual;
    let ratePensionAnnual = tierPricing.ratePensionAnnual;
    if (skema === "Atribusi") {
      rateAnnual += cfg.atribusiAdjustments.pp10ActiveRateAdd;
      ratePensionAnnual += cfg.atribusiAdjustments.pp10PensionRateAdd;
    }
    const pvMaxActive = pv(rateAnnual / 100 / 12, maxTenor, maxInstallmentActive);
    const pvMaxPension = pv(ratePensionAnnual / 100 / 12, maxTenor, maxInstallmentPension);
    const pvMax = Math.min(pvMaxActive, pvMaxPension);
    const maxPlafond = Math.min(cfg.maxPlafondAbsolute, Math.floor(pvMax / 1000000) * 1000000);

    const subProductLabel = subProduct === "PP3" ? "Prapen 3 Tahun (Non Payroll)" : "Prapen 10 Tahun (Payroll)";
    const statusGajiLabel = statusGaji === "non_payroll" ? "Non Payroll" : "Payroll (BSI)";

    return {
      processable: true,
      stop_reason: null,
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      process_date: processDate,
      age,
      age_months: ageObj.months,
      category: `${subProductLabel} • ${statusGajiLabel} • ${akad} (${skema})`,
      bsi_status_gaji: statusGaji,
      bsi_status_gaji_label: statusGajiLabel,
      bsi_sub_product: subProduct,
      bsi_sub_product_label: subProductLabel,
      dbr_active_rate: dbrActiveRate,
      coop_rate: tierPricing.ratePensionAnnual,
      bank_rate: tierPricing.rateActiveAnnual,
      salary: recognizedSalary,
      salary_raw: salary,
      pension_salary: pensionSalary,
      max_installment: maxInstallmentActive,
      max_installment_pension: maxInstallmentPension,
      max_tenor: maxTenor,
      max_plafond: maxPlafond,
      take_over: takeOver,
      tht
    };
  }

  // 3. Mitra Bank Konvensional (Bank Capital, Mandiri Taspen, Bank MNC, BNI, Mestika)
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

  // 1. Koperasi AMS2
  if (bankKey === "ams2" || cfg.engine === "ams2") {
    const tier = cfg.tiers.find((t) => mx.age >= t.minAge && mx.age <= t.maxAge) || cfg.tiers[cfg.tiers.length - 1];
    const bankRate = cfg.bankRateAnnual;
    const coopRate = tier.coopRateAnnual;
    const bankInstallment = Math.round(pmt(bankRate / 100 / 12, tenor, plafond));
    const coopInstallment = Math.round(pmt(coopRate / 100 / 12, tenor, plafond));
    const baa = Math.max(0, coopInstallment - bankInstallment);
    const ratioPct = salary > 0 ? Number(((coopInstallment / salary) * 100).toFixed(2)) : 0;

    const proaqPct = cfg.proaqRate;
    const riskPct = tier.riskReserveRate;
    const proaq = Math.round(plafond * (proaqPct / 100));
    const risk = Math.round(plafond * (riskPct / 100));
    const adminFee = cfg.adminFee;
    const tlFee = Math.round(plafond * (tlPct / 100));
    const totalFees = proaq + risk + adminFee + tlFee;
    const retention = coopInstallment * (cfg.retentionMultiplier || 3);
    const netDisbursement = plafond - totalFees - takeOver - retention;
    const remainingSalary = salary - coopInstallment;

    const validations = [
      { key: "age", label: `Usia masuk < ${cfg.maxEntryAgeYears} tahun`, ok: mx.age < cfg.maxEntryAgeYears },
      { key: "end_age", label: `Usia lunas ≤ ${cfg.maxEndAgeYears} th ${cfg.maxEndAgeMonths} bln`, ok: tenor <= mx.max_tenor },
      { key: "tenor", label: `Tenor ≤ ${cfg.maxTenorMonths} bulan`, ok: tenor >= 12 && tenor <= cfg.maxTenorMonths && tenor <= mx.max_tenor },
      { key: "plafond", label: `Plafond ≤ Rp${(cfg.maxPlafondAbsolute / 1e6).toFixed(0)} Juta & Plafond Maks`, ok: plafond > 0 && plafond <= cfg.maxPlafondAbsolute && plafond <= mx.max_plafond },
      { key: "ratio", label: `Rasio angsuran ≤ ${cfg.maxInstallmentRatio}% gaji`, ok: ratioPct <= cfg.maxInstallmentRatio },
      { key: "tl", label: `Tata Laksana 0% – ${cfg.tataLaksanaMax}%`, ok: tlPct >= cfg.tataLaksanaMin && tlPct <= cfg.tataLaksanaMax },
      { key: "net", label: "Sisa pencairan bersih positif (> Rp0)", ok: netDisbursement > 0 }
    ];
    const overallOk = validations.every((v) => v.ok);
    validations.push({ key: "overall", label: "Status Kelayakan Akhir", ok: overallOk });

    const issues = validations.filter((v) => !v.ok && v.key !== "overall").map((v) => `Ketentuan tidak terpenuhi: ${v.label}`);

    return {
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      birth_date: body.birth_date,
      process_date: mx.process_date,
      age: mx.age,
      category: tier.name.toUpperCase(),
      plafond,
      tenor,
      bank_rate: bankRate,
      coop_rate: coopRate,
      salary,
      take_over: takeOver,
      tata_laksana_pct: tlPct,
      bank_installment: bankInstallment,
      coop_installment: coopInstallment,
      baa,
      ratio_pct: ratioPct,
      proaq_pct: proaqPct,
      proaq,
      risk_pct: riskPct,
      risk,
      admin_fee: adminFee,
      tata_laksana_fee: tlFee,
      total_fees: totalFees,
      retention_multiplier: cfg.retentionMultiplier || 3,
      retention,
      net_disbursement: netDisbursement,
      remaining_salary: remainingSalary,
      validations,
      overall_ok: overallOk,
      issues
    };
  }

  // 2. BSI Mitraguna Prima+ Prapensiun + Simas Jiwa
  if (bankKey === "bsi_prapen" || cfg.engine === "bsi_simas") {
    const statusGaji = body.bsi_status_gaji || (body.bsi_sub_product === "PP3" ? "non_payroll" : "payroll");
    const subProduct = body.bsi_sub_product || (statusGaji === "non_payroll" ? "PP3" : "PP10");
    const akad = body.bsi_akad || "MMQ";
    const skema = body.bsi_skema || "Non-Atribusi";
    const bupAge = Number(body.bup_age || cfg.bupAgeDefault || 58);
    const ageDetail = computeAgeDetail(body.birth_date, mx.process_date);

    // Hitung pendapatan aktif terbobot BSI
    const gp = Number(body.gaji_pokok || 0);
    const um = Number(body.uang_makan || 0);
    const tr1 = Number(body.tunjangan_rutin_1 || 0);
    const tr3 = Number(body.tunjangan_rutin_3 || 0);
    const tl1 = Number(body.tunjangan_lain_1 || 0);
    const tht = Number(body.tht || 0);
    const nip = body.nip || "";
    const weights = cfg.incomeWeights || { gajiPokok: 100, uangMakan: 90, tunjanganRutin1Bln: 90, tunjanganRutin3Bln: 50, tunjanganLain1Bln: 80 };

    let recognizedSalary = salary;
    if (gp > 0 || um > 0 || tr1 > 0) {
      recognizedSalary = Math.round(
        (gp * (weights.gajiPokok / 100)) +
        (um * (weights.uangMakan / 100)) +
        (tr1 * (weights.tunjanganRutin1Bln / 100)) +
        (tr3 * (weights.tunjanganRutin3Bln / 100)) +
        (tl1 * (weights.tunjanganLain1Bln / 100))
      );
    }
    if (recognizedSalary <= 0) recognizedSalary = salary;

    const pensionSalary = Number(body.pension_salary || body.pensiun || Math.round((gp || salary) * 0.75));

    // DBR Aktif: 70% untuk Payroll, 50% untuk Non Payroll
    const dbrActiveRate = statusGaji === "non_payroll"
      ? (cfg.dbrActiveNonPayroll || 50.0)
      : (cfg.dbrActivePayroll || 70.0);

    // Hitung sisa masa aktif ke BUP
    let remainingToBupMonths = Math.max(1, (bupAge * 12) - ageDetail.totalMonths);
    if (body.tmt_pensiun_year || body.bup_year) {
      const bupYr = Number(body.tmt_pensiun_year || body.bup_year);
      const procD = new Date(mx.process_date);
      const curYr = procD.getFullYear();
      const curMo = procD.getMonth();
      remainingToBupMonths = Math.max(1, (bupYr - curYr) * 12 - curMo);
    }

    // Batasan masa aktif: PP3 (Non Payroll) maks 36 bln (3 thn), PP10 (Payroll) maks 120 bln (10 thn)
    const maxActiveMonthsLimit = subProduct === "PP3" ? 36 : 120;
    const activeMonths = Math.max(1, Math.min(tenor, Math.min(remainingToBupMonths, maxActiveMonthsLimit)));
    const pensionMonths = Math.max(0, tenor - activeMonths);

    // Jadwal proyeksi (sesuai Gambar 2):
    const procD = new Date(mx.process_date);
    const cairDateStr = procD.toISOString().slice(0, 10);
    const startAngsuranDate = new Date(procD.getFullYear(), procD.getMonth() + 1, 1);
    const startAngsuranStr = startAngsuranDate.toISOString().slice(0, 10);
    const selesaiAngsuranDate = new Date(startAngsuranDate.getFullYear(), startAngsuranDate.getMonth() + tenor - 1, 1);
    const selesaiAngsuranStr = selesaiAngsuranDate.toISOString().slice(0, 10);

    const tierPricing = plafond < 200000000
      ? cfg.pricingTiers.below200
      : (subProduct === "PP3" ? cfg.pricingTiers.triNettAbove200 : cfg.pricingTiers.dekadeNettAbove200);

    let rateActive = tierPricing.rateActiveAnnual;
    let ratePension = tierPricing.ratePensionAnnual;
    if (skema === "Atribusi") {
      rateActive += cfg.atribusiAdjustments.pp10ActiveRateAdd;
      ratePension += cfg.atribusiAdjustments.pp10PensionRateAdd;
    }

    const activeInstallment = subProduct === "PP3"
      ? Math.round((plafond * (rateActive / 100 / 12)) + cfg.atribusiAdjustments.pp3PokokTetapAktif)
      : Math.round(pmt(rateActive / 100 / 12, tenor, plafond));
    const pensionInstallment = Math.round(pmt(ratePension / 100 / 12, tenor, plafond));

    const simas = computeSimasInsurance(plafond, body.birth_date, tenor, cfg.simasInsurance);
    const adminFee = Math.round(plafond * (cfg.fees.adminRatePercent / 100));
    const materaiFee = cfg.fees.materaiFee;
    // BSI tidak memiliki biaya Tata Laksana (Tata Laksana hanya untuk Koperasi)
    const tlFee = 0;
    const totalFees = adminFee + simas.premium + materaiFee;
    const retention = (activeInstallment * cfg.fees.blokirActiveCount) + (pensionInstallment * cfg.fees.blokirPensionCount);
    const netDisbursement = plafond - totalFees - takeOver - retention;
    const ratioActivePct = recognizedSalary > 0 ? Number(((activeInstallment / recognizedSalary) * 100).toFixed(2)) : 0;
    const ratioPensionPct = pensionSalary > 0 ? Number(((pensionInstallment / pensionSalary) * 100).toFixed(2)) : 0;
    const remainingSalary = recognizedSalary - activeInstallment;
    const sisaGajiPensiun = pensionSalary - pensionInstallment;

    const subProductLabel = subProduct === "PP3" ? "Prapen 3 Tahun (Non Payroll)" : "Prapen 10 Tahun (Payroll)";
    const statusGajiLabel = statusGaji === "non_payroll" ? "Non Payroll" : "Payroll (BSI)";

    const validations = [
      { key: "age", label: "Usia masuk Simas Prapensiun (45–65 th)", ok: mx.age >= 45 && mx.age <= 65 },
      { key: "end_age", label: `Usia jatuh tempo ≤ ${cfg.maxEndAgeYears} th ${cfg.maxEndAgeMonths} bln`, ok: tenor <= mx.max_tenor },
      { key: "plafond", label: `Plafond ≤ Rp${(cfg.maxPlafondAbsolute / 1e6).toFixed(0)} Juta`, ok: plafond <= cfg.maxPlafondAbsolute },
      { key: "dbr_active", label: `DBR Masa Aktif (${statusGajiLabel}) ≤ ${dbrActiveRate}%`, ok: ratioActivePct <= dbrActiveRate },
      { key: "dsr_pension", label: `DSR Masa Pensiun ≤ ${cfg.dsrPensionMax}% gaji pensiun`, ok: ratioPensionPct <= cfg.dsrPensionMax },
      { key: "active_tenor", label: `Masa Aktif ≤ ${maxActiveMonthsLimit / 12} tahun (${maxActiveMonthsLimit} bulan)`, ok: activeMonths <= maxActiveMonthsLimit },
      { key: "net", label: "Pencairan bersih positif (> Rp0)", ok: netDisbursement > 0 }
    ];
    const overallOk = validations.every((v) => v.ok);
    validations.push({ key: "overall", label: "Status Kelayakan Akhir BSI NOS + Simas", ok: overallOk });
    const issues = validations.filter((v) => !v.ok && v.key !== "overall").map((v) => `Ketentuan BSI/Simas tidak terpenuhi: ${v.label}`);

    return {
      bank_key: bankKey,
      bank_name: cfg.name,
      name: body.name,
      nip,
      birth_date: body.birth_date,
      process_date: mx.process_date,
      age: mx.age,
      category: `${subProductLabel} • ${statusGajiLabel} • ${akad} (${skema})`,
      plafond,
      tenor,
      bank_rate: rateActive,
      coop_rate: ratePension,
      salary: recognizedSalary,
      salary_raw: salary,
      pension_salary: pensionSalary,
      take_over: takeOver,
      tata_laksana_pct: 0,
      bank_installment: activeInstallment,
      coop_installment: pensionInstallment,
      baa: Math.abs(pensionInstallment - activeInstallment),
      ratio_pct: ratioActivePct,
      ratio_pension_pct: ratioPensionPct,
      proaq_pct: cfg.fees.adminRatePercent,
      proaq: adminFee,
      risk_pct: Number((simas.rate_permil / 10).toFixed(2)),
      risk: simas.premium,
      admin_fee: materaiFee,
      tata_laksana_fee: 0,
      total_fees: totalFees,
      retention_multiplier: cfg.fees.blokirActiveCount + cfg.fees.blokirPensionCount,
      retention,
      net_disbursement: netDisbursement,
      remaining_salary: remainingSalary,
      bsi_details: {
        status_gaji: statusGaji,
        status_gaji_label: statusGajiLabel,
        sub_product: subProduct,
        sub_product_label: subProductLabel,
        akad,
        skema,
        bup_age: bupAge,
        nip,
        tht,
        gaji_pokok: gp,
        uang_makan: um,
        tunjangan_rutin_1: tr1,
        active_months: activeMonths,
        pension_months: pensionMonths,
        margin_aktif: rateActive,
        margin_pensiun: ratePension,
        active_installment: activeInstallment,
        pension_installment: pensionInstallment,
        sisa_gaji_pensiun: sisaGajiPensiun,
        sisa_gaji_aktif: remainingSalary,
        biaya_adm: adminFee,
        biaya_adm_pct: cfg.fees.adminRatePercent,
        biaya_asuransi: simas.premium,
        biaya_materai: materaiFee,
        blokir_angsuran: retention,
        sisa_pencairan_bersih: netDisbursement,
        taksasi_mmq: Math.ceil((plafond * (1 + cfg.fees.taksasiMmqMarkupPercent / 100)) / 1000000) * 1000000,
        proyeksi_cair: cairDateStr,
        start_angsuran: startAngsuranStr,
        selesai_angsuran: selesaiAngsuranStr,
        dbr_active_rate: dbrActiveRate,
        dsr_pension_rate: cfg.dsrPensionMax,
        simas
      },
      validations,
      overall_ok: overallOk,
      issues
    };
  }

  // 3. Mitra Bank Konvensional
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

export function generateSimulationPdfBuffer(sim) {
  const r = sim.result || {};
  const isBsi = r.bank_key === "bsi_prapen" || !!r.bsi_details;
  const isAms2 = r.bank_key === "ams2";
  const bsi = r.bsi_details || {};
  const lines = [];

  const headerTitle = isBsi
    ? "LAYANAN PENSIUNAN - SIMULASI BSI PRAPENSIUN (NOS v1.4.6)"
    : isAms2
    ? "LAYANAN PENSIUNAN - HASIL SIMULASI KOPERASI AMS2"
    : `LAYANAN PENSIUNAN - HASIL SIMULASI ${(r.bank_name || "").toUpperCase()}`;

  lines.push("q 0.208 0.063 0.502 rg 0 760 595 82 re f Q");
  lines.push(`BT /F2 14 Tf 1 1 1 rg 40 805 Td (${pdfEscape(headerTitle)}) Tj ET`);
  lines.push(`BT /F1 9 Tf 0.9 0.9 0.95 rg 40 785 Td (No. Simulasi: ${pdfEscape(sim.sim_no)}   |   Mitra: ${pdfEscape(r.bank_name || (isBsi ? "BSI" : "AMS2"))}   |   Petugas: ${pdfEscape(sim.created_by_name)}) Tj ET`);

  let rows = [];

  if (isBsi) {
    // 100% Terminologi Resmi BSI Prapensiun
    rows = [
      ["IDENTITAS DEBITUR (BSI PRAPENSIUN)", ""],
      ["Nama Debitur", r.name],
      ["NIP Calon Debitur", bsi.nip || "-"],
      ["Status Gaji", bsi.status_gaji_label || "Payroll (BSI)"],
      ["Sub-Produk BSI", bsi.sub_product_label || "Prapen 10 Tahun (Payroll)"],
      ["Akad & Skema", `${bsi.akad || "MMQ"} (${bsi.skema || "Atribusi"})`],
      ["Tanggal Proses / Usia", `${r.process_date} (${r.age} Tahun)`],
      ["PARAMETER PEMBIAYAAN & JADWAL PROYEKSI", ""],
      ["Plafond Pembiayaan", fmtRp(r.plafond)],
      ["Tenor Total", `${r.tenor} Bulan (${bsi.active_months || 0} bln Aktif + ${bsi.pension_months || 0} bln Pensiun)`],
      ["Proyeksi Tanggal Cair", bsi.proyeksi_cair || "-"],
      ["Mulai Angsuran", bsi.start_angsuran || "-"],
      ["Selesai Angsuran", bsi.selesai_angsuran || "-"],
      ["Margin Masa Aktif", `${r.bank_rate}% per tahun`],
      ["Margin Masa Pensiun", `${r.coop_rate}% per tahun`],
      ["Gaji Masa Aktif Diakui", fmtRp(r.salary)],
      ["Estimasi Gaji Pensiun", fmtRp(r.pension_salary)],
      ["Tabungan Hari Tua (THT)", fmtRp(bsi.tht || 0)],
      ["RINCIAN ANGSURAN BSI", ""],
      ["Angsuran Masa Aktif", fmtRp(bsi.active_installment || r.bank_installment)],
      ["Angsuran Masa Pensiun", fmtRp(bsi.pension_installment || r.coop_installment)],
      ["Sisa Gaji Pensiun", fmtRp(bsi.sisa_gaji_pensiun || (r.pension_salary - r.coop_installment))],
      ["DBR Masa Aktif", `${r.ratio_pct}% (Maks ${bsi.dbr_active_rate || 70}%)`],
      ["DSR Masa Pensiun", `${r.ratio_pension_pct || 0}% (Maks 90%)`],
      ["RINCIAN BIAYA PEMBIAYAAN", ""],
      [`Biaya ADM (${r.proaq_pct}%)`, fmtRp(r.proaq)],
      [`Biaya Asuransi Simas Jiwa (${r.risk_pct}%)`, fmtRp(r.risk)],
      ["Biaya Materai", fmtRp(r.admin_fee)],
      ["Total Biaya Pembiayaan", fmtRp(r.total_fees)],
      ["Nilai Take Over (TO)", fmtRp(r.take_over)],
      ["Blokir Angsuran (1x Aktif + 2x Pensiun)", fmtRp(r.retention)],
      ["HASIL AKHIR PENCAIRAN", ""],
      ["TERIMA BERSIH NASABAH (NET DISBURSEMENT)", fmtRp(r.net_disbursement)],
      ["SISA GAJI PENSIUN", fmtRp(bsi.sisa_gaji_pensiun || (r.pension_salary - r.coop_installment))],
      ["SISA GAJI MASA AKTIF", fmtRp(r.remaining_salary)]
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
      lines.push(`q 0.95 0.96 0.98 rg 40 ${y - 4} 515 18 re f Q`);
      lines.push(`BT /F2 10 Tf 0.208 0.063 0.502 rg 46 ${y} Td (${pdfEscape(k)}) Tj ET`);
      y -= 20;
    } else {
      const isStrong = k.includes("TERIMA BERSIH") || k.includes("SISA GAJI");
      lines.push(`BT /${isStrong ? "F2" : "F1"} 10 Tf 0.1 0.13 0.23 rg 46 ${y} Td (${pdfEscape(k)}) Tj ET`);
      lines.push(`BT /F2 10 Tf ${isStrong ? "0.027 0.553 0.404" : "0.1 0.13 0.23"} rg 360 ${y} Td (${pdfEscape(v)}) Tj ET`);
      y -= 17;
    }
  }

  lines.push("BT /F1 8 Tf 0.45 0.48 0.55 rg 40 40 Td (Dokumen ini diterbitkan secara elektronik oleh Layanan Pensiunan Enterprise Navigator.) Tj ET");

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
  const isAms2 = r.bank_key === "ams2";
  const bsi = r.bsi_details || {};

  if (isBsi) {
    const sisaGajiPensiun = bsi.sisa_gaji_pensiun || (r.pension_salary - r.coop_installment);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <rect width="900" height="620" fill="#F8F9FC" rx="18"/>
  <rect width="900" height="105" fill="#078D67" rx="18"/>
  <text x="40" y="45" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="20" font-weight="bold">BSI PRAPENSIUN — SIMULASI RESMI NOS v1.4.6</text>
  <text x="40" y="75" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="13">${sim.sim_no} • ${r.name || "-"} • ${bsi.status_gaji_label || "Payroll"} • ${bsi.sub_product_label || "PP10"}</text>
  
  <rect x="40" y="125" width="400" height="340" fill="#FFFFFF" stroke="#E2E8F0" rx="12"/>
  <text x="60" y="158" fill="#078D67" font-family="Arial, sans-serif" font-size="14" font-weight="bold">PARAMETER &amp; ANGSURAN BSI</text>
  <text x="60" y="192" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Plafond Pembiayaan:</text>
  <text x="415" y="192" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.plafond)}</text>
  <text x="60" y="222" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Pembagian Tenor:</text>
  <text x="415" y="222" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${bsi.active_months || 0} bln Aktif + ${bsi.pension_months || 0} bln Pensiun</text>
  <text x="60" y="252" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Margin Aktif / Pensiun:</text>
  <text x="415" y="252" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${r.bank_rate}% / ${r.coop_rate}% p.a.</text>
  <text x="60" y="282" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Angsuran Masa Aktif:</text>
  <text x="415" y="282" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(bsi.active_installment || r.bank_installment)}</text>
  <text x="60" y="312" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Angsuran Masa Pensiun:</text>
  <text x="415" y="312" text-anchor="end" fill="#078D67" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${fmtRp(bsi.pension_installment || r.coop_installment)}</text>
  <text x="60" y="342" fill="#64748B" font-family="Arial, sans-serif" font-size="13">DBR Aktif / DSR Pensiun:</text>
  <text x="415" y="342" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${r.ratio_pct}% / ${r.ratio_pension_pct || 0}%</text>
  <text x="60" y="372" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Sisa Gaji Pensiun:</text>
  <text x="415" y="372" text-anchor="end" fill="#078D67" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(sisaGajiPensiun)}</text>

  <rect x="460" y="125" width="400" height="340" fill="#FFFFFF" stroke="#E2E8F0" rx="12"/>
  <text x="480" y="158" fill="#F28A19" font-family="Arial, sans-serif" font-size="14" font-weight="bold">BIAYA PEMBIAYAAN &amp; PENGURANG</text>
  <text x="480" y="192" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Biaya ADM (1%):</text>
  <text x="835" y="192" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.proaq)}</text>
  <text x="480" y="222" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Asuransi Simas Jiwa:</text>
  <text x="835" y="222" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.risk)}</text>
  <text x="480" y="252" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Biaya Materai:</text>
  <text x="835" y="252" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.admin_fee)}</text>
  <text x="480" y="282" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Total Biaya Pembiayaan:</text>
  <text x="835" y="282" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.total_fees)}</text>
  <text x="480" y="312" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Nilai Take Over (TO):</text>
  <text x="835" y="312" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.take_over || 0)}</text>
  <text x="480" y="342" fill="#64748B" font-family="Arial, sans-serif" font-size="13">Blokir Angsuran (1x Aktif + 2x Pen):</text>
  <text x="835" y="342" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${fmtRp(r.retention || 0)}</text>

  <rect x="40" y="485" width="820" height="95" fill="#078D67" rx="14"/>
  <text x="65" y="520" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="13">SISA PENCAIRAN BERSIH NASABAH</text>
  <text x="65" y="558" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="28" font-weight="bold">${fmtRp(r.net_disbursement)}</text>
  <text x="500" y="520" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="13">SISA GAJI PENSIUN BULANAN</text>
  <text x="500" y="558" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="28" font-weight="bold">${fmtRp(sisaGajiPensiun)}</text>
</svg>`;
    return Buffer.from(svg, "utf8");
  }

  // Template AMS2 & Mitra Bank
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <rect width="900" height="620" fill="#F8F9FC" rx="18"/>
  <rect width="900" height="105" fill="#351080" rx="18"/>
  <text x="40" y="48" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="22" font-weight="bold">LAYANAN PENSIUNAN — RINGKASAN SIMULASI RESMI</text>
  <text x="40" y="78" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="14">${sim.sim_no} • ${r.name || "-"} • ${r.category || "-"} • ${r.bank_name || "AMS2"}</text>
  <rect x="40" y="130" width="400" height="330" fill="#FFFFFF" stroke="#E2E8F0" rx="12"/>
  <text x="60" y="165" fill="#351080" font-family="Arial, sans-serif" font-size="14" font-weight="bold">PARAMETER &amp; ANGSURAN</text>
  <text x="60" y="200" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Plafond Pengajuan:</text>
  <text x="415" y="200" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${fmtRp(r.plafond)}</text>
  <text x="60" y="232" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Tenor &amp; Usia:</text>
  <text x="415" y="232" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${r.tenor} bln (${r.age} thn)</text>
  <text x="60" y="264" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Gaji Bulanan:</text>
  <text x="415" y="264" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${fmtRp(r.salary)}</text>
  <text x="60" y="296" fill="#64748B" font-family="Arial, sans-serif" font-size="14">${isAms2 ? "Angsuran Bank:" : "Bunga Kredit:"}</text>
  <text x="415" y="296" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${isAms2 ? fmtRp(r.bank_installment) : `${r.bank_rate}% p.a.`}</text>
  <text x="60" y="328" fill="#64748B" font-family="Arial, sans-serif" font-size="14">${isAms2 ? "Angsuran Koperasi:" : "Angsuran per Bulan:"}</text>
  <text x="415" y="328" text-anchor="end" fill="#351080" font-family="Arial, sans-serif" font-size="15" font-weight="bold">${fmtRp(r.coop_installment)}</text>
  <text x="60" y="360" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Rasio Angsuran:</text>
  <text x="415" y="360" text-anchor="end" fill="#078D67" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${r.ratio_pct}%</text>

  <rect x="460" y="130" width="400" height="330" fill="#FFFFFF" stroke="#E2E8F0" rx="12"/>
  <text x="480" y="165" fill="#F28A19" font-family="Arial, sans-serif" font-size="14" font-weight="bold">RINCIAN BIAYA &amp; POTONGAN</text>
  <text x="480" y="200" fill="#64748B" font-family="Arial, sans-serif" font-size="14">${isAms2 ? `PROAQ (${r.proaq_pct}%):` : `Provisi (${r.proaq_pct}%):`}</text>
  <text x="835" y="200" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${fmtRp(r.proaq)}</text>
  <text x="480" y="232" fill="#64748B" font-family="Arial, sans-serif" font-size="14">${isAms2 ? `Cadangan Risiko (${r.risk_pct}%):` : `Asuransi Jiwa (${r.risk_pct}%):`}</text>
  <text x="835" y="232" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${fmtRp(r.risk)}</text>
  <text x="480" y="264" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Biaya Administrasi:</text>
  <text x="835" y="264" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${fmtRp(r.admin_fee)}</text>
  <text x="480" y="296" fill="#64748B" font-family="Arial, sans-serif" font-size="14">${isAms2 ? `Tata Laksana (${r.tata_laksana_pct}%):` : "Total Biaya Kredit:"}</text>
  <text x="835" y="296" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${isAms2 ? fmtRp(r.tata_laksana_fee) : fmtRp(r.total_fees)}</text>
  <text x="480" y="328" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Take Over &amp; Retensi:</text>
  <text x="835" y="328" text-anchor="end" fill="#17223B" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${fmtRp((r.take_over || 0) + (r.retention || 0))}</text>

  <rect x="40" y="485" width="820" height="95" fill="#351080" rx="14"/>
  <text x="65" y="520" fill="#CBD5E1" font-family="Arial, sans-serif" font-size="13">HASIL PENCAIRAN — SISA PENCAIRAN BERSIH</text>
  <text x="65" y="558" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="28" font-weight="bold">${fmtRp(r.net_disbursement)}</text>
  <text x="500" y="520" fill="#CBD5E1" font-family="Arial, sans-serif" font-size="13">SISA GAJI SETELAH ANGSURAN</text>
  <text x="500" y="558" fill="#10B981" font-family="Arial, sans-serif" font-size="28" font-weight="bold">${fmtRp(r.remaining_salary)}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}
