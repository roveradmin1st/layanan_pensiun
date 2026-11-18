// ============================================================================
// BNI FLEKSI PENSIUN & PRA PURNA — UNIT, REFERENCE, ACCESS CONTROL & API TESTS
// Memakai database SQLite disposable/terpisah dan data sintetis penuh.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_PARTNER_PARAMETERS } from "../src/config/default-parameters.js";
import { calculateMax, calculatePreview, generateSimulationPdfBuffer } from "../src/engines/calc-engine.js";
import {
  datedifYMD,
  edateUtc,
  eomonthUtc,
  formatUtcDate,
  parseOptionalStrictCalendarDate,
  parseUtcDate
} from "../src/engines/bni-calc-engine.js";
import { disposableBackend, runFixture, startFixture } from "./helpers/disposable.mjs";
import { LEGACY_BNI } from "./helpers/legacy-bni.mjs";

const PASSWORD = "Bni-Synthetic-Test-Password-2026!";

test("BNI: rekomendasi dan preview menerapkan batas plafon produk dan underwriting", () => {
  const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);
  const input = {
    bank_key: "bank_bni", name: "SYNTHETIC MAX", birth_date: "1971-11-18",
    process_date: "2026-11-18", bni_product_code: "4", salary: 1000000000, tenor: 120
  };
  for (const [configuredCap, effectiveCap] of [[20000000000, 10000000000], [500000000, 500000000]]) {
    params.bank_bni.maxPlafondAbsolute = configuredCap;
    const max = calculateMax(input, params);
    const preview = calculatePreview(input, params);
    assert.equal(max.max_plafond, effectiveCap);
    assert.equal(preview.plafond, max.max_plafond);
    assert.ok(preview.overall_ok);
    const aboveCap = calculatePreview({ ...input, plafond: effectiveCap + 1 }, params);
    assert.equal(aboveCap.validations.find(({ key }) => key === "plafond").ok, false);
  }
  assert.equal(calculatePreview({ ...input, salary: [1000000000] }, params).status, "INVALID");
  assert.equal(calculatePreview({ ...input, bni_insurance_scheme: "GP_KOMBINASI MENURUN" }, params).error_code, "BNI_INSURANCE_SCHEME_UNKNOWN");
});

test("BNI Fleksi: Kasus acuan Excel BNI-01 (Pra Purna Kode 4, 17 Nov 2026) & BNI-02 (120 Jt, 120 bln, 12%)", () => {
  const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);
  const input = {
    bank_key: "bank_bni",
    name: "SYNTH BNI PRA PURNA",
    birth_date: "1969-01-15",
    process_date: "2026-11-17",
    bni_product_code: "4",
    bni_insurance_scheme: "MENURUN",
    salary: 3759100,
    bni_dbr_pct: 90,
    plafond: 100000000,
    tenor: 50,
    blokir_angsuran_count: 3,
    blokir_tabungan_count: 1,
    blokir_prapensiun_count: 10,
    take_over: 0
  };

  const maxRes = calculateMax(input, params);
  assert.equal(maxRes.status, "AVAILABLE");
  assert.equal(maxRes.processable, true);
  assert.equal(maxRes.age, 57);
  assert.equal(maxRes.age_rounded_years, 58);
  assert.equal(maxRes.age_exact_text, "57 Tahun 10 Bulan 2 Hari");
  assert.equal(maxRes.age_75_date, "2044-01-15");
  assert.equal(maxRes.remaining_service_months, 205);
  assert.equal(maxRes.max_tenor, 180);
  assert.equal(maxRes.excel_raw_max_tenor, 205);
  assert.ok(Math.abs(maxRes.max_installment_exact - 3383190) < 1e-6);
  assert.ok(Math.abs(maxRes.max_plafond_exact - 136534588.44093564) < 1e-3);

  const prev = calculatePreview(input, params);
  const bni = prev.bni_details;
  assert.equal(prev.status, "AVAILABLE");
  assert.equal(prev.overall_ok, true);
  assert.equal(bni.excel_d28_status, "PASSED");
  assert.equal(bni.maturity_date, "2031-01-31");
  assert.equal(bni.maturity_age_text, "62 Tahun 0 Bulan 16 Hari");
  assert.equal(bni.effective_rate_annual_pct, 10.5);
  assert.ok(Math.abs(bni.monthly_installment_exact - 2477899.584736777) < 1e-4);
  assert.equal(prev.coop_installment, 2477900);
  assert.ok(Math.abs(bni.remaining_salary_exact - 1281200.415263223) < 1e-4);
  assert.equal(bni.bank_fees, 4650000);
  assert.equal(bni.provisi, 1000000);
  assert.equal(bni.btl, 3500000);
  assert.equal(bni.admin_fee, 150000);
  assert.equal(bni.insurance_tenor_years, 5);
  assert.equal(bni.ajk_rate_permil, 54.64);
  assert.equal(bni.gross_ajk_premium, 5464000);
  assert.equal(bni.bni_subsidy_premium, 5464000);
  assert.equal(bni.customer_ajk_premium, 0);
  assert.equal(bni.underwriting_code, "HD");
  assert.equal(bni.net_before_blokir, 95350000);
  assert.ok(Math.abs(bni.blokir_angsuran_exact - 7433698.75421033) < 1e-4);
  assert.ok(Math.abs(bni.blokir_tabungan_exact - 2477899.584736777) < 1e-4);
  assert.ok(Math.abs(bni.blokir_prapensiun_exact - 24778995.84736777) < 1e-4);
  assert.ok(Math.abs(bni.total_blokir_exact - 34690594.18631476) < 1e-3);
  assert.ok(Math.abs(bni.terima_bersih_after_to_exact - 60659405.81368524) < 1e-3);
  assert.equal(prev.net_disbursement, 60659406);

  // Kasus komponen BNI-02: Plafond 120 jt, tenor 120 bln, bunga 12% (Kode 1 Reguler)
  const bni02 = calculatePreview({
    bank_key: "bank_bni",
    name: "SYNTH BNI-02",
    birth_date: "1962-11-17",
    process_date: "2026-11-17",
    bni_product_code: "1",
    bni_insurance_scheme: "MENURUN",
    salary: 5000000,
    bni_dbr_pct: 90,
    plafond: 120000000,
    tenor: 120,
    take_over: 0
  }, params);
  assert.equal(bni02.bank_rate, 12);
  assert.ok(Math.abs(bni02.bni_details.monthly_installment_exact - 1721651.380831049) < 1e-5);
  assert.equal(bni02.coop_installment, 1721651);
});

test("BNI Fleksi: Kasus acuan Reguler Kode 1 (Purna, biaya 3.7% + 80rb, Take Over, tanpa blokir prapen)", () => {
  const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);
  const res = calculatePreview({
    bank_key: "bank_bni",
    name: "SYNTH BNI REGULER",
    birth_date: "1962-03-10",
    process_date: "2026-08-10",
    bni_product_code: "1",
    bni_insurance_scheme: "MENURUN",
    salary: 5000000,
    bni_dbr_pct: 90,
    plafond: 80000000,
    tenor: 60,
    take_over: 10000000
  }, params);

  const bni = res.bni_details;
  assert.equal(res.status, "AVAILABLE");
  assert.equal(res.overall_ok, true);
  assert.equal(bni.entry_age_years, 64);
  assert.equal(bni.effective_rate_annual_pct, 11.8);
  assert.equal(bni.admin_fee, 80000);
  assert.equal(bni.provisi_pct, 0.2);
  assert.equal(bni.provisi, 160000);
  assert.equal(bni.btl_pct, 3.5);
  assert.equal(bni.btl, 2800000);
  assert.equal(bni.bank_fees, 3040000);
  assert.equal(bni.ajk_rate_permil, 72.69); // Usia 64, 5 thn
  assert.equal(bni.customer_ajk_premium, 0);
  assert.equal(bni.blokir_prapensiun_count, 0);
  assert.equal(bni.blokir_prapensiun, 0);
  assert.equal(bni.total_blokir_count, 4); // 3x angsuran + 1x tabungan
  assert.equal(res.take_over, 10000000);
  assert.ok(Math.abs(bni.terima_bersih_after_to_exact - (80000000 - 3040000 - 4 * bni.monthly_installment_exact - 10000000)) < 1e-4);
  assert.equal(res.net_disbursement, Math.round(bni.terima_bersih_after_to_exact));
});

test("BNI Fleksi: Batas usia (19, 20, 74, 75), tanggal akhir bulan (EOMONTH/EDATE), dan tahun kabisat", () => {
  const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);

  // Fungsi kalender murni
  assert.equal(formatUtcDate(eomonthUtc(parseUtcDate("2024-01-31"), 1)), "2024-02-29");
  assert.equal(formatUtcDate(eomonthUtc(parseUtcDate("2026-01-31"), 1)), "2026-02-28");
  assert.equal(formatUtcDate(edateUtc(parseUtcDate("1968-02-29"), 75 * 12)), "2043-02-28");
  const exactLeap = datedifYMD(parseUtcDate("2006-08-10"), parseUtcDate("2026-08-10"));
  assert.equal(exactLeap.years, 20);

  // Usia 19 (di bawah batas minimal 20 tahun AJK CAR)
  const age19 = calculateMax({
    bank_key: "bank_bni",
    name: "AGE 19",
    birth_date: "2006-08-11",
    process_date: "2026-08-10",
    bni_product_code: "4",
    salary: 5000000
  }, params);
  assert.equal(age19.age, 19);
  assert.equal(age19.processable, false);

  // Usia 20 tepat pada tanggal aplikasi (tenor 12 bln, 1 thn AJK = 0.77‰)
  const age20 = calculatePreview({
    bank_key: "bank_bni",
    name: "AGE 20",
    birth_date: "2006-08-10",
    process_date: "2026-08-10",
    bni_product_code: "1",
    salary: 5000000,
    plafond: 50000000,
    tenor: 12
  }, params);
  assert.equal(age20.age, 20);
  assert.equal(age20.bni_details.ajk_rate_permil, 0.77);
  assert.equal(age20.overall_ok, true);

  // Usia 74 dengan sisa masa 11 bulan: tenor 10 jatuh tempo 2027-06-30 <= 2027-07-15 (lolos)
  const age74Ok = calculatePreview({
    bank_key: "bank_bni",
    name: "AGE 74 OK",
    birth_date: "1952-07-15",
    process_date: "2026-08-10",
    bni_product_code: "1",
    salary: 6000000,
    plafond: 30000000,
    tenor: 10
  }, params);
  assert.equal(age74Ok.age, 74);
  assert.equal(age74Ok.bni_details.remaining_service_months, 11);
  assert.equal(age74Ok.bni_details.maturity_date, "2027-06-30");
  assert.equal(age74Ok.bni_details.ajk_rate_permil, 35.33);
  assert.equal(age74Ok.validations.find((check) => check.key === "tenor_service").ok, true);
  assert.equal(age74Ok.bni_details.underwriting_requires_verification, true);
  assert.equal(age74Ok.overall_ok, false);

  // Jatuh tempo EOMONTH melewati ulang tahun ke-75 meski tenor <= remainingServiceMonths
  const age74EomonthFail = calculatePreview({
    bank_key: "bank_bni",
    name: "AGE 74 EOMONTH PAST 75",
    birth_date: "1952-11-20",
    process_date: "2026-11-17",
    bni_product_code: "1",
    salary: 15000000,
    plafond: 50000000,
    tenor: 12
  }, params);
  assert.equal(age74EomonthFail.bni_details.remaining_service_months, 12);
  assert.equal(age74EomonthFail.bni_details.maturity_date, "2027-11-30");
  assert.equal(age74EomonthFail.bni_details.age_75_date, "2027-11-20");
  assert.equal(age74EomonthFail.overall_ok, false);
  const age74MaxClamp = calculateMax({
    bank_key: "bank_bni",
    name: "AGE 74 MAX EOMONTH CLAMP",
    birth_date: "1952-11-20",
    process_date: "2026-11-17",
    bni_product_code: "1",
    salary: 15000000
  }, params);
  assert.equal(age74MaxClamp.max_tenor, 11);

  // Tepat sebelum dan tepat pada ulang tahun (usia 57 -> 58 menggeser tarif AJK 54.64 -> 56.96)
  const dayBeforeBday = calculatePreview({
    bank_key: "bank_bni",
    name: "BEFORE BDAY",
    birth_date: "1968-11-18",
    process_date: "2026-11-17",
    bni_product_code: "4",
    salary: 5000000,
    plafond: 50000000,
    tenor: 50
  }, params);
  const onBday = calculatePreview({
    bank_key: "bank_bni",
    name: "ON BDAY",
    birth_date: "1968-11-17",
    process_date: "2026-11-17",
    bni_product_code: "4",
    salary: 5000000,
    plafond: 50000000,
    tenor: 50
  }, params);
  assert.equal(dayBeforeBday.age, 57);
  assert.equal(dayBeforeBday.bni_details.ajk_rate_permil, 54.64);
  assert.equal(onBday.age, 58);
  assert.equal(onBday.bni_details.ajk_rate_permil, 56.96);

  // Usia 74 dengan tenor 13 bln (butuh 2 thn AJK -> null / Tidak di Cover & > 11 bln)
  const age74Over = calculatePreview({
    bank_key: "bank_bni",
    name: "AGE 74 OVER",
    birth_date: "1952-07-15",
    process_date: "2026-08-10",
    bni_product_code: "1",
    salary: 6000000,
    plafond: 30000000,
    tenor: 13
  }, params);
  assert.equal(age74Over.bni_details.ajk_covered, false);
  assert.equal(age74Over.overall_ok, false);

  // Usia 75 (sisa 0 bulan)
  const age75 = calculateMax({
    bank_key: "bank_bni",
    name: "AGE 75",
    birth_date: "1951-08-10",
    process_date: "2026-08-10",
    bni_product_code: "1",
    salary: 5000000
  }, params);
  assert.equal(age75.age, 75);
  assert.equal(age75.processable, false);
});

test("BNI Fleksi: Transisi suku bunga, batas tenor, subsidi AJK sekitar 150‰, underwriting & pembulatan", () => {
  const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);

  // Transisi bunga Pra Purna (Kode 4)
  const expectedPra = [
    [12, 9.75], [13, 10.3], [36, 10.3], [37, 10.5], [60, 10.5],
    [61, 10.85], [132, 10.85], [133, 10.85], [144, 10.85], [180, 10.85]
  ];
  for (const [tenor, expRate] of expectedPra) {
    const r = calculatePreview({
      bank_key: "bank_bni",
      name: "RATE CHECK PRA",
      birth_date: "1980-01-01",
      process_date: "2026-08-10",
      bni_product_code: "4",
      salary: 10000000,
      plafond: 50000000,
      tenor
    }, params);
    assert.equal(r.bank_rate, expRate, `Pra Purna tenor ${tenor} harus ${expRate}%`);
  }

  // Transisi bunga Reguler (Kode 1) — selain 133-144 yang berstatus UNAVAILABLE
  const expectedPurna = [
    [12, 11.0], [13, 11.8], [60, 11.8], [61, 12.0], [132, 12.0], [145, 12.1], [180, 12.1]
  ];
  for (const [tenor, expRate] of expectedPurna) {
    const r = calculatePreview({
      bank_key: "bank_bni",
      name: "RATE CHECK PURNA",
      birth_date: "1980-01-01",
      process_date: "2026-08-10",
      bni_product_code: "1",
      salary: 10000000,
      plafond: 50000000,
      tenor
    }, params);
    assert.equal(r.bank_rate, expRate, `Purna Kode 1 tenor ${tenor} harus ${expRate}%`);
  }

  // Di sekitar batas subsidi 150‰ (tenor 180 bln / 15 thn):
  // Usia 56, 15 thn -> 148.02‰ (<= 150‰ => nasabah 0)
  const subBelow = calculatePreview({
    bank_key: "bank_bni",
    name: "SUBSIDY 148.02",
    birth_date: "1970-08-10",
    process_date: "2026-08-10",
    bni_product_code: "4",
    salary: 15000000,
    plafond: 200000000,
    tenor: 180
  }, params);
  assert.equal(subBelow.bni_details.entry_age_years, 56);
  assert.equal(subBelow.bni_details.ajk_rate_permil, 148.02);
  assert.equal(subBelow.bni_details.bni_subsidy_permil, 148.02);
  assert.equal(subBelow.bni_details.customer_ajk_permil, 0);
  assert.equal(subBelow.bni_details.customer_ajk_premium, 0);

  // Usia 57, 15 thn -> 154.82‰ (> 150‰ => BNI 150‰, Nasabah 4.82‰)
  const subAbove = calculatePreview({
    bank_key: "bank_bni",
    name: "SUBSIDY 154.82",
    birth_date: "1969-08-10",
    process_date: "2026-08-10",
    bni_product_code: "4",
    salary: 15000000,
    plafond: 200000000,
    tenor: 180
  }, params);
  assert.equal(subAbove.bni_details.entry_age_years, 57);
  assert.equal(subAbove.bni_details.ajk_rate_permil, 154.82);
  assert.equal(subAbove.bni_details.bni_subsidy_permil, 150);
  assert.ok(Math.abs(subAbove.bni_details.customer_ajk_permil - 4.82) < 1e-6);
  assert.equal(subAbove.bni_details.bni_subsidy_premium, 30000000); // 200.000 * 150
  assert.equal(subAbove.bni_details.customer_ajk_premium, 964000); // 200.000 * 4.82
  assert.equal(subAbove.bni_details.bank_fees, 200000000 * 0.045 + 150000); // 9.150.000
  assert.equal(subAbove.total_fees, 9150000 + 964000); // 10.114.000

  // Underwriting bracket untuk usia 51 dengan plafond 1,5 M -> "B"
  const uwB = calculatePreview({
    bank_key: "bank_bni",
    name: "UW B",
    birth_date: "1975-08-10",
    process_date: "2026-08-10",
    bni_product_code: "4",
    salary: 30000000,
    plafond: 1500000000,
    tenor: 120
  }, params);
  assert.equal(uwB.bni_details.entry_age_years, 51);
  assert.equal(uwB.bni_details.underwriting_code, "B");

  // Konsistensi auto max plafond (floor) agar tidak melampaui DBR saat pembulatan, serta max_plafond + 1 ditolak
  const autoMaxPrev = calculatePreview({
    bank_key: "bank_bni",
    name: "AUTO MAX FLOOR",
    birth_date: "1969-01-15",
    process_date: "2026-11-17",
    bni_product_code: "4",
    salary: 3759100,
    tenor: 50
  }, params);
  assert.equal(autoMaxPrev.plafond, 136534588); // floor(136534588.44093564)
  assert.equal(autoMaxPrev.overall_ok, true);
  assert.ok(autoMaxPrev.bni_details.monthly_installment_exact <= autoMaxPrev.bni_details.max_installment_exact);

  const plusOne = calculatePreview({
    bank_key: "bank_bni",
    name: "MAX PLUS ONE",
    birth_date: "1969-01-15",
    process_date: "2026-11-17",
    bni_product_code: "4",
    salary: 3759100,
    plafond: autoMaxPrev.plafond + 1,
    tenor: 50
  }, params);
  assert.equal(plusOne.overall_ok, false);

  // Pembulatan tahun asuransi 60 vs 61 bulan (5 thn vs 6 thn AJK) & subsidi > 150 permil pada usia 65 / 10 thn (150.64 permil)
  const t60 = calculatePreview({
    bank_key: "bank_bni", name: "T60", birth_date: "1969-01-15", process_date: "2026-11-17",
    bni_product_code: "4", salary: 5000000, plafond: 100000000, tenor: 60
  }, params);
  const t61 = calculatePreview({
    bank_key: "bank_bni", name: "T61", birth_date: "1969-01-15", process_date: "2026-11-17",
    bni_product_code: "4", salary: 5000000, plafond: 100000000, tenor: 61
  }, params);
  assert.equal(t60.bni_details.insurance_tenor_years, 5);
  assert.equal(t60.bni_details.ajk_rate_permil, 54.64);
  assert.equal(t61.bni_details.insurance_tenor_years, 6);
  assert.equal(t61.bni_details.ajk_rate_permil, 64.39);

  // Parameter hilang wajib gagal eksplisit tanpa fallback diam-diam ke default
  const noRates = structuredClone(DEFAULT_PARTNER_PARAMETERS);
  delete noRates.bank_bni.interestRateTiers;
  const resNoRates = calculatePreview({
    bank_key: "bank_bni", name: "NO RATES", birth_date: "1969-01-15", process_date: "2026-11-17",
    bni_product_code: "4", salary: 5000000, plafond: 50000000, tenor: 50
  }, noRates);
  assert.equal(resNoRates.status, "INVALID");
  assert.equal(resNoRates.error_code, "MISSING_BNI_CONFIG");
  assert.equal(resNoRates.overall_ok, false);

  const noAjk = structuredClone(DEFAULT_PARTNER_PARAMETERS);
  delete noAjk.bank_bni.ajkMenurunRegRates;
  const resNoAjk = calculatePreview({
    bank_key: "bank_bni", name: "NO AJK", birth_date: "1969-01-15", process_date: "2026-11-17",
    bni_product_code: "4", salary: 5000000, plafond: 50000000, tenor: 50
  }, noAjk);
  assert.equal(resNoAjk.status, "INVALID");
  assert.equal(resNoAjk.error_code, "MISSING_BNI_CONFIG");

  // Input cacat / negatif / tenor > 240 / terima bersih negatif
  assert.equal(calculateMax({ bank_key: "bank_bni", name: "BAD TENOR 241", birth_date: "1980-01-01", process_date: "2026-11-17", bni_product_code: "4", salary: 5000000, tenor: 241 }, params).processable, false);
  assert.equal(calculatePreview({ bank_key: "bank_bni", name: "NEG TO", birth_date: "1969-01-15", process_date: "2026-11-17", bni_product_code: "4", salary: 5000000, plafond: 50000000, tenor: 50, take_over: -1 }, params).status, "INVALID");
  const negNet = calculatePreview({
    bank_key: "bank_bni", name: "NEG NET", birth_date: "1969-01-15", process_date: "2026-11-17",
    bni_product_code: "4", salary: 5000000, plafond: 100000000, tenor: 50, take_over: 70000000
  }, params);
  assert.equal(negNet.overall_ok, false);
  assert.ok(negNet.net_disbursement < 0);
});

test("BNI Fleksi: Status UNAVAILABLE beserta alasannya untuk produk & kombinasi yang belum dikonfirmasi", () => {
  const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);

  // 1. Produk Kode 2 (Grace Period)
  const kode2 = calculatePreview({
    bank_key: "bank_bni",
    name: "KODE 2",
    birth_date: "1972-01-01",
    process_date: "2026-08-10",
    bni_product_code: "2",
    salary: 6000000,
    plafond: 50000000,
    tenor: 60
  }, params);
  assert.equal(kode2.status, "UNAVAILABLE");
  assert.equal(kode2.processable, false);
  assert.equal(kode2.overall_ok, false);
  assert.equal(kode2.error_code, "BNI_PRODUCT_UNAVAILABLE");
  assert.match(kode2.unavailable_reason, /Kode 2/i);

  // 2. Produk Kode 3 (Grace Period Kombinasi)
  const kode3 = calculatePreview({
    bank_key: "bank_bni",
    name: "KODE 3",
    birth_date: "1972-01-01",
    process_date: "2026-08-10",
    bni_product_code: "3",
    salary: 6000000,
    plafond: 50000000,
    tenor: 60
  }, params);
  assert.equal(kode3.status, "UNAVAILABLE");
  assert.equal(kode3.error_code, "BNI_PRODUCT_UNAVAILABLE");
  assert.match(kode3.unavailable_reason, /Kombinasi/i);

  // 3. Skema asuransi IBR / GP Murni / GP Kombinasi
  for (const scheme of ["IBR", "GP_MURNI", "GP_KOMBINASI"]) {
    const res = calculatePreview({
      bank_key: "bank_bni",
      name: `SCHEME ${scheme}`,
      birth_date: "1975-01-01",
      process_date: "2026-08-10",
      bni_product_code: "4",
      bni_insurance_scheme: scheme,
      salary: 6000000,
      plafond: 50000000,
      tenor: 60
    }, params);
    assert.equal(res.status, "UNAVAILABLE");
    assert.equal(res.error_code, "BNI_INSURANCE_SCHEME_UNAVAILABLE");
  }

  // 4. Tenor 133-144 bln pada Produk 1 (tumpang tindih bunga 12.00% vs 12.10%)
  const overlap140 = calculatePreview({
    bank_key: "bank_bni",
    name: "OVERLAP 140",
    birth_date: "1975-01-01",
    process_date: "2026-08-10",
    bni_product_code: "1",
    salary: 8000000,
    plafond: 100000000,
    tenor: 140
  }, params);
  assert.equal(overlap140.status, "UNAVAILABLE");
  assert.equal(overlap140.error_code, "BNI_RATE_OVERLAP_133_144_UNCONFIRMED");
  assert.match(overlap140.unavailable_reason, /133–144/);

  // 5. Tenor 181-240 bln pada Produk 4 (preview & max)
  const over180 = calculatePreview({
    bank_key: "bank_bni",
    name: "TENOR 200",
    birth_date: "1980-01-01",
    process_date: "2026-08-10",
    bni_product_code: "4",
    salary: 8000000,
    plafond: 100000000,
    tenor: 200
  }, params);
  assert.equal(over180.status, "UNAVAILABLE");
  assert.equal(over180.error_code, "BNI_TENOR_181_240_UNCONFIRMED");
  assert.match(over180.unavailable_reason, /181–240/);

  const maxOver180 = calculateMax({
    bank_key: "bank_bni",
    name: "MAX TENOR CAP 180",
    birth_date: "1980-01-01",
    process_date: "2026-08-10",
    bni_product_code: "4",
    salary: 8000000
  }, params);
  assert.equal(maxOver180.status, "AVAILABLE");
  assert.equal(maxOver180.max_tenor, 180);
  assert.equal(maxOver180.excel_raw_max_tenor, 240);
  assert.match(maxOver180.max_tenor_note || "", /181–240/);

  // 6. Kode 1 dengan sisa masa usia 140 bln (rentang overlap 133-144) dibatasi ke 132 bln pada calculateMax
  const maxOverlapClamp = calculateMax({
    bank_key: "bank_bni",
    name: "MAX CLAMP 132",
    birth_date: "1963-04-10",
    process_date: "2026-08-10",
    bni_product_code: "1",
    salary: 8000000
  }, params);
  assert.equal(maxOverlapClamp.remaining_service_months, 140);
  assert.equal(maxOverlapClamp.max_tenor, 132);
  assert.match(maxOverlapClamp.max_tenor_note || "", /133–144/);
});

test("BNI Fleksi HTTP Integration: konsistensi preview-simpan, penolakan UNAVAILABLE, bank_scope (bsi_only vs all_bank) & isolasi Multi-SM pada DB terpisah", { timeout: 60000 }, async () => {
  const fixture = disposableBackend();
  let running;
  try {
    const setupRes = runFixture(fixture, `import { getStore, saveStore, db } from './src/db/database.js';
import { hashPassword } from './src/security/passwords.js';
const state = getStore();
const pwd = await hashPassword(${JSON.stringify(PASSWORD)});
const mkUser = (id, name, role, extra = {}) => ({
  id, name, email: id + '@synthetic.test', password_hash: pwd, auth_version: 1,
  must_change_password: false, role, branch: 'BANDUNG', bank_scope: 'all_bank', active: true,
  created_at: '2026-11-16T00:00:00.000Z', ...extra
});
state.users = [
  mkUser('u-super', 'SUPER ADMIN SYNTH', 'super_admin', { branch: 'PUSAT JAKARTA' }),
  mkUser('u-branch-all', 'ADMIN CABANG ALL', 'admin_branch', { bank_scope: 'all_bank' }),
  mkUser('u-branch-bsi', 'ADMIN CABANG BSI', 'admin_branch', { bank_scope: 'bsi_only' }),
  mkUser('u-sm-1', 'SM SATU', 'sales_manager'),
  mkUser('u-sm-2', 'SM DUA', 'sales_manager'),
  mkUser('u-mkt-1', 'MKT SATU', 'marketing', { manager_id: 'u-sm-1', manager_name: 'SM SATU' }),
  mkUser('u-mkt-2', 'MKT DUA', 'marketing', { manager_id: 'u-sm-2', manager_name: 'SM DUA' }),
  mkUser('u-mkt-bsi', 'MKT BSI', 'marketing', { manager_id: 'u-sm-1', bank_scope: 'bsi_only' })
];
for (const k of ['leads', 'lead_requests', 'applications', 'simulations', 'claims', 'imports', 'parameter_proposals']) state[k] = [];
saveStore();
db.close();`);
    assert.equal(setupRes.status, 0, setupRes.stderr);

    running = await startFixture(fixture);
    const api = async (method, route, { token, body } = {}) => {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const res = await fetch(`${running.base}${route}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: res.status, data };
    };
    const login = async (id) => {
      const r = await api("POST", "/api/auth/login", {
        body: { email: `${id}@synthetic.test`, password: PASSWORD }
      });
      assert.equal(r.status, 200);
      return r.data.access_token;
    };

    const [tSuper, tBranchAll, tBranchBsi, tSm1, tSm2, tMkt1, tMkt2, tMktBsi] = await Promise.all([
      login("u-super"), login("u-branch-all"), login("u-branch-bsi"),
      login("u-sm-1"), login("u-sm-2"), login("u-mkt-1"), login("u-mkt-2"), login("u-mkt-bsi")
    ]);

    // 1. Cek /api/banks berdasarkan bank_scope
    const bsiOnlyBanks = await api("GET", "/api/banks", { token: tBranchBsi });
    assert.deepEqual(bsiOnlyBanks.data.banks.map((b) => b.key), ["bsi_prapen"]);
    const mktBsiBanks = await api("GET", "/api/banks", { token: tMktBsi });
    assert.deepEqual(mktBsiBanks.data.banks.map((b) => b.key), ["bsi_prapen"]);

    for (const tok of [tSuper, tBranchAll, tSm1, tMkt1]) {
      const bList = await api("GET", "/api/banks", { token: tok });
      const bniBank = bList.data.banks.find((b) => b.key === "bank_bni");
      assert.ok(bniBank && bniBank.supported === true, "User all_bank harus melihat bank_bni aktif");
    }

    // 2. User bsi_only (Admin Cabang BSI & Marketing BSI) ditolak 403 untuk BNI
    const validPayload = {
      bank_key: "bank_bni",
      name: "SYNTHETIC ÉLISA & < > ' \"",
      birth_date: "1969-01-15",
      process_date: "2026-11-17",
      bni_product_code: "4",
      bni_insurance_scheme: "MENURUN",
      salary: 3759100,
      bni_dbr_pct: 90,
      plafond: 100000000,
      tenor: 50,
      blokir_angsuran_count: 3,
      blokir_tabungan_count: 1,
      blokir_prapensiun_count: 10,
      take_over: 0
    };
    for (const bsiTok of [tBranchBsi, tMktBsi]) {
      assert.equal((await api("POST", "/api/calc/max", { token: bsiTok, body: validPayload })).status, 403);
      assert.equal((await api("POST", "/api/calc/preview", { token: bsiTok, body: validPayload })).status, 403);
      assert.equal((await api("POST", "/api/simulations", { token: bsiTok, body: validPayload })).status, 403);
    }

    // 3. Konsistensi antara /api/calc/preview dan POST /api/simulations
    const prevResp = await api("POST", "/api/calc/preview", { token: tMkt1, body: validPayload });
    assert.equal(prevResp.status, 200);
    assert.equal(prevResp.data.net_disbursement, 60659406);

    const saveResp = await api("POST", "/api/simulations", {
      token: tMkt1,
      body: { ...validPayload, expected_bni_policy_revision: prevResp.data.bni_policy_revision, ignored_field: "synthetic" }
    });
    assert.equal(saveResp.status, 200);
    assert.deepEqual(saveResp.data.result, prevResp.data, "Hasil tersimpan harus identik dengan hasil preview");
    assert.equal(Object.hasOwn(saveResp.data.input, "ignored_field"), false);
    const simId = saveResp.data.id;

    // 4. Penolakan simpan saat status UNAVAILABLE atau INVALID
    const saveUnavail = await api("POST", "/api/simulations", {
      token: tMkt1,
      body: { ...validPayload, bni_product_code: "2" }
    });
    assert.equal(saveUnavail.status, 400);
    assert.equal(saveUnavail.data.error_code, "BNI_PRODUCT_UNAVAILABLE");

    const saveBadTenor = await api("POST", "/api/simulations", {
      token: tMkt1,
      body: { ...validPayload, tenor: 241 }
    });
    assert.equal(saveBadTenor.status, 400);
    assert.equal(saveBadTenor.data.error_code, "BNI_TENOR_EXCEEDS_240");

    const saveBadDate = await api("POST", "/api/simulations", {
      token: tMkt1,
      body: { ...validPayload, birth_date: "1969-02-30" }
    });
    assert.equal(saveBadDate.status, 400);
    assert.equal(saveBadDate.data.error_code, "BNI_INVALID_INPUT");

    const saveNegTakeOver = await api("POST", "/api/simulations", {
      token: tMkt1,
      body: { ...validPayload, take_over: -1000 }
    });
    assert.equal(saveNegTakeOver.status, 400);

    // 5. Isolasi Multi-SM, Marketing & list scoping pada simulasi BNI
    const smPreview = await api("POST", "/api/calc/preview", { token: tSm1, body: validPayload });
    assert.equal(smPreview.status, 200);
    assert.equal(smPreview.data.net_disbursement, 60659406);
    assert.equal((await api("GET", "/api/simulations", { token: tSm1 })).data.items.some((s) => s.id === simId), true, "SM pembina melihat simulasi MKT1 di daftar");
    assert.equal((await api("GET", `/api/simulations/${simId}`, { token: tSm1 })).status, 200, "SM pembina MKT1 boleh akses");
    assert.equal((await api("GET", `/api/simulations/${simId}`, { token: tSm2 })).status, 403, "SM lain di cabang sama harus 403");
    assert.equal((await api("GET", `/api/simulations/${simId}`, { token: tMkt2 })).status, 403, "Marketing lain harus 403");
    assert.equal((await api("GET", `/api/simulations/${simId}`, { token: tMktBsi })).status, 403, "Marketing bsi_only harus 403");
    assert.equal((await api("GET", `/api/simulations/${simId}`, { token: tBranchAll })).status, 200, "Admin Cabang all_bank boleh akses");
    assert.equal((await api("GET", `/api/simulations/${simId}`, { token: tBranchBsi })).status, 403, "Admin Cabang bsi_only harus 403");
    assert.equal((await api("GET", "/api/simulations", { token: tSm2 })).data.items.some((s) => s.id === simId), false, "List simulasi SM2 tidak memuat simulasi tim SM1");
    assert.equal((await api("GET", "/api/simulations", { token: tBranchBsi })).data.items.some((s) => s.id === simId), false, "List simulasi bsi_only tidak memuat simulasi BNI");

    // 6. PDF, SVG & AI Summary BNI berfungsi
    const aiResp = await api("POST", `/api/simulations/${simId}/ai-summary`, { token: tSm1 });
    assert.equal(aiResp.status, 200);
    assert.match(aiResp.data.summary, /BANK BNI FLEKSI PENSIUN/);
    const pdfRes = await fetch(`${running.base}/api/simulations/${simId}/pdf`, {
      headers: { Authorization: `Bearer ${tMkt1}` }
    });
    assert.equal(pdfRes.status, 200);
    const pdfText = await pdfRes.text();
    assert.ok(pdfText.startsWith("%PDF-1.4"));
    assert.match(pdfText, /BNI FLEKSI/);

    const svgRes = await fetch(`${running.base}/api/simulations/${simId}/png`, {
      headers: { Authorization: `Bearer ${tMkt1}` }
    });
    assert.equal(svgRes.status, 200);
    assert.equal(svgRes.headers.get("cache-control"), "no-store");
    assert.equal(svgRes.headers.get("x-content-type-options"), "nosniff");
    const svgText = await svgRes.text();
    assert.match(svgText, /BANK BNI — BNI FLEKSI PENSIUN/);
    assert.ok(svgText.includes("SYNTHETIC ÉLISA &amp; &lt; &gt; &apos; &quot;"));
    assert.equal((await api("GET", `/api/simulations/${simId}/png`, { token: tSm2 })).status, 403);
    assert.equal((await api("GET", `/api/simulations/${simId}/pdf`, { token: tMktBsi })).status, 403);

    // 7. Proteksi endpoint parameter bank_bni (RBAC & Matrix Guard)
    assert.equal((await api("PUT", "/api/calc/params/bank_bni", { token: tMkt1, body: { updates: { maxInstallmentRatio: 85 } } })).status, 403);
    assert.equal((await api("PUT", "/api/calc/params/bank_bni", { token: tBranchAll, body: { updates: { maxInstallmentRatio: 85 } } })).status, 403);
    const badBniParam = await api("PUT", "/api/calc/params/bank_bni", {
      token: tSuper,
      body: { updates: { interestRateAnnual: 5.5 } }
    });
    assert.equal(badBniParam.status, 400);
    assert.equal(badBniParam.data.error_code, "BNI_PARAM_MANAGED_BY_MATRIX");
    const okBniParam = await api("PUT", "/api/calc/params/bank_bni", {
      token: tSuper,
      body: { updates: { maxInstallmentRatio: 85, subsidyPermilCap: 150 } }
    });
    assert.equal(okBniParam.status, 200);
    assert.equal(okBniParam.data.partner.maxInstallmentRatio, 85);
    const stale = await api("POST", "/api/simulations", {
      token: tMkt1, body: { ...validPayload, expected_bni_policy_revision: prevResp.data.bni_policy_revision }
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.error_code, "BNI_PREVIEW_STALE");
    const flagged = await api("POST", "/api/simulations", {
      token: tMkt1,
      body: {
        ...validPayload, bni_product_code: "1", birth_date: "1954-10-31",
        tenor: 24, plafond: 30000000, bni_dbr_pct: undefined, blokir_prapensiun_count: 0
      }
    });
    assert.equal(flagged.status, 200);
    assert.equal(flagged.data.result.bni_details.dbr_pct, 85);
    assert.equal(flagged.data.result.bni_details.underwriting_requires_verification, true);
    const held = await api("POST", `/api/simulations/${flagged.data.id}/approve`, { token: tMkt1, body: {} });
    assert.equal(held.status, 409);
    assert.equal(held.data.error_code, "BNI_UNDERWRITING_REVIEW_REQUIRED");
  } finally {
    if (running) await running.stop();
    fixture.cleanup();
  }
});

test("BNI Fleksi Production Preservation: migrasi store 6a791a3 idempoten dan boot production bersifat read-only terhadap SQLite", () => {
  const fixture = disposableBackend();
  try {
    // 1. Uji migrasi store dari format 6a791a3 (engine: partner_bank) pada store penuh dev secara idempoten
    const prepDev = runFixture(fixture, `import { getStore, saveStore, db } from './src/db/database.js';
const state = getStore();
state.partner_parameters.bsi_prapen.products.PP10.loan.maxPlafondAbsolute = 432000000;
state.partner_parameters.bank_bni = { id: 'bank_bni', code: 'BNI-FLEKSI', name: 'Bank BNI', engine: 'partner_bank', active: false, interestRateAnnual: 10.75 };
state.parameter_migration_snapshots = (state.parameter_migration_snapshots || []).filter(s => s.partner_key !== 'bank_bni');
saveStore();
console.log(JSON.stringify({ usersCount: state.users.length }));
db.close();`, 'development');
    assert.equal(prepDev.status, 0, prepDev.stderr);
    const expectedUsers = JSON.parse(prepDev.stdout.trim()).usersCount;

    const migrateRun = runFixture(fixture, `import { getStore, db } from './src/db/database.js';
const state = getStore();
console.log(JSON.stringify({
  usersCount: state.users.length,
  bsiCustomMax: state.partner_parameters.bsi_prapen.products.PP10.loan.maxPlafondAbsolute,
  bniEngine: state.partner_parameters.bank_bni.engine,
  bniSnapshots: state.parameter_migration_snapshots.filter(s => s.partner_key === 'bank_bni').length
}));
db.close();`, 'development');
    assert.equal(migrateRun.status, 0, migrateRun.stderr);
    assert.deepEqual(JSON.parse(migrateRun.stdout.trim()), {
      usersCount: expectedUsers,
      bsiCustomMax: 432000000,
      bniEngine: 'bni_fleksi',
      bniSnapshots: 1
    });

    // Jalankan kedua kali -> idempoten (snapshot tidak bertambah)
    const migrateRun2 = runFixture(fixture, `import { getStore, db } from './src/db/database.js';
const state = getStore();
console.log(JSON.stringify({
  bniSnapshots: state.parameter_migration_snapshots.filter(s => s.partner_key === 'bank_bni').length
}));
db.close();`, 'development');
    assert.equal(migrateRun2.status, 0, migrateRun2.stderr);
    assert.equal(JSON.parse(migrateRun2.stdout.trim()).bniSnapshots, 1);

    // 2. Uji strict read-only pada boot production dengan 1 akun & transaksi sintetis (tanpa demo reseed atau mutasi SQLite)
    const prepProd = runFixture(fixture, `import { getStore, saveStore, db } from './src/db/database.js';
import { hashPassword } from './src/security/passwords.js';
const state = getStore();
const pwd = await hashPassword(${JSON.stringify(PASSWORD)});
state.users = [{
  id: 'u-prod-super', name: 'PROD SUPER', email: 'prodsuper@synthetic.test',
  password_hash: pwd, auth_version: 2, must_change_password: false,
  role: 'super_admin', branch: 'PUSAT JAKARTA', bank_scope: 'all_bank', active: true,
  created_at: '2026-11-15T00:00:00.000Z'
}];
state.leads = [{ id: 'lead-prod-1', name: 'NASABAH PROD SINTETIS', branch: 'BANDUNG', status: 'baru', created_at: '2026-11-15T00:00:00.000Z' }];
state.applications = [{ id: 'app-prod-1', app_no: 'APP-PROD-01', lead_name: 'NASABAH PROD SINTETIS', branch: 'BANDUNG', bank_key: 'bsi_prapen', marketing_id: 'u-prod-super', stage: 'upload_dokumen', checklist: [], history: [] }];
state.simulations = [{ id: 'sim-prod-1', sim_no: 'SIM-PROD-01', bank_key: 'bsi_prapen', result: { name: 'NASABAH PROD SINTETIS', plafond: 100000000, tenor: 60 }, created_at: '2026-11-15T00:00:00.000Z' }];
state.claims = [{ id: 'clm-prod-1', claim_no: 'CLM-PROD-01', application_id: 'app-prod-1', branch: 'BANDUNG', bank_key: 'bsi_prapen', amount: 500000, status: 'APPROVED', history: [] }];
state.partner_parameters.bsi_prapen.products.PP10.loan.maxPlafondAbsolute = 432000000;
saveStore();
db.close();`, 'development');
    assert.equal(prepProd.status, 0, prepProd.stderr);

    const beforeProd = runFixture(fixture, `import { db } from './src/db/database.js';
console.log(db.prepare("SELECT payload FROM kv_store WHERE collection='enterprise_state'").get().payload);
db.close();`, 'development').stdout.trim();

    for (let i = 0; i < 2; i++) {
      const prodBoot = runFixture(fixture, `import { getStore, db } from './src/db/database.js';
const state = getStore();
if (state.users.length !== 1 || state.partner_parameters.bank_bni.engine !== 'bni_fleksi') {
  throw new Error('Unexpected state change in production');
}
db.close();`, 'production');
      assert.equal(prodBoot.status, 0, prodBoot.stderr);
    }

    const afterProd = runFixture(fixture, `import { db } from './src/db/database.js';
console.log(db.prepare("SELECT payload FROM kv_store WHERE collection='enterprise_state'").get().payload);
db.close();`, 'development').stdout.trim();
    assert.equal(afterProd, beforeProd, "Boot production tidak boleh memodifikasi payload enterprise_state");

    // 3. Store minimal produksi tanpa key bank_bni (pola ops/tests/test_production.py) tidak boleh dimutasi saat boot production
    const minProdPrep = runFixture(fixture, `import { getStore, saveStore, db } from './src/db/database.js';
const state = getStore();
delete state.partner_parameters.bank_bni;
saveStore();
db.close();`, 'development');
    assert.equal(minProdPrep.status, 0, minProdPrep.stderr);
    const minBefore = runFixture(fixture, `import { db } from './src/db/database.js';
console.log(db.prepare("SELECT payload FROM kv_store WHERE collection='enterprise_state'").get().payload);
db.close();`, 'development').stdout.trim();
    const minBoot = runFixture(fixture, `import { getStore, db } from './src/db/database.js'; getStore(); db.close();`, 'production');
    assert.equal(minBoot.status, 0, minBoot.stderr);
    const minAfter = runFixture(fixture, `import { db } from './src/db/database.js';
console.log(db.prepare("SELECT payload FROM kv_store WHERE collection='enterprise_state'").get().payload);
db.close();`, 'development').stdout.trim();
    assert.equal(minAfter, minBefore, "Boot production pada store tanpa bank_bni tidak boleh menyisipkan key baru");
  } finally {
    fixture.cleanup();
  }
});

test("BNI: aktivasi eksplisit pada SQLite production lama menjaga data dan kompatibilitas rollback", { timeout: 60000 }, async () => {
  const fixture = disposableBackend();
  let running;
  const copyProfile = () => {
    const db = new DatabaseSync(fixture.database, { readOnly: true });
    try {
      return {
        row: db.prepare("SELECT payload,updated_at FROM kv_store WHERE collection='enterprise_state'").get(),
        files: db.prepare("SELECT id,filename,mime_type,data,created_at FROM uploaded_files ORDER BY id").all()
      };
    } finally {
      db.close();
    }
  };
  const api = async (route, { token, body, method = body ? "POST" : "GET" } = {}) => {
    const response = await fetch(running.base + route, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json() };
  };
  const login = async (email) => {
    const response = await api("/api/auth/login", { body: { email, password: PASSWORD } });
    assert.equal(response.status, 200);
    return response.data.access_token;
  };
  const activatePath = "/api/calc/params/bank_bni/activate";
  const quote = {
    bank_key: "bank_bni", name: "SYNTHETIC PRODUCTION", birth_date: "1969-01-15",
    process_date: "2026-11-17", bni_product_code: "4", salary: 3759100, plafond: 100000000, tenor: 50
  };
  const baselineQuote = {
    bank_key: "ams2", name: "SYNTHETIC BASELINE", birth_date: "1969-01-15",
    process_date: "2026-11-17", salary: 5600000, plafond: 100000000, tenor: 60
  };
  try {
    const setup = runFixture(fixture, `
import { getStore, saveStore, saveUploadedFile, db } from './src/db/database.js';
import { hashPassword } from './src/security/passwords.js';
const state = getStore();
const hash = await hashPassword(${JSON.stringify(PASSWORD)});
for (const user of state.users) {
  user.password_hash = hash;
  user.auth_version = 2;
  user.must_change_password = false;
}
state.users.push({
  ...state.users.find(u => u.role === 'super_admin'),
  id: 'synthetic-bsi-super', email: 'bsi-super@synthetic.test', bank_scope: 'bsi_only'
});
state.partner_parameters.bsi_prapen.products.PP10.loan.maxPlafondAbsolute = 432000000;
state.partner_parameters.bank_bni = ${JSON.stringify(LEGACY_BNI)};
state.parameter_migration_snapshots = [{ partner_key: "bsi_prapen", migration_id: "synthetic-test-migration" }];
saveUploadedFile('doc-fixture', 'synthetic.pdf', 'application/pdf', Buffer.from('%PDF-1.4 synthetic bytes'));
saveStore();
db.close();`);
    assert.equal(setup.status, 0, setup.stderr);
    const beforeBoot = copyProfile();
    running = await startFixture(fixture, "production");
    assert.deepEqual(copyProfile(), beforeBoot, "Boot production tidak menulis SQLite");

    const superToken = await login("superadmin@layananpensiunan.id");
    const opsToken = await login("adminops@layananpensiunan.id");
    const marketingToken = await login("marketing@layananpensiunan.id");
    const scopedSuperToken = await login("bsi-super@synthetic.test");
    const banks = () => api("/api/banks", { token: marketingToken });
    const getParams = () => api("/api/calc/params", { token: superToken });
    assert.equal((await banks()).data.banks.find(b => b.key === "bank_bni").supported, false);
    assert.equal((await getParams()).data.bni_activation_available, true);
    assert.equal((await api("/api/calc/preview", { token: marketingToken, body: quote })).data.error_code, "MISSING_BNI_CONFIG");
    const beforeCalc = await api("/api/calc/preview", { token: marketingToken, body: baselineQuote });
    assert.equal(beforeCalc.status, 200);
    const beforeActivation = copyProfile();

    assert.equal((await api(activatePath, { body: { confirm: true } })).status, 401);
    for (const token of [opsToken, marketingToken, scopedSuperToken]) {
      assert.equal((await api(activatePath, { token, body: { confirm: true } })).status, 403);
    }
    assert.equal((await api(activatePath, { token: superToken, body: {} })).status, 400);
    assert.deepEqual(copyProfile(), beforeActivation);

    const response = await api(activatePath, { token: superToken, body: { confirm: true } });
    assert.equal(response.status, 200);
    assert.equal(response.data.mode, "activated");
    assert.equal(response.data.partner.maxInstallmentRatio, 85);
    assert.equal(response.data.partner.maxPlafondAbsolute, 500000000);
    assert.equal((await banks()).data.banks.find(b => b.key === "bank_bni").supported, true);
    assert.equal((await getParams()).data.bni_activation_available, false);
    const scopedParams = await api("/api/calc/params", { token: scopedSuperToken });
    assert.equal(Object.hasOwn(scopedParams.data.partners, "bank_bni"), false);
    const estimate = await api("/api/calc/preview", { token: marketingToken, body: quote });
    assert.equal(estimate.status, 200);
    assert.equal(estimate.data.bni_details.dbr_pct, 85);
    assert.equal(estimate.data.net_disbursement, 60659406);
    assert.deepEqual(await api("/api/calc/preview", { token: marketingToken, body: baselineQuote }), beforeCalc);

    const afterActivation = copyProfile();
    assert.deepEqual(afterActivation.files, beforeActivation.files);
    const before = JSON.parse(beforeActivation.row.payload);
    const after = JSON.parse(afterActivation.row.payload);
    const { fleksi, ...legacy } = after.partner_parameters.bank_bni;
    assert.deepEqual(legacy, before.partner_parameters.bank_bni);
    assert.equal(fleksi.engine, "bni_fleksi");
    assert.equal(fleksi.active, true);
    const snapshot = after.parameter_migration_snapshots.pop();
    assert.equal(snapshot.partner_key, "bank_bni");
    assert.deepEqual(snapshot.before_snapshot, legacy);
    assert.equal(after.audit_logs.shift().action, "activate_bni_fleksi");
    after.partner_parameters.bank_bni = legacy;
    assert.deepEqual(after, before, "Hanya konfigurasi BNI, snapshot dan audit aktivasi yang berubah");

    assert.equal((await api(activatePath, { token: superToken, body: { confirm: true } })).data.mode, "already_active");
    assert.deepEqual(copyProfile(), afterActivation);
    await running.stop();
    running = await startFixture(fixture, "production");
    assert.deepEqual(copyProfile(), afterActivation, "Restart production mempertahankan state hasil aktivasi");
    const reopenedToken = await login("marketing@layananpensiunan.id");
    assert.deepEqual(await api("/api/calc/preview", { token: reopenedToken, body: quote }), estimate);

    const proposal = await api("/api/calc/params/bank_bni", {
      method: "PUT", token: opsToken, body: { updates: { maxInstallmentRatio: 82.5 } }
    });
    assert.equal(proposal.data.mode, "proposed");
    assert.equal((await getParams()).data.partners.bank_bni.maxInstallmentRatio, 85);
    const decisionPath = `/api/calc/params/proposals/${proposal.data.proposal.id}/decide`;
    assert.equal((await api(decisionPath, { token: scopedSuperToken, body: { decision: "APPROVE" } })).status, 403);
    const approved = await api(decisionPath, { token: superToken, body: { decision: "APPROVE" } });
    assert.equal(approved.status, 200);
    assert.equal(approved.data.partners.bank_bni.maxInstallmentRatio, 82.5);
    assert.equal(approved.data.partners.bank_bni.revision, 2);

    const reset = await api("/api/calc/params/reset", { token: superToken, body: {} });
    assert.equal(reset.status, 200);
    assert.deepEqual(reset.data.partners.bank_bni, approved.data.partners.bank_bni);
  } finally {
    if (running) await running.stop();
    fixture.cleanup();
  }
});

test("BNI Fleksi: Kasus penerimaan CEO (blokir 7x, tanggal pencairan & TMT Pensiun Pra Purna), pergeseran TMT, count 10 vs 7, validasi tanggal, dan PDF snapshot beraksen oranye", { timeout: 60000 }, async () => {
  const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);
  const ceoInput = {
    bank_key: "bank_bni",
    name: "DEBITUR SINTETIS UJI CEO",
    birth_date: "1969-01-15",
    process_date: "2026-11-19",
    bni_disbursement_date: "2026-12-02",
    bni_tmt_pensiun_date: "2027-07-01",
    bni_product_code: "4",
    bni_insurance_scheme: "MENURUN",
    salary: 3759100,
    bni_dbr_pct: 90,
    plafond: 100000000,
    tenor: 50,
    take_over: 0,
    blokir_angsuran_count: 3,
    blokir_tabungan_count: 1,
    blokir_prapensiun_count: 7
  };

  // 1. Verifikasi unit _exact & pembulatan untuk kasus uji CEO
  const maxForTenor = calculateMax({ ...ceoInput, plafond: undefined }, params);
  assert.equal(maxForTenor.status, "AVAILABLE");
  assert.equal(maxForTenor.eval_tenor, 50);
  assert.equal(maxForTenor.max_plafond, 136534588);
  assert.equal(maxForTenor.bni_disbursement_date, "2026-12-02");
  assert.equal(maxForTenor.bni_tmt_pensiun_date, "2027-07-01");

  const maxInitial = calculateMax({ ...ceoInput, plafond: undefined, tenor: undefined }, params);
  assert.equal(maxInitial.status, "AVAILABLE");
  assert.equal(maxInitial.eval_tenor, maxInitial.max_tenor);
  assert.ok(maxInitial.max_tenor >= 50);

  const ceoRes = calculatePreview(ceoInput, params);
  assert.equal(ceoRes.status, "AVAILABLE");
  assert.equal(ceoRes.overall_ok, true);
  assert.equal(ceoRes.bank_rate, 10.5);
  assert.equal(Number(ceoRes.bni_details.monthly_installment_exact.toFixed(2)), 2477899.58);
  assert.equal(ceoRes.bni_details.max_plafond, 136534588);
  assert.equal(ceoRes.bni_details.gross_ajk_premium_exact, 5464000);
  assert.equal(ceoRes.bni_details.customer_ajk_premium_exact, 0);
  assert.equal(Number(ceoRes.bni_details.blokir_prapensiun_exact.toFixed(2)), 17345297.09);
  assert.equal(ceoRes.bni_details.total_blokir_count, 11);
  assert.equal(Number(ceoRes.bni_details.total_blokir_exact.toFixed(2)), 27256895.43);
  assert.equal(Number(ceoRes.bni_details.terima_bersih_after_to_exact.toFixed(2)), 68093104.57);
  assert.equal(ceoRes.net_disbursement, 68093105);
  assert.equal(ceoRes.bni_details.bni_disbursement_date, "2026-12-02");
  assert.equal(ceoRes.bni_details.bni_tmt_pensiun_date, "2027-07-01");

  // 2. Pergeseran TMT dengan count sama: angka tetap identik, hanya tanggal berubah
  const shiftedTmtRes = calculatePreview(
    { ...ceoInput, bni_disbursement_date: "2026-12-10", bni_tmt_pensiun_date: "2028-02-01" },
    params
  );
  assert.equal(shiftedTmtRes.bni_details.monthly_installment_exact, ceoRes.bni_details.monthly_installment_exact);
  assert.equal(shiftedTmtRes.bni_details.blokir_prapensiun_exact, ceoRes.bni_details.blokir_prapensiun_exact);
  assert.equal(shiftedTmtRes.bni_details.terima_bersih_after_to_exact, ceoRes.bni_details.terima_bersih_after_to_exact);
  assert.equal(shiftedTmtRes.bni_details.bni_disbursement_date, "2026-12-10");
  assert.equal(shiftedTmtRes.bni_details.bni_tmt_pensiun_date, "2028-02-01");

  // 3. Perbandingan blokir_prapensiun_count 10 vs 7 dengan input lain sama
  const count10Res = calculatePreview({ ...ceoInput, blokir_prapensiun_count: 10 }, params);
  const diff3x = ceoRes.bni_details.terima_bersih_after_to_exact - count10Res.bni_details.terima_bersih_after_to_exact;
  assert.ok(Math.abs(diff3x - 3 * ceoRes.bni_details.monthly_installment_exact) < 1e-6);
  assert.equal(count10Res.bank_rate, ceoRes.bank_rate);
  assert.equal(count10Res.plafond, ceoRes.plafond);
  assert.equal(count10Res.tenor, ceoRes.tenor);
  assert.equal(count10Res.bni_details.monthly_installment_exact, ceoRes.bni_details.monthly_installment_exact);
  assert.equal(count10Res.bni_details.gross_ajk_premium_exact, ceoRes.bni_details.gross_ajk_premium_exact);
  assert.equal(count10Res.bni_details.customer_ajk_premium_exact, ceoRes.bni_details.customer_ajk_premium_exact);

  // Blokir terlalu besar membuat terima bersih <= 0 -> overall_ok = false
  const tooManyBlokir = calculatePreview({ ...ceoInput, blokir_prapensiun_count: 40 }, params);
  assert.equal(tooManyBlokir.overall_ok, false);
  assert.equal(tooManyBlokir.validations.find((v) => v.key === "net").ok, false);

  // 4. Validasi dua tanggal baru khusus Kode 4 & parser tanggal ketat
  assert.equal(parseOptionalStrictCalendarDate("2026-02-30").valid, false);
  assert.equal(parseOptionalStrictCalendarDate("2026-12-02extra").valid, false);
  assert.equal(parseOptionalStrictCalendarDate(" 2026-12-02 ").value, "2026-12-02");
  for (const badField of [
    { bni_disbursement_date: "2026-02-30" },
    { bni_tmt_pensiun_date: "2025-02-29" },
    { bni_disbursement_date: "2026-12-02foo" },
    { bni_tmt_pensiun_date: { year: 2027 } }
  ]) {
    const invMax = calculateMax({ ...ceoInput, plafond: undefined, ...badField }, params);
    const invPrev = calculatePreview({ ...ceoInput, ...badField }, params);
    assert.equal(invMax.status, "INVALID");
    assert.equal(invMax.processable, false);
    assert.equal(invPrev.status, "INVALID");
    assert.equal(invPrev.error_code, "BNI_INVALID_INPUT");
  }

  // Kode 1 tidak menggunakan dua tanggal Pra Purna
  const regulerRes = calculatePreview({
    ...ceoInput,
    bni_product_code: "1",
    bni_disbursement_date: "2026-12-02",
    bni_tmt_pensiun_date: "2027-07-01",
    blokir_prapensiun_count: 0
  }, params);
  assert.equal(regulerRes.bni_details.bni_disbursement_date, null);
  assert.equal(regulerRes.bni_details.bni_tmt_pensiun_date, null);

  // 5. PDF BNI: aksen oranye, snapshot sim.result, tanggal, blokir terpisah, AJK, terima bersih & kompatibilitas simulasi lama
  const bniPdf = generateSimulationPdfBuffer({
    sim_no: "SIM-CEO-0001",
    created_by_name: "Petugas Sintetis",
    input: { ...ceoInput, plafond: 999999999, bni_tmt_pensiun_date: "2099-01-01" },
    result: ceoRes
  }).toString("utf8");
  assert.ok(bniPdf.startsWith("%PDF-1.4"));
  assert.ok(bniPdf.includes("0.949 0.541 0.098"), "PDF BNI harus memakai aksen oranye BNI");
  assert.match(bniPdf, /02 Desember 2026/);
  assert.match(bniPdf, /01 Juli 2027/);
  assert.ok(!bniPdf.includes("01 Januari 2099"), "PDF harus membaca snapshot sim.result, bukan sim.input");
  assert.match(bniPdf, /Kredit BFP Skema Menurun/);
  assert.match(bniPdf, /Blokir Angsuran \\\(3x\\\)/);
  assert.match(bniPdf, /Blokir Tabungan Wajib \\\(1x\\\)/);
  assert.match(bniPdf, /Blokir Prapensiun \\\(7x\\\)/);
  assert.match(bniPdf, /Rp 17\.345\.297,09/);
  assert.match(bniPdf, /Rp 27\.256\.895,43/);
  assert.match(bniPdf, /Rp 68\.093\.104,57/);

  // Simulasi lama tanpa field bni_disbursement_date & bni_tmt_pensiun_date tetap valid
  const legacyResult = structuredClone(ceoRes);
  delete legacyResult.bni_details.bni_disbursement_date;
  delete legacyResult.bni_details.bni_tmt_pensiun_date;
  const legacyPdf = generateSimulationPdfBuffer({
    sim_no: "SIM-LEGACY-0001",
    created_by_name: "Petugas Sintetis",
    result: legacyResult
  }).toString("utf8");
  assert.ok(legacyPdf.startsWith("%PDF-1.4"));
  assert.match(legacyPdf, /Belum diisi \\\(rencana\\\)/);

  // Desain PDF bank lain (Capital) tetap dipertahankan tanpa aksen oranye BNI
  const capRes = calculatePreview({
    bank_key: "bank_capital",
    name: "SYNTHETIC CAPITAL",
    birth_date: "1968-05-10",
    process_date: "2026-11-19",
    capital_product: "pensiun",
    salary: 6000000,
    plafond: 100000000,
    tenor: 60
  }, params);
  const capPdf = generateSimulationPdfBuffer({
    sim_no: "SIM-CAP-0001",
    created_by_name: "Petugas Sintetis",
    result: capRes
  }).toString("utf8");
  assert.ok(capPdf.startsWith("%PDF-1.4"));
  assert.equal(capPdf.includes("0.949 0.541 0.098"), false);

  // 6. Integrasi HTTP: normalisasi tanggal saat simpan, penolakan tanggal mustahil, dan unduh PDF BNI
  const fixture = disposableBackend();
  let running;
  try {
    const prep = runFixture(fixture, `import { getStore, saveStore, db } from './src/db/database.js';
import { hashPassword } from './src/security/passwords.js';
const state = getStore();
const hash = await hashPassword(${JSON.stringify(PASSWORD)});
for (const u of state.users) { u.password_hash = hash; u.must_change_password = false; }
saveStore();
db.close();`, "development");
    assert.equal(prep.status, 0, prep.stderr);
    running = await startFixture(fixture, "production");

    const loginRes = await fetch(`${running.base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "marketing@layananpensiunan.id", password: PASSWORD })
    });
    assert.equal(loginRes.status, 200);
    const { access_token: token } = await loginRes.json();

    const saveBadDate = await fetch(`${running.base}/api/simulations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...ceoInput, bni_tmt_pensiun_date: "2027-02-30" })
    });
    assert.equal(saveBadDate.status, 400);
    assert.equal((await saveBadDate.json()).error_code, "BNI_INVALID_INPUT");

    const saveNormalized = await fetch(`${running.base}/api/simulations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...ceoInput,
        bni_disbursement_date: " 2026-12-02 ",
        bni_tmt_pensiun_date: " 2027-07-01 "
      })
    });
    assert.equal(saveNormalized.status, 200);
    const savedSim = await saveNormalized.json();
    assert.equal(savedSim.input.bni_disbursement_date, "2026-12-02");
    assert.equal(savedSim.input.bni_tmt_pensiun_date, "2027-07-01");
    assert.equal(savedSim.result.bni_details.bni_disbursement_date, "2026-12-02");
    assert.equal(savedSim.result.bni_details.bni_tmt_pensiun_date, "2027-07-01");
    assert.equal(savedSim.result.bni_details.total_blokir_count, 11);

    const dlPdf = await fetch(`${running.base}/api/simulations/${savedSim.id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(dlPdf.status, 200);
    const dlPdfText = await dlPdf.text();
    assert.match(dlPdfText, /02 Desember 2026/);
    assert.match(dlPdfText, /01 Juli 2027/);
    assert.match(dlPdfText, /Rp 68\.093\.104,57/);
  } finally {
    if (running) await running.stop();
    fixture.cleanup();
  }
});
