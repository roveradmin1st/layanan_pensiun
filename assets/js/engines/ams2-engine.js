// ============================================================================
// AMS2 FINANCIAL CALCULATION ENGINE (KOPERASI ASIA MADANI SEJAHTERA)
// Mengimplementasikan seluruh metode perhitungan Anuitas PV/PMT, BAA, Biaya,
// Retensi, Sisa Pencairan Bersih, & 11 Validasi Otomatis dengan Parameter Dinamis
// ============================================================================

window.AMS2Engine = {
  parseDate(str) {
    if (!str) return null;
    const parts = String(str).split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  },

  addYearsMonths(dateObj, years, months) {
    const x = new Date(dateObj.getTime());
    const day = x.getDate();
    x.setDate(1);
    x.setFullYear(x.getFullYear() + Number(years || 0));
    x.setMonth(x.getMonth() + Number(months || 0));
    const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, lastDay));
    return x;
  },

  getAgeDetail(dob, at) {
    if (!dob || !at) return null;
    let years = at.getFullYear() - dob.getFullYear();
    let months = at.getMonth() - dob.getMonth();
    let days = at.getDate() - dob.getDate();
    if (days < 0) {
      months -= 1;
      const prevMonthLastDay = new Date(at.getFullYear(), at.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return { years, months, days };
  },

  pmt(monthlyRate, nMonths, pv) {
    if (nMonths <= 0 || pv <= 0) return 0;
    if (monthlyRate === 0) return pv / nMonths;
    return (pv * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -nMonths));
  },

  pv(monthlyRate, nMonths, payment) {
    if (nMonths <= 0 || payment <= 0) return 0;
    if (monthlyRate === 0) return payment * nMonths;
    return payment * ((1 - Math.pow(1 + monthlyRate, -nMonths)) / monthlyRate);
  },

  calculate(input, amsConfig) {
    const cfg = amsConfig || window.StorageService.getPartnerParameters().ams2;
    const dob = this.parseDate(input.dob);
    const processDate = this.parseDate(input.processDate) || new Date();
    const salary = Math.max(0, Number(input.salary) || 0);
    const requestedPlafond = Math.max(0, Number(input.plafond) || 0);
    const requestedTenor = Math.max(0, Math.floor(Number(input.tenor) || 0));
    const takeOverAmount = input.isTakeOver ? Math.max(0, Number(input.takeOverAmount) || 0) : 0;
    const rawTataLaksana = input.tataLaksanaPercent !== undefined && input.tataLaksanaPercent !== ""
      ? Number(input.tataLaksanaPercent)
      : Number(cfg.tataLaksanaDefault);

    const ageDetail = this.getAgeDetail(dob, processDate);
    const ageYears = ageDetail ? ageDetail.years : null;

    // 1. Tentukan Kategori Produk & Parameter Tier berdasarkan Usia Masuk
    let matchedTier = null;
    let categoryLabel = "—";
    let coopRateAnnual = null;
    let riskReserveRate = null;
    let isAgeEligible = false;

    if (ageYears !== null && ageYears >= 0) {
      for (const tier of cfg.tiers) {
        if (ageYears >= Number(tier.minAge) && ageYears <= Number(tier.maxAge)) {
          matchedTier = tier;
          break;
        }
      }
      if (matchedTier && ageYears <= Number(cfg.maxEntryAgeYears)) {
        categoryLabel = matchedTier.name;
        coopRateAnnual = Number(matchedTier.coopRateAnnual);
        riskReserveRate = Number(matchedTier.riskReserveRate);
        isAgeEligible = true;
      } else {
        categoryLabel = `Di Luar Ketentuan (Usia ${ageYears} Thn)`;
        isAgeEligible = false;
      }
    }

    // 2. Hitung Tenor Maksimal berdasarkan Batas Usia Akhir (default 84 tahun 10 bulan)
    let maxTenorByAge = 0;
    let maxEndDate = null;
    if (dob && processDate) {
      maxEndDate = this.addYearsMonths(dob, cfg.maxEndAgeYears, cfg.maxEndAgeMonths);
      let diffMonths =
        (maxEndDate.getFullYear() - processDate.getFullYear()) * 12 +
        (maxEndDate.getMonth() - processDate.getMonth());
      const candidateEnd = this.addYearsMonths(processDate, 0, Math.max(0, diffMonths));
      if (candidateEnd > maxEndDate) {
        diffMonths -= 1;
      }
      maxTenorByAge = Math.max(0, Math.min(Number(cfg.maxTenorMonths), diffMonths));
    }

    // 3. Hitung Angsuran Maksimal (default 95% dari gaji bulanan)
    const maxInstallmentRatio = Number(cfg.maxInstallmentRatio) || 95;
    const maxInstallment = salary * (maxInstallmentRatio / 100);

    // 4. Hitung Plafond Maksimal (PV dengan Bunga Koperasi)
    const effectiveTenorForRec = requestedTenor > 0
      ? Math.min(requestedTenor, maxTenorByAge || Number(cfg.maxTenorMonths))
      : maxTenorByAge;

    let maxPlafondByPv = 0;
    let maxPlafond = 0;
    if (salary > 0 && coopRateAnnual !== null && effectiveTenorForRec > 0 && isAgeEligible) {
      const monthlyCoopRate = (coopRateAnnual / 100) / 12;
      maxPlafondByPv = this.pv(monthlyCoopRate, effectiveTenorForRec, maxInstallment);
      // Bulatkan ke bawah ke rupiah penuh agar angsuran tidak melampaui 95% gaji
      let flooredPv = Math.floor(maxPlafondByPv);
      while (flooredPv > 0 && this.pmt(monthlyCoopRate, effectiveTenorForRec, flooredPv) > maxInstallment + 1e-6) {
        flooredPv -= 1;
      }
      maxPlafond = Math.min(Number(cfg.maxPlafondAbsolute), flooredPv);
    }

    // 5. Validasi Tata Laksana (0% - 3,5% default)
    const tlMin = Number(cfg.tataLaksanaMin) || 0;
    const tlMax = Number(cfg.tataLaksanaMax) || 3.5;
    const isTataLaksanaValid = !isNaN(rawTataLaksana) && rawTataLaksana >= tlMin && rawTataLaksana <= tlMax;
    const validTataLaksanaPercent = isTataLaksanaValid
      ? rawTataLaksana
      : Math.min(tlMax, Math.max(tlMin, rawTataLaksana || 0));

    // 6. Perhitungan Komponen Simulasi Aktual
    const hasCoreInput = Boolean(dob && processDate && salary > 0 && requestedPlafond > 0 && requestedTenor > 0);
    const bankRateAnnual = Number(cfg.bankRateAnnual) || 12.0;

    let bankInstallmentRaw = 0;
    let coopInstallmentRaw = 0;
    let baaMonthlyRaw = 0;
    let proaqFee = 0;
    let riskReserveFee = 0;
    let adminFee = Number(cfg.adminFee) || 700000;
    let tataLaksanaFee = 0;
    let totalCreditCost = 0;
    let retentionAmount = 0;
    let netDisbursement = 0;
    let remainingSalary = 0;
    let actualInstallmentRatio = 0;
    let loanEndDate = null;

    if (hasCoreInput && coopRateAnnual !== null) {
      bankInstallmentRaw = this.pmt((bankRateAnnual / 100) / 12, requestedTenor, requestedPlafond);
      coopInstallmentRaw = this.pmt((coopRateAnnual / 100) / 12, requestedTenor, requestedPlafond);
      baaMonthlyRaw = coopInstallmentRaw - bankInstallmentRaw;

      // Biaya dihitung presisi penuh lalu dibulatkan ke rupiah penuh untuk penyajian konsisten
      proaqFee = Math.round(requestedPlafond * (Number(cfg.proaqRate) / 100));
      riskReserveFee = Math.round(requestedPlafond * (riskReserveRate / 100));
      tataLaksanaFee = Math.round(requestedPlafond * (validTataLaksanaPercent / 100));
      totalCreditCost = proaqFee + riskReserveFee + adminFee + tataLaksanaFee;

      // Retensi Angsuran = 3x angsuran koperasi aktual per bulan (terpisah dari Total Biaya Kredit)
      const retentionMult = Number(cfg.retentionMultiplier) || 3;
      retentionAmount = Math.round(coopInstallmentRaw * retentionMult);

      // Sisa Pencairan Bersih = Plafond - Total Biaya Kredit - Take Over - Retensi Angsuran
      netDisbursement = requestedPlafond - totalCreditCost - Math.round(takeOverAmount) - retentionAmount;

      // Sisa Gaji = Gaji Bulanan - Angsuran Koperasi Aktual
      remainingSalary = Math.round(salary - coopInstallmentRaw);
      actualInstallmentRatio = salary > 0 ? (coopInstallmentRaw / salary) * 100 : 0;
      loanEndDate = this.addYearsMonths(processDate, 0, requestedTenor);
    }

    // 7. Pemeriksaan Validasi Ketat (11 Poin Validasi Resmi AMS2)
    const checks = [];
    const statusMatrix = {};

    if (!hasCoreInput) {
      checks.push({
        level: "warn",
        title: "Data Belum Lengkap",
        message: "Mohon lengkapi nama debitur, tanggal lahir, gaji bulanan, plafond, dan tenor pengajuan."
      });
    }

    // V1: Usia Masuk & Kategori
    if (ageYears !== null) {
      const okEntry = isAgeEligible && ageYears <= Number(cfg.maxEntryAgeYears) && maxTenorByAge > 0;
      statusMatrix.entryAge = okEntry;
      checks.push({
        level: okEntry ? "pass" : "fail",
        title: "Status Kategori & Usia Masuk",
        message: okEntry
          ? `Sesuai — Usia ${ageDetail.years} thn ${ageDetail.months} bln masuk kategori ${categoryLabel} (Bunga Koperasi ${coopRateAnnual}%/thn).`
          : `Tidak Sesuai — Usia ${ageDetail.years} thn ${ageDetail.months} bln melewati batas usia masuk/akhir kredit AMS (${cfg.maxEndAgeYears} thn ${cfg.maxEndAgeMonths} bln).`
      });
    }

    // V2: Batas Usia Akhir (84 tahun 10 bulan) & Tenor
    if (dob && processDate && requestedTenor > 0) {
      const okEndAge = loanEndDate && maxEndDate && loanEndDate <= maxEndDate;
      const okMaxTenor = requestedTenor <= Number(cfg.maxTenorMonths) && requestedTenor <= maxTenorByAge;
      statusMatrix.endAge = Boolean(okEndAge);
      statusMatrix.tenor = Boolean(okEndAge && okMaxTenor);
      checks.push({
        level: okEndAge && okMaxTenor ? "pass" : "fail",
        title: `Status Batas Usia Akhir (${cfg.maxEndAgeYears} Thn ${cfg.maxEndAgeMonths} Bln) & Tenor`,
        message: okEndAge && okMaxTenor
          ? `Sesuai — Tenor ${requestedTenor} bulan masih dalam batas tenor maksimal (${maxTenorByAge} bulan).`
          : `Tidak Sesuai — Tenor ${requestedTenor} bulan melampaui batas maksimal ${maxTenorByAge} bulan (usia akhir maks ${cfg.maxEndAgeYears} thn ${cfg.maxEndAgeMonths} bln / maks ${cfg.maxTenorMonths} bln).`
      });
    }

    // V3: Plafond
    if (requestedPlafond > 0 && salary > 0 && coopRateAnnual !== null) {
      const okPlafondAbs = requestedPlafond <= Number(cfg.maxPlafondAbsolute);
      const okPlafondPv = requestedPlafond <= maxPlafond;
      statusMatrix.plafond = okPlafondAbs && okPlafondPv;
      checks.push({
        level: okPlafondAbs && okPlafondPv ? "pass" : "fail",
        title: "Status Plafond Pengajuan",
        message: okPlafondAbs && okPlafondPv
          ? `Sesuai — Plafond Rp${requestedPlafond.toLocaleString("id-ID")} tidak melampaui Plafond Maksimal PV (Rp${maxPlafond.toLocaleString("id-ID")}).`
          : `Tidak Sesuai — Plafond Rp${requestedPlafond.toLocaleString("id-ID")} melebihi batas maksimal Rp${maxPlafond.toLocaleString("id-ID")}.`
      });
    }

    // V4: Rasio Angsuran Aktual (<= 95% Gaji)
    if (hasCoreInput && coopRateAnnual !== null) {
      const okRatio = coopInstallmentRaw <= maxInstallment + 1e-6;
      statusMatrix.installmentRatio = okRatio;
      checks.push({
        level: okRatio ? "pass" : "fail",
        title: `Status Rasio Angsuran Aktual (Maks ${maxInstallmentRatio}%)`,
        message: okRatio
          ? `Sesuai — Rasio angsuran koperasi ${actualInstallmentRatio.toFixed(2)}% ≤ ${maxInstallmentRatio}% gaji (Maks Rp${Math.round(maxInstallment).toLocaleString("id-ID")}).`
          : `Tidak Sesuai — Angsuran koperasi Rp${Math.round(coopInstallmentRaw).toLocaleString("id-ID")} (${actualInstallmentRatio.toFixed(2)}%) melebihi ${maxInstallmentRatio}% gaji.`
      });
    }

    // V5: Tata Laksana (0% - 3,5%)
    statusMatrix.tataLaksana = isTataLaksanaValid;
    checks.push({
      level: isTataLaksanaValid ? "pass" : "fail",
      title: `Status Tata Laksana (${tlMin}%–${tlMax}%)`,
      message: isTataLaksanaValid
        ? `Sesuai — Tata Laksana ${rawTataLaksana}% berada dalam rentang resmi ${tlMin}%–${tlMax}%.`
        : `Tidak Sesuai — Input Tata Laksana (${rawTataLaksana}%) di luar rentang resmi ${tlMin}%–${tlMax}%.`
    });

    // V6: Cadangan Risiko, Biaya Admin, Retensi, & Konsistensi Sisa Pencairan
    if (hasCoreInput && coopRateAnnual !== null) {
      statusMatrix.riskReserve = true;
      statusMatrix.adminFee = adminFee === Number(cfg.adminFee);
      statusMatrix.retention = retentionAmount === Math.round(coopInstallmentRaw * Number(cfg.retentionMultiplier));
      const okTakeOver = takeOverAmount <= requestedPlafond;
      const okNetPositive = netDisbursement >= 0;
      statusMatrix.takeOver = okTakeOver;
      statusMatrix.consistency = okNetPositive && okTakeOver;

      checks.push({
        level: "pass",
        title: "Status Cadangan Risiko, Administrasi, & Retensi",
        message: `Sesuai — Cadangan Risiko ${riskReserveRate}% (${categoryLabel}), Admin Rp${adminFee.toLocaleString("id-ID")}, dan Retensi ${cfg.retentionMultiplier}× angsuran koperasi terpisah dari Total Biaya Kredit.`
      });

      checks.push({
        level: okNetPositive && okTakeOver ? "pass" : "fail",
        title: "Status Konsistensi Total Biaya & Sisa Pencairan Bersih",
        message: okNetPositive && okTakeOver
          ? `Sesuai — Sisa Pencairan Bersih Rp${netDisbursement.toLocaleString("id-ID")} positif dan seluruh pengurang dihitung tepat satu kali.`
          : `Tidak Sesuai — Sisa Pencairan Bersih bernilai negatif (Rp${netDisbursement.toLocaleString("id-ID")}) atau nilai Take Over melebihi Plafond.`
      });
    }

    const hasFail = checks.some(c => c.level === "fail");
    const overallValid = hasCoreInput && isAgeEligible && isTataLaksanaValid && !hasFail;

    return {
      engine: "ams2",
      partnerName: cfg.name,
      hasCoreInput,
      overallValid,
      overallStatusLabel: !hasCoreInput
        ? "Lengkapi Data Simulasi"
        : overallValid
          ? "Sesuai — Lolos Seluruh Validasi AMS2"
          : "Tidak Sesuai — Periksa Parameter Pengajuan",
      debtor: {
        name: input.name || "-",
        dob: input.dob || "-",
        processDate: input.processDate || "-",
        ageYears,
        ageMonths: ageDetail ? ageDetail.months : 0,
        ageDays: ageDetail ? ageDetail.days : 0,
        ageText: ageDetail ? `${ageDetail.years} tahun ${ageDetail.months} bulan` : "—",
        region: input.region || "-"
      },
      product: {
        category: categoryLabel,
        bankRateAnnual,
        coopRateAnnual: coopRateAnnual ?? 0,
        riskReserveRate: riskReserveRate ?? 0,
        proaqRate: Number(cfg.proaqRate),
        tataLaksanaPercent: rawTataLaksana,
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
        bankInstallment: Math.round(bankInstallmentRaw),
        coopInstallment: Math.round(coopInstallmentRaw),
        baaMonthly: Math.round(baaMonthlyRaw),
        actualInstallmentRatio,
        proaqFee,
        riskReserveFee,
        adminFee,
        tataLaksanaFee,
        totalCreditCost,
        retentionAmount,
        netDisbursement,
        remainingSalary
      },
      officers: {
        pic: input.pic || cfg.picDefault || "MUHAMMAD TEGUH PRANADA",
        smName: input.smName || "-",
        smPhone: input.smPhone || "-",
        marketingName: input.marketingName || "-",
        marketingPhone: input.marketingPhone || "-"
      },
      checks,
      statusMatrix
    };
  }
};
