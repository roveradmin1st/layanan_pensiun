import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import jwt from "jsonwebtoken";
import { LoginLimiter, normalizeClientIp } from "../src/security/login-limiter.js";
import { PublicLeadLimiter } from "../src/routes/public-leads.js";
import { disposableBackend, runFixture, startFixture } from "./helpers/disposable.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.REPO_ROOT || path.resolve(__dirname, "../..");
const PASSWORD = "Wave3-P1-Fixture-Password-2026!";
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF");
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);

function extractCookie(setCookieHeader, name) {
  if (!setCookieHeader) return "";
  const match = String(setCookieHeader).match(new RegExp(`${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : "";
}

test("Wave 3 P1 Unit: IPv6 /64 subnet normalization prevents rate-limit bypass in LoginLimiter & PublicLeadLimiter", () => {
  assert.equal(normalizeClientIp("::ffff:203.0.113.5"), "203.0.113.5");
  assert.equal(normalizeClientIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), "2001:db8:85a3:0::/64");
  assert.equal(normalizeClientIp("2001:db8:85a3::1"), "2001:db8:85a3:0::/64");
  assert.equal(normalizeClientIp("2001:db8:85a3:0:ffff:ffff:ffff:ffff"), "2001:db8:85a3:0::/64");
  assert.notEqual(normalizeClientIp("2001:db8:85a3:1::1"), "2001:db8:85a3:0::/64");
  assert.equal(normalizeClientIp("::1"), "::1");

  const loginLimiter = new LoginLimiter({ accountLimit: 2, ipLimit: 3, windowMs: 60_000 });
  assert.equal(loginLimiter.reserve("2001:db8:cafe:1::1", "a@test.id").allowed, true);
  assert.equal(loginLimiter.reserve("2001:db8:cafe:1::2", "b@test.id").allowed, true);
  assert.equal(loginLimiter.reserve("2001:db8:cafe:1::3", "c@test.id").allowed, true);
  // 4th attempt from a rotated IPv6 interface ID within the same /64 MUST be blocked
  assert.equal(loginLimiter.reserve("2001:db8:cafe:1::9999", "d@test.id").allowed, false);
  // Different /64 subnet remains unaffected
  assert.equal(loginLimiter.reserve("2001:db8:cafe:2::1", "d@test.id").allowed, true);

  const pubLimiter = new PublicLeadLimiter({ maxRequests: 2, windowMs: 60_000 });
  assert.equal(pubLimiter.consume("2001:db8:beef:abcd::10").allowed, true);
  assert.equal(pubLimiter.consume("2001:db8:beef:abcd::20").allowed, true);
  assert.equal(pubLimiter.consume("2001:db8:beef:abcd::30").allowed, false);
});

test("Wave 3 P1 HTTP: Cookie HttpOnly, HS256, maxSessionAge, CSRF, separate limiters, RBAC, bsi_only, claim lock, audit separation & UU PDP", { timeout: 120000 }, async (t) => {
  const fixture = disposableBackend();
  let running;
  try {
    const setup = runFixture(
      fixture,
      `import { getStore, saveStore, db, DOC_TEMPLATE } from './src/db/database.js';
import { hashPassword } from './src/security/passwords.js';
const state = getStore();
const encoded = await hashPassword(${JSON.stringify(PASSWORD)});
const mkUser = (id, role, extra = {}) => ({
  id,
  name: 'User ' + id,
  email: id + '@wave3.test',
  role,
  branch: 'BANDUNG',
  bank_scope: 'all_bank',
  active: true,
  auth_version: 1,
  must_change_password: false,
  password_hash: encoded,
  ...extra
});
state.users = [
  mkUser('super', 'super_admin'),
  mkUser('ops', 'admin_ops'),
  mkUser('branch-all', 'admin_branch', { bank_scope: 'all_bank' }),
  mkUser('branch-bsi', 'admin_branch', { bank_scope: 'bsi_only' }),
  mkUser('sm-all', 'sales_manager', { bank_scope: 'all_bank' }),
  mkUser('sm-bsi', 'sales_manager', { bank_scope: 'bsi_only' }),
  mkUser('mkt-all', 'marketing', { bank_scope: 'all_bank', manager_id: 'sm-all', manager_name: 'User sm-all' }),
  mkUser('mkt-bsi', 'marketing', { bank_scope: 'bsi_only', manager_id: 'sm-bsi', manager_name: 'User sm-bsi' })
];
state.leads = [
  { id: 'lead-all', name: 'LEAD ALL BANK', phone: '081211110001', branch: 'BANDUNG', age: 65, status: 'baru', assigned_to: 'mkt-all', assigned_name: 'User mkt-all', sales_manager_id: 'sm-all', activities: [], documents: [], created_at: '2026-11-20T00:00:00.000Z', updated_at: '2026-11-20T00:00:00.000Z' },
  { id: 'lead-bsi', name: 'LEAD BSI ONLY', phone: '081211110002', branch: 'BANDUNG', age: 62, status: 'baru', assigned_to: 'mkt-bsi', assigned_name: 'User mkt-bsi', sales_manager_id: 'sm-bsi', activities: [], documents: [], created_at: '2026-11-20T00:00:00.000Z', updated_at: '2026-11-20T00:00:00.000Z' },
  { id: 'lead-pool-ok', name: 'LEAD POOL ELIGIBLE BSI', phone: '081211110003', branch: 'BANDUNG', age: 60, status: 'baru', assigned_to: null, sales_manager_id: null, activities: [], documents: [], created_at: '2026-11-20T00:00:00.000Z', updated_at: '2026-11-20T00:00:00.000Z' },
  { id: 'lead-pool-over70', name: 'LEAD POOL OVER 70', phone: '081211110004', branch: 'BANDUNG', age: 76, status: 'baru', assigned_to: null, sales_manager_id: null, activities: [], documents: [], created_at: '2026-11-20T00:00:00.000Z', updated_at: '2026-11-20T00:00:00.000Z' }
];
state.applications = [
  { id: 'app-wave3', app_no: 'APP-W3-001', lead_id: 'lead-all', lead_name: 'LEAD ALL BANK', marketing_id: 'mkt-all', marketing_name: 'User mkt-all', sales_manager_id: 'sm-all', branch: 'BANDUNG', bank_key: 'ams2', bank_name: 'AMS2', plafond: 100000000, tenor: 60, stage: 'upload_dokumen', stage_index: 0, rejected: false, history: [], checklist: DOC_TEMPLATE.map((d) => ({ ...d, status: null, versions: 0, filename: null })) },
  { id: 'app-booked', app_no: 'APP-W3-002', lead_id: 'lead-all', lead_name: 'LEAD ALL BANK', marketing_id: 'mkt-all', marketing_name: 'User mkt-all', sales_manager_id: 'sm-all', branch: 'BANDUNG', bank_key: 'ams2', bank_name: 'AMS2', plafond: 120000000, tenor: 60, stage: 'booking_live', stage_index: 6, rejected: false, history: [], checklist: [] }
];
state.claims = [
  { id: 'clm-wave3', claim_no: 'CLM-W3-001', application_id: 'app-booked', app_no: 'APP-W3-002', lead_name: 'LEAD ALL BANK', bank_key: 'ams2', bank_name: 'AMS2', marketing_id: 'mkt-all', marketing_name: 'User mkt-all', sales_manager_id: 'sm-all', branch: 'BANDUNG', amount: 2400000, status: 'SUBMITTED', booking_proof: null, history: [], created_at: '2026-11-20T00:00:00.000Z' }
];
state.simulations = [];
state.imports = [];
state.lead_requests = [];
state.parameter_proposals = [];
state.audit_logs = [{ id: 'aud-sentinel-internal', user_id: 'super', user_name: 'User super', role: 'super_admin', action: 'sentinel_internal', entity: 'system', detail: 'Internal sentinel audit entry', ip: '127.0.0.1', created_at: '2026-11-20T00:00:00.000Z' }];
saveStore();
db.close();`
    );
    assert.equal(setup.status, 0, setup.stderr);

    running = await startFixture(fixture, "production");

    const call = async (method, route, { body, token, cookie, headers = {}, skipCsrf = false } = {}) => {
      const reqHeaders = { ...headers };
      if (!skipCsrf && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
        reqHeaders["X-Requested-With"] = "XMLHttpRequest";
      }
      if (token) reqHeaders.Authorization = `Bearer ${token}`;
      if (cookie) reqHeaders.Cookie = cookie;
      let payload = body;
      if (body !== undefined && !(body instanceof FormData) && typeof body !== "string" && !Buffer.isBuffer(body)) {
        reqHeaders["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
      }
      const res = await fetch(`${running.base}${route}`, { method, headers: reqHeaders, body: payload });
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : Buffer.from(await res.arrayBuffer());
      return { status: res.status, headers: res.headers, data };
    };

    const login = async (id, extraHeaders = {}) => {
      const res = await call("POST", "/api/auth/login", {
        body: { email: `${id}@wave3.test`, password: PASSWORD },
        headers: extraHeaders
      });
      assert.equal(res.status, 200, `Login ${id} failed: ${JSON.stringify(res.data)}`);
      return {
        token: res.data.access_token,
        cookie: extractCookie(res.headers.get("set-cookie"), "lp_token"),
        user: res.data.user
      };
    };

    const superAuth = await login("super");
    const opsAuth = await login("ops");
    const branchAllAuth = await login("branch-all");
    const branchBsiAuth = await login("branch-bsi");
    const smAllAuth = await login("sm-all");
    const mktAllAuth = await login("mkt-all");

    await t.test("1. CSRF protection blocks mutations lacking X-Requested-With, cross-site Origin, or Sec-Fetch-Site", async () => {
      const noHeader = await call("PATCH", "/api/leads/lead-all", {
        body: { notes: "forged" },
        cookie: superAuth.cookie,
        skipCsrf: true
      });
      assert.equal(noHeader.status, 403);
      assert.equal(noHeader.data.error_code, "CSRF_HEADER_REQUIRED");

      const badOrigin = await call("PATCH", "/api/leads/lead-all", {
        body: { notes: "forged" },
        cookie: superAuth.cookie,
        headers: { Origin: "https://attacker.example.invalid" }
      });
      assert.equal(badOrigin.status, 403);
      assert.equal(badOrigin.data.error_code, "CSRF_ORIGIN_MISMATCH");

      const crossSite = await call("PATCH", "/api/leads/lead-all", {
        body: { notes: "forged" },
        cookie: superAuth.cookie,
        headers: { "Sec-Fetch-Site": "cross-site" }
      });
      assert.equal(crossSite.status, 403);
      assert.equal(crossSite.data.error_code, "CSRF_CROSS_SITE_REJECTED");

      // Cookie-only authenticated request WITH X-Requested-With & matching Origin succeeds!
      const okCookie = await call("PATCH", "/api/leads/lead-all", {
        body: { notes: "legit cookie update" },
        cookie: superAuth.cookie,
        headers: { Origin: running.base }
      });
      assert.equal(okCookie.status, 200);
    });

    await t.test("2. JWT HS256 pinning, Cookie HttpOnly refresh, and absolute maxSessionAge enforcement", async () => {
      // Cookie-only /api/auth/me works without Authorization header
      const me = await call("GET", "/api/auth/me", { cookie: superAuth.cookie });
      assert.equal(me.status, 200);
      assert.equal(me.data.id, "super");

      // Non-HS256 token (HS384) signed with the SAME secret MUST be rejected (401)
      const hs384Token = jwt.sign(
        { sub: "super", role: "super_admin", ver: 1, sid_iat: Math.floor(Date.now() / 1000) },
        running.secret,
        { algorithm: "HS384", expiresIn: "1h" }
      );
      const hs384Res = await call("GET", "/api/auth/me", { token: hs384Token });
      assert.equal(hs384Res.status, 401);

      // Fresh cookie refresh preserves sid_iat
      const refreshOk = await call("POST", "/api/auth/refresh", { cookie: superAuth.cookie });
      assert.equal(refreshOk.status, 200);
      const decodedBefore = jwt.decode(superAuth.token);
      const decodedAfter = jwt.decode(refreshOk.data.access_token);
      assert.equal(decodedAfter.sid_iat, decodedBefore.sid_iat);

      // Token whose sid_iat is older than 7 days (MAX_SESSION_AGE_SECONDS) is rejected on /api/auth/refresh
      const expiredSessionToken = jwt.sign(
        { sub: "super", role: "super_admin", ver: 1, sid_iat: Math.floor(Date.now() / 1000) - (8 * 24 * 3600) },
        running.secret,
        { algorithm: "HS256", expiresIn: "1h" }
      );
      const refreshExpired = await call("POST", "/api/auth/refresh", { token: expiredSessionToken });
      assert.equal(refreshExpired.status, 401);
      assert.equal(refreshExpired.data.error_code, "SESSION_MAX_AGE_EXCEEDED");
    });

    await t.test("3. Separate forgotPasswordLimiter cannot lock out legitimate login; change-password is rate-limited", async () => {
      const officeIp = "198.51.100.77";
      for (let i = 0; i < 5; i++) {
        const fp = await call("POST", "/api/auth/forgot-password", {
          body: { email: "mkt-all@wave3.test" },
          headers: { "X-Forwarded-For": officeIp }
        });
        assert.equal(fp.status, 200);
      }
      // 6th forgot-password attempt is blocked with 429
      const fpBlocked = await call("POST", "/api/auth/forgot-password", {
        body: { email: "mkt-all@wave3.test" },
        headers: { "X-Forwarded-For": officeIp }
      });
      assert.equal(fpBlocked.status, 429);

      // Legitimate employee login on the EXACT SAME IP & email still succeeds!
      const legitLogin = await login("mkt-all", { "X-Forwarded-For": officeIp });
      assert.equal(legitLogin.user.id, "mkt-all");

      // change-password rate limiter kicks in after 10 wrong attempts on the same account/IP
      const chgIp = "198.51.100.88";
      for (let i = 0; i < 10; i++) {
        const res = await call("POST", "/api/auth/change-password", {
          body: { current_password: "WrongPassword123!", new_password: "NewValid-Password-2026!" },
          cookie: legitLogin.cookie,
          headers: { "X-Forwarded-For": chgIp }
        });
        assert.equal(res.status, 400);
      }
      const chgBlocked = await call("POST", "/api/auth/change-password", {
        body: { current_password: "WrongPassword123!", new_password: "NewValid-Password-2026!" },
        cookie: legitLogin.cookie,
        headers: { "X-Forwarded-For": chgIp }
      });
      assert.equal(chgBlocked.status, 429);
    });

    await t.test("4. RBAC PATCH /api/users/:id revokes password/active changes from admin_branch and sales_manager", async () => {
      for (const actor of [branchAllAuth, smAllAuth]) {
        const pwdAttempt = await call("PATCH", "/api/users/mkt-all", {
          body: { password: "Hijacked-Password-2026!" },
          cookie: actor.cookie
        });
        assert.equal(pwdAttempt.status, 403);
        assert.equal(pwdAttempt.data.error_code, "CREDENTIAL_CHANGE_FORBIDDEN");

        const activeAttempt = await call("PATCH", "/api/users/mkt-all", {
          body: { active: false },
          cookie: actor.cookie
        });
        assert.equal(activeAttempt.status, 403);
        assert.equal(activeAttempt.data.error_code, "CREDENTIAL_CHANGE_FORBIDDEN");
      }

      // Non-credential profile update by admin_branch still works
      const profileOk = await call("PATCH", "/api/users/mkt-all", {
        body: { phone: "081299998888" },
        cookie: branchAllAuth.cookie
      });
      assert.equal(profileOk.status, 200);
      assert.equal(profileOk.data.phone, "081299998888");
    });

    await t.test("5. Consistent bsi_only isolation on leads and strict string validation on PATCH /api/leads/:id", async () => {
      const bsiLeadsRes = await call("GET", "/api/leads?page_size=100", { cookie: branchBsiAuth.cookie });
      assert.equal(bsiLeadsRes.status, 200);
      const bsiLeadIds = bsiLeadsRes.data.items.map((l) => l.id);
      assert.ok(bsiLeadIds.includes("lead-bsi"), "BSI admin must see BSI marketer's lead");
      assert.ok(bsiLeadIds.includes("lead-pool-ok"), "BSI admin must see eligible unassigned pool lead (age <= 70)");
      assert.ok(!bsiLeadIds.includes("lead-all"), "BSI admin MUST NOT see all_bank marketer's lead");
      assert.ok(!bsiLeadIds.includes("lead-pool-over70"), "BSI admin MUST NOT see unassigned lead age > 70");

      assert.equal((await call("GET", "/api/leads/lead-all", { cookie: branchBsiAuth.cookie })).status, 403);
      assert.equal((await call("PATCH", "/api/leads/lead-all", { body: { notes: "peek" }, cookie: branchBsiAuth.cookie })).status, 403);
      assert.equal((await call("GET", "/api/leads/lead-pool-over70", { cookie: branchBsiAuth.cookie })).status, 403);

      // Type confusion attacks on PATCH /api/leads/:id rejected with 400
      for (const badBody of [{ name: 12345 }, { phone: 8123456 }, { notes: { $ne: "" } }, { city: ["BANDUNG"] }]) {
        const res = await call("PATCH", "/api/leads/lead-all", { body: badBody, cookie: superAuth.cookie });
        assert.equal(res.status, 400, `Expected 400 for ${JSON.stringify(badBody)}, got ${res.status}`);
      }
    });

    await t.test("6. Claim proof lock after APPROVED, detected.ext enforcement, and KYC download/delete audit logs", async () => {
      // Upload JPEG disguised as .pdf to lead document -> filename forced to .jpg
      const leadDocForm = new FormData();
      leadDocForm.set("file", new Blob([JPEG_BYTES], { type: "application/pdf" }), "ktp_disguised.pdf");
      const upLeadDoc = await call("POST", "/api/leads/lead-all/documents?category=KTP", {
        body: leadDocForm,
        cookie: superAuth.cookie
      });
      assert.equal(upLeadDoc.status, 200);
      assert.equal(upLeadDoc.data.filename, "ktp_disguised.jpg");

      // Download & delete lead document both create audit logs
      const dlLeadDoc = await call("GET", `/api/documents/${upLeadDoc.data.id}/download`, { cookie: superAuth.cookie });
      assert.equal(dlLeadDoc.status, 200);
      assert.equal(dlLeadDoc.headers.get("content-type"), "image/jpeg");

      const delLeadDoc = await call("DELETE", `/api/documents/${upLeadDoc.data.id}`, { cookie: superAuth.cookie });
      assert.equal(delLeadDoc.status, 200);

      // Upload JPEG disguised as .html to application checklist -> filename forced to .jpg
      const appDocForm = new FormData();
      appDocForm.set("file", new Blob([JPEG_BYTES], { type: "image/jpeg" }), "sk_pensiun.html");
      const upAppDoc = await call("POST", "/api/applications/app-wave3/documents/ktp_pasangan", {
        body: appDocForm,
        cookie: superAuth.cookie
      });
      assert.equal(upAppDoc.status, 200);
      assert.equal(upAppDoc.data.filename, "sk_pensiun.jpg");

      const dlAppDoc = await call("GET", "/api/applications/app-wave3/documents/ktp_pasangan", { cookie: superAuth.cookie });
      assert.equal(dlAppDoc.status, 200);

      // Replace claim booking proof while SUBMITTED -> allowed & extension enforced (.jpg)
      const proof1Form = new FormData();
      proof1Form.set("file", new Blob([JPEG_BYTES], { type: "application/pdf" }), "foto_akad.pdf");
      const proof1Res = await call("POST", "/api/claims/clm-wave3/proof", {
        body: proof1Form,
        cookie: mktAllAuth.cookie
      });
      assert.equal(proof1Res.status, 200);
      assert.equal(proof1Res.data.booking_proof, "foto_akad.jpg");

      // Download claim file -> creates audit log
      const dlClaim = await call("GET", "/api/claims/clm-wave3/file/booking", { cookie: superAuth.cookie });
      assert.equal(dlClaim.status, 200);

      // Approve claim -> APPROVED
      const approveRes = await call("POST", "/api/claims/clm-wave3/action", {
        body: { action: "approve", note: "Disetujui Admin Ops" },
        cookie: opsAuth.cookie
      });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.data.status, "APPROVED");

      // Attempting to replace booking proof after APPROVED MUST BE REJECTED (409 CLAIM_PROOF_LOCKED)
      const proof2Form = new FormData();
      proof2Form.set("file", new Blob([PDF_BYTES], { type: "application/pdf" }), "tampered_akad.pdf");
      const proof2Res = await call("POST", "/api/claims/clm-wave3/proof", {
        body: proof2Form,
        cookie: mktAllAuth.cookie
      });
      assert.equal(proof2Res.status, 409);
      assert.equal(proof2Res.data.error_code, "CLAIM_PROOF_LOCKED");

      // Verify audit logs contain all sensitive KYC download / delete / proof replacement events
      const auditsRes = await call("GET", "/api/audit-logs?page_size=100", { cookie: superAuth.cookie });
      assert.equal(auditsRes.status, 200);
      const actions = new Set(auditsRes.data.items.map((a) => a.action));
      assert.ok(actions.has("download_lead_document"));
      assert.ok(actions.has("delete_lead_document"));
      assert.ok(actions.has("download_app_document"));
      assert.ok(actions.has("replace_claim_proof"));
      assert.ok(actions.has("download_claim_file"));
    });

    await t.test("7. UU PDP consent enforcement, consent_at/consent_version persistence & public audit isolation", async () => {
      // Missing pdp_consent rejected with 400
      const noConsent = await call("POST", "/api/public/leads", {
        body: { name: "Bapak Tanpa Persetujuan", phone: "081388881001", city: "Bandung" },
        headers: { "X-LP-Surface": "public-landing", "X-Forwarded-For": "203.0.113.10" },
        skipCsrf: true
      });
      assert.equal(noConsent.status, 400);

      const falseConsent = await call("POST", "/api/public/leads", {
        body: { name: "Bapak Tolak PDP", phone: "081388881002", city: "Bandung", pdp_consent: false },
        headers: { "X-LP-Surface": "public-landing", "X-Forwarded-For": "203.0.113.11" },
        skipCsrf: true
      });
      assert.equal(falseConsent.status, 400);

      // Snapshot internal audit_logs length before public lead submission
      const auditBefore = await call("GET", "/api/audit-logs?page_size=200", { cookie: superAuth.cookie });
      const internalCountBefore = auditBefore.data.total;

      // Valid submission with explicit UU PDP consent (no X-Requested-With required on /api/public/*)
      const okPub = await call("POST", "/api/public/leads", {
        body: {
          name: "Hj. Kartini UU PDP",
          phone: "081388881003",
          city: "Bandung",
          pdp_consent: true,
          consent_version: "UU-PDP-2026-v1"
        },
        headers: { "X-LP-Surface": "public-landing", "X-Forwarded-For": "203.0.113.12" },
        skipCsrf: true
      });
      assert.equal(okPub.status, 200);

      // Verify saved lead carries consent_at & consent_version
      const leadsRes = await call("GET", "/api/leads?page_size=100", { cookie: superAuth.cookie });
      const pdpLead = leadsRes.data.items.find((l) => l.phone === "081388881003");
      assert.ok(pdpLead, "Public lead with UU PDP consent must be saved");
      assert.equal(pdpLead.consent_version, "UU-PDP-2026-v1");
      assert.match(String(pdpLead.consent_at || ""), /^\d{4}-\d{2}-\d{2}T/);

      // Internal store.audit_logs MUST NOT have been incremented/polluted by public traffic
      const auditAfter = await call("GET", "/api/audit-logs?page_size=200", { cookie: superAuth.cookie });
      assert.equal(auditAfter.data.total, internalCountBefore, "Public lead events must NOT roll over internal audit_logs");
      assert.ok(auditAfter.data.items.some((a) => a.id === "aud-sentinel-internal"));

      // Dedicated append-only SQLite table `audit_events` captures BOTH public and internal events separately
      const pubEventsRes = await call("GET", "/api/audit-events?surface=public&limit=50", { cookie: superAuth.cookie });
      assert.equal(pubEventsRes.status, 200);
      assert.ok(pubEventsRes.data.items.some((e) => e.action === "public_lead_inquiry" && e.surface === "public"));

      const dbCheck = new DatabaseSync(fixture.database, { readOnly: true });
      try {
        const pubRowCount = dbCheck.prepare("SELECT COUNT(*) AS c FROM audit_events WHERE surface = 'public'").get().c;
        const intRowCount = dbCheck.prepare("SELECT COUNT(*) AS c FROM audit_events WHERE surface = 'internal'").get().c;
        assert.ok(pubRowCount >= 1, "audit_events table must store public events");
        assert.ok(intRowCount >= 1, "audit_events table must store internal events");
      } finally {
        dbCheck.close();
      }
    });
  } finally {
    if (running) await running.stop();
    fixture.cleanup();
  }
});

test("Wave 3 P1 Frontend & PWA Static Guards: HttpOnly cookie, Content-Type SW check, non-destructive update banner, lazy recharts & UU PDP UI", () => {
  const apiJs = fs.readFileSync(path.join(REPO_ROOT, "frontend/src/lib/api.js"), "utf8");
  assert.doesNotMatch(apiJs, /sessionStorage\.(get|set)Item\(\s*["']lp_access_token["']/, "api.js must not store/read lp_access_token in sessionStorage");
  assert.match(apiJs, /"X-Requested-With":\s*"XMLHttpRequest"/);
  assert.match(apiJs, /SAFE_PREVIEW_MIME_TYPES/);

  const authCtx = fs.readFileSync(path.join(REPO_ROOT, "frontend/src/context/AuthContext.jsx"), "utf8");
  assert.doesNotMatch(authCtx, /lp_access_token/, "AuthContext.jsx must not touch lp_access_token in sessionStorage");

  const swJs = fs.readFileSync(path.join(REPO_ROOT, "frontend/public/sw.js"), "utf8");
  assert.match(swJs, /isValidAssetResponse/);
  assert.match(swJs, /isHtmlContentType/);

  const pwaJs = fs.readFileSync(path.join(REPO_ROOT, "frontend/src/lib/pwa.js"), "utf8");
  assert.match(pwaJs, /lp:sw-update-ready/);
  assert.doesNotMatch(pwaJs, /controllerchange[\s\S]*window\.location\.reload\(\)/);

  const indexJs = fs.readFileSync(path.join(REPO_ROOT, "frontend/src/index.js"), "utf8");
  assert.match(indexJs, /vite:preloadError/);

  const appJs = fs.readFileSync(path.join(REPO_ROOT, "frontend/src/App.js"), "utf8");
  assert.match(appJs, /AppErrorBoundary/);
  assert.match(appJs, /PwaUpdateBanner/);

  const dashJsx = fs.readFileSync(path.join(REPO_ROOT, "frontend/src/pages/Dashboard.jsx"), "utf8");
  assert.doesNotMatch(dashJsx, /from\s+["']recharts["']/, "Dashboard.jsx must lazy-load FinancialTrendChart instead of statically importing recharts");
  assert.match(dashJsx, /lazy\(\(\)\s*=>\s*import\(["']\.\.\/components\/dashboard\/FinancialTrendChart["']\)\)/);

  const modalJsx = fs.readFileSync(path.join(REPO_ROOT, "frontend/src/components/pwa/FilePreviewModal.jsx"), "utf8");
  assert.match(modalJsx, /auth:logout/);

  const gameIntro = fs.readFileSync(path.join(REPO_ROOT, "landing/src/components/GameIntro.jsx"), "utf8");
  assert.match(gameIntro, /checkbox-pdp-consent/);
  assert.match(gameIntro, /pdp-privacy-modal/);
  assert.match(gameIntro, /UU No\. 27/);
});
