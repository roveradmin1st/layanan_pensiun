// ============================================================================
// BSI PRODUCT ISOLATION, CALENDAR MATURITY AGE & SCENARIO CONSISTENCY TESTS
// Implements Acceptance Matrix T01 - T22 & Regression Cases from command.md
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PARTNER_PARAMETERS } from "../src/config/default-parameters.js";
import {
  normalizeBsiProductInput,
  resolveBsiProductConfig,
  validateAndApplyBsiProductUpdate
} from "../src/config/bsi-product-config.js";
import { ensureStoreUpgrades } from "../src/db/database.js";
import {
  addMonthsClamped,
  parseIsoDate,
  formatIsoDate,
  calculateMax,
  calculatePreview
} from "../src/engines/calc-engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cloneParams() {
  return JSON.parse(JSON.stringify(DEFAULT_PARTNER_PARAMETERS));
}

function getValidationOk(result, key) {
  const item = (result?.validations || []).find((v) => v.key === key);
  return item ? Boolean(item.ok) : undefined;
}

// ============================================================================
// 12.1 PRODUCT ISOLATION (T01 - T05)
// ============================================================================

test("T01: Editing PP3 parameters modifies only PP3; PP10 and PENSIUN remain unchanged", () => {
  const params = cloneParams();
  const pp10Before = JSON.stringify(params.bsi_prapen.products.PP10);
  const pensiunBefore = JSON.stringify(params.bsi_prapen.products.PENSIUN);

  const res = validateAndApplyBsiProductUpdate(params.bsi_prapen.products.PP3, "PP3", {
    loan: { maxTenorMonths: 216, maxPlafondAbsolute: 600000000, maxMaturityAgeMonths: 888 },
    activePhase: { dbrActivePayroll: 65 }
  });
  assert.equal(res.ok, true);
  params.bsi_prapen.products.PP3 = res.updatedProduct;

  assert.equal(params.bsi_prapen.products.PP3.loan.maxTenorMonths, 216);
  assert.equal(params.bsi_prapen.products.PP3.loan.maxPlafondAbsolute, 600000000);
  assert.equal(params.bsi_prapen.products.PP3.loan.maxMaturityAgeMonths, 888);
  assert.equal(params.bsi_prapen.products.PP3.activePhase.dbrActivePayroll, 65);
  assert.equal(params.bsi_prapen.products.PP3.revision, 2);

  assert.equal(JSON.stringify(params.bsi_prapen.products.PP10), pp10Before);
  assert.equal(JSON.stringify(params.bsi_prapen.products.PENSIUN), pensiunBefore);
});

test("T02: Editing PP10 parameters modifies only PP10; PP3 and PENSIUN remain unchanged", () => {
  const params = cloneParams();
  const pp3Before = JSON.stringify(params.bsi_prapen.products.PP3);
  const pensiunBefore = JSON.stringify(params.bsi_prapen.products.PENSIUN);

  const res = validateAndApplyBsiProductUpdate(params.bsi_prapen.products.PP10, "PP10", {
    loan: { maxPlafondAbsolute: 300000000 },
    retiredPhase: { maxInstallmentRatioPercent: 70 }
  });
  assert.equal(res.ok, true);
  params.bsi_prapen.products.PP10 = res.updatedProduct;

  assert.equal(params.bsi_prapen.products.PP10.loan.maxPlafondAbsolute, 300000000);
  assert.equal(params.bsi_prapen.products.PP10.retiredPhase.maxInstallmentRatioPercent, 70);
  assert.equal(params.bsi_prapen.products.PP10.revision, 2);

  assert.equal(JSON.stringify(params.bsi_prapen.products.PP3), pp3Before);
  assert.equal(JSON.stringify(params.bsi_prapen.products.PENSIUN), pensiunBefore);
});

test("T03: Editing PENSIUN parameters modifies only PENSIUN; PP3 and PP10 remain unchanged", () => {
  const params = cloneParams();
  const pp3Before = JSON.stringify(params.bsi_prapen.products.PP3);
  const pp10Before = JSON.stringify(params.bsi_prapen.products.PP10);

  const res = validateAndApplyBsiProductUpdate(params.bsi_prapen.products.PENSIUN, "PENSIUN", {
    loan: { maxPlafondAbsolute: 250000000, maxTenorMonths: 144 },
    retiredPhase: { defaultBaseRateAnnual: 11.25 }
  });
  assert.equal(res.ok, true);
  params.bsi_prapen.products.PENSIUN = res.updatedProduct;

  assert.equal(params.bsi_prapen.products.PENSIUN.loan.maxPlafondAbsolute, 250000000);
  assert.equal(params.bsi_prapen.products.PENSIUN.loan.maxTenorMonths, 144);
  assert.equal(params.bsi_prapen.products.PENSIUN.retiredPhase.defaultBaseRateAnnual, 11.25);

  assert.equal(JSON.stringify(params.bsi_prapen.products.PP3), pp3Before);
  assert.equal(JSON.stringify(params.bsi_prapen.products.PP10), pp10Before);
});

test("T04: Unknown bsi_sub_product ('PP99') is rejected without fallback to PP10", () => {
  const params = cloneParams();
  const norm = normalizeBsiProductInput("PP99");
  assert.equal(norm.valid, false);

  const resolved = resolveBsiProductConfig(params, norm);
  assert.equal(resolved.ok, false);

  const prev = calculatePreview(
    {
      bank_key: "bsi_prapen",
      bsi_sub_product: "PP99",
      birth_date: "1972-12-01",
      process_date: "2026-11-01",
      gaji_pokok: 8000000,
      pension_salary: 4500000,
      plafond: 150000000,
      tenor: 120
    },
    params
  );
  assert.equal(prev.overall_ok, false);
  assert.equal(prev.processable, false);
  assert.equal(prev.plafond, 0);
});

test("T05: Missing product configuration in partner_parameters.bsi_prapen.products is rejected without cross-product fallback", () => {
  const params = cloneParams();
  delete params.bsi_prapen.products.PP3;

  const resolved = resolveBsiProductConfig(params, "PP3");
  assert.equal(resolved.ok, false);

  const maxRes = calculateMax(
    {
      bank_key: "bsi_prapen",
      bsi_sub_product: "PP3",
      birth_date: "1969-12-20",
      process_date: "2026-11-07",
      gaji_pokok: 6000000,
      pension_salary: 4000000,
      tenor: 120
    },
    params
  );
  assert.equal(maxRes.processable, false);
  assert.equal(maxRes.max_plafond, 0);
});

// ============================================================================
// 12.2 MATURITY AGE & CALENDAR RULES (T06 - T10)
// ============================================================================

test("T06: Mandatory regression case (PP3, birth 1967-12-26, start 2027-08-01, tenor 180) fails maturity age", () => {
  const params = cloneParams();
  const input = {
    bank_key: "bsi_prapen",
    name: "NASABAH REGRESI USIA LUNAS",
    birth_date: "1967-12-26",
    process_date: "2027-06-01",
    bsi_proyeksi_cair: "2027-06-01",
    bsi_start_angsuran: "2027-08-01",
    bsi_sub_product: "PP3",
    bsi_status_gaji: "Payroll",
    bup_age: 60,
    tmt_pensiun_year: 2027,
    gaji_pokok: 8000000,
    uang_makan: 800000,
    pension_salary: 4500000,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.5,
    bsi_skema: "Atribusi",
    bsi_insurance_buffer_months: 0,
    tenor: 180,
    plafond: 150000000
  };

  const prev = calculatePreview(input, params);
  assert.equal(prev.bsi_details.selesai_angsuran, "2042-07-01");
  assert.equal(prev.bsi_details.end_age_limit_date, "2042-06-26");
  assert.equal(getValidationOk(prev, "end_age"), false, "end_age must be false because 2042-07-01 > 2042-06-26");
  assert.equal(prev.overall_ok, false, "overall_ok must be false when end_age is false");
});

test("T07: Same customer as T06 with tenor 178 months passes maturity age (2042-05-01 <= 2042-06-26)", () => {
  const params = cloneParams();
  const input = {
    bank_key: "bsi_prapen",
    name: "NASABAH REGRESI USIA LUNAS 178",
    birth_date: "1967-12-26",
    process_date: "2027-06-01",
    bsi_proyeksi_cair: "2027-06-01",
    bsi_start_angsuran: "2027-08-01",
    bsi_sub_product: "PP3",
    bsi_status_gaji: "Payroll",
    bup_age: 60,
    tmt_pensiun_year: 2027,
    gaji_pokok: 8000000,
    uang_makan: 800000,
    pension_salary: 4500000,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.5,
    bsi_skema: "Atribusi",
    bsi_insurance_buffer_months: 0,
    tenor: 178,
    plafond: 150000000
  };

  const prev = calculatePreview(input, params);
  assert.equal(prev.bsi_details.selesai_angsuran, "2042-05-01");
  assert.equal(prev.bsi_details.end_age_limit_date, "2042-06-26");
  assert.equal(getValidationOk(prev, "end_age"), true);
  assert.equal(prev.overall_ok, true);
});

test("T08: PP3 (894 months / 74y 6m) allows 2 months longer max_tenor than PP10 (892 months / 74y 4m) for the same customer", () => {
  const params = cloneParams();
  const baseInput = {
    bank_key: "bsi_prapen",
    birth_date: "1967-12-26",
    process_date: "2027-06-01",
    bsi_proyeksi_cair: "2027-06-01",
    bsi_start_angsuran: "2027-08-01",
    bsi_status_gaji: "Payroll",
    bup_age: 60,
    tmt_pensiun_year: 2027,
    gaji_pokok: 8000000,
    pension_salary: 4500000,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.5,
    bsi_skema: "Atribusi",
    bsi_insurance_buffer_months: 0
  };

  const maxPp3 = calculateMax({ ...baseInput, bsi_sub_product: "PP3" }, params);
  const maxPp10 = calculateMax({ ...baseInput, bsi_sub_product: "PP10" }, params);

  assert.equal(maxPp3.max_tenor, 179);
  assert.equal(maxPp10.max_tenor, 177);
  assert.equal(maxPp3.max_tenor - maxPp10.max_tenor, 2);
});

test("T09: Leap-year birth date (1968-02-29) clamps cleanly to end of month without overflowing into March", () => {
  const dob = parseIsoDate("1968-02-29");
  assert.equal(formatIsoDate(addMonthsClamped(dob, 892)), "2042-06-29");
  assert.equal(formatIsoDate(addMonthsClamped(dob, 888)), "2042-02-28");
});

test("T10: End-of-month installment start date (2027-01-31) clamps cleanly to target month end", () => {
  const start = parseIsoDate("2027-01-31");
  assert.equal(formatIsoDate(addMonthsClamped(start, 1)), "2027-02-28");
  assert.equal(formatIsoDate(addMonthsClamped(start, 13)), "2028-02-29");
  assert.equal(formatIsoDate(addMonthsClamped(start, 3)), "2027-04-30");
});

// ============================================================================
// 12.3 RECOMMENDED MAX PRINCIPAL CONSISTENCY (T11 - T14)
// ============================================================================

test("T11 & T12: Recommended max_plafond passes evaluateBsiScenario (overall_ok = true), while max_plafond + 1,000,000 fails", () => {
  const params = cloneParams();
  const input = {
    bank_key: "bsi_prapen",
    birth_date: "1972-12-01",
    process_date: "2026-11-01",
    bsi_proyeksi_cair: "2026-11-01",
    bsi_start_angsuran: "2026-12-01",
    bsi_sub_product: "PP10",
    bsi_status_gaji: "Payroll",
    bup_age: 60,
    tmt_pensiun_year: 2032,
    gaji_pokok: 6500000,
    uang_makan: 700000,
    pension_salary: 3800000,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.5,
    bsi_skema: "Atribusi",
    bsi_insurance_buffer_months: 0,
    tenor: 180
  };

  const maxRes = calculateMax(input, params);
  assert.equal(maxRes.processable, true);
  assert.ok(maxRes.max_plafond > 0 && maxRes.max_plafond < 800000000);

  // T11: Evaluating at max_plafond must pass
  const atMax = calculatePreview({ ...input, plafond: maxRes.max_plafond }, params);
  assert.equal(atMax.overall_ok, true);

  // T12: Evaluating at max_plafond + 1,000,000 must fail
  const aboveMax = calculatePreview({ ...input, plafond: maxRes.max_plafond + 1000000 }, params);
  assert.equal(aboveMax.overall_ok, false);
});

test("T13: Changing manual plafond input does not alter recommended max_plafond", () => {
  const params = cloneParams();
  const baseInput = {
    bank_key: "bsi_prapen",
    birth_date: "1972-12-01",
    process_date: "2026-11-01",
    bsi_proyeksi_cair: "2026-11-01",
    bsi_start_angsuran: "2026-12-01",
    bsi_sub_product: "PP10",
    bsi_status_gaji: "Payroll",
    bup_age: 60,
    tmt_pensiun_year: 2032,
    gaji_pokok: 8000000,
    pension_salary: 4500000,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.5,
    bsi_skema: "Atribusi",
    bsi_insurance_buffer_months: 0,
    tenor: 180
  };

  const maxWithEmpty = calculateMax({ ...baseInput, plafond: "" }, params);
  const maxWithLow = calculateMax({ ...baseInput, plafond: 50000000 }, params);
  const maxWithHigh = calculateMax({ ...baseInput, plafond: 750000000 }, params);

  assert.equal(maxWithEmpty.max_plafond, maxWithLow.max_plafond);
  assert.equal(maxWithEmpty.max_plafond, maxWithHigh.max_plafond);
});

test("T14: Section 13 validation case (DSR 70% & maxPlafondAbsolute Rp300M) applies to target product without affecting sibling product", () => {
  const params = cloneParams();
  // Sesuai fixture Bagian 13 command.md:
  const upd = validateAndApplyBsiProductUpdate(params.bsi_prapen.products.PP3, "PP3", {
    loan: { maxPlafondAbsolute: 300000000 },
    retiredPhase: { maxInstallmentRatioPercent: 70 }
  });
  assert.equal(upd.ok, true);
  params.bsi_prapen.products.PP3 = upd.updatedProduct;

  const section13Input = {
    bank_key: "bsi_prapen",
    bsi_sub_product: "PP3",
    bsi_status_gaji: "Payroll",
    birth_date: "1972-12-01",
    process_date: "2026-11-01",
    bsi_proyeksi_cair: "2026-11-01",
    bsi_start_angsuran: "2026-12-01",
    bup_age: 55,
    gaji_pokok: 20000000,
    pension_salary: 10000000,
    tenor: 180,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.5,
    bsi_insurance_buffer_months: 0,
    bsi_skema: "Atribusi",
    bsi_akad: "Murabahah"
  };

  const maxPp3 = calculateMax(section13Input, params);
  assert.equal(maxPp3.max_plafond, 300000000, "PP3 max_plafond must be capped at Rp300,000,000");

  const prevPp3 = calculatePreview({ ...section13Input, plafond: 300000000 }, params);
  assert.equal(prevPp3.overall_ok, true);
  assert.equal(prevPp3.bsi_details.dsr_pension_rate, 70);
  assert.equal(prevPp3.bsi_details.max_installment_pension, 7000000); // 70% of 10,000,000

  // Requesting Rp350M on PP3 must fail plafond validation
  const prevPp3Over = calculatePreview({ ...section13Input, plafond: 350000000 }, params);
  assert.equal(getValidationOk(prevPp3Over, "plafond"), false);
  assert.equal(prevPp3Over.overall_ok, false);

  // Meanwhile PP10 remains at DSR 90% and maxPlafondAbsolute Rp800M
  assert.equal(params.bsi_prapen.products.PP10.retiredPhase.maxInstallmentRatioPercent, 90);
  assert.equal(params.bsi_prapen.products.PP10.loan.maxPlafondAbsolute, 800000000);
});

// ============================================================================
// 12.4 INSURANCE BUFFER RULES (T15 - T18)
// ============================================================================

test("T15 & T16: Insurance buffer 0 keeps insuranceMonths === tenor; buffer 6 sets insuranceMonths === tenor + 6", () => {
  const params = cloneParams();
  const baseInput = {
    bank_key: "bsi_prapen",
    birth_date: "1976-10-24",
    process_date: "2026-11-07",
    bsi_proyeksi_cair: "2026-11-07",
    bsi_start_angsuran: "2026-12-01",
    bsi_sub_product: "PP10",
    bsi_status_gaji: "Payroll",
    bup_age: 60,
    tmt_pensiun_year: 2036,
    gaji_pokok: 4729200,
    uang_makan: 770000,
    tunjangan_lain_1: 503000,
    pension_salary: 3546900,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.5,
    bsi_skema: "Atribusi",
    tenor: 180,
    plafond: 263000000
  };

  // T15: buffer = 0
  const prev0 = calculatePreview({ ...baseInput, bsi_insurance_buffer_months: 0 }, params);
  assert.equal(prev0.bsi_details.simas.insurance_months, 180);
  assert.equal(prev0.bsi_details.simas.buffer_months, 0);

  // T16: buffer = 6
  const prev6 = calculatePreview({ ...baseInput, bsi_insurance_buffer_months: 6 }, params);
  assert.equal(prev6.bsi_details.simas.insurance_months, 186);
  assert.equal(prev6.bsi_details.simas.buffer_months, 6);
});

test("T17 & T18: PP3 tenor 240 with buffer 6 (246 months) fails Simas without truncation; buffer 0 (240 months) passes", () => {
  const params = cloneParams();
  const basePp3 = {
    bank_key: "bsi_prapen",
    birth_date: "1972-06-15",
    process_date: "2026-11-01",
    bsi_proyeksi_cair: "2026-11-01",
    bsi_start_angsuran: "2026-12-01",
    bsi_sub_product: "PP3",
    bsi_status_gaji: "Payroll",
    bup_age: 58,
    tmt_pensiun_year: 2029,
    gaji_pokok: 9000000,
    pension_salary: 5000000,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.5,
    bsi_skema: "Atribusi",
    tenor: 240,
    plafond: 200000000
  };

  // T17: 240 + 6 = 246 months -> must NOT be truncated to 240, must fail Simas
  const prev246 = calculatePreview({ ...basePp3, bsi_insurance_buffer_months: 6 }, params);
  assert.equal(prev246.bsi_details.simas.insurance_months, 246);
  assert.equal(getValidationOk(prev246, "simas"), false);
  assert.equal(prev246.overall_ok, false);

  // T18: 240 + 0 = 240 months -> valid for PP3
  const prev240 = calculatePreview({ ...basePp3, bsi_insurance_buffer_months: 0 }, params);
  assert.equal(prev240.bsi_details.simas.insurance_months, 240);
  assert.equal(getValidationOk(prev240, "simas"), true);
  assert.equal(getValidationOk(prev240, "end_age"), true);
  assert.equal(prev240.overall_ok, true);
});

// ============================================================================
// 12.5 MIGRATION, SNAPSHOTS, DUAL CONTROL & OPTIMISTIC CONCURRENCY (T19 - T22)
// ============================================================================

test("T19 & T20: ensureStoreUpgrades migrates legacy bsi_prapen idempotently, saves snapshot, and preserves historical simulations", () => {
  const legacyStore = {
    users: [{ id: "u-sm-1", role: "sales_manager" }],
    partner_parameters: {
      bsi_prapen: {
        name: "BSI Mitraguna Pra Pensiun (PP10 / PP3)",
        code: "BSI-PRAPEN-SIMAS-2026",
        maxTenorMonths: 180,
        maxEndAgeYears: 74,
        maxEndAgeMonths: 4,
        maxPlafondAbsolute: 750000000,
        dbrActivePayroll: 68,
        dsrPensionMax: 85
      }
    },
    simulations: [
      {
        id: "sim-legacy-001",
        bank_key: "bsi_prapen",
        plafond: 200000000,
        tenor: 120,
        created_at: "2026-10-01T00:00:00.000Z"
      }
    ]
  };

  const changed1 = ensureStoreUpgrades(legacyStore);
  assert.equal(changed1, true);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.schemaVersion, 2);
  assert.ok(legacyStore.partner_parameters.bsi_prapen.products.PP3);
  assert.ok(legacyStore.partner_parameters.bsi_prapen.products.PP10);
  assert.ok(legacyStore.partner_parameters.bsi_prapen.products.PENSIUN);

  // PP3 gets canonical 240 months & 894 months, plus custom dbrActivePayroll/dsrMaxPercent/maxPlafondAbsolute
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP3.loan.maxTenorMonths, 240);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP3.loan.maxMaturityAgeMonths, 894);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP3.loan.maxPlafondAbsolute, 750000000);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP3.activePhase.dbrActivePayroll, 68);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP3.retiredPhase.maxInstallmentRatioPercent, 85);

  // PP10 keeps 180 months & 892 months, plus custom values
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP10.loan.maxTenorMonths, 180);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP10.loan.maxMaturityAgeMonths, 892);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP10.loan.maxPlafondAbsolute, 750000000);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP10.activePhase.dbrActivePayroll, 68);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.products.PP10.retiredPhase.maxInstallmentRatioPercent, 85);

  // Competing root financial fields are removed
  assert.equal(legacyStore.partner_parameters.bsi_prapen.maxTenorMonths, undefined);
  assert.equal(legacyStore.partner_parameters.bsi_prapen.dbrActivePayroll, undefined);

  // Pre-migration snapshot is recorded
  assert.equal(Array.isArray(legacyStore.parameter_migration_snapshots), true);
  assert.equal(legacyStore.parameter_migration_snapshots.length, 1);
  assert.equal(legacyStore.parameter_migration_snapshots[0].before_snapshot.maxPlafondAbsolute, 750000000);

  // T20: Historical simulation is untouched
  assert.equal(legacyStore.simulations.length, 1);
  assert.equal(legacyStore.simulations[0].id, "sim-legacy-001");
  assert.equal(legacyStore.simulations[0].plafond, 200000000);

  // Idempotency on second invocation
  const changed2 = ensureStoreUpgrades(legacyStore);
  assert.equal(changed2, false);
  assert.equal(legacyStore.parameter_migration_snapshots.length, 1);
});

test("T21 & T22: Product-scoped API endpoints enforce Dual Control per product and return 409 on stale expectedPolicyVersion", async () => {
  const storePath = path.join(__dirname, "../data/store.json");
  const originalStoreBytes = fs.existsSync(storePath) ? fs.readFileSync(storePath) : null;
  const testPort = 4097;
  const baseUrl = `http://127.0.0.1:${testPort}`;

  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(testPort) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Server startup timed out")), 8000);
      child.stdout.on("data", (chunk) => {
        if (String(chunk).toLowerCase().includes("running on")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited early with code ${code}`));
      });
    });

    const apiCall = async (method, endpoint, { token, body } = {}) => {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      const data = await res.json();
      return { status: res.status, data };
    };

    const superLogin = await apiCall("POST", "/api/auth/login", {
      body: { email: "superadmin@layananpensiunan.id", password: "Password123!" }
    });
    assert.equal(superLogin.status, 200);
    const superToken = superLogin.data.access_token;

    const opsLogin = await apiCall("POST", "/api/auth/login", {
      body: { email: "adminops@layananpensiunan.id", password: "Password123!" }
    });
    assert.equal(opsLogin.status, 200);
    const opsToken = opsLogin.data.access_token;

    // Reset PP10 & PP3 to clean defaults first
    const resetPp10 = await apiCall("POST", "/api/calc/params/bsi_prapen/products/PP10/reset", { token: superToken });
    assert.equal(resetPp10.status, 200);
    const initialVersion = resetPp10.data.product.policyVersion;

    const getPp3Before = await apiCall("GET", "/api/calc/params/bsi_prapen/products/PP3", { token: superToken });
    assert.equal(getPp3Before.status, 200);

    // T21: Admin Ops submits a product-scoped proposal for PP10
    const propRes = await apiCall("PUT", "/api/calc/params/bsi_prapen/products/PP10", {
      token: opsToken,
      body: {
        expectedPolicyVersion: initialVersion,
        reason: "Penyesuaian DSR Pensiun PP10 ke 70%",
        loan: { maxPlafondAbsolute: 300000000 },
        retiredPhase: { maxInstallmentRatioPercent: 70 }
      }
    });
    assert.equal(propRes.status, 202);
    assert.equal(propRes.data.proposal.product_key, "PP10");
    assert.equal(propRes.data.proposal.base_policy_version, initialVersion);

    // Before approval, active PP10 is still at 90% / Rp800M
    const getPp10Pending = await apiCall("GET", "/api/calc/params/bsi_prapen/products/PP10", { token: superToken });
    assert.equal(getPp10Pending.data.product.loan.maxPlafondAbsolute, 800000000);

    // Super Admin approves the proposal
    const approveRes = await apiCall("POST", `/api/calc/params/proposals/${propRes.data.proposal.id}/decide`, {
      token: superToken,
      body: { decision: "APPROVE", review_note: "Disetujui sesuai kebijakan baru PP10" }
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.product.loan.maxPlafondAbsolute, 300000000);
    assert.equal(approveRes.data.product.retiredPhase.maxInstallmentRatioPercent, 70);
    assert.notEqual(approveRes.data.product.policyVersion, initialVersion);

    // Verify PP3 was NOT affected
    const getPp3After = await apiCall("GET", "/api/calc/params/bsi_prapen/products/PP3", { token: superToken });
    assert.equal(getPp3After.data.product.loan.maxPlafondAbsolute, getPp3Before.data.product.loan.maxPlafondAbsolute);
    assert.equal(getPp3After.data.product.policyVersion, getPp3Before.data.product.policyVersion);

    // T22: Stale expectedPolicyVersion returns HTTP 409 Conflict
    const staleRes = await apiCall("PUT", "/api/calc/params/bsi_prapen/products/PP10", {
      token: superToken,
      body: {
        expectedPolicyVersion: initialVersion, // stale!
        loan: { maxPlafondAbsolute: 400000000 }
      }
    });
    assert.equal(staleRes.status, 409);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    if (originalStoreBytes) {
      fs.writeFileSync(storePath, originalStoreBytes);
    }
  }
});
