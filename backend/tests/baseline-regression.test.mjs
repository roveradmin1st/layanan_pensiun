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

  // --------------------------------------------------------------------------
  // C1: PP3 Plafond Maksimal Kelipatan Rp1.000.000 + Angsuran Pensiun MS Excel 16.0 (Kasus 2)
  // --------------------------------------------------------------------------
  const case2Pp3 = calculatePreview({
    bank_key: "bsi_prapen",
    name: "SYNTH-0000002",
    birth_date: "1970-10-26",
    process_date: "2026-11-02",
    bup_age: 58,
    tmt_pensiun_year: 2028,
    bsi_status_gaji: "Payroll",
    bsi_dbr_chosen: 70,
    bsi_sub_product: "PP3",
    bsi_akad: "Murabahah",
    bsi_skema: "Atribusi",
    gaji_pokok: 9195080,
    uang_makan: 1687104,
    tunjangan_rutin_1: 980674,
    pension_salary: 9560632,
    plafond: 50000000,
    tenor: 120,
    bsi_price_aktif: 9.5,
    bsi_price_pensiun: 11.5,
    bsi_insurance_months: 126
  }, params);
  assert.equal(case2Pp3.overall_ok, true, "Kasus 2 PP3 harus layak");
  assert.equal(case2Pp3.bsi_details.max_plafond_at_tenor, 518000000, "Plafond maksimal PP3 Kasus 2 harus Rp518.000.000 sesuai MS Excel 16.0");
  assert.equal(case2Pp3.coop_installment, 858032, "Angsuran pensiun PP3 Kasus 2 harus Rp858.032 sesuai MS Excel 16.0 (858.031,76)");
  assert.equal(case2Pp3.bsi_details.pension_installment_exact.toFixed(2), "858031.76", "Angsuran pensiun presisi PP3 harus 858031.76");
  assert.equal(case2Pp3.bsi_details.sisa_pencairan_bersih_exact.toFixed(2), "37095125.49", "Terima bersih PP3 Kasus 2 harus 37095125.49 sesuai MS Excel 16.0");

  // --------------------------------------------------------------------------
  // C2 & C6: Rumus Akseptasi Aktif Simulasi!G4:G6 & Presisi Desimal Gaji Diakui (Kasus 21 & Kasus 43)
  // --------------------------------------------------------------------------
  const case21 = calculatePreview({
    bank_key: "bsi_prapen",
    name: "SYNTH-0000021",
    birth_date: "1969-03-01",
    process_date: "2026-11-26",
    bup_age: 60,
    tmt_pensiun_year: 2029,
    bsi_status_gaji: "Comitted Payroll",
    bsi_dbr_chosen: 80,
    bsi_sub_product: "PP10",
    bsi_akad: "Murabahah",
    bsi_skema: "Non-Atribusi",
    gaji_pokok: 14543845,
    uang_makan: 1964958,
    tunjangan_rutin_1: 573948,
    pension_salary: 7110362,
    plafond: 500000000,
    tenor: 88,
    bsi_price_aktif: 10.5,
    bsi_price_pensiun: 10.5,
    bsi_insurance_months: 94,
    angsuran_bsi: 127553,
    angsuran_selain_bsi: 0
  }, params);
  assert.equal(case21.overall_ok, true, "Kasus 21 Comitted Payroll 80% dengan angsuran BSI harus layak");
  assert.equal(case21.bank_installment, 13361045, "Angsuran aktif Kasus 21 harus Rp13.361.045 sesuai Simulasi!G5 MS Excel 16.0");
  assert.equal(case21.bsi_details.pension_installment_exact.toFixed(2), "4648849.38", "Angsuran pensiun Kasus 21 harus 4648849.38 sesuai MS Excel 16.0");
  assert.equal(case21.bsi_details.max_plafond_at_tenor, 563000000, "Max plafond Kasus 21 harus Rp563.000.000 sesuai MS Excel 16.0");

  const case43 = calculatePreview({
    bank_key: "bsi_prapen",
    name: "SYNTH-0000043",
    birth_date: "1973-09-30",
    process_date: "2026-11-02",
    bup_age: 58,
    tmt_pensiun_year: 2031,
    bsi_status_gaji: "Payroll",
    bsi_dbr_chosen: 70,
    bsi_sub_product: "PP10",
    bsi_akad: "MMQ",
    bsi_skema: "Non-Atribusi",
    gaji_pokok: 2528770,
    uang_makan: 1173538,
    tunjangan_rutin_1: 2682262,
    pension_salary: 7898032,
    plafond: 248746054,
    tenor: 159,
    bsi_price_aktif: 9.25,
    bsi_price_pensiun: 10.5,
    bsi_insurance_months: 165,
    angsuran_bsi: 0,
    angsuran_selain_bsi: 813510
  }, params);
  assert.equal(case43.overall_ok, true, "Kasus 43 Payroll 70% dengan angsuran selain BSI harus layak");
  assert.equal(case43.bank_installment, 4199293, "Angsuran aktif Kasus 43 harus Rp4.199.293 sesuai Simulasi!G4 MS Excel 16.0");
  assert.equal(case43.bsi_details.pension_installment_exact.toFixed(2), "1190038.18", "Angsuran pensiun Kasus 43 harus 1190038.18 sesuai MS Excel 16.0");

  // --------------------------------------------------------------------------
  // C4 & C5a: Penolakan Input Tidak Sah (plafond=0, tenor=0, tanggal tidak sah, tenor <= masa aktif)
  // --------------------------------------------------------------------------
  const zeroPlafondRes = calculatePreview({ ...fixtureInput, plafond: 0 }, params);
  assert.equal(zeroPlafondRes.overall_ok, false, "Plafond eksplisit 0 wajib ditolak (overall_ok = false)");
  assert.equal(zeroPlafondRes.plafond, 0, "Plafond eksplisit 0 tidak boleh diganti max_plafond");

  const zeroTenorRes = calculatePreview({ ...fixtureInput, tenor: 0 }, params);
  assert.equal(zeroTenorRes.overall_ok, false, "Tenor eksplisit 0 wajib ditolak (overall_ok = false)");

  const badDateRes = calculatePreview({ ...fixtureInput, birth_date: "1985-02-31" }, params);
  assert.equal(badDateRes.overall_ok, false, "Tanggal kalender tidak sah 1985-02-31 wajib ditolak");

  const activeOnlyTenorRes = calculatePreview({ ...fixtureInput, tenor: 60 }, params); // actualMonthsToBup = 120
  assert.equal(activeOnlyTenorRes.overall_ok, false, "Tenor <= masa aktif (tanpa fase pensiun) wajib ditolak pada Prapensiun");

  // --------------------------------------------------------------------------
  // C7 (Task #5): Kelahiran Desember 26/12/1967 — Tanpa Pengurangan 1 Tahun BUP Secara Umum
  // --------------------------------------------------------------------------
  const dec1967Auto = calculateMax({
    bank_key: "bsi_prapen",
    name: "NASABAH DESEMBER",
    birth_date: "1967-12-26",
    process_date: "2026-11-02",
    bup_age: 60,
    bsi_status_gaji: "Payroll",
    bsi_sub_product: "PP3",
    gaji_pokok: 8000000,
    pension_salary: 5000000
  }, params);
  assert.equal(dec1967Auto.bup_attainment_year, 2027, "Tahun mencapai usia BUP 60 untuk 26/12/1967 adalah 2027");
  assert.equal(dec1967Auto.bup_date, "2028-01-01", "TMT Pensiun efektif untuk 26/12/1967 (BUP 60) harus 2028-01-01");
  assert.equal(maxRes.bup_date, "2036-11-01", "Nasabah Oktober 24/10/1976 (BUP 60) tetap 2036-11-01 tanpa pengurangan 1 tahun");

  // --------------------------------------------------------------------------
  // Kasus Uji Kelahiran Desember + Polis Simas Sesuai Tenor (+0 bln / 180 bln)
  // --------------------------------------------------------------------------
  const decZeroBufferRes = calculatePreview({
    bank_key: "bsi_prapen",
    name: "DEBITUR UJI DESEMBER",
    birth_date: "1967-12-26",
    process_date: "2026-11-10",
    bsi_proyeksi_cair: "2026-11-10",
    bsi_start_angsuran: "2026-12-01",
    bup_age: 60,
    tmt_pensiun_year: 2027,
    bsi_status_gaji: "Payroll",
    bsi_sub_product: "PP10",
    bsi_akad: "MMQ",
    bsi_skema: "Atribusi",
    bsi_insurance_buffer_months: 0,
    gaji_pokok: 5777400,
    uang_makan: 906100,
    tunjangan_rutin_1: 4359055,
    tht: 88300000,
    pension_salary: 5200000,
    plafond: 410000000,
    tenor: 180,
    bsi_price_aktif: 9.5,
    bsi_price_pensiun: 10.5
  }, params);
  assert.equal(decZeroBufferRes.overall_ok, true);
  assert.equal(decZeroBufferRes.bsi_details.active_months, 14);
  assert.equal(decZeroBufferRes.bsi_details.pension_months, 166);
  assert.equal(decZeroBufferRes.bsi_details.premi_asuransi_tertanggung, 67538232);
  assert.equal(decZeroBufferRes.bsi_details.active_installment_exact.toFixed(2), "7361227.00");
  assert.equal(decZeroBufferRes.bsi_details.pension_installment_exact.toFixed(2), "4389716.08");
  assert.equal(decZeroBufferRes.bsi_details.blokir_pensiun_exact.toFixed(2), "8779432.16");
  assert.equal(decZeroBufferRes.bsi_details.sisa_pencairan_bersih_exact.toFixed(2), "389659340.84");

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
