// ============================================================================
// BSI PRAPENSIUN (NOS v1.4.6) & PT ASURANSI SIMAS JIWA INTEGRATED ENGINE
// Mengimplementasikan perhitungan resmi Dekade Berkah (PP10) & Tri Berkah (PP3),
// Akseptasi Penghasilan Aktif & Pensiun, Skema Atribusi & Non-Atribusi,
// Kalkulator Tarif Kontribusi Simas Jiwa, Underwriting Medis, & Jadwal MMQ/Murabahah
// ============================================================================

window.BSISimasEngine = {
  pmt(monthlyRate, nMonths, pv, fv = 0) {
    if (nMonths <= 0) return 0;
    if (monthlyRate === 0) return (pv + fv) / nMonths;
    const factor = Math.pow(1 + monthlyRate, nMonths);
    return (monthlyRate * (pv * factor + fv)) / (factor - 1);
  },

  pv(monthlyRate, nMonths, pmtVal, fv = 0) {
    if (nMonths <= 0) return 0;
    if (monthlyRate === 0) return pmtVal * nMonths + fv;
    const factor = Math.pow(1 + monthlyRate, nMonths);
    return (pmtVal * (factor - 1) / monthlyRate + fv) / factor;
  },

  // Hitung Usia Nearest Birthday sesuai rumus Simas Prapensiun: INT(YEARFRAC(dob, startDate, 0) + 0.5)
  getNearestAge(dobDate, startDate) {
    if (!dobDate || !startDate) return null;
    const diffMs = startDate.getTime() - dobDate.getTime();
    const yearFrac = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(yearFrac + 0.5);
  },

  // Kalkulator Asuransi Jiwa Pembiayaan PT Asuransi Simas Jiwa
  calculateSimasInsurance(params, bsiConfig) {
    const simasCfg = bsiConfig.simasInsurance;
    const nearestAge = params.nearestAge;
    const totalMonths = Math.max(0, Number(params.insuranceMonths) || 0);
    const insYears = Math.floor(totalMonths / 12);
    const insRemMonths = totalMonths % 12;
    const baseUp = Math.max(0, Number(params.plafond) || 0);
    const isAtribusi = params.atribusiMode !== "no_atribusi";
    const discountPercent = Math.max(0, Number(params.discountPercent) || 0);
    const extraEmPercent = Math.max(0, Number(params.extraEmPercent) || 0);

    if (!nearestAge || nearestAge < simasCfg.minEntryAge || nearestAge > simasCfg.maxEntryAge || totalMonths <= 0) {
      return {
        valid: false,
        nearestAge: nearestAge || 0,
        insYears,
        insRemMonths,
        tarifPerMil: 0,
        santunanSetelahAtribusi: baseUp,
        kontribusiSekaligus: 0,
        extraKontribusi: 0,
        totalKontribusi: 0,
        medicalStatus: "Perhatikan Ketentuan Usia Masuk (45–65 Tahun)",
        maxUpAllowed: simasCfg.maxUpAge70
      };
    }

    const endCoverageAge = nearestAge + insYears + insRemMonths / 12;
    const maxUpAllowed = endCoverageAge <= 70 ? Number(simasCfg.maxUpAge70) : Number(simasCfg.maxUpAge75);
    const ageRow = simasCfg.decreasingRateTable[nearestAge];

    let rawRatePerMil = 0;
    if (ageRow) {
      if (totalMonths < 12) {
        const mult = simasCfg.monthMultipliers[totalMonths] || 1.0;
        rawRatePerMil = mult * (ageRow[0] || 0);
      } else {
        const y1Rate = ageRow[insYears - 1] || 0;
        const y2Rate = ageRow[insYears] || 0;
        if (insRemMonths > 0 && y2Rate > 0) {
          rawRatePerMil = y1Rate + (y2Rate - y1Rate) * (insRemMonths / 12);
        } else {
          rawRatePerMil = y1Rate;
        }
      }
    }

    const tarifPerMil = Number(((1 - discountPercent / 100) * rawRatePerMil).toFixed(2));
    const effectivePerMilWithEm = tarifPerMil + (tarifPerMil * extraEmPercent) / 100;

    let santunanSetelahAtribusi = baseUp;
    if (isAtribusi && effectivePerMilWithEm > 0 && effectivePerMilWithEm < 1000) {
      santunanSetelahAtribusi = baseUp / (1 - effectivePerMilWithEm / 1000);
    }

    const kontribusiSekaligus = isAtribusi
      ? (tarifPerMil * santunanSetelahAtribusi) / 1000
      : (tarifPerMil * baseUp) / 1000;
    const extraKontribusi = (extraEmPercent * kontribusiSekaligus) / 100;
    const totalKontribusi = Math.round(kontribusiSekaligus + extraKontribusi);

    // Penentuan Status Underwriting Medis sesuai Sheet Medic Simas Prapensiun
    let medicalStatus = "Non Medical Check Up";
    let medicalNote = "Auto Acceptance — Wajib melampirkan KTP yang masih berlaku.";
    if (endCoverageAge > simasCfg.maxCoverageAge || tarifPerMil <= 0) {
      medicalStatus = "Melebihi Masa Asuransi Maksimum (Usia + Tenor > 75 Thn)";
      medicalNote = "Kurangi tenor agar usia jatuh tempo asuransi ≤ 75 tahun.";
    } else if (santunanSetelahAtribusi > maxUpAllowed) {
      medicalStatus = `Melebihi Maksimum UP (Maks Rp${maxUpAllowed.toLocaleString("id-ID")})`;
      medicalNote = "Turunkan plafon pengajuan sesuai batas uang pertanggungan.";
    } else if (nearestAge >= 56 && santunanSetelahAtribusi > 500000000) {
      medicalStatus = "Medical Check Up (MCU)";
      medicalNote = "Usia ≥ 56 thn dengan Santunan > Rp500 Juta wajib Medical Check Up.";
    } else if (nearestAge >= 51 && santunanSetelahAtribusi > 800000000) {
      medicalStatus = "Medical Check Up (MCU)";
      medicalNote = "Usia 51–55 thn dengan Santunan > Rp800 Juta wajib Medical Check Up.";
    }

    return {
      valid: endCoverageAge <= simasCfg.maxCoverageAge && tarifPerMil > 0 && santunanSetelahAtribusi <= maxUpAllowed,
      nearestAge,
      endCoverageAge: Number(endCoverageAge.toFixed(1)),
      insYears,
      insRemMonths,
      tarifPerMil,
      santunanSetelahAtribusi: Math.round(santunanSetelahAtribusi),
      kontribusiSekaligus: Math.round(kontribusiSekaligus),
      extraKontribusi: Math.round(extraKontribusi),
      totalKontribusi,
      medicalStatus,
      medicalNote,
      maxUpAllowed
    };
  },

  calculate(input, bsiConfig) {
    const cfg = bsiConfig || window.StorageService.getPartnerParameters().bsi_prapen;
    const dob = window.AMS2Engine.parseDate(input.dob);
    const processDate = window.AMS2Engine.parseDate(input.processDate) || new Date();
    const ageDetail = window.AMS2Engine.getAgeDetail(dob, processDate);
    const nearestAge = this.getNearestAge(dob, processDate);

    // 1. Akseptasi Penghasilan Aktif & Manfaat Pensiun
    const gajiPokok = Math.max(0, Number(input.gajiPokok ?? input.salary) || 0);
    const uangMakan = Math.max(0, Number(input.uangMakan) || 0);
    const tunjanganRutin1Bln = Math.max(0, Number(input.tunjanganRutin1Bln) || 0);
    const tunjanganRutin3Bln = Math.max(0, Number(input.tunjanganRutin3Bln) || 0);
    const tunjanganLain1Bln = Math.max(0, Number(input.tunjanganLain1Bln) || 0);
    const manfaatPensiun = Math.max(0, Number(input.manfaatPensiun) || Math.round(gajiPokok * 0.75));

    const w = cfg.incomeWeights;
    const totalRecognizedActiveIncome = Math.round(
      gajiPokok * (w.gajiPokok / 100) +
      uangMakan * (w.uangMakan / 100) +
      tunjanganRutin1Bln * (w.tunjanganRutin1Bln / 100) +
      tunjanganRutin3Bln * (w.tunjanganRutin3Bln / 100) +
      tunjanganLain1Bln * (w.tunjanganLain1Bln / 100)
    );

    const payrollStatus = input.payrollStatus || "Payroll"; // Payroll | Non-Payroll
    const dbrActivePercent = payrollStatus === "Non-Payroll"
      ? Number(cfg.dbrActiveNonPayroll)
      : Number(cfg.dbrActivePayroll);
    const dsrPensionPercent = Number(cfg.dsrPensionMax) || 90;

    const existingInstallment = Math.max(0, Number(input.existingInstallment) || 0);
    const akseptasiAktif = Math.floor(Math.max(0, (totalRecognizedActiveIncome - existingInstallment) * (dbrActivePercent / 100)));
    const akseptasiPensiun = Math.floor(manfaatPensiun * (dsrPensionPercent / 100));

    // 2. Masa Aktif & Masa Pensiun (Dekade Berkah PP10 vs Tri Berkah PP3)
    const schemeType = input.bsiScheme || "PP10"; // PP10 (Dekade Berkah 10 Thn) | PP3 (Tri Berkah 3 Thn)
    const atribusiMode = input.atribusiMode || "atribusi_asuransi"; // no_atribusi | atribusi_asuransi
    const akadType = input.akadType || "MMQ"; // MMQ | Murabahah

    const bupAge = Math.max(55, Number(input.bupAge) || Number(cfg.bupAgeDefault) || 58);
    let monthsToBup = 120;
    if (dob && processDate) {
      const bupDate = new Date(dob.getFullYear() + bupAge, dob.getMonth() + 1, 1);
      const rawDays = (bupDate.getTime() - processDate.getTime()) / (1000 * 60 * 60 * 24);
      monthsToBup = Math.max(0, Math.round(rawDays / 30.5));
    }

    const maxActiveCap = schemeType === "PP3" ? 36 : 120;
    const requestedTenor = Math.max(12, Math.min(Number(cfg.maxTenorMonths), Math.floor(Number(input.tenor) || 180)));
    const tenorAktif = Math.min(requestedTenor, Math.min(maxActiveCap, monthsToBup || maxActiveCap));
    const tenorPensiun = Math.max(0, requestedTenor - tenorAktif);

    const requestedPlafond = Math.max(0, Number(input.plafond) || 0);

    // 3. Pricing Margin/Ujrah Aktif & Pensiun sesuai Tier
    let baseRateAktifAnnual = cfg.pricingTiers.dekadeNettAbove200.rateActiveAnnual;
    let baseRatePensiunAnnual = cfg.pricingTiers.dekadeNettAbove200.ratePensionAnnual;
    if (requestedPlafond > 0 && requestedPlafond < 200000000) {
      baseRateAktifAnnual = cfg.pricingTiers.below200.rateActiveAnnual;
      baseRatePensiunAnnual = cfg.pricingTiers.below200.ratePensionAnnual;
    } else if (schemeType === "PP3") {
      baseRateAktifAnnual = cfg.pricingTiers.triNettAbove200.rateActiveAnnual;
      baseRatePensiunAnnual = cfg.pricingTiers.triNettAbove200.ratePensionAnnual;
    }

    // 4. Hitung Asuransi Jiwa Simas Prapensiun (+6 bulan buffer masa asuransi sesuai sheet Simas)
    const insuranceMonths = requestedTenor + 6;
    const simasResult = this.calculateSimasInsurance({
      nearestAge,
      insuranceMonths,
      plafond: requestedPlafond,
      atribusiMode,
      discountPercent: 0,
      extraEmPercent: 0
    }, cfg);

    const manualInsuranceOverride = Number(input.manualInsuranceFee) || 0;
    const nominalAtribusi = atribusiMode === "no_atribusi"
      ? 0
      : (manualInsuranceOverride > 0 ? manualInsuranceOverride : simasResult.totalKontribusi);
    const atribusiPerBulan = requestedTenor > 0 ? nominalAtribusi / requestedTenor : 0;

    // 5. Perhitungan Plafond Maksimal & Angsuran (Mengikuti Rumus Sheet PP10 & PP3)
    const adjAktif = atribusiMode !== "no_atribusi" ? (Number(cfg.atribusiAdjustments.pp10ActiveRateAdd) / 100) : 0;
    const adjPensiun = atribusiMode !== "no_atribusi" ? (Number(cfg.atribusiAdjustments.pp10PensionRateAdd) / 100) : 0;

    const rateAktifCalc = (baseRateAktifAnnual / 100) + (schemeType === "PP10" ? adjAktif : 0);
    const ratePensiunCalc = (baseRatePensiunAnnual / 100) + (schemeType === "PP10" ? adjPensiun : 0);

    // Plafon Maksimal No-Atribusi
    const plafonMaksPensiunNoAtrib = tenorPensiun > 0
      ? this.pv(ratePensiunCalc / 12, tenorPensiun, Math.max(0, akseptasiPensiun - atribusiPerBulan), 0)
      : 0;
    const rawPlafonAktifNoAtrib = this.pv(
      rateAktifCalc / 12,
      tenorAktif,
      Math.max(0, akseptasiAktif - atribusiPerBulan),
      plafonMaksPensiunNoAtrib
    );
    const plafonMaksNoAtrib = Math.min(
      Number(cfg.maxPlafondAbsolute),
      Math.floor(rawPlafonAktifNoAtrib / 1000000) * 1000000
    );

    // Rate Atribusi Aktif & Pensiun serta Jadwal Amortisasi Pokok
    let plafonDisetujui = requestedPlafond > 0 ? Math.min(requestedPlafond, plafonMaksNoAtrib || requestedPlafond) : 0;
    let angsuranAktif = 0;
    let angsuranPensiun = 0;
    let priceAtribAktif = baseRateAktifAnnual / 100;
    let priceAtribPensiun = baseRatePensiunAnnual / 100;
    let sisaOsSaatPensiun = 0;
    const schedulePreview = [];

    if (plafonDisetujui > 0 && requestedTenor > 0) {
      if (schemeType === "PP3") {
        // Skema Tri Berkah (PP3): Angsuran pokok aktif tetap Rp10.000/bln + margin + atribusi
        const pokokAktifTetap = Number(cfg.atribusiAdjustments.pp3PokokTetapAktif) || 10000;
        const marginAktifBln = (baseRateAktifAnnual / 100 / 12) * plafonDisetujui;
        priceAtribAktif = ((marginAktifBln + atribusiPerBulan) / plafonDisetujui) * 12;
        angsuranAktif = Math.round(pokokAktifTetap + marginAktifBln + atribusiPerBulan);
      } else {
        // Skema Dekade Berkah (PP10)
        const marginAktifRef = (rateAktifCalc / 12) * (plafonMaksNoAtrib || plafonDisetujui);
        const rateAtribAktifBase = Math.ceil(((marginAktifRef + atribusiPerBulan) / (plafonMaksNoAtrib || plafonDisetujui)) * 12 * 10000) / 10000;
        priceAtribAktif = rateAtribAktifBase + (atribusiMode !== "no_atribusi" ? 0.01 : 0);
        angsuranAktif = akseptasiAktif;
      }

      // Simulasikan amortisasi bulan ke-1 s.d. akhir masa aktif untuk memperoleh Sisa OS Pensiun
      let currentOs = plafonDisetujui;
      for (let m = 1; m <= tenorAktif; m++) {
        const marginBln = currentOs * (priceAtribAktif / 12);
        const pokokBln = angsuranAktif - marginBln;
        currentOs = Math.max(0, currentOs - pokokBln);
        if (m <= 6 || m === tenorAktif) {
          schedulePreview.push({
            month: m,
            phase: "Masa Aktif",
            openingOs: Math.round(currentOs + pokokBln),
            principalPayment: Math.round(pokokBln),
            marginPayment: Math.round(marginBln),
            totalInstallment: Math.round(angsuranAktif),
            closingOs: Math.round(currentOs)
          });
        }
      }
      sisaOsSaatPensiun = currentOs;

      if (tenorPensiun > 0 && sisaOsSaatPensiun > 0) {
        const marginPenBln = ((baseRatePensiunAnnual / 100) / 12) * sisaOsSaatPensiun;
        priceAtribPensiun = ((marginPenBln + atribusiPerBulan) / sisaOsSaatPensiun) * 12;
        angsuranPensiun = this.pmt(priceAtribPensiun / 12, tenorPensiun, sisaOsSaatPensiun, 0);

        let penOs = sisaOsSaatPensiun;
        for (let m = tenorAktif + 1; m <= requestedTenor; m++) {
          const marginBln = penOs * (priceAtribPensiun / 12);
          const pokokBln = angsuranPensiun - marginBln;
          penOs = Math.max(0, penOs - pokokBln);
          if (m === tenorAktif + 1 || m === requestedTenor) {
            schedulePreview.push({
              month: m,
              phase: "Masa Pensiun",
              openingOs: Math.round(penOs + pokokBln),
              principalPayment: Math.round(pokokBln),
              marginPayment: Math.round(marginBln),
              totalInstallment: Math.round(angsuranPensiun),
              closingOs: Math.round(penOs)
            });
          }
        }
      }
    }

    const dsrAktifActual = totalRecognizedActiveIncome > 0
      ? ((angsuranAktif + existingInstallment) / totalRecognizedActiveIncome) * 100
      : 0;
    const dsrPensiunActual = manfaatPensiun > 0
      ? (angsuranPensiun / manfaatPensiun) * 100
      : 0;

    // 6. Rincian Biaya & Terima Bersih ke Nasabah (Sheet Rincian ke Nsb)
    const adminFee = Math.round(plafonDisetujui * (Number(cfg.fees.adminRatePercent) / 100));
    const materaiFee = Number(cfg.fees.materaiFee) || 100000;
    const insuranceDeductFromCash = atribusiMode === "no_atribusi" ? simasResult.totalKontribusi : 0;
    const blokirAktifNominal = Math.round(angsuranAktif * (Number(cfg.fees.blokirActiveCount) || 1));
    const blokirPensiunNominal = Math.round(angsuranPensiun * (Number(cfg.fees.blokirPensionCount) || 2));
    const totalBlokirAngsuran = blokirAktifNominal + blokirPensiunNominal;
    const takeOverAmount = input.isTakeOver ? Math.max(0, Number(input.takeOverAmount) || 0) : 0;

    const totalBiayaKredit = adminFee + materaiFee + insuranceDeductFromCash;
    const terimaBersih = Math.round(
      plafonDisetujui - totalBiayaKredit - totalBlokirAngsuran - takeOverAmount
    );

    const taksasiMmq = Math.ceil((plafonDisetujui * (1 + Number(cfg.fees.taksasiMmqMarkupPercent) / 100)) / 1000000) * 1000000;

    // 7. Validasi Ketentuan BSI Prapensiun & Simas Jiwa
    const checks = [];
    const maxEndDate = dob ? window.AMS2Engine.addYearsMonths(dob, cfg.maxEndAgeYears, cfg.maxEndAgeMonths) : null;
    const loanEndDate = processDate ? window.AMS2Engine.addYearsMonths(processDate, 0, requestedTenor) : null;
    const okEndAge = Boolean(maxEndDate && loanEndDate && loanEndDate <= maxEndDate);
    const okDsrAktif = dsrAktifActual <= dbrActivePercent + 0.1;
    const okDsrPensiun = tenorPensiun === 0 || dsrPensiunActual <= dsrPensionPercent + 0.1;
    const okPlafond = requestedPlafond > 0 && requestedPlafond <= plafonMaksNoAtrib && requestedPlafond <= Number(cfg.maxPlafondAbsolute);
    const okCashPositive = terimaBersih >= 0;

    checks.push({
      level: okEndAge ? "pass" : "fail",
      title: `Usia Jatuh Tempo Pembiayaan (Maks ${cfg.maxEndAgeYears} Thn ${cfg.maxEndAgeMonths} Bln)`,
      message: okEndAge
        ? `Sesuai — Usia saat ini ${ageDetail ? ageDetail.years : "-"} thn dengan tenor ${requestedTenor} bln (${tenorAktif} bln aktif + ${tenorPensiun} bln pensiun) memenuhi batas usia jatuh tempo.`
        : `Tidak Sesuai — Tenor ${requestedTenor} bulan melewati batas usia jatuh tempo ${cfg.maxEndAgeYears} tahun ${cfg.maxEndAgeMonths} bulan.`
    });

    checks.push({
      level: okDsrAktif && okDsrPensiun ? "pass" : "fail",
      title: `DSR Masa Aktif (Maks ${dbrActivePercent}%) & Masa Pensiun (Maks ${dsrPensionPercent}%)`,
      message: okDsrAktif && okDsrPensiun
        ? `Sesuai — DSR Aktif ${dsrAktifActual.toFixed(1)}% (Angs Rp${Math.round(angsuranAktif).toLocaleString("id-ID")}) & DSR Pensiun ${dsrPensiunActual.toFixed(1)}% (Angs Rp${Math.round(angsuranPensiun).toLocaleString("id-ID")}).`
        : `Perhatian — DSR Pensiun (${dsrPensiunActual.toFixed(1)}%) atau DSR Aktif (${dsrAktifActual.toFixed(1)}%) melampaui batas akseptasi. Sesuaikan plafon atau tenor.`
    });

    checks.push({
      level: simasResult.valid ? "pass" : "warn",
      title: `Asuransi Jiwa Simas Prapensiun (${simasResult.medicalStatus})`,
      message: `Tarif Kontribusi ${simasResult.tarifPerMil}‰ (Usia terdekat ${simasResult.nearestAge} thn) · Kontribusi Rp${simasResult.totalKontribusi.toLocaleString("id-ID")} · ${simasResult.medicalNote}`
    });

    checks.push({
      level: okPlafond && okCashPositive ? "pass" : "fail",
      title: "Plafond & Terima Bersih Nasabah",
      message: okPlafond && okCashPositive
        ? `Sesuai — Plafond Rp${plafonDisetujui.toLocaleString("id-ID")} ≤ Maks Rp${plafonMaksNoAtrib.toLocaleString("id-ID")}, Terima Bersih Rp${terimaBersih.toLocaleString("id-ID")}.`
        : `Tidak Sesuai — Plafond melebihi rekomendasi maksimal (Rp${plafonMaksNoAtrib.toLocaleString("id-ID")}) atau Terima Bersih negatif.`
    });

    const hasCoreInput = Boolean(dob && gajiPokok > 0 && requestedPlafond > 0 && requestedTenor > 0);
    const overallValid = hasCoreInput && okEndAge && okDsrAktif && okDsrPensiun && okPlafond && okCashPositive;

    return {
      engine: "bsi_simas",
      partnerName: cfg.name,
      hasCoreInput,
      overallValid,
      overallStatusLabel: !hasCoreInput
        ? "Lengkapi Data Prapensiun"
        : overallValid
          ? "Sesuai — Lolos Akseptasi NOS BSI & Simas Jiwa"
          : "Perlu Penyesuaian Plafond / Tenor / DSR",
      debtor: {
        name: input.name || "-",
        nip: input.nip || "-",
        dob: input.dob || "-",
        processDate: input.processDate || "-",
        ageYears: ageDetail ? ageDetail.years : null,
        ageText: ageDetail ? `${ageDetail.years} thn ${ageDetail.months} bln (Nearest: ${nearestAge} thn)` : "—",
        bupAge,
        region: input.region || "-"
      },
      product: {
        category: schemeType === "PP3" ? "Tri Berkah (Prapen 3 Tahun)" : "Dekade Berkah (Prapen 10 Tahun)",
        schemeType,
        akadType,
        atribusiModeLabel: atribusiMode === "no_atribusi" ? "1. No Atribusi" : "2. Atribusi Asuransi Simas Jiwa",
        baseRateAktifAnnual,
        baseRatePensiunAnnual,
        priceAtribAktifPercent: Number((priceAtribAktif * 100).toFixed(2)),
        priceAtribPensiunPercent: Number((priceAtribPensiun * 100).toFixed(2))
      },
      maximums: {
        totalRecognizedActiveIncome,
        manfaatPensiun,
        maxInstallment: akseptasiAktif,
        akseptasiPensiun,
        maxTenor: Number(cfg.maxTenorMonths),
        tenorAktif,
        tenorPensiun,
        maxPlafond: plafonMaksNoAtrib
      },
      simulation: {
        salary: totalRecognizedActiveIncome,
        plafond: plafonDisetujui,
        tenor: requestedTenor,
        tenorAktif,
        tenorPensiun,
        takeOverAmount: Math.round(takeOverAmount),
        bankInstallment: Math.round(angsuranAktif),
        coopInstallment: Math.round(angsuranAktif),
        pensionInstallment: Math.round(angsuranPensiun),
        sisaOsSaatPensiun: Math.round(sisaOsSaatPensiun),
        dsrAktifActual,
        dsrPensiunActual,
        actualInstallmentRatio: dsrAktifActual,
        adminFee,
        materaiFee,
        nominalAtribusi,
        totalCreditCost: totalBiayaKredit,
        blokirAktifNominal,
        blokirPensiunNominal,
        retentionAmount: totalBlokirAngsuran,
        netDisbursement: terimaBersih,
        remainingSalary: Math.round(totalRecognizedActiveIncome - angsuranAktif),
        remainingPensionSalary: Math.round(manfaatPensiun - angsuranPensiun),
        taksasiMmq
      },
      simasInsurance: simasResult,
      schedulePreview,
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
