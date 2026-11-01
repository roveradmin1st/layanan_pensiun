// ============================================================================
// BASELINE REGRESSION TEST SUITE — BSI PRAPENSIUN (NOS v1.4.6) & SIMAS JIWA
// Sesuai command.md Butir 1:
// Fixture deterministik PP10: Plafon Rp480.000.000, Tenor 180 bln,
// Price Aktif 9,25%, Price Pensiun 10,50%
// Expected utama:
// - Premi: Rp39.998.267
// - Angsuran Aktif: Rp5.694.441
// - Angsuran Pensiun: Rp4.121.877 (raw: 4.121.876,72)
// - Terima Bersih: Rp461.161.806 (raw: 461.161.805,56)
// ============================================================================

import assert from "node:assert/strict";
import { DEFAULT_PARTNER_PARAMETERS } from "../src/config/default-parameters.js";
import { calculateMax, calculatePreview } from "../src/engines/calc-engine.js";

export function runBsiPp10RegressionTest() {
  const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);
  const fixtureInput = {
    bank_key: "bsi_prapen",
    name: "SITI HAFSAH",
    nip: "1968012220071012004",
    birth_date: "1976-10-24",
    process_date: "2026-11-07",
    bup_age: 60,
    bsi_status_gaji: "Payroll",
    bsi_sub_product: "PP10",
    bsi_akad: "MMQ",
    bsi_skema: "Atribusi",
    salary: 8134916,
    pension_salary: 4600000,
    plafond: 480000000,
    tenor: 180,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.50,
    take_over: 0,
    buka_blokir_lama: 0
  };

  const maxRes = calculateMax(fixtureInput, params);
  assert.equal(maxRes.processable, true, "Fixture PP10 harus processable pada calculateMax");
  assert.equal(maxRes.nearest_age, 50, "Usia Nearest Birthday 30/360 harus 50 tahun");

  const simRes = calculatePreview(fixtureInput, params);
  const bsi = simRes.bsi_details;

  assert.equal(simRes.overall_ok, true, "Fixture PP10 harus overall_ok = true");
  assert.equal(bsi.simas.tarif_permil, 76.92, "Tarif Simas harus 76,92 per mil");
  assert.equal(bsi.premi_asuransi_tertanggung, 39998267, "Premi yang dimasukkan ke NOS harus Rp39.998.267");
  assert.equal(simRes.bank_installment, 5694441, "Angsuran aktif bulat harus Rp5.694.441");
  assert.equal(bsi.sisa_os_saat_pensiun, 185564623, "Saldo transisi saat pensiun harus Rp185.564.623");
  assert.equal(simRes.coop_installment, 4121877, "Angsuran pensiun bulat harus Rp4.121.877");
  assert.equal(simRes.net_disbursement, 461161806, "Terima bersih bulat harus Rp461.161.806");

  // Verifikasi nilai presisi 2 desimal (sen) sesuai output Excel
  assert.equal(bsi.active_installment_exact.toFixed(2), "5694441.00", "Angsuran aktif 2 desimal harus 5694441.00");
  assert.equal(bsi.pension_installment_exact.toFixed(2), "4121876.72", "Angsuran pensiun 2 desimal harus 4121876.72");
  assert.equal(bsi.blokir_aktif_exact.toFixed(2), "5694441.00", "Blokir 1x aktif harus 5694441.00");
  assert.equal(bsi.blokir_pensiun_exact.toFixed(2), "8243753.44", "Blokir 2x pensiun harus 8243753.44");
  assert.equal(bsi.sisa_pencairan_bersih_exact.toFixed(2), "461161805.56", "Terima bersih 2 desimal harus 461161805.56");

  return {
    passed: true,
    metrics: {
      tarifSimas: bsi.simas.tarif_permil,
      premi: bsi.premi_asuransi_tertanggung,
      angsuranAktif: simRes.bank_installment,
      sisaOsTransisi: bsi.sisa_os_saat_pensiun,
      angsuranPensiun: simRes.coop_installment,
      angsuranPensiunSen: bsi.pension_installment_exact.toFixed(2),
      terimaBersih: simRes.net_disbursement,
      terimaBersihSen: bsi.sisa_pencairan_bersih_exact.toFixed(2)
    }
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const result = runBsiPp10RegressionTest();
  console.log("[PASS] Baseline Regression PP10:", JSON.stringify(result.metrics, null, 2));
}
