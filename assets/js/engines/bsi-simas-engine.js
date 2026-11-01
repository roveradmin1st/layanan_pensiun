// ============================================================================
// BSI PRAPENSIUN (NOS v1.4.6) & PT ASURANSI SIMAS JIWA INTEGRATED ENGINE
// Mengimplementasikan perhitungan resmi Dekade Berkah (PP10) & Tri Berkah (PP3),
// Akseptasi Penghasilan Aktif & Pensiun, Skema Atribusi & Non-Atribusi,
// Kalkulator Tarif Kontribusi Simas Jiwa (US 30/360), Underwriting Medis,
// Pencarian Plafond dengan Requote Premi, & Jadwal Penuh MMQ/Murabahah
// ============================================================================

window.BSISimasEngine = {
  // Pembulatan desimal half-up yang bebas bias representasi biner IEEE-754
  roundHalfUp(value, decimals = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    const factor = Math.pow(10, decimals);
    const clean = Number((num * factor).toPrecision(12));
    return (clean >= 0 ? Math.floor(clean + 0.5) : Math.ceil(clean - 0.5)) / factor;
  },

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

  // Setara fungsi Excel RATE(nper, pmt, pv, fv, type, guess) dengan iterasi Newton-Raphson
  excelRate(nper, pmtVal, pvVal, fvVal = 0, type = 0, guess = 0.01) {
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
  },

  isLastDayOfFebruary(dateObj) {
    if (!dateObj || dateObj.getMonth() !== 1) return false;
    const year = dateObj.getFullYear();
    const lastDay = new Date(year, 2, 0).getDate();
    return dateObj.getDate() === lastDay;
  },

  // US (NASD) 30/360 sesuai fungsi Excel YEARFRAC(start_date, end_date, 0)
  days360US(startDate, endDate) {
    let y1 = startDate.getFullYear();
    let m1 = startDate.getMonth() + 1;
    let d1 = startDate.getDate();
    let y2 = endDate.getFullYear();
    let m2 = endDate.getMonth() + 1;
    let d2 = endDate.getDate();

    const startLastFeb = this.isLastDayOfFebruary(startDate);
    const endLastFeb = this.isLastDayOfFebruary(endDate);
    if (startLastFeb && endLastFeb) {
      d2 = 30;
    }
    if (startLastFeb) {
      d1 = 30;
    }
    if (d2 === 31 && d1 >= 30) {
      d2 = 30;
    }
    if (d1 === 31) {
      d1 = 30;
    }
    return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
  },

  yearFracBasis0(startDate, endDate) {
    if (!startDate || !endDate) return null;
    return this.days360US(startDate, endDate) / 360;
  },

  // Hitung Usia Nearest Birthday sesuai rumus Simas Prapensiun: INT(YEARFRAC(dob, startDate, 0) + 0.5)
  getNearestAge(dobDate, startDate) {
    if (!dobDate || !startDate || Number.isNaN(dobDate.getTime()) || Number.isNaN(startDate.getTime())) {
      return null;
    }
    const days360 = this.days360US(dobDate, startDate);
    if (days360 < 0) return null;
    return Math.floor((days360 + 180) / 360);
  },

  normalizePayrollStatus(rawStatus, cfg) {
    const dbrPayroll = Number(cfg?.dbrActivePayroll) || 70;
    const dbrColek = Number(cfg?.dbrActivePayrollColek) || 80;
    const dbrNonPayroll = Number(cfg?.dbrActiveNonPayroll) || 50;

    if (rawStatus === undefined || rawStatus === null || rawStatus === "") {
      return { code: "P", label: "Payroll", valid: true, ceilingPercent: dbrPayroll, defaultPercent: dbrPayroll };
    }
    const cleaned = String(rawStatus).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    if (cleaned === "p" || cleaned === "payroll" || cleaned === "1. payroll") {
      return { code: "P", label: "Payroll", valid: true, ceilingPercent: dbrPayroll, defaultPercent: dbrPayroll };
    }
    if (
      cleaned === "c" ||
      cleaned === "comitted payroll" ||
      cleaned === "committed payroll" ||
      cleaned === "payroll colek" ||
      cleaned === "2. comitted payroll" ||
      cleaned === "2. committed payroll"
    ) {
      return { code: "C", label: "Comitted Payroll", valid: true, ceilingPercent: dbrColek, defaultPercent: dbrPayroll };
    }
    if (
      cleaned === "n" ||
      cleaned === "non payroll" ||
      cleaned === "3. non payroll"
    ) {
      return { code: "N", label: "Non Payroll", valid: true, ceilingPercent: dbrNonPayroll, defaultPercent: dbrNonPayroll };
    }
    return { code: "INVALID", label: String(rawStatus), valid: false, ceilingPercent: 0, defaultPercent: 0 };
  },

  resolvePricingTier(plafondAmount, schemeType, cfg, input) {
    const manualAktif = Number(
      input?.priceAktifAnnual ?? input?.priceSaatAktif ?? input?.rateActiveAnnual ?? 0
    );
    const manualPensiun = Number(
      input?.pricePensiunAnnual ?? input?.priceSaatPensiun ?? input?.ratePensionAnnual ?? 0
    );

    let tierObj = cfg.pricingTiers?.dekadeNettAbove200 || { rateActiveAnnual: 9.5, ratePensionAnnual: 10.5 };
    if (plafondAmount > 0 && plafondAmount < 200000000 && cfg.pricingTiers?.below200) {
      tierObj = cfg.pricingTiers.below200;
    } else if (schemeType === "PP3" && cfg.pricingTiers?.triNettAbove200) {
      tierObj = cfg.pricingTiers.triNettAbove200;
    }

    return {
      baseRateAktifAnnual: manualAktif > 0 ? manualAktif : Number(tierObj.rateActiveAnnual),
      baseRatePensiunAnnual: manualPensiun > 0 ? manualPensiun : Number(tierObj.ratePensionAnnual),
      tierLabel: tierObj.label || "-"
    };
  },

  // Kalkulator Asuransi Jiwa Pembiayaan PT Asuransi Simas Jiwa
  calculateSimasInsurance(params, bsiConfig) {
    const simasCfg = bsiConfig?.simasInsurance || {};
    const minEntryAge = Number(simasCfg.minEntryAge) || 45;
    const maxEntryAge = Number(simasCfg.maxEntryAge) || 65;
    const maxCoverageAge = Number(simasCfg.maxCoverageAge) || 75;
    const maxInsuranceYears = Number(simasCfg.maxInsuranceYears) || 20;
    const maxInsuranceMonths = maxInsuranceYears * 12;

    const nearestAge = params?.nearestAge;
    const rawMonths = Number(params?.insuranceMonths);
    const monthsValid = Number.isInteger(rawMonths) && rawMonths >= 1 && rawMonths <= maxInsuranceMonths;
    const totalMonths = monthsValid ? rawMonths : Math.max(0, Math.floor(rawMonths || 0));
    const insYears = Math.floor(totalMonths / 12);
    const insRemMonths = totalMonths % 12;

    const rawBaseUp = Number(params?.plafond);
    const baseUpValid = Number.isFinite(rawBaseUp) && rawBaseUp > 0;
    const baseUp = baseUpValid ? rawBaseUp : 0;

    const isAtribusi = params?.atribusiMode !== "no_atribusi";

    const rawDiscount = params?.discountPercent === undefined || params?.discountPercent === null || params?.discountPercent === ""
      ? 0
      : Number(params.discountPercent);
    const discountValid = Number.isFinite(rawDiscount) && rawDiscount >= 0 && rawDiscount <= 5;
    const discountPercent = discountValid ? rawDiscount : 0;

    const rawEm = params?.extraEmPercent === undefined || params?.extraEmPercent === null || params?.extraEmPercent === ""
      ? 0
      : Number(params.extraEmPercent);
    const emValid = Number.isFinite(rawEm) && rawEm >= 0;
    const extraEmPercent = emValid ? rawEm : 0;

    const ageValid = Number.isInteger(nearestAge) && nearestAge >= minEntryAge && nearestAge <= maxEntryAge;
    const endCoverageAge = (Number(nearestAge) || 0) + insYears + insRemMonths / 12;
    const maxUpAge70 = Number(simasCfg.maxUpAge70) || 1000000000;
    const maxUpAge75 = Number(simasCfg.maxUpAge75) || 500000000;

    // Spek Produk!F20: IF(OR(F29>64, (F29+F30+H30/12)>70), 500000000, 1000000000)
    const maxUpAllowed = (nearestAge > 64 || endCoverageAge > 70) ? maxUpAge75 : maxUpAge70;

    if (!ageValid || !monthsValid || !baseUpValid || !discountValid || !emValid) {
      let reason = "Perhatikan Ketentuan Usia Masuk (45–65 Tahun)";
      if (!monthsValid) reason = `Masa Asuransi Tidak Valid (Wajib bulat 1–${maxInsuranceMonths} bulan / maks ${maxInsuranceYears} tahun)`;
      else if (!baseUpValid) reason = "Plafond / Uang Pertanggungan Awal harus lebih dari Rp0";
      else if (!discountValid) reason = "Diskon Kontribusi di luar batas ketentuan (0%–5%)";
      else if (!emValid) reason = "Extra Mortalita (EM) tidak valid";

      return {
        valid: false,
        nearestAge: nearestAge || 0,
        endCoverageAge: Number(endCoverageAge.toFixed(1)),
        insYears,
        insRemMonths,
        tarifPerMil: 0,
        santunanSetelahAtribusi: Math.round(baseUp),
        kontribusiSekaligus: 0,
        extraKontribusi: 0,
        totalKontribusi: 0,
        medicalStatus: reason,
        medicalNote: reason,
        maxUpAllowed,
        raw: {
          rawRatePerMil: 0,
          tarifPerMil: 0,
          santunanSetelahAtribusi: baseUp,
          kontribusiSekaligus: 0,
          extraKontribusi: 0,
          totalKontribusi: 0
        }
      };
    }

    const ageRow = simasCfg.decreasingRateTable ? simasCfg.decreasingRateTable[nearestAge] : null;
    let rawRatePerMil = 0;
    let rateLookupValid = false;

    if (Array.isArray(ageRow)) {
      if (totalMonths < 12) {
        const mult = simasCfg.monthMultipliers ? simasCfg.monthMultipliers[totalMonths] : undefined;
        const y1Rate = Number(ageRow[0]);
        if (typeof mult === "number" && Number.isFinite(mult) && mult > 0 && Number.isFinite(y1Rate) && y1Rate > 0) {
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

    const tarifPerMil = rateLookupValid
      ? this.roundHalfUp((1 - discountPercent / 100) * rawRatePerMil, 2)
      : 0;
    const effectivePerMilWithEm = tarifPerMil + (tarifPerMil * extraEmPercent) / 100;
    const grossUpFraction = effectivePerMilWithEm / 1000;

    let grossUpValid = true;
    let santunanSetelahAtribusiRaw = baseUp;

    if (isAtribusi) {
      if (!rateLookupValid || grossUpFraction <= 0 || grossUpFraction >= 1) {
        grossUpValid = false;
      } else {
        santunanSetelahAtribusiRaw = baseUp / (1 - grossUpFraction);
      }
    }

    const kontribusiSekaligusRaw = rateLookupValid
      ? (isAtribusi ? (tarifPerMil * santunanSetelahAtribusiRaw) / 1000 : (tarifPerMil * baseUp) / 1000)
      : 0;
    const extraKontribusiRaw = rateLookupValid ? (extraEmPercent * kontribusiSekaligusRaw) / 100 : 0;
    const totalKontribusiRaw = kontribusiSekaligusRaw + extraKontribusiRaw;

    if (isAtribusi && grossUpValid) {
      const reconciledBase = santunanSetelahAtribusiRaw - totalKontribusiRaw;
      if (Math.abs(reconciledBase - baseUp) >= 1) {
        grossUpValid = false;
      }
    }

    const santunanSetelahAtribusi = Math.round(santunanSetelahAtribusiRaw);
    const kontribusiSekaligus = Math.round(kontribusiSekaligusRaw);
    const extraKontribusi = Math.round(extraKontribusiRaw);
    const totalKontribusi = Math.round(totalKontribusiRaw);

    const okCoverageAge = endCoverageAge <= maxCoverageAge;
    const okUpLimit = baseUp <= maxUpAllowed && santunanSetelahAtribusiRaw <= maxUpAllowed && santunanSetelahAtribusi <= maxUpAllowed;
    const isValid = Boolean(
      rateLookupValid &&
      tarifPerMil > 0 &&
      grossUpValid &&
      okCoverageAge &&
      okUpLimit
    );

    // Penentuan Status Underwriting Medis sesuai Sheet Medic Simas Prapensiun
    let medicalStatus = "Non Medical Check Up";
    let medicalNote = "Auto Acceptance — Wajib melampirkan KTP yang masih berlaku.";
    if (!rateLookupValid || tarifPerMil <= 0) {
      medicalStatus = "Tarif Asuransi Tidak Tersedia";
      medicalNote = "Kombinasi usia dan masa asuransi tidak memiliki tarif pada tabel master.";
    } else if (!grossUpValid) {
      medicalStatus = "Fraksi Atribusi / EM Tidak Valid";
      medicalNote = "Total tarif kontribusi + EM melebihi batas perhitungan atribusi.";
    } else if (!okCoverageAge) {
      medicalStatus = "Melebihi Masa Asuransi Maksimum (Usia + Tenor > 75 Thn)";
      medicalNote = "Kurangi tenor agar usia jatuh tempo asuransi ≤ 75 tahun.";
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
      valid: isValid,
      nearestAge,
      endCoverageAge: Number(endCoverageAge.toFixed(1)),
      insYears,
      insRemMonths,
      tarifPerMil,
      santunanSetelahAtribusi,
      kontribusiSekaligus,
      extraKontribusi,
      totalKontribusi,
      medicalStatus,
      medicalNote,
      maxUpAllowed,
      raw: {
        rawRatePerMil,
        tarifPerMil,
        santunanSetelahAtribusi: santunanSetelahAtribusiRaw,
        kontribusiSekaligus: kontribusiSekaligusRaw,
        extraKontribusi: extraKontribusiRaw,
        totalKontribusi: totalKontribusiRaw
      }
    };
  },

  computeMaxPlafondForCandidate({
    schemeType,
    atribusiMode,
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
    const isAtrib = atribusiMode !== "no_atribusi" && nominalAtribusi > 0;
    const atribPerBulan = requestedTenor > 0 ? nominalAtribusi / requestedTenor : 0;

    if (schemeType === "PP3") {
      // Sheet 7: Rumus Plafond + Atrib PP3 (2)
      const pokokTetap = Number(cfg.atribusiAdjustments?.pp3PokokTetapAktif) || 10000;
      const availAktif = akseptasiAktif - atribPerBulan - pokokTetap;
      if (availAktif <= 0 || baseRateAktifAnnual <= 0) return 0;

      const rawCapAktif = (availAktif * 12) / (baseRateAktifAnnual / 100);
      const capAktif = Math.floor(rawCapAktif / 10000000) * 10000000;

      if (tenorPensiun > 0) {
        const adjPensiun = isAtrib ? ((Number(cfg.atribusiAdjustments?.pp10PensionRateAdd) || 1.0) / 100) : 0;
        const ratePenCap = (baseRatePensiunAnnual / 100) + adjPensiun;
        const availPensiun = akseptasiPensiun - atribPerBulan;
        if (availPensiun <= 0) return 0;
        const rawCapPensiun = this.pv(ratePenCap / 12, tenorPensiun, availPensiun, 0);
        const capPensiun = Math.floor(rawCapPensiun / 10000000) * 10000000;
        return Math.max(0, Math.min(maxPlafondAbs, capAktif, capPensiun));
      }
      return Math.max(0, Math.min(maxPlafondAbs, capAktif));
    }

    // Sheet 6: Rumus Plafond + Atrib PP10 (2)
    const adjAktif = isAtrib ? ((Number(cfg.atribusiAdjustments?.pp10ActiveRateAdd) ?? 0.1) / 100) : 0;
    const adjPensiun = isAtrib ? ((Number(cfg.atribusiAdjustments?.pp10PensionRateAdd) ?? 1.0) / 100) : 0;

    const rateAktifCap = (baseRateAktifAnnual / 100) + adjAktif;
    const ratePensiunCap = (baseRatePensiunAnnual / 100) + adjPensiun;

    const availAktif = akseptasiAktif - atribPerBulan;
    if (availAktif <= 0) return 0;

    let pvPen = 0;
    if (tenorPensiun > 0) {
      const availPensiun = akseptasiPensiun - atribPerBulan;
      if (availPensiun <= 0) return 0;
      pvPen = this.pv(ratePensiunCap / 12, tenorPensiun, availPensiun, 0);
    }

    const rawPvAkt = this.pv(rateAktifCap / 12, tenorAktif, availAktif, pvPen);
    return Math.max(0, Math.min(maxPlafondAbs, Math.floor(rawPvAkt / 1000000) * 1000000));
  },

  calculate(input, bsiConfig) {
    const cfg = bsiConfig || (window.StorageService ? window.StorageService.getPartnerParameters().bsi_prapen : {});
    const dob = window.AMS2Engine ? window.AMS2Engine.parseDate(input?.dob) : null;
    const processDateProvided = Boolean(input?.processDate);
    const processDate = window.AMS2Engine
      ? (window.AMS2Engine.parseDate(input?.processDate) || new Date())
      : new Date();
    const ageDetail = window.AMS2Engine ? window.AMS2Engine.getAgeDetail(dob, processDate) : null;
    const nearestAge = this.getNearestAge(dob, processDate);

    // 1. Akseptasi Penghasilan Aktif & Manfaat Pensiun (Tanpa fabrikasi manfaat pensiun)
    const gajiPokok = Math.max(0, Number(input?.gajiPokok ?? input?.salary) || 0);
    const uangMakan = Math.max(0, Number(input?.uangMakan) || 0);
    const tunjanganRutin1Bln = Math.max(0, Number(input?.tunjanganRutin1Bln) || 0);
    const tunjanganRutin3Bln = Math.max(0, Number(input?.tunjanganRutin3Bln) || 0);
    const tunjanganLain1Bln = Math.max(0, Number(input?.tunjanganLain1Bln) || 0);
    const tht = Math.max(0, Number(input?.tht) || 0);

    const hasExplicitManfaatPensiun =
      input?.manfaatPensiun !== undefined &&
      input?.manfaatPensiun !== null &&
      String(input?.manfaatPensiun).trim() !== "";
    const rawManfaatPensiun = hasExplicitManfaatPensiun ? Number(input.manfaatPensiun) : 0;
    const manfaatPensiun = Number.isFinite(rawManfaatPensiun) && rawManfaatPensiun > 0 ? rawManfaatPensiun : 0;

    const w = cfg.incomeWeights || {
      gajiPokok: 100,
      uangMakan: 90,
      tunjanganRutin1Bln: 90,
      tunjanganRutin3Bln: 50,
      tunjanganLain1Bln: 80,
      tht: 75
    };

    const totalRecognizedActiveIncomeRaw =
      gajiPokok * (Number(w.gajiPokok) / 100) +
      uangMakan * (Number(w.uangMakan) / 100) +
      tunjanganRutin1Bln * (Number(w.tunjanganRutin1Bln) / 100) +
      tunjanganRutin3Bln * (Number(w.tunjanganRutin3Bln) / 100) +
      tunjanganLain1Bln * (Number(w.tunjanganLain1Bln) / 100);
    const totalRecognizedActiveIncome = Math.round(totalRecognizedActiveIncomeRaw);
    const thtRecognized = Math.round(tht * ((Number(w.tht) || 75) / 100));

    // Normalisasi Status Payroll (P / C / N) & Kewajiban Eksisting BSI vs Non-BSI
    const payrollInfo = this.normalizePayrollStatus(input?.payrollStatus, cfg);
    const chosenDbr = input?.dbrActiveChosen !== undefined && input?.dbrActiveChosen !== null && input?.dbrActiveChosen !== ""
      ? Number(input.dbrActiveChosen)
      : payrollInfo.defaultPercent;
    const dbrActivePercent = payrollInfo.valid
      ? Math.min(payrollInfo.ceilingPercent, Math.max(0, chosenDbr))
      : 0;
    const dsrPensionPercent = Number(cfg.dsrPensionMax) || 90;

    const hasSplitObligations = input?.angsuranBsi !== undefined || input?.angsuranSelainBsi !== undefined;
    const angsuranBsi = Math.max(0, Number(input?.angsuranBsi) || 0);
    const angsuranSelainBsi = Math.max(0, Number(input?.angsuranSelainBsi) || 0);
    const legacyExistingInstallment = Math.max(0, Number(input?.existingInstallment) || 0);
    const existingInstallment = hasSplitObligations ? (angsuranBsi + angsuranSelainBsi) : legacyExistingInstallment;

    let akseptasiAktifRaw = 0;
    if (payrollInfo.valid) {
      if (hasSplitObligations) {
        if (payrollInfo.code === "P") {
          akseptasiAktifRaw = (totalRecognizedActiveIncome * (dbrActivePercent / 100) - angsuranSelainBsi) - angsuranBsi;
        } else if (payrollInfo.code === "C") {
          akseptasiAktifRaw = totalRecognizedActiveIncome * (dbrActivePercent / 100) - (angsuranBsi + angsuranSelainBsi);
        } else {
          akseptasiAktifRaw = (totalRecognizedActiveIncome - angsuranSelainBsi) * (dbrActivePercent / 100) - angsuranBsi;
        }
      } else {
        akseptasiAktifRaw = (totalRecognizedActiveIncome - existingInstallment) * (dbrActivePercent / 100);
      }
    }
    const akseptasiAktif = Math.floor(Math.max(0, akseptasiAktifRaw));
    const akseptasiPensiunRaw = manfaatPensiun * (dsrPensionPercent / 100);
    const akseptasiPensiun = Math.floor(Math.max(0, akseptasiPensiunRaw));

    // 2. Masa Aktif & Masa Pensiun (Dekade Berkah PP10 vs Tri Berkah PP3)
    const schemeType = input?.bsiScheme === "PP3" ? "PP3" : "PP10";
    const atribusiMode = input?.atribusiMode || "atribusi_asuransi";
    const akadType = input?.akadType || "MMQ";

    const bupAge = Math.max(55, Number(input?.bupAge) || Number(cfg.bupAgeDefault) || 58);
    const explicitBupYear = Number(input?.bupYear || input?.tmtPensiunYear) || 0;
    let actualMonthsToBup = 0;
    let bupDate = null;
    if (dob && processDate) {
      const targetBupYear = explicitBupYear >= 1990 ? explicitBupYear : (dob.getFullYear() + bupAge);
      bupDate = new Date(targetBupYear, dob.getMonth() + 1, 1);
      const rawDays = (bupDate.getTime() - processDate.getTime()) / (1000 * 60 * 60 * 24);
      actualMonthsToBup = rawDays > 0 ? Math.max(0, Math.round(rawDays / 30.5)) : 0;
    }

    const maxActiveCap = schemeType === "PP3" ? 36 : 120;
    const minActiveWindow = 1;
    const okActiveWindow = actualMonthsToBup >= minActiveWindow && actualMonthsToBup <= maxActiveCap;

    const maxTenorMonths = Number(cfg.maxTenorMonths) || 180;
    const rawTenorInput = Number(input?.tenor);
    const okTenorInput = Number.isInteger(rawTenorInput) && rawTenorInput >= 1 && rawTenorInput <= maxTenorMonths;
    const requestedTenor = okTenorInput ? rawTenorInput : Math.max(0, Math.floor(rawTenorInput || 0));

    const tenorAktif = actualMonthsToBup > 0 ? Math.min(requestedTenor, actualMonthsToBup) : 0;
    const tenorPensiun = Math.max(0, requestedTenor - tenorAktif);

    const minPlafondAbs = Number(cfg.minPlafondAbsolute) || 10000000;
    const maxPlafondAbs = Number(cfg.maxPlafondAbsolute) || 800000000;
    const requestedPlafond = Math.max(0, Number(input?.plafond) || 0);

    // 3. Pricing Margin/Ujrah Aktif & Pensiun (Mendukung input manual atau otomatis tier)
    const initialPricing = this.resolvePricingTier(requestedPlafond, schemeType, cfg, input);
    let baseRateAktifAnnual = initialPricing.baseRateAktifAnnual;
    let baseRatePensiunAnnual = initialPricing.baseRatePensiunAnnual;

    // 4. Hitung Asuransi Jiwa Simas Prapensiun (Mendukung buffer masa polis, diskon, dan EM)
    const insuranceBufferMonths = input?.insuranceBufferMonths !== undefined && input?.insuranceBufferMonths !== null
      ? Number(input.insuranceBufferMonths)
      : (cfg.simasInsurance?.bufferMonths !== undefined ? Number(cfg.simasInsurance.bufferMonths) : 6);
    const insuranceMonths = input?.insuranceMonths !== undefined && input?.insuranceMonths !== null
      ? Number(input.insuranceMonths)
      : (requestedTenor + insuranceBufferMonths);
    const discountPercent = input?.discountPercent ?? 0;
    const extraEmPercent = input?.extraEmPercent ?? 0;

    const initialSimasResult = this.calculateSimasInsurance({
      nearestAge,
      insuranceMonths,
      plafond: requestedPlafond,
      atribusiMode,
      discountPercent,
      extraEmPercent
    }, cfg);

    const manualInsuranceOverride = Math.max(0, Number(input?.manualInsuranceFee) || 0);
    const initialNominalAtribusi = atribusiMode === "no_atribusi"
      ? 0
      : (manualInsuranceOverride > 0 ? manualInsuranceOverride : initialSimasResult.totalKontribusi);

    // 5. Kapasitas Plafond Maksimal (Sheet 6 PP10 vs Sheet 7 PP3)
    const plafonMaks = this.computeMaxPlafondForCandidate({
      schemeType,
      atribusiMode,
      baseRateAktifAnnual,
      baseRatePensiunAnnual,
      akseptasiAktif,
      akseptasiPensiun,
      tenorAktif,
      tenorPensiun,
      requestedTenor,
      nominalAtribusi: initialNominalAtribusi,
      cfg
    });

    // Plafond yang disetujui tidak boleh menggunakan fallback || requestedPlafond jika kapasitas 0
    const plafonDisetujui = (requestedPlafond > 0 && plafonMaks > 0)
      ? Math.min(requestedPlafond, plafonMaks)
      : 0;

    // F04: Requote premi asuransi & pricing tier apabila plafon hasil berbeda dari plafon pengajuan
    let simasResult = initialSimasResult;
    if (plafonDisetujui > 0 && plafonDisetujui !== requestedPlafond) {
      const updatedPricing = this.resolvePricingTier(plafonDisetujui, schemeType, cfg, input);
      baseRateAktifAnnual = updatedPricing.baseRateAktifAnnual;
      baseRatePensiunAnnual = updatedPricing.baseRatePensiunAnnual;
      simasResult = this.calculateSimasInsurance({
        nearestAge,
        insuranceMonths,
        plafond: plafonDisetujui,
        atribusiMode,
        discountPercent,
        extraEmPercent
      }, cfg);
    }

    const nominalAtribusi = atribusiMode === "no_atribusi"
      ? 0
      : (manualInsuranceOverride > 0 ? manualInsuranceOverride : simasResult.totalKontribusi);
    const atribusiPerBulan = requestedTenor > 0 ? nominalAtribusi / requestedTenor : 0;

    // 6. Jalur Jadwal Final PP10 (V3:V15) & PP3 (V3:V17)
    let angsuranAktifRaw = 0;
    let angsuranPensiunRaw = 0;
    let priceAtribAktif = baseRateAktifAnnual / 100;
    let priceAtribPensiun = baseRatePensiunAnnual / 100;
    let sisaOsSaatPensiunRaw = 0;
    const fullSchedule = [];
    let overpaymentDetected = false;

    if (plafonDisetujui > 0 && requestedTenor > 0 && tenorAktif > 0) {
      if (schemeType === "PP3") {
        // Sheet 7 Rumus Plafond + Atrib PP3 (2)!V3:V6
        const pokokAktifTetap = Number(cfg.atribusiAdjustments?.pp3PokokTetapAktif) || 10000;
        const v3MarginAktifBln = plafonDisetujui * (baseRateAktifAnnual / 100) / 12;
        const v4AtribBln = atribusiPerBulan;
        priceAtribAktif = ((v3MarginAktifBln + v4AtribBln) / plafonDisetujui) * 12;
        angsuranAktifRaw = pokokAktifTetap + v3MarginAktifBln + v4AtribBln;
      } else {
        // Sheet 6 Rumus Plafond + Atrib PP10 (2)!V3:V7
        const v3MarginAktifBln = plafonDisetujui * (baseRateAktifAnnual / 100) / 12;
        const v4AtribBln = atribusiPerBulan;
        const extraActiveAdd = atribusiPerBulan > 0
          ? ((Number(cfg.atribusiAdjustments?.pp10AtribExtraActive) || 1.0) / 100)
          : 0;
        priceAtribAktif = ((v3MarginAktifBln + v4AtribBln) / plafonDisetujui) * 12 + extraActiveAdd;
        angsuranAktifRaw = akseptasiAktif;
      }

      // Simulasi jadwal masa aktif bulan ke-1 s.d. tenorAktif
      let currentOs = plafonDisetujui;
      for (let m = 1; m <= tenorAktif; m++) {
        if (currentOs <= 1e-6) {
          overpaymentDetected = true;
          break;
        }
        const openingOs = currentOs;
        const marginBln = openingOs * (priceAtribAktif / 12);
        let pokokBln = angsuranAktifRaw - marginBln;
        let installmentBln = angsuranAktifRaw;

        if (pokokBln <= 0) {
          overpaymentDetected = true;
        }
        if (pokokBln > openingOs + 1e-6) {
          if (m < requestedTenor) {
            overpaymentDetected = true;
          }
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
          closingOs: closingRounded,
          raw: {
            openingOs,
            principalPayment: pokokBln,
            marginPayment: marginBln,
            totalInstallment: installmentBln,
            closingOs: currentOs
          }
        });
      }

      sisaOsSaatPensiunRaw = currentOs;

      if (tenorPensiun > 0) {
        if (sisaOsSaatPensiunRaw <= 1e-6) {
          overpaymentDetected = true;
        } else {
          if (schemeType === "PP3") {
            // Sheet 7 Rumus Plafond + Atrib PP3 (2)!V10:V17
            const v10SisaOs = sisaOsSaatPensiunRaw;
            const v11AtribBln = atribusiPerBulan;
            const v12BasePenRate = baseRatePensiunAnnual / 100;
            const v13TenorPen = tenorPensiun;
            const v14BasePmt = this.pmt(v12BasePenRate / 12, v13TenorPen, v10SisaOs, 0);
            const v15CombinedPmt = v11AtribBln + v14BasePmt;
            const rawAnnualPenRate = this.excelRate(v13TenorPen, -v15CombinedPmt, v10SisaOs) * 12;
            const roundedPenRate = v11AtribBln > 0
              ? this.roundHalfUp(rawAnnualPenRate, 4)
              : rawAnnualPenRate;
            const penAdd = nominalAtribusi > 0
              ? ((Number(cfg.atribusiAdjustments?.pp10PensionRateAdd) || 1.0) / 100)
              : 0;
            priceAtribPensiun = roundedPenRate + penAdd;
            angsuranPensiunRaw = this.pmt(priceAtribPensiun / 12, v13TenorPen, v10SisaOs, 0);
          } else {
            // Sheet 6 Rumus Plafond + Atrib PP10 (2)!V8:V15
            const v12MarginPenBln = sisaOsSaatPensiunRaw * (baseRatePensiunAnnual / 100) / 12;
            const v13AtribBln = atribusiPerBulan;
            priceAtribPensiun = ((v12MarginPenBln + v13AtribBln) / sisaOsSaatPensiunRaw) * 12;
            angsuranPensiunRaw = this.pmt(priceAtribPensiun / 12, tenorPensiun, sisaOsSaatPensiunRaw, 0);
          }

          let penOs = sisaOsSaatPensiunRaw;
          for (let m = tenorAktif + 1; m <= requestedTenor; m++) {
            if (penOs <= 1e-6) {
              overpaymentDetected = true;
              break;
            }
            const openingOs = penOs;
            const marginBln = openingOs * (priceAtribPensiun / 12);
            let pokokBln = angsuranPensiunRaw - marginBln;
            let installmentBln = angsuranPensiunRaw;

            if (m === requestedTenor || pokokBln > openingOs + 1e-6) {
              if (m < requestedTenor && pokokBln > openingOs + 1e-2) {
                overpaymentDetected = true;
              }
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
              closingOs: closingRounded,
              raw: {
                openingOs,
                principalPayment: pokokBln,
                marginPayment: marginBln,
                totalInstallment: installmentBln,
                closingOs: penOs
              }
            });
          }
        }
      }
    }

    // Preview merupakan subset langsung dari jadwal penuh (fullSchedule)
    const schedulePreview = fullSchedule.filter(
      (row) =>
        row.month <= 6 ||
        row.month === tenorAktif ||
        row.month === tenorAktif + 1 ||
        row.month === requestedTenor
    );

    const totalPrincipalScheduled = fullSchedule.reduce((acc, r) => acc + r.principalPayment, 0);
    const totalMarginScheduled = fullSchedule.reduce((acc, r) => acc + r.marginPayment, 0);
    const totalInstallmentScheduled = fullSchedule.reduce((acc, r) => acc + r.totalInstallment, 0);
    const finalClosingOs = fullSchedule.length > 0 ? fullSchedule[fullSchedule.length - 1].closingOs : plafonDisetujui;

    const angsuranAktif = Math.round(angsuranAktifRaw);
    const angsuranPensiun = Math.round(angsuranPensiunRaw);
    const sisaOsSaatPensiun = Math.round(sisaOsSaatPensiunRaw);

    const dsrAktifActual = totalRecognizedActiveIncome > 0
      ? ((angsuranAktifRaw + existingInstallment) / totalRecognizedActiveIncome) * 100
      : 0;
    const dsrPensiunActual = manfaatPensiun > 0
      ? (angsuranPensiunRaw / manfaatPensiun) * 100
      : (tenorPensiun > 0 ? 100 : 0);

    // 7. Rincian Biaya, Blokir per Produk, Pelunasan, Buka Blokir Lama, & Terima Bersih
    const adminFeeRaw = plafonDisetujui * ((Number(cfg.fees?.adminRatePercent) || 1.0) / 100);
    const adminFee = Math.round(adminFeeRaw);
    const materaiFee = plafonDisetujui > 0 ? (Number(cfg.fees?.materaiFee) || 100000) : 0;
    const insuranceDeductFromCashRaw = atribusiMode === "no_atribusi" ? (simasResult.raw?.totalKontribusi ?? simasResult.totalKontribusi) : 0;
    const insuranceDeductFromCash = atribusiMode === "no_atribusi" ? simasResult.totalKontribusi : 0;

    // F10: PP3 memblokir seluruh bulan aktif * angsuran aktif + 2x angsuran pensiun (Simulasi!B37)
    const blokirActiveMultiplier = schemeType === "PP3"
      ? tenorAktif
      : (Number(cfg.fees?.blokirActiveCount) || 1);
    const blokirPensionMultiplier = tenorPensiun > 0 ? (Number(cfg.fees?.blokirPensionCount) || 2) : 0;

    const blokirAktifRaw = angsuranAktif * blokirActiveMultiplier;
    const blokirAktifNominal = Math.round(blokirAktifRaw);
    const blokirPensiunRaw = angsuranPensiunRaw * blokirPensionMultiplier;
    const blokirPensiunNominal = Math.round(blokirPensiunRaw);
    const totalBlokirAngsuranRaw = blokirAktifRaw + blokirPensiunRaw;
    const totalBlokirAngsuran = Math.round(totalBlokirAngsuranRaw);

    // F15: Kontrak eksplisit Pelunasan Lama / Take Over & Buka Blokir Lama
    const takeOverAmount = input?.isTakeOver === false
      ? 0
      : Math.max(0, Number(input?.pelunasanLama ?? input?.pelunasanAmount ?? input?.takeOverAmount ?? 0) || 0);
    const bukaBlokirLama = Math.max(
      0,
      Number(
        input?.bukaBlokirLama ??
        input?.bukaBlokir ??
        input?.bukaBlokirAmount ??
        input?.oldBlockRelease ??
        input?.blockReleaseAmount ??
        input?.releaseBlockAmount ??
        0
      ) || 0
    );

    const totalBiayaKreditRaw = adminFeeRaw + materaiFee + insuranceDeductFromCashRaw;
    const totalBiayaKredit = adminFee + materaiFee + insuranceDeductFromCash;
    const terimaBersihRaw = plafonDisetujui - totalBiayaKreditRaw - totalBlokirAngsuranRaw - takeOverAmount + bukaBlokirLama;
    const terimaBersih = Math.round(terimaBersihRaw);

    const taksasiMmq = plafonDisetujui > 0
      ? Math.ceil((plafonDisetujui * (1 + (Number(cfg.fees?.taksasiMmqMarkupPercent) || 2.0) / 100)) / 1000000) * 1000000
      : 0;

    // 8. Validasi Ketentuan Lengkap BSI Prapensiun & Simas Jiwa (F01–F16)
    const checks = [];
    const maxEndDate = (dob && window.AMS2Engine)
      ? window.AMS2Engine.addYearsMonths(dob, Number(cfg.maxEndAgeYears) || 74, Number(cfg.maxEndAgeMonths) || 4)
      : null;
    const loanEndDate = (processDate && window.AMS2Engine && requestedTenor > 0)
      ? window.AMS2Engine.addYearsMonths(processDate, 0, requestedTenor)
      : null;

    const okEndAge = Boolean(maxEndDate && loanEndDate && loanEndDate <= maxEndDate);
    const okBenefitInput = tenorPensiun === 0 || manfaatPensiun > 0;
    const okDsrAktif = payrollInfo.valid && angsuranAktifRaw <= akseptasiAktif + 1 && dsrAktifActual <= dbrActivePercent + 0.1;
    const okDsrPensiun = tenorPensiun === 0 || (okBenefitInput && angsuranPensiunRaw <= akseptasiPensiunRaw + 1 && dsrPensiunActual <= dsrPensionPercent + 0.1);
    const okPlafond =
      requestedPlafond >= minPlafondAbs &&
      requestedPlafond <= plafonMaks &&
      requestedPlafond <= maxPlafondAbs &&
      plafonDisetujui >= minPlafondAbs;
    const okCashPositive = terimaBersihRaw >= 0 && terimaBersih >= 0;
    const okInsurance = Boolean(simasResult && simasResult.valid === true);
    const okSchedule = Boolean(
      !overpaymentDetected &&
      requestedTenor > 0 &&
      fullSchedule.length === requestedTenor &&
      Math.abs(finalClosingOs) <= 5
    );

    checks.push({
      level: okEndAge && okActiveWindow && okTenorInput ? "pass" : "fail",
      title: `Usia Jatuh Tempo (Maks ${cfg.maxEndAgeYears || 74} Thn ${cfg.maxEndAgeMonths || 4} Bln) & Jendela ${schemeType}`,
      message: okEndAge && okActiveWindow && okTenorInput
        ? `Sesuai — Usia ${ageDetail ? ageDetail.years : "-"} thn, sisa aktif ${actualMonthsToBup} bln, tenor ${requestedTenor} bln (${tenorAktif} bln aktif + ${tenorPensiun} bln pensiun).`
        : !okActiveWindow
          ? `Tidak Sesuai — Sisa masa aktif ke BUP (${actualMonthsToBup} bulan) berada di luar jendela ${schemeType} (1–${maxActiveCap} bulan).`
          : !okTenorInput
            ? `Tidak Sesuai — Tenor harus bilangan bulat antara 1 s.d. ${maxTenorMonths} bulan.`
            : `Tidak Sesuai — Tenor ${requestedTenor} bulan melewati batas usia jatuh tempo ${cfg.maxEndAgeYears || 74} tahun ${cfg.maxEndAgeMonths || 4} bulan.`
    });

    checks.push({
      level: payrollInfo.valid && okBenefitInput && okDsrAktif && okDsrPensiun ? "pass" : "fail",
      title: `DSR Masa Aktif (${payrollInfo.label} Maks ${dbrActivePercent}%) & Masa Pensiun (Maks ${dsrPensionPercent}%)`,
      message: payrollInfo.valid && okBenefitInput && okDsrAktif && okDsrPensiun
        ? `Sesuai — DSR Aktif ${dsrAktifActual.toFixed(1)}% (Angs Rp${angsuranAktif.toLocaleString("id-ID")}) & DSR Pensiun ${dsrPensiunActual.toFixed(1)}% (Angs Rp${angsuranPensiun.toLocaleString("id-ID")}).`
        : !payrollInfo.valid
          ? `Tidak Sesuai — Status payroll "${payrollInfo.label}" tidak dikenali.`
          : !okBenefitInput
            ? "Tidak Sesuai — Manfaat pensiun wajib diisi (> Rp0) untuk pembiayaan yang melewati masa pensiun."
            : `Perhatian — DSR Pensiun (${dsrPensiunActual.toFixed(1)}%) atau DSR Aktif (${dsrAktifActual.toFixed(1)}%) melampaui batas akseptasi.`
    });

    checks.push({
      level: okInsurance ? "pass" : "fail",
      title: `Asuransi Jiwa Simas Prapensiun (${simasResult.medicalStatus})`,
      message: okInsurance
        ? `Tarif Kontribusi ${simasResult.tarifPerMil}‰ (Usia terdekat ${simasResult.nearestAge} thn) · Kontribusi Rp${simasResult.totalKontribusi.toLocaleString("id-ID")} · ${simasResult.medicalNote}`
        : `Tidak Memenuhi Ketentuan Asuransi — ${simasResult.medicalStatus}: ${simasResult.medicalNote}`
    });

    checks.push({
      level: okPlafond && okCashPositive && okSchedule ? "pass" : "fail",
      title: "Plafond, Jadwal Amortisasi & Terima Bersih Nasabah",
      message: okPlafond && okCashPositive && okSchedule
        ? `Sesuai — Plafond Rp${plafonDisetujui.toLocaleString("id-ID")} (Min Rp${minPlafondAbs.toLocaleString("id-ID")}, Maks Rp${plafonMaks.toLocaleString("id-ID")}), Terima Bersih Rp${terimaBersih.toLocaleString("id-ID")}.`
        : !okPlafond
          ? `Tidak Sesuai — Plafond pengajuan Rp${requestedPlafond.toLocaleString("id-ID")} di luar rentang Rp${minPlafondAbs.toLocaleString("id-ID")} s.d. Rp${plafonMaks.toLocaleString("id-ID")}.`
          : !okSchedule
            ? "Tidak Sesuai — Jadwal amortisasi mengalami pelunasan lebih awal sebelum tenor berakhir."
            : "Tidak Sesuai — Terima Bersih bernilai negatif."
    });

    const hasCoreInput = Boolean(dob && gajiPokok > 0 && requestedPlafond > 0 && requestedTenor > 0);
    const overallValid = Boolean(
      hasCoreInput &&
      payrollInfo.valid &&
      okTenorInput &&
      okActiveWindow &&
      okEndAge &&
      okBenefitInput &&
      okDsrAktif &&
      okDsrPensiun &&
      okInsurance &&
      okPlafond &&
      okCashPositive &&
      okSchedule
    );

    return {
      engine: "bsi_simas",
      partnerName: cfg.name,
      hasCoreInput,
      overallValid,
      overallStatusLabel: !hasCoreInput
        ? "Lengkapi Data Prapensiun"
        : overallValid
          ? "Sesuai — Lolos Akseptasi NOS BSI & Simas Jiwa"
          : "Perlu Penyesuaian Plafond / Tenor / DSR / Asuransi",
      debtor: {
        name: input?.name || "-",
        nip: input?.nip || "-",
        dob: input?.dob || "-",
        processDate: input?.processDate || "-",
        processDateProvided,
        ageYears: ageDetail ? ageDetail.years : null,
        ageMonths: ageDetail ? ageDetail.months : null,
        ageDays: ageDetail ? ageDetail.days : null,
        nearestAge,
        ageText: ageDetail ? `${ageDetail.years} thn ${ageDetail.months} bln (Nearest: ${nearestAge} thn)` : "—",
        bupAge,
        actualMonthsToBup,
        region: input?.region || "-"
      },
      product: {
        category: schemeType === "PP3" ? "Tri Berkah (Prapen 3 Tahun)" : "Dekade Berkah (Prapen 10 Tahun)",
        schemeType,
        akadType,
        payrollCode: payrollInfo.code,
        payrollStatusLabel: payrollInfo.label,
        atribusiModeLabel: atribusiMode === "no_atribusi" ? "1. No Atribusi" : "2. Atribusi Asuransi Simas Jiwa",
        baseRateAktifAnnual,
        baseRatePensiunAnnual,
        priceAtribAktifPercent: this.roundHalfUp(priceAtribAktif * 100, 2),
        priceAtribPensiunPercent: this.roundHalfUp(priceAtribPensiun * 100, 2)
      },
      maximums: {
        totalRecognizedActiveIncome,
        thtRecognized,
        manfaatPensiun,
        maxInstallment: akseptasiAktif,
        akseptasiPensiun,
        maxTenor: maxTenorMonths,
        tenorAktif,
        tenorPensiun,
        minPlafond: minPlafondAbs,
        maxPlafond: plafonMaks
      },
      simulation: {
        salary: totalRecognizedActiveIncome,
        plafond: plafonDisetujui,
        requestedPlafond,
        tenor: requestedTenor,
        tenorAktif,
        tenorPensiun,
        takeOverAmount: Math.round(takeOverAmount),
        bukaBlokirLama: Math.round(bukaBlokirLama),
        angsuranBsi: Math.round(angsuranBsi),
        angsuranSelainBsi: Math.round(angsuranSelainBsi),
        bankInstallment: angsuranAktif,
        coopInstallment: angsuranAktif,
        pensionInstallment: angsuranPensiun,
        sisaOsSaatPensiun,
        dsrAktifActual,
        dsrPensiunActual,
        actualInstallmentRatio: dsrAktifActual,
        adminFee,
        materaiFee,
        nominalAtribusi,
        totalCreditCost: totalBiayaKredit,
        blokirActiveCount: blokirActiveMultiplier,
        blokirPensionCount: blokirPensionMultiplier,
        blokirAktifNominal,
        blokirPensiunNominal,
        retentionAmount: totalBlokirAngsuran,
        netDisbursement: terimaBersih,
        remainingSalary: Math.round(totalRecognizedActiveIncome - angsuranAktifRaw),
        remainingPensionSalary: Math.round(manfaatPensiun - angsuranPensiunRaw),
        taksasiMmq
      },
      raw: {
        totalRecognizedActiveIncome: totalRecognizedActiveIncomeRaw,
        akseptasiAktif: akseptasiAktifRaw,
        akseptasiPensiun: akseptasiPensiunRaw,
        priceAtribAktif,
        priceAtribPensiun,
        angsuranAktif: angsuranAktifRaw,
        angsuranPensiun: angsuranPensiunRaw,
        sisaOsSaatPensiun: sisaOsSaatPensiunRaw,
        adminFee: adminFeeRaw,
        materaiFee,
        nominalAtribusi: simasResult.raw?.totalKontribusi ?? nominalAtribusi,
        blokirAktif: blokirAktifRaw,
        blokirPensiun: blokirPensiunRaw,
        totalBlokirAngsuran: totalBlokirAngsuranRaw,
        totalBiayaKredit: totalBiayaKreditRaw,
        takeOverAmount,
        bukaBlokirLama,
        terimaBersih: terimaBersihRaw
      },
      simasInsurance: simasResult,
      schedule: fullSchedule,
      fullSchedule,
      scheduleSummary: {
        totalMonths: fullSchedule.length,
        totalPrincipal: totalPrincipalScheduled,
        totalMargin: totalMarginScheduled,
        totalInstallment: totalInstallmentScheduled,
        finalClosingOs,
        earlyPayoff: overpaymentDetected
      },
      schedulePreview,
      officers: {
        pic: input?.pic || "MUHAMMAD TEGUH PRANADA",
        smName: input?.smName || "-",
        smPhone: input?.smPhone || "-",
        marketingName: input?.marketingName || "-",
        marketingPhone: input?.marketingPhone || "-"
      },
      checks
    };
  }
};
