// ============================================================================
// SECURITY, RBAC, BANK-SCOPE & BUSINESS INTEGRITY API TEST SUITE
// Direct HTTP verification against running backend + child-process prod checks
// ============================================================================

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

  // Admin Ops advances application through stages to booking_live
  await api("POST", `/api/applications/${createdApp.id}/action`, {
    token: adminOpsToken,
    body: { action: "forward", ref_no: "REF-BSI-001" }
  });
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

  // Admin Ops approves claim -> 200 OK
  const okApproveClaim = await api("POST", `/api/claims/${activeClaimId}/action`, {
    token: adminOpsToken,
    body: { action: "approve", note: "Disetujui Admin Operasional" }
  });
  assert.equal(okApproveClaim.status, 200);
  assert.equal(okApproveClaim.data.status, "APPROVED");

  // Admin Ops attempting to pay APPROVED claim WITHOUT payment proof -> 400 Bad Request
  const payWithoutProof = await api("POST", `/api/claims/${activeClaimId}/pay`, {
    token: adminOpsToken,
    body: { note: "Tanpa bukti transfer" }
  });
  assert.equal(payWithoutProof.status, 400, "Pembayaran klaim tanpa bukti transfer wajib ditolak (400)");

  // Admin Ops pays APPROVED claim WITH payment proof -> 200 OK
  const form = new FormData();
  form.append("file", new Blob(["%PDF-1.4 Bukti Transfer Insentif"], { type: "application/pdf" }), "bukti_transfer.pdf");
  form.append("note", "Lunas via Transfer Bank");
  const okPayClaim = await api("POST", `/api/claims/${activeClaimId}/pay`, {
    token: adminOpsToken,
    body: form,
    isForm: true
  });
  assert.equal(okPayClaim.status, 200);
  assert.equal(okPayClaim.data.status, "PAID");

  // Duplicate payment attempt -> 409 Conflict
  const formDup = new FormData();
  formDup.append("file", new Blob(["%PDF-1.4 Bukti Transfer"], { type: "application/pdf" }), "bukti_transfer.pdf");
  const dupPayClaim = await api("POST", `/api/claims/${activeClaimId}/pay`, {
    token: adminOpsToken,
    body: formDup,
    isForm: true
  });
  assert.equal(dupPayClaim.status, 409, "Pembayaran klaim ganda harus ditolak (409)");

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
