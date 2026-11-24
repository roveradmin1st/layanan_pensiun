import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_PARTNER_PARAMETERS } from "../src/config/default-parameters.js";
import {
  calculateMax,
  calculatePreview,
  generateSimulationPdfBuffer,
  generateSimulationSvgBuffer
} from "../src/engines/calc-engine.js";
import { todayWibIso } from "../src/utils/time-wib.js";
import { disposableBackend, runFixture, startFixture } from "./helpers/disposable.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "..");

async function httpJson(base, route, { method = "GET", token, body, rawBody, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  let payload = rawBody;
  if (rawBody !== undefined) {
    if (!reqHeaders["Content-Type"]) reqHeaders["Content-Type"] = "application/json";
  } else if (body !== undefined) {
    reqHeaders["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${base}${route}`, { method, headers: reqHeaders, body: payload });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  return { status: res.status, headers: res.headers, data };
}

test("Wave2-BNI-1: SVG BNI escapes XSS via escapeXml() dan PDF BNI memakai 'permil' ASCII aman + logo /ImBni", () => {
  const xssName = `BUDI & <script>alert("bni-xss")</script> 'quote' (Test)\\Name`;
  const sim = {
    sim_no: `SIM-BNI-<XSS>&"1"`,
    created_by_name: `Petugas <BNI> (Admin)\\Ops`,
    result: {
      bank_key: "bank_bni",
      bank_name: "Bank BNI — BNI Fleksi Pensiun & Pra Purna",
      name: xssName,
      birth_date: "1968-10-08",
      process_date: "2026-11-24",
      age: 58,
      bank_rate: 10.5,
      salary: 5000000,
      plafond: 100000000,
      tenor: 60,
      coop_installment: 2149390,
      ratio_pct: 42.99,
      retention: 23643290,
      take_over: 0,
      net_disbursement: 71706710,
      remaining_salary: 2850610,
      overall_ok: true,
      bni_details: {
        product_code: "4",
        product_name: `BNI Fleksi <Pra>&Purna`,
        bni_disbursement_date: "2026-12-02",
        bni_tmt_pensiun_date: "2027-07-01",
        age_exact_text: "58 thn 1 bln 16 hr",
        insurance_scheme_label: "Kredit BFP Skema Menurun",
        insurance_underwriter: "CAR (PT AJ Central Asia Raya)",
        insurance_tenor_years: 5,
        ajk_covered: true,
        maturity_date: "2031-11-30",
        remaining_service_months: 202,
        dbr_pct: 90,
        max_installment: 4500000,
        max_plafond: 209361724,
        provisi_pct: 1.0,
        btl_pct: 3.5,
        bank_fees: 4650000,
        ajk_rate_permil: 56.96,
        subsidy_cap_permil: 150,
        customer_ajk_permil: 0,
        gross_ajk_premium: 5696000,
        bni_subsidy_premium: 5696000,
        customer_ajk_premium: 0,
        underwriting_code: "HD <SAFE>",
        underwriting_desc: "HEALTH DECLARATION",
        underwriting_requires_verification: false,
        net_before_blokir: 95350000,
        blokir_angsuran_count: 3,
        blokir_tabungan_count: 1,
        blokir_prapensiun_count: 7,
        total_blokir_count: 11,
        blokir_angsuran: 6448170,
        blokir_tabungan: 2149390,
        blokir_prapensiun: 15045730,
        total_blokir: 23643290
      }
    }
  };

  const svgText = generateSimulationSvgBuffer(sim).toString("utf8");
  assert.equal(/<script>/i.test(svgText), false, "SVG BNI tidak boleh memuat tag <script> mentah");
  assert.match(svgText, /&lt;script&gt;alert\(&quot;bni-xss&quot;\)&lt;\/script&gt;/);
  assert.match(svgText, /SIM-BNI-&lt;XSS&gt;&amp;&quot;1&quot;/);
  assert.match(svgText, /BNI Fleksi &lt;Pra&gt;&amp;Purna/);
  assert.match(svgText, /HD &lt;SAFE&gt;/);

  const pdfBuf = generateSimulationPdfBuffer(sim);
  const pdfLatin = pdfBuf.toString("latin1");
  assert.ok(pdfLatin.startsWith("%PDF-1.4"), "PDF BNI harus valid %PDF-1.4");
  assert.ok(pdfLatin.includes("/ImBni") && pdfLatin.includes("/DCTDecode"), "PDF BNI harus memuat logo /ImBni");
  assert.match(pdfLatin, /\\\(Test\\\)\\\\Name/, "PDF BNI harus meng-escape tanda kurung & backslash");
  assert.match(pdfLatin, /56\.96 permil/, "PDF BNI harus memakai teks ASCII 'permil' agar tidak hilang menjadi spasi");
  assert.match(pdfLatin, /0 permil/, "Premi AJK Nasabah PDF BNI harus memakai 'permil' ASCII");
  assert.equal(pdfLatin.includes("‰"), false, "PDF Helvetica Type1 tidak boleh memuat karakter non-ASCII ‰");
});

test("Wave2-BNI-2: Engine BNI menggunakan todayWibIso() (Asia/Jakarta) dan bebas Date.now() ID", () => {
  const bniEngineSrc = fs.readFileSync(path.join(BACKEND_ROOT, "src/engines/bni-calc-engine.js"), "utf8");
  const calcEngineSrc = fs.readFileSync(path.join(BACKEND_ROOT, "src/engines/calc-engine.js"), "utf8");
  const serverSrc = fs.readFileSync(path.join(BACKEND_ROOT, "src/server.js"), "utf8");

  assert.match(bniEngineSrc, /todayWibIso/, "bni-calc-engine.js harus mengimpor dan memakai todayWibIso()");
  assert.equal(bniEngineSrc.includes("new Date().toISOString().slice(0, 10)"), false, "bni-calc-engine.js tidak boleh memakai UTC new Date().toISOString().slice(0, 10)");
  assert.equal(calcEngineSrc.includes("new Date().toISOString().slice(0, 10)"), false, "calc-engine.js tidak boleh memakai UTC new Date().toISOString().slice(0, 10)");
  assert.equal(/`(?:sim|lead|app|clm|imp|prop|ldoc|aud|h|act|req|ch)-\$\{Date\.now\(\)\}/.test(serverSrc), false, "server.js tidak boleh memiliki ID berbasis Date.now()");

  const wibToday = todayWibIso();
  const maxRes = calculateMax(
    { bank_key: "bank_bni", birth_date: "1968-10-08", salary: 5000000, bni_product_code: "4" },
    DEFAULT_PARTNER_PARAMETERS
  );
  assert.equal(maxRes.process_date, wibToday, "calculateMax BNI harus memakai tanggal proses WIB");

  const prevRes = calculatePreview(
    { bank_key: "bank_bni", birth_date: "1968-10-08", salary: 5000000, plafond: 100000000, tenor: 60, bni_product_code: "4" },
    DEFAULT_PARTNER_PARAMETERS
  );
  assert.equal(prevRes.process_date, wibToday, "calculatePreview BNI harus memakai tanggal proses WIB");
});

test("Wave2-BNI-3: HTTP E2E — SIMULATION_INPUT_WHITELIST BNI, HTTP 400 prototype pollution (direct & proposal withTransaction), serta integritas permukaan publik", { timeout: 60000 }, async () => {
  const fixture = disposableBackend();
  const running = await startFixture(fixture, "development");
  try {
    const loginSuper = await httpJson(running.base, "/api/auth/login", {
      method: "POST",
      body: { email: "superadmin@layananpensiunan.id", password: "Password123!" }
    });
    assert.equal(loginSuper.status, 200);
    const superToken = loginSuper.data.access_token;

    const loginOps = await httpJson(running.base, "/api/auth/login", {
      method: "POST",
      body: { email: "adminops@layananpensiunan.id", password: "Password123!" }
    });
    assert.equal(loginOps.status, 200);
    const opsToken = loginOps.data.access_token;

    // 1. Verifikasi SIMULATION_INPUT_WHITELIST mempertahankan seluruh atribut resmi BNI & memangkas field liar
    const createSim = await httpJson(running.base, "/api/simulations", {
      method: "POST",
      token: superToken,
      body: {
        bank_key: "bank_bni",
        name: "TEST <BNI> WHITELIST & SAFEGUARD",
        birth_date: "1968-10-08",
        process_date: "2026-11-24",
        bni_disbursement_date: "2026-12-02",
        bni_tmt_pensiun_date: "2027-07-01",
        salary: 4500000,
        plafond: 100000000,
        tenor: 60,
        take_over: 0,
        bni_product_code: "4",
        bni_insurance_scheme: "MENURUN",
        bni_dbr_pct: 85,
        blokir_angsuran_count: 3,
        blokir_tabungan_count: 1,
        blokir_prapensiun_count: 7,
        evil_injected_field: "SHOULD_BE_STRIPPED"
      }
    });
    assert.equal(createSim.status, 200, JSON.stringify(createSim.data));
    const sim = createSim.data;
    assert.match(sim.id, /^sim-[0-9a-f-]{36}$/i, "ID simulasi BNI wajib menggunakan UUID");
    assert.equal(sim.input.bni_product_code, "4");
    assert.equal(sim.input.bni_insurance_scheme, "MENURUN");
    assert.equal(sim.input.bni_dbr_pct, 85);
    assert.equal(sim.input.blokir_angsuran_count, 3);
    assert.equal(sim.input.blokir_tabungan_count, 1);
    assert.equal(sim.input.blokir_prapensiun_count, 7);
    assert.equal(sim.input.bni_disbursement_date, "2026-12-02");
    assert.equal(sim.input.bni_tmt_pensiun_date, "2027-07-01");
    assert.equal(sim.input.evil_injected_field, undefined, "Field liar di luar whitelist harus dipangkas");

    // Verifikasi unduhan SVG & PDF BNI memakai CSP sandbox & escaping aman
    const svgRes = await httpJson(running.base, `/api/simulations/${sim.id}/png`, { token: superToken });
    assert.equal(svgRes.status, 200);
    assert.equal(svgRes.headers.get("content-security-policy"), "default-src 'none'; sandbox");
    assert.match(svgRes.data, /TEST &lt;BNI&gt; WHITELIST &amp; SAFEGUARD/);

    const pdfRes = await httpJson(running.base, `/api/simulations/${sim.id}/pdf`, { token: superToken });
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers.get("content-security-policy"), "default-src 'none'; sandbox");
    assert.match(pdfRes.data, /permil/);

    // 2. Penolakan HTTP 400 (bukan 500) atas prototype pollution pada PUT /api/calc/params/bank_bni
    const protoDirect = await httpJson(running.base, "/api/calc/params/bank_bni", {
      method: "PUT",
      token: superToken,
      rawBody: '{"updates":{"__proto__":{"bniPolluted":true},"maxInstallmentRatio":85}}'
    });
    assert.equal(protoDirect.status, 400, `Harus 400, bukan ${protoDirect.status}: ${JSON.stringify(protoDirect.data)}`);
    assert.equal(({}).bniPolluted, undefined);

    const ctorDirect = await httpJson(running.base, "/api/calc/params/bank_bni", {
      method: "PUT",
      token: superToken,
      rawBody: '{"updates":{"constructor":{"prototype":{"bniPolluted":true}}}}'
    });
    assert.equal(ctorDirect.status, 400);

    const lockedKeyDirect = await httpJson(running.base, "/api/calc/params/bank_bni", {
      method: "PUT",
      token: superToken,
      body: { updates: { adminFee: 999999 } }
    });
    assert.equal(lockedKeyDirect.status, 400);
    assert.equal(lockedKeyDirect.data.error_code, "BNI_PARAM_MANAGED_BY_MATRIX");

    const protoOps = await httpJson(running.base, "/api/calc/params/bank_bni", {
      method: "PUT",
      token: opsToken,
      rawBody: '{"updates":{"__proto__":{"bniPolluted":true},"subsidyPermilCap":140}}'
    });
    assert.equal(protoOps.status, 400);

    // 3. Verifikasi alur Dual-Control normal BNI (propose -> approve) berhasil & proposal beracun ditolak 400 (bukan 500)
    const validProp = await httpJson(running.base, "/api/calc/params/bank_bni", {
      method: "PUT",
      token: opsToken,
      body: { updates: { maxInstallmentRatio: 85, subsidyPermilCap: 150 }, reason: "Uji Dual Control BNI" }
    });
    assert.equal(validProp.status, 200);
    assert.equal(validProp.data.mode, "proposed");
    assert.match(validProp.data.proposal.id, /^prop-[0-9a-f-]{36}$/i);

    const approveValid = await httpJson(running.base, `/api/calc/params/proposals/${validProp.data.proposal.id}/decide`, {
      method: "POST",
      token: superToken,
      body: { decision: "APPROVE" }
    });
    assert.equal(approveValid.status, 200);
    assert.equal(approveValid.data.partners.bank_bni.maxInstallmentRatio, 85);

    // 4. Verifikasi permukaan publik landing & /api/public/config tetap utuh 0 regresi
    const pubConfig = await httpJson(running.base, "/api/public/config", {
      headers: { "X-LP-Surface": "public-landing" }
    });
    assert.equal(pubConfig.status, 200);
    assert.equal(typeof pubConfig.data.turnstile_site_key, "string");

    const pubBanksBlocked = await httpJson(running.base, "/api/banks", {
      headers: { "X-LP-Surface": "public-landing" }
    });
    assert.equal(pubBanksBlocked.status, 404, "Permukaan publik tidak boleh membocorkan /api/banks");
  } finally {
    await running.stop();
  }

  // 5. Uji proposal BNI beracun di DB (mengandung __proto__ / field terkunci) pada POST /api/calc/params/proposals/:id/decide -> HTTP 400 (bukan 500)
  const poisonRes = runFixture(
    fixture,
    `import { getStore, saveStore, db } from "./src/db/database.js";
const store = getStore();
const poisonedChanges = JSON.parse('{"__proto__":{"polluted":true},"maxInstallmentRatio":88}');
store.parameter_proposals.unshift({
  id: "prop-poison-bni-proto",
  partner_key: "bank_bni",
  partner_name: "Bank BNI — BNI Fleksi Pensiun & Pra Purna",
  proposed_by_id: "u-ops-1",
  proposed_by_name: "Admin Ops",
  created_at: new Date().toISOString(),
  status: "PENDING",
  reason: "Poison proto test",
  changes: poisonedChanges
});
store.parameter_proposals.unshift({
  id: "prop-poison-bni-locked",
  partner_key: "bank_bni",
  partner_name: "Bank BNI — BNI Fleksi Pensiun & Pra Purna",
  proposed_by_id: "u-ops-1",
  proposed_by_name: "Admin Ops",
  created_at: new Date().toISOString(),
  status: "PENDING",
  reason: "Poison locked field test",
  changes: { adminFee: 1 }
});
saveStore();
db.close();`,
    "development"
  );
  assert.equal(poisonRes.status, 0, poisonRes.stderr);

  const running2 = await startFixture(fixture, "development");
  try {
    const loginSuper2 = await httpJson(running2.base, "/api/auth/login", {
      method: "POST",
      body: { email: "superadmin@layananpensiunan.id", password: "Password123!" }
    });
    const superToken2 = loginSuper2.data.access_token;

    const decProto = await httpJson(running2.base, "/api/calc/params/proposals/prop-poison-bni-proto/decide", {
      method: "POST",
      token: superToken2,
      body: { decision: "APPROVE" }
    });
    assert.equal(decProto.status, 400, `Proposal __proto__ harus ditolak 400, dapat ${decProto.status}: ${JSON.stringify(decProto.data)}`);

    const decLocked = await httpJson(running2.base, "/api/calc/params/proposals/prop-poison-bni-locked/decide", {
      method: "POST",
      token: superToken2,
      body: { decision: "APPROVE" }
    });
    assert.equal(decLocked.status, 400, `Proposal field terkunci harus ditolak 400, dapat ${decLocked.status}: ${JSON.stringify(decLocked.data)}`);
    assert.equal(decLocked.data.error_code, "BNI_PARAM_MANAGED_BY_MATRIX");

    const paramsAfter = await httpJson(running2.base, "/api/calc/params", { token: superToken2 });
    assert.equal(paramsAfter.status, 200);
    assert.equal(paramsAfter.data.partners.bank_bni.maxInstallmentRatio, 85, "Parameter BNI tidak boleh berubah setelah penolakan proposal beracun");
    assert.equal(paramsAfter.data.partners.bank_bni.adminFee, 150000, "adminFee BNI tidak boleh berubah");
  } finally {
    await running2.stop();
    fixture.cleanup();
  }
});
