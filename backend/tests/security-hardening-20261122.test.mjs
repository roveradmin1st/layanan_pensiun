import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { parseImportFile } from "../src/utils/lead-import-parser.js";
import {
  escapePdfText,
  escapeXml,
  generateSimulationPdfBuffer,
  generateSimulationSvgBuffer
} from "../src/engines/calc-engine.js";
import { disposableBackend, runFixture, startFixture } from "./helpers/disposable.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.REPO_ROOT && fs.existsSync(path.join(process.env.REPO_ROOT, "ops/server_backup.py"))
  ? process.env.REPO_ROOT
  : path.resolve(__dirname, "../..");

const PASSWORD = "Fixture-only-Password-2026!";

function buildZipBuffer(entries) {
  const chunks = [];
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rawBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const method = entry.store ? 0 : 8;
    const payload = method === 0 ? rawBuf : zlib.deflateRawSync(rawBuf);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(payload.length, 18);
    header.writeUInt32LE(rawBuf.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);

    chunks.push(header, nameBuf, payload);
  }
  return Buffer.concat(chunks);
}

function buildMinimalXlsx(extraEntries = [], sheetXmlOverride = null) {
  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Leads" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;
  const sheetXml = sheetXmlOverride || `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>Nama</t></is></c>
      <c r="B1" t="inlineStr"><is><t>No HP</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Gaji</t></is></c>
      <c r="D1" t="inlineStr"><is><t>Cabang</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>BUDI SANTOSO</t></is></c>
      <c r="B2" t="inlineStr"><is><t>081234567890</t></is></c>
      <c r="C2"><v>5500000</v></c>
      <c r="D2" t="inlineStr"><is><t>BANDUNG</t></is></c>
    </row>
  </sheetData>
</worksheet>`;

  return buildZipBuffer([
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: relsXml },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
    ...extraEntries
  ]);
}

test("Item #1: XLSX parser prevents ZZZZZZ1 event-loop freeze, skips non-essential entries, and caps decompression to 32 MB", () => {
  // 1. ZZZZZZ1 cell reference must not hang or blow up array length
  const evilSheet = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>Nama</t></is></c>
      <c r="B1" t="inlineStr"><is><t>No HP</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Gaji</t></is></c>
      <c r="ZZZZZZ1" t="inlineStr"><is><t>EVIL_COL</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>SITI AMINAH</t></is></c>
      <c r="B2" t="inlineStr"><is><t>081298765432</t></is></c>
      <c r="C2"><v>4800000</v></c>
      <c r="AAZ2" t="inlineStr"><is><t>OUT_OF_RANGE</t></is></c>
    </row>
  </sheetData>
</worksheet>`;
  const start = Date.now();
  const parsed = parseImportFile(buildMinimalXlsx([], evilSheet), "evil_col.xlsx");
  const elapsedMs = Date.now() - start;
  assert.ok(elapsedMs < 200, `Expected <200ms parse time, got ${elapsedMs}ms`);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].name, "SITI AMINAH");
  assert.equal(parsed.rows[0].phone, "081298765432");

  // 2. Non-essential entries (e.g. 40 printerSettings/theme/drawing entries + huge non-essential blob) are skipped BEFORE inflateRawSync
  const nonEssentialEntries = [];
  for (let i = 1; i <= 40; i++) {
    nonEssentialEntries.push({
      name: `xl/printerSettings/printerSettings${i}.bin`,
      data: Buffer.alloc(1024, 0x41)
    });
  }
  nonEssentialEntries.push({
    name: "xl/drawings/drawing1.xml",
    data: Buffer.alloc(20 * 1024 * 1024, 0x20) // 20 MB non-essential XML that would blow 32 MB budget if decompressed
  });
  const parsedWithExtras = parseImportFile(buildMinimalXlsx(nonEssentialEntries), "multi_theme.xlsx");
  assert.equal(parsedWithExtras.rows.length, 1);
  assert.equal(parsedWithExtras.rows[0].name, "BUDI SANTOSO");

  // 3. Cumulative decompression across relevant XML entries > 32 MB must throw
  const bigXmlChunk = Buffer.from("<worksheet>" + " ".repeat(12 * 1024 * 1024) + "</worksheet>");
  const bombZip = buildMinimalXlsx([
    { name: "xl/worksheets/sheet2.xml", data: bigXmlChunk },
    { name: "xl/worksheets/sheet3.xml", data: bigXmlChunk },
    { name: "xl/worksheets/sheet4.xml", data: bigXmlChunk }
  ]);
  assert.throws(
    () => parseImportFile(bombZip, "zip_bomb.xlsx"),
    /32 MB/i
  );

  // 4. More than 30 relevant XML entries must throw
  const tooManySheets = [];
  for (let i = 2; i <= 32; i++) {
    tooManySheets.push({ name: `xl/worksheets/sheet${i}.xml`, data: "<worksheet><sheetData/></worksheet>" });
  }
  assert.throws(
    () => parseImportFile(buildMinimalXlsx(tooManySheets), "many_sheets.xlsx"),
    /30 entry/i
  );
});

test("Item #3: SVG and PDF generators escape XML and PostScript special characters", () => {
  assert.equal(escapeXml(`<script>alert("x")</script> & 'test'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &apos;test&apos;");
  assert.equal(escapePdfText(`A\\B(C)`), `A\\\\B\\(C\\)`);

  const xssName = `BUDI & <script>alert("xss")</script> 'test' (Test)\\Name`;
  const scenarios = [
    {
      name: "AMS2",
      sim: {
        sim_no: "SIM-XSS-01",
        created_by_name: "Petugas <Admin>",
        result: {
          bank_key: "ams2",
          name: xssName,
          birth_date: "1960-01-01",
          process_date: "2026-11-22",
          age: 66,
          category: "PRA PLATINUM & <PLUS>",
          plafond: 100000000,
          tenor: 60,
          salary: 5000000,
          coop_installment: 2500000,
          proaq: 10000000,
          risk: 5000000,
          admin_fee: 700000,
          total_fees: 15700000,
          take_over: 0,
          retention: 7500000,
          net_disbursement: 76800000,
          remaining_salary: 2500000,
          ams2_details: { category_label: "Pra <Platinum>" }
        }
      }
    },
    {
      name: "BSI",
      sim: {
        sim_no: "SIM-XSS-02",
        created_by_name: "Petugas <BSI>",
        result: {
          bank_key: "bsi_prapen",
          name: xssName,
          process_date: "2026-11-22",
          plafond: 100000000,
          tenor: 60,
          proaq: 1000000,
          proaq_pct: 1,
          admin_fee: 100000,
          net_disbursement: 90000000,
          remaining_salary: 3000000,
          bsi_details: { sub_product: "PP10" }
        }
      }
    },
    {
      name: "Capital",
      sim: {
        sim_no: "SIM-XSS-03",
        created_by_name: "Petugas <Cap>",
        result: {
          bank_key: "bank_capital",
          name: xssName,
          birth_date: "1965-01-01",
          process_date: "2026-11-22",
          salary: 5000000,
          plafond: 100000000,
          tenor: 60,
          coop_installment: 2200000,
          total_fees: 21000000,
          retention: 4400000,
          net_disbursement: 74600000,
          remaining_salary: 2800000,
          capital_details: { product: "pensiun", product_label: "Pensiun & <Plus>" }
        }
      }
    },
    {
      name: "Mestika",
      sim: {
        sim_no: "SIM-XSS-04",
        created_by_name: "Petugas <Mst>",
        result: {
          bank_key: "bank_mestika",
          name: xssName,
          birth_date: "1964-01-01",
          process_date: "2026-11-22",
          age: 62,
          bank_rate: 10,
          salary: 5000000,
          plafond: 100000000,
          tenor: 60,
          coop_installment: 2100000,
          total_fees: 22000000,
          retention: 6300000,
          ratio_pct: 42,
          net_disbursement: 71700000,
          remaining_salary: 2900000,
          mestika_details: { product_label: "Reguler <TBA>", salary_type_label: "IDPB & Slip" }
        }
      }
    }
  ];

  for (const sc of scenarios) {
    const svgText = generateSimulationSvgBuffer(sc.sim).toString("utf8");
    assert.equal(/<script>/i.test(svgText), false, `${sc.name} SVG must not contain unescaped <script>`);
    assert.match(svgText, /&lt;script&gt;/i, `${sc.name} SVG must escape <script>`);
    assert.ok(svgText.includes("&amp;"), `${sc.name} SVG must escape &`);

    const pdfText = generateSimulationPdfBuffer(sc.sim).toString("utf8");
    assert.ok(pdfText.startsWith("%PDF-1.4"), `${sc.name} PDF must start with %PDF-1.4`);
    assert.match(pdfText, /\\\(TEST\\\)\\\\NAME/i, `${sc.name} PDF must escape parentheses and backslash`);
  }
});

test("Item #6 & #7: SQLite VACUUM eliminates freelist pages and withTransaction writes once with structuredClone rollback", () => {
  // Verify ops/server_backup.py contains VACUUM + isolation_level=None + 48/14 WIB retention + receipt protection
  const backupScript = fs.readFileSync(path.join(ROOT, "ops/server_backup.py"), "utf8");
  assert.match(backupScript, /isolation_level=None/);
  assert.match(backupScript, /VACUUM/);
  assert.match(backupScript, /timedelta\(hours=7\)/);
  assert.match(backupScript, /candidates\[:48\]/);
  assert.match(backupScript, /0<=delta_days<14/);
  assert.match(backupScript, /latest-verified\.json/);
  assert.match(backupScript, /backup_ref/);

  // Real SQLite VACUUM test via node:sqlite inside isolated child process so all OS handles release on exit
  const fixture = disposableBackend();
  try {
    const vacCheck = runFixture(
      fixture,
      `import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const fragDbPath = path.join(process.cwd(), "frag.sqlite");
const db = new DatabaseSync(fragDbPath);
db.exec("CREATE TABLE keep (id TEXT PRIMARY KEY, val BLOB); CREATE TABLE junk (id INTEGER PRIMARY KEY, val BLOB);");
db.prepare("INSERT INTO keep VALUES (?, ?)").run("doc1", Buffer.from("%PDF-1.4-test"));
const insertJunk = db.prepare("INSERT INTO junk VALUES (?, ?)");
for (let i = 0; i < 60; i++) {
  insertJunk.run(i, Buffer.alloc(4096, 0x55));
}
db.exec("DROP TABLE junk;");
const freelistBefore = db.prepare("PRAGMA freelist_count").get().freelist_count;
assert.ok(freelistBefore > 0, "Expected freelist_count > 0");
db.exec("VACUUM;");
const freelistAfter = db.prepare("PRAGMA freelist_count").get().freelist_count;
assert.equal(freelistAfter, 0, "VACUUM must shrink freelist_count to 0");
assert.equal(Buffer.from(db.prepare("SELECT val FROM keep WHERE id='doc1'").get().val).toString("utf8"), "%PDF-1.4-test");
db.close();
console.log("VACUUM_OK");`,
      "development"
    );
    assert.equal(vacCheck.status, 0, `VACUUM test failed: ${vacCheck.stderr}\n${vacCheck.stdout}`);
    assert.match(vacCheck.stdout, /VACUUM_OK/);

    // Item #7: Verify withTransaction + addAuditLog performs only 1 SQLite write and rolls back cleanly on error
    const txCheck = runFixture(
      fixture,
      `import assert from "node:assert/strict";
import { db, getStore, withTransaction, addAuditLog } from "./src/db/database.js";

const initial = getStore();
const initialLeadCount = initial.leads.length;
const initialAuditCount = initial.audit_logs.length;

let kvWriteCount = 0;
const origPrepare = db.prepare.bind(db);
db.prepare = (sql, ...rest) => {
  const stmt = origPrepare(sql, ...rest);
  if (typeof sql === "string" && sql.includes("INSERT INTO kv_store")) {
    const origRun = stmt.run.bind(stmt);
    stmt.run = (...args) => {
      kvWriteCount++;
      return origRun(...args);
    };
  }
  return stmt;
};

withTransaction((store) => {
  store.leads.unshift({ id: "lead-tx-1", name: "TX TEST", branch: "BANDUNG" });
  addAuditLog({ id: "u1", name: "Tester", role: "super_admin" }, "tx_test", "lead-tx-1", "single write test");
  addAuditLog({ id: "u1", name: "Tester", role: "super_admin" }, "tx_test_2", "lead-tx-1", "still single write");
});

assert.equal(kvWriteCount, 1, "withTransaction + addAuditLog must write to SQLite exactly once");
assert.equal(getStore().leads.length, initialLeadCount + 1);
assert.equal(getStore().audit_logs.length, initialAuditCount + 2);

// Verify structuredClone rollback restores stateCache cleanly without touching SQLite
kvWriteCount = 0;
assert.throws(() => {
  withTransaction((store) => {
    store.leads.unshift({ id: "lead-tx-fail", name: "MUST ROLLBACK", branch: "BANDUNG" });
    addAuditLog({ id: "u1", name: "Tester", role: "super_admin" }, "tx_fail", "lead-tx-fail", "must rollback");
    throw new Error("Simulated failure");
  });
}, /Simulated failure/);

assert.equal(kvWriteCount, 0, "Failed transaction must not write kv_store");
assert.equal(getStore().leads.length, initialLeadCount + 1, "stateCache leads must roll back");
assert.equal(getStore().audit_logs.length, initialAuditCount + 2, "stateCache audit_logs must roll back");
db.close();
console.log("TX_OK");`,
      "development"
    );
    assert.equal(txCheck.status, 0, `Transaction test failed: ${txCheck.stderr}\n${txCheck.stdout}`);
    assert.match(txCheck.stdout, /TX_OK/);
  } finally {
    fixture.cleanup();
  }
});

test("Items #2, #3, #4, #5: HTTP hardening (partner param validation, simulation whitelist/headers/128kb/2000-char caps, filename sanitization)", { timeout: 60000 }, async (t) => {
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
saveStore();
db.close();`,
      "development"
    );
    assert.equal(setup.status, 0, setup.stderr);
    running = await startFixture(fixture, "development");

    const call = async (method, route, body = null, token = null, headers = {}) => {
      const h = { "X-Requested-With": "XMLHttpRequest", ...headers };
      if (token) h.Authorization = `Bearer ${token}`;
      let payload = body;
      if (body !== null && !(body instanceof FormData) && typeof body !== "string" && !Buffer.isBuffer(body)) {
        h["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
      }
      const res = await fetch(`${running.base}${route}`, { method, headers: h, body: payload });
      const text = await res.text();
      let data = text;
      try { data = JSON.parse(text); } catch { /* keep text */ }
      return { status: res.status, headers: res.headers, data, text };
    };

    const superLogin = await call("POST", "/api/auth/login", { email: "superadmin@layananpensiunan.id", password: PASSWORD });
    assert.equal(superLogin.status, 200);
    assert.equal(superLogin.data.user.capabilities.web_backup, true);
    const superToken = superLogin.data.access_token;

    const opsLogin = await call("POST", "/api/auth/login", { email: "adminops@layananpensiunan.id", password: PASSWORD });
    assert.equal(opsLogin.status, 200);
    const opsToken = opsLogin.data.access_token;

    await t.test("Item #2: Non-BSI partner parameter validation rejects prototype pollution, invalid keys, null tiers, and negative numbers", async () => {
      assert.equal((await call("PUT", "/api/calc/params/unknown_bank", { updates: { bankRateAnnual: 10 } }, superToken)).status, 404);
      assert.equal((await call("PUT", "/api/calc/params/constructor", { updates: { bankRateAnnual: 10 } }, superToken)).status, 404);

      const protoRes = await call(
        "PUT",
        "/api/calc/params/ams2",
        '{"updates":{"__proto__":{"polluted":"yes"},"bankRateAnnual":12}}',
        superToken,
        { "Content-Type": "application/json" }
      );
      assert.equal(protoRes.status, 400);
      assert.equal(({}).polluted, undefined, "Prototype must not be polluted");

      assert.equal((await call("PUT", "/api/calc/params/ams2", { updates: { tiers: null } }, superToken)).status, 400);
      assert.equal((await call("PUT", "/api/calc/params/ams2", { updates: { tiers: [{ id: "x", name: "X", minAge: -1, maxAge: 70, coopRateAnnual: 15, riskReserveRate: 10 }] } }, superToken)).status, 400);
      assert.equal((await call("PUT", "/api/calc/params/ams2", { updates: { bankRateAnnual: -5 } }, superToken)).status, 400);
      assert.equal((await call("PUT", "/api/calc/params/ams2", { updates: { unknownProp: 99 } }, superToken)).status, 400);
      assert.equal((await call("PUT", "/api/calc/params/ams2", { updates: { engine: "hijacked" } }, superToken)).status, 400);

      // GET /api/calc/params must still succeed
      const paramsRes = await call("GET", "/api/calc/params", null, superToken);
      assert.equal(paramsRes.status, 200);

      // Settings.jsx compatibility: sending full cloned draft with unchanged identity fields must succeed
      const fullDraft = structuredClone(paramsRes.data.partners.ams2);
      fullDraft.maxTenorMonths = 108;
      const draftUpdateRes = await call("PUT", "/api/calc/params/ams2", { updates: fullDraft, reason: "Settings UI full draft" }, superToken);
      assert.equal(draftUpdateRes.status, 200);
      assert.equal(draftUpdateRes.data.partner.maxTenorMonths, 108);

      // Dual control proposal by admin_ops -> approved by super_admin
      const propRes = await call("PUT", "/api/calc/params/bank_capital", { updates: { interestRateAnnual: 10.25 }, reason: "Adjust rate" }, opsToken);
      assert.equal(propRes.status, 200);
      assert.equal(propRes.data.mode, "proposed");
      const decideRes = await call("POST", `/api/calc/params/proposals/${propRes.data.proposal.id}/decide`, { decision: "APPROVE" }, superToken);
      assert.equal(decideRes.status, 200);
      assert.equal(decideRes.data.partners.bank_capital.interestRateAnnual, 10.25);
    });

    await t.test("Item #3 & #4: 128kb JSON limit, createdSim.input whitelist, 2000-char text cap, and simulation SVG/PDF CSP headers", async () => {
      // 128kb JSON limit -> 413
      const hugePayload = JSON.stringify({ bank_key: "ams2", junk: "A".repeat(140 * 1024) });
      const tooLargeRes = await call("POST", "/api/calc/preview", hugePayload, superToken, { "Content-Type": "application/json" });
      assert.equal(tooLargeRes.status, 413);

      // createdSim.input whitelist + SVG/PDF escaping & CSP headers
      const simRes = await call("POST", "/api/simulations", {
        bank_key: "ams2",
        name: `NASABAH <script>alert(1)</script> & (Test)`,
        birth_date: "1960-05-05",
        salary: 5000000,
        plafond: 100000000,
        tenor: 60,
        extra_attacker_junk: "B".repeat(5000),
        nested_trash: { huge: [1, 2, 3] }
      }, superToken);
      assert.equal(simRes.status, 200);
      assert.equal(simRes.data.input.extra_attacker_junk, undefined, "Non-whitelisted junk must not enter createdSim.input");
      assert.equal(simRes.data.input.nested_trash, undefined);
      assert.equal(simRes.data.input.plafond, 100000000);

      const svgDownload = await call("GET", `/api/simulations/${simRes.data.id}/png`, null, superToken);
      assert.equal(svgDownload.status, 200);
      assert.equal(svgDownload.headers.get("content-security-policy"), "default-src 'none'; sandbox");
      assert.equal(svgDownload.headers.get("x-content-type-options"), "nosniff");
      assert.equal(svgDownload.text.includes("<script>"), false);

      const pdfDownload = await call("GET", `/api/simulations/${simRes.data.id}/pdf`, null, superToken);
      assert.equal(pdfDownload.status, 200);
      assert.equal(pdfDownload.headers.get("content-security-policy"), "default-src 'none'; sandbox");
      assert.equal(pdfDownload.headers.get("x-content-type-options"), "nosniff");

      // 2000-char limit on note/notes/reason
      const overNoteRes = await call("POST", "/api/leads/lead-1001/activities", { type: "catatan", note: "N".repeat(2001) }, superToken);
      assert.equal(overNoteRes.status, 400);
      const okNoteRes = await call("POST", "/api/leads/lead-1001/activities", { type: "catatan", note: "N".repeat(2000) }, superToken);
      assert.equal(okNoteRes.status, 200);
      assert.equal((await call("PATCH", "/api/leads/lead-1001", { notes: "X".repeat(2001) }, superToken)).status, 400);
      assert.equal((await call("PUT", "/api/calc/params/ams2", { updates: { maxTenorMonths: 120 }, reason: "R".repeat(2001) }, superToken)).status, 400);
    });

    await t.test("Item #5: Upload and Content-Disposition sanitize unsafe filenames", async () => {
      const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
      const form = new FormData();
      form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), '../../evil"\r\nX-Test: 1.pdf');

      const uploadRes = await call("POST", "/api/leads/lead-1001/documents?category=KTP", form, superToken);
      assert.equal(uploadRes.status, 200);
      assert.ok(!uploadRes.data.filename.includes(".."), "Stored filename must not contain ..");
      assert.ok(!/[\r\n"/\\]/.test(uploadRes.data.filename), "Stored filename must not contain CR/LF/quotes/slashes");

      const dlRes = await call("GET", `/api/documents/${uploadRes.data.id}/download`, null, superToken);
      assert.equal(dlRes.status, 200);
      const cd = dlRes.headers.get("content-disposition") || "";
      assert.match(cd, /^inline; filename="[A-Za-z0-9._\-]+\.pdf"$/);
    });
  } finally {
    if (running) await running.stop();
    fixture.cleanup();
  }
});
