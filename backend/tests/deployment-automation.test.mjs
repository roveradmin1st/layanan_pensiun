import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

test("1. Package Release Controller (ops/package_release.py) structure & denylist rules", () => {
  const pkgScriptPath = path.join(ROOT, "ops/package_release.py");
  assert.ok(fs.existsSync(pkgScriptPath), "ops/package_release.py must exist");

  const content = fs.readFileSync(pkgScriptPath, "utf8");
  assert.match(content, /lp-production-20261109-v1/, "Data contract must be lp-production-20261109-v1");
  assert.match(content, /DENYLIST_PATTERNS/, "Denylist patterns must be defined");
  assert.match(content, /\.git/, "Denylist must exclude .git");
  assert.match(content, /\.env/, "Denylist must exclude .env");
  assert.match(content, /\.sqlite/, "Denylist must exclude .sqlite");
  assert.match(content, /backend\/data/, "Denylist must exclude backend/data");
  assert.match(content, /private\.json/, "Denylist must exclude private credentials");
  assert.match(content, /ops\//, "Denylist must exclude ops/ privileged tools");
  assert.match(content, /tests\//, "Denylist must exclude test files");
});

test("2. Server Release Controller (ops/server_release.py) interface & safeguards", () => {
  const relScriptPath = path.join(ROOT, "ops/server_release.py");
  assert.ok(fs.existsSync(relScriptPath), "ops/server_release.py must exist");

  const content = fs.readFileSync(relScriptPath, "utf8");
  assert.match(content, /lp-production-20261109-v1/, "Data contract must match lp-production-20261109-v1");
  assert.match(content, /CURRENT_PID_MISMATCH/, "Must detect CURRENT_PID_MISMATCH incident");
  assert.match(content, /no_op_already_active/, "Must support idempotent no-op when already active");
  assert.match(content, /execute_backup_safely/, "Must verify backup before activation");
  assert.match(content, /BACKUP_NOT_VERIFIED/, "Must fail if backup cannot be verified");
  assert.match(content, /failed_code_restored/, "Must support safe code rollback without touching live database");
  assert.match(content, /current_next/, "Must use atomic symlink replacement");
  assert.match(content, /shared\/data/, "Must symlink backend/data to shared/data");
  assert.match(content, /STARTUP_FAILED/, "Must handle startup timeout and failure");
});

test("3. Deployment Workflow (.github/workflows/deploy.yml) specification", () => {
  const deployYamlPath = path.join(ROOT, ".github/workflows/deploy.yml");
  assert.ok(fs.existsSync(deployYamlPath), "deploy.yml must exist");

  const content = fs.readFileSync(deployYamlPath, "utf8");
  assert.match(content, /workflow_dispatch:/, "Must be triggered via workflow_dispatch");
  assert.match(content, /commit_sha:/, "Must accept commit_sha input");
  assert.match(content, /\[0-9a-f\]\{40\}/, "Must strictly validate 40-character hex commit SHA");
  assert.match(content, /environment:\s*production/, "Must target production environment");
  assert.match(content, /group:\s*production-deployment/, "Must have global production-deployment concurrency group");
  assert.match(content, /cancel-in-progress:\s*false/, "cancel-in-progress must be false");
  assert.match(content, /runtime-release-\$TARGET_SHA/, "Must download exact runtime release artifact");
  assert.match(content, /lp-release apply/, "Must invoke server release controller lp-release apply");
});

test("4. Validation Workflow (.github/workflows/validate.yml) artifact packaging", () => {
  const valYamlPath = path.join(ROOT, ".github/workflows/validate.yml");
  assert.ok(fs.existsSync(valYamlPath), "validate.yml must exist");

  const content = fs.readFileSync(valYamlPath, "utf8");
  assert.match(content, /ops\/package_release\.py/, "validate.yml must package release via ops/package_release.py");
  assert.match(content, /runtime-release-\$\{\{\s*github\.sha\s*\}\}/, "Must upload runtime-release artifact");
});

test("5. PM2 Ecosystem configuration (ops/ecosystem.config.cjs)", () => {
  const ecoPath = path.join(ROOT, "ops/ecosystem.config.cjs");
  assert.ok(fs.existsSync(ecoPath), "ecosystem.config.cjs must exist");

  const content = fs.readFileSync(ecoPath, "utf8");
  assert.match(content, /layanan-pensiunan-api/, "App name must be layanan-pensiunan-api");
  assert.match(content, /exec_mode:\s*['"]fork['"]/, "Exec mode must be single fork instance");
  assert.match(content, /instances:\s*1/, "Must have exactly 1 instance");
  assert.match(content, /PORT:\s*['"]4000['"]/, "Must listen on port 4000");
  assert.match(content, /127\.0\.0\.1/, "Host must be 127.0.0.1");
});
