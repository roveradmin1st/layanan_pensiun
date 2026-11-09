import test from "node:test";
import assert from "node:assert/strict";
import { disposableBackend, runFixture, startFixture } from "./helpers/disposable.mjs";

const PASSWORD = "Fixture-only-Password-2026!";

test("Multi-Sales Manager Isolation & Admin Ops/Branch Synchronization Suite", { timeout: 90000 }, async (t) => {
  const fixture = disposableBackend();
  let running;
  try {
    const setupResult = runFixture(
      fixture,
      `import { getStore, saveStore, db, DOC_TEMPLATE } from "./src/db/database.js";
import { hashPassword } from "./src/security/passwords.js";

const state = getStore();
const encoded = await hashPassword(${JSON.stringify(PASSWORD)});
const user = (id, name, role, extra = {}) => ({
  id,
  name,
  email: id + "@example.test",
  role,
  branch: "PEMATANGSIANTAR",
  bank_scope: "all_bank",
  active: true,
  password_hash: encoded,
  auth_version: 1,
  must_change_password: false,
  ...extra
});

state.users = [
  user("super", "Super Admin", "super_admin", { branch: "PUSAT JAKARTA" }),
  user("ops", "Admin Operasional", "admin_ops", { branch: "PUSAT JAKARTA" }),
  user("branch-admin", "Admin Cabang Siantar", "admin_branch"),
  user("branch-bsi", "Admin Cabang BSI Siantar", "admin_branch", { bank_scope: "bsi_only" }),
  user("branch-medan", "Admin Cabang Medan", "admin_branch", { branch: "MEDAN" }),
  user("sm-1", "SM Satu Siantar", "sales_manager"),
  user("sm-2", "SM Dua Siantar", "sales_manager"),
  user("sm-bsi", "SM BSI Siantar", "sales_manager", { bank_scope: "bsi_only" }),
  user("sm-empty", "SM Tiga Tanpa Tim", "sales_manager"),
  user("mkt-1", "Marketing Tim SM1", "marketing", { manager_id: "sm-1", manager_name: "SM Satu Siantar" }),
  user("mkt-2", "Marketing Tim SM2", "marketing", { manager_id: "sm-2", manager_name: "SM Dua Siantar" }),
  user("mkt-bsi", "Marketing Tim SM BSI", "marketing", { bank_scope: "bsi_only", manager_id: "sm-bsi", manager_name: "SM BSI Siantar" }),
  user("jakarta-mkt", "Marketing Jakarta", "marketing", { branch: "PUSAT JAKARTA" })
];

for (const key of ["leads", "lead_requests", "applications", "simulations", "claims", "imports", "audit_logs", "parameter_proposals"]) {
  state[key] = [];
}

const now = new Date().toISOString();
state.leads = [
  {
    id: "lead-sm1",
    name: "Nasabah Tim SM 1",
    nopen: "1111111111",
    phone: "081111111111",
    city: "Pematangsiantar",
    branch: "PEMATANGSIANTAR",
    pension_salary: 4000000,
    status: "berhasil",
    assigned_to: "mkt-1",
    assigned_name: "Marketing Tim SM1",
    sales_manager_id: "sm-1",
    sales_manager_name: "SM Satu Siantar",
    created_at: now,
    updated_at: now
  },
  {
    id: "lead-sm2",
    name: "Nasabah Tim SM 2",
    nopen: "2222222222",
    phone: "082222222222",
    city: "Pematangsiantar",
    branch: "PEMATANGSIANTAR",
    pension_salary: 4500000,
    status: "berhasil",
    assigned_to: "mkt-2",
    assigned_name: "Marketing Tim SM2",
    sales_manager_id: "sm-2",
    sales_manager_name: "SM Dua Siantar",
    created_at: now,
    updated_at: now
  },
  {
    id: "lead-pool-1",
    name: "Nasabah Pool Netral",
    nopen: "3333333333",
    phone: "083333333333",
    city: "Pematangsiantar",
    branch: "PEMATANGSIANTAR",
    pension_salary: 3800000,
    status: "baru",
    assigned_to: null,
    assigned_name: null,
    sales_manager_id: null,
    sales_manager_name: null,
    created_at: now,
    updated_at: now
  },
  {
    id: "lead-sm2-queue",
    name: "Nasabah Antrean SM 2",
    nopen: "4444444444",
    phone: "084444444444",
    city: "Pematangsiantar",
    branch: "PEMATANGSIANTAR",
    pension_salary: 3900000,
    status: "baru",
    assigned_to: null,
    assigned_name: null,
    sales_manager_id: "sm-2",
    sales_manager_name: "SM Dua Siantar",
    created_at: now,
    updated_at: now
  },
  {
    id: "lead-medan",
    name: "Nasabah Medan",
    nopen: "5555555555",
    phone: "085555555555",
    city: "Medan",
    branch: "MEDAN",
    pension_salary: 4100000,
    status: "baru",
    assigned_to: null,
    assigned_name: null,
    sales_manager_id: null,
    sales_manager_name: null,
    created_at: now,
    updated_at: now
  }
];

state.simulations = [
  {
    id: "sim-sm1",
    sim_no: "SIM-SM1-001",
    lead_id: "lead-sm1",
    lead_name: "Nasabah Tim SM 1",
    branch: "PEMATANGSIANTAR",
    created_by: "mkt-1",
    marketing_id: "mkt-1",
    user_name: "Marketing Tim SM1",
    sales_manager_id: "sm-1",
    sales_manager_name: "SM Satu Siantar",
    selected_bank_key: "ams2",
    input: { plafond: 100000000, tenor: 60 },
    results: [{ key: "ams2", name: "KSP AMS2", eligible: true }],
    created_at: now
  },
  {
    id: "sim-sm2",
    sim_no: "SIM-SM2-001",
    lead_id: "lead-sm2",
    lead_name: "Nasabah Tim SM 2",
    branch: "PEMATANGSIANTAR",
    created_by: "mkt-2",
    marketing_id: "mkt-2",
    user_name: "Marketing Tim SM2",
    sales_manager_id: "sm-2",
    sales_manager_name: "SM Dua Siantar",
    selected_bank_key: "ams2",
    input: { plafond: 200000000, tenor: 60 },
    results: [{ key: "ams2", name: "KSP AMS2", eligible: true }],
    created_at: now
  }
];

state.applications = [
  {
    id: "app-sm1",
    app_no: "APP-SM1-001",
    lead_id: "lead-sm1",
    lead_name: "Nasabah Tim SM 1",
    sim_id: "sim-sm1",
    bank_key: "ams2",
    bank_name: "KSP AMS2",
    plafond: 100000000,
    tenor: 60,
    marketing_id: "mkt-1",
    marketing_name: "Marketing Tim SM1",
    sales_manager_id: "sm-1",
    sales_manager_name: "SM Satu Siantar",
    branch: "PEMATANGSIANTAR",
    stage: "booking_live",
    stage_index: 6,
    rejected: false,
    booking: { date: now.slice(0, 10), credit_no: "CR-SM1", confirmed_by: "Admin Operasional" },
    checklist: DOC_TEMPLATE.map((d) => ({ ...d, status: "diterima", versions: 1, filename: "doc.pdf" })),
    history: [],
    created_at: now
  },
  {
    id: "app-sm2",
    app_no: "APP-SM2-001",
    lead_id: "lead-sm2",
    lead_name: "Nasabah Tim SM 2",
    sim_id: "sim-sm2",
    bank_key: "ams2",
    bank_name: "KSP AMS2",
    plafond: 200000000,
    tenor: 60,
    marketing_id: "mkt-2",
    marketing_name: "Marketing Tim SM2",
    sales_manager_id: "sm-2",
    sales_manager_name: "SM Dua Siantar",
    branch: "PEMATANGSIANTAR",
    stage: "booking_live",
    stage_index: 6,
    rejected: false,
    booking: { date: now.slice(0, 10), credit_no: "CR-SM2", confirmed_by: "Admin Operasional" },
    checklist: DOC_TEMPLATE.map((d) => ({ ...d, status: "diterima", versions: 1, filename: "doc.pdf" })),
    history: [],
    created_at: now
  }
];

state.claims = [
  {
    id: "claim-sm1",
    claim_no: "CLM-SM1-001",
    application_id: "app-sm1",
    app_no: "APP-SM1-001",
    lead_name: "Nasabah Tim SM 1",
    bank_key: "ams2",
    bank_name: "KSP AMS2",
    marketing_id: "mkt-1",
    marketing_name: "Marketing Tim SM1",
    sales_manager_id: "sm-1",
    sales_manager_name: "SM Satu Siantar",
    branch: "PEMATANGSIANTAR",
    booking_date: now.slice(0, 10),
    credit_no: "CR-SM1",
    amount: 2000000,
    amount_fixed: true,
    status: "PAID",
    paid_at: now,
    history: [],
    created_at: now
  },
  {
    id: "claim-sm2",
    claim_no: "CLM-SM2-001",
    application_id: "app-sm2",
    app_no: "APP-SM2-001",
    lead_name: "Nasabah Tim SM 2",
    bank_key: "ams2",
    bank_name: "KSP AMS2",
    marketing_id: "mkt-2",
    marketing_name: "Marketing Tim SM2",
    sales_manager_id: "sm-2",
    sales_manager_name: "SM Dua Siantar",
    branch: "PEMATANGSIANTAR",
    booking_date: now.slice(0, 10),
    credit_no: "CR-SM2",
    amount: 4000000,
    amount_fixed: true,
    status: "PAID",
    paid_at: now,
    history: [],
    created_at: now
  }
];

saveStore();
db.close();`
    );
    assert.equal(setupResult.status, 0, setupResult.stderr);

    running = await startFixture(fixture, "production");

    const call = async (method, route, body, token) => {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
      const response = await fetch(running.base + route, {
        method,
        headers,
        body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined
      });
      const data = response.headers.get("content-type")?.includes("json")
        ? await response.json()
        : Buffer.from(await response.arrayBuffer());
      return { status: response.status, headers: response.headers, data };
    };

    const login = async (id, password = PASSWORD) => {
      const res = await call("POST", "/api/auth/login", { email: `${id}@example.test`, password });
      assert.equal(res.status, 200, res.data?.detail);
      return res.data.access_token;
    };

    const opsToken = await login("ops");
    const branchAdminToken = await login("branch-admin");
    const branchBsiToken = await login("branch-bsi");
    const branchMedanToken = await login("branch-medan");
    const sm1Token = await login("sm-1");
    const sm2Token = await login("sm-2");
    const smBsiToken = await login("sm-bsi");
    const smEmptyToken = await login("sm-empty");
    const mkt1Token = await login("mkt-1");
    const mktBsiToken = await login("mkt-bsi");
    const jakartaMktToken = await login("jakarta-mkt");

    await t.test("1. Non-central user in PUSAT JAKARTA does NOT escalate to national branch scope", async () => {
      const res = await call("GET", "/api/leads", null, jakartaMktToken);
      assert.equal(res.status, 200);
      assert.equal(res.data.total, 0, "Marketing di PUSAT JAKARTA tidak boleh melihat leads cabang lain");
      assert.equal((await call("GET", "/api/leads/lead-medan", null, jakartaMktToken)).status, 403);
    });

    await t.test("2. Dashboard Sales Manager strictly isolates team achievement & hides corporate 4% gross fee / net profit", async () => {
      const dSm1 = (await call("GET", "/api/dashboard", null, sm1Token)).data;
      const dSm2 = (await call("GET", "/api/dashboard", null, sm2Token)).data;
      const dBranch = (await call("GET", "/api/dashboard", null, branchAdminToken)).data;
      const dOps = (await call("GET", "/api/dashboard", null, opsToken)).data;

      // SM1 only sees M1 (Rp 100jt booking, Rp 2jt incentive), never M2 (Rp 200jt booking)
      assert.equal(dSm1.financials.total_booking_volume, 100000000);
      assert.equal(dSm1.financials.total_paid_incentives, 2000000);
      assert.equal(dSm1.financials.est_gross_revenue, null);
      assert.equal(dSm1.financials.net_company_profit, null);
      assert.deepEqual(dSm1.marketing_leaderboard.map((m) => m.id), ["mkt-1"]);
      assert.equal(dSm1.marketing_leaderboard[0].simulasi, 1);

      // SM2 only sees M2 (Rp 200jt booking, Rp 4jt incentive), never M1
      assert.equal(dSm2.financials.total_booking_volume, 200000000);
      assert.equal(dSm2.financials.total_paid_incentives, 4000000);
      assert.equal(dSm2.financials.est_gross_revenue, null);
      assert.equal(dSm2.financials.net_company_profit, null);
      assert.deepEqual(dSm2.marketing_leaderboard.map((m) => m.id), ["mkt-2"]);
      assert.equal(dSm2.marketing_leaderboard[0].simulasi, 1);

      // Admin Branch sees combined branch (Rp 300jt) with SM names on leaderboard, but no corporate profit
      assert.equal(dBranch.financials.total_booking_volume, 300000000);
      assert.equal(dBranch.financials.est_gross_revenue, null);
      assert.equal(dBranch.financials.net_company_profit, null);
      assert.equal(dBranch.marketing_leaderboard.length, 3);
      assert.ok(dBranch.marketing_leaderboard.every((m) => m.manager_name));

      // Admin Ops sees corporate gross revenue & net profit
      assert.equal(dOps.financials.total_booking_volume, 300000000);
      assert.equal(dOps.financials.est_gross_revenue, 12000000);
      assert.equal(dOps.financials.net_company_profit, 6000000);
    });

    await t.test("3. Horizontal isolation between SM1 and SM2 across Leads, Simulations, Applications, Claims, and Users", async () => {
      // Leads list & detail
      const sm1Leads = (await call("GET", "/api/leads", null, sm1Token)).data.items;
      assert.ok(sm1Leads.some((l) => l.id === "lead-sm1"));
      assert.ok(!sm1Leads.some((l) => l.id === "lead-sm2"), "SM1 tidak boleh melihat lead milik tim SM2");
      assert.ok(!sm1Leads.some((l) => l.id === "lead-sm2-queue"), "SM1 tidak boleh melihat antrean SM2");
      assert.equal((await call("GET", "/api/leads/lead-sm2", null, sm1Token)).status, 403);
      assert.equal((await call("GET", "/api/leads/lead-sm2-queue", null, sm1Token)).status, 403);

      // Cross-SM assignment blocked
      assert.equal(
        (await call("POST", "/api/leads/assign", { lead_ids: ["lead-sm1"], user_id: "mkt-2" }, sm1Token)).status,
        403
      );
      assert.equal(
        (await call("PATCH", "/api/leads/lead-sm1", { assigned_to: "mkt-2" }, sm1Token)).status,
        403
      );
      assert.equal(
        (await call("POST", "/api/leads", { name: "Test Cross", phone: "08999999911", assigned_to: "mkt-2" }, sm1Token)).status,
        403
      );

      // Simulations, Applications, Claims detail isolation
      assert.equal((await call("GET", "/api/simulations/sim-sm1", null, sm1Token)).status, 200);
      assert.equal((await call("GET", "/api/simulations/sim-sm2", null, sm1Token)).status, 403);
      assert.equal((await call("GET", "/api/applications/app-sm1", null, sm1Token)).status, 200);
      assert.equal((await call("GET", "/api/applications/app-sm2", null, sm1Token)).status, 403);
      assert.equal((await call("GET", "/api/claims/claim-sm1", null, sm1Token)).status, 200);
      assert.equal((await call("GET", "/api/claims/claim-sm2", null, sm1Token)).status, 403);

      // Users list & PATCH isolation
      const sm1Users = (await call("GET", "/api/users", null, sm1Token)).data;
      assert.ok(sm1Users.some((u) => u.id === "sm-1"));
      assert.ok(sm1Users.some((u) => u.id === "mkt-1"));
      assert.ok(!sm1Users.some((u) => u.id === "sm-2"), "SM1 tidak boleh melihat akun SM2");
      assert.ok(!sm1Users.some((u) => u.id === "mkt-2"), "SM1 tidak boleh melihat akun Marketing tim SM2");
      assert.equal((await call("GET", "/api/users/mkt-2", null, sm1Token)).status, 403);
      assert.equal((await call("PATCH", "/api/users/mkt-2", { phone: "080000" }, sm1Token)).status, 403);
      assert.equal((await call("PATCH", "/api/users/mkt-1", { manager_id: "sm-2" }, sm1Token)).status, 403);
    });

    await t.test("4. Zero-miscommunication sync: Admin Queue Assign, Lead Request Protection, Multi-SM Import, and Team Transfer Cascade", async () => {
      // 4a. Admin Ops Approving M1's Lead Request takes neutral pool lead (lead-pool-1), NEVER SM2's queue (lead-sm2-queue)
      const reqCreate = await call(
        "POST",
        "/api/lead-requests",
        { requested_count: 1, target_segment: "all", target_bank: "all", notes: "Permintaan harian M1" },
        mkt1Token
      );
      assert.equal(reqCreate.status, 201);

      // SM1 sees M1's request, SM2 does NOT see M1's request
      const sm1Reqs = (await call("GET", "/api/lead-requests", null, sm1Token)).data.items;
      const sm2Reqs = (await call("GET", "/api/lead-requests", null, sm2Token)).data.items;
      assert.equal(sm1Reqs.length, 1);
      assert.equal(sm2Reqs.length, 0);

      // Approve request as Admin Ops
      const approveRes = await call("POST", `/api/lead-requests/${reqCreate.data.id}/approve`, {}, opsToken);
      assert.equal(approveRes.status, 200);
      assert.deepEqual(approveRes.data.request.allocated_lead_ids, ["lead-pool-1"]);

      // Verify lead-pool-1 now has sales_manager_id = sm-1 and lead-sm2-queue is untouched in SM2's queue
      const poolLeadAfter = (await call("GET", "/api/leads/lead-pool-1", null, sm1Token)).data;
      assert.equal(poolLeadAfter.assigned_to, "mkt-1");
      assert.equal(poolLeadAfter.sales_manager_id, "sm-1");
      const sm2QueueLead = (await call("GET", "/api/leads/lead-sm2-queue", null, sm2Token)).data;
      assert.equal(sm2QueueLead.assigned_to, null);
      assert.equal(sm2QueueLead.sales_manager_id, "sm-2");

      // 4b. Admin Branch can assign a lead to SM1's queue ("sm:sm-1")
      const newPoolLead = await call(
        "POST",
        "/api/leads",
        { name: "Nasabah Baru Cabang", phone: "087777777701", city: "Pematangsiantar", pension_salary: 3500000 },
        branchAdminToken
      );
      assert.equal(newPoolLead.status, 200);
      const qAssign = await call(
        "POST",
        "/api/leads/assign",
        { lead_ids: [newPoolLead.data.id], user_id: "sm:sm-1" },
        branchAdminToken
      );
      assert.equal(qAssign.status, 200);
      const queuedLead = (await call("GET", `/api/leads/${newPoolLead.data.id}`, null, sm1Token)).data;
      assert.equal(queuedLead.assigned_to, null);
      assert.equal(queuedLead.sales_manager_id, "sm-1");
      assert.equal((await call("GET", `/api/leads/${newPoolLead.data.id}`, null, sm2Token)).status, 403);

      // 4c. Multi-SM Fair Import in "auto_round_robin" mode distributes across SM1, SM2, and SM-BSI
      const csvContent = [
        "nama,telepon,nopen,kota,cabang,gaji_pensiun",
        "Impor Adil Satu,081299990001,99990001,Pematangsiantar,PEMATANGSIANTAR,4200000",
        "Impor Adil Dua,081299990002,99990002,Pematangsiantar,PEMATANGSIANTAR,4300000",
        "Impor Adil Tiga,081299990004,99990004,Pematangsiantar,PEMATANGSIANTAR,4350000"
      ].join("\n");
      const fd = new FormData();
      fd.append("file", new Blob([csvContent], { type: "text/csv" }), "multi-sm-import.csv");
      fd.append("target_branch", "PEMATANGSIANTAR");
      fd.append("distribution_mode", "auto_round_robin");
      const impRes = await call("POST", "/api/imports", fd, opsToken);
      assert.equal(impRes.status, 200);
      assert.equal(impRes.data.inserted, 3);
      assert.equal(impRes.data.assigned_count, 3);

      // Verify SM1 got 1, SM2 got 1, and SM-BSI got 1
      const sm1AfterImp = (await call("GET", "/api/leads?q=Impor+Adil", null, sm1Token)).data.items;
      const sm2AfterImp = (await call("GET", "/api/leads?q=Impor+Adil", null, sm2Token)).data.items;
      const smBsiAfterImp = (await call("GET", "/api/leads?q=Impor+Adil", null, smBsiToken)).data.items;
      assert.equal(sm1AfterImp.length, 1, "SM1 harus menerima tepat 1 lead dari impor round-robin 3 baris");
      assert.equal(sm2AfterImp.length, 1, "SM2 harus menerima tepat 1 lead dari impor round-robin 3 baris");
      assert.equal(smBsiAfterImp.length, 1, "SM-BSI harus menerima tepat 1 lead dari impor round-robin 3 baris");

      // 4d. SM with 0 marketers (sm-empty) importing puts leads into sm-empty's queue, NEVER leaking to SM1/SM2
      const csvEmptySm = [
        "nama,telepon,nopen,kota,cabang,gaji_pensiun",
        "Impor SM Tiga,081299990003,99990003,Pematangsiantar,PEMATANGSIANTAR,4400000"
      ].join("\n");
      const fdEmpty = new FormData();
      fdEmpty.append("file", new Blob([csvEmptySm], { type: "text/csv" }), "sm-empty.csv");
      fdEmpty.append("distribution_mode", "auto_round_robin");
      const impEmptyRes = await call("POST", "/api/imports", fdEmpty, smEmptyToken);
      assert.equal(impEmptyRes.status, 200);
      assert.equal(impEmptyRes.data.sm_queue_count, 1, "SM tanpa tim harus menempatkan lead di antrean SM-nya sendiri");
      assert.equal(impEmptyRes.data.assigned_count, 0, "Tidak boleh bocor ke marketing SM lain");

      // 4e. Cascading sync when Admin Branch moves mkt-1 from sm-1 to sm-2
      const moveRes = await call("PATCH", "/api/users/mkt-1", { manager_id: "sm-2" }, branchAdminToken);
      assert.equal(moveRes.status, 200);
      assert.equal(moveRes.data.manager_id, "sm-2");
      assert.equal((await call("GET", "/api/applications/app-sm1", null, sm2Token)).status, 200);
      assert.equal((await call("GET", "/api/applications/app-sm1", null, sm1Token)).status, 403);
    });

    await t.test("5. Branch & Bank Scope Boundaries (bsi_only vs all_bank) and Document Upload Stage Lock", async () => {
      // 5a. Admin Cabang BSI (bsi_only) cannot access non-BSI applications (ams2) in the same branch
      assert.equal((await call("GET", "/api/applications/app-sm1", null, branchBsiToken)).status, 403);
      assert.equal((await call("GET", "/api/claims/claim-sm1", null, branchBsiToken)).status, 403);
      const bsiApps = (await call("GET", "/api/applications", null, branchBsiToken)).data;
      assert.equal(bsiApps.items.length, 0, "Admin Cabang bsi_only tidak boleh melihat pengajuan KSP AMS2");

      // 5b. Admin Cabang Medan cannot access Pematangsiantar leads, applications, or users
      assert.equal((await call("GET", "/api/leads/lead-sm1", null, branchMedanToken)).status, 403);
      assert.equal((await call("GET", "/api/applications/app-sm1", null, branchMedanToken)).status, 403);
      assert.equal((await call("PATCH", "/api/users/mkt-1", { phone: "08111" }, branchMedanToken)).status, 403);
      const medanLeads = (await call("GET", "/api/leads", null, branchMedanToken)).data.items;
      assert.deepEqual(medanLeads.map((l) => l.id), ["lead-medan"]);

      // 5c. Marketing bsi_only cannot assign or access non-BSI applications
      assert.equal((await call("GET", "/api/applications/app-sm2", null, mktBsiToken)).status, 403);

      // 5d. Document upload is locked (409) once an application reaches booking_live
      const docFd = new FormData();
      docFd.append("file", new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }), "locked.pdf");
      const uploadAfterDisbursed = await call("POST", "/api/applications/app-sm1/documents/ktp_pasangan", docFd, opsToken);
      assert.equal(uploadAfterDisbursed.status, 409);
    });
  } finally {
    if (running) await running.stop();
    fixture.cleanup();
  }
});
