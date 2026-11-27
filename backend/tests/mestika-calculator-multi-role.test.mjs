import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PARTNER_PARAMETERS,
  MESTIKA_POLICY_VERSION,
  resolveMestikaConfig
} from "../src/config/default-parameters.js";
import {
  calculateMax,
  calculatePreview,
  datedifMonthsCalendar,
  parseIsoLocalDate
} from "../src/engines/calc-engine.js";
import { disposableBackend, runFixture, startFixture } from "./helpers/disposable.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PASSWORD = "Mestika-SiliconValley-10of10-Password!";

function loadFrontendCalculatorHelpers() {
  const calcPath = path.resolve(REPO_ROOT, "frontend/src/pages/Calculator.jsx");
  const calcSrc = fs.readFileSync(calcPath, "utf8");
  const helperCode = calcSrc.slice(
    calcSrc.indexOf("function addMonthsClampedLocal"),
    calcSrc.indexOf("export default function CalculatorPage")
  );
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(helperCode, sandbox);
  return sandbox;
}

function extractCookie(setCookieHeader, name) {
  if (!setCookieHeader) return "";
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader.join("; ") : String(setCookieHeader);
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : "";
}

async function apiJson(base, method, urlPath, { cookie = "", body } = {}) {
  const headers = {
    "X-Requested-With": "XMLHttpRequest"
  };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, data };
}

test("Mestika Unit & Golden Vectors: Damennaria Purba (v1.5 Official PDF), AMIR (Excel TBA-MSTK 1.0), age <66 tier, >=69 non-blocking notice, and DATEDIF calendar boundary", () => {
  const params = structuredClone(DEFAULT_PARTNER_PARAMETERS);
  assert.equal(params.bank_mestika.regulerMaxAgeYears, 66);
  assert.equal(params.bank_mestika.policyVersion, MESTIKA_POLICY_VERSION);

  // 1. Golden Vector #1: Ibu Damennaria Purba (Lahir 02-06-1961, Proses 27-11-2026 -> 65 thn 5 bln, Gaji IDPB 4.500.000, Plafond 407.300.000)
  // Wajib 100% cocok Rp 0 selisih dengan PDF Calc Official Bank Mestika versi 1.5!
  const damennariaInput = {
    bank_key: "bank_mestika",
    name: "Damennaria Purba",
    birth_date: "1961-06-02",
    process_date: "2026-11-27",
    salary: 4500000,
    mestika_salary_type: "idpb",
    mestika_has_dependents: "tidak",
    plafond: 407300000,
    tenor: 173,
    take_over: 0
  };
  const damMax = calculateMax(damennariaInput, params);
  assert.equal(damMax.processable, true);
  assert.equal(damMax.product_code, "reguler");
  assert.equal(damMax.product_label, "Reguler");
  assert.equal(damMax.bank_rate, 10);
  assert.equal(damMax.age, 65);
  assert.equal(damMax.age_months, 5);
  assert.equal(damMax.end_age_date, "2041-05-02");
  assert.equal(damMax.max_tenor, 173);
  assert.equal(damMax.max_installment, 4455000);
  assert.equal(damMax.max_plafond, 407391698);
  assert.equal(damMax.age_notice, false);

  const damPrev = calculatePreview(damennariaInput, params);
  assert.equal(damPrev.overall_ok, true);
  assert.equal(damPrev.plafond, 407300000);
  assert.equal(damPrev.tenor, 173);
  assert.equal(damPrev.bank_rate, 10);
  assert.equal(damPrev.coop_installment, 4453997);
  assert.equal(damPrev.total_fees, 89606000);
  assert.equal(damPrev.retention, 13361992);
  assert.equal(damPrev.mestika_details.total_deductions, 102967992);
  assert.equal(damPrev.net_disbursement, 304332008);
  assert.equal(damPrev.remaining_salary, 46003);
  assert.equal(damPrev.mestika_details.rec_max_plafond, 407391698);
  assert.equal(damPrev.mestika_details.age_notice, false);
  assert.deepEqual(damPrev.mestika_details.notices, []);

  // 2. Golden Vector #2: AMIR dari Workbook Sumber TBA-MSTK 1.0 (Lahir 1975-01-15, Proses 2026-10-29, Gaji 8.000.000)
  const amirPrev = calculatePreview(
    {
      bank_key: "bank_mestika",
      name: "AMIR",
      birth_date: "1975-01-15",
      process_date: "2026-10-29",
      salary: 8000000,
      mestika_salary_type: "idpb",
      plafond: 500000000,
      tenor: 240
    },
    params
  );
  assert.equal(amirPrev.overall_ok, true);
  assert.equal(amirPrev.age, 51);
  assert.equal(amirPrev.mestika_details.age_months, 9);
  assert.equal(amirPrev.mestika_details.remaining_age_months, 337);
  assert.equal(amirPrev.mestika_details.max_tenor, 240);
  assert.equal(amirPrev.mestika_details.rec_max_plafond, 500000000);
  assert.equal(amirPrev.mestika_details.rec_alt_plafond, 820706980);
  assert.equal(amirPrev.coop_installment, 4825108);
  assert.equal(amirPrev.total_fees, 110000000);
  assert.equal(amirPrev.retention, 14475325);
  assert.equal(amirPrev.net_disbursement, 375524675);
  assert.equal(amirPrev.remaining_salary, 3174892);

  // 3. Uji Batas Transisi Usia: 65 thn 11 bln (Reguler 10%) vs 66 thn 0 bln (Reguler Plus 12%)
  const edge65y11m = calculatePreview(
    {
      bank_key: "bank_mestika",
      name: "Edge 65y11m",
      birth_date: "1960-12-02",
      process_date: "2026-11-27",
      salary: 4500000,
      mestika_salary_type: "idpb"
    },
    params
  );
  assert.equal(edge65y11m.mestika_details.age_label, "65 thn 11 bln");
  assert.equal(edge65y11m.mestika_details.product_code, "reguler");
  assert.equal(edge65y11m.bank_rate, 10);
  assert.equal(edge65y11m.mestika_details.age_notice, false);

  const edge66y0m = calculatePreview(
    {
      bank_key: "bank_mestika",
      name: "Edge 66y0m",
      birth_date: "1960-11-27",
      process_date: "2026-11-27",
      salary: 4500000,
      mestika_salary_type: "idpb"
    },
    params
  );
  assert.equal(edge66y0m.mestika_details.age_label, "66 thn 0 bln");
  assert.equal(edge66y0m.mestika_details.product_code, "reguler_plus");
  assert.equal(edge66y0m.bank_rate, 12);
  assert.equal(edge66y0m.mestika_details.age_notice, false);

  // 4. Uji Keputusan CEO Point 2: Usia >= 69 tahun TIDAK DITOLAK, hanya menerbitkan Notice/Warning
  const age69Plus = calculatePreview(
    {
      bank_key: "bank_mestika",
      name: "Debitur Senior 69 Thn 5 Bln",
      birth_date: "1957-06-02",
      process_date: "2026-11-27",
      salary: 5000000,
      mestika_salary_type: "idpb"
    },
    params
  );
  assert.equal(age69Plus.mestika_details.age_label, "69 thn 5 bln");
  assert.equal(age69Plus.mestika_details.product_code, "reguler_plus");
  assert.equal(age69Plus.bank_rate, 12);
  assert.equal(age69Plus.mestika_details.errors.length, 0);
  assert.equal(age69Plus.mestika_details.warnings.length, 0);
  assert.equal(age69Plus.mestika_details.age_notice, true);
  assert.equal(age69Plus.mestika_details.notices.length, 1);
  assert.equal(age69Plus.overall_ok, true);
  assert.ok(age69Plus.plafond > 0 && age69Plus.net_disbursement > 0);
  const ageValidation = age69Plus.validations.find((v) => v.key === "age_entry");
  assert.equal(ageValidation?.ok, true);
  assert.equal(ageValidation?.notice, true);

  // 5. Uji Akurasi DATEDIF Akhir Bulan (Proses 31 Okt 2026, Lahir 31 Mei 1961 -> End 30 Apr 2041 = 173 bulan sesuai Excel DATEDIF)
  assert.equal(
    datedifMonthsCalendar(parseIsoLocalDate("2026-10-31"), parseIsoLocalDate("2041-04-30")),
    173
  );
  const monthEndCase = calculateMax(
    {
      bank_key: "bank_mestika",
      name: "Uji Akhir Bulan",
      birth_date: "1961-05-31",
      process_date: "2026-10-31",
      salary: 4500000,
      mestika_salary_type: "idpb"
    },
    params
  );
  assert.equal(monthEndCase.max_tenor, 173);

  // 6. Uji Legacy Production Config Normalization (regulerMaxAgeYears: 65 tanpa policyVersion -> 66)
  const legacyProdMestika = {
    ...DEFAULT_PARTNER_PARAMETERS.bank_mestika,
    regulerMaxAgeYears: 65
  };
  delete legacyProdMestika.policyVersion;
  const resolvedLegacy = resolveMestikaConfig(legacyProdMestika);
  assert.equal(resolvedLegacy.regulerMaxAgeYears, 66);
  assert.equal(resolvedLegacy.policyVersion, MESTIKA_POLICY_VERSION);

  // Jika Super Admin sudah secara sadar menyimpan angka khusus setelah policyVersion v2, jangan ditimpa!
  const explicitAdminCustom = resolveMestikaConfig({
    ...DEFAULT_PARTNER_PARAMETERS.bank_mestika,
    policyVersion: MESTIKA_POLICY_VERSION,
    regulerMaxAgeYears: 65
  });
  assert.equal(explicitAdminCustom.regulerMaxAgeYears, 65);
});

test("Mestika Multi-Role E2E Parity (Production Mode): super_admin, admin_ops, admin_branch, sales_manager, and marketing produce 100% identical live UI & API results, plus >=69 notice approval flow", { timeout: 120000 }, async () => {
  const fixture = disposableBackend();
  let running;
  try {
    // Siapkan database dengan state produksi lama (regulerMaxAgeYears: 65 tanpa policyVersion) untuk membuktikan
    // bahwa saat di-deploy ke VPS produksi tanpa reset DB, seluruh 5 role langsung mendapat aturan baru 66 thn!
    const setup = runFixture(
      fixture,
      `import { getStore, saveStore, db } from './src/db/database.js';
import { hashPassword } from './src/security/passwords.js';
const state = getStore();
const encoded = await hashPassword(${JSON.stringify(PASSWORD)});
const mkUser = (id, role, extra = {}) => ({
  id,
  name: 'User ' + id,
  email: id + '@mestika-parity.test',
  role,
  branch: 'MEDAN',
  bank_scope: 'all_bank',
  active: true,
  auth_version: 1,
  must_change_password: false,
  password_hash: encoded,
  ...extra
});
state.users = [
  mkUser('ceo', 'super_admin', { name: 'CEO Super Admin' }),
  mkUser('ops', 'admin_ops', { name: 'Admin Operasional' }),
  mkUser('branch', 'admin_branch', { name: 'Admin Cabang Medan' }),
  mkUser('sm', 'sales_manager', { name: 'SM Medan' }),
  mkUser('mkt', 'marketing', { name: 'NURUL ISRA ARTARI', manager_id: 'sm', manager_name: 'SM Medan' }),
  mkUser('mkt-bsi', 'marketing', { name: 'Marketing Khusus BSI', bank_scope: 'bsi_only', manager_id: 'sm', manager_name: 'SM Medan' })
];
// Simulasikan state database produksi lama di VPS sebelum patch ini (masih menyimpan regulerMaxAgeYears: 65 tanpa policyVersion)
state.partner_parameters.bank_mestika.regulerMaxAgeYears = 65;
delete state.partner_parameters.bank_mestika.policyVersion;
saveStore();
db.close();`
    );
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);

    // Jalankan server dengan NODE_ENV='production' persis seperti di VPS!
    running = await startFixture(fixture, "production");
    const sandbox = loadFrontendCalculatorHelpers();

    const rolesToVerify = [
      { id: "ceo", role: "super_admin", usesAdminParamsEndpoint: true },
      { id: "ops", role: "admin_ops", usesAdminParamsEndpoint: true },
      { id: "branch", role: "admin_branch", usesAdminParamsEndpoint: false },
      { id: "sm", role: "sales_manager", usesAdminParamsEndpoint: false },
      { id: "mkt", role: "marketing", usesAdminParamsEndpoint: false }
    ];

    const cookiesByRole = {};
    for (const r of rolesToVerify) {
      const loginRes = await apiJson(running.base, "POST", "/api/auth/login", {
        body: { email: `${r.id}@mestika-parity.test`, password: PASSWORD }
      });
      assert.equal(loginRes.status, 200, `Login gagal untuk role ${r.role}`);
      const cookie = extractCookie(loginRes.headers.get("set-cookie"), "lp_token");
      assert.ok(cookie, `Cookie lp_token wajib tersedia untuk role ${r.role}`);
      cookiesByRole[r.role] = cookie;
    }

    // Fungsi verifikasi kesamaan 100% di seluruh 5 role (baik helper UI frontend maupun API server)
    const verifyAllFiveRolesIdentical = async (expectedRegulerMaxAge, expectedRegulerRate) => {
      let referenceSnapshot = null;

      for (const r of rolesToVerify) {
        const cookie = cookiesByRole[r.role];

        // 1. Muat parameter persis seperti useEffect di Calculator.jsx untuk masing-masing role
        let roleMestikaParams;
        if (r.usesAdminParamsEndpoint) {
          const pRes = await apiJson(running.base, "GET", "/api/calc/params", { cookie });
          assert.equal(pRes.status, 200);
          roleMestikaParams = pRes.data.partners?.bank_mestika;
        } else {
          const lRes = await apiJson(running.base, "GET", "/api/calc/limits", { cookie });
          assert.equal(lRes.status, 200);
          roleMestikaParams = lRes.data.limits?.bank_mestika;
        }

        assert.ok(roleMestikaParams, `Parameter bank_mestika wajib diterima oleh role ${r.role}`);
        assert.equal(roleMestikaParams.regulerMaxAgeYears, expectedRegulerMaxAge, `regulerMaxAgeYears berbeda pada role ${r.role}`);
        assert.equal(roleMestikaParams.interestRateAnnual, expectedRegulerRate, `interestRateAnnual berbeda pada role ${r.role}`);

        // 2. Evaluasi helper rekomendasi live frontend Calculator.jsx (computeMestikaRecommendation) untuk Damennaria Purba
        const uiRecDamennaria = sandbox.computeMestikaRecommendation(
          {
            mestika_birth_iso: "1961-06-02",
            mestika_process_iso: "2026-11-27",
            salary: 4500000,
            mestika_salary_type: "idpb"
          },
          roleMestikaParams
        );

        // 3. Evaluasi helper rekomendasi live frontend untuk kasus Notice Usia >= 69 thn (69 thn 5 bln)
        const uiRecSenior = sandbox.computeMestikaRecommendation(
          {
            mestika_birth_iso: "1957-06-02",
            mestika_process_iso: "2026-11-27",
            salary: 4500000,
            mestika_salary_type: "idpb"
          },
          roleMestikaParams
        );
        assert.equal(uiRecSenior.canEstimate, true, `Usia >= 69 thn tidak boleh diblokir pada UI role ${r.role}`);
        assert.equal(uiRecSenior.ageRejected, false);
        assert.equal(uiRecSenior.ageNotice, true);

        // 4. Panggil endpoint backend /api/calc/max & /api/calc/preview sebagai role tersebut
        const maxRes = await apiJson(running.base, "POST", "/api/calc/max", {
          cookie,
          body: {
            bank_key: "bank_mestika",
            name: "Damennaria Purba",
            birth_date: "1961-06-02",
            process_date: "2026-11-27",
            salary: 4500000,
            mestika_salary_type: "idpb"
          }
        });
        assert.equal(maxRes.status, 200);

        const prevRes = await apiJson(running.base, "POST", "/api/calc/preview", {
          cookie,
          body: {
            bank_key: "bank_mestika",
            name: "Damennaria Purba",
            birth_date: "1961-06-02",
            process_date: "2026-11-27",
            salary: 4500000,
            mestika_salary_type: "idpb",
            plafond: 407300000,
            tenor: 173
          }
        });
        assert.equal(prevRes.status, 200);

        // 5. Pastikan angka rekomendasi UI == angka server pada role tersebut
        assert.equal(Math.round(uiRecDamennaria.maxPlafond), maxRes.data.max_plafond);
        assert.equal(uiRecDamennaria.maxTenor, maxRes.data.max_tenor);
        assert.equal(uiRecDamennaria.rateAnnual, maxRes.data.bank_rate);
        assert.equal(uiRecDamennaria.productLabel, maxRes.data.product_label);

        const roleSnapshot = {
          uiMaxPlafond: Math.round(uiRecDamennaria.maxPlafond),
          uiAltPlafond: Math.round(uiRecDamennaria.altPlafond),
          uiMaxTenor: uiRecDamennaria.maxTenor,
          uiRate: uiRecDamennaria.rateAnnual,
          uiProduct: uiRecDamennaria.productLabel,
          uiSeniorMaxPlafond: Math.round(uiRecSenior.maxPlafond),
          uiSeniorNotice: uiRecSenior.ageNotice,
          apiMaxPlafond: maxRes.data.max_plafond,
          apiInstallment: prevRes.data.coop_installment,
          apiTotalFees: prevRes.data.total_fees,
          apiRetention: prevRes.data.retention,
          apiTotalDeductions: prevRes.data.mestika_details.total_deductions,
          apiNetDisbursement: prevRes.data.net_disbursement,
          apiRemainingSalary: prevRes.data.remaining_salary
        };

        if (!referenceSnapshot) {
          referenceSnapshot = roleSnapshot;
        } else {
          assert.deepEqual(
            roleSnapshot,
            referenceSnapshot,
            `TERDETEKSI KETIDAKCOCOKAN HITUNGAN ANTARA ROLE ${r.role} DENGAN CEO (super_admin)!`
          );
        }
      }

      return referenceSnapshot;
    };

    // Tahap A: Verifikasi di atas DB produksi lama (otomatis ternormalisasi ke <66 thn, 10% p.a.)
    const snapDefault = await verifyAllFiveRolesIdentical(66, 10);
    assert.equal(snapDefault.apiMaxPlafond, 407391698);
    assert.equal(snapDefault.apiInstallment, 4453997);
    assert.equal(snapDefault.apiTotalDeductions, 102967992);
    assert.equal(snapDefault.apiNetDisbursement, 304332008);
    assert.equal(snapDefault.apiRemainingSalary, 46003);

    // Tahap B: Verifikasi End-to-End alur Simpan -> PDF/SVG/AI Summary -> Approve (Lanjut Berkas) untuk Usia >= 69 Thn oleh Marketing
    const mktCookie = cookiesByRole.marketing;
    const seniorSimRes = await apiJson(running.base, "POST", "/api/simulations", {
      cookie: mktCookie,
      body: {
        bank_key: "bank_mestika",
        name: "Nasabah Senior 69 Thn 5 Bln",
        birth_date: "1957-06-02",
        process_date: "2026-11-27",
        salary: 5000000,
        mestika_salary_type: "idpb",
        mestika_has_dependents: "tidak"
      }
    });
    assert.equal(seniorSimRes.status, 200, "Simulasi usia >= 69 thn wajib berhasil disimpan");
    assert.equal(seniorSimRes.data.policy_version, MESTIKA_POLICY_VERSION);
    assert.equal(seniorSimRes.data.result.overall_ok, true);
    assert.equal(seniorSimRes.data.result.mestika_details.age_notice, true);

    const simId = seniorSimRes.data.id;
    const pdfRes = await apiJson(running.base, "GET", `/api/simulations/${simId}/pdf`, { cookie: mktCookie });
    assert.equal(pdfRes.status, 200);
    const pdfText = pdfRes.data.toString("latin1");
    assert.ok(pdfText.includes("Total Potongan Pencairan"), "PDF wajib menampilkan Total Potongan Pencairan");
    assert.ok(pdfText.includes("CATATAN / NOTICE KETENTUAN"), "PDF wajib menampilkan kotak Notice Ketentuan Usia");

    const svgRes = await apiJson(running.base, "GET", `/api/simulations/${simId}/png`, { cookie: mktCookie });
    assert.equal(svgRes.status, 200);
    const svgText = svgRes.data.toString("utf8");
    assert.ok(svgText.includes("Notice Usia"), "SVG wajib menampilkan Notice Usia");

    const aiRes = await apiJson(running.base, "POST", `/api/simulations/${simId}/ai-summary`, { cookie: mktCookie });
    assert.equal(aiRes.status, 200);
    assert.ok(aiRes.data.summary.includes("Notice Ketentuan"), "AI summary wajib mencantumkan Notice Ketentuan");

    const approveRes = await apiJson(running.base, "POST", `/api/simulations/${simId}/approve`, {
      cookie: mktCookie,
      body: { phone: "081234567890" }
    });
    assert.equal(approveRes.status, 200, "Pengajuan berkas untuk simulasi dengan Notice Usia >= 69 thn TIDAK BOLEH ditolak!");
    assert.ok(approveRes.data.app_no);

    // Tahap C: Super Admin mengubah parameter secara dinamis (mis. Bunga Reguler -> 9.5% & Batas Reguler -> 67 thn)
    // Seluruh 5 role wajib ikut berubah secara serempak dan tetap 100% identik!
    const updateParamRes = await apiJson(running.base, "PUT", "/api/calc/params/bank_mestika", {
      cookie: cookiesByRole.super_admin,
      body: {
        updates: {
          interestRateAnnual: 9.5,
          regulerMaxAgeYears: 67
        }
      }
    });
    assert.equal(updateParamRes.status, 200);
    const snapUpdated = await verifyAllFiveRolesIdentical(67, 9.5);
    assert.ok(snapUpdated.apiMaxPlafond > snapDefault.apiMaxPlafond, "Penurunan bunga ke 9.5% wajib menaikkan plafond maksimal di seluruh 5 role");

    // Tahap D: Pastikan akun bsi_only tetap terisolasi ketat (tidak bocor akses bank_mestika)
    const bsiLogin = await apiJson(running.base, "POST", "/api/auth/login", {
      body: { email: "mkt-bsi@mestika-parity.test", password: PASSWORD }
    });
    assert.equal(bsiLogin.status, 200);
    const bsiCookie = extractCookie(bsiLogin.headers.get("set-cookie"), "lp_token");
    const bsiLimits = await apiJson(running.base, "GET", "/api/calc/limits", { cookie: bsiCookie });
    assert.equal(bsiLimits.status, 200);
    assert.equal(bsiLimits.data.limits.bank_mestika, undefined, "Akun bsi_only tidak boleh menerima bank_mestika");
    const bsiPreview = await apiJson(running.base, "POST", "/api/calc/preview", {
      cookie: bsiCookie,
      body: { bank_key: "bank_mestika", name: "Tes", birth_date: "1961-06-02", process_date: "2026-11-27", salary: 4500000 }
    });
    assert.equal(bsiPreview.status, 403, "Akun bsi_only wajib ditolak 403 pada bank_mestika");
  } finally {
    if (running) await running.stop();
    fixture.cleanup();
  }
});
