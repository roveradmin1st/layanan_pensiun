// ============================================================================
// SKRIP E2E UI BROWSER — BNI FLEKSI PENSIUN (DB DISPOSABLE & DATA SINTETIS)
// Menguji alur login, Kalkulator BNI, Contoh Uji sintetis, UNAVAILABLE Kode 2,
// isolasi Sales Manager / Marketing / bsi_only, serta panel Pengaturan BNI.
// Prasyarat: frontend/dist sudah dibangun (`npm --prefix frontend run build`).
// Penggunaan: node backend/tests/bni-ui-e2e.mjs
// ============================================================================

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { disposableBackend, runFixture, startFixture } from "./helpers/disposable.mjs";
import { LEGACY_BNI } from "./helpers/legacy-bni.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const FRONTEND_DIST = path.join(REPO_ROOT, "frontend", "dist");
const PASSWORD = "Bni-Browser-Synthetic-2026!";
assert.ok(fs.existsSync(path.join(FRONTEND_DIST, "index.html")), "frontend/dist/index.html belum tersedia; jalankan `npm --prefix frontend run build`.");

async function loadPlaywrightOrNull() {
  try {
    const pw = await import("../../frontend/node_modules/playwright/index.mjs");
    return pw.chromium || pw.default?.chromium || null;
  } catch {
    return null;
  }
}

function findLocalChromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome"
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function createCdpClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    ws.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          return new Promise((res, rej) => {
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() { ws.close(); }
      });
    });
    ws.addEventListener("message", (evt) => {
      const msg = JSON.parse(String(evt.data));
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });
    ws.addEventListener("error", (err) => reject(err));
  });
}

async function createBrowserDriver() {
  const pwChromium = await loadPlaywrightOrNull();
  if (pwChromium) {
    const executablePath = process.argv.includes("--system-chromium") ? "/usr/bin/chromium" : undefined;
    const browser = await pwChromium.launch({ executablePath, headless: true });
    let context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
    await context.addInitScript(() => sessionStorage.setItem("lp_bypass_pwa", "1"));
    let page = await context.newPage();
    return {
      mode: "playwright",
      async resetSession(base) {
        await context.close();
        context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
        await context.addInitScript(() => sessionStorage.setItem("lp_bypass_pwa", "1"));
        page = await context.newPage();
        await page.goto(`${base}/login`);
      },
      async goto(url) { await page.goto(url); },
      async eval(expr) { return page.evaluate(expr); },
      async close() { await browser.close(); }
    };
  }

  const binPath = findLocalChromeBinary();
  if (!binPath) {
    throw new Error("Playwright maupun biner Chrome/Chromium lokal tidak ditemukan. Set CHROME_PATH atau jalankan `npx playwright install chromium`.");
  }
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-bni-e2e-"));
  const proc = spawn(
    binPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "about:blank"
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  let stderr = "";
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Browser startup timeout: " + stderr)), 15000);
    proc.stderr.on("data", (d) => {
      stderr += String(d);
      const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(stderr);
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    });
    proc.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Browser exited (${code}): ${stderr}`)); });
  });
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = pages.find((p) => p.type === "page") || pages[0];
  const cdp = await createCdpClient(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");

  const evalExpr = async (expr) => {
    const r = await cdp.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("Page JS error: " + JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };
  return {
    mode: `cdp:${path.basename(binPath)}`,
    async resetSession(base) {
      await cdp.send("Network.clearBrowserCookies");
      await cdp.send("Page.navigate", { url: `${base}/login` });
      for (let i = 0; i < 60; i++) {
        if (await evalExpr(`location.origin === ${JSON.stringify(base)} && document.readyState === 'complete'`)) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      await evalExpr(`(() => { try { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('lp_bypass_pwa', '1'); } catch {} return true; })()`);
      await cdp.send("Page.navigate", { url: `${base}/login` });
    },
    async goto(url) { await cdp.send("Page.navigate", { url }); },
    async eval(expr) { return evalExpr(expr); },
    async close() {
      try { cdp.close(); } catch { /* ignore */ }
      try {
        const exited = new Promise((r) => proc.once("exit", r));
        proc.kill();
        await Promise.race([exited, new Promise((r) => setTimeout(r, 2000))]);
      } catch { /* ignore */ }
      try { fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* ignore */ }
    }
  };
}

async function waitFor(driver, predicateExpr, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await driver.eval(predicateExpr)) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`waitFor timeout (${timeoutMs}ms): ${predicateExpr}`);
}

const fixture = disposableBackend();
let running = null;
let driver = null;

try {
  const fixtureDist = path.join(fixture.root, "frontend", "dist");
  fs.rmSync(fixtureDist, { recursive: true, force: true });
  fs.cpSync(FRONTEND_DIST, fixtureDist, { recursive: true });

  const setupRes = runFixture(fixture, `import { getStore, saveStore, db } from './src/db/database.js';
import { hashPassword } from './src/security/passwords.js';
const state = getStore();
const hash = await hashPassword(${JSON.stringify(PASSWORD)});
for (const user of state.users) {
  user.password_hash = hash;
  user.must_change_password = false;
}
state.partner_parameters.bank_bni = ${JSON.stringify(LEGACY_BNI)};
const uMkt1 = state.users.find(u => u.email === 'marketing@layananpensiunan.id');
const uSm1 = state.users.find(u => u.email === 'salesmanager@layananpensiunan.id');
uMkt1.manager_id = uSm1.id;
state.users.push({
  ...structuredClone(uSm1),
  id: 'u-sm-other-e2e',
  name: 'SM SINTETIS BANDUNG',
  email: 'sm2.bni@synthetic.test'
});
saveStore();
db.close();`);
  assert.equal(setupRes.status, 0, setupRes.stderr);

  running = await startFixture(fixture, "production");
  driver = await createBrowserDriver();

  async function uiLogin(email) {
    await driver.resetSession(running.base);
    await waitFor(driver, `Boolean(document.querySelector('[data-testid="login-email-input"]'))`);
    await driver.eval(`(() => {
      const setVal = (el, val) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setVal(document.querySelector('[data-testid="login-email-input"]'), ${JSON.stringify(email)});
      setVal(document.querySelector('[data-testid="login-password-input"]'), ${JSON.stringify(PASSWORD)});
      document.querySelector('[data-testid="login-submit-button"]').click();
      return true;
    })()`);
    await waitFor(driver, `!location.pathname.includes('/login') && Boolean(document.querySelector('nav'))`);
  }

  const openBni = async (page, selector) => {
    await driver.goto(`${running.base}/${page}`);
    await waitFor(driver, `Array.from(document.querySelectorAll('button')).some(el => el.innerText.includes('Bank BNI'))`);
    await driver.eval(`Array.from(document.querySelectorAll('button')).find(el => el.innerText.includes('Bank BNI')).click()`);
    await waitFor(driver, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  };

  // Aktivasi lewat UI pada baseline lama, memakai backend mode production.
  await uiLogin("superadmin@layananpensiunan.id");
  await openBni("pengaturan", '[data-testid="activate-bni-button"]');
  await driver.eval(`(() => {
    const confirm = window.confirm;
    window.confirm = () => true;
    try { document.querySelector('[data-testid="activate-bni-button"]').click(); }
    finally { window.confirm = confirm; }
  })()`);
  await waitFor(driver, `Boolean(document.querySelector('[data-testid="bni-params-panel"]'))`);
  assert.match(await driver.eval(`document.querySelector('[data-testid="bni-params-panel"]').innerText`), /bni-fleksi-jul26-v1/);
  assert.equal(await driver.eval(`document.querySelector('[data-testid="bni-param-dbr-input"]').value`), "85");

  // 1. Marketing: Kalkulator BNI-01 -> Simpan -> Kode 2 UNAVAILABLE
  await uiLogin("marketing@layananpensiunan.id");
  await openBni("kalkulator", '[data-testid="bni-prefill-btn"]');
  await waitFor(driver, `document.querySelector('[data-testid="bni-dbr-select"]')?.value === '85'`);
  await driver.eval(`(() => {
    const select = document.querySelector('[data-testid="bni-dbr-select"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '70');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal(await driver.eval(`document.querySelector('[data-testid="bni-dbr-select"]').value`), "70");
  await driver.eval(`document.querySelector('[data-testid="bni-reset-button"]').click()`);
  await waitFor(driver, `document.querySelector('[data-testid="bni-dbr-select"]')?.value === '85'`);
  await driver.eval(`document.querySelector('[data-testid="bni-prefill-btn"]').click()`);
  assert.equal(await driver.eval(`document.querySelector('[data-testid="bni-birth-input"]').value`), "1969-01-15");
  assert.equal(await driver.eval(`document.querySelector('[data-testid="bni-process-date-input"]').value`), "2026-11-17");

  await driver.eval(`document.querySelector('[data-testid="bni-submit-button"]').click()`);
  await waitFor(driver, `Boolean(document.querySelector('[data-testid="result-net"]'))`);
  const resUi = await driver.eval(`({
    status: document.querySelector('[data-testid="bni-result-status"]')?.innerText,
    installment: document.querySelector('[data-testid="result-coop-installment"]')?.innerText,
    net: document.querySelector('[data-testid="result-net"]')?.innerText,
    saveVisible: Boolean(document.querySelector('[data-testid="calc-save-button"]'))
  })`);
  assert.match(resUi.status, /PASSED/);
  assert.match(resUi.installment, /2\.477\.899,58/);
  assert.match(resUi.net, /60\.659\.405,81/);
  assert.equal(resUi.saveVisible, true);

  await driver.eval(`document.querySelector('[data-testid="calc-save-button"]').click()`);
  await waitFor(driver, `Boolean(document.querySelector('[data-testid="sim-approval-panel"]'))`);

  await openBni("kalkulator", '[data-testid="bni-prefill-btn"]');
  await driver.eval(`document.querySelector('[data-testid="bni-prefill-btn"]').click()`);
  for (const [id, value] of [
    ["bni-product-select", "1"], ["bni-birth-input", "1954-10-31"],
    ["bni-loan-input", "30000000"], ["bni-tenor-input", "24"]
  ]) {
    await driver.eval(`(() => {
      const el = document.querySelector('[data-testid="${id}"]');
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    })()`);
  }
  await driver.eval(`document.querySelector('[data-testid="bni-submit-button"]').click()`);
  await waitFor(driver, `document.querySelector('[data-testid="bni-result-status"]')?.innerText.includes('Perlu verifikasi aturan asuransi')`);
  await driver.eval(`document.querySelector('[data-testid="calc-save-button"]').click()`);
  await waitFor(driver, `Boolean(document.querySelector('[data-testid="bni-approval-hold"]'))`);
  assert.equal(await driver.eval(`Boolean(document.querySelector('[data-testid="approve-sim-button"]'))`), false);

  await openBni("kalkulator", '[data-testid="bni-product-select"]');
  await driver.eval(`(() => {
    const sel = document.querySelector('[data-testid="bni-product-select"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, '2');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-testid="bni-submit-button"]').click();
  })()`);
  await waitFor(driver, `Boolean(document.querySelector('[data-testid="bni-unavailable-banner"]'))`);
  assert.equal(await driver.eval(`Boolean(document.querySelector('[data-testid="calc-save-button"]'))`), false);

  // 2. Sales Manager vs SM lain di UI
  await uiLogin("salesmanager@layananpensiunan.id");
  await driver.goto(`${running.base}/simulasi`);
  await waitFor(driver, `document.body.innerText.includes('CONTOH DEBITUR SINTETIS BNI-01')`);

  await uiLogin("sm2.bni@synthetic.test");
  await driver.goto(`${running.base}/simulasi`);
  await waitFor(driver, `document.body.innerText.includes('Simulasi') || document.body.innerText.includes('Riwayat')`);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(await driver.eval(`document.body.innerText.includes('CONTOH DEBITUR SINTETIS BNI-01')`), false);

  // 3. Akun bsi_only di UI
  await uiLogin("admincabang.bsi@layananpensiunan.id");
  await driver.goto(`${running.base}/kalkulator`);
  await waitFor(driver, `document.body.innerText.includes('BSI') || document.body.innerText.includes('Bank Syariah')`);
  assert.equal(await driver.eval(`document.body.innerText.includes('Bank BNI') || document.body.innerText.includes('BNI Fleksi')`), false);
  await driver.goto(`${running.base}/simulasi`);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(await driver.eval(`document.body.innerText.includes('CONTOH DEBITUR SINTETIS BNI-01')`), false);

  console.log("BNI UI E2E PASSED:", JSON.stringify({ driver: driver.mode, productionActivation: true, defaultDbr: 85, underwritingHold: true, ...resUi }));
} finally {
  if (driver) await driver.close();
  if (running) await running.stop();
  try { fixture.cleanup(); } catch { /* ignore */ }
}
