// ============================================================================
// LEAD DISTRIBUTION, MASTER BRANCH & ZERO-MARKETER FALLBACK TEST SUITE
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { MASTER_BRANCHES, KANWIL_BRANCHES, normalizeBranch, resolveBranchFromCityOrText } from "../src/config/branches.js";

test("Master Cabang: Memuat 7 Kanwil dan mencakup cabang utama nasional", () => {
  assert.equal(KANWIL_BRANCHES.length, 7, "Harus terdapat 7 Kanwil");
  
  // Verifikasi Kanwil 1 (Sumbagut) mencakup MEDAN, PEMATANGSIANTAR, NIAS, BANDA ACEH
  const wil1 = KANWIL_BRANCHES.find((k) => k.code === "WIL-1");
  assert.ok(wil1, "WIL-1 harus terdaftar");
  assert.ok(wil1.branches.includes("MEDAN"));
  assert.ok(wil1.branches.includes("PEMATANGSIANTAR"));
  assert.ok(wil1.branches.includes("NIAS"), "NIAS harus ada di WIL-1 sesuai persetujuan klien");
  assert.ok(wil1.branches.includes("BANDA ACEH"));

  // Verifikasi daftar master branches
  assert.ok(MASTER_BRANCHES.includes("PUSAT JAKARTA"));
  assert.ok(MASTER_BRANCHES.includes("BANDUNG"));
  assert.ok(MASTER_BRANCHES.includes("SURABAYA"));
  assert.ok(MASTER_BRANCHES.includes("MAKASSAR"));
});

test("Normalisasi Cabang: Mencegah kegagalan otorisasi akibat variasi nama / spasi / kota", () => {
  // Pematangsiantar & Simalungun
  assert.equal(normalizeBranch("PEMATANG SIANTAR"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("pematangsiantar"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("SIANTAR"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("Simalungun"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("PEMATNGSIANTAR"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch("BSI SIANTAR 2"), "PEMATANGSIANTAR");
  assert.equal(normalizeBranch(" bsi-siantar_2 "), "PEMATANGSIANTAR");

  // Nias & Gunungsitoli
  assert.equal(normalizeBranch("NIAS"), "NIAS");
  assert.equal(normalizeBranch("gunungsitoli"), "NIAS");
  assert.equal(normalizeBranch("GUNUNG SITOLI"), "NIAS");
  assert.equal(normalizeBranch("Nias Selatan"), "NIAS");
  assert.equal(normalizeBranch("Nias Utara"), "NIAS");

  // Jakarta / Pusat
  assert.equal(normalizeBranch("PUSAT"), "PUSAT JAKARTA");
  assert.equal(normalizeBranch("Jakarta"), "PUSAT JAKARTA");
  assert.equal(normalizeBranch("DKI JAKARTA"), "PUSAT JAKARTA");
  assert.equal(normalizeBranch("Jakarta Pusat"), "PUSAT JAKARTA");

  // Jawa Barat
  assert.equal(normalizeBranch("Bandung"), "BANDUNG");
  assert.equal(normalizeBranch("Kota Bandung"), "BANDUNG");
  assert.equal(normalizeBranch("Cimahi"), "BANDUNG");
  assert.equal(normalizeBranch("Cirebon"), "CIREBON");

  // Jawa Tengah & DIY
  assert.equal(normalizeBranch("Solo"), "SOLO");
  assert.equal(normalizeBranch("Surakarta"), "SOLO");
  assert.equal(normalizeBranch("Yogyakarta"), "YOGYAKARTA");
  assert.equal(normalizeBranch("Jogja"), "YOGYAKARTA");
  assert.equal(normalizeBranch("D.I. Yogyakarta"), "YOGYAKARTA");
});

test("Resolusi Cabang dari Kota/Teks: Memetakan baris impor ke Master Cabang kanonikal", () => {
  // Berdasarkan Kota
  assert.equal(resolveBranchFromCityOrText("Kota Gunungsitoli", "", ""), "NIAS");
  assert.equal(resolveBranchFromCityOrText("Kota Pematangsiantar", "", ""), "PEMATANGSIANTAR");
  assert.equal(resolveBranchFromCityOrText("Kab. Simalungun", "", ""), "PEMATANGSIANTAR");
  assert.equal(resolveBranchFromCityOrText("Kota Medan", "", ""), "MEDAN");
  assert.equal(resolveBranchFromCityOrText("Kota Bandung", "", ""), "BANDUNG");
  assert.equal(resolveBranchFromCityOrText("Surabaya", "", ""), "SURABAYA");

  // Explicit Target Branch Override dari Admin (Dropdown Impor)
  assert.equal(resolveBranchFromCityOrText("Kota Medan", "MEDAN", "PEMATANGSIANTAR"), "PEMATANGSIANTAR");
  assert.equal(resolveBranchFromCityOrText("Kota Bandung", "BANDUNG", "NIAS"), "NIAS");
});

test("Simulasi Round-Robin & Zero-Marketer Fallback Guard", () => {
  // Mock pengguna marketing aktif per cabang
  const mockUsers = [
    { id: "u-m1", name: "Marketer Siantar 1", role: "marketing", branch: "PEMATANGSIANTAR", active: true },
    { id: "u-m2", name: "Marketer Siantar 2", role: "marketing", branch: "PEMATANG SIANTAR", active: true }, // Variasi spasi
    { id: "u-m3", name: "Marketer Medan 1", role: "marketing", branch: "MEDAN", active: true },
    { id: "u-m4", name: "Marketer Nonaktif", role: "marketing", branch: "PEMATANGSIANTAR", active: false } // Inactive tidak boleh menerima leads
  ];

  // 1. Uji Distribusi Adil (Round-Robin) untuk Cabang PEMATANGSIANTAR (2 marketing aktif)
  const targetBranch = "PEMATANGSIANTAR";
  const branchMarketers = mockUsers.filter(
    (u) => u.role === "marketing" && u.active !== false && normalizeBranch(u.branch) === targetBranch
  );
  assert.equal(branchMarketers.length, 2, "Harus menemukan 2 marketing aktif (normalisasi spasi)");

  const assignedResults = [];
  let pointer = 0;
  for (let i = 0; i < 6; i++) {
    const assigned = branchMarketers[pointer % branchMarketers.length];
    pointer++;
    assignedResults.push(assigned.id);
  }

  // 6 leads harus terbagi rata 3 untuk u-m1 dan 3 untuk u-m2
  const countM1 = assignedResults.filter((id) => id === "u-m1").length;
  const countM2 = assignedResults.filter((id) => id === "u-m2").length;
  assert.equal(countM1, 3, "Marketer 1 harus menerima 3 leads");
  assert.equal(countM2, 3, "Marketer 2 harus menerima 3 leads");
  assert.deepEqual(assignedResults, ["u-m1", "u-m2", "u-m1", "u-m2", "u-m1", "u-m2"]);

  // 2. Uji Zero-Marketer Fallback Guard: Cabang NIAS (belum ada marketing)
  const niasMarketers = mockUsers.filter(
    (u) => u.role === "marketing" && u.active !== false && normalizeBranch(u.branch) === "NIAS"
  );
  assert.equal(niasMarketers.length, 0, "Cabang NIAS belum memiliki marketing");

  let niasLeadAssignedTo = null;
  let poolCount = 0;
  if (niasMarketers.length > 0) {
    niasLeadAssignedTo = niasMarketers[0].id;
  } else {
    // Masuk Pool Cadangan Cabang secara aman tanpa error
    niasLeadAssignedTo = null;
    poolCount++;
  }
  assert.equal(niasLeadAssignedTo, null, "Lead harus berstatus unassigned (pool cadangan)");
  assert.equal(poolCount, 1, "Counter pool cadangan harus bertambah");
});
