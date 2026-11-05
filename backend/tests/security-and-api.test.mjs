// ============================================================================
// SECURITY, RBAC, BANK-SCOPE & BUSINESS INTEGRITY API TEST SUITE
// Direct HTTP verification against running backend + child-process prod checks
// ============================================================================

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import vm from "node:vm";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

async function api(method, endpoint, { token, body, headers = {}, isForm = false } = {}) {
  const reqHeaders = { ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !isForm) {
    reqHeaders["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: payload
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.arrayBuffer();
  return { status: res.status, data, headers: res.headers };
}

async function login(email, password = "Password123!") {
  const res = await api("POST", "/api/auth/login", { body: { email, password } });
  assert.equal(res.status, 200, `Login gagal untuk ${email}: ${JSON.stringify(res.data)}`);
  return res.data.access_token;
}

console.log("=================================================================");
console.log("RUNNING SECURITY, RBAC & OPERATIONAL INTEGRITY API TEST SUITE");
console.log("=================================================================");

// 0. Take full backup via Super Admin so we can restore exact state after tests
const superToken = await login("superadmin@layananpensiunan.id");
const adminOpsToken = await login("adminops@layananpensiunan.id");
const adminBranchToken = await login("admincabang@layananpensiunan.id");
const managerToken = await login("salesmanager@layananpensiunan.id");
const marketingToken = await login("marketing@layananpensiunan.id");

const initialBackupRes = await api("GET", "/api/backup", { token: superToken });
assert.equal(initialBackupRes.status, 200, "Super Admin harus dapat mengunduh backup");
const initialStoreSnapshot = initialBackupRes.data;
initialStoreSnapshot.lead_requests = [];
for (const lead of initialStoreSnapshot.leads || []) {
  if (["lead-1006", "lead-1007", "lead-1008", "lead-1009", "lead-1010"].includes(lead.id)) {
    lead.assigned_to = null;
    lead.assigned_name = null;
  }
}

// Reset lead_requests & unassigned stock at startup to ensure 100% test idempotency
const initCleanForm = new FormData();
initCleanForm.append(
  "file",
  new Blob([JSON.stringify(initialStoreSnapshot)], { type: "application/json" }),
  "restore.json"
);
await api("POST", "/api/backup/restore", {
  token: superToken,
  body: initCleanForm,
  isForm: true
});

try {
  // --------------------------------------------------------------------------
  // 1. DETERMINISTIC BASELINE REGRESSION TEST (PP10 FIXTURE VIA API)
  // --------------------------------------------------------------------------
  console.log("\n[1/5] Verifikasi Baseline Regression Kalkulator BSI PP10 via API...");
  const pp10FixtureInput = {
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
    bsi_price_pensiun: 10.5,
    take_over: 0,
    buka_blokir_lama: 0
  };
  const pp10Res = await api("POST", "/api/calc/preview", {
    token: marketingToken,
    body: pp10FixtureInput
  });
  assert.equal(pp10Res.status, 200);
  const pp10 = pp10Res.data;
  const bsi = pp10.bsi_details;
  assert.equal(bsi.premi_asuransi_tertanggung, 39998267, "Premi PP10 harus Rp39.998.267");
  assert.equal(pp10.bank_installment, 5694441, "Angsuran Aktif PP10 harus Rp5.694.441");
  assert.equal(pp10.coop_installment, 4121877, "Angsuran Pensiun PP10 harus Rp4.121.877");
  assert.equal(bsi.pension_installment_exact.toFixed(2), "4121876.72", "Angsuran Pensiun presisi harus 4.121.876,72");
  assert.equal(pp10.net_disbursement, 461161806, "Terima Bersih PP10 harus Rp461.161.806");
  assert.equal(bsi.sisa_pencairan_bersih_exact.toFixed(2), "461161805.56", "Terima Bersih presisi harus 461.161.805,56");
  console.log("  ✓ PASS: Kalkulator BSI PP10 akurat 100% tanpa pergeseran angka.");

  // --------------------------------------------------------------------------
  // 2. AUTHENTICATION BYPASS REMOVAL & PRODUCTION JWT HARDENING
  // --------------------------------------------------------------------------
  console.log("\n[2/5] Verifikasi Penutupan Celah Autentikasi & Proteksi Produksi...");

  // 2a. Wrong password & "admin123" bypass attempt on login
  const badLogin1 = await api("POST", "/api/auth/login", {
    body: { email: "superadmin@layananpensiunan.id", password: "admin123" }
  });
  assert.equal(badLogin1.status, 401, "Bypass 'admin123' pada login harus ditolak (401)");

  // 2b. Create temporary user, test change-password bypass & universal password removal
  const tempEmail = `sec_test_${Date.now()}@pensiun.com`;
  const createTempUser = await api("POST", "/api/users", {
    token: superToken,
    body: {
      name: "Security Test User",
      email: tempEmail,
      password: "InitialPassword99!",
      role: "marketing",
      branch: "BANDUNG"
    }
  });
  assert.equal(createTempUser.status, 200);
  const tempToken = await login(tempEmail, "InitialPassword99!");

  // Universal password "Password123!" must fail for user whose password is "InitialPassword99!"
  const universalBypassAttempt = await api("POST", "/api/auth/login", {
    body: { email: tempEmail, password: "Password123!" }
  });
  assert.equal(universalBypassAttempt.status, 401, "Universal password 'Password123!' harus ditolak jika bukan password asli user");

  // Change password with wrong current_password ("admin123" or "Password123!") must fail
  const badChangePass = await api("POST", "/api/auth/change-password", {
    token: tempToken,
    body: { current_password: "admin123", new_password: "HackedPassword99!" }
  });
  assert.equal(badChangePass.status, 400, "Bypass 'admin123' pada change-password harus ditolak (400)");

  // Valid change password succeeds
  const okChangePass = await api("POST", "/api/auth/change-password", {
    token: tempToken,
    body: { current_password: "InitialPassword99!", new_password: "UpdatedPassword99!" }
  });
  assert.equal(okChangePass.status, 200);

  // Old password now fails
  const oldPassAttempt = await api("POST", "/api/auth/login", {
    body: { email: tempEmail, password: "InitialPassword99!" }
  });
  assert.equal(oldPassAttempt.status, 401, "Password lama harus ditolak setelah ganti password");

  // 2c. Unauthenticated quick-role with ?demo=1 and spoofed headers must be rejected
  const unauthQuickRole = await api("POST", "/api/auth/quick-role?demo=1", {
    headers: {
      "X-Forwarded-Host": "localhost",
      "X-Demo-Mode": "1",
      "X-PWA-Standalone": "true"
    },
    body: { role: "super_admin" }
  });
  assert.equal(unauthQuickRole.status, 401, "Unauthenticated quick-role harus ditolak (401)");

  // 2d. Production startup must fail when JWT_SECRET is missing or weak
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const prodWeakJwtProc = spawnSync(process.execPath, [serverPath], {
    env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "short_secret", PORT: "4099" },
    encoding: "utf8",
    timeout: 5000
  });
  assert.equal(prodWeakJwtProc.status, 1, "Server produksi wajib gagal start jika JWT_SECRET lemah/kosong");
  assert.match(prodWeakJwtProc.stderr, /\[FATAL\] Production startup aborted/);

  // 2e. Hardened JWT Fallback: Rejection of example/repo fallback keys & token spoofing (P0 fix)
  for (const fallbackSecret of [
    "4f8b9e1a3c7d5f2e6a0b8c4d2e9f1a3b5c7e9d0f2a4b6c8d1e3f5a7b9c0d2e4f",
    "lp_production_jwt_secret_min32chars_key_2026_enterprise"
  ]) {
    const prodFallbackProc = spawnSync(process.execPath, [serverPath], {
      env: { ...process.env, NODE_ENV: "production", JWT_SECRET: fallbackSecret, PORT: "4099" },
      encoding: "utf8",
      timeout: 5000
    });
    assert.equal(prodFallbackProc.status, 1, "Server produksi wajib gagal start jika JWT_SECRET memakai nilai fallback contoh dari repo");
    assert.match(prodFallbackProc.stderr, /\[FATAL\] Production startup aborted/);
  }

  // Token signed with repo fallback key against active server must be rejected with 401 Unauthorized
  const forgedToken = jwt.sign({ sub: "u-1", role: "super_admin" }, "4f8b9e1a3c7d5f2e6a0b8c4d2e9f1a3b5c7e9d0f2a4b6c8d1e3f5a7b9c0d2e4f", { expiresIn: "1h" });
  const forgedAuthAttempt = await api("GET", "/api/auth/me", { token: forgedToken });
  assert.equal(forgedAuthAttempt.status, 401, "Token yang ditandatangani dengan kunci contoh repo wajib DITOLAK (401)");

  // 2f. Forgot-Password and Reset-Password Verification (Probe regression)
  const fpReq = await api("POST", "/api/auth/forgot-password", { body: { email: "marketing@layananpensiunan.id" } });
  assert.equal(fpReq.status, 200, "Endpoint forgot-password harus 200 OK");
  assert.ok(fpReq.data.message);

  const rpBadReq = await api("POST", "/api/auth/reset-password", { body: { token: "token_palsu_123", password: "NewPassword123!" } });
  assert.equal(rpBadReq.status, 400, "Reset password dengan token tidak valid harus 400");
  console.log("  ✓ PASS: Celah autentikasi tertutup & proteksi JWT_SECRET produksi aktif.");

  // --------------------------------------------------------------------------
  // 3. AUTHORIZATION: ROLE, BRANCH, BANK-SCOPE (OWNER'S RULE) & OWNERSHIP
  // --------------------------------------------------------------------------
  console.log("\n[3/5] Verifikasi Otorisasi Role, Cabang, Bank-Scope (Aturan Owner) & Kepemilikan Data...");

  // 3a. Owner's Rule: Admin Cabang All Bank CAN access all banks including BSI,
  //     while a "bsi_only" account can ONLY access bsi_prapen and CANNOT interfere with All Bank products.
  const bsiOnlyEmail = `bsi_only_${Date.now()}@pensiun.com`;
  const createBsiOnlyUser = await api("POST", "/api/users", {
    token: superToken,
    body: {
      name: "Admin Khusus BSI",
      email: bsiOnlyEmail,
      password: "BsiPassword123!",
      role: "admin_branch",
      branch: "BANDUNG",
      bank_scope: "bsi_only"
    }
  });
  assert.equal(createBsiOnlyUser.status, 200);
  assert.equal(createBsiOnlyUser.data.bank_scope, "bsi_only");
  const bsiOnlyToken = await login(bsiOnlyEmail, "BsiPassword123!");

  // 3a.0 Kebijakan Pengelolaan User Lintas Scope (P1 Fix):
  // Admin Cabang Khusus BSI dilarang melihat, membaca, me-reset password, atau menonaktifkan pengguna All Bank
  const allUsersUnderBsiAdmin = await api("GET", "/api/users", { token: bsiOnlyToken });
  assert.equal(allUsersUnderBsiAdmin.status, 200);
  for (const u of allUsersUnderBsiAdmin.data) {
    assert.equal(u.bank_scope, "bsi_only", "Admin BSI hanya boleh melihat user dengan scope bsi_only");
  }

  // Percobaan baca detail user marketing all_bank (u-mkt-1) oleh Admin BSI wajib 403
  const bsiReadMktAllBank = await api("GET", "/api/users/u-mkt-1", { token: bsiOnlyToken });
  assert.equal(bsiReadMktAllBank.status, 403, "Admin BSI dilarang membaca data akun user all_bank (403)");

  // Percobaan reset password user marketing all_bank oleh Admin BSI wajib 403
  const bsiPatchMktPass = await api("PATCH", "/api/users/u-mkt-1", {
    token: bsiOnlyToken,
    body: { password: "HackedPassword99!" }
  });
  assert.equal(bsiPatchMktPass.status, 403, "Admin BSI dilarang me-reset kata sandi user all_bank lintas scope (403)");

  // Percobaan deaktivasi user marketing all_bank oleh Admin BSI wajib 403
  const bsiDeactMkt = await api("PATCH", "/api/users/u-mkt-1", {
    token: bsiOnlyToken,
    body: { active: false }
  });
  assert.equal(bsiDeactMkt.status, 403, "Admin BSI dilarang menonaktifkan user all_bank lintas scope (403)");

  // Verifikasi kata sandi target TIDAK berubah
  const hackedLoginAttempt = await api("POST", "/api/auth/login", {
    body: { email: "marketing@layananpensiunan.id", password: "HackedPassword99!" }
  });
  assert.equal(hackedLoginAttempt.status, 401, "Password target tidak boleh berubah setelah request lintas scope ditolak");

  const legitimateLogin = await api("POST", "/api/auth/login", {
    body: { email: "marketing@layananpensiunan.id", password: "Password123!" }
  });
  assert.equal(legitimateLogin.status, 200, "Password asli target harus tetap utuh dan login 200 OK");

  // Admin Cabang All Bank (cabang@pensiun.com) sees all banks including bsi_prapen & ams2
  const allBankListRes = await api("GET", "/api/banks", { token: adminBranchToken });
  assert.equal(allBankListRes.status, 200);
  const allBankKeys = allBankListRes.data.banks.map((b) => b.key);
  assert.ok(allBankKeys.includes("bsi_prapen"), "Admin Cabang All Bank harus bisa mengakses BSI");
  assert.ok(allBankKeys.includes("ams2"), "Admin Cabang All Bank harus bisa mengakses AMS2");
  assert.ok(allBankKeys.includes("bank_capital"), "Admin Cabang All Bank harus bisa mengakses Bank Capital");

  // Admin Cabang All Bank can calculate BSI simulation
  const allBankBsiCalc = await api("POST", "/api/calc/preview", {
    token: adminBranchToken,
    body: { bank_key: "bsi_prapen", salary: 8000000, pension_salary: 4500000, requested_plafond: 200000000, requested_tenor: 120 }
  });
  assert.equal(allBankBsiCalc.status, 200, "Admin Cabang All Bank harus diizinkan menghitung BSI");

  // bsi_only account ONLY sees bsi_prapen
  const bsiOnlyListRes = await api("GET", "/api/banks", { token: bsiOnlyToken });
  assert.equal(bsiOnlyListRes.status, 200);
  assert.deepEqual(
    bsiOnlyListRes.data.banks.map((b) => b.key),
    ["bsi_prapen"],
    "Akun bsi_only hanya boleh melihat bank bsi_prapen"
  );

  // bsi_only account is FORBIDDEN (403) from calculating or saving AMS2 / Capital / Mestika simulations
  const bsiOnlyAms2Attempt = await api("POST", "/api/calc/preview", {
    token: bsiOnlyToken,
    body: { bank_key: "ams2", salary: 4500000, requested_plafond: 50000000, requested_tenor: 60 }
  });
  assert.equal(bsiOnlyAms2Attempt.status, 403, "Akun bsi_only tidak boleh mencampuri produk All Bank (AMS2)");

  // Validasi Otoritas Transaksi: Admin Cabang All Bank vs Admin Cabang Khusus BSI
  const allBankAppsRes = await api("GET", "/api/applications", { token: adminBranchToken });
  assert.equal(allBankAppsRes.status, 200);
  const allBankAppKeys = allBankAppsRes.data.items.map((a) => a.bank_key || a.bank_name);
  assert.ok(allBankAppKeys.some((k) => String(k).includes("ams2")), "Admin Cabang All Bank harus dapat melihat pengajuan AMS2");
  assert.ok(allBankAppKeys.some((k) => String(k).includes("bsi")), "Admin Cabang All Bank harus dapat melihat pengajuan BSI");

  const bsiOnlyAppsRes = await api("GET", "/api/applications", { token: bsiOnlyToken });
  assert.equal(bsiOnlyAppsRes.status, 200);
  assert.ok(bsiOnlyAppsRes.data.items.length > 0, "Admin Cabang BSI harus melihat pengajuan BSI");
  for (const item of bsiOnlyAppsRes.data.items) {
    const k = String(item.bank_key || item.bank_name || "").toLowerCase();
    assert.ok(k.includes("bsi"), `Admin Cabang BSI dilarang melihat transaksi non-BSI: ${item.bank_name}`);
  }

  // Percobaan akses langsung ID pengajuan bank lain (AMS2) oleh Admin Cabang BSI wajib 403
  const bsiDirectViewAms2App = await api("GET", "/api/applications/app-3001", { token: bsiOnlyToken });
  assert.equal(bsiDirectViewAms2App.status, 403, "Admin Cabang BSI wajib ditolak (403) mengakses pengajuan AMS2");

  // Validasi Riwayat Simulasi: Admin Cabang BSI hanya melihat simulasi BSI
  const bsiOnlySimsRes = await api("GET", "/api/simulations", { token: bsiOnlyToken });
  assert.equal(bsiOnlySimsRes.status, 200);
  for (const simItem of bsiOnlySimsRes.data.items) {
    const k = String(simItem.bank_key || simItem.result?.bank_key || "").toLowerCase();
    assert.ok(k.includes("bsi"), `Simulasi non-BSI tidak boleh bocor ke akun BSI: ${simItem.sim_no}`);
  }
  const bsiDirectViewAms2Sim = await api("GET", "/api/simulations/sim-2001", { token: bsiOnlyToken });
  assert.equal(bsiDirectViewAms2Sim.status, 403, "Admin Cabang BSI wajib ditolak (403) mengakses simulasi AMS2");

  // Validasi Klaim Insentif: Admin Cabang BSI hanya melihat klaim BSI
  const bsiOnlyClaimsRes = await api("GET", "/api/claims", { token: bsiOnlyToken });
  assert.equal(bsiOnlyClaimsRes.status, 200);
  for (const clm of bsiOnlyClaimsRes.data.items) {
    const k = String(clm.bank_key || clm.bank_name || "").toLowerCase();
    assert.ok(k.includes("bsi"), `Klaim non-BSI tidak boleh bocor ke akun BSI: ${clm.claim_no}`);
  }
  const bsiDirectViewAms2Claim = await api("GET", "/api/claims/clm-4001", { token: bsiOnlyToken });
  assert.equal(bsiDirectViewAms2Claim.status, 403, "Admin Cabang BSI wajib ditolak (403) mengakses klaim AMS2");

  // 3a.1 Validasi Peran & Kewenangan Sales Manager (Insight Klien):
  // 1. Sales Manager dilarang menambah pengguna baru -> wajib 403 (wewenang di Super Admin / Admin Ops)
  const smCreateUserAttempt = await api("POST", "/api/users", {
    token: managerToken,
    body: {
      name: "Akun Palsu SM",
      email: "sm_create_attempt@pensiun.com",
      password: "Password123!",
      role: "marketing",
      branch: "BANDUNG"
    }
  });
  assert.equal(smCreateUserAttempt.status, 403, "Sales Manager dilarang membuat pengguna baru (403)");

  // 2. Sales Manager dapat mengubah data pengguna marketing di cabangnya sendiri -> wajib 200
  const smUpdateOwnTeam = await api("PATCH", "/api/users/u-mkt-1", {
    token: managerToken,
    body: { phone: "081299112233" }
  });
  assert.equal(smUpdateOwnTeam.status, 200, "Sales Manager harus dapat mengubah profil tim marketing cabangnya (200)");

  // 3. Sales Manager dilarang mengubah pengguna cabang lain -> wajib 403
  const smUpdateOtherBranch = await api("PATCH", "/api/users/u-ops-2", {
    token: managerToken,
    body: { phone: "081299000000" }
  });
  assert.equal(smUpdateOtherBranch.status, 403, "Sales Manager dilarang mengubah akun pengguna cabang lain (403)");

  // 4. Sales Manager dilarang approval/reject klaim -> wajib 403 (wewenang di Super Admin / Admin Ops)
  const smApproveClaimAttempt = await api("POST", "/api/claims/clm-4002/action", {
    token: managerToken,
    body: { action: "approve" }
  });
  assert.equal(smApproveClaimAttempt.status, 403, "Sales Manager dilarang menyetujui klaim (403)");

  // 5. Sales Manager dilarang review dokumen pengajuan -> wajib 403 (wewenang di Super Admin / Admin Ops / Admin Cabang)
  const smReviewDocAttempt = await api("POST", "/api/applications/app-3001/documents/ktp_pasangan/review", {
    token: managerToken,
    body: { status: "diterima" }
  });
  assert.equal(smReviewDocAttempt.status, 403, "Sales Manager dilarang mereview dokumen pengajuan (403)");

  // 6. Sales Manager dapat memantau performa tim cabangnya via Dashboard
  const smDashboardRes = await api("GET", "/api/dashboard", { token: managerToken });
  assert.equal(smDashboardRes.status, 200, "Sales Manager dapat mengakses dashboard cabang");
  assert.ok(Array.isArray(smDashboardRes.data.marketing_leaderboard), "Dashboard menyertakan performa tim marketing");

  // 3b. Cross-branch & Cross-marketing Lead isolation + Mass-assignment protection
  const sbyLeadRes = await api("POST", "/api/leads", {
    token: adminOpsToken,
    body: {
      name: "NASABAH CABANG SURABAYA",
      phone: "081999888777",
      branch: "SURABAYA",
      pension_salary: 4800000,
      assigned_to: tempToken ? createTempUser.data.id : null
    }
  });
  assert.equal(sbyLeadRes.status, 200);
  const sbyLeadId = sbyLeadRes.data.id;

  // Marketing (Bandung) cannot view or PATCH Surabaya/other marketing's lead
  const mktViewOtherLead = await api("GET", `/api/leads/${sbyLeadId}`, { token: marketingToken });
  assert.equal(mktViewOtherLead.status, 403, "Marketing tidak boleh melihat lead milik marketing lain");

  const mktPatchOtherLead = await api("PATCH", `/api/leads/${sbyLeadId}`, {
    token: marketingToken,
    body: { status: "gagal", notes: "Diubah tanpa izin" }
  });
  assert.equal(mktPatchOtherLead.status, 403, "Marketing tidak boleh mengubah lead milik marketing lain");

  // Admin Cabang Bandung cannot view or PATCH Surabaya lead
  const branchViewOtherLead = await api("GET", `/api/leads/${sbyLeadId}`, { token: adminBranchToken });
  assert.equal(branchViewOtherLead.status, 403, "Admin Cabang Bandung tidak boleh mengakses lead Cabang Surabaya");

  // Verify Surabaya lead was NOT modified by rejected requests
  const checkSbyLead = await api("GET", `/api/leads/${sbyLeadId}`, { token: adminOpsToken });
  assert.equal(checkSbyLead.data.status, "baru", "Data lead harus tetap utuh setelah request 403 ditolak");

  // Mass-assignment attempt by Marketing on their own lead
  const mktLeadsRes = await api("GET", "/api/leads", { token: marketingToken });
  const ownLead = mktLeadsRes.data.items[0];
  assert.ok(ownLead, "Marketing harus memiliki minimal 1 lead sendiri");

  const massAssignAttempt = await api("PATCH", `/api/leads/${ownLead.id}`, {
    token: marketingToken,
    body: { assigned_to: "u-1", branch: "SURABAYA" }
  });
  assert.equal(massAssignAttempt.status, 403, "Percobaan ubah assigned_to/branch oleh marketing harus ditolak (403)");

  // 3c. Proteksi Parameter Mitra Bank & Pengaturan Sistem (Anti-Leak ke Marketing / Cabang)
  const superCalcParams = await api("GET", "/api/calc/params", { token: superToken });
  assert.equal(superCalcParams.status, 200, "Super Admin (Owner) harus dapat mengakses parameter kalkulator");
  assert.ok(superCalcParams.data.partners, "Super Admin harus menerima struktur partners");

  const adminOpsCalcParams = await api("GET", "/api/calc/params", { token: adminOpsToken });
  assert.equal(adminOpsCalcParams.status, 200, "Admin Operasional harus dapat mengakses parameter kalkulator");

  const mktCalcParams = await api("GET", "/api/calc/params", { token: marketingToken });
  assert.equal(mktCalcParams.status, 403, "Marketing wajib DITOLAK (403) dari endpoint parameter mitra bank (/calc/params)");

  const mgrCalcParams = await api("GET", "/api/calc/params", { token: managerToken });
  assert.equal(mgrCalcParams.status, 403, "Sales Manager wajib DITOLAK (403) dari endpoint parameter mitra bank (/calc/params)");

  const branchCalcParams = await api("GET", "/api/calc/params", { token: adminBranchToken });
  assert.equal(branchCalcParams.status, 403, "Admin Cabang wajib DITOLAK (403) dari endpoint parameter mitra bank (/calc/params)");

  // Marketing juga ditolak saat mencoba update parameter
  const mktPutParams = await api("PUT", "/api/calc/params/ams2", {
    token: marketingToken,
    body: { updates: { bankRateAnnual: 10 } }
  });
  assert.equal(mktPutParams.status, 403, "Marketing wajib ditolak (403) mengubah parameter mitra");

  // Dashboard Marketing tidak boleh membocorkan estimasi omzet kotor perusahaan atau profit bersih
  const mktDashboard = await api("GET", "/api/dashboard", { token: marketingToken });
  assert.equal(mktDashboard.status, 200);
  assert.equal(mktDashboard.data.financials.est_gross_revenue, undefined, "Omzet kotor 4% perusahaan tidak boleh bocor ke marketing");
  assert.equal(mktDashboard.data.financials.net_company_profit, undefined, "Net profit perusahaan tidak boleh bocor ke marketing");

  // 3c.2 Live Recommendation & Limits Consistency between Server and Marketing (P1 regression fix)
  // Super Admin updates AMS2 max tenor to 60 months
  const updateTenorRes = await api("PUT", "/api/calc/params/ams2", {
    token: superToken,
    body: { updates: { maxTenorMonths: 60 } }
  });
  assert.equal(updateTenorRes.status, 200);

  // Marketing retrieves limited safe parameters via /calc/limits
  const mktLimitsRes = await api("GET", "/api/calc/limits", { token: marketingToken });
  assert.equal(mktLimitsRes.status, 200, "Marketing harus dapat mengakses batas parameter operasional (/calc/limits)");
  assert.equal(mktLimitsRes.data.limits.ams2.maxTenorMonths, 60, "Batas tenor AMS2 harus 60 bulan setelah diubah Super Admin");

  // Marketing is still forbidden from viewing full sensitive admin parameters
  const mktSensitiveParams = await api("GET", "/api/calc/params", { token: marketingToken });
  assert.equal(mktSensitiveParams.status, 403, "Marketing tetap wajib DITOLAK (403) dari parameter lengkap admin");

  // API Calculator (/api/calc/max) returns max tenor 60
  const ams2MaxRes = await api("POST", "/api/calc/max", {
    token: marketingToken,
    body: { bank_key: "ams2", birth_date: "1970-01-01", salary: 5000000 }
  });
  assert.equal(ams2MaxRes.status, 200);
  assert.equal(ams2MaxRes.data.max_tenor, 60, "Rekomendasi kalkulator server harus menghasilkan 60 bulan");
  assert.equal(ams2MaxRes.data.rec_max_tenor, 60, "Rekomendasi tenor server harus 60 bulan");

  // Node VM test: Frontend helper computeAms2LiveRecommendation must match API 100%
  const calcPath = path.resolve(__dirname, "../../frontend/src/pages/Calculator.jsx");
  if (fs.existsSync(calcPath)) {
    const calcSrc = fs.readFileSync(calcPath, "utf8");
    const helperCode = calcSrc.slice(
      calcSrc.indexOf("function addMonthsClampedLocal"),
      calcSrc.indexOf("export default function CalculatorPage")
    );
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(helperCode, sandbox);
    const testInput = {
      ams2_birth_iso: "1970-01-01",
      ams2_process_iso: "2026-11-04",
      salary: 5000000,
      ams2_req_loan: 50000000,
      ams2_req_tenor: 120
    };
    const recResult = sandbox.computeAms2LiveRecommendation(testInput, mktLimitsRes.data.limits.ams2);
    assert.equal(recResult.recMaxTenor, 60, "Helper frontend di Node VM wajib menghasilkan 60 bulan");
    assert.equal(recResult.recMaxTenor, ams2MaxRes.data.max_tenor, "Hasil helper frontend dan server API wajib konsisten 100%");
  }

  // Restore AMS2 max tenor to 120
  await api("PUT", "/api/calc/params/ams2", {
    token: superToken,
    body: { updates: { maxTenorMonths: 120 } }
  });

  // 3d. Fitur Permintaan Data Prospek & Validasi Cabang Anti-Fraud (Marketing -> Admin Operasional)
  // - Verifikasi metadata stok cabang & kepatuhan identitas cabang
  const mktMetaRes = await api("GET", "/api/lead-requests", { token: marketingToken });
  assert.equal(mktMetaRes.status, 200);
  assert.equal(mktMetaRes.data.user_branch, "BANDUNG", "Cabang marketing pemohon harus terdeteksi BANDUNG");
  assert.equal(mktMetaRes.data.branch_valid, true, "Cabang marketing harus valid");
  assert.ok(mktMetaRes.data.branch_stock.total_unassigned >= 5, "Stok unassigned Bandung harus tersedia minimal 5");

  // - Proteksi Anti-Fraud 1: Akun marketing tanpa cabang resmi wajib DITOLAK (400)
  const noBranchEmail = `mkt_nobranch_${Date.now()}@pensiun.com`;
  await api("POST", "/api/users", {
    token: superToken,
    body: { name: "Mkt Tanpa Cabang", email: noBranchEmail, password: "Password123!", role: "marketing", branch: "" }
  });
  const noBranchToken = await login(noBranchEmail, "Password123!");
  const noBranchReqAttempt = await api("POST", "/api/lead-requests", {
    token: noBranchToken,
    body: { requested_count: 5 }
  });
  assert.equal(noBranchReqAttempt.status, 400, "Marketing tanpa cabang penugasan resmi wajib DITOLAK (400)");
  assert.match(noBranchReqAttempt.data.detail, /belum memiliki penugasan kantor cabang resmi/i);

  // - Proteksi Anti-Fraud 2: Marketing dari cabang tanpa stok unassigned (0 stok) wajib DITOLAK (400)
  const zeroStockEmail = `mkt_sby_${Date.now()}@pensiun.com`;
  await api("POST", "/api/users", {
    token: superToken,
    body: { name: "Mkt Surabaya Stok Nol", email: zeroStockEmail, password: "Password123!", role: "marketing", branch: "SURABAYA" }
  });
  const zeroStockToken = await login(zeroStockEmail, "Password123!");
  const zeroStockReqAttempt = await api("POST", "/api/lead-requests", {
    token: zeroStockToken,
    body: { requested_count: 3 }
  });
  assert.equal(zeroStockReqAttempt.status, 400, "Marketing dari cabang dengan stok 0 wajib DITOLAK (400)");
  assert.match(zeroStockReqAttempt.data.detail, /stok data prospek belum ditugaskan .* sedang kosong/i);

  // - Validasi Batas Kuota: Maksimal 5 data
  const reqTooMany = await api("POST", "/api/lead-requests", {
    token: marketingToken,
    body: { requested_count: 10, notes: "Minta 10 data" }
  });
  assert.equal(reqTooMany.status, 400, "Permintaan lebih dari 5 data wajib DITOLAK (400)");

  const reqZero = await api("POST", "/api/lead-requests", {
    token: marketingToken,
    body: { requested_count: 0 }
  });
  assert.equal(reqZero.status, 400, "Permintaan 0 data wajib DITOLAK (400)");

  // - Submit Permintaan Sah (5 data) + Proteksi Anti-Tampering Cabang (Input branch diabaikan, dipaksa sesuai profil server)
  const validLeadReq = await api("POST", "/api/lead-requests", {
    token: marketingToken,
    body: {
      requested_count: 5,
      target_segment: "all",
      notes: "Persiapan kanvasing pensiunan Taspen",
      branch: "MEDAN" // Percobaan tampering wilayah ke cabang lain
    }
  });
  assert.equal(validLeadReq.status, 201, "Marketing harus berhasil mengajukan 5 data prospek");
  assert.equal(validLeadReq.data.status, "PENDING");
  assert.equal(validLeadReq.data.requested_count, 5);
  assert.equal(validLeadReq.data.branch, "BANDUNG", "Sistem wajib mengabaikan tampering dan memaksakan cabang resmi BANDUNG");
  const createdReqId = validLeadReq.data.id;

  // - Anti-Spam Guard: Ditolak jika masih ada permohonan PENDING
  const spamReqAttempt = await api("POST", "/api/lead-requests", {
    token: marketingToken,
    body: { requested_count: 3, notes: "Permintaan kedua berturut-turut" }
  });
  assert.equal(spamReqAttempt.status, 400, "Permohonan kedua saat status masih PENDING wajib DITOLAK (400)");

  // - Opsi A: Admin Cabang & Sales Manager DILARANG (403) menyetujui permohonan data
  const branchApproveAttempt = await api("POST", `/api/lead-requests/${createdReqId}/approve`, {
    token: adminBranchToken
  });
  assert.equal(branchApproveAttempt.status, 403, "Admin Cabang wajib DITOLAK (403) menyetujui data (Opsi A)");

  const mgrApproveAttempt = await api("POST", `/api/lead-requests/${createdReqId}/approve`, {
    token: managerToken
  });
  assert.equal(mgrApproveAttempt.status, 403, "Sales Manager wajib DITOLAK (403) menyetujui data (Opsi A)");

  // - Admin Operasional menyetujui dan mengalokasikan data (Auto FIFO)
  const opsApproveRes = await api("POST", `/api/lead-requests/${createdReqId}/approve`, {
    token: adminOpsToken,
    body: { admin_notes: "Disetujui 5 data untuk kanvasing" }
  });
  assert.equal(opsApproveRes.status, 200, "Admin Operasional harus berhasil menyetujui permohonan data");
  assert.equal(opsApproveRes.data.request.status, "APPROVED");
  assert.ok(opsApproveRes.data.allocated_count > 0, "Minimal harus ada data yang dialokasikan");
  assert.ok(opsApproveRes.data.allocated_count <= 5, "Jumlah alokasi tidak boleh melebihi 5 data");

  // - Verifikasi Seluruh Leads yang Dialokasikan Berasal dari Cabang BANDUNG (Anti-Cross-Branch Leak)
  const mktFreshLeads = await api("GET", "/api/leads", { token: marketingToken });
  assert.equal(mktFreshLeads.status, 200);
  for (const lead of mktFreshLeads.data.items) {
    assert.equal(lead.branch, "BANDUNG", `Lead ${lead.id} harus berasal dari Cabang BANDUNG, bukan cabang lain`);
  }

  // - Cadence Harian: Jika sudah disetujui pada hari yang sama, permintaan baru ditolak sampai hari berganti
  const sameDayReqAttempt = await api("POST", "/api/lead-requests", {
    token: marketingToken,
    body: { requested_count: 5, notes: "Minta lagi di hari yang sama" }
  });
  assert.equal(sameDayReqAttempt.status, 400, "Permintaan kedua pada hari yang sama wajib DITOLAK (400)");
  assert.match(sameDayReqAttempt.data.detail, /besok hari/i);

  console.log("  ✓ PASS: Otorisasi Role, Cabang, Bank-Scope (Aturan Owner) & anti-mass-assignment terverifikasi.");

  // --------------------------------------------------------------------------
  // 4. BUSINESS RULES & TRANSACTIONAL INTEGRITY
  // --------------------------------------------------------------------------
  console.log("\n[4/5] Verifikasi Aturan Bisnis & Integritas Transaksional...");

  // 4a. Reject negative numbers in calculator, simulations, and lead updates
  const negCalc = await api("POST", "/api/calc/preview", {
    token: marketingToken,
    body: { bank_key: "ams2", salary: -5000000, requested_plafond: 50000000, requested_tenor: 36 }
  });
  assert.equal(negCalc.status, 400, "Gaji negatif pada kalkulator harus ditolak (400)");

  const negLeadSalary = await api("PATCH", `/api/leads/${ownLead.id}`, {
    token: marketingToken,
    body: { pension_salary: -100000 }
  });
  assert.equal(negLeadSalary.status, 400, "Gaji negatif pada update lead harus ditolak (400)");

  // 4b. Simulation with overall_ok=false MUST be blocked from approval
  const invalidSimRes = await api("POST", "/api/simulations", {
    token: marketingToken,
    body: {
      bank_key: "ams2",
      name: "NASABAH TIDAK LAYAK USIA 85",
      birth_date: "1940-01-01",
      salary: 3000000,
      plafond: 250000000,
      tenor: 60
    }
  });
  assert.equal(invalidSimRes.status, 200);
  assert.equal(invalidSimRes.data.result.overall_ok, false, "Simulasi harus berstatus overall_ok = false");

  const appsBeforeInvalid = (await api("GET", "/api/applications", { token: superToken })).data.total;
  const approveInvalidRes = await api("POST", `/api/simulations/${invalidSimRes.data.id}/approve`, {
    token: marketingToken
  });
  assert.equal(approveInvalidRes.status, 400, "Simulasi overall_ok=false wajib ditolak saat approve (400)");
  const appsAfterInvalid = (await api("GET", "/api/applications", { token: superToken })).data.total;
  assert.equal(appsAfterInvalid, appsBeforeInvalid, "Jumlah aplikasi tidak boleh berubah jika approve ditolak");

  // 4c. Marketing CAN submit their own valid simulation (overall_ok=true), and duplicate submit is blocked (409)
  const validSimRes = await api("POST", "/api/simulations", {
    token: marketingToken,
    body: pp10FixtureInput
  });
  assert.equal(validSimRes.status, 200);
  assert.equal(validSimRes.data.result.overall_ok, true);

  // Other marketing (tempToken) cannot approve or PDF-download marketingToken's simulation
  const otherMktApprove = await api("POST", `/api/simulations/${validSimRes.data.id}/approve`, {
    token: tempToken
  });
  assert.equal(otherMktApprove.status, 403, "Marketing lain tidak boleh approve simulasi bukan miliknya (403)");

  const otherMktPdf = await api("GET", `/api/simulations/${validSimRes.data.id}/pdf`, {
    token: tempToken
  });
  assert.equal(otherMktPdf.status, 403, "Marketing lain tidak boleh unduh PDF simulasi bukan miliknya (403)");

  // Owner marketing approves valid simulation -> 200 OK
  const approveValidRes = await api("POST", `/api/simulations/${validSimRes.data.id}/approve`, {
    token: marketingToken
  });
  assert.equal(approveValidRes.status, 200, "Marketing pemilik simulasi valid harus berhasil approve (200)");
  const createdApp = approveValidRes.data;

  // Duplicate approval of same simulation -> 409 Conflict
  const dupApproveRes = await api("POST", `/api/simulations/${validSimRes.data.id}/approve`, {
    token: marketingToken
  });
  assert.equal(dupApproveRes.status, 409, "Approve ganda pada simulasi yang sama harus ditolak (409)");

  // 4d. Application workflow & Claims lifecycle rules
  // Claim before booking_live -> 400 Bad Request
  const prematureClaim = await api("POST", "/api/claims", {
    token: marketingToken,
    body: { application_id: createdApp.id }
  });
  assert.equal(prematureClaim.status, 400, "Klaim sebelum tahap booking_live harus ditolak (400)");

  // Marketing cannot forward/advance application to bank stages -> 403 Forbidden
  const mktAdvanceAttempt = await api("POST", `/api/applications/${createdApp.id}/action`, {
    token: marketingToken,
    body: { action: "forward" }
  });
  assert.equal(mktAdvanceAttempt.status, 403, "Marketing tidak boleh memajukan tahapan verifikasi bank (403)");

  // P1 Document Checklist & Stage Guard Verification:
  // 1. Submit sebelum seluruh dokumen diunggah -> wajib 400
  const prematureSubmit = await api("POST", `/api/applications/${createdApp.id}/action`, {
    token: marketingToken,
    body: { action: "submit" }
  });
  assert.equal(prematureSubmit.status, 400, "Submit pengajuan sebelum seluruh dokumen diunggah wajib ditolak (400)");

  // 2. Forward sebelum seluruh dokumen disetujui (diterima) -> wajib 400
  const prematureForward = await api("POST", `/api/applications/${createdApp.id}/action`, {
    token: adminOpsToken,
    body: { action: "forward", ref_no: "REF-BSI-001" }
  });
  assert.equal(prematureForward.status, 400, "Forward pengajuan sebelum dokumen diverifikasi & diterima wajib ditolak (400)");

  // 3. Review diterima pada dokumen yang belum diunggah -> wajib 400
  const badReviewEmpty = await api("POST", `/api/applications/${createdApp.id}/documents/ktp_pasangan/review`, {
    token: adminOpsToken,
    body: { status: "diterima" }
  });
  assert.equal(badReviewEmpty.status, 400, "Review diterima pada dokumen kosong wajib ditolak (400)");

  // 4. Unduh dokumen yang belum diunggah -> wajib 404
  const downloadEmptyDoc = await api("GET", `/api/applications/${createdApp.id}/documents/ktp_pasangan`, {
    token: adminOpsToken
  });
  assert.equal(downloadEmptyDoc.status, 404, "Unduh dokumen yang belum diunggah wajib menghasilkan 404");

  // 5. Unggah seluruh 8 dokumen persyaratan (PDF valid)
  const validAppPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
  for (const docItem of createdApp.checklist) {
    const docForm = new FormData();
    docForm.append("file", new Blob([validAppPdfBytes], { type: "application/pdf" }), `${docItem.key}.pdf`);
    const upDocRes = await api("POST", `/api/applications/${createdApp.id}/documents/${docItem.key}`, {
      token: marketingToken,
      body: docForm,
      isForm: true
    });
    assert.equal(upDocRes.status, 200, `Unggah ${docItem.key} harus 200`);

    // Review per-berkas: status diterima wajib 200 (P1 Fix)
    const revDocRes = await api("POST", `/api/applications/${createdApp.id}/documents/${docItem.key}/review`, {
      token: adminOpsToken,
      body: { status: "diterima" }
    });
    assert.equal(revDocRes.status, 200, `Review dokumen ${docItem.key} status diterima wajib berhasil (200)`);
    assert.equal(revDocRes.data.status, "diterima");
  }

  // Admin Ops advances application through stages to booking_live
  const okForward = await api("POST", `/api/applications/${createdApp.id}/action`, {
    token: adminOpsToken,
    body: { action: "forward", ref_no: "REF-BSI-001" }
  });
  assert.equal(okForward.status, 200, "Forward setelah seluruh dokumen diterima harus berhasil (200)");
  // Stages: 2=verifikasi_bank -> 3=approval_komite -> 4=akad_kredit -> 5=pencairan_dana -> 6=booking_live
  for (let s = 0; s < 3; s++) {
    const adv = await api("POST", `/api/applications/${createdApp.id}/action`, {
      token: adminOpsToken,
      body: { action: "advance" }
    });
    assert.equal(adv.status, 200);
  }
  // Advancing to booking_live without booking_date/credit_no -> 400 Bad Request
  const badBookingLive = await api("POST", `/api/applications/${createdApp.id}/action`, {
    token: adminOpsToken,
    body: { action: "advance" }
  });
  assert.equal(badBookingLive.status, 400, "Booking/Live tanpa tanggal & nomor kredit harus ditolak (400)");

  // Advancing to booking_live with booking_date & credit_no -> 200 OK
  const okBookingLive = await api("POST", `/api/applications/${createdApp.id}/action`, {
    token: adminOpsToken,
    body: { action: "advance", booking_date: "2026-11-10", credit_no: "CRD-BSI-2026-0099" }
  });
  assert.equal(okBookingLive.status, 200);
  assert.equal(okBookingLive.data.stage, "booking_live");

  // Marketing attempting to create claim with custom amount -> 403 Forbidden
  const mktCustomAmtClaim = await api("POST", "/api/claims", {
    token: marketingToken,
    body: { application_id: createdApp.id, amount: 99000000 }
  });
  assert.equal(mktCustomAmtClaim.status, 403, "Marketing tidak boleh menentukan nominal klaim sendiri (403)");

  // Marketing creates valid claim on booking_live application -> 200 OK
  const validClaimRes = await api("POST", "/api/claims", {
    token: marketingToken,
    body: { application_id: createdApp.id, notes: "Klaim resmi pencairan BSI" }
  });
  assert.equal(validClaimRes.status, 200);
  const claimId = validClaimRes.data.id;
  const defaultClaimAmount = validClaimRes.data.amount;

  // Duplicate claim on the same application -> 409 Conflict
  const dupClaimRes = await api("POST", "/api/claims", {
    token: marketingToken,
    body: { application_id: createdApp.id }
  });
  assert.equal(dupClaimRes.status, 409, "Klaim ganda pada aplikasi yang sama harus ditolak (409)");

  // Super Admin can reject DRAFT claim with note (without note -> 400)
  const rejNoNote = await api("POST", `/api/claims/${claimId}/action`, {
    token: superToken,
    body: { action: "reject" }
  });
  assert.equal(rejNoNote.status, 400, "Penolakan klaim DRAFT tanpa catatan wajib ditolak (400)");

  // Rejection with note from DRAFT succeeds -> 200 OK
  const rejWithNote = await api("POST", `/api/claims/${claimId}/action`, {
    token: superToken,
    body: { action: "reject", note: "Dokumen bukti belum lengkap" }
  });
  assert.equal(rejWithNote.status, 200, "Super Admin harus dapat menolak klaim DRAFT dengan catatan");
  assert.equal(rejWithNote.data.status, "REJECTED");

  // Since previous claim was REJECTED, marketing can create a new active claim on the application
  const activeClaimRes = await api("POST", "/api/claims", {
    token: marketingToken,
    body: { application_id: createdApp.id, notes: "Klaim pengganti dokumen lengkap" }
  });
  assert.equal(activeClaimRes.status, 200);
  const activeClaimId = activeClaimRes.data.id;

  // Super Admin can directly approve a DRAFT claim
  // But let's first test Marketing submit (DRAFT -> SUBMITTED) -> 200 OK
  const submitClaimRes = await api("POST", `/api/claims/${activeClaimId}/action`, {
    token: marketingToken,
    body: { action: "submit" }
  });
  assert.equal(submitClaimRes.status, 200);
  assert.equal(submitClaimRes.data.status, "SUBMITTED");

  // Marketing attempting to approve claim or alter amount -> 403 Forbidden, state unchanged
  const mktApproveClaim = await api("POST", `/api/claims/${activeClaimId}/action`, {
    token: marketingToken,
    body: { action: "approve", amount: 50000000 }
  });
  assert.equal(mktApproveClaim.status, 403, "Marketing tidak boleh menyetujui klaim atau mengubah nominal (403)");

  // Sales Manager / Admin Branch attempting to approve claim -> 403 Forbidden
  const branchApproveClaim = await api("POST", `/api/claims/${activeClaimId}/action`, {
    token: adminBranchToken,
    body: { action: "approve" }
  });
  assert.equal(branchApproveClaim.status, 403, "Admin Cabang tidak boleh menyetujui klaim (hanya Admin Ops / Super Admin)");

  // Payment before APPROVED status -> 400 Bad Request
  const payBeforeApprove = await api("POST", `/api/claims/${activeClaimId}/pay`, {
    token: adminOpsToken,
    body: { note: "Bayar sebelum approve" }
  });
  assert.equal(payBeforeApprove.status, 400, "Pembayaran klaim sebelum APPROVED harus ditolak (400)");

  // Admin Ops attempting negative amount -> 400 Bad Request
  const negClaimAmt = await api("POST", `/api/claims/${activeClaimId}/action`, {
    token: adminOpsToken,
    body: { action: "approve", amount: -500000 }
  });
  assert.equal(negClaimAmt.status, 400, "Nominal klaim negatif harus ditolak (400)");

  // Verify claim status and amount are STILL unchanged ("SUBMITTED" & defaultClaimAmount)
  const checkClaimsList = await api("GET", "/api/claims", { token: adminOpsToken });
  const unchangedClaim = checkClaimsList.data.items.find((c) => c.id === activeClaimId);
  assert.equal(unchangedClaim.status, "SUBMITTED", "Status klaim harus tetap SUBMITTED setelah request gagal");
  assert.equal(unchangedClaim.amount, defaultClaimAmount, "Nominal klaim harus tetap utuh setelah request gagal");

  // Admin Ops approves claim -> directly sets status to PAID (disetujui & lunas) -> 200 OK
  const okApproveClaim = await api("POST", `/api/claims/${activeClaimId}/action`, {
    token: adminOpsToken,
    body: { action: "approve", note: "Disetujui & Dibayarkan Admin Operasional" }
  });
  assert.equal(okApproveClaim.status, 200);
  assert.equal(okApproveClaim.data.status, "PAID");
  assert.ok(okApproveClaim.data.paid_at, "paid_at harus terisi saat klaim disetujui/PAID");
  assert.equal(okApproveClaim.data.paid_by, "RINA KARTIKA SARI", "paid_by harus mencatat user yang menyetujui");

  // Attempting to approve or pay already PAID claim -> 400/409 rejected
  const dupApproveClaim = await api("POST", `/api/claims/${activeClaimId}/action`, {
    token: adminOpsToken,
    body: { action: "approve", note: "Approve ulang" }
  });
  assert.equal(dupApproveClaim.status, 400, "Persetujuan ulang pada klaim yang sudah PAID harus ditolak (400)");

  const formDup = new FormData();
  formDup.append("file", new Blob(["%PDF-1.4 Bukti Transfer"], { type: "application/pdf" }), "bukti_transfer.pdf");
  const dupPayClaim = await api("POST", `/api/claims/${activeClaimId}/pay`, {
    token: adminOpsToken,
    body: formDup,
    isForm: true
  });
  assert.equal(dupPayClaim.status, 409, "Pembayaran ulang pada klaim yang sudah PAID harus ditolak (409)");

  // 4e. Upload Security: Reject active formats (HTML/scripts/SVG) & signature sniffing & secure serving (P1 fix)
  // Attempt to upload HTML file disguised as document
  const formHtml = new FormData();
  formHtml.append(
    "file",
    new Blob(["<html><head><script>alert('xss')</script></head><body>evil</body></html>"], { type: "text/html" }),
    "document.html"
  );
  const rejectHtmlUpload = await api("POST", `/api/leads/${ownLead.id}/documents`, {
    token: marketingToken,
    body: formHtml,
    isForm: true
  });
  assert.equal(rejectHtmlUpload.status, 400, "Unggah file HTML harus DITOLAK (400)");
  assert.match(rejectHtmlUpload.data.detail, /hanya file.*pdf.*jpg.*png/i);

  // Attempt to upload HTML disguised with .pdf extension and application/pdf MIME
  const formSpoofed = new FormData();
  formSpoofed.append(
    "file",
    new Blob(["<html><body>dummy content without pdf header</body></html>"], { type: "application/pdf" }),
    "fake.pdf"
  );
  const rejectSpoofedUpload = await api("POST", `/api/leads/${ownLead.id}/documents`, {
    token: marketingToken,
    body: formSpoofed,
    isForm: true
  });
  assert.equal(rejectSpoofedUpload.status, 400, "File bukan PDF asli (magic bytes mismatch) harus DITOLAK (400)");

  // Upload authentic PDF
  const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xd0, 0xd4, 0xc5, 0xd8, 0x0a]);
  const formPdf = new FormData();
  formPdf.append("file", new Blob([validPdfBytes], { type: "application/pdf" }), "ktp_asli.pdf");
  const uploadPdfRes = await api("POST", `/api/leads/${ownLead.id}/documents?category=KTP`, {
    token: marketingToken,
    body: formPdf,
    isForm: true
  });
  assert.equal(uploadPdfRes.status, 200, "Unggah PDF asli harus berhasil (200)");
  const uploadedDocId = uploadPdfRes.data.id;

  // Download uploaded document: check security headers (X-Content-Type-Options: nosniff, CSP sandbox)
  const downloadDocRes = await api("GET", `/api/documents/${uploadedDocId}/download`, { token: marketingToken });
  assert.equal(downloadDocRes.status, 200);
  assert.equal(downloadDocRes.headers.get("x-content-type-options"), "nosniff", "Header nosniff wajib ada");
  assert.match(downloadDocRes.headers.get("content-security-policy") || "", /sandbox/, "CSP sandbox wajib ada");
  assert.notEqual(downloadDocRes.headers.get("content-type"), "text/html", "Content-Type tidak boleh text/html");

  // Missing claim payment file returns 404 (Probe regression fix)
  const missingClaimFileRes = await api("GET", "/api/claims/clm-4002/file/payment", { token: superToken });
  assert.equal(missingClaimFileRes.status, 404, "Berkas pembayaran yang belum diunggah harus menghasilkan 404 Not Found");

  // Full backup verification: backup includes _uploaded_files
  const checkBackupRes = await api("GET", "/api/backup", { token: superToken });
  assert.equal(checkBackupRes.status, 200);
  assert.ok(Array.isArray(checkBackupRes.data._uploaded_files), "Backup harus menyertakan array _uploaded_files");

  console.log("  ✓ PASS: Seluruh aturan bisnis & integritas transaksional terverifikasi.");
} finally {
  // --------------------------------------------------------------------------
  // 5. RESTORE INITIAL DATABASE STATE SO DEMO DATA REMAINS CLEAN
  // --------------------------------------------------------------------------
  console.log("\n[5/5] Memulihkan snapshot database awal agar data kerja tetap bersih...");
  const restoreForm = new FormData();
  restoreForm.append(
    "file",
    new Blob([JSON.stringify(initialStoreSnapshot)], { type: "application/json" }),
    "restore.json"
  );
  const restoreRes = await api("POST", "/api/backup/restore", {
    token: superToken,
    body: restoreForm,
    isForm: true
  });
  assert.equal(restoreRes.status, 200);
  console.log("  ✓ PASS: State database berhasil dipulihkan.");
}

console.log("\n=================================================================");
console.log("ALL SECURITY, RBAC, BUSINESS RULE & REGRESSION TESTS PASSED (100%)");
console.log("=================================================================");
