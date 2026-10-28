// ============================================================================
// DYNAMIC PARTNER BANK ENGINE
// Mesin kalkulasi fleksibel untuk mitra bank (Capital/Aladin, Mandiri Taspen,
// Bank MNC, Bank BNI, Bank Mestika, dll.) yang parameternya dapat diedit penuh
// oleh Super Admin.
// ============================================================================

window.PartnerBankEngine = {
  calculate(input, bankConfig) {
    const cfg = bankConfig;
    const dob = window.AMS2Engine.parseDate(input.dob);
    const processDate = window.AMS2Engine.parseDate(input.processDate) || new Date();
    const ageDetail = window.AMS2Engine.getAgeDetail(dob, processDate);
    const ageYears = ageDetail ? ageDetail.years : null;

    const salary = Math.max(0, Number(input.salary) || 0);
    const requestedPlafond = Math.max(0, Number(input.plafond) || 0);
    const requestedTenor = Math.max(0, Math.floor(Number(input.tenor) || 0));
    const takeOverAmount = input.isTakeOver ? Math.max(0, Number(input.takeOverAmount) || 0) : 0;

    // 1. Tenor maksimal berdasarkan batas usia lunas mitra bank
    let maxTenorByAge = 0;
    let maxEndDate = null;
    if (dob && processDate) {
      maxEndDate = window.AMS2Engine.addYearsMonths(dob, cfg.maxEndAgeYears, cfg.maxEndAgeMonths || 0);
      let diffMonths =
        (maxEndDate.getFullYear() - processDate.getFullYear()) * 12 +
        (maxEndDate.getMonth() - processDate.getMonth());
      const candidateEnd = window.AMS2Engine.addYearsMonths(processDate, 0, Math.max(0, diffMonths));
      if (candidateEnd > maxEndDate) diffMonths -= 1;
      maxTenorByAge = Math.max(0, Math.min(Number(cfg.maxTenorMonths), diffMonths));
    }

    const maxInstallmentRatio = Number(cfg.maxInstallmentRatio) || 90;
    const maxInstallment = salary * (maxInstallmentRatio / 100);
    const annualRate = Number(cfg.interestRateAnnual) || 12;
    const monthlyRate = (annualRate / 100) / 12;

    const effectiveTenorForRec = requestedTenor > 0
      ? Math.min(requestedTenor, maxTenorByAge || Number(cfg.maxTenorMonths))
      : maxTenorByAge;

    let maxPlafond = 0;
    if (salary > 0 && effectiveTenorForRec > 0 && ageYears !== null && ageYears <= Number(cfg.maxEntryAgeYears)) {
      const pvVal = window.AMS2Engine.pv(monthlyRate, effectiveTenorForRec, maxInstallment);
      maxPlafond = Math.min(Number(cfg.maxPlafondAbsolute), Math.floor(pvVal));
    }

    const hasCoreInput = Boolean(dob && processDate && salary > 0 && requestedPlafond > 0 && requestedTenor > 0);
    let installment = 0;
    let provisionFee = 0;
    let insuranceFee = 0;
    let adminFee = Number(cfg.adminFee) || 500000;
    let tataLaksanaFee = 0;
    let totalCreditCost = 0;
    let retentionAmount = 0;
    let netDisbursement = 0;
    let remainingSalary = 0;
    let actualInstallmentRatio = 0;

    if (hasCoreInput) {
      installment = window.AMS2Engine.pmt(monthlyRate, requestedTenor, requestedPlafond);
      provisionFee = Math.round(requestedPlafond * (Number(cfg.provisionRatePercent) / 100));
      insuranceFee = Math.round(requestedPlafond * (Number(cfg.insuranceRatePercent) / 100));
      tataLaksanaFee = Math.round(requestedPlafond * (Number(cfg.tataLaksanaRatePercent || 0) / 100));
      totalCreditCost = provisionFee + insuranceFee + adminFee + tataLaksanaFee;
      retentionAmount = Math.round(installment * (Number(cfg.retentionMultiplier) || 1));
      netDisbursement = Math.round(requestedPlafond - totalCreditCost - takeOverAmount - retentionAmount);
      remainingSalary = Math.round(salary - installment);
      actualInstallmentRatio = salary > 0 ? (installment / salary) * 100 : 0;
    }

    const checks = [];
    if (!hasCoreInput) {
      checks.push({
        level: "warn",
        title: "Data Simulasi Belum Lengkap",
        message: "Lengkapi tanggal lahir, gaji bulanan, plafon, dan tenor pengajuan."
      });
    } else {
      const okAge = ageYears !== null && ageYears <= Number(cfg.maxEntryAgeYears) && requestedTenor <= maxTenorByAge;
      const okPlafond = requestedPlafond <= maxPlafond && requestedPlafond <= Number(cfg.maxPlafondAbsolute);
      const okRatio = installment <= maxInstallment + 1;
      const okNet = netDisbursement >= 0;

      checks.push({
        level: okAge ? "pass" : "fail",
        title: `Batas Usia & Tenor ${cfg.shortName}`,
        message: okAge
          ? `Sesuai — Usia ${ageYears} thn & tenor ${requestedTenor} bln masih dalam batas usia lunas (${cfg.maxEndAgeYears} thn ${cfg.maxEndAgeMonths || 0} bln, maks ${maxTenorByAge} bln).`
          : `Tidak Sesuai — Usia atau tenor melebihi ketentuan ${cfg.shortName} (Tenor maks tersedia: ${maxTenorByAge} bln).`
      });

      checks.push({
        level: okPlafond && okRatio ? "pass" : "fail",
        title: `Plafond & DSR (Maks ${maxInstallmentRatio}%)`,
        message: okPlafond && okRatio
          ? `Sesuai — Angsuran Rp${Math.round(installment).toLocaleString("id-ID")} (${actualInstallmentRatio.toFixed(1)}%) ≤ ${maxInstallmentRatio}% gaji.`
          : `Tidak Sesuai — Plafond atau rasio angsuran melampaui batas maksimal Rp${maxPlafond.toLocaleString("id-ID")}.`
      });

      checks.push({
        level: okNet ? "pass" : "fail",
        title: "Estimasi Pencairan Bersih",
        message: okNet
          ? `Sesuai — Sisa pencairan bersih positif sebesar Rp${netDisbursement.toLocaleString("id-ID")}.`
          : `Tidak Sesuai — Estimasi pencairan bersih bernilai negatif.`
      });
    }

    const hasFail = checks.some(c => c.level === "fail");
    const overallValid = hasCoreInput && !hasFail;

    return {
      engine: "partner_bank",
      partnerName: cfg.name,
      hasCoreInput,
      overallValid,
      overallStatusLabel: !hasCoreInput
        ? "Lengkapi Data Simulasi"
        : overallValid
          ? `Sesuai — Lolos Ketentuan ${cfg.shortName}`
          : `Tidak Sesuai Ketentuan ${cfg.shortName}`,
      debtor: {
        name: input.name || "-",
        dob: input.dob || "-",
        processDate: input.processDate || "-",
        ageYears,
        ageText: ageDetail ? `${ageDetail.years} tahun ${ageDetail.months} bulan` : "—",
        region: input.region || "-"
      },
      product: {
        category: cfg.shortName,
        bankRateAnnual: annualRate,
        coopRateAnnual: annualRate,
        provisionRatePercent: Number(cfg.provisionRatePercent),
        insuranceRatePercent: Number(cfg.insuranceRatePercent),
        tataLaksanaPercent: Number(cfg.tataLaksanaRatePercent || 0),
        retentionMultiplier: Number(cfg.retentionMultiplier),
        maxInstallmentRatio
      },
      maximums: {
        maxInstallment: Math.round(maxInstallment),
        maxTenor: maxTenorByAge,
        effectiveTenorForRec,
        maxPlafond
      },
      simulation: {
        salary: Math.round(salary),
        plafond: Math.round(requestedPlafond),
        tenor: requestedTenor,
        takeOverAmount: Math.round(takeOverAmount),
        bankInstallment: Math.round(installment),
        coopInstallment: Math.round(installment),
        baaMonthly: 0,
        actualInstallmentRatio,
        proaqFee: provisionFee,
        riskReserveFee: insuranceFee,
        adminFee,
        tataLaksanaFee,
        totalCreditCost,
        retentionAmount,
        netDisbursement,
        remainingSalary
      },
      officers: {
        pic: input.pic || "MUHAMMAD TEGUH PRANADA",
        smName: input.smName || "-",
        smPhone: input.smPhone || "-",
        marketingName: input.marketingName || "-",
        marketingPhone: input.marketingPhone || "-"
      },
      checks
    };
  }
};
