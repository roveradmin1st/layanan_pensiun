import test from "node:test";
import assert from "node:assert/strict";
import {
  comparePensionScenarios, insuranceTariffPermil, medicalStatus, parseCalendarDate,
  addMonthsClampedUtc, nearestAgeUtc, roundExcel, PensionInputError
} from "../src/engines/bsi-pensiun-preview.js";
import { SIMAS_PENSIUN_PROFILE } from "../src/config/bsi-pensiun-simas-20260629.js";
import {
  calculateMax,
  calculatePreview,
  generateSimulationPdfBuffer,
  generateSimulationSvgBuffer
} from "../src/engines/calc-engine.js";
import { DEFAULT_PARTNER_PARAMETERS } from "../src/config/default-parameters.js";
import { runBsiPp10RegressionTest } from "./baseline-regression.test.mjs";

// Dates aligned intentionally; DOB, money, tenor and tariff match the bank workbook anchor.
// The workbook's literal NOW cache and inconsistent dates are NOT silently used as a new clock.
export const FIXTURE = Object.freeze({
  birth_date: "1966-06-10", process_date: "2026-10-01", insurance_start_date: "2026-10-01",
  first_installment_date: "2026-11-01", pension_salary: 2301400, principal: 166000000,
  tenor_months: 169, base_rate_pct: 10.5, retired_type: "pensiunan", spouse_status: "single",
  ratio_basis: "DBR", ratio_pct: 90, ongoing_installments: 0, settlement_amount: 0, flagging: "TASPEN_CTP"
});
const near = (actual, expected, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const check = (scenario, key) => scenario.checks.find((item) => item.key === key).ok;

test("bank workbook anchor: C20 / H5 / H8 / D26, All Cover with zero penalty", () => {
  const result = comparePensionScenarios(FIXTURE);
  const a = result.scenarios.atribusi_premi;
  assert.equal(result.insurance_tariff_permil, 143.01);
  near(a.premium, 27701210.04912543);
  assert.equal(a.annual_price_pct, 12.09);
  near(a.installment_exact, 2048954.4951412608, 1e-6);
  near(a.net_disbursement, 160142091.00971746);
  assert.equal(a.indicative_max_principal, 167000000);
  assert.equal(a.remaining_pension_salary, 252445.50);
  assert.equal(a.source_coverage_code, 3);
  assert.equal(a.within_template_checks, true);
  assert.equal(result.can_submit, false);
});

test("Reguler is independently recomputed, not copied from the All Cover column", () => {
  const { reguler: r, atribusi_premi: a } = comparePensionScenarios(FIXTURE).scenarios;
  assert.equal(r.annual_price_pct, 10.5);
  near(r.installment_exact, 1884878.1172144585, 1e-6);
  assert.equal(r.premium, 23739660);
  assert.equal(r.net_disbursement, 140500340);
  assert.equal(r.indicative_max_principal, 182000000);
  assert.notEqual(r.installment, a.installment);
  assert.equal(r.upfront_premium, r.premium);
  assert.equal(a.upfront_premium, 0);
  assert.equal(r.blocked_installments, 0);
  near(a.blocked_installments, a.installment_exact * 2);
  assert.notEqual(r.remaining_pension_salary, 2301231); // Old H19=tenor bug.
});

test("insurance workbook personal anchor: nearest 59, 15 years, base UP Rp250m", () => {
  const result = comparePensionScenarios({ ...FIXTURE,
    birth_date: "1967-07-07", process_date: "2026-07-06", insurance_start_date: "2026-07-06",
    first_installment_date: "2026-08-06", tenor_months: 180, principal: 250000000, pension_salary: 10000000
  });
  assert.equal(result.insurance_entry_age_nearest, 59);
  assert.equal(result.insurance_tariff_permil, 142.85);
  near(result.scenarios.atribusi_premi.sum_assured, 291664236.1313656);
  near(result.scenarios.atribusi_premi.premium, 41664236.131365575);
});

test("all 345 annual tariff points exist, unavailable years reject, short terms use source multipliers", () => {
  let points = 0;
  for (let age = 45; age <= 74; age++) {
    for (let year = 1; year <= 15; year++) {
      if (age + year <= 75) {
        assert.ok(insuranceTariffPermil(age, year * 12) > 0);
        assert.equal(insuranceTariffPermil(age, year * 12), SIMAS_PENSIUN_PROFILE.tariffs_permil[age][year - 1]);
        points++;
      } else assert.throws(() => insuranceTariffPermil(age, year * 12), PensionInputError);
    }
  }
  assert.equal(points, 345);
  assert.equal(insuranceTariffPermil(60, 1), 2.47);
  assert.equal(insuranceTariffPermil(60, 8), 10.80);
  assert.equal(insuranceTariffPermil(60, 11), 12.34);
  assert.equal(insuranceTariffPermil(60, 169), 143.01);
  assert.throws(() => insuranceTariffPermil(44, 12), PensionInputError);
  assert.throws(() => insuranceTariffPermil(75, 1), PensionInputError);
  assert.throws(() => insuranceTariffPermil(60, 181), PensionInputError);
  assert.throws(() => insuranceTariffPermil(74, 13), PensionInputError);
});

test("medical boundaries use pension matrix, including mandatory MCU for age 71+", () => {
  for (const [age, up, expected] of [
    [60, 350000000, "NON_MCU"], [61, 300000000, "NON_MCU"], [61, 300000000.99, "NON_MCU"],
    [61, 300000001, "MCU"], [65, 300000001, "MCU"], [66, 100000000, "NON_MCU"],
    [66, 100000001, "MCU"], [70, 100000001, "MCU"], [71, 50000000, "MCU"],
    [74, 1000000, "MCU"], [74, 350000000.01, "UNAVAILABLE"]
  ]) assert.equal(medicalStatus(age, up), expected, `${age}/${up}`);
});

test("gross-UP cap applies to attributed cover and does not silently lower the requested loan", () => {
  const result = comparePensionScenarios({ ...FIXTURE, principal: 350000000, pension_salary: 100000000 });
  assert.equal(check(result.scenarios.reguler, "sum_assured"), true);
  assert.equal(check(result.scenarios.atribusi_premi, "sum_assured"), false);
  assert.equal(result.scenarios.atribusi_premi.principal, 350000000);
  assert.ok(result.scenarios.atribusi_premi.indicative_max_principal < 350000000);
  assert.equal(result.scenarios.atribusi_premi.can_submit, false);
});

test("DBR and DSR follow source definitions; ongoing loans affect residual salary in both", () => {
  const dbr = comparePensionScenarios({ ...FIXTURE, ongoing_installments: 200000, ratio_basis: "DBR" });
  const dsr = comparePensionScenarios({ ...FIXTURE, ongoing_installments: 200000, ratio_basis: "DSR" });
  assert.equal(dsr.installment_capacity - dbr.installment_capacity, 200000);
  assert.equal(dbr.scenarios.reguler.remaining_pension_salary, dsr.scenarios.reguler.remaining_pension_salary);
  assert.ok(dbr.scenarios.reguler.template_ratio_pct > dsr.scenarios.reguler.template_ratio_pct);
  const spouse = comparePensionScenarios({ ...FIXTURE, spouse_status: "with_spouse", ratio_pct: 70 });
  near(spouse.installment_capacity, 2301400 * .98 * .70);
  assert.equal(check(spouse.scenarios.atribusi_premi, "installment_capacity"), false);
});

test("bank minimum age 50/48 remains distinct from insurance nearest age", () => {
  const before = { ...FIXTURE, birth_date: "1976-10-02", tenor_months: 12, principal: 1000000 };
  assert.equal(check(comparePensionScenarios(before).scenarios.reguler, "entry_age"), false);
  assert.equal(check(comparePensionScenarios({ ...before, birth_date: "1976-10-01" }).scenarios.reguler, "entry_age"), true);
  const widow = { ...before, retired_type: "janda", birth_date: "1978-10-02" };
  assert.equal(check(comparePensionScenarios(widow).scenarios.reguler, "entry_age"), false);
  assert.equal(check(comparePensionScenarios({ ...widow, birth_date: "1978-10-01" }).scenarios.reguler, "entry_age"), true);
});

test("calendar rejects rollover, uses EDATE for installments, preserves DATE overflow separately", () => {
  assert.throws(() => parseCalendarDate("2026-02-31"), PensionInputError);
  assert.throws(() => parseCalendarDate("2025-02-29"), PensionInputError);
  const leap = parseCalendarDate("2024-02-29");
  assert.equal(addMonthsClampedUtc(leap, 12).toISOString().slice(0, 10), "2025-02-28");
  const jan = comparePensionScenarios({ ...FIXTURE, process_date: "2026-01-31", insurance_start_date: "2026-01-31",
    first_installment_date: "2026-03-01", tenor_months: 1, principal: 1000000, pension_salary: 10000000 });
  assert.equal(jan.dates.insurance_end, "2026-02-28");
  assert.equal(jan.dates.last_installment, "2026-03-01");
  assert.equal(jan.dates.bank_maturity_source_date, "2026-03-03");
  assert.equal(jan.dates.bank_maturity_source_month_start, "2026-02-01");
  assert.equal(check(jan.scenarios.reguler, "coverage_dates"), false);
  assert.equal(nearestAgeUtc(parseCalendarDate("1966-06-10"), parseCalendarDate("2026-12-09")), 60);
  assert.equal(nearestAgeUtc(parseCalendarDate("1966-06-10"), parseCalendarDate("2026-12-10")), 61);
});

test("rounding at midpoint is away from zero", () => {
  assert.equal(roundExcel(1.005, 2), 1.01);
  assert.equal(roundExcel(-1.005, 2), -1.01);
  assert.equal(roundExcel(0.12085, 4), 0.1209);
});

test("input rejects missing, invalid, negative, zero, unknown mode and unauthorized rule fields", () => {
  for (const [field, value] of [
    ["principal", 0], ["principal", -1], ["principal", 350000001], ["pension_salary", 0],
    ["tenor_months", 0], ["tenor_months", 181], ["tenor_months", 12.5], ["base_rate_pct", 0],
    ["ratio_pct", 95], ["base_rate_pct", Infinity], ["principal", true], ["principal", {}],
    ["principal", ""], ["birth_date", "1966-02-31"], ["birth_date", "2030-01-01"],
    ["first_installment_date", "2026-09-01"], ["ongoing_installments", -5], ["settlement_amount", -5],
    ["flagging", "unknown"], ["retired_type", "duda"], ["spouse_status", "maybe"], ["ratio_basis", "OTHER"]
  ]) assert.throws(() => comparePensionScenarios({ ...FIXTURE, [field]: value }), PensionInputError, field);
  for (const key of ["penalty_amount", "em_pct", "discount_pct", "insurance_profile", "approved", "bank_key", "baseRateOverride"]) {
    assert.throws(() => comparePensionScenarios({ ...FIXTURE, [key]: 0 }), PensionInputError);
  }
  assert.throws(() => comparePensionScenarios([]), PensionInputError);
  assert.throws(() => comparePensionScenarios(null), PensionInputError);
  const incomplete = { ...FIXTURE }; delete incomplete.tenor_months;
  assert.throws(() => comparePensionScenarios(incomplete), PensionInputError);
});

test("cash reconciles in cents, settlement deducted once, negative cash never marked healthy", () => {
  for (const settlement of [0, 1234567.89, 200000000]) {
    const result = comparePensionScenarios({ ...FIXTURE, settlement_amount: settlement });
    for (const s of Object.values(result.scenarios)) {
      const c = (v) => Math.round(v * 100);
      assert.equal(c(s.principal), c(s.net_disbursement) + c(s.admin_fee) + c(s.stamp_fee)
        + c(s.upfront_premium) + c(s.blocked_installments) + c(s.settlement_amount));
      assert.equal(check(s, "net_cash"), s.net_disbursement > 0);
    }
  }
});

test("legacy entry points reject unknown/prototype products instead of calculating AMS2", () => {
  for (const key of ["bsi_pensiun", "nonexistent", "__proto__", "constructor", "lastUpdated", ["ams2"], 0, false, ""]) {
    for (const fn of [calculateMax, calculatePreview]) {
      const result = fn({ bank_key: key, salary: 5000000, birth_date: "1966-06-10" }, DEFAULT_PARTNER_PARAMETERS);
      assert.equal(result.error_code, "UNKNOWN_PRODUCT");
      assert.equal(result.processable, false);
      assert.equal(result.plafond, 0);
    }
  }
  const injected = { ...DEFAULT_PARTNER_PARAMETERS, bsi_pensiun: { ...DEFAULT_PARTNER_PARAMETERS.ams2 } };
  assert.equal(calculatePreview({ bank_key: "bsi_pensiun" }, injected).error_code, "UNKNOWN_PRODUCT");
});

test("existing prapen assertions really execute (explicit function call, not an empty PASS)", () => {
  const result = runBsiPp10RegressionTest();
  assert.ok(result);
});

test("unified calc-engine BSI Pensiun Berkah (bsi_prapen + bsi_sub_product=PENSIUN) matches Blue Sheets 100%", () => {
  const baseBody = {
    bank_key: "bsi_prapen",
    bsi_sub_product: "PENSIUN",
    name: "NASABAH UJI BLUE SHEET",
    birth_date: "1966-06-10",
    process_date: "2026-10-01",
    bsi_proyeksi_cair: "2026-10-01",
    bsi_start_angsuran: "2026-11-01",
    pension_salary: 2301400,
    plafond: 166000000,
    tenor: 169,
    bsi_price_pensiun: 10.5,
    bsi_retired_type: "pensiunan",
    bsi_spouse_status: "single",
    bsi_ratio_basis: "DBR",
    bsi_ratio_pct: 90,
    ongoing_installments: 0,
    pelunasan_lama: 0,
    bsi_flagging: "TASPEN_CTP",
    bsi_akad: "MMQ"
  };

  // 1. Atribusi Premi (C16=3)
  const maxAtrib = calculateMax({ ...baseBody, bsi_skema: "Atribusi" }, DEFAULT_PARTNER_PARAMETERS);
  assert.equal(maxAtrib.processable, true);
  assert.equal(maxAtrib.bsi_sub_product, "PENSIUN");
  assert.equal(maxAtrib.max_plafond, 167000000);
  assert.equal(maxAtrib.max_plafond_reguler, 182000000);
  assert.equal(maxAtrib.max_plafond_atribusi, 167000000);

  const prevAtrib = calculatePreview({ ...baseBody, bsi_skema: "Atribusi" }, DEFAULT_PARTNER_PARAMETERS);
  assert.equal(prevAtrib.overall_ok, true);
  assert.equal(prevAtrib.bsi_details.sub_product, "PENSIUN");
  assert.equal(prevAtrib.bsi_details.simas.tarif_permil, 143.01);
  assert.equal(prevAtrib.bsi_details.price_atrib_pensiun_pct, 12.09);
  near(prevAtrib.bsi_details.pension_installment_exact, 2048954.50, 0.01);
  near(prevAtrib.bsi_details.premi_asuransi_tertanggung_exact, 27701210.05, 0.01);
  near(prevAtrib.bsi_details.blokir_pensiun_exact, 4097908.99, 0.01);
  near(prevAtrib.bsi_details.sisa_pencairan_bersih_exact, 160142091.01, 0.01);
  near(prevAtrib.bsi_details.sisa_gaji_pensiun_exact, 252445.50, 0.01);

  // 2. Reguler (C16=1)
  const prevReg = calculatePreview({ ...baseBody, bsi_skema: "Reguler" }, DEFAULT_PARTNER_PARAMETERS);
  assert.equal(prevReg.overall_ok, true);
  assert.equal(prevReg.bsi_details.is_atribusi, false);
  assert.equal(prevReg.bsi_details.price_atrib_pensiun_pct, 10.5);
  near(prevReg.bsi_details.pension_installment_exact, 1884878.12, 0.01);
  near(prevReg.bsi_details.biaya_asuransi_exact, 23739660.00, 0.01);
  assert.equal(prevReg.bsi_details.blokir_pensiun_exact, 0);
  near(prevReg.bsi_details.sisa_pencairan_bersih_exact, 140500340.00, 0.01);
  near(prevReg.bsi_details.sisa_gaji_pensiun_exact, 416521.88, 0.01);

  // 3. PDF & SVG export buffers match PENSIUN BERKAH (Blue Sheet Rincain keNsb)
  const simMock = { sim_no: "SIM-2026-9999", created_by_name: "AGUNG PAMBUDI", result: prevAtrib };
  const pdfBuf = generateSimulationPdfBuffer(simMock);
  const svgBuf = generateSimulationSvgBuffer(simMock);
  assert.ok(pdfBuf.toString("utf8").includes("PENSIUN BERKAH"));
  assert.ok(pdfBuf.toString("utf8").includes("160.142.091,01"));
  assert.ok(svgBuf.toString("utf8").includes("PENSIUN BERKAH"));
  assert.ok(svgBuf.toString("utf8").includes("160.142.091,01"));
});
