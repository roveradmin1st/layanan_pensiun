import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import {
  parseImportFile,
  decodeXmlEntities,
  detectHeaderIndices
} from "../src/utils/lead-import-parser.js";
import {
  todayWibIso,
  yearMonthWibCompact,
  isoTimestampToWibDate
} from "../src/utils/time-wib.js";
import {
  normalizeBranch,
  resolveBranchFromCityOrText
} from "../src/config/branches.js";
import { calculateMax } from "../src/engines/calc-engine.js";
import { DEFAULT_PARTNER_PARAMETERS } from "../src/config/default-parameters.js";
import { disposableBackend, runFixture, startFixture } from "./helpers/disposable.mjs";

const PASSWORD = "Fixture-only-Password-2026!";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF");

/**
 * Helper pembuat arsip ZIP streaming (General Purpose Bit 3 = 0x0008, compressedSize = 0
 * di Local File Header, ukuran asli hanya di Central Directory + EOCD seperti Google Sheets / LibreOffice)
 */
function buildStreamedBit3Zip(entries) {
  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rawBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const compressed = zlib.deflateRawSync(rawBuf);

    // Local File Header dengan bit 3 aktif dan compressedSize = 0
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0008, 6); // Bit 3: Data Descriptor aktif
    localHeader.writeUInt16LE(8, 8); // DEFLATE
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14); // CRC-32 = 0 di local header
    localHeader.writeUInt32LE(0, 18); // compressedSize = 0 di local header!
    localHeader.writeUInt32LE(0, 22); // uncompressedSize = 0 di local header!
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    // Data Descriptor (16 bytes) setelah payload
    const dataDesc = Buffer.alloc(16);
    dataDesc.writeUInt32LE(0x08074b50, 0);
    dataDesc.writeUInt32LE(0, 4);
    dataDesc.writeUInt32LE(compressed.length, 8);
    dataDesc.writeUInt32LE(rawBuf.length, 12);

    // Central Directory Header menyimpan ukuran sebenarnya
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0x0008, 8);
    cdHeader.writeUInt16LE(8, 10);
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt16LE(0, 14);
    cdHeader.writeUInt32LE(0, 16);
    cdHeader.writeUInt32LE(compressed.length, 20);
    cdHeader.writeUInt32LE(rawBuf.length, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, nameBuf, compressed, dataDesc);
    cdParts.push(cdHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length + dataDesc.length;
  }

  const cdBuffer = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, cdBuffer, eocd]);
}

test("P0-1: Parser XLSX menangani sel kosong self-closing <c .../>, ZIP streaming Central Directory, urutan XML entity (&amp; terakhir), dan header Plafond vs Gaji", () => {
  assert.equal(decodeXmlEntities("Bpk &amp;lt;Ibu&amp;gt; &amp; Keluarga"), "Bpk &lt;Ibu&gt; & Keluarga");
  assert.equal(decodeXmlEntities("Nama&#32;Lengkap &#x26; Gelar"), "Nama Lengkap & Gelar");

  // Kolom "Plafond" atau "OS Pokok" tidak boleh salah ditangkap sebagai kolom gaji bulanan
  const headerMap = detectHeaderIndices(["Nama Debitur", "No HP", "Plafond Lama", "OS Pokok", "Gaji Pensiun", "Cabang"]);
  assert.equal(headerMap.salary, 4, "Harus memetakan 'Gaji Pensiun' (indeks 4), bukan 'Plafond Lama' (indeks 2)");
  const headerOnlyPlafond = detectHeaderIndices(["Nama Debitur", "No HP", "Plafond Pinjaman", "Cabang"]);
  assert.equal(headerOnlyPlafond.salary, -1, "Kolom Plafond tidak boleh dianggap sebagai gaji bulanan");

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="7" uniqueCount="7">
  <si><t>Nama Nasabah</t></si>
  <si><t>Nomor HP</t></si>
  <si><t>NOPEN</t></si>
  <si><t>Kota</t></si>
  <si><t>Gaji Pensiun</t></si>
  <si><t>DRS. H. ZULKIFLI &amp;lt;PURN&amp;gt;</t></si>
  <si><t>Kota Solok</t></si>
</sst>`;

  // Baris 2 memiliki sel B2 kosong self-closing <c r="B2" s="1"/> tepat sebelum C2 (t="s")
  const sheetXml = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
      <c r="E1" t="s"><v>4</v></c>
    </row>
    <row r="2">
      <c r="A2" s="1" t="s"><v>5</v></c>
      <c r="B2" s="1"/>
      <c r="C2" s="1" t="inlineStr"><is><t>13009988771</t></is></c>
      <c r="D2" s="1" t="s"><v>6</v></c>
      <c r="E2" s="2"><v>5150000</v></c>
    </row>
    <row r="3"/>
    <row r="4">
      <c r="A4" t="inlineStr"><is><r><t>HJ. RATNA </t></r><r><t>DEWI</t></r></is></c>
      <c r="B4" s="3"/>
      <c r="C4" t="inlineStr"><is><t>13009988772</t></is></c>
      <c r="D4" t="inlineStr"><is><t>Kabupaten Banjarbaru</t></is></c>
      <c r="E4"><v>4750000</v></c>
    </row>
  </sheetData>
</worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="StreamedLeads" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const streamedZip = buildStreamedBit3Zip([
    { name: "xl/sharedStrings.xml", data: sharedStringsXml },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: relsXml },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml }
  ]);

  const parsed = parseImportFile(streamedZip, "google_sheets_streamed.xlsx");
  assert.equal(parsed.rows.length, 2, "Kedua baris tanpa nomor HP namun ber-NOPEN unik wajib ter-parse utuh");
  assert.equal(parsed.rows[0].name, "DRS. H. ZULKIFLI &lt;PURN&gt;", "Tidak boleh terjadi double-unescape pada sharedStrings");
  assert.equal(parsed.rows[0].phone, "", "Fallback nomor HP kosong wajib berupa string kosong '', bukan '080000000000'");
  assert.equal(parsed.rows[0].nopen, "13009988771", "Sel C2 setelah <c r='B2' s='1'/> self-closing tidak boleh tertelan");
  assert.equal(parsed.rows[0].city, "Kota Solok");
  assert.equal(parsed.rows[0].salary, 5150000);

  assert.equal(parsed.rows[1].name, "HJ. RATNA DEWI");
  assert.equal(parsed.rows[1].phone, "");
  assert.equal(parsed.rows[1].nopen, "13009988772");
  assert.equal(parsed.rows[1].city, "Kabupaten Banjarbaru");
  assert.equal(parsed.rows[1].salary, 4750000);
});

test("P0-2: Zona waktu WIB todayWibIso(), aktuaria tanggal 31 evaluateAms2Core, serta routing KOTA SOLOK, BANJARBARU, dan fallback PUSAT JAKARTA", () => {
  // Pukul 00:30 WIB tanggal 24 Nov 2026 adalah pukul 17:30 UTC tanggal 23 Nov 2026
  const earlyMorningWib = new Date("2026-11-23T17:30:00.000Z");
  assert.equal(earlyMorningWib.toISOString().slice(0, 10), "2026-11-23", "UTC masih tanggal 23");
  assert.equal(todayWibIso(earlyMorningWib), "2026-11-24", "WIB wajib sudah berganti ke tanggal 24");
  assert.equal(isoTimestampToWibDate("2026-11-23T17:30:00.000Z"), "2026-11-24");
  assert.equal(isoTimestampToWibDate("2026-11-23T16:59:59.000Z"), "2026-11-23");
  assert.equal(yearMonthWibCompact(new Date("2026-11-30T17:05:00.000Z")), "202612");

  // Bug tanggal 31 pada evaluateAms2Core:
  // Lahir 1946-06-30 -> batas akhir 84 thn 10 bln = 2031-04-30.
  // Pada tanggal proses 2026-05-31, selisih tepat ke 2031-04-30 adalah 59 bulan (addMonthsClamped = 2031-04-30 <= 2031-04-30).
  const ams2Max = calculateMax(
    {
      bank_key: "ams2",
      name: "UJI TANGGAL 31",
      birth_date: "1946-06-30",
      process_date: "2026-05-31",
      salary: 5000000
    },
    DEFAULT_PARTNER_PARAMETERS
  );
  assert.equal(ams2Max.processable, true);
  assert.equal(ams2Max.max_tenor, 59, "Tenor maksimal AMS2 pada tanggal 31 Mei wajib 59 bulan, bukan terpotong jadi 58");

  // Routing cabang batas kata (\b) & urutan alias terpanjang -> terpendek
  assert.equal(normalizeBranch("KOTA SOLOK"), "PADANG", "KOTA SOLOK wajib ke PADANG, bukan SOLO");
  assert.equal(resolveBranchFromCityOrText("Kota Solok", "", ""), "PADANG");
  assert.equal(resolveBranchFromCityOrText("Kabupaten Solok", "", ""), "PADANG");
  assert.equal(normalizeBranch("KOTA SOLO"), "SOLO");
  assert.equal(normalizeBranch("SURAKARTA"), "SOLO");

  assert.equal(normalizeBranch("BANJARBARU"), "BANJARMASIN", "BANJARBARU wajib ke BANJARMASIN, bukan TASIKMALAYA");
  assert.equal(resolveBranchFromCityOrText("Kota Banjarbaru", "", ""), "BANJARMASIN");
  assert.equal(resolveBranchFromCityOrText("Kabupaten Banjarnegara", "", ""), "PURWOKERTO");
  assert.equal(resolveBranchFromCityOrText("Kota Banjar", "", ""), "TASIKMALAYA");

  // Kota di luar cakupan 29 cabang harus jatuh ke PUSAT JAKARTA bila fallback disetel ke PUSAT JAKARTA (public-leads.js)
  assert.equal(resolveBranchFromCityOrText("Pontianak", "Pontianak", "", "PUSAT JAKARTA"), "PUSAT JAKARTA");
  assert.equal(resolveBranchFromCityOrText("Kota Kendari", "Kota Kendari", "", "PUSAT JAKARTA"), "PUSAT JAKARTA");
  // Default impor internal tetap BANDUNG
  assert.equal(resolveBranchFromCityOrText("Pontianak", "", ""), "BANDUNG");
});

test("P0-3: Integrasi Database Anti-Boot-Brick (UUID non-collision, guard async/nested withTransaction, validateState pra-commit, pure INSERT saveUploadedFile)", () => {
  const fixture = disposableBackend();
  try {
    const res = runFixture(
      fixture,
      `import assert from "node:assert/strict";
import { getStore, withTransaction, saveUploadedFile, getUploadedFile, addAuditLog, db } from "./src/db/database.js";

const store = getStore();
const initialLeadCount = store.leads.length;

// 1. Callback async wajib ditolak seketika tanpa merusak transaksi
assert.throws(
  () => withTransaction(async () => {}),
  /ASYNC_TRANSACTION_FORBIDDEN/
);
assert.throws(
  () => withTransaction(() => Promise.resolve("illegal")),
  /ASYNC_TRANSACTION_FORBIDDEN/
);

// 2. Nested withTransaction yang gagal di dalam try/catch wajib rollback ke SAVEPOINT tanpa memutus referensi store luar
withTransaction((outerStore) => {
  assert.equal(outerStore, store, "Referensi store luar harus identik");
  outerStore.meta.p0_outer_marker = "kept";
  try {
    withTransaction((innerStore) => {
      innerStore.leads.unshift({ id: "temp-inner-lead" });
      saveUploadedFile("temp-inner-blob", "temp.pdf", "application/pdf", Buffer.from("%PDF-1.4 temp"));
      throw new Error("INNER_ABORT");
    });
  } catch (e) {
    assert.match(e.message, /INNER_ABORT/);
  }
  assert.equal(getStore(), store, "Referensi stateCache wajib dipertahankan in-place pasca rollback nested");
  assert.equal(store.leads.length, initialLeadCount, "Mutasi array pada inner tx wajib pulih");
  assert.equal(getUploadedFile("temp-inner-blob"), undefined, "INSERT SQLite pada inner SAVEPOINT wajib ikut ter-rollback");
  outerStore.meta.p0_after_catch = "committed";
});
assert.equal(getStore().meta.p0_outer_marker, "kept");
assert.equal(getStore().meta.p0_after_catch, "committed");

// 3. validateState pra-commit wajib memblokir ID duplikat agar database tidak pernah menjadi boot-brick
const existingId = store.leads[0].id;
assert.throws(
  () =>
    withTransaction((s) => {
      s.leads.push({ ...s.leads[0], id: existingId });
    }),
  /ID koleksi leads kosong atau duplikat/
);
assert.equal(getStore().leads.length, initialLeadCount, "State in-memory wajib bersih setelah gagal validasi skema");

// 4. saveUploadedFile murni INSERT: dilarang menimpa berkas dengan ID yang sama
saveUploadedFile("doc-unique-1", "asli.pdf", "application/pdf", Buffer.from("%PDF-1.4 ASLI"));
assert.throws(() => {
  saveUploadedFile("doc-unique-1", "timpa.pdf", "application/pdf", Buffer.from("%PDF-1.4 TIMPA"));
});
assert.equal(Buffer.from(getUploadedFile("doc-unique-1").data).toString("utf8"), "%PDF-1.4 ASLI");

// 5. Ribuan audit log dalam milidetik yang sama wajib 100% unik (crypto.randomUUID)
withTransaction(() => {
  for (let i = 0; i < 150; i++) {
    addAuditLog({ id: "u-super-1", name: "Super", role: "super_admin" }, "burst_test", "sys", "ok");
  }
});
const auditIds = getStore().audit_logs.map((a) => a.id);
assert.equal(new Set(auditIds).size, auditIds.length);
db.close();`,
      "development"
    );
    assert.equal(res.status, 0, res.stderr);
  } finally {
    fixture.cleanup();
  }
});

test("P0-4: HTTP E2E — Multi-row impor tanpa nomor HP, GET /api/public/config, batas page_size <= 200, routing publik Pontianak/Solok/Banjarbaru, dan revisi bukti klaim", { timeout: 60000 }, async () => {
  const fixture = disposableBackend();
  let running;
  const prevSiteKey = process.env.TURNSTILE_SITE_KEY;
  process.env.TURNSTILE_SITE_KEY = "0x4AAAAAAATestRuntimeSiteKey";

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
state.applications.unshift({
  id: "app-p0-booked",
  app_no: "APP-202611-9001",
  lead_id: state.leads[0].id,
  lead_name: state.leads[0].name,
  marketing_id: "u-mkt-1",
  marketing_name: "ANDI PRATAMA",
  branch: "BANDUNG",
  bank_key: "ams2",
  bank_name: "Koperasi AMS2",
  stage: "booking_live",
  stage_index: 6,
  rejected: false,
  booking: { date: "2026-11-24", credit_no: "CRD-9001", confirmed_by: "Super" },
  checklist: [],
  history: [],
  created_at: new Date().toISOString()
});
saveStore();
db.close();`,
      "development"
    );
    assert.equal(setup.status, 0, setup.stderr);
    running = await startFixture(fixture, "development");

    // 1. GET /api/public/config tersedia pada surface publik (X-LP-Surface: public-landing)
    const cfgRes = await fetch(`${running.base}/api/public/config`, {
      headers: { "X-LP-Surface": "public-landing" }
    });
    assert.equal(cfgRes.status, 200);
    assert.match(String(cfgRes.headers.get("cache-control") || ""), /no-store/);
    const cfgJson = await cfgRes.json();
    assert.deepEqual(cfgJson, { turnstile_site_key: "0x4AAAAAAATestRuntimeSiteKey" });

    // POST ke /api/public/config pada surface publik tetap ditolak 404
    const cfgPostRes = await fetch(`${running.base}/api/public/config`, {
      method: "POST",
      headers: { "X-LP-Surface": "public-landing" }
    });
    assert.equal(cfgPostRes.status, 404);

    // 2. Routing cabang publik: Kota Solok -> PADANG, Banjarbaru -> BANJARMASIN, Pontianak -> PUSAT JAKARTA
    for (const [idx, item] of [
      { name: "NASABAH SOLOK", phone: "081377770001", city: "Kota Solok", expected: "PADANG" },
      { name: "NASABAH BANJARBARU", phone: "081377770002", city: "Kota Banjarbaru", expected: "BANJARMASIN" },
      { name: "NASABAH PONTIANAK", phone: "081377770003", city: "Kota Pontianak", expected: "PUSAT JAKARTA" }
    ].entries()) {
      const pubRes = await fetch(`${running.base}/api/public/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LP-Surface": "public-landing",
          "X-Forwarded-For": `198.51.100.${40 + idx}`
        },
        body: JSON.stringify({ name: item.name, phone: item.phone, city: item.city })
      });
      assert.equal(pubRes.status, 200);
    }

    // Login Super Admin
    const loginRes = await fetch(`${running.base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "superadmin@layananpensiunan.id", password: PASSWORD })
    });
    assert.equal(loginRes.status, 200);
    const { access_token: token } = await loginRes.json();

    // 3. Verifikasi batas maksimum page_size <= 200 & ketahanan terhadap input non-numerik
    const boundedRes = await fetch(`${running.base}/api/leads?page_size=99999`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(boundedRes.status, 200);
    const boundedData = await boundedRes.json();
    assert.equal(boundedData.page_size, 200, "page_size wajib dibatasi maksimal 200");

    const nanPageRes = await fetch(`${running.base}/api/leads?page=abc&page_size=xyz`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(nanPageRes.status, 200);
    const nanPageData = await nanPageRes.json();
    assert.equal(nanPageData.page, 1);
    assert.equal(nanPageData.page_size, 10);
    assert.ok(nanPageData.items.length > 0);

    // Cek hasil routing ke-3 lead publik tadi
    const byPhone = new Map(boundedData.items.map((l) => [l.phone, l]));
    assert.equal(byPhone.get("081377770001")?.branch, "PADANG");
    assert.equal(byPhone.get("081377770002")?.branch, "BANJARMASIN");
    assert.equal(byPhone.get("081377770003")?.branch, "PUSAT JAKARTA");

    // 4. Multi-row impor tanpa nomor HP (ber-NOPEN unik) pada POST /api/imports TIDAK BOLEH terbuang sebagai duplikat
    const csvNoPhone = [
      "Nama Nasabah,Nomor HP,NOPEN,Kota,Gaji Pensiun",
      "PENSIUNAN TANPA HP 1,,14001111001,Kota Solok,4600000",
      "PENSIUNAN TANPA HP 2,,14001111002,Kota Banjarbaru,4900000",
      "PENSIUNAN TANPA HP 3,,14001111003,Kota Medan,5100000",
      "PENSIUNAN DUPLIKAT NOPEN,,14001111002,Kota Banjarbaru,4900000"
    ].join("\n");

    const importForm = new FormData();
    importForm.set("file", new Blob([csvNoPhone], { type: "text/csv" }), "tanpa_hp.csv");
    importForm.set("distribution_mode", "branch_pool");

    const impRes = await fetch(`${running.base}/api/imports`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: importForm
    });
    assert.equal(impRes.status, 200);
    const impData = await impRes.json();
    assert.equal(impData.inserted, 3, "Ketiga baris tanpa nomor HP dengan NOPEN unik wajib tersimpan semuanya");

    const afterImpRes = await fetch(`${running.base}/api/leads?page_size=200`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const afterImpLeads = (await afterImpRes.json()).items;
    const imported1 = afterImpLeads.find((l) => l.nopen === "14001111001");
    const imported2 = afterImpLeads.find((l) => l.nopen === "14001111002");
    const imported3 = afterImpLeads.find((l) => l.nopen === "14001111003");
    assert.ok(imported1 && imported2 && imported3);
    assert.equal(imported1.phone, "");
    assert.equal(imported1.branch, "PADANG");
    assert.equal(imported2.phone, "");
    assert.equal(imported2.branch, "BANJARMASIN");
    assert.equal(imported3.phone, "");
    assert.equal(imported3.branch, "MEDAN");

    // 5. Pembuatan paralel & revisi bukti klaim bekerja mulus dengan saveUploadedFile INSERT murni + UUID
    const parallelSims = await Promise.all(
      Array.from({ length: 6 }, (_, k) =>
        fetch(`${running.base}/api/simulations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            bank_key: "ams2",
            name: `UJI PARALEL ${k}`,
            birth_date: "1962-05-15",
            salary: 5000000,
            plafond: 50000000,
            tenor: 60
          })
        }).then(async (r) => ({ status: r.status, data: await r.json() }))
      )
    );
    for (const s of parallelSims) assert.equal(s.status, 200);
    const simIds = parallelSims.map((s) => s.data.id);
    assert.equal(new Set(simIds).size, 6, "Seluruh ID simulasi paralel wajib unik (UUID)");

    const claimForm = new FormData();
    claimForm.set("application_id", "app-p0-booked");
    claimForm.set("amount", "1500000");
    claimForm.set("file", new Blob([PDF], { type: "application/pdf" }), "akad_v1.pdf");
    const clmRes = await fetch(`${running.base}/api/claims`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: claimForm
    });
    assert.equal(clmRes.status, 200);
    const createdClaim = await clmRes.json();

    const proofV2 = Buffer.concat([PDF, Buffer.from("\n%v2")]);
    const proofForm = new FormData();
    proofForm.set("file", new Blob([proofV2], { type: "application/pdf" }), "akad_v2.pdf");
    const proofRes = await fetch(`${running.base}/api/claims/${createdClaim.id}/proof`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: proofForm
    });
    assert.equal(proofRes.status, 200);

    const dlProofRes = await fetch(`${running.base}/api/claims/${createdClaim.id}/file/booking`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(dlProofRes.status, 200);
    const dlBytes = Buffer.from(await dlProofRes.arrayBuffer());
    assert.deepEqual(dlBytes, proofV2);
  } finally {
    if (prevSiteKey === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = prevSiteKey;
    if (running) await running.stop();
    fixture.cleanup();
  }
});
