import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  createPublicLeadsRouter,
  PublicLeadLimiter,
  PUBLIC_LEAD_SUCCESS_RESPONSE
} from "../src/routes/public-leads.js";
import { disposableBackend, runFixture, startFixture } from "./helpers/disposable.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT =
  process.env.REPO_ROOT && fs.existsSync(path.join(process.env.REPO_ROOT, "landing/package.json"))
    ? process.env.REPO_ROOT
    : path.resolve(__dirname, "../..");

const PASSWORD = "Fixture-only-Password-2026!";

test("Public Landing Bundle & Source Guardrails: isolated from frontend/src and free of internal API paths", () => {
  const landingSrcDir = path.join(ROOT, "landing/src");
  assert.ok(fs.existsSync(landingSrcDir), "landing/src directory must exist");

  const collectFiles = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collectFiles(full));
      else if (entry.isFile()) out.push(full);
    }
    return out;
  };

  const srcFiles = collectFiles(landingSrcDir);
  assert.ok(srcFiles.length > 0, "landing/src must contain source files");
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, "utf8");
    assert.equal(
      /frontend\/src/.test(content),
      false,
      `Guardrail #2 violation: ${file} must not import from frontend/src`
    );
  }

  const landingDistDir = path.join(ROOT, "landing/dist");
  if (fs.existsSync(landingDistDir)) {
    const distFiles = collectFiles(landingDistDir).filter((f) => /\.(html|js|css)$/i.test(f));
    assert.ok(distFiles.length > 0, "landing/dist must contain built assets");
    const forbiddenInternalPaths = ["/api/auth", "/api/users", "/api/claims", "/api/calc/params"];
    for (const file of distFiles) {
      const text = fs.readFileSync(file, "utf8");
      for (const forbidden of forbiddenInternalPaths) {
        assert.equal(
          text.includes(forbidden),
          false,
          `Built public bundle ${path.basename(file)} must not reference internal route ${forbidden}`
        );
      }
    }
  }
});

test("PublicLeadLimiter & Turnstile DI: enforces 5 req / 15 min per IP and Turnstile verification", async () => {
  let fakeNow = 1000000;
  const limiter = new PublicLeadLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    maxEntries: 100,
    now: () => fakeNow
  });

  for (let i = 1; i <= 5; i++) {
    const r = limiter.consume("203.0.113.77");
    assert.equal(r.allowed, true, `Request #${i} must be allowed`);
  }
  const sixth = limiter.consume("203.0.113.77");
  assert.equal(sixth.allowed, false, "6th request within 15 min window must be blocked");
  assert.ok(sixth.retryAfterSeconds > 0);

  // Different IP is unaffected
  assert.equal(limiter.consume("203.0.113.88").allowed, true);

  // After 15 minutes window expires, original IP is allowed again
  fakeNow += 15 * 60 * 1000 + 1;
  assert.equal(limiter.consume("203.0.113.77").allowed, true);

  // Verify Turnstile dependency injection on router
  const app = express();
  app.use(express.json({ limit: "8kb" }));
  app.use(
    "/api/public/leads",
    createPublicLeadsRouter({
      verifyTurnstile: async (token) => token === "valid-turnstile-token"
    })
  );

  const prevFlag = process.env.PUBLIC_LEADS_REQUIRE_TURNSTILE;
  process.env.PUBLIC_LEADS_REQUIRE_TURNSTILE = "true";
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const missingTokenRes = await fetch(`${base}/api/public/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Budi Turnstile",
        phone: "081234567891",
        city: "BANDUNG"
      })
    });
    assert.equal(missingTokenRes.status, 400);

    const badTokenRes = await fetch(`${base}/api/public/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Budi Turnstile",
        phone: "081234567891",
        city: "BANDUNG",
        turnstile_token: "invalid-token"
      })
    });
    assert.equal(badTokenRes.status, 400);
  } finally {
    if (prevFlag === undefined) delete process.env.PUBLIC_LEADS_REQUIRE_TURNSTILE;
    else process.env.PUBLIC_LEADS_REQUIRE_TURNSTILE = prevFlag;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Public Landing Integration: Surface isolation, Seam #1-#5, pool stock & untouchedCount allocation", { timeout: 60000 }, async () => {
  const fixture = disposableBackend();
  let running;
  try {
    const setup = runFixture(
      fixture,
      `import { getStore, saveStore, db } from "./src/db/database.js";
import { hashPassword } from "./src/security/passwords.js";

const state = getStore();
const encoded = await hashPassword(${JSON.stringify(PASSWORD)});
for (const u of state.users) {
  u.password_hash = encoded;
  u.must_change_password = false;
  u.active = true;
}
state.lead_requests = [];
saveStore();
db.close();`,
      "development"
    );
    assert.equal(setup.status, 0, setup.stderr);
    running = await startFixture(fixture, "development");

    const call = async (method, route, body = null, token = null, extraHeaders = {}) => {
      const headers = { "X-Requested-With": "XMLHttpRequest", ...extraHeaders };
      if (token) headers.Authorization = `Bearer ${token}`;
      let payload = body;
      if (body !== null && typeof body !== "string") {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
      }
      const res = await fetch(`${running.base}${route}`, { method, headers, body: payload });
      const text = await res.text();
      let data = text;
      try {
        data = JSON.parse(text);
      } catch {
        /* keep text */
      }
      return { status: res.status, headers: res.headers, data, text };
    };

    // 1. Seam #1: Surface isolation (X-LP-Surface: public-landing vs default internal portal)
    const internalRoot = await call("GET", "/");
    assert.equal(internalRoot.status, 200);
    assert.match(internalRoot.text, /<title>Disposable test<\/title>/);
    assert.equal(internalRoot.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet");

    const publicRoot = await call("GET", "/", null, null, { "X-LP-Surface": "public-landing" });
    assert.equal(publicRoot.status, 200);
    assert.match(publicRoot.text, /<title>Layanan Pensiunan — Public Landing<\/title>/);
    assert.equal(publicRoot.headers.get("x-robots-tag"), null, "Public landing HTML must not send noindex");

    for (const blockedApi of ["/api/auth/login", "/api/users", "/api/leads", "/api/backup"]) {
      const blockedRes = await call(
        blockedApi === "/api/auth/login" ? "POST" : "GET",
        blockedApi,
        blockedApi === "/api/auth/login" ? { email: "a@b.c", password: "x" } : null,
        null,
        { "X-LP-Surface": "public-landing" }
      );
      assert.equal(
        blockedRes.status,
        404,
        `Public surface must block internal route ${blockedApi} with HTTP 404`
      );
    }

    // 2. Login as Admin Ops & Marketing Siantar/Bandung to check pool stock before & after public inquiry
    const superLogin = await call("POST", "/api/auth/login", {
      email: "superadmin@layananpensiunan.id",
      password: PASSWORD
    });
    assert.equal(superLogin.status, 200);
    const superToken = superLogin.data.access_token;

    const mktLogin = await call("POST", "/api/auth/login", {
      email: "marketing@layananpensiunan.id",
      password: PASSWORD
    });
    assert.equal(mktLogin.status, 200);
    const mktToken = mktLogin.data.access_token;
    const mktBranch = mktLogin.data.user.branch; // BANDUNG

    const beforeReqs = await call("GET", "/api/lead-requests", null, mktToken);
    assert.equal(beforeReqs.status, 200);
    const beforePrapen = beforeReqs.data.branch_stock.prapen_unassigned;
    const beforePensiun = beforeReqs.data.branch_stock.pensiun_unassigned;
    const beforeUntouched = beforeReqs.data.untouched_leads_count;

    // 3. Submit a Prapensiun lead in BANDUNG via public surface (+ injection attempt)
    const prapenRes = await call(
      "POST",
      "/api/public/leads",
      {
        pdp_consent: true,
        name: "=H. AHMAD PRAPENSIUN",
        phone: "+62 813-9988-7701",
        city: "Kota Bandung",
        institution: "PNS AKTIF",
        pension_status: "Prapensiun",
        notes: "=Ingin konsultasi persiapan pensiun 2 tahun lagi",
        assigned_to: "u-mkt-1",
        status: "berhasil",
        role: "super_admin",
        sales_manager_id: "u-sm-1"
      },
      null,
      { "X-LP-Surface": "public-landing", "X-Forwarded-For": "198.51.100.10" }
    );
    assert.equal(prapenRes.status, 200);
    assert.deepEqual(prapenRes.data, PUBLIC_LEAD_SUCCESS_RESPONSE);

    // 4. Submit a Sudah Pensiun lead in BANDUNG via public surface
    const pensiunRes = await call(
      "POST",
      "/api/public/leads",
      {
        pdp_consent: true,
        name: "HJ. SITI PURNABAKTI",
        phone: "081399887702",
        city: "Bandung",
        institution: "TASPEN",
        pension_status: "Sudah Pensiun",
        salary_estimate: 4800000
      },
      null,
      { "X-LP-Surface": "public-landing", "X-Forwarded-For": "198.51.100.11" }
    );
    assert.equal(pensiunRes.status, 200);

    // 5. Verify both leads in GET /api/leads (FIFO top of list, Seam #2, #3, #4)
    const leadsRes = await call("GET", "/api/leads?page_size=100", null, superToken);
    assert.equal(leadsRes.status, 200);
    const leadItems = Array.isArray(leadsRes.data) ? leadsRes.data : leadsRes.data.items;
    const leadPensiun = leadItems.find((l) => l.phone === "081399887702");
    const leadPrapen = leadItems.find((l) => l.phone === "081399887701");

    assert.ok(leadPrapen, "Prapensiun public lead must exist");
    assert.match(leadPrapen.id, /^lead-web-/);
    assert.equal(leadPrapen.name, "H. AHMAD PRAPENSIUN", "Formula prefix '=' must be stripped");
    assert.equal(leadPrapen.source, "Website Landing Page");
    assert.equal(leadPrapen.status, "baru", "Injected status must be ignored");
    assert.equal(leadPrapen.assigned_to, null, "Injected assigned_to must be ignored");
    assert.equal(leadPrapen.sales_manager_id, null, "Injected sales_manager_id must be ignored");
    assert.equal(leadPrapen.birth_date, null, "Seam #3: birth_date must be null");
    assert.equal(leadPrapen.age, 55, "Seam #3: Prapensiun default age must be 55");
    assert.equal(leadPrapen.branch, mktBranch);
    assert.deepEqual(leadPrapen.activities, [], "Seam #2: activities must be empty array []");

    assert.ok(leadPensiun, "Sudah Pensiun public lead must exist");
    assert.equal(leadPensiun.age, 65, "Seam #3: Sudah Pensiun default age must be 65");
    assert.equal(leadPensiun.pension_salary, 4800000);
    assert.equal(leadPensiun.birth_date, null);
    assert.deepEqual(leadPensiun.activities, []);

    // 6. Verify branch_stock increased by +1 for both prapen_unassigned and pensiun_unassigned
    const afterReqs = await call("GET", "/api/lead-requests", null, mktToken);
    assert.equal(afterReqs.status, 200);
    assert.equal(afterReqs.data.branch_stock.prapen_unassigned, beforePrapen + 1);
    assert.equal(afterReqs.data.branch_stock.pensiun_unassigned, beforePensiun + 1);

    // 7. Verify duplicate phone & honeypot do NOT increase store.leads count but return identical 200 OK
    const countBeforeDup = leadItems.length;
    const dupRes = await call(
      "POST",
      "/api/public/leads",
      {
        pdp_consent: true,
        name: "DUPLIKAT NOMOR",
        phone: "+6281399887701",
        city: "Bandung"
      },
      null,
      { "X-LP-Surface": "public-landing", "X-Forwarded-For": "198.51.100.12" }
    );
    assert.equal(dupRes.status, 200);
    assert.deepEqual(dupRes.data, PUBLIC_LEAD_SUCCESS_RESPONSE);

    const honeypotRes = await call(
      "POST",
      "/api/public/leads",
      {
        pdp_consent: true,
        name: "BOT SPAMMER",
        phone: "081399887799",
        city: "Bandung",
        company_website: "https://spam.example.invalid"
      },
      null,
      { "X-LP-Surface": "public-landing", "X-Forwarded-For": "198.51.100.13" }
    );
    assert.equal(honeypotRes.status, 200);
    assert.deepEqual(honeypotRes.data, PUBLIC_LEAD_SUCCESS_RESPONSE);

    const leadsAfterDup = await call("GET", "/api/leads?page_size=100", null, superToken);
    const leadItemsAfterDup = Array.isArray(leadsAfterDup.data) ? leadsAfterDup.data : leadsAfterDup.data.items;
    assert.equal(leadItemsAfterDup.length, countBeforeDup, "Duplicate and honeypot must not add leads");

    // 8. Verify allocation via POST /api/lead-requests + POST /api/lead-requests/:id/approve increments untouched_leads_count (Seam #2 proof)
    const createReqRes = await call(
      "POST",
      "/api/lead-requests",
      { requested_count: 1, target_segment: "prapen", notes: "Request public prapen lead" },
      mktToken
    );
    assert.equal(createReqRes.status, 201);

    const approveReqRes = await call(
      "POST",
      `/api/lead-requests/${createReqRes.data.id}/approve`,
      { admin_notes: "Approved public prapen lead" },
      superToken
    );
    assert.equal(approveReqRes.status, 200);

    const postAssignReqs = await call("GET", "/api/lead-requests", null, mktToken);
    assert.equal(
      postAssignReqs.data.untouched_leads_count,
      beforeUntouched + 1,
      "Seam #2: allocated public lead must count as untouched (activities.length === 1)"
    );

    // 9. Verify 6th request from same IP returns HTTP 429 + Retry-After
    const rateIp = "198.51.100.250";
    for (let i = 1; i <= 5; i++) {
      const r = await call(
        "POST",
        "/api/public/leads",
        {
          pdp_consent: true,
          name: `Nasabah Rate ${i}`,
          phone: `08135555000${i}`,
          city: "Siantar"
        },
        null,
        { "X-LP-Surface": "public-landing", "X-Forwarded-For": rateIp }
      );
      assert.equal(r.status, 200);
    }
    const sixthRes = await call(
      "POST",
      "/api/public/leads",
      {
        pdp_consent: true,
        name: "Nasabah Rate 6",
        phone: "081355550006",
        city: "Siantar"
      },
      null,
      { "X-LP-Surface": "public-landing", "X-Forwarded-For": rateIp }
    );
    assert.equal(sixthRes.status, 429);
    assert.ok(Number(sixthRes.headers.get("retry-after")) > 0);
  } finally {
    if (running) await running.stop();
    fixture.cleanup();
  }
});
