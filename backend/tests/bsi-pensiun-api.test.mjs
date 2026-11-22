import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { createPensionPreviewRouter } from "../src/routes/bsi-pensiun-preview.js";

const INPUT = {
  birth_date: "1966-06-10", process_date: "2026-10-01", insurance_start_date: "2026-10-01",
  first_installment_date: "2026-11-01", pension_salary: 2301400, principal: 166000000,
  tenor_months: 169, base_rate_pct: 10.5, retired_type: "pensiunan", spouse_status: "single",
  ratio_basis: "DBR", ratio_pct: 90, ongoing_installments: 0, settlement_amount: 0, flagging: "TASPEN_CTP"
};

// Isolated router HTTP contract; real application auth is exercised separately on a disposable server.
async function withRouter(options, work) {
  const app = express();
  app.use(express.json({ limit: "4kb" }));
  app.use("/api/bsi-pensiun", createPensionPreviewRouter(options));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await work(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
const post = (url, body) => fetch(`${url}/api/bsi-pensiun/compare`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
});

test("API flag OFF and production are closed, including attempts to enable through payload", async () => {
  for (const options of [{ enabled: false, production: false }, { enabled: true, production: true }]) {
    await withRouter(options, async (base) => {
      assert.equal((await fetch(`${base}/api/bsi-pensiun/status`)).status, 404);
      assert.equal((await post(base, { ...INPUT, enabled: true })).status, 404);
    });
  }
});

test("API returns both independent scenarios without cache and rejects unrecognized input", async () => {
  await withRouter({ enabled: true, production: false }, async (base) => {
    const status = await fetch(`${base}/api/bsi-pensiun/status`);
    assert.equal(status.status, 200);
    const response = await post(base, INPUT);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json();
    assert.equal(result.status, "VALIDATION_ONLY");
    assert.equal(result.scenarios.atribusi_premi.installment, 2048954.50);
    assert.equal(result.can_submit, false);
    const bad = await post(base, { ...INPUT, approved: true });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).field, "approved");
  });
});

test("API validation rejects non-calendar dates and empty money without silently replacing them", async () => {
  await withRouter({ enabled: true, production: false }, async (base) => {
    for (const overrides of [{ birth_date: "1966-02-31" }, { principal: "" }, { tenor_months: 0 }, { ratio_pct: 95 }]) {
      assert.equal((await post(base, { ...INPUT, ...overrides })).status, 400);
    }
  });
});
