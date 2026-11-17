// ============================================================================
// SKRIP PROBE REPRODUCIBLE — BNI FLEKSI PENSIUN (DATA SINTETIS)
// Memanggil fungsi kalkulator aplikasi aktual (calculateMax & calculatePreview).
// Penggunaan: node backend/tests/bni-audit-probe.mjs
// ============================================================================

import assert from "node:assert/strict";
import { DEFAULT_PARTNER_PARAMETERS } from "../src/config/default-parameters.js";
import { calculateMax, calculatePreview } from "../src/engines/calc-engine.js";

const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);

// BNI-01 (tanggal uji dibekukan pada 2026-11-17, data sintetis)
const bni01Input = {
  bank_key: "bank_bni",
  name: "NASABAH SINTETIS BNI-01",
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

const bni01Max = calculateMax(bni01Input, params);
const bni01Prev = calculatePreview(bni01Input, params);

assert.equal(bni01Max.status, "AVAILABLE");
assert.equal(bni01Max.max_installment_exact, 3383190);
assert.ok(Math.abs(bni01Max.max_plafond_exact - 136534588.44093564) < 1e-3);
assert.equal(bni01Prev.status, "AVAILABLE");
assert.equal(bni01Prev.overall_ok, true);
assert.equal(bni01Prev.bank_rate, 10.5);
assert.ok(Math.abs(bni01Prev.bni_details.monthly_installment_exact - 2477899.584736777) < 1e-4);
assert.equal(bni01Prev.bni_details.bank_fees, 4650000);
assert.equal(bni01Prev.bni_details.gross_ajk_premium, 5464000);
assert.equal(bni01Prev.bni_details.bni_subsidy_premium, 5464000);
assert.equal(bni01Prev.bni_details.customer_ajk_premium, 0);
assert.equal(bni01Prev.bni_details.net_before_blokir, 95350000);
assert.ok(Math.abs(bni01Prev.bni_details.total_blokir_exact - 34690594.18631476) < 1e-3);
assert.ok(Math.abs(bni01Prev.bni_details.terima_bersih_after_to_exact - 60659405.81368524) < 1e-3);
assert.equal(bni01Prev.net_disbursement, 60659406);

// BNI-02 (Plafond 120 Jt, Tenor 120 bln, Bunga 12% via Kode 1 Reguler)
const bni02Prev = calculatePreview({
  bank_key: "bank_bni",
  name: "NASABAH SINTETIS BNI-02",
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
assert.equal(bni02Prev.bank_rate, 12);
assert.ok(Math.abs(bni02Prev.bni_details.monthly_installment_exact - 1721651.380831049) < 1e-5);

// Batas jatuh tempo akhir bulan melewati ulang tahun ke-75
const maturityPast75 = calculatePreview({
  bank_key: "bank_bni",
  name: "PROBE MATURITY EOMONTH",
  birth_date: "1952-11-20",
  process_date: "2026-11-17",
  bni_product_code: "1",
  bni_insurance_scheme: "MENURUN",
  salary: 15000000,
  bni_dbr_pct: 90,
  plafond: 50000000,
  tenor: 12,
  take_over: 0
}, params);
assert.equal(maturityPast75.bni_details.maturity_date, "2027-11-30");
assert.equal(maturityPast75.bni_details.age_75_date, "2027-11-20");
assert.equal(maturityPast75.overall_ok, false);

const maxTenorPast75 = calculateMax({
  bank_key: "bank_bni",
  name: "PROBE MAX TENOR PAST 75",
  birth_date: "1952-11-20",
  process_date: "2026-11-17",
  bni_product_code: "1",
  bni_insurance_scheme: "MENURUN",
  salary: 15000000,
  bni_dbr_pct: 90
}, params);
assert.equal(maxTenorPast75.max_tenor, 11);

// Tenor invalid pada calculateMax
assert.equal(calculateMax({ ...bni01Input, tenor: 241 }, params).processable, false);
assert.equal(calculateMax({ ...bni01Input, tenor: 0 }, params).processable, false);
assert.equal(calculateMax({ ...bni01Input, tenor: 12.5 }, params).processable, false);

// Parameter hilang tanpa fallback diam-diam
const noRates = structuredClone(DEFAULT_PARTNER_PARAMETERS);
delete noRates.bank_bni.interestRateTiers;
const noRatesRes = calculatePreview(bni01Input, noRates);
assert.equal(noRatesRes.status, "INVALID");
assert.equal(noRatesRes.error_code, "MISSING_BNI_CONFIG");

const noAjk = structuredClone(DEFAULT_PARTNER_PARAMETERS);
delete noAjk.bank_bni.ajkMenurunRegRates;
const noAjkRes = calculatePreview(bni01Input, noAjk);
assert.equal(noAjkRes.status, "INVALID");
assert.equal(noAjkRes.error_code, "MISSING_BNI_CONFIG");

// Input cacat / negatif / non-kalender / net negatif
assert.equal(calculatePreview({ ...bni01Input, take_over: -5000000 }, params).status, "INVALID");
assert.equal(calculatePreview({ ...bni01Input, take_over: "abc" }, params).status, "INVALID");
assert.equal(calculatePreview({ ...bni01Input, birth_date: "1969-02-30" }, params).status, "INVALID");
assert.equal(calculatePreview({ ...bni01Input, plafond: bni01Max.max_plafond }, params).overall_ok, true);
assert.equal(calculatePreview({ ...bni01Input, plafond: bni01Max.max_plafond + 1 }, params).overall_ok, false);
assert.equal(calculatePreview({ ...bni01Input, take_over: 70000000 }, params).overall_ok, false);

console.log(JSON.stringify({
  probe: "BNI_AUDIT_PROBE_PASSED",
  bni01: {
    max_installment: bni01Max.max_installment_exact,
    max_plafond_exact: bni01Max.max_plafond_exact,
    rate_pct: bni01Prev.bank_rate,
    installment_exact: bni01Prev.bni_details.monthly_installment_exact,
    bank_fees: bni01Prev.bni_details.bank_fees,
    gross_ajk: bni01Prev.bni_details.gross_ajk_premium,
    bni_subsidy: bni01Prev.bni_details.bni_subsidy_premium,
    customer_ajk: bni01Prev.bni_details.customer_ajk_premium,
    total_blokir_exact: bni01Prev.bni_details.total_blokir_exact,
    net_disbursement_exact: bni01Prev.bni_details.terima_bersih_after_to_exact,
    net_disbursement: bni01Prev.net_disbursement
  },
  bni02: {
    rate_pct: bni02Prev.bank_rate,
    installment_exact: bni02Prev.bni_details.monthly_installment_exact
  },
  maturityPast75: {
    maturity_date: maturityPast75.bni_details.maturity_date,
    age_75_date: maturityPast75.bni_details.age_75_date,
    overall_ok: maturityPast75.overall_ok,
    max_tenor_clamped: maxTenorPast75.max_tenor
  }
}, null, 2));
