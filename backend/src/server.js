// ============================================================================
// LAYANAN PENSIUNAN — ENTERPRISE REST API SERVER (Express + SQLite + JWT RBAC)
// ============================================================================

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { DEFAULT_PARTNER_PARAMETERS } from "./config/default-parameters.js";
import {
  BSI_PRODUCT_CODES,
  createDefaultBsiProducts,
  splitMaturityAgeMonths,
  validateAndApplyBsiProductUpdate
} from "./config/bsi-product-config.js";
import { MASTER_BRANCHES, KANWIL_BRANCHES, normalizeBranch, resolveBranchFromCityOrText } from "./config/branches.js";
import { createPensionPreviewRouter } from "./routes/bsi-pensiun-preview.js";
import {
  calculateMax,
  calculatePreview,
  computeAgeDetail,
  generateSimulationPdfBuffer,
  generateSimulationSvgBuffer
} from "./engines/calc-engine.js";
import {
  getStore,
  saveStore,
  withTransaction,
  addAuditLog,
  APP_STAGES,
  DOC_TEMPLATE,
  saveUploadedFile,
  getUploadedFile,
  deleteUploadedFile,
  getAllUploadedFiles,
  restoreUploadedFileFromBackup
} from "./db/database.js";
import crypto from "node:crypto";
import { hashPassword, verifyPassword, passwordProblem, isDefaultPassword, PasswordServiceBusy } from "./security/passwords.js";
import { LoginLimiter } from "./security/login-limiter.js";
import { documentVersion, documentHash, documentFileId, documentAccepted } from "./security/application-documents.js";
import { buildZipBuffer, sanitizeSafeFilename } from "./utils/zip-builder.js";
import { parseImportFile } from "./utils/lead-import-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const IS_PROD = process.env.NODE_ENV === "production";
const DEFAULT_DEV_JWT_SECRET = "lp_enterprise_jwt_secret_2026_ams2_bsi";
const KNOWN_INSECURE_JWT_SECRETS = new Set([
  "lp_enterprise_jwt_secret_2026_ams2_bsi",
  "4f8b9e1a3c7d5f2e6a0b8c4d2e9f1a3b5c7e9d0f2a4b6c8d1e3f5a7b9c0d2e4f",
  "lp_production_jwt_secret_min32chars_key_2026_enterprise",
  "secret",
  "changeme",
  "12345678901234567890123456789012"
]);

if (
  IS_PROD &&
  (!process.env.JWT_SECRET ||
    String(process.env.JWT_SECRET).trim().length < 32 ||
    KNOWN_INSECURE_JWT_SECRETS.has(String(process.env.JWT_SECRET).trim()))
) {
  console.error(
    "[FATAL] Production startup aborted: JWT_SECRET wajib dikonfigurasi secara aman (minimal 32 karakter dan tidak boleh menggunakan nilai contoh/fallback repo)."
  );
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET;

const ROLE_LABEL = {
  super_admin: "Super Admin",
  admin_ops: "Admin Operasional",
  admin_branch: "Admin Cabang/Mitra",
  sales_manager: "Sales Manager",
  marketing: "Marketing"
};

const app = express();
app.set("trust proxy", 1);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 24, fieldSize: 64 * 1024, parts: 26 } });

app.use(cors({ origin: IS_PROD ? false : true, credentials: true, exposedHeaders: ["X-Document-Version", "X-Document-SHA256", "Content-Disposition"] }));
app.use("/api/auth", express.json({ limit: "8kb" }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Security Headers (Enterprise Financial Standard)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  next();
});

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    role_label: ROLE_LABEL[u.role] || u.role,
    branch: normalizeBranch(u.branch || "PUSAT JAKARTA"),
    bank_scope: u.bank_scope || "all_bank",
    phone: u.phone || "",
    active: u.active !== false,
    must_change_password: u.must_change_password === true,
    capabilities: { web_restore: !IS_PROD },
    manager_id: u.manager_id || null,
    manager_name: u.manager_name || null
  };
}

function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role, ver: user.auth_version || 0 }, JWT_SECRET, { expiresIn: "12h" });
  res.cookie("lp_token", token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge: 12 * 3600 * 1000
  });
  return token;
}

function getAuthUser(req) {
  const store = getStore();
  let token = req.cookies?.lp_token;
  const authHeader = req.headers.authorization;
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = store.users.find((u) => u.id === decoded.sub && u.active !== false);
    return user && Number.isInteger(decoded.ver) && decoded.ver === (user.auth_version || 0) ? user : null;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ detail: "Sesi berakhir atau belum login." });
  req.user = user;
  if (user.must_change_password && !["/api/auth/me", "/api/auth/change-password"].includes(req.path)) {
    return res.status(403).json({ error_code: "PASSWORD_CHANGE_REQUIRED", detail: "Perbarui kata sandi pribadi sebelum melanjutkan." });
  }
  next();
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const loginLimiter = new LoginLimiter({ accountLimit: IS_PROD ? 10 : 500, ipLimit: IS_PROD ? 100 : 5000 });
function reserveLogin(req, res, email) {
  const value = loginLimiter.reserve(req.ip, email);
  if (value.allowed) return true;
  res.setHeader("Retry-After", String(value.retryAfter));
  res.status(429).json({ detail: "Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba kembali." });
  return false;
}
function currentActor(req) {
  const actor = getAuthUser(req);
  if (!actor) { const error = new Error("Sesi berubah. Silakan masuk kembali."); error.status = 401; throw error; }
  req.user = actor;
  return actor;
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ detail: "Akses ditolak untuk peran Anda." });
    }
    next();
  };
}

// ============================================================================
// AUTHORIZATION & ACCESS CONTROL HELPERS (Role, Cabang, Bank Scope & Ownership)
// ============================================================================
function isGlobalBranchScope(user) {
  if (!user) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  const b = String(user.branch || "").trim().toUpperCase();
  return b === "ALL" || b === "ALL_BRANCH" || b === "ALL BANK";
}

function canAccessBranch(user, entityBranch) {
  if (!user) return false;
  if (isGlobalBranchScope(user)) return true;
  if (!entityBranch) return false;
  return normalizeBranch(entityBranch) === normalizeBranch(user.branch);
}

export function isBsiBankKey(bankKey) {
  const k = String(bankKey || "").trim().toLowerCase();
  return k === "bsi_prapen" || k === "bsi" || k.includes("bsi") || k.includes("syariah indonesia");
}

export function isBsiScopedUser(user) {
  if (!user) return false;
  const scope = String(user.bank_scope || "").trim().toLowerCase();
  return scope === "bsi_only" || scope === "bsi" || scope === "bsi_prapen";
}

// Aturan Owner: Admin Cabang All Bank dapat melihat seluruh bank (termasuk BSI),
// sedangkan akun khusus BSI (bank_scope === "bsi_only") tidak boleh mencampuri atau melihat bank lain.
function canAccessBank(user, bankKey) {
  if (!user) return false;
  if (isBsiScopedUser(user)) {
    return isBsiBankKey(bankKey);
  }
  return true;
}

export function canAccessUserScope(actor, target) {
  if (!actor || !target) return false;
  if (actor.role === "super_admin" || actor.role === "admin_ops") return true;
  if (isBsiScopedUser(actor) && !isBsiScopedUser(target)) return false;
  return true;
}

export function detectSafeDocumentType(buffer, originalFilename = "") {
  if (!buffer || buffer.length < 4) return null;
  const headStr = buffer.slice(0, 256).toString("utf8").toLowerCase();
  if (
    headStr.includes("<html") ||
    headStr.includes("<!doctype html") ||
    headStr.includes("<script") ||
    headStr.includes("<svg") ||
    headStr.includes("<?xml") ||
    headStr.includes("<iframe")
  ) {
    return null;
  }
  // PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { mime: "application/pdf", ext: "pdf" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  return null;
}

/**
 * Mengecek apakah seorang user marketing berada di bawah supervisi langsung Sales Manager `smUser`
 * pada cabang yang sama.
 */
function isMarketingInSmTeam(store, smUser, marketingId) {
  if (!store || !smUser || smUser.role !== "sales_manager" || !marketingId) return false;
  const mkt = store.users.find((u) => u.id === marketingId && u.role === "marketing");
  if (!mkt || !canAccessBranch(smUser, mkt.branch)) return false;
  if (mkt.manager_id === smUser.id) return true;
  if (mkt.manager_id && mkt.manager_id !== smUser.id) return false;
  const activeSmsInBranch = store.users.filter(
    (u) => u.role === "sales_manager" && u.active !== false && canAccessBranch(smUser, u.branch)
  );
  return activeSmsInBranch.length === 1 && activeSmsInBranch[0].id === smUser.id;
}

/**
 * Mengecek apakah sebuah entitas (lead/sim/app/claim) secara eksplisit dimiliki oleh Sales Manager LAIN.
 */
function isOwnedByAnotherSm(store, smUser, entitySalesManagerId, entityMarketingId) {
  if (!smUser || smUser.role !== "sales_manager") return false;
  if (entitySalesManagerId && entitySalesManagerId !== smUser.id) return true;
  if (entityMarketingId && store) {
    const mkt = store.users.find((u) => u.id === entityMarketingId);
    if (mkt && mkt.manager_id && mkt.manager_id !== smUser.id) return true;
  }
  return false;
}

/**
 * Mengecek apakah sebuah Lead berada dalam wewenang Sales Manager `smUser`.
 */
function isLeadInSmScope(store, smUser, lead) {
  if (!smUser || !lead || smUser.role !== "sales_manager") return false;
  if (!canAccessBranch(smUser, lead.branch) && lead.sales_manager_id !== smUser.id) return false;
  if (isOwnedByAnotherSm(store, smUser, lead.sales_manager_id, lead.assigned_to)) return false;
  if (lead.sales_manager_id === smUser.id) return true;
  if (lead.assigned_to && isMarketingInSmTeam(store, smUser, lead.assigned_to)) return true;
  return false;
}

/**
 * Helper sinkronisasi atribusi SM dari Marketing:
 * Memastikan setiap kali lead/sim/app/claim terhubung ke seorang Marketing,
 * atribut sales_manager_id dan sales_manager_name selalu sinkron dengan manager_id Marketing tersebut.
 */
function resolveSmForMarketing(store, marketingUser, fallbackSmId = null, fallbackSmName = null) {
  if (marketingUser && marketingUser.manager_id) {
    const mgr = store?.users?.find((u) => u.id === marketingUser.manager_id && u.role === "sales_manager");
    return {
      sales_manager_id: marketingUser.manager_id,
      sales_manager_name: mgr ? mgr.name : (marketingUser.manager_name || fallbackSmName || "")
    };
  }
  if (fallbackSmId) {
    const mgr = store?.users?.find((u) => u.id === fallbackSmId && u.role === "sales_manager");
    return {
      sales_manager_id: fallbackSmId,
      sales_manager_name: mgr ? mgr.name : (fallbackSmName || "")
    };
  }
  return { sales_manager_id: null, sales_manager_name: null };
}

function canAccessLead(user, lead, store = getStore()) {
  if (!user || !lead) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  if (user.role === "admin_branch") {
    return canAccessBranch(user, lead.branch);
  }
  if (user.role === "sales_manager") {
    return isLeadInSmScope(store, user, lead);
  }
  return lead.assigned_to === user.id;
}

function canAccessSimulation(user, sim, store = getStore()) {
  if (!user || !sim) return false;
  const simBank = sim.bank_key || sim.result?.bank_key || sim.bank_name || "ams2";
  if (!canAccessBank(user, simBank)) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  if (user.role === "admin_branch") {
    return canAccessBranch(user, sim.branch);
  }
  if (user.role === "sales_manager") {
    if (!canAccessBranch(user, sim.branch)) return false;
    const simMktId = sim.marketing_id || sim.created_by;
    if (isOwnedByAnotherSm(store, user, sim.sales_manager_id, simMktId)) return false;
    if (sim.created_by === user.id || sim.sales_manager_id === user.id) return true;
    if (simMktId && isMarketingInSmTeam(store, user, simMktId)) return true;
    if (sim.lead_id && store) {
      const lead = store.leads.find((l) => l.id === sim.lead_id);
      if (lead && isLeadInSmScope(store, user, lead)) return true;
    }
    return false;
  }
  if (sim.created_by === user.id || sim.marketing_id === user.id) return true;
  if (sim.lead_id && store) {
    const lead = store.leads.find((l) => l.id === sim.lead_id);
    if (lead && lead.assigned_to === user.id) return true;
  }
  return false;
}

function canAccessApplication(user, appItem, store = getStore()) {
  if (!user || !appItem) return false;
  const appBank = appItem.bank_key || appItem.bank_name || "ams2";
  if (!canAccessBank(user, appBank)) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  if (user.role === "admin_branch") {
    return canAccessBranch(user, appItem.branch);
  }
  if (user.role === "sales_manager") {
    if (!canAccessBranch(user, appItem.branch)) return false;
    if (isOwnedByAnotherSm(store, user, appItem.sales_manager_id, appItem.marketing_id)) return false;
    if (appItem.sales_manager_id === user.id) return true;
    if (appItem.marketing_id && isMarketingInSmTeam(store, user, appItem.marketing_id)) return true;
    if (appItem.lead_id && store) {
      const lead = store.leads.find((l) => l.id === appItem.lead_id);
      if (lead && isLeadInSmScope(store, user, lead)) return true;
    }
    return false;
  }
  return appItem.marketing_id === user.id;
}

function canAccessClaim(user, claim, store = getStore()) {
  if (!user || !claim) return false;
  const claimBank =
    claim.bank_key ||
    (String(claim.bank_name || "").toLowerCase().includes("bsi") ? "bsi_prapen" : "ams2");
  if (!canAccessBank(user, claimBank)) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  if (user.role === "admin_branch") {
    return canAccessBranch(user, claim.branch);
  }
  if (user.role === "sales_manager") {
    if (!canAccessBranch(user, claim.branch)) return false;
    if (isOwnedByAnotherSm(store, user, claim.sales_manager_id, claim.marketing_id)) return false;
    if (claim.sales_manager_id === user.id) return true;
    if (claim.marketing_id && isMarketingInSmTeam(store, user, claim.marketing_id)) return true;
    if (claim.application_id && store) {
      const appItem = store.applications.find((a) => a.id === claim.application_id);
      if (appItem && canAccessApplication(user, appItem, store)) return true;
    }
    return false;
  }
  return claim.marketing_id === user.id;
}

function canAccessImportBatch(user, imp) {
  if (!user || !imp) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  if (user.role === "admin_branch") {
    if (imp.branch) return canAccessBranch(user, imp.branch);
    if (imp.branch_breakdown && typeof imp.branch_breakdown === "object") {
      return Object.keys(imp.branch_breakdown).some((br) => canAccessBranch(user, br));
    }
    return imp.user_name === user.name;
  }
  if (user.role === "sales_manager") {
    return (
      imp.uploaded_by_id === user.id ||
      imp.target_manager_id === user.id ||
      imp.user_name === user.name
    );
  }
  return false;
}

function validateNonNegativeFields(body, fieldNames) {
  if (!body || typeof body !== "object") return null;
  for (const key of fieldNames) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      const val = Number(body[key]);
      if (!Number.isFinite(val) || val < 0) {
        return `Nilai parameter '${key}' tidak valid atau bernilai negatif.`;
      }
    }
  }
  return null;
}

function scopeLeads(store, user) {
  if (user.role === "super_admin" || user.role === "admin_ops") return store.leads;
  if (user.role === "admin_branch") {
    return store.leads.filter((l) => canAccessBranch(user, l.branch));
  }
  if (user.role === "sales_manager") {
    return store.leads.filter((l) => isLeadInSmScope(store, user, l));
  }
  return store.leads.filter((l) => l.assigned_to === user.id);
}

function isClaimAmountFixed(claim) {
  if (!claim) return false;
  if (claim.amount_fixed === true) return true;
  if (claim.amount_fixed === false) return false;
  return ["APPROVED", "PAID"].includes(claim.status) && Number(claim.amount) > 0;
}

function serializeClaimForUser(claim, user) {
  if (!claim) return null;
  const fixed = isClaimAmountFixed(claim);
  const isSuperOrOps = Boolean(user && ["super_admin", "admin_ops"].includes(user.role));
  if (isSuperOrOps) {
    return {
      ...claim,
      amount_fixed: fixed
    };
  }
  return {
    ...claim,
    amount: fixed ? claim.amount : null,
    amount_fixed: fixed
  };
}

// ============================================================================
// 1. AUTHENTICATION & QUICK ROLE SWITCHER
// ============================================================================
app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!reserveLogin(req, res, email)) return;
  if (typeof email !== "string" || !email.trim() || email.length > 254 || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 256) {
    return res.status(401).json({ detail: "Email atau kata sandi tidak valid." });
  }
  const user = getStore().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  const oldHash = user?.password_hash;
  const oldVersion = user?.auth_version || 0;
  const dummy = "scrypt$131072$8$1$" + "00".repeat(16) + "$" + "00".repeat(64);
  const result = await verifyPassword(password, user?.active !== false && user ? oldHash : dummy);
  if (!user || user.active === false || !result.valid) {
    if (user && result.needsRehash) await verifyPassword(password, dummy);
    return res.status(401).json({ detail: "Email atau kata sandi tidak valid." });
  }
  if (IS_PROD && isDefaultPassword(password)) return res.status(403).json({ error_code: "PASSWORD_RESET_REQUIRED", detail: "Akun memerlukan kata sandi pribadi. Hubungi administrator untuk pengaturan ulang." });
  const replacement = result.needsRehash ? await hashPassword(password) : null;
  const current = getStore().users.find((u) => u.id === user.id && u.active !== false);
  if (!current || current.password_hash !== oldHash || (current.auth_version || 0) !== oldVersion) return res.status(401).json({ detail: "Akun berubah saat masuk. Silakan coba kembali." });
  withTransaction(() => {
    if (replacement) current.password_hash = replacement;
    if (IS_PROD && password.length < 12) current.must_change_password = true;
    addAuditLog(current, "login", "auth", `Login berhasil (${ROLE_LABEL[current.role]})`, req.ip);
  });
  const token = issueSession(res, current);
  res.json({ user: sanitizeUser(current), access_token: token });
}));

app.post("/api/auth/quick-role", (req, res) => {
  // Nonaktifkan secara mutlak pada mode produksi atau jika dinonaktifkan via env.
  // Header, query demo, hostname, dan status PWA tidak boleh memberikan kewenangan.
  if (IS_PROD || process.env.DISABLE_QUICK_ROLE === "true") {
    return res.status(403).json({
      detail: "Fitur beralih peran cepat (Quick Role) dinonaktifkan pada lingkungan produksi."
    });
  }

  const currentUser = getAuthUser(req);
  if (!currentUser) {
    return res.status(401).json({ detail: "Autentikasi diperlukan." });
  }

  const { role } = req.body || {};
  if (!role || !ROLE_LABEL[role]) {
    return res.status(400).json({ detail: "Peran tidak valid." });
  }
  const store = getStore();
  const user = store.users.find((u) => u.role === role && u.active !== false);
  if (!user) {
    return res.status(404).json({ detail: "Pengguna untuk peran tersebut tidak ditemukan." });
  }
  const token = issueSession(res, user);
  addAuditLog(user, "switch_role", "auth", `Beralih peran cepat ke ${ROLE_LABEL[user.role]} (${user.name})`, req.ip);
  res.json({ user: sanitizeUser(user), access_token: token });
});

app.post("/api/auth/logout", (req, res) => {
  const user = getAuthUser(req);
  if (user) withTransaction(() => {
    user.auth_version = (user.auth_version || 0) + 1;
    addAuditLog(user, "logout", "auth", "Logout dari aplikasi", req.ip);
  });
  res.clearCookie("lp_token");
  res.json({ ok: true });
});

app.post("/api/auth/refresh", (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ detail: "Sesi tidak ditemukan" });
  const token = issueSession(res, user);
  res.json({ user: sanitizeUser(user), access_token: token });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json(sanitizeUser(req.user));
});

app.post("/api/auth/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  const problem = passwordProblem(new_password, IS_PROD);
  if (problem) return res.status(400).json({ detail: problem });
  const oldHash = req.user.password_hash;
  if (!(await verifyPassword(current_password, oldHash)).valid) return res.status(400).json({ detail: "Kata sandi saat ini tidak sesuai." });
  if (current_password === new_password) return res.status(400).json({ detail: "Kata sandi baru harus berbeda dari kata sandi saat ini." });
  const encoded = await hashPassword(new_password);
  const actor = currentActor(req);
  if (actor.password_hash !== oldHash) return res.status(409).json({ detail: "Kata sandi sudah berubah. Silakan ulangi." });
  withTransaction(() => {
    actor.password_hash = encoded;
    actor.auth_version = (actor.auth_version || 0) + 1;
    actor.must_change_password = false;
    addAuditLog(actor, "change_password", "user", "Memperbarui kata sandi akun", req.ip);
  });
  const token = issueSession(res, actor);
  res.json({ ok: true, user: sanitizeUser(actor), access_token: token });
}));

app.post("/api/auth/forgot-password", (req, res) => {
  if (!reserveLogin(req, res, "recovery:" + String(req.body?.email || ""))) return;
  if (typeof req.body?.email !== "string" || !req.body.email.trim()) return res.status(400).json({ detail: "Email wajib diisi." });
  res.json({ delivery: "administrator", message: "Hubungi administrator untuk pengaturan ulang kata sandi. Siapkan email akun Anda untuk verifikasi identitas." });
});
app.post("/api/auth/reset-password", (req, res) => {
  res.status(400).json({ detail: "Pengaturan ulang kata sandi dibantu administrator. Hubungi administrator akun Anda." });
});

// ============================================================================
// 2. DASHBOARD (ROLE-SCOPED)
// ============================================================================
app.get("/api/dashboard", requireAuth, (req, res) => {
  const store = getStore();
  const visibleLeads = scopeLeads(store, req.user);
  const by_status = { baru: 0, follow_up: 0, proses: 0, berhasil: 0, gagal: 0 };
  for (const l of visibleLeads) {
    by_status[l.status] = (by_status[l.status] || 0) + 1;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const growth = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    growth.push({
      date: d,
      kumulatif: Math.max(1, visibleLeads.length - Math.floor(i / 6)),
      baru: i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0
    });
  }

  // Scoped Applications & Claims
  const visibleApps = store.applications.filter((a) => canAccessApplication(req.user, a, store));
  const visibleClaims = store.claims.filter((c) => canAccessClaim(req.user, c, store));
  const visibleSimulations = store.simulations.filter((s) => canAccessSimulation(req.user, s, store));

  const isCentral = req.user.role === "super_admin" || req.user.role === "admin_ops";

  // Financial Metrics
  const bookingApps = visibleApps.filter((a) => a.stage === "booking_live" && !a.rejected);
  const total_booking_volume = bookingApps.reduce((acc, a) => acc + (Number(a.plafond) || 0), 0);
  
  // 4% Gross Company Revenue from Bank Partners (Central Admin Only)
  const est_gross_revenue = isCentral ? Math.round(total_booking_volume * 0.04) : null;

  // Paid claims
  const paidClaims = visibleClaims.filter((c) => c.status === "PAID");
  const total_paid_incentives = paidClaims.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

  // Net Profit: Gross Revenue - Paid Incentives (Central Admin Only)
  const net_company_profit = isCentral ? Math.max(0, est_gross_revenue - total_paid_incentives) : null;

  // Active Pipeline: Plafond in verification / processing (not rejected, not yet booking)
  const pipelineApps = visibleApps.filter((a) => a.stage !== "booking_live" && !a.rejected);
  const pipeline_value = pipelineApps.reduce((acc, a) => acc + (Number(a.plafond) || 0), 0);

  const pending_claims = visibleClaims.filter((c) => ["DRAFT", "SUBMITTED", "REVIEW", "REVISION"].includes(c.status));

  // Benchmark Target:
  // - Central Admin: Rp 5 Miliar / bulan
  // - Branch Admin: Rp 1 Miliar / bulan
  // - Sales Manager: Rp 500 Juta / bulan (atau proporsional jumlah tim)
  // - Marketing: Rp 250 Juta / bulan
  const monthly_target =
    req.user.role === "sales_manager"
      ? 500000000
      : req.user.role === "admin_branch"
      ? 1000000000
      : req.user.role === "marketing"
      ? 250000000
      : 5000000000;
  const target_progress_pct = Math.round((total_booking_volume / monthly_target) * 1000) / 10;
  const remaining_target = Math.max(0, monthly_target - total_booking_volume);
  const pipeline_target_coverage_pct = Math.round((pipeline_value / monthly_target) * 1000) / 10;

  if (req.user.role === "marketing") {
    const today_leads = visibleLeads.filter((l) => !l.follow_up_date || l.follow_up_date <= todayIso);
    const recent_activity = [];
    for (const l of visibleLeads) {
      for (const a of l.activities || []) {
        recent_activity.push({ ...a, lead_name: l.name });
      }
    }
    recent_activity.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    
    const myPaid = visibleClaims.filter((c) => c.status === "PAID" && c.marketing_id === req.user.id);
    const myPaidIncentives = myPaid.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

    return res.json({
      total_leads: visibleLeads.length,
      by_status,
      follow_up_today: today_leads.length,
      today_leads: today_leads.slice(0, 8),
      recent_activity: recent_activity.slice(0, 8),
      growth,
      financials: {
        monthly_target,
        target_progress_pct,
        remaining_target,
        pipeline_target_coverage_pct,
        total_booking_volume,
        total_paid_incentives: myPaidIncentives,
        pipeline_value,
        booking_count: bookingApps.length,
        pending_claims_count: pending_claims.length
      }
    });
  }

  // Bank Breakdown
  const bankMap = {};
  for (const a of bookingApps) {
    const bName = a.bank_name || "Lainnya";
    if (!bankMap[bName]) bankMap[bName] = { name: bName, volume: 0, count: 0 };
    bankMap[bName].volume += Number(a.plafond) || 0;
    bankMap[bName].count += 1;
  }
  const bank_breakdown = Object.values(bankMap).sort((a, b) => b.volume - a.volume);

  // Branch Breakdown
  const branchMap = {};
  for (const a of bookingApps) {
    const br = a.branch || "PUSAT";
    if (!branchMap[br]) branchMap[br] = { branch: br, volume: 0, count: 0 };
    branchMap[br].volume += Number(a.plafond) || 0;
    branchMap[br].count += 1;
  }
  const branch_breakdown = Object.values(branchMap).sort((a, b) => b.volume - a.volume);

  // Marketing Leaderboard & Productivity (Strictly Scoped per Role & SM Team)
  const marketers = store.users.filter((u) => {
    if (u.role !== "marketing") return false;
    if (!canAccessUserScope(req.user, u)) return false;
    if (isCentral) return true;
    if (req.user.role === "admin_branch") {
      return canAccessBranch(req.user, u.branch);
    }
    if (req.user.role === "sales_manager") {
      return isMarketingInSmTeam(store, req.user, u.id);
    }
    return false;
  });

  const marketing_leaderboard = marketers.map((m) => {
    const mLeads = visibleLeads.filter((l) => l.assigned_to === m.id);
    const mSims = visibleSimulations.filter((s) => s.marketing_id === m.id || s.created_by === m.id);
    const mApps = visibleApps.filter((a) => a.marketing_id === m.id && !a.rejected);
    const mBookingApps = mApps.filter((a) => a.stage === "booking_live");
    const mBookingVolume = mBookingApps.reduce((acc, a) => acc + (Number(a.plafond) || 0), 0);
    const mPaidClaims = visibleClaims.filter((c) => c.marketing_id === m.id && c.status === "PAID");
    const mPaidIncentives = mPaidClaims.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
    const aktivitas_7h = mLeads.reduce((acc, l) => acc + (l.activities?.length || 0), 0);
    const convRate = mLeads.length > 0 ? Math.round((mBookingApps.length / mLeads.length) * 100) : 0;

    let statusLabel = "Dalam Pipeline";
    let statusTone = "slate";
    if (mBookingVolume >= 200000000) {
      statusLabel = "Top Performer";
      statusTone = "emerald";
    } else if (mBookingVolume > 0 || mSims.length >= 3) {
      statusLabel = "Aktif & Produktif";
      statusTone = "royal";
    } else if (mLeads.length >= 5 && mApps.length === 0) {
      statusLabel = "Perlu Evaluasi";
      statusTone = "amber";
    }

    const mgrObj = m.manager_id ? store.users.find((u) => u.id === m.manager_id) : null;

    return {
      id: m.id,
      name: m.name,
      branch: normalizeBranch(m.branch),
      manager_id: m.manager_id || null,
      manager_name: mgrObj ? mgrObj.name : (m.manager_name || null),
      assigned: mLeads.length,
      berhasil: mBookingApps.length,
      simulasi: mSims.length,
      pipeline: mApps.filter((a) => a.stage !== "booking_live").length,
      booking_count: mBookingApps.length,
      booking_volume: mBookingVolume,
      paid_incentives: mPaidIncentives,
      conversion_rate: convRate,
      aktivitas_7h,
      status_label: statusLabel,
      status_tone: statusTone
    };
  }).sort((a, b) => b.booking_volume - a.booking_volume || b.conversion_rate - a.conversion_rate);

  // Financial Trend: 6 Bulan Terakhir
  const financial_trend = isCentral
    ? [
        { bulan: "Mei 26", booking: 85000000, revenue: 3400000, insentif: 1700000, profit: 1700000 },
        { bulan: "Jun 26", booking: 120000000, revenue: 4800000, insentif: 2400000, profit: 2400000 },
        { bulan: "Jul 26", booking: 180000000, revenue: 7200000, insentif: 3600000, profit: 3600000 },
        { bulan: "Ags 26", booking: 210000000, revenue: 8400000, insentif: 4200000, profit: 4200000 },
        { bulan: "Sep 26", booking: 290000000, revenue: 11600000, insentif: 5800000, profit: 5800000 },
        {
          bulan: "Okt 26",
          booking: Math.max(110000000, total_booking_volume),
          revenue: Math.max(4400000, est_gross_revenue || 0),
          insentif: Math.max(2200000, total_paid_incentives),
          profit: Math.max(2200000, net_company_profit || 0)
        }
      ]
    : [
        { bulan: "Mei 26", booking: Math.round(total_booking_volume * 0.25), insentif: Math.round(total_paid_incentives * 0.25) },
        { bulan: "Jun 26", booking: Math.round(total_booking_volume * 0.4), insentif: Math.round(total_paid_incentives * 0.4) },
        { bulan: "Jul 26", booking: Math.round(total_booking_volume * 0.55), insentif: Math.round(total_paid_incentives * 0.55) },
        { bulan: "Ags 26", booking: Math.round(total_booking_volume * 0.7), insentif: Math.round(total_paid_incentives * 0.7) },
        { bulan: "Sep 26", booking: Math.round(total_booking_volume * 0.85), insentif: Math.round(total_paid_incentives * 0.85) },
        { bulan: "Okt 26", booking: total_booking_volume, insentif: total_paid_incentives }
      ];

  // Scoped recent imports & recent activity
  const recent_imports = (store.imports || []).filter((imp) => canAccessImportBatch(req.user, imp)).slice(0, 5);
  let recent_activity = [];
  if (isCentral) {
    recent_activity = (store.audit_logs || []).slice(0, 8);
  } else {
    for (const l of visibleLeads) {
      for (const act of l.activities || []) {
        recent_activity.push({
          id: act.id,
          action: act.type || "follow_up",
          detail: `${l.name}: ${act.notes || act.note || "-"}`,
          user_name: act.user_name || act.created_by || l.assigned_name || req.user.name,
          created_at: act.created_at
        });
      }
    }
    recent_activity.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    recent_activity = recent_activity.slice(0, 8);
  }

  const branchSms = store.users.filter(
    (u) => u.role === "sales_manager" && u.active !== false && canAccessBranch(req.user, u.branch) && canAccessUserScope(req.user, u)
  );

  res.json({
    total_leads: visibleLeads.length,
    unassigned: visibleLeads.filter((l) => !l.assigned_to).length,
    by_status,
    total_simulations: visibleSimulations.length,
    growth,
    team_summary: {
      role: req.user.role,
      manager_id: req.user.role === "sales_manager" ? req.user.id : null,
      manager_name: req.user.role === "sales_manager" ? req.user.name : null,
      branch: normalizeBranch(req.user.branch),
      team_size: marketers.length,
      active_marketers: marketers.filter((m) => m.active !== false).length,
      branch_sm_count: branchSms.length
    },
    financials: {
      monthly_target,
      target_progress_pct,
      remaining_target,
      pipeline_target_coverage_pct,
      total_booking_volume,
      est_gross_revenue,
      total_paid_incentives,
      net_company_profit,
      pipeline_value,
      booking_count: bookingApps.length,
      pending_claims_count: pending_claims.length
    },
    financial_trend,
    bank_breakdown,
    branch_breakdown,
    marketing_leaderboard,
    marketing_stats: marketing_leaderboard,
    recent_imports,
    recent_activity
  });
});

// ============================================================================
// 3. BANKS & DYNAMIC PARTNER PARAMETERS (EDITABLE BY ROLE)
// ============================================================================
// Read-only pension validation: central admins only, flag OFF by default, unavailable in production.
app.use("/api/bsi-pensiun", requireAuth, requireRoles("super_admin", "admin_ops"), createPensionPreviewRouter());
app.get("/api/banks", requireAuth, (req, res) => {
  const store = getStore();
  const p = store.partner_parameters;
  const order = ["ams2", "bsi_prapen", "bank_capital", "bank_mestika", "bank_mantap", "bank_mnc", "bank_bni"];
  const banks = order
    .filter((key) => canAccessBank(req.user, key))
    .map((key) => {
      const item = p[key];
      const isLegacyBsiLabel =
        key === "bsi_prapen" &&
        (!item?.shortName || item.shortName === "BSI · Prapensiun");
      return {
        key,
        name: isLegacyBsiLabel ? "BSI · Prapen & Pensiun" : (item?.shortName || item?.name || key),
        full_name: isLegacyBsiLabel
          ? "BSI — Mitraguna Prapensiun & Pensiun Berkah"
          : (item?.name || key),
        engine: item?.engine || "partner_bank",
        supported: item?.active !== false,
        description: isLegacyBsiLabel
          ? DEFAULT_PARTNER_PARAMETERS.bsi_prapen.description
          : (item?.description || "")
      };
    });
  res.json({ banks });
});

function summarizeBsiProductLimits(prod) {
  if (!prod || typeof prod !== "object") return null;
  const matSplit = splitMaturityAgeMonths(prod.loan?.maxMaturityAgeMonths ?? 892);
  const code = prod.productCode || prod.code;
  const label = prod.label || prod.productName || prod.shortName || code;
  return {
    productCode: code,
    code,
    productName: prod.productName || label,
    label,
    shortName: prod.shortName || label,
    policyVersion: prod.policyVersion || "v1",
    revision: prod.revision || 1,
    updatedAt: prod.updatedAt || null,
    updatedBy: prod.updatedBy || null,
    maxTenorMonths: prod.loan?.maxTenorMonths,
    maxMaturityAgeMonths: prod.loan?.maxMaturityAgeMonths,
    maxEndAgeYears: matSplit.years,
    maxEndAgeMonths: matSplit.months,
    minPlafondAbsolute: prod.loan?.minPlafondAbsolute,
    maxPlafondAbsolute: prod.loan?.maxPlafondAbsolute,
    bupAgeDefault: prod.activePhase?.bupAgeDefault ?? prod.loan?.bupAgeDefault,
    minEntryAgeNearest: prod.insurance?.minEntryAge ?? prod.loan?.minEntryAgeNearest,
    maxEntryAgeNearest: prod.insurance?.maxEntryAge ?? prod.loan?.maxEntryAgeNearest,
    minBankAgePensiunan: prod.loan?.minBankAgePensiunan,
    minBankAgeJanda: prod.loan?.minBankAgeJanda,
    loan: prod.loan,
    activePhase: prod.activePhase,
    retiredPhase: prod.retiredPhase,
    pricingTiers: prod.pricingTiers || prod.pricing?.tiers,
    atribusiAdjustments: prod.atribusiAdjustments || prod.pricing?.atribusiAdjustments,
    pricing: prod.pricing || {
      tiers: prod.pricingTiers,
      atribusiAdjustments: prod.atribusiAdjustments
    },
    insurance: {
      profileId: prod.insurance?.profileId,
      companyName: prod.insurance?.companyName,
      profileVersion: prod.insurance?.profileVersion,
      minEntryAge: prod.insurance?.minEntryAge,
      maxEntryAge: prod.insurance?.maxEntryAge,
      maxCoverageAge: prod.insurance?.maxCoverageAge,
      maxInsuranceYears: prod.insurance?.maxInsuranceYears,
      maxPolicyMonths: prod.insurance?.maxPolicyMonths,
      bufferDefaultMonths: prod.insurance?.bufferDefaultMonths ?? 0,
      maxUpAge70: prod.insurance?.maxUpAge70,
      maxUpAge75: prod.insurance?.maxUpAge75,
      maxSumAssured: prod.insurance?.maxSumAssured,
      monthMultipliers: prod.insurance?.monthMultipliers,
      decreasingRateTable: prod.insurance?.decreasingRateTable
    },
    fees: prod.fees
  };
}

function normalizeStrictBsiProductParam(rawCode) {
  const c = String(rawCode || "").trim().toUpperCase();
  return BSI_PRODUCT_CODES.includes(c) ? c : null;
}

function handleBsiProductParamMutation(req, res, store, targetPartner, rawProductCode, rawUpdates, reason, topLevelExpectedVersion) {
  const productCode = normalizeStrictBsiProductParam(rawProductCode);
  if (!productCode) {
    return res.status(400).json({
      error_code: "UNKNOWN_BSI_PRODUCT",
      detail: "Sub-produk BSI tidak valid. Gunakan PP3, PP10, atau PENSIUN."
    });
  }
  const currentProd = targetPartner?.products?.[productCode];
  if (!currentProd) {
    return res.status(404).json({
      error_code: "MISSING_BSI_PRODUCT_CONFIG",
      detail: `Konfigurasi produk BSI '${productCode}' tidak ditemukan.`
    });
  }

  const expectedPolicyVersion =
    topLevelExpectedVersion !== undefined
      ? topLevelExpectedVersion
      : rawUpdates?.expectedPolicyVersion;
  const actorLabel = `${req.user.name} (${req.user.role === "super_admin" ? "Super Admin" : "Admin Operasional"})`;
  const validation = validateAndApplyBsiProductUpdate(
    currentProd,
    productCode,
    { ...(rawUpdates || {}), expectedPolicyVersion },
    actorLabel
  );
  if (!validation.ok) {
    return res.status(validation.status || 400).json({
      error_code: validation.errorCode,
      detail: validation.detail
    });
  }

  if (req.user.role === "admin_ops") {
    const prop = withTransaction(() => {
      const createdProp = {
        id: `prop-${Date.now()}`,
        partner_key: "bsi_prapen",
        product_key: productCode,
        partner_name: `${targetPartner.name} — ${currentProd.label || productCode}`,
        proposed_by_id: req.user.id,
        proposed_by_name: `${req.user.name} (Admin Operasional)`,
        created_at: new Date().toISOString(),
        status: "PENDING",
        reason: reason || `Usulan penyesuaian parameter BSI ${productCode}`,
        base_policy_version: currentProd.policyVersion,
        target_policy_version: validation.nextProduct.policyVersion,
        before_snapshot: validation.beforeSnapshot,
        after_snapshot: validation.afterSnapshot,
        changes: rawUpdates
      };
      store.parameter_proposals.unshift(createdProp);
      addAuditLog(
        req.user,
        "propose_param_change",
        `bsi_prapen:${productCode}`,
        `Mengusulkan perubahan parameter BSI ${productCode} (v${currentProd.policyVersion} -> v${validation.nextProduct.policyVersion})`,
        req.ip
      );
      if (store.audit_logs[0]) {
        store.audit_logs[0].partner_key = "bsi_prapen";
        store.audit_logs[0].product_key = productCode;
        store.audit_logs[0].policy_version = currentProd.policyVersion;
        store.audit_logs[0].before = validation.beforeSnapshot;
        store.audit_logs[0].after = validation.afterSnapshot;
      }
      return createdProp;
    });
    return res.status(202).json({
      mode: "proposed",
      product_code: productCode,
      message: `Usulan perubahan parameter BSI ${productCode} dikirim ke Super Admin untuk persetujuan (Dual Control).`,
      proposal: prop
    });
  }

  withTransaction(() => {
    targetPartner.products[productCode] = validation.nextProduct;
    store.partner_parameters.lastUpdated = new Date().toISOString();
    store.partner_parameters.updatedBy = `${req.user.name} (Super Admin)`;
    addAuditLog(
      req.user,
      "update_partner_params",
      `bsi_prapen:${productCode}`,
      `Memperbarui parameter BSI ${productCode} ke policyVersion ${validation.nextProduct.policyVersion}`,
      req.ip
    );
    if (store.audit_logs[0]) {
      store.audit_logs[0].partner_key = "bsi_prapen";
      store.audit_logs[0].product_key = productCode;
      store.audit_logs[0].policy_version = validation.nextProduct.policyVersion;
      store.audit_logs[0].before = validation.beforeSnapshot;
      store.audit_logs[0].after = validation.afterSnapshot;
    }
  });

  return res.json({
    mode: "applied",
    product_code: productCode,
    policy_version: validation.nextProduct.policyVersion,
    message: `Parameter BSI ${currentProd.label || productCode} berhasil diperbarui ke versi v${validation.nextProduct.policyVersion}.`,
    product: validation.nextProduct,
    partner: targetPartner
  });
}

app.get("/api/calc/limits", requireAuth, (req, res) => {
  const store = getStore();
  const p = store.partner_parameters || {};
  const limits = {};
  for (const [key, partner] of Object.entries(p)) {
    if (typeof partner === "object" && partner !== null && canAccessBank(req.user, key)) {
      if (key === "bsi_prapen" && partner.products) {
        const pp10Summary = summarizeBsiProductLimits(partner.products.PP10);
        const pp3Summary = summarizeBsiProductLimits(partner.products.PP3);
        const pensiunSummary = summarizeBsiProductLimits(partner.products.PENSIUN);
        limits[key] = {
          name: partner.name || key,
          schemaVersion: partner.schemaVersion || 2,
          maxTenorMonths: pp10Summary?.maxTenorMonths ?? 180,
          maxEndAgeYears: pp10Summary?.maxEndAgeYears ?? 74,
          maxEndAgeMonths: pp10Summary?.maxEndAgeMonths ?? 4,
          maxPlafondAbsolute: pp10Summary?.maxPlafondAbsolute ?? 800000000,
          products: {
            PP3: pp3Summary,
            PP10: pp10Summary,
            PENSIUN: pensiunSummary
          }
        };
      } else {
        limits[key] = {
          name: partner.name || key,
          maxTenorMonths: partner.maxTenorMonths,
          maxEndAgeYears: partner.maxEndAgeYears,
          maxEndAgeMonths: partner.maxEndAgeMonths,
          maxPlafondAbsolute: partner.maxPlafondAbsolute,
          maxEntryAgeYears: partner.maxEntryAgeYears,
          maxInstallmentRatio: partner.maxInstallmentRatio,
          plafondRoundingStep: partner.plafondRoundingStep,
          tiers: (partner.tiers || []).map((t) => ({
            id: t.id,
            name: t.name,
            minAge: t.minAge,
            maxAge: t.maxAge,
            coopRateAnnual: t.coopRateAnnual,
            riskReserveRate: t.riskReserveRate
          }))
        };
      }
    }
  }
  res.json({ limits });
});

app.get("/api/calc/params", requireAuth, requireRoles("super_admin", "admin_ops"), (req, res) => {
  const store = getStore();
  const ams2 = store.partner_parameters.ams2;
  res.json({
    formula_version: store.partner_parameters.version || "2.5.0-ENTERPRISE",
    last_updated: store.partner_parameters.lastUpdated,
    updated_by: store.partner_parameters.updatedBy,
    bank_rate_annual: ams2.bankRateAnnual,
    reject_age: ams2.maxEntryAgeYears,
    max_tenor: ams2.maxTenorMonths,
    max_plafond: ams2.maxPlafondAbsolute,
    max_ratio_pct: ams2.maxInstallmentRatio,
    proaq_pct: ams2.proaqRate,
    admin_fee: ams2.adminFee,
    tata_laksana_max_pct: ams2.tataLaksanaMax,
    retention_multiplier: ams2.retentionMultiplier,
    categories: ams2.tiers.map((t) => ({
      id: t.id,
      name: t.name.toUpperCase(),
      min_age: t.minAge,
      max_age: t.maxAge,
      coop_rate_annual: t.coopRateAnnual,
      risk_pct: t.riskReserveRate
    })),
    partners: store.partner_parameters,
    proposals: store.parameter_proposals || []
  });
});

app.get("/api/calc/params/bsi_prapen/products/:productCode", requireAuth, requireRoles("super_admin", "admin_ops"), (req, res) => {
  if (!canAccessBank(req.user, "bsi_prapen")) {
    return res.status(403).json({ detail: "Anda tidak memiliki kewenangan pada mitra bank BSI." });
  }
  const productCode = normalizeStrictBsiProductParam(req.params.productCode);
  if (!productCode) {
    return res.status(400).json({
      error_code: "UNKNOWN_BSI_PRODUCT",
      detail: "Sub-produk BSI tidak valid. Gunakan PP3, PP10, atau PENSIUN."
    });
  }
  const store = getStore();
  const prod = store.partner_parameters?.bsi_prapen?.products?.[productCode];
  if (!prod) {
    return res.status(404).json({
      error_code: "MISSING_BSI_PRODUCT_CONFIG",
      detail: `Konfigurasi produk BSI '${productCode}' tidak ditemukan.`
    });
  }
  res.json({
    bank_key: "bsi_prapen",
    product_code: productCode,
    policy_version: prod.policyVersion || 1,
    product: prod
  });
});

app.put("/api/calc/params/bsi_prapen/products/:productCode", requireAuth, requireRoles("super_admin", "admin_ops"), (req, res) => {
  if (!canAccessBank(req.user, "bsi_prapen")) {
    return res.status(403).json({ detail: "Anda tidak memiliki kewenangan pada mitra bank BSI." });
  }
  const body = req.body || {};
  const updates = body.updates && typeof body.updates === "object" && !Array.isArray(body.updates)
    ? body.updates
    : body;
  const store = getStore();
  const target = store.partner_parameters?.bsi_prapen;
  return handleBsiProductParamMutation(
    req,
    res,
    store,
    target,
    req.params.productCode,
    updates,
    body.reason,
    body.expectedPolicyVersion
  );
});

app.post("/api/calc/params/bsi_prapen/products/:productCode/reset", requireAuth, requireRoles("super_admin"), (req, res) => {
  if (!canAccessBank(req.user, "bsi_prapen")) {
    return res.status(403).json({ detail: "Anda tidak memiliki kewenangan pada mitra bank BSI." });
  }
  const productCode = normalizeStrictBsiProductParam(req.params.productCode);
  if (!productCode) {
    return res.status(400).json({
      error_code: "UNKNOWN_BSI_PRODUCT",
      detail: "Sub-produk BSI tidak valid. Gunakan PP3, PP10, atau PENSIUN."
    });
  }
  const store = getStore();
  const bsi = store.partner_parameters?.bsi_prapen;
  const currentProd = bsi?.products?.[productCode];
  if (!currentProd) {
    return res.status(404).json({
      error_code: "MISSING_BSI_PRODUCT_CONFIG",
      detail: `Konfigurasi produk BSI '${productCode}' tidak ditemukan.`
    });
  }
  const defaultProd = createDefaultBsiProducts()[productCode];
  const beforeSnapshot = structuredClone(currentProd);
  const nextRevision = (Number(currentProd.revision) || 1) + 1;
  const ageSplit = splitMaturityAgeMonths(defaultProd.loan.maxMaturityAgeMonths);
  const nextVersion = `bsi-${productCode.toLowerCase()}-${defaultProd.loan.maxTenorMonths}m-${ageSplit.years}y${ageSplit.months}m-v${nextRevision}`;
  const resetProd = {
    ...defaultProd,
    revision: nextRevision,
    policyVersion: nextVersion,
    updatedAt: new Date().toISOString(),
    updatedBy: `${req.user.name} (Reset Default)`
  };

  withTransaction(() => {
    bsi.products[productCode] = resetProd;
    store.partner_parameters.lastUpdated = new Date().toISOString();
    store.partner_parameters.updatedBy = `${req.user.name} (Reset Default ${productCode})`;
    addAuditLog(
      req.user,
      "reset_bsi_product_params",
      `bsi_prapen:${productCode}`,
      `Reset parameter BSI ${productCode} ke standar awal (v${nextVersion})`,
      req.ip
    );
    if (store.audit_logs[0]) {
      store.audit_logs[0].partner_key = "bsi_prapen";
      store.audit_logs[0].product_key = productCode;
      store.audit_logs[0].policy_version = nextVersion;
      store.audit_logs[0].before = beforeSnapshot;
      store.audit_logs[0].after = structuredClone(resetProd);
    }
  });

  res.json({
    ok: true,
    bank_key: "bsi_prapen",
    product_code: productCode,
    policy_version: nextVersion,
    product: resetProd,
    partners: store.partner_parameters
  });
});

app.put("/api/calc/params/:partnerKey", requireAuth, requireRoles("super_admin", "admin_ops"), (req, res) => {
  const { partnerKey } = req.params;
  const { updates, reason, product_key, productCode, expectedPolicyVersion } = req.body || {};
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return res.status(400).json({ detail: "Payload perubahan parameter tidak valid." });
  }
  if (!canAccessBank(req.user, partnerKey)) {
    return res.status(403).json({ detail: "Anda tidak memiliki kewenangan pada mitra bank ini." });
  }
  const store = getStore();
  const target = store.partner_parameters[partnerKey];
  if (!target) {
    return res.status(404).json({ detail: `Mitra bank '${partnerKey}' tidak ditemukan.` });
  }

  // Untuk BSI, wajib menyertakan product_key (PP3 | PP10 | PENSIUN) dan melalui validator skema per produk
  if (partnerKey === "bsi_prapen") {
    const rawProdCode = product_key || productCode || updates.product_key || updates.productCode || updates.code;
    if (!rawProdCode) {
      return res.status(400).json({
        error_code: "MISSING_BSI_PRODUCT_CODE",
        detail: "Perubahan parameter BSI wajib menyertakan product_key (PP3, PP10, atau PENSIUN)."
      });
    }
    return handleBsiProductParamMutation(
      req,
      res,
      store,
      target,
      rawProdCode,
      updates,
      reason,
      expectedPolicyVersion
    );
  }

  // Dual Control: Admin Operasional creates proposal; Super Admin applies directly
  if (req.user.role === "admin_ops") {
    const prop = withTransaction(() => {
      const createdProp = {
        id: `prop-${Date.now()}`,
        partner_key: partnerKey,
        partner_name: target.name,
        proposed_by_id: req.user.id,
        proposed_by_name: `${req.user.name} (Admin Operasional)`,
        created_at: new Date().toISOString(),
        status: "PENDING",
        reason: reason || "Usulan penyesuaian parameter mitra bank",
        changes: updates
      };
      store.parameter_proposals.unshift(createdProp);
      addAuditLog(req.user, "propose_param_change", partnerKey, `Mengusulkan perubahan parameter ${target.name}`, req.ip);
      return createdProp;
    });
    return res.json({
      mode: "proposed",
      message: "Usulan perubahan parameter dikirim ke Super Admin untuk persetujuan (Dual Control).",
      proposal: prop
    });
  }

  // Super Admin direct update (Non-BSI)
  withTransaction(() => {
    Object.assign(target, updates);
    store.partner_parameters.lastUpdated = new Date().toISOString();
    store.partner_parameters.updatedBy = `${req.user.name} (Super Admin)`;
    addAuditLog(req.user, "update_partner_params", partnerKey, `Memperbarui parameter mitra ${target.name}`, req.ip);
  });
  res.json({
    mode: "applied",
    message: `Parameter ${target.name} berhasil diperbarui secara real-time.`,
    partner: target
  });
});

app.post("/api/calc/params/proposals/:id/decide", requireAuth, requireRoles("super_admin"), (req, res) => {
  const { id } = req.params;
  const { decision } = req.body || {}; // APPROVE | REJECT
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return res.status(400).json({ detail: "Keputusan harus APPROVE atau REJECT." });
  }
  const store = getStore();
  const prop = store.parameter_proposals.find((p) => p.id === id);
  if (!prop) return res.status(404).json({ detail: "Usulan tidak ditemukan." });
  if (prop.status !== "PENDING") {
    return res.status(409).json({ detail: "Usulan perubahan parameter ini sudah diputuskan sebelumnya." });
  }

  if (decision === "APPROVE" && prop.partner_key === "bsi_prapen") {
    const productCode = normalizeStrictBsiProductParam(prop.product_key);
    if (!productCode) {
      return res.status(400).json({
        error_code: "UNKNOWN_BSI_PRODUCT",
        detail: "Usulan parameter BSI tidak memiliki product_key yang sah (PP3, PP10, atau PENSIUN)."
      });
    }
    const bsi = store.partner_parameters?.bsi_prapen;
    const currentProd = bsi?.products?.[productCode];
    if (!currentProd) {
      return res.status(404).json({
        error_code: "MISSING_BSI_PRODUCT_CONFIG",
        detail: `Konfigurasi produk BSI '${productCode}' tidak ditemukan.`
      });
    }
    const validation = validateAndApplyBsiProductUpdate(
      currentProd,
      productCode,
      {
        ...(prop.changes || {}),
        expectedPolicyVersion: prop.base_policy_version ?? prop.changes?.expectedPolicyVersion
      },
      `${req.user.name} (Super Admin - Dual Control)`
    );
    if (!validation.ok) {
      return res.status(validation.status || 409).json({
        error_code: validation.errorCode,
        detail: validation.detail
      });
    }

    withTransaction(() => {
      prop.status = "APPROVED";
      prop.decided_by = req.user.name;
      prop.decided_at = new Date().toISOString();
      prop.applied_policy_version = validation.nextProduct.policyVersion;
      bsi.products[productCode] = validation.nextProduct;
      store.partner_parameters.lastUpdated = new Date().toISOString();
      store.partner_parameters.updatedBy = `${req.user.name} (Super Admin)`;
      addAuditLog(
        req.user,
        "proposal_approved",
        `bsi_prapen:${productCode}`,
        `APPROVED usulan parameter BSI ${productCode} (v${validation.nextProduct.policyVersion})`,
        req.ip
      );
      if (store.audit_logs[0]) {
        store.audit_logs[0].partner_key = "bsi_prapen";
        store.audit_logs[0].product_key = productCode;
        store.audit_logs[0].policy_version = validation.nextProduct.policyVersion;
        store.audit_logs[0].before = validation.beforeSnapshot;
        store.audit_logs[0].after = validation.afterSnapshot;
      }
    });
    return res.json({
      ok: true,
      proposal: prop,
      product: validation.nextProduct,
      partners: store.partner_parameters
    });
  }

  withTransaction(() => {
    prop.status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    prop.decided_by = req.user.name;
    prop.decided_at = new Date().toISOString();

    if (decision === "APPROVE" && store.partner_parameters[prop.partner_key] && prop.partner_key !== "bsi_prapen") {
      Object.assign(store.partner_parameters[prop.partner_key], prop.changes);
      store.partner_parameters.lastUpdated = new Date().toISOString();
      store.partner_parameters.updatedBy = `${req.user.name} (Super Admin)`;
    }
    const targetKey = prop.product_key ? `${prop.partner_key}:${prop.product_key}` : prop.partner_key;
    addAuditLog(req.user, `proposal_${prop.status.toLowerCase()}`, targetKey, `${prop.status} usulan parameter ${prop.partner_name}`, req.ip);
  });
  res.json({ ok: true, proposal: prop, partners: store.partner_parameters });
});

app.post("/api/calc/params/reset", requireAuth, requireRoles("super_admin"), (req, res) => {
  const store = getStore();
  withTransaction(() => {
    store.partner_parameters = structuredClone(DEFAULT_PARTNER_PARAMETERS);
    store.partner_parameters.lastUpdated = new Date().toISOString();
    store.partner_parameters.updatedBy = `${req.user.name} (Reset Default)`;
    addAuditLog(req.user, "reset_partner_params", "all_partners", "Reset seluruh parameter mitra ke standar awal", req.ip);
  });
  res.json({ ok: true, partners: store.partner_parameters });
});

// ============================================================================
// 4. CALCULATOR & SIMULATIONS
// ============================================================================
const CALC_NON_NEGATIVE_FIELDS = [
  "plafond",
  "requested_plafond",
  "salary",
  "pension_salary",
  "tenor",
  "requested_tenor",
  "take_over",
  "pelunasan",
  "pelunasan_lama",
  "ongoing_installments",
  "blokir_count",
  "blokir_1_override",
  "blokir_2_override",
  "blokir_3_override"
];

function isInvalidProductErrorCode(code) {
  return (
    code === "UNKNOWN_PRODUCT" ||
    code === "UNKNOWN_BSI_PRODUCT" ||
    code === "MISSING_BSI_PRODUCT_CONFIG" ||
    code === "MISSING_BSI_PARTNER_CONFIG"
  );
}

app.post("/api/calc/max", requireAuth, (req, res) => {
  const body = req.body || {};
  if (!canAccessBank(req.user, body.bank_key || "ams2")) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada mitra bank yang dipilih." });
  }
  const err = validateNonNegativeFields(body, CALC_NON_NEGATIVE_FIELDS);
  if (err) return res.status(400).json({ detail: err });
  const store = getStore();
  const result = calculateMax(body, store.partner_parameters);
  if (isInvalidProductErrorCode(result.error_code)) {
    return res.status(400).json({ error_code: result.error_code, detail: result.stop_reason });
  }
  res.json(result);
});

app.post("/api/calc/preview", requireAuth, (req, res) => {
  const body = req.body || {};
  if (!canAccessBank(req.user, body.bank_key || "ams2")) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada mitra bank yang dipilih." });
  }
  const err = validateNonNegativeFields(body, CALC_NON_NEGATIVE_FIELDS);
  if (err) return res.status(400).json({ detail: err });
  const store = getStore();
  const result = calculatePreview(body, store.partner_parameters);
  if (isInvalidProductErrorCode(result.error_code)) {
    return res.status(400).json({ error_code: result.error_code, detail: result.stop_reason });
  }
  res.json(result);
});

app.get("/api/simulations", requireAuth, (req, res) => {
  const store = getStore();
  const q = String(req.query.q || "").toLowerCase().trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Number(req.query.page_size || 10));

  let list = store.simulations.filter((s) => canAccessSimulation(req.user, s, store));
  if (q) {
    list = list.filter((s) =>
      s.sim_no.toLowerCase().includes(q) ||
      String(s.result?.name || "").toLowerCase().includes(q) ||
      String(s.result?.category || "").toLowerCase().includes(q)
    );
  }

  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  res.json({ items, total, page, page_size: pageSize });
});

app.post("/api/simulations", requireAuth, (req, res) => {
  const body = req.body || {};
  const bankKey = body.bank_key || "ams2";
  if (!canAccessBank(req.user, bankKey)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk membuat simulasi pada mitra bank ini." });
  }
  const err = validateNonNegativeFields(body, CALC_NON_NEGATIVE_FIELDS);
  if (err) return res.status(400).json({ detail: err });

  const store = getStore();
  let linkedLead = null;
  if (body.lead_id) {
    linkedLead = store.leads.find((l) => l.id === body.lead_id);
    if (!linkedLead) {
      return res.status(404).json({ detail: "Lead terkait tidak ditemukan." });
    }
    if (!canAccessLead(req.user, linkedLead, store)) {
      return res.status(403).json({ detail: "Anda tidak memiliki akses ke lead terkait." });
    }
  }

  const result = calculatePreview(body, store.partner_parameters);
  if (
    !Number.isFinite(result.plafond) ||
    result.plafond <= 0 ||
    !Number.isFinite(result.tenor) ||
    result.tenor <= 0
  ) {
    return res.status(400).json({ detail: "Plafond dan tenor simulasi harus bernilai positif." });
  }

  const effectiveMarketingId =
    req.user.role === "marketing"
      ? req.user.id
      : (linkedLead?.assigned_to || null);
  const mktUser = effectiveMarketingId ? store.users.find((u) => u.id === effectiveMarketingId) : null;
  const smInfo =
    req.user.role === "sales_manager"
      ? { sales_manager_id: req.user.id, sales_manager_name: req.user.name }
      : resolveSmForMarketing(store, mktUser, linkedLead?.sales_manager_id, linkedLead?.sales_manager_name);

  const sim = withTransaction(() => {
    const seq = String(store.simulations.length + 1).padStart(4, "0");
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const createdSim = {
      id: `sim-${Date.now()}`,
      sim_no: `SIM-${ym}-${seq}`,
      lead_id: body.lead_id || null,
      bank_key: bankKey,
      bsi_product_code: result.bsi_product_code || null,
      policy_version: result.policy_version || null,
      dapem: body.dapem || "TASPEN",
      input: body,
      result,
      status: "saved",
      created_by: req.user.id,
      created_by_name: req.user.name,
      marketing_id: effectiveMarketingId,
      sales_manager_id: smInfo.sales_manager_id,
      sales_manager_name: smInfo.sales_manager_name,
      branch: normalizeBranch(linkedLead?.branch || req.user.branch || "BANDUNG"),
      created_at: new Date().toISOString()
    };
    store.simulations.unshift(createdSim);
    addAuditLog(req.user, "create_simulation", createdSim.sim_no, `Simulasi ${createdSim.sim_no} untuk ${result.name} (Rp${result.plafond.toLocaleString("id-ID")})`, req.ip);
    return createdSim;
  });
  res.json(sim);
});

app.get("/api/simulations/:id", requireAuth, (req, res) => {
  const store = getStore();
  const sim = store.simulations.find((s) => s.id === req.params.id);
  if (!sim) return res.status(404).json({ detail: "Simulasi tidak ditemukan" });
  if (!canAccessSimulation(req.user, sim, store)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada simulasi ini." });
  }
  res.json(sim);
});

app.get("/api/simulations/:id/pdf", requireAuth, (req, res) => {
  const store = getStore();
  const sim = store.simulations.find((s) => s.id === req.params.id);
  if (!sim) return res.status(404).json({ detail: "Simulasi tidak ditemukan" });
  if (!canAccessSimulation(req.user, sim, store)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengunduh PDF simulasi ini." });
  }
  const pdfBuf = generateSimulationPdfBuffer(sim);
  addAuditLog(req.user, "download_pdf", sim.sim_no, `Mengunduh PDF simulasi ${sim.sim_no}`, req.ip);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${sim.sim_no}.pdf"`);
  res.send(pdfBuf);
});

app.get("/api/simulations/:id/png", requireAuth, (req, res) => {
  const store = getStore();
  const sim = store.simulations.find((s) => s.id === req.params.id);
  if (!sim) return res.status(404).json({ detail: "Simulasi tidak ditemukan" });
  if (!canAccessSimulation(req.user, sim, store)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengunduh gambar simulasi ini." });
  }
  const svgBuf = generateSimulationSvgBuffer(sim);
  addAuditLog(req.user, "download_image", sim.sim_no, `Mengunduh ringkasan visual ${sim.sim_no}`, req.ip);
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Content-Disposition", `attachment; filename="${sim.sim_no}.svg"`);
  res.send(svgBuf);
});

app.post("/api/simulations/:id/ai-summary", requireAuth, (req, res) => {
  const store = getStore();
  const sim = store.simulations.find((s) => s.id === req.params.id);
  if (!sim) return res.status(404).json({ detail: "Simulasi tidak ditemukan" });
  if (!canAccessSimulation(req.user, sim, store)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada simulasi ini." });
  }
  const r = sim.result;
  const isBsi = r.bank_key === "bsi_prapen" || !!r.bsi_details;
  const isCapital = r.bank_key === "bank_capital" || !!r.capital_details;
  const isMestika = r.bank_key === "bank_mestika" || !!r.mestika_details;
  const isAms2 = r.bank_key === "ams2";
  const bsi = r.bsi_details || {};
  const cap = r.capital_details || {};
  const mst = r.mestika_details || {};

  let summary = "";
  if (isMestika) {
    const gajiDesc = mst.salary_type === "pensiun"
      ? `Sesuai Gaji Pensiun Rp${(mst.salary_input ?? r.salary).toLocaleString("id-ID")} (Estimasi Gaji Pokok -${mst.pension_deduction_pct ?? 13}% = Rp${(mst.basic_salary ?? r.salary).toLocaleString("id-ID")})`
      : `Sesuai Gaji IDPB Rp${(mst.basic_salary ?? r.salary).toLocaleString("id-ID")}`;
    summary = [
      `RINGKASAN EKSEKUTIF SIMULASI TIGA BERMUDA AMANAH • BANK MESTIKA (${sim.sim_no})`,
      `• Debitur: ${r.name || "-"} (Usia ${mst.age_label || `${r.age} tahun`}) — Produk Otomatis: Kredit Pensiun ${mst.product_label || r.category} (Bunga ${r.bank_rate}% p.a.).`,
      `• Dasar Gaji & Tanggungan: ${gajiDesc} • ${mst.dependent_label || "Tidak Ada Tanggungan"} (DSR ${mst.dsr_pct ?? 99}%).`,
      `• Parameter Maksimal: Tenor Maks ${mst.max_tenor ?? r.tenor} bln (s.d. usia 79 thn 11 bln / ${mst.end_age_date || "-"}), Plafond Maks Rp${(mst.max_plafond ?? r.plafond).toLocaleString("id-ID")} (Alternatif Plafond PV: Rp${(mst.alt_plafond ?? r.plafond).toLocaleString("id-ID")}).`,
      `• Pengajuan & Angsuran: Plafond Rp${r.plafond.toLocaleString("id-ID")}, Tenor ${r.tenor} bulan, Angsuran Rp${r.coop_installment.toLocaleString("id-ID")}/bln (DSR Aktual ${r.ratio_pct}%).`,
      `• Potongan Pencairan: Biaya Pencairan (${mst.cost_rate_pct ?? 22}%) Rp${r.total_fees.toLocaleString("id-ID")}, Retensi Angsuran (${mst.retention_multiplier ?? 3}x) Rp${r.retention.toLocaleString("id-ID")}${r.take_over > 0 ? `, Pelunasan Take Over Rp${r.take_over.toLocaleString("id-ID")}` : ""}.`,
      `• Hasil Akhir: Sisa Bersih Rp${r.net_disbursement.toLocaleString("id-ID")} dengan Sisa Gaji Rp${r.remaining_salary.toLocaleString("id-ID")}.`,
      `• Status Validasi: ${r.overall_ok ? "LAYAK DIPROSES — Seluruh parameter TBA-MSTK 1.0 Bank Mestika terpenuhi." : (r.issues || []).join(" ") || "Periksa catatan validasi."}`
    ].join("\n");
  } else if (isCapital) {
    const isCapPensiun = cap.product === "pensiun";
    const maxTenorVal = cap.max_credit_months || cap.credit_months || r.tenor || 0;
    const reqTenorVal = cap.credit_months ?? r.tenor ?? 0;
    const retLabel = isCapPensiun ? "Total Retensi (2x Angsuran)" : "Total Retensi";
    summary = [
      `RINGKASAN EKSEKUTIF SIMULASI CALC CAPITAL — PS3 CAPITAL (${sim.sim_no})`,
      `• Debitur: ${r.name || "-"} pada produk ${cap.product_label || (isCapPensiun ? "Pensiun" : "Pra Pensiun")}.`,
      `• Rincian Tenor: Tenor Kredit Maksimal ${maxTenorVal} bln, Tenor Diajukan ${reqTenorVal} bln.`,
      `• Hasil Simulasi: Batas Angsuran Maksimal Rp${(cap.payment_cap ?? Math.round((r.salary || 0) * 0.9)).toLocaleString("id-ID")}, Angsuran Aktual Rp${(cap.actual_payment ?? r.coop_installment).toLocaleString("id-ID")}/bln, Plafon Maksimal Rp${(cap.recommendation_max_loan ?? r.plafond).toLocaleString("id-ID")}, Plafon Diajukan Rp${(cap.loan ?? r.plafond).toLocaleString("id-ID")}.`,
      `• Biaya & Retensi: Biaya Kredit Rp${(cap.cost ?? r.total_fees).toLocaleString("id-ID")}, ${retLabel} Rp${(cap.total_retention ?? r.retention).toLocaleString("id-ID")}.`,
      `• Highlight Point: Plafon Rp${(cap.loan ?? r.plafond).toLocaleString("id-ID")} | Tenor ${reqTenorVal} bln | Sisa Bersih Rp${(cap.net_cash ?? r.net_disbursement).toLocaleString("id-ID")} | Sisa Gaji Rp${(cap.salary_left ?? r.remaining_salary).toLocaleString("id-ID")}.`,
      `• Status Validasi: ${r.overall_ok ? "Simulasi valid berdasarkan data dan parameter PS3 CAPITAL." : (cap.warnings || []).join(" ") || "Periksa catatan validasi."}`
    ].join("\n");
  } else if (isBsi && bsi.sub_product === "PENSIUN") {
    const sisaGajiPensiun = bsi.sisa_gaji_pensiun ?? (r.pension_salary - r.coop_installment);
    summary = [
      `RINGKASAN EKSEKUTIF SIMULASI BSI PENSIUN BERKAH (${sim.sim_no})`,
      `• Calon Debitur: ${r.name}${bsi.nip ? ` (Nopen/NIP: ${bsi.nip})` : ""} usia ${r.age} tahun (${bsi.retired_type_label || "Pensiun Sendiri"} • ${bsi.spouse_status_label || "Sendiri"} • Flagging ${bsi.flagging_label || "TASPEN"}) pada produk BSI Pensiun Berkah (Akad ${bsi.akad || "MMQ"} • Skema ${bsi.is_atribusi ? "Atribusi Premi" : "Reguler"}).`,
      `• Plafond & Tenor: Plafond Rp${r.plafond.toLocaleString("id-ID")} selama ${r.tenor} bulan dengan Price Dasar ${bsi.base_rate_pensiun ?? r.coop_rate}% p.a. (Price Akhir ${bsi.price_atrib_pensiun_pct ?? r.coop_rate}% p.a.).`,
      `• Angsuran Pembiayaan: Angsuran bulanan Rp${(bsi.pension_installment || r.coop_installment).toLocaleString("id-ID")}/bln (${bsi.ratio_basis || "DBR"} Aktual ${r.ratio_pension_pct ?? r.ratio_pct}% dari batas ${bsi.ratio_pct || 90}%).`,
      `• Rincian Biaya & Asuransi: Administrasi (1%) Rp${r.proaq.toLocaleString("id-ID")}, Premi Simas Pensiun (${bsi.simas?.tarif_permil ?? 0} ‰) Rp${Math.round(bsi.premi_asuransi_tertanggung || 0).toLocaleString("id-ID")} (${bsi.is_atribusi ? "Dicicil di Margin" : "Potong Pencairan"}), Materai Rp${r.admin_fee.toLocaleString("id-ID")}.`,
      `• Blokir & Pelunasan: Blokir Angsuran (${bsi.blokir_pension_count || 0}x) Rp${r.retention.toLocaleString("id-ID")}${r.take_over > 0 ? `, Pelunasan Yang Lama Rp${(r.take_over || 0).toLocaleString("id-ID")}` : ""}.`,
      `• Hasil Akhir: Terima Bersih Rp${r.net_disbursement.toLocaleString("id-ID")} dengan Sisa Gaji Pensiun Rp${Math.round(sisaGajiPensiun).toLocaleString("id-ID")}.`,
      `• Rekomendasi Kelayakan: ${r.overall_ok ? "LAYAK DIPROSES — Seluruh parameter akseptasi BSI Pensiun Berkah & Simas Pensiun terpenuhi." : "PERLU PENYESUAIAN — Terdapat parameter pembiayaan yang belum terpenuhi."}`
    ].join("\n");
  } else if (isBsi) {
    const sisaGajiPensiun = bsi.sisa_gaji_pensiun || (r.pension_salary - r.coop_installment);
    summary = [
      `RINGKASAN EKSEKUTIF SIMULASI BSI PRAPENSIUN (${sim.sim_no})`,
      `• Calon Debitur: ${r.name}${bsi.nip ? ` (NIP: ${bsi.nip})` : ""} usia ${r.age} tahun dengan status ${bsi.status_gaji_label || "Payroll"} pada produk ${bsi.sub_product_label || "Dekade Berkah"} (Akad ${bsi.akad || "MMQ"}).`,
      `• Plafond & Tenor: Plafond Rp${r.plafond.toLocaleString("id-ID")} dengan jangka waktu ${r.tenor} bulan (${bsi.active_months || 0} bln Aktif + ${bsi.pension_months || 0} bln Pensiun).`,
      `• Angsuran Pembiayaan: Angsuran saat Aktif PNS Rp${(bsi.active_installment || r.bank_installment).toLocaleString("id-ID")}/bln, Angsuran saat Pensiun Rp${(bsi.pension_installment || r.coop_installment).toLocaleString("id-ID")}/bln.`,
      `• Rincian Biaya: Administrasi (1%) Rp${r.proaq.toLocaleString("id-ID")}, Asuransi ${bsi.is_atribusi ? "-" : `Rp${r.risk.toLocaleString("id-ID")}`}, Materai Rp${r.admin_fee.toLocaleString("id-ID")}.`,
      `• Blokir Angsuran: Rp${r.retention.toLocaleString("id-ID")}${r.take_over > 0 ? `, Pelunasan Yang Lama Rp${(r.take_over || 0).toLocaleString("id-ID")}` : ""}.`,
      `• Hasil Akhir: Terima Bersih Rp${r.net_disbursement.toLocaleString("id-ID")} dengan Sisa Gaji Pensiun Rp${sisaGajiPensiun.toLocaleString("id-ID")}.`,
      `• Rekomendasi Kelayakan: ${r.overall_ok ? "LAYAK DIPROSES — Seluruh parameter akseptasi pembiayaan BSI Prapensiun terpenuhi." : "PERLU PENYESUAIAN — Terdapat parameter pembiayaan yang belum terpenuhi."}`
    ].join("\n");
  } else if (isAms2) {
    summary = [
      `RINGKASAN EKSEKUTIF SIMULASI KOPERASI AMS2 (${sim.sim_no})`,
      `• Calon Debitur: ${r.name} (${r.age} tahun) masuk dalam kategori ${r.category} Koperasi AMS2.`,
      `• Plafond & Tenor: Pengajuan sebesar Rp${r.plafond.toLocaleString("id-ID")} selama ${r.tenor} bulan menghasilkan Angsuran Koperasi Rp${r.coop_installment.toLocaleString("id-ID")}/bln (DSR ${r.ratio_pct}%).`,
      `• Komponen Biaya: Provisi & Akuisisi (${r.proaq_pct ?? 13.5}%) Rp${r.proaq.toLocaleString("id-ID")}, Cadangan Risiko (${r.risk_pct}%) Rp${r.risk.toLocaleString("id-ID")}, Administrasi Rp${r.admin_fee.toLocaleString("id-ID")}.`,
      `• Pengurang: Retensi Angsuran (${r.retention_multiplier ?? 3}x) Rp${r.retention.toLocaleString("id-ID")} dan Take Over Rp${(r.take_over || 0).toLocaleString("id-ID")}.`,
      `• Pencairan Bersih: Debitur menerima dana bersih Rp${r.net_disbursement.toLocaleString("id-ID")} dengan sisa gaji pensiun Rp${r.remaining_salary.toLocaleString("id-ID")}.`,
      `• Rekomendasi Kelayakan: ${r.overall_ok ? "LAYAK DIPROSES — Seluruh kriteria usia, DSR ≤ 95%, dan kelayakan pencairan Koperasi AMS2 terpenuhi." : "PERLU PENYESUAIAN — Mohon sesuaikan parameter pengajuan."}`
    ].join("\n");
  } else {
    summary = [
      `RINGKASAN EKSEKUTIF SIMULASI ${(r.bank_name || "MITRA BANK").toUpperCase()} (${sim.sim_no})`,
      `• Calon Debitur: ${r.name} (${r.age} tahun) pada produk ${r.category}.`,
      `• Plafond & Tenor: Fasilitas Rp${r.plafond.toLocaleString("id-ID")} dengan tenor ${r.tenor} bulan, angsuran bulanan Rp${r.coop_installment.toLocaleString("id-ID")} (DSR ${r.ratio_pct}%).`,
      `• Komponen Biaya: Biaya Provisi Rp${r.proaq.toLocaleString("id-ID")}, Asuransi Jiwa Rp${r.risk.toLocaleString("id-ID")}, ADM Bank Rp${r.admin_fee.toLocaleString("id-ID")}, Total Biaya Rp${r.total_fees.toLocaleString("id-ID")}.`,
      `• Pengurang: Blokir Angsuran Rp${r.retention.toLocaleString("id-ID")} dan Take Over Rp${(r.take_over || 0).toLocaleString("id-ID")}.`,
      `• Pencairan Bersih: Debitur menerima dana bersih Rp${r.net_disbursement.toLocaleString("id-ID")} dengan sisa gaji bulanan Rp${r.remaining_salary.toLocaleString("id-ID")}.`,
      `• Rekomendasi Kelayakan: ${r.overall_ok ? "LAYAK DIPROSES — Seluruh ketentuan perbankan terpenuhi." : "PERLU PENYESUAIAN — Mohon verifikasi ketentuan perbankan."}`
    ].join("\n");
  }

  res.json({ summary });
});

app.post("/api/simulations/:id/approve", requireAuth, (req, res) => {
  const store = getStore();
  const sim = store.simulations.find((s) => s.id === req.params.id);
  if (!sim) return res.status(404).json({ detail: "Simulasi tidak ditemukan" });
  if (!canAccessSimulation(req.user, sim, store)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengajukan simulasi ini." });
  }
  if (sim.status === "cancelled") {
    return res.status(400).json({ detail: "Simulasi yang telah dibatalkan tidak dapat diajukan." });
  }
  if (sim.status === "approved" || store.applications.some((a) => a.sim_id === sim.id)) {
    return res.status(409).json({ detail: "Simulasi ini sudah pernah diajukan menjadi aplikasi." });
  }
  if (!sim.result || sim.result.overall_ok !== true) {
    return res.status(400).json({
      detail: "Simulasi tidak memenuhi syarat kelayakan (overall_ok = false) dan tidak dapat diajukan ke proses berkas."
    });
  }
  if (
    !Number.isFinite(Number(sim.result.plafond)) ||
    Number(sim.result.plafond) <= 0 ||
    !Number.isFinite(Number(sim.result.net_disbursement)) ||
    Number(sim.result.net_disbursement) <= 0
  ) {
    return res.status(400).json({ detail: "Nilai plafond atau terima bersih tidak valid untuk pengajuan." });
  }

  const newApp = withTransaction(() => {
    let lead = sim.lead_id ? store.leads.find((l) => l.id === sim.lead_id) : null;
    if (!lead) {
      lead = {
        id: `lead-${Date.now()}`,
        name: sim.result.name,
        nopen: "",
        nip: "",
        birth_date: sim.result.birth_date || "1955-01-01",
        age: sim.result.age,
        phone: req.body?.phone || "081200000000",
        city: "Kota Bandung",
        branch: normalizeBranch(sim.branch || req.user.branch || "BANDUNG"),
        pension_salary: sim.result.salary,
        status: "proses",
        follow_up_date: new Date().toISOString().slice(0, 10),
        source: "Kalkulator Simulasi",
        assigned_to: sim.created_by || req.user.id,
        assigned_name: sim.created_by_name || req.user.name,
        notes: `Dibuat otomatis dari persetujuan simulasi ${sim.sim_no}`,
        activities: [],
        documents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      store.leads.unshift(lead);
      sim.lead_id = lead.id;
    } else {
      lead.status = "proses";
      lead.updated_at = new Date().toISOString();
    }

    sim.status = "approved";
    const seq = String(store.applications.length + 1).padStart(4, "0");
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const partnerCfg = store.partner_parameters[sim.bank_key] || store.partner_parameters.ams2;

    const effectiveMktId = sim.marketing_id || lead.assigned_to || sim.created_by || req.user.id;
    const creatorUser = store.users.find((u) => u.id === effectiveMktId);
    const smInfo =
      req.user.role === "sales_manager"
        ? { sales_manager_id: req.user.id, sales_manager_name: req.user.name }
        : resolveSmForMarketing(
            store,
            creatorUser,
            sim.sales_manager_id || lead.sales_manager_id,
            sim.sales_manager_name || lead.sales_manager_name
          );
    if (!lead.sales_manager_id && smInfo.sales_manager_id) {
      lead.sales_manager_id = smInfo.sales_manager_id;
      lead.sales_manager_name = smInfo.sales_manager_name;
    }

    const createdApp = {
      id: `app-${Date.now()}`,
      app_no: `APP-${ym}-${seq}`,
      sim_id: sim.id,
      lead_id: lead.id,
      lead_name: lead.name,
      marketing_id: creatorUser ? creatorUser.id : (sim.created_by || req.user.id),
      marketing_name: creatorUser ? creatorUser.name : (sim.created_by_name || req.user.name),
      sales_manager_id: smInfo.sales_manager_id,
      sales_manager_name: smInfo.sales_manager_name,
      branch: normalizeBranch(sim.branch || req.user.branch || lead.branch || "BANDUNG"),
      bank_key: sim.bank_key || "ams2",
      bank_name: partnerCfg.name,
      debtor_type: sim.result.category,
      dapem: sim.dapem || "TASPEN",
      plafond: sim.result.plafond,
      tenor: sim.result.tenor,
      stage: "upload_dokumen",
      stage_index: 0,
      stages: APP_STAGES,
      stage_data: {
        upload_dokumen: { by_name: req.user.name, at: new Date().toISOString() }
      },
      pending: {
        party: "marketing",
        type: "upload_dokumen",
        note: "Unggah 8 dokumen wajib (PDF) lalu klik Ajukan untuk Pemeriksaan."
      },
      rejected: false,
      reject_reason: null,
      booking: null,
      checklist: DOC_TEMPLATE.map((d) => ({
        ...d,
        status: null,
        filename: null,
        uploaded_at: null,
        versions: 0,
        note: ""
      })),
      history: [
        {
          id: `h-${Date.now()}`,
          action: "created",
          note: `Pengajuan dibuat dari persetujuan simulasi ${sim.sim_no}`,
          user_name: req.user.name,
          role: req.user.role,
          at: new Date().toISOString()
        }
      ],
      created_at: new Date().toISOString()
    };

    store.applications.unshift(createdApp);
    addAuditLog(req.user, "approve_simulation", createdApp.app_no, `Menyetujui ${sim.sim_no} menjadi pengajuan ${createdApp.app_no}`, req.ip);
    return createdApp;
  });

  res.json(newApp);
});

app.post("/api/simulations/:id/cancel", requireAuth, (req, res) => {
  const store = getStore();
  const sim = store.simulations.find((s) => s.id === req.params.id);
  if (!sim) return res.status(404).json({ detail: "Simulasi tidak ditemukan" });
  if (!canAccessSimulation(req.user, sim, store)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk membatalkan simulasi ini." });
  }
  if (sim.status === "approved") {
    return res.status(400).json({ detail: "Simulasi yang sudah diajukan tidak dapat dibatalkan dari menu simulasi." });
  }
  withTransaction(() => {
    sim.status = "cancelled";
    addAuditLog(req.user, "cancel_simulation", sim.sim_no, `Membatalkan kelanjutan pengajuan simulasi ${sim.sim_no}`, req.ip);
  });
  res.json({ ok: true });
});

// ============================================================================
// 5. LEADS & IMPORTS
// ============================================================================
const VALID_LEAD_STATUSES = ["baru", "follow_up", "proses", "berhasil", "gagal"];
const MARKETING_LEAD_ALLOWED_FIELDS = [
  "status",
  "follow_up_date",
  "notes",
  "phone",
  "city",
  "birth_date",
  "nopen",
  "nip",
  "pension_salary"
];
const ADMIN_LEAD_ALLOWED_FIELDS = [
  ...MARKETING_LEAD_ALLOWED_FIELDS,
  "name",
  "branch",
  "source",
  "assigned_to"
];

app.get("/api/leads/meta", requireAuth, (req, res) => {
  const store = getStore();
  const visibleLeads = scopeLeads(store, req.user);
  const branches = Array.from(new Set(visibleLeads.map((l) => l.branch).filter(Boolean)));
  const marketers = store.users
    .filter((u) => {
      if (u.role !== "marketing" || u.active === false) return false;
      if (!canAccessBranch(req.user, u.branch) || !canAccessUserScope(req.user, u)) return false;
      if (req.user.role === "sales_manager") {
        return isMarketingInSmTeam(store, req.user, u.id);
      }
      return true;
    })
    .map((u) => {
      const mgr = u.manager_id ? store.users.find((m) => m.id === u.manager_id) : null;
      return {
        id: u.id,
        name: u.name,
        branch: normalizeBranch(u.branch),
        bank_scope: u.bank_scope || "all_bank",
        manager_id: u.manager_id || null,
        manager_name: mgr ? mgr.name : (u.manager_name || null)
      };
    });
  const sales_managers = store.users
    .filter((u) => {
      if (u.role !== "sales_manager" || u.active === false) return false;
      if (!canAccessBranch(req.user, u.branch) || !canAccessUserScope(req.user, u)) return false;
      if (req.user.role === "sales_manager") {
        return u.id === req.user.id;
      }
      return true;
    })
    .map((u) => ({
      id: u.id,
      name: u.name,
      branch: normalizeBranch(u.branch),
      bank_scope: u.bank_scope || "all_bank"
    }));
  res.json({ branches, marketers, sales_managers, master_branches: MASTER_BRANCHES, kanwil_branches: KANWIL_BRANCHES });
});

app.get("/api/leads", requireAuth, (req, res) => {
  const store = getStore();
  let list = scopeLeads(store, req.user);
  const { q, status, branch, assigned, follow_up, manager_id } = req.query;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Number(req.query.page_size || 10));
  const todayIso = new Date().toISOString().slice(0, 10);

  if (q) {
    const sq = String(q).toLowerCase();
    list = list.filter((l) =>
      String(l.name || "").toLowerCase().includes(sq) ||
      String(l.phone || "").toLowerCase().includes(sq) ||
      String(l.nopen || "").toLowerCase().includes(sq) ||
      String(l.city || "").toLowerCase().includes(sq)
    );
  }
  if (manager_id === "unassigned_sm") {
    list = list.filter(
      (l) =>
        !l.sales_manager_id &&
        (!l.assigned_to || !store.users.some((u) => u.id === l.assigned_to && u.manager_id))
    );
  } else if (manager_id) {
    list = list.filter(
      (l) =>
        l.sales_manager_id === manager_id ||
        (l.assigned_to && store.users.some((u) => u.id === l.assigned_to && u.manager_id === manager_id))
    );
  }
  if (status) list = list.filter((l) => l.status === status);
  if (branch) list = list.filter((l) => l.branch === branch);
  if (assigned === "unassigned") list = list.filter((l) => !l.assigned_to);
  else if (assigned) list = list.filter((l) => l.assigned_to === assigned);
  if (follow_up === "today") list = list.filter((l) => l.follow_up_date === todayIso);
  else if (follow_up === "overdue") list = list.filter((l) => l.follow_up_date && l.follow_up_date < todayIso);

  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  res.json({ items, total, page, page_size: pageSize });
});

app.post("/api/leads", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const store = getStore();
  const body = req.body || {};
  const err = validateNonNegativeFields(body, ["pension_salary"]);
  if (err) return res.status(400).json({ detail: err });

  const targetBranch = normalizeBranch(body.branch || req.user.branch || "BANDUNG");
  if (!canAccessBranch(req.user, targetBranch)) {
    return res.status(403).json({ detail: "Anda tidak dapat membuat lead untuk cabang lain." });
  }

  const marketer = body.assigned_to ? store.users.find((u) => u.id === body.assigned_to) : null;
  if (body.assigned_to && (!marketer || marketer.role !== "marketing")) {
    return res.status(400).json({ detail: "Marketing yang dipilih tidak valid." });
  }
  if (marketer && !canAccessBranch(req.user, marketer.branch)) {
    return res.status(403).json({ detail: "Marketing yang dipilih berada di luar cakupan cabang Anda." });
  }
  if (marketer && !isGlobalBranchScope(req.user) && normalizeBranch(marketer.branch) !== targetBranch) {
    return res.status(400).json({ detail: "Marketing yang dipilih harus berasal dari cabang yang sama dengan lead." });
  }
  if (req.user.role === "sales_manager" && marketer && !isMarketingInSmTeam(store, req.user, marketer.id)) {
    return res.status(403).json({
      detail: "Sales Manager hanya dapat menugaskan prospek kepada Marketing di bawah supervisinya sendiri."
    });
  }

  const smInfo =
    req.user.role === "sales_manager"
      ? { sales_manager_id: req.user.id, sales_manager_name: req.user.name }
      : resolveSmForMarketing(store, marketer, body.sales_manager_id || null, body.sales_manager_name || null);

  const ageObj = body.birth_date ? computeAgeDetail(body.birth_date) : { years: 65 };
  const lead = withTransaction(() => {
    const createdLead = {
      id: `lead-${Date.now()}`,
      name: String(body.name || "CALON DEBITUR BARU").trim(),
      phone: String(body.phone || "").trim(),
      nopen: String(body.nopen || "").trim(),
      nip: String(body.nip || body.nopen || "").trim(),
      birth_date: body.birth_date || null,
      age: ageObj.years,
      pension_salary: Number(body.pension_salary || 0),
      city: String(body.city || "Kota Bandung").trim(),
      branch: targetBranch,
      source: String(body.source || "Input Manual").trim(),
      status: "baru",
      follow_up_date: body.follow_up_date || new Date().toISOString().slice(0, 10),
      assigned_to: marketer ? marketer.id : null,
      assigned_name: marketer ? marketer.name : null,
      sales_manager_id: smInfo.sales_manager_id,
      sales_manager_name: smInfo.sales_manager_name,
      notes: String(body.notes || ""),
      activities: [],
      documents: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.leads.unshift(createdLead);
    addAuditLog(req.user, "create_lead", createdLead.name, `Menambahkan lead baru ${createdLead.name} (${createdLead.branch})`, req.ip);
    return createdLead;
  });
  res.json(lead);
});

app.post("/api/leads/assign", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const { lead_ids = [], user_id, sales_manager_id } = req.body || {};
  if (!Array.isArray(lead_ids)) {
    return res.status(400).json({ detail: "Daftar lead_ids tidak valid." });
  }
  const store = getStore();

  // Mendukung penugasan ke Antrean Sales Manager via user_id = "sm:<id>" atau sales_manager_id eksplisit
  let targetSmId = sales_manager_id || null;
  let targetMktId = user_id || null;
  if (typeof user_id === "string" && user_id.startsWith("sm:")) {
    targetSmId = user_id.slice(3);
    targetMktId = null;
  }

  const targetSm = targetSmId ? store.users.find((u) => u.id === targetSmId && u.role === "sales_manager") : null;
  if (targetSmId && !targetSm) {
    return res.status(404).json({ detail: "Sales Manager tujuan tidak ditemukan." });
  }
  if (targetSm && !canAccessBranch(req.user, targetSm.branch)) {
    return res.status(403).json({ detail: "Anda tidak dapat menugaskan lead ke Sales Manager cabang lain." });
  }
  if (req.user.role === "sales_manager" && targetSm && targetSm.id !== req.user.id) {
    return res.status(403).json({ detail: "Sales Manager tidak dapat memindahkan prospek ke Sales Manager lain." });
  }

  const marketer = targetMktId ? store.users.find((u) => u.id === targetMktId) : null;
  if (targetMktId && (!marketer || marketer.role !== "marketing")) {
    return res.status(404).json({ detail: "Marketing tujuan tidak ditemukan." });
  }
  if (marketer && !canAccessBranch(req.user, marketer.branch)) {
    return res.status(403).json({ detail: "Anda tidak dapat menugaskan lead ke marketing cabang lain." });
  }
  if (req.user.role === "sales_manager" && marketer && marketer.manager_id !== req.user.id) {
    return res.status(403).json({
      detail: "Sales Manager hanya dapat menugaskan prospek kepada Marketing di bawah supervisinya sendiri."
    });
  }

  for (const id of lead_ids) {
    const lead = store.leads.find((l) => l.id === id);
    if (lead && !canAccessLead(req.user, lead, store)) {
      return res.status(403).json({ detail: `Anda tidak memiliki akses pada lead '${lead.name}'.` });
    }
    if (lead && marketer && normalizeBranch(lead.branch) !== normalizeBranch(marketer.branch)) {
      return res.status(400).json({ detail: `Lead '${lead.name}' (${lead.branch}) tidak dapat dialokasikan ke marketing cabang lain (${marketer.branch}).` });
    }
    if (lead && targetSm && normalizeBranch(lead.branch) !== normalizeBranch(targetSm.branch)) {
      return res.status(400).json({ detail: `Lead '${lead.name}' (${lead.branch}) tidak dapat dialokasikan ke Sales Manager cabang lain (${targetSm.branch}).` });
    }
  }

  const count = withTransaction(() => {
    let updatedCount = 0;
    for (const id of lead_ids) {
      const lead = store.leads.find((l) => l.id === id);
      if (lead) {
        let activityNote = "";
        if (marketer) {
          lead.assigned_to = marketer.id;
          lead.assigned_name = marketer.name;
          const smInfo =
            req.user.role === "sales_manager"
              ? { sales_manager_id: req.user.id, sales_manager_name: req.user.name }
              : resolveSmForMarketing(store, marketer, targetSm?.id || null, targetSm?.name || null);
          lead.sales_manager_id = smInfo.sales_manager_id;
          lead.sales_manager_name = smInfo.sales_manager_name;
          activityNote = `Ditugaskan ke Marketing ${marketer.name}${smInfo.sales_manager_name ? ` (Tim SM: ${smInfo.sales_manager_name})` : ""} oleh ${req.user.name}`;
        } else if (targetSm) {
          lead.assigned_to = null;
          lead.assigned_name = null;
          lead.sales_manager_id = targetSm.id;
          lead.sales_manager_name = targetSm.name;
          activityNote = `Diserahkan ke Antrean Sales Manager ${targetSm.name} oleh ${req.user.name}`;
        } else if (req.user.role === "sales_manager") {
          lead.assigned_to = null;
          lead.assigned_name = null;
          lead.sales_manager_id = req.user.id;
          lead.sales_manager_name = req.user.name;
          activityNote = `Dikembalikan ke Antrean Sales Manager ${req.user.name}`;
        } else {
          lead.assigned_to = null;
          lead.assigned_name = null;
          lead.sales_manager_id = null;
          lead.sales_manager_name = null;
          activityNote = `Dialihkan ke Pool Cadangan Cabang oleh ${req.user.name}`;
        }
        lead.updated_at = new Date().toISOString();
        if (!lead.activities) lead.activities = [];
        lead.activities.unshift({
          id: `act-${Date.now()}-${updatedCount}`,
          type: "system",
          notes: activityNote,
          user_name: req.user.name,
          created_at: new Date().toISOString()
        });
        updatedCount++;
      }
    }
    const targetDesc = marketer ? marketer.name : targetSm ? `Antrean SM ${targetSm.name}` : "Unassigned";
    addAuditLog(req.user, "assign_leads", "leads", `Menugaskan ${updatedCount} leads ke ${targetDesc}`, req.ip);
    return updatedCount;
  });
  res.json({ updated: count });
});

// ============================================================================
// LEAD REQUESTS & PROSPECT DISTRIBUTION ENGINE (MARKETING -> ADMIN OPS)
// Aturan Bisnis & Tata Kelola Data:
// 1. Otoritas Approval: Opsi A (Khusus Admin Ops & Super Admin / Owner).
// 2. Batasan Permintaan: Maksimal 1 permohonan berstatus PENDING (anti-spam).
// 3. Batasan Kuota: Maksimal 5 data per request (requested_count 1..5).
// 4. Cadence Harian: Permohonan disetujui dibatasi 1 alokasi per hari kalender.
//    Marketing dapat meminta kembali jika hari sudah berganti (hari esok).
// 5. Eksekusi Alokasi: Transaksional atomik (withTransaction), anti race condition.
// ============================================================================

app.get("/api/lead-requests", requireAuth, (req, res) => {
  const store = getStore();
  const requests = store.lead_requests || [];
  const todayIso = new Date().toISOString().slice(0, 10);

  if (req.user.role === "marketing") {
    const rawBranch = req.user.branch;
    const normalizedBranch = typeof rawBranch === "string" ? rawBranch.trim().toUpperCase() : "";
    const isBranchValid = Boolean(normalizedBranch && normalizedBranch !== "PUSAT" && normalizedBranch !== "PUSAT JAKARTA");
    const myRequests = requests.filter((r) => r.requester_id === req.user.id);
    const pendingRequest = myRequests.find((r) => r.status === "PENDING") || null;
    const todayApproved = myRequests.find(
      (r) => r.status === "APPROVED" && (r.processed_at || r.created_at || "").slice(0, 10) === todayIso
    );

    // Hitung berapa leads aktif milik marketing yang masih berstatus "baru"
    const myLeads = (store.leads || []).filter((l) => l.assigned_to === req.user.id);
    const untouchedCount = myLeads.filter(
      (l) => l.status === "baru" && (!l.activities || l.activities.length <= 1)
    ).length;

    // Hitung stok prospek unassigned yang ada di cabang marketing ini secara real-time
    // Hanya menghitung stok yang tersedia untuk tim SM marketing ini atau stok pool cabang netral
    const unassignedInBranch = isBranchValid
      ? (store.leads || []).filter(
          (l) =>
            !l.assigned_to &&
            normalizeBranch(l.branch) === normalizedBranch &&
            (!l.sales_manager_id || l.sales_manager_id === req.user.manager_id)
        )
      : [];

    const branchStock = {
      total_unassigned: unassignedInBranch.length,
      prapen_unassigned: unassignedInBranch.filter((l) => Number(l.age || 0) >= 50 && Number(l.age || 0) <= 59).length,
      pensiun_unassigned: unassignedInBranch.filter((l) => Number(l.age || 0) >= 60).length
    };

    return res.json({
      items: myRequests,
      user_branch: isBranchValid ? normalizedBranch : null,
      branch_valid: isBranchValid,
      branch_stock: branchStock,
      can_request_today: !pendingRequest && !todayApproved && isBranchValid && unassignedInBranch.length > 0,
      pending_request: pendingRequest,
      today_approved_count: todayApproved ? (todayApproved.allocated_count || todayApproved.requested_count || 0) : 0,
      untouched_leads_count: untouchedCount,
      daily_limit: 5,
      active_limit: 1
    });
  }

  // Admin Operasional & Super Admin: melihat seluruh antrean (bisa difilter cabang & status)
  // Admin Cabang: melihat antrean cabang penempatannya (read-only monitoring)
  // Sales Manager: melihat antrean khusus tim marketing di bawah supervisinya sendiri (read-only monitoring)
  let list = requests.map((r) => {
    const reqUser = store.users.find((u) => u.id === r.requester_id);
    const smInfo = resolveSmForMarketing(store, reqUser, r.sales_manager_id, r.sales_manager_name);
    return {
      ...r,
      sales_manager_id: smInfo.sales_manager_id,
      sales_manager_name: smInfo.sales_manager_name
    };
  });

  if (req.user.role === "admin_branch") {
    list = list.filter((r) => canAccessBranch(req.user, r.branch));
  } else if (req.user.role === "sales_manager") {
    list = list.filter(
      (r) =>
        canAccessBranch(req.user, r.branch) &&
        (r.sales_manager_id === req.user.id || isMarketingInSmTeam(store, req.user, r.requester_id))
    );
  } else if (req.query.branch) {
    list = list.filter((r) => r.branch === req.query.branch);
  }

  if (req.query.status) {
    list = list.filter((r) => r.status === req.query.status);
  }

  // Sort: PENDING terlebih dahulu, lalu descending created_at
  list.sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (a.status !== "PENDING" && b.status === "PENDING") return 1;
    return String(b.created_at).localeCompare(String(a.created_at));
  });

  const pendingCount = list.filter((r) => r.status === "PENDING").length;

  res.json({
    items: list,
    pending_count: pendingCount,
    total: list.length
  });
});

app.post("/api/lead-requests", requireAuth, requireRoles("marketing"), (req, res) => {
  const store = getStore();
  const body = req.body || {};
  const requestedCount =
    body.requested_count !== undefined && body.requested_count !== null
      ? Number(body.requested_count)
      : 5;

  // 1. Validasi batas kuota: Maksimal 5 data prospek
  if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 5) {
    return res.status(400).json({
      detail: "Jumlah data prospek yang diminta harus berupa bilangan bulat antara 1 hingga 5 data."
    });
  }

  const existingRequests = store.lead_requests || [];
  const todayIso = new Date().toISOString().slice(0, 10);

  // 2. Validasi Anti-Spam: Maksimal 1 permohonan berstatus PENDING
  const activePending = existingRequests.find(
    (r) => r.requester_id === req.user.id && r.status === "PENDING"
  );
  if (activePending) {
    return res.status(400).json({
      detail: `Anda masih memiliki 1 permohonan aktif (${activePending.request_no}) yang sedang menunggu persetujuan Admin Operasional. Permohonan baru dapat diajukan setelah permohonan aktif selesai diproses.`
    });
  }

  // 3. Validasi Cadence Harian: Maksimal 1 alokasi per hari ("Bisa minta lagi jika hari sudah berubah")
  const todayApproved = existingRequests.find(
    (r) =>
      r.requester_id === req.user.id &&
      r.status === "APPROVED" &&
      (r.processed_at || r.created_at || "").slice(0, 10) === todayIso
  );
  if (todayApproved) {
    return res.status(400).json({
      detail: "Anda sudah mendapatkan alokasi data prospek untuk hari ini. Sesuai aturan tata kelola, permohonan kuota data berikutnya dapat diajukan kembali besok hari."
    });
  }

  // 4. Burn-rate / Anti-Hoarding Check: Jika marketing masih memiliki > 15 leads baru yang belum disentuh
  const myLeads = (store.leads || []).filter((l) => l.assigned_to === req.user.id);
  const untouchedCount = myLeads.filter(
    (l) => l.status === "baru" && (!l.activities || l.activities.length <= 1)
  ).length;
  if (untouchedCount > 15) {
    return res.status(400).json({
      detail: `Anda masih memiliki ${untouchedCount} data prospek yang belum di-follow up. Silakan tindak lanjuti data yang ada terlebih dahulu sebelum meminta data baru.`
    });
  }

  // 5. Validasi Cabang Resmi Pemohon (Anti-Fraud & Anti-Data Leak)
  const rawBranch = req.user.branch;
  const userBranch = typeof rawBranch === "string" ? rawBranch.trim().toUpperCase() : "";
  if (!userBranch || userBranch === "PUSAT" || userBranch === "PUSAT JAKARTA") {
    return res.status(400).json({
      detail: "Akun Anda belum memiliki penugasan kantor cabang resmi. Hubungi Admin Operasional untuk menetapkan cabang Anda sebelum mengajukan data prospek."
    });
  }

  // 6. Validasi Ketersediaan Stok Unassigned di Cabang Pemohon (Real-Time Pre-Check)
  // Hanya menghitung stok yang tersedia di antrean SM pembina marketing ini atau di Pool Cabang Netral
  const unassignedInBranch = (store.leads || []).filter(
    (l) =>
      !l.assigned_to &&
      normalizeBranch(l.branch) === userBranch &&
      (!l.sales_manager_id || l.sales_manager_id === req.user.manager_id)
  );
  if (unassignedInBranch.length === 0) {
    return res.status(400).json({
      detail: `Stok data prospek belum ditugaskan (unassigned) untuk Cabang ${userBranch} saat ini sedang kosong (0 data). Silakan hubungi Admin Operasional untuk penambahan database cabang.`
    });
  }

  const now = new Date().toISOString();
  const yearMonth = now.slice(0, 7).replace("-", "");
  const seq = String((store.lead_requests?.length || 0) + 1).padStart(4, "0");
  const requestNo = `REQ-${yearMonth}-${seq}`;
  const smInfo = resolveSmForMarketing(store, req.user);

  const createdRequest = withTransaction(() => {
    const item = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      request_no: requestNo,
      requester_id: req.user.id,
      requester_name: req.user.name,
      requester_email: req.user.email,
      sales_manager_id: smInfo.sales_manager_id,
      sales_manager_name: smInfo.sales_manager_name,
      branch: userBranch,
      requested_count: requestedCount,
      target_segment: String(body.target_segment || "all").trim(),
      target_bank: String(body.target_bank || "all").trim(),
      notes: String(body.notes || "").trim(),
      status: "PENDING",
      allocated_lead_ids: [],
      allocated_count: 0,
      processed_by_id: null,
      processed_by_name: null,
      admin_notes: null,
      created_at: now,
      processed_at: null
    };

    store.lead_requests = store.lead_requests || [];
    store.lead_requests.unshift(item);
    addAuditLog(
      req.user,
      "create_lead_request",
      item.request_no,
      `Marketing ${req.user.name} mengajukan permohonan ${requestedCount} data prospek (${userBranch})`,
      req.ip
    );
    return item;
  });

  res.status(201).json(createdRequest);
});

app.post(
  "/api/lead-requests/:id/approve",
  requireAuth,
  requireRoles("super_admin", "admin_ops"),
  (req, res) => {
    const store = getStore();
    const reqItem = (store.lead_requests || []).find((r) => r.id === req.params.id);
    if (!reqItem) {
      return res.status(404).json({ detail: "Permohonan data tidak ditemukan." });
    }
    if (reqItem.status !== "PENDING") {
      return res.status(409).json({ detail: `Permohonan ${reqItem.request_no} sudah diproses sebelumnya (Status: ${reqItem.status}).` });
    }

    const requester = store.users.find((u) => u.id === reqItem.requester_id);
    if (!requester || requester.active === false) {
      return res.status(400).json({ detail: "Akun marketing pemohon sudah tidak aktif." });
    }

    // Verifikasi keselarasan cabang aktual marketing dengan cabang permohonan
    const requesterBranch = String(requester.branch || "").trim().toUpperCase();
    const reqItemBranch = String(reqItem.branch || "").trim().toUpperCase();
    if (!requesterBranch || requesterBranch !== reqItemBranch) {
      return res.status(400).json({
        detail: `Cabang pemohon (${requesterBranch || "TIDAK ADA"}) tidak cocok dengan cabang permohonan (${reqItemBranch}). Permohonan dibatalkan guna mencegah salah alokasi wilayah.`
      });
    }

    const maxCount = reqItem.requested_count || 5;

    const result = withTransaction(() => {
      // Re-check idempotency in transaction
      if (reqItem.status !== "PENDING") {
        throw new Error("Permohonan sudah berstatus non-pending.");
      }

      // Query pool leads unassigned yang cocok dengan cabang (normalized), segmentasi, dan isolasi SM
      // Dilarang mengambil stok antrean milik Sales Manager lain!
      const isEligiblePoolLead = (l) => {
        if (l.assigned_to) return false;
        const leadBranch = normalizeBranch(l.branch);
        if (!leadBranch || leadBranch !== normalizeBranch(reqItemBranch)) return false;
        if (l.sales_manager_id && l.sales_manager_id !== requester.manager_id) return false;
        if (isBsiScopedUser(requester) && Number(l.age || 0) > 70) return false;
        return true;
      };

      let candidates = (store.leads || []).filter((l) => {
        if (!isEligiblePoolLead(l)) return false;

        // Filter segmentasi jika ada
        if (reqItem.target_segment === "prapen") {
          const age = Number(l.age || 0);
          if (age < 50 || age > 59) return false;
        } else if (reqItem.target_segment === "pensiun") {
          const age = Number(l.age || 0);
          if (age < 60) return false;
        }

        return true;
      });

      // Fallback: Jika tidak ada yang cocok dengan segmen spesifik, ambil unassigned di cabang tersebut dengan tetap patuh isolasi SM & bank-scope
      if (!candidates.length) {
        candidates = (store.leads || []).filter((l) => isEligiblePoolLead(l));
      }

      // Prioritaskan prospek yang sudah berada di antrean SM pembina marketing tersebut sebelum mengambil dari Pool Cabang Netral
      if (requester.manager_id) {
        candidates.sort((a, b) => {
          const aOwnSm = a.sales_manager_id === requester.manager_id ? 0 : 1;
          const bOwnSm = b.sales_manager_id === requester.manager_id ? 0 : 1;
          return aOwnSm - bOwnSm;
        });
      }

      if (!candidates.length) {
        return {
          ok: false,
          error: `Stok data prospek belum ditugaskan (unassigned) di Cabang ${reqItemBranch} saat ini sedang kosong.`
        };
      }

      // Ambil hingga maxCount data (FIFO: data terlama yang unassigned)
      const allocatedLeads = candidates.slice(0, maxCount);
      const now = new Date().toISOString();
      const smInfo = resolveSmForMarketing(store, requester);

      for (const lead of allocatedLeads) {
        lead.assigned_to = requester.id;
        lead.assigned_name = requester.name;
        lead.sales_manager_id = smInfo.sales_manager_id;
        lead.sales_manager_name = smInfo.sales_manager_name;
        lead.updated_at = now;
        lead.activities = lead.activities || [];
        lead.activities.unshift({
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          type: "system_allocation",
          notes: `Data dialokasikan ke Marketing ${requester.name}${smInfo.sales_manager_name ? ` (Tim SM: ${smInfo.sales_manager_name})` : ""} via Permintaan Resmi ${reqItem.request_no}`,
          created_at: now,
          created_by: req.user.name
        });
      }

      reqItem.status = "APPROVED";
      reqItem.allocated_lead_ids = allocatedLeads.map((l) => l.id);
      reqItem.allocated_count = allocatedLeads.length;
      reqItem.processed_by_id = req.user.id;
      reqItem.processed_by_name = req.user.name;
      reqItem.processed_at = now;
      reqItem.admin_notes =
        req.body?.admin_notes ||
        (allocatedLeads.length < maxCount
          ? `Disetujui sebagian (${allocatedLeads.length}/${maxCount} data tersedia) oleh Admin Operasional`
          : `Disetujui dan dialokasikan otomatis (${allocatedLeads.length} data) oleh Admin Operasional`);

      addAuditLog(
        req.user,
        "approve_lead_request",
        reqItem.request_no,
        `Menyetujui permohonan ${reqItem.request_no} dan mengalokasikan ${allocatedLeads.length} leads ke ${requester.name} (${reqItemBranch})`,
        req.ip
      );

      return { ok: true, allocatedCount: allocatedLeads.length, request: reqItem };
    });

    if (!result.ok) {
      return res.status(400).json({ detail: result.error });
    }

    res.json({
      success: true,
      message: `Berhasil menyetujui permohonan dan mengalokasikan ${result.allocatedCount} data prospek ke ${requester.name}.`,
      request: result.request,
      allocated_count: result.allocatedCount
    });
  }
);

app.post(
  "/api/lead-requests/:id/reject",
  requireAuth,
  requireRoles("super_admin", "admin_ops"),
  (req, res) => {
    const store = getStore();
    const reqItem = (store.lead_requests || []).find((r) => r.id === req.params.id);
    if (!reqItem) {
      return res.status(404).json({ detail: "Permohonan data tidak ditemukan." });
    }
    if (reqItem.status !== "PENDING") {
      return res.status(409).json({ detail: `Permohonan ${reqItem.request_no} sudah diproses sebelumnya (Status: ${reqItem.status}).` });
    }

    const reason = String(req.body?.reason || req.body?.admin_notes || "").trim();
    if (!reason) {
      return res.status(400).json({ detail: "Alasan penolakan permohonan wajib diisi." });
    }

    const now = new Date().toISOString();
    const updated = withTransaction(() => {
      reqItem.status = "REJECTED";
      reqItem.admin_notes = reason;
      reqItem.processed_by_id = req.user.id;
      reqItem.processed_by_name = req.user.name;
      reqItem.processed_at = now;

      addAuditLog(
        req.user,
        "reject_lead_request",
        reqItem.request_no,
        `Menolak permohonan data ${reqItem.request_no} dari ${reqItem.requester_name}. Alasan: ${reason}`,
        req.ip
      );
      return reqItem;
    });

    res.json({
      success: true,
      message: `Permohonan ${updated.request_no} berhasil ditolak.`,
      request: updated
    });
  }
);

app.get("/api/leads/:id", requireAuth, (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  if (!canAccessLead(req.user, lead)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada data prospek (lead) ini." });
  }
  const simulations = store.simulations.filter(
    (s) => s.lead_id === lead.id && canAccessSimulation(req.user, s, store)
  );
  res.json({ ...lead, simulations });
});

app.patch("/api/leads/:id", requireAuth, (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  if (!canAccessLead(req.user, lead)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengubah lead ini." });
  }

  const body = req.body || {};
  const err = validateNonNegativeFields(body, ["pension_salary"]);
  if (err) return res.status(400).json({ detail: err });
  if (body.status !== undefined && !VALID_LEAD_STATUSES.includes(body.status)) {
    return res.status(400).json({ detail: "Status lead tidak valid." });
  }

  const allowedFields =
    req.user.role === "marketing" ? MARKETING_LEAD_ALLOWED_FIELDS : ADMIN_LEAD_ALLOWED_FIELDS;

  // Reject explicit privilege/ownership escalation attempts by marketing
  if (
    req.user.role === "marketing" &&
    (body.assigned_to !== undefined || body.branch !== undefined)
  ) {
    return res.status(403).json({ detail: "Marketing tidak diizinkan mengubah kepemilikan atau cabang lead." });
  }
  if (body.branch !== undefined) {
    const normBranch = normalizeBranch(body.branch);
    if (!canAccessBranch(req.user, normBranch)) {
      return res.status(403).json({ detail: "Anda tidak dapat memindahkan lead ke cabang lain." });
    }
  }
  if (body.assigned_to !== undefined && body.assigned_to !== null && body.assigned_to !== "") {
    const targetMkt = store.users.find((u) => u.id === body.assigned_to);
    if (!targetMkt || targetMkt.role !== "marketing") {
      return res.status(400).json({ detail: "Marketing tujuan tidak valid." });
    }
    const effectiveBranch = body.branch !== undefined ? normalizeBranch(body.branch) : normalizeBranch(lead.branch);
    if (!canAccessBranch(req.user, targetMkt.branch) || normalizeBranch(targetMkt.branch) !== effectiveBranch) {
      return res.status(403).json({ detail: "Marketing tujuan harus berada di cabang yang sama dengan lead." });
    }
    if (req.user.role === "sales_manager" && targetMkt.manager_id !== req.user.id) {
      return res.status(403).json({
        detail: "Sales Manager hanya dapat menugaskan prospek kepada Marketing di bawah supervisinya sendiri."
      });
    }
  }

  withTransaction(() => {
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        if (key === "pension_salary") {
          lead.pension_salary = Number(body.pension_salary);
        } else if (key === "branch") {
          lead.branch = normalizeBranch(body.branch);
        } else if (key === "assigned_to") {
          const m = body.assigned_to ? store.users.find((u) => u.id === body.assigned_to) : null;
          lead.assigned_to = m ? m.id : null;
          lead.assigned_name = m ? m.name : null;
          if (m) {
            const smInfo =
              req.user.role === "sales_manager"
                ? { sales_manager_id: req.user.id, sales_manager_name: req.user.name }
                : resolveSmForMarketing(store, m, lead.sales_manager_id, lead.sales_manager_name);
            lead.sales_manager_id = smInfo.sales_manager_id;
            lead.sales_manager_name = smInfo.sales_manager_name;
          } else if (req.user.role === "sales_manager") {
            lead.sales_manager_id = req.user.id;
            lead.sales_manager_name = req.user.name;
          }
        } else {
          lead[key] = body[key];
        }
      }
    }
    if (body.birth_date && allowedFields.includes("birth_date")) {
      const ageObj = computeAgeDetail(body.birth_date);
      if (ageObj?.years) lead.age = ageObj.years;
    }
    lead.updated_at = new Date().toISOString();
    addAuditLog(req.user, "update_lead", lead.name, `Memperbarui data/status lead menjadi ${lead.status}`, req.ip);
  });
  res.json(lead);
});

app.post("/api/leads/:id/activities", requireAuth, (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  if (!canAccessLead(req.user, lead)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada lead ini." });
  }
  const act = withTransaction(() => {
    const createdAct = {
      id: `act-${Date.now()}`,
      type: String(req.body?.type || "catatan"),
      note: String(req.body?.note || ""),
      user_name: req.user.name,
      created_at: new Date().toISOString()
    };
    lead.activities = [createdAct, ...(lead.activities || [])];
    lead.updated_at = new Date().toISOString();
    return createdAct;
  });
  res.json(act);
});

app.get("/api/leads/:id/documents", requireAuth, (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  if (!canAccessLead(req.user, lead)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada dokumen lead ini." });
  }
  res.json(lead.documents || []);
});

app.post("/api/leads/:id/documents", requireAuth, upload.single("file"), (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  if (!canAccessLead(req.user, lead)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengunggah dokumen pada lead ini." });
  }
  if (!req.file) return res.status(400).json({ detail: "File tidak ditemukan" });
  const detected = detectSafeDocumentType(req.file.buffer, req.file.originalname);
  if (!detected) {
    return res.status(400).json({
      detail: "Format berkas tidak didukung atau mengandung konten aktif. Hanya file PDF, JPG, atau PNG asli yang diperbolehkan."
    });
  }
  const docMeta = withTransaction(() => {
    const docId = `ldoc-${Date.now()}`;
    saveUploadedFile(docId, req.file.originalname, detected.mime, req.file.buffer);
    const createdDoc = {
      id: docId,
      category: String(req.query.category || "KTP"),
      filename: req.file.originalname,
      uploaded_at: new Date().toISOString(),
      uploaded_by: req.user.name
    };
    lead.documents = [createdDoc, ...(lead.documents || [])];
    lead.updated_at = new Date().toISOString();
    return createdDoc;
  });
  res.json(docMeta);
});

app.get("/api/documents/:id/download", requireAuth, (req, res) => {
  const store = getStore();
  const ownerLead = store.leads.find((l) => (l.documents || []).some((d) => d.id === req.params.id));
  if (!ownerLead) {
    return res.status(404).json({ detail: "Dokumen tidak ditemukan" });
  }
  if (!canAccessLead(req.user, ownerLead)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengunduh dokumen ini." });
  }
  const file = getUploadedFile(req.params.id);
  if (!file) return res.status(404).json({ detail: "Dokumen tidak ditemukan" });
  res.setHeader("Content-Type", file.mime_type || "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.send(Buffer.from(file.data));
});

app.delete("/api/documents/:id", requireAuth, (req, res) => {
  const store = getStore();
  const ownerLead = store.leads.find((l) => (l.documents || []).some((d) => d.id === req.params.id));
  if (!ownerLead) {
    return res.status(404).json({ detail: "Dokumen tidak ditemukan" });
  }
  if (!canAccessLead(req.user, ownerLead)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk menghapus dokumen ini." });
  }
  withTransaction(() => {
    ownerLead.documents = (ownerLead.documents || []).filter((d) => d.id !== req.params.id);
    ownerLead.updated_at = new Date().toISOString();
    deleteUploadedFile(req.params.id);
  });
  res.json({ ok: true });
});

app.get("/api/imports", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const store = getStore();
  const visibleImports = (store.imports || []).filter((imp) => canAccessImportBatch(req.user, imp));
  res.json(visibleImports);
});

app.get("/api/imports/template", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const csv = "Nama,Telepon,Kota,Cabang,Sumber,NOPEN,NIP,Gaji Pensiun,Tanggal Lahir,Sales Manager,Marketing\nH. AHMAD SUBAGJA,081234567890,Kota Bandung,BANDUNG,Data Taspen,195201011977031001,195201011977031001,4650000,1952-01-01,,\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="template_impor_leads.csv"');
  res.send(csv);
});

app.post("/api/imports", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "Pilih file terlebih dahulu (.xlsx atau .csv)" });
  const store = getStore();

  let parsed;
  try {
    parsed = parseImportFile(req.file.buffer, req.file.originalname);
  } catch (err) {
    return res.status(400).json({ detail: err.message || "Gagal membaca berkas impor." });
  }

  // Tentukan target cabang eksplisit jika dipilih oleh user
  const requestedBranch = req.body?.target_branch && req.body.target_branch !== "auto"
    ? normalizeBranch(req.body.target_branch)
    : null;
  const forcedBranch = !isGlobalBranchScope(req.user) ? normalizeBranch(req.user.branch) : null;
  const explicitBranch = forcedBranch || requestedBranch || null;

  // Tentukan target Sales Manager jika dipilih atau jika user adalah Sales Manager
  const requestedManagerId = req.body?.target_manager_id && req.body.target_manager_id !== "auto"
    ? req.body.target_manager_id
    : null;
  const forcedManagerId = req.user.role === "sales_manager" ? req.user.id : null;
  const explicitManagerId = forcedManagerId || requestedManagerId || null;

  // Jika user adalah Sales Manager, cegah mode branch_pool agar data tidak bocor keluar dari tim SM
  let distributionMode = req.body?.distribution_mode || "auto_round_robin"; // auto_round_robin | sm_queue | branch_pool
  if (req.user.role === "sales_manager" && distributionMode === "branch_pool") {
    distributionMode = "sm_queue";
  }

  const batch = withTransaction(() => {
    let inserted = 0;
    let skipped_duplicates = 0;
    let assignedCount = 0;
    let smQueueCount = 0;
    let unassignedCount = 0;
    const errors = [...(parsed.errors || [])];
    const branchPointers = {};
    const smQueuePointers = {};
    const smTeamPointers = {};
    const branchBreakdown = {};
    const batchPhones = new Set();
    const todayIso = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const { name, phone, city, branch_hint, source, nopen, nip, salary, birth_date, age, sales_manager_hint, marketing_hint } = row;

      // Cegah duplikasi data di database maupun antar baris dalam batch
      if (
        store.leads.some((l) => (phone && l.phone === phone) || (nopen && l.nopen && l.nopen === nopen)) ||
        (phone && batchPhones.has(phone))
      ) {
        skipped_duplicates++;
        continue;
      }
      if (phone) batchPhones.add(phone);

      // Resolusi Cabang Kanonikal
      const targetBranch = explicitBranch || resolveBranchFromCityOrText(city, branch_hint, "") || "BANDUNG";

      // Ambil daftar Sales Manager & Marketing Aktif pada cabang tujuan (patuh bank_scope pengunggah)
      const branchSms = store.users.filter(
        (u) =>
          u.role === "sales_manager" &&
          u.active !== false &&
          normalizeBranch(u.branch) === targetBranch &&
          canAccessUserScope(req.user, u)
      );
      const branchMarketers = store.users.filter(
        (u) =>
          u.role === "marketing" &&
          u.active !== false &&
          normalizeBranch(u.branch) === targetBranch &&
          canAccessUserScope(req.user, u)
      );

      // Resolusi Sales Manager Spesifik (jika ada pilihan eksplisit atau kolom Sales Manager di file)
      let specificSmUser = null;
      if (explicitManagerId) {
        specificSmUser = store.users.find(
          (u) => u.id === explicitManagerId && u.role === "sales_manager" && u.active !== false
        );
      } else if (sales_manager_hint) {
        const smLower = sales_manager_hint.toLowerCase();
        specificSmUser = branchSms.find(
          (u) => u.name.toLowerCase().includes(smLower) || u.email.toLowerCase().includes(smLower)
        );
      }

      let assignedTo = null;
      let assignedName = null;
      let salesManagerId = specificSmUser ? specificSmUser.id : null;
      let salesManagerName = specificSmUser ? specificSmUser.name : null;

      // Jika ada penunjukan marketing spesifik via kolom file
      if (marketing_hint) {
        const mktLower = marketing_hint.toLowerCase();
        const allowedHintMarketers = specificSmUser
          ? branchMarketers.filter((u) => u.manager_id === specificSmUser.id)
          : branchMarketers;
        const specificMkt = allowedHintMarketers.find(
          (u) => u.name.toLowerCase().includes(mktLower) || u.email.toLowerCase().includes(mktLower)
        );
        if (specificMkt) {
          assignedTo = specificMkt.id;
          assignedName = specificMkt.name;
          const smInfo = resolveSmForMarketing(
            store,
            specificMkt,
            specificSmUser?.id || null,
            specificSmUser?.name || null
          );
          salesManagerId = smInfo.sales_manager_id;
          salesManagerName = smInfo.sales_manager_name;
          assignedCount++;
        }
      }

      if (!assignedTo) {
        if (distributionMode === "branch_pool" && !specificSmUser) {
          // Masuk ke Pool Cadangan Cabang Netral (tanpa SM & tanpa Marketing)
          salesManagerId = null;
          salesManagerName = null;
          unassignedCount++;
        } else if (distributionMode === "sm_queue") {
          // Masuk ke antrean Sales Manager (belum ditugaskan ke marketing)
          if (!specificSmUser && branchSms.length > 0) {
            // Distribusi Round-Robin adil ke seluruh Sales Manager aktif di cabang tersebut
            if (smQueuePointers[targetBranch] === undefined) {
              smQueuePointers[targetBranch] = 0;
            }
            const chosenSm = branchSms[smQueuePointers[targetBranch] % branchSms.length];
            smQueuePointers[targetBranch]++;
            salesManagerId = chosenSm.id;
            salesManagerName = chosenSm.name;
          }
          if (salesManagerId) {
            smQueueCount++;
          } else {
            unassignedCount++;
          }
        } else {
          // Default: auto_round_robin
          if (specificSmUser) {
            // KRITIS: Jika SM tertentu dipilih (atau yang mengimpor adalah SM itu sendiri),
            // HANYA distribusikan ke marketing di bawah supervisi SM tersebut!
            // Jika SM tersebut belum memiliki marketing aktif, masukkan ke Antrean SM tersebut (JANGAN bocor ke SM lain!).
            const smTeam = branchMarketers.filter((u) => u.manager_id === specificSmUser.id);
            if (smTeam.length > 0) {
              if (smTeamPointers[specificSmUser.id] === undefined) {
                smTeamPointers[specificSmUser.id] = 0;
              }
              const marketer = smTeam[smTeamPointers[specificSmUser.id] % smTeam.length];
              smTeamPointers[specificSmUser.id]++;
              assignedTo = marketer.id;
              assignedName = marketer.name;
              salesManagerId = specificSmUser.id;
              salesManagerName = specificSmUser.name;
              assignedCount++;
            } else {
              // Masuk ke Antrean SM terkait (aman dari kebocoran lintas-SM)
              salesManagerId = specificSmUser.id;
              salesManagerName = specificSmUser.name;
              smQueueCount++;
            }
          } else {
            // Admin memilih "Otomatis" untuk seluruh cabang (lintas semua SM di cabang tersebut)
            if (branchMarketers.length > 0) {
              if (branchPointers[targetBranch] === undefined) {
                branchPointers[targetBranch] = 0;
              }
              const marketer = branchMarketers[branchPointers[targetBranch] % branchMarketers.length];
              branchPointers[targetBranch]++;
              assignedTo = marketer.id;
              assignedName = marketer.name;
              const smInfo = resolveSmForMarketing(store, marketer);
              salesManagerId = smInfo.sales_manager_id;
              salesManagerName = smInfo.sales_manager_name;
              assignedCount++;
            } else if (branchSms.length > 0) {
              // Belum ada marketing aktif di cabang, bagi rata ke antrean Sales Manager cabang
              if (smQueuePointers[targetBranch] === undefined) {
                smQueuePointers[targetBranch] = 0;
              }
              const chosenSm = branchSms[smQueuePointers[targetBranch] % branchSms.length];
              smQueuePointers[targetBranch]++;
              salesManagerId = chosenSm.id;
              salesManagerName = chosenSm.name;
              smQueueCount++;
            } else {
              // Zero-Marketer & Zero-SM Fallback -> Pool Cadangan Cabang
              salesManagerId = null;
              salesManagerName = null;
              unassignedCount++;
            }
          }
        }
      }

      // Statistik per cabang
      if (!branchBreakdown[targetBranch]) {
        branchBreakdown[targetBranch] = {
          total: 0,
          assigned: 0,
          sm_queue: 0,
          pool: 0,
          marketers: branchMarketers.map((m) => m.name),
          sales_managers: specificSmUser ? [specificSmUser.name] : branchSms.map((s) => s.name)
        };
      }
      branchBreakdown[targetBranch].total++;
      if (assignedTo) {
        branchBreakdown[targetBranch].assigned++;
      } else if (salesManagerId) {
        branchBreakdown[targetBranch].sm_queue++;
      } else {
        branchBreakdown[targetBranch].pool++;
      }

      let noteAction = `Disimpan di Pool Cadangan Cabang ${targetBranch}`;
      if (assignedTo) {
        noteAction = `Dialokasikan otomatis ke Marketing ${assignedName}${salesManagerName ? ` (SM: ${salesManagerName})` : ""} via Distribusi Cabang ${targetBranch}`;
      } else if (salesManagerId) {
        noteAction = `Dialokasikan ke Jalur Antrean Sales Manager ${salesManagerName} (${targetBranch})`;
      }

      const initialActivities = [
        {
          id: `act-${Date.now()}-${i}`,
          type: "system",
          notes: noteAction,
          created_at: new Date().toISOString()
        }
      ];

      store.leads.unshift({
        id: `lead-${Date.now()}-${i}`,
        name,
        phone,
        city: city || "Kota Bandung",
        branch: targetBranch,
        source: source || "Impor Database",
        nopen: nopen || "",
        nip: nip || nopen || "",
        pension_salary: salary,
        birth_date: birth_date || "1954-05-10",
        age: age || 65,
        status: "baru",
        follow_up_date: todayIso,
        assigned_to: assignedTo,
        assigned_name: assignedName,
        sales_manager_id: salesManagerId,
        sales_manager_name: salesManagerName,
        notes: "",
        activities: initialActivities,
        documents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      inserted++;
    }

    const createdBatch = {
      id: `imp-${Date.now()}`,
      filename: req.file.originalname,
      user_name: req.user.name,
      uploaded_by_id: req.user.id,
      branch: explicitBranch || null,
      target_manager_id: explicitManagerId || null,
      total_rows: parsed.rows.length + (parsed.errors?.length || 0),
      inserted,
      skipped_duplicates,
      assigned_count: assignedCount,
      sm_queue_count: smQueueCount,
      unassigned_count: unassignedCount,
      branch_breakdown: branchBreakdown,
      error_count: errors.length,
      errors,
      created_at: new Date().toISOString()
    };
    store.imports.unshift(createdBatch);
    addAuditLog(
      req.user,
      "import_leads",
      createdBatch.filename,
      `Impor ${inserted} leads baru (${assignedCount} marketing, ${smQueueCount} antrean SM, ${unassignedCount} pool) dari ${createdBatch.filename}`,
      req.ip
    );
    return createdBatch;
  });
  res.json(batch);
});

// ============================================================================
// 6. 8-STAGE APPLICATION PROGRESS & DUAL CONTROL (VALIDATE)
// ============================================================================
app.get("/api/applications", requireAuth, (req, res) => {
  const store = getStore();
  let list = store.applications.filter((a) => canAccessApplication(req.user, a));

  const { q, stage, branch, date_from, date_to, manager_id } = req.query;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Number(req.query.page_size || 10));

  if (q) {
    const sq = String(q).toLowerCase();
    list = list.filter((a) =>
      a.app_no.toLowerCase().includes(sq) ||
      a.lead_name.toLowerCase().includes(sq) ||
      a.marketing_name.toLowerCase().includes(sq) ||
      (a.sales_manager_name && a.sales_manager_name.toLowerCase().includes(sq))
    );
  }
  if (manager_id) {
    list = list.filter(
      (a) =>
        a.sales_manager_id === manager_id ||
        (a.marketing_id && store.users.some((u) => u.id === a.marketing_id && u.manager_id === manager_id))
    );
  }
  if (stage === "ditolak") list = list.filter((a) => a.rejected);
  else if (stage) list = list.filter((a) => a.stage === stage && !a.rejected);
  if (branch) list = list.filter((a) => a.branch === branch);
  if (date_from) list = list.filter((a) => a.created_at.slice(0, 10) >= date_from);
  if (date_to) list = list.filter((a) => a.created_at.slice(0, 10) <= date_to);

  const visibleBranches = Array.from(
    new Set(
      store.applications
        .filter((a) => canAccessApplication(req.user, a))
        .map((a) => a.branch)
        .filter(Boolean)
    )
  );
  const claimMap = new Map();
  for (const c of store.claims) {
    if (c.application_id) {
      const existing = claimMap.get(c.application_id);
      if (!existing || c.status === "PAID" || (existing.status !== "PAID" && c.status !== "REJECTED")) {
        const sc = serializeClaimForUser(c, req.user);
        claimMap.set(c.application_id, {
          id: sc.id,
          claim_no: sc.claim_no,
          status: sc.status,
          amount: sc.amount,
          amount_fixed: sc.amount_fixed,
          paid_at: sc.paid_at
        });
      }
    }
  }

  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize).map((a) => ({
    ...a,
    claim: claimMap.get(a.id) || null
  }));
  res.json({ items, total, page, page_size: pageSize, branches: visibleBranches });
});

app.get("/api/applications/:id", requireAuth, (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  if (!canAccessApplication(req.user, appItem)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada pengajuan ini." });
  }
  const claim =
    store.claims.find((c) => c.application_id === appItem.id && c.status === "PAID") ||
    store.claims.find((c) => c.application_id === appItem.id && c.status !== "REJECTED") ||
    store.claims.find((c) => c.application_id === appItem.id);
  const sc = serializeClaimForUser(claim, req.user);
  res.json({
    ...appItem,
    claim: sc ? { id: sc.id, claim_no: sc.claim_no, status: sc.status, amount: sc.amount, amount_fixed: sc.amount_fixed, paid_at: sc.paid_at } : null
  });
});

app.get("/api/applications/:id/documents-zip", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch"), (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  if (!canAccessApplication(req.user, appItem)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengunduh berkas pengajuan ini." });
  }

  const entries = [];
  (appItem.checklist || []).forEach((doc, idx) => {
    if (!doc.filename) return;
    const fileId = documentFileId(appItem, doc);
    const stored = fileId && getUploadedFile(fileId);
    let fileBuf = null;
    let fileName = doc.filename;
    let fileDate = doc.uploaded_at ? new Date(doc.uploaded_at) : new Date();

    if (stored) {
      fileBuf = Buffer.from(stored.data);
      fileName = stored.filename || doc.filename;
    } else if (!IS_PROD && doc.filename) {
      const sim = store.simulations.find((s) => s.id === appItem.sim_id) || store.simulations[0];
      fileBuf = generateSimulationPdfBuffer(sim);
    }

    if (fileBuf && fileBuf.length > 0) {
      const numPrefix = String(idx + 1).padStart(2, "0");
      const safeEntryName = `${numPrefix}_${doc.key}_${sanitizeSafeFilename(fileName, `${doc.key}.pdf`)}`;
      entries.push({
        name: safeEntryName,
        data: fileBuf,
        date: fileDate
      });
    }
  });

  if (!entries.length) {
    return res.status(400).json({ detail: "Belum ada berkas dokumen yang diunggah pada pengajuan ini." });
  }

  const zipBuf = buildZipBuffer(entries);
  const cleanLeadName = sanitizeSafeFilename(appItem.lead_name || "NASABAH", "NASABAH");
  const cleanAppNo = sanitizeSafeFilename(appItem.app_no || "APP", "APP");
  const zipFilename = `Dokumen_Pengajuan_${cleanLeadName}_${cleanAppNo}.zip`;

  addAuditLog(req.user, "download_documents_zip", appItem.app_no, `Mengunduh ${entries.length} dokumen (${zipFilename})`, req.ip);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(zipBuf);
});

app.post("/api/applications/:id/documents/:key", requireAuth, upload.single("file"), (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  if (!canAccessApplication(req.user, appItem)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengunggah dokumen pada pengajuan ini." });
  }
  if (req.user.role === "sales_manager") {
    return res.status(403).json({ detail: "Sales Manager memiliki akses pantau (read-only) pada dokumen pengajuan." });
  }
  if (appItem.rejected) {
    return res.status(400).json({ detail: "Pengajuan yang telah ditolak tidak dapat diubah dokumennya." });
  }
  const doc = appItem.checklist.find((d) => d.key === req.params.key);
  if (!doc) return res.status(404).json({ detail: "Item dokumen tidak ditemukan" });
  if (!req.file) return res.status(400).json({ detail: "Pilih file PDF, JPG, atau PNG" });
  const detected = detectSafeDocumentType(req.file.buffer, req.file.originalname);
  if (!detected) {
    return res.status(400).json({
      detail: "Format berkas tidak didukung atau mengandung konten aktif. Hanya file PDF, JPG, atau PNG asli yang diperbolehkan."
    });
  }

  if (appItem.stage === "booking_live") return res.status(409).json({ detail: "Dokumen pengajuan yang sudah Booking/Live tidak dapat diganti." });
  if (
    req.user.role === "marketing" &&
    appItem.stage !== "upload_dokumen" &&
    appItem.pending?.party !== "marketing"
  ) {
    return res.status(403).json({
      detail: "Dokumen pengajuan sudah masuk tahap verifikasi bank dan hanya dapat diperbarui jika diminta revisi oleh Admin."
    });
  }
  withTransaction(() => {
    const previousId = documentFileId(appItem, doc);
    const previous = previousId && getUploadedFile(previousId);
    const previousVersion = documentVersion(doc);
    doc.version_history = Array.isArray(doc.version_history) ? doc.version_history : [];
    if (previous && !doc.version_history.some((item) => item.file_id === previousId)) {
      doc.version_history.push({ version: previousVersion, file_id: previousId, filename: previous.filename,
        sha256: documentHash(previous.data), uploaded_at: doc.uploaded_at });
    }
    const version = previous ? previousVersion + 1 : Math.max(1, (doc.versions || 0) + 1);
    const fileId = `appdoc-${appItem.id}-${doc.key}-v${version}-${crypto.randomUUID()}`;
    saveUploadedFile(fileId, req.file.originalname, detected.mime, req.file.buffer);
    doc.file_id = fileId;
    doc.versions = version;
    doc.sha256 = documentHash(req.file.buffer);
    doc.version_history.push({ version, file_id: fileId, filename: req.file.originalname,
      sha256: doc.sha256, uploaded_at: new Date().toISOString(), uploaded_by_id: req.user.id });
    delete doc.reviewed_version; delete doc.reviewed_sha256; delete doc.reviewed_by; delete doc.reviewed_at;
    doc.status = "diunggah";
    doc.filename = req.file.originalname;
    doc.uploaded_at = new Date().toISOString();
    doc.note = "";

    appItem.history.push({
      id: `h-${Date.now()}`,
      action: "upload_dokumen",
      note: `Mengunggah ${doc.label} (${doc.filename})`,
      user_name: req.user.name,
      role: req.user.role,
      at: new Date().toISOString()
    });
  });
  res.json(doc);
});

app.get("/api/applications/:id/documents/:key", requireAuth, (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  if (!canAccessApplication(req.user, appItem)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk melihat dokumen pengajuan ini." });
  }
  const doc = appItem.checklist.find((d) => d.key === req.params.key);
  if (!doc || !doc.filename) {
    return res.status(404).json({ detail: "Berkas dokumen belum diunggah." });
  }
  const fileId = documentFileId(appItem, doc);
  const stored = fileId && getUploadedFile(fileId);
  const isCorruptOrDummy = stored && (!stored.data || stored.data.length < 15);

  if (stored && !isCorruptOrDummy) {
    res.setHeader("Content-Type", stored.mime_type || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${stored.filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Document-Version", String(documentVersion(doc)));
    res.setHeader("X-Document-SHA256", documentHash(stored.data));
    return res.send(Buffer.from(stored.data));
  }
  // Synthetic files belong only to the local demo, never production documents.
  if (!IS_PROD && doc.filename) {
    const sim = store.simulations.find((s) => s.id === appItem.sim_id) || store.simulations[0];
    const pdfBuf = generateSimulationPdfBuffer(sim);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${doc.filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    return res.send(pdfBuf);
  }
  if (isCorruptOrDummy) {
    return res.status(422).json({
      detail: `Berkas dokumen '${doc.filename}' rusak atau tidak lengkap (${stored.data?.length || 0} bytes). Silakan unggah ulang berkas dokumen asli.`
    });
  }
  return res.status(404).json({ detail: "Berkas dokumen tidak ditemukan." });
});

app.post("/api/applications/:id/documents/:key/review", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch"), (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  if (!canAccessApplication(req.user, appItem)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk memverifikasi dokumen pengajuan ini." });
  }
  const doc = appItem.checklist.find((d) => d.key === req.params.key);
  if (!doc) return res.status(404).json({ detail: "Dokumen tidak ditemukan" });

  const { status, note, expected_version, expected_sha256 } = req.body || {};
  const normalizedStatus = status === "lengkap" ? "diterima" : status;
  if (!["diterima", "ditolak", "diunggah"].includes(normalizedStatus)) {
    return res.status(400).json({ detail: "Status verifikasi dokumen tidak valid." });
  }
  if (normalizedStatus === "diterima" && !doc.filename) {
    return res.status(400).json({ detail: "Dokumen belum diunggah sehingga tidak dapat disetujui (diterima)." });
  }
  if (normalizedStatus === "ditolak" && !String(note || "").trim()) {
    return res.status(400).json({ detail: "Catatan alasan penolakan/revisi dokumen wajib diisi." });
  }

  if (appItem.rejected || appItem.stage === "booking_live") return res.status(409).json({ detail: "Pengajuan yang final tidak dapat diubah verifikasi dokumennya." });
  const fileId = documentFileId(appItem, doc);
  const stored = fileId && getUploadedFile(fileId);
  if (normalizedStatus === "diterima" && !stored) return res.status(400).json({ detail: "Berkas asli tidak ditemukan. Unggah ulang sebelum menyetujui." });
  if (!Number.isInteger(expected_version) || expected_version !== documentVersion(doc)) return res.status(409).json({ error_code: "DOCUMENT_VERSION_CONFLICT", detail: "Versi berkas berubah atau belum dipilih. Buka dan periksa kembali berkas terbaru." });
  const currentHash = stored && documentHash(stored.data);
  if (normalizedStatus === "diterima" && expected_sha256 !== currentHash) return res.status(409).json({ error_code: "DOCUMENT_VERSION_CONFLICT", detail: "Isi berkas berubah. Buka dan periksa kembali berkas terbaru." });
  withTransaction(() => {
    doc.status = normalizedStatus;
    doc.reviewed_version = documentVersion(doc);
    doc.reviewed_sha256 = currentHash || null;
    doc.note = note || "";
    doc.reviewed_by = req.user.name;
    doc.reviewed_at = new Date().toISOString();
    if (normalizedStatus === "ditolak") {
      appItem.pending = { party: "marketing", type: "revisi", note: `Revisi dokumen ${doc.label}: ${note}` };
    } else if (normalizedStatus === "diterima") {
      const allAccepted = appItem.checklist.every((d) => documentAccepted(appItem, d, getUploadedFile));
      if (allAccepted && appItem.pending?.type === "revisi") {
        appItem.pending = { party: "admin_ops", type: "pemeriksaan", note: "Seluruh dokumen telah diperbaiki dan diterima." };
      }
    }
    appItem.history.push({
      id: `h-${Date.now()}`,
      action: `review_${normalizedStatus}`,
      note: `${doc.label}: ${normalizedStatus}${note ? ` (${note})` : ""}`,
      user_name: req.user.name,
      role: req.user.role,
      at: new Date().toISOString()
    });
  });
  res.json(doc);
});

const APP_ACTION_ROLE_MAP = {
  submit: ["marketing", "super_admin", "admin_ops", "admin_branch"],
  request_revision: ["super_admin", "admin_ops", "admin_branch"],
  forward: ["super_admin", "admin_ops", "admin_branch"],
  advance: ["super_admin", "admin_ops", "admin_branch"],
  reject_bank: ["super_admin", "admin_ops", "admin_branch"],
  validate: ["super_admin"],
  resolve_validate: ["super_admin", "admin_ops"],
  accept_validate: ["super_admin"]
};

app.post("/api/applications/:id/action", requireAuth, (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  if (!canAccessApplication(req.user, appItem)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada pengajuan ini." });
  }

  const { action, note, process_date, ref_no, booking_date, credit_no } = req.body || {};
  const allowedRoles = APP_ACTION_ROLE_MAP[action];
  if (!allowedRoles) {
    return res.status(400).json({ detail: "Aksi pengajuan tidak dikenali." });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ detail: "Peran Anda tidak berwenang mengeksekusi aksi tahapan ini." });
  }
  if (appItem.rejected) {
    return res.status(400).json({ detail: "Pengajuan yang sudah ditolak tidak dapat diproses lebih lanjut." });
  }
  if (
    appItem.stage === "booking_live" &&
    !["validate", "resolve_validate", "accept_validate"].includes(action)
  ) {
    return res.status(409).json({ detail: "Pengajuan sudah berstatus Booking/Live." });
  }

  // Validate required inputs before transaction
  if (action === "submit") {
    const unuploaded = (appItem.checklist || []).filter((d) => !d.filename || !getUploadedFile(documentFileId(appItem, d) || ""));
    if (unuploaded.length > 0) {
      return res.status(400).json({
        detail: `Tidak dapat mengajukan pemeriksaan: masih ada ${unuploaded.length} dokumen yang belum diunggah (${unuploaded.map((d) => d.label).join(", ")}).`
      });
    }
    const rejected = (appItem.checklist || []).filter((d) => d.status === "ditolak");
    if (rejected.length > 0) {
      return res.status(400).json({
        detail: `Tidak dapat mengajukan pemeriksaan: terdapat ${rejected.length} dokumen berstatus ditolak yang perlu diperbaiki (${rejected.map((d) => d.label).join(", ")}).`
      });
    }
  }
  if (action === "forward") {
    const notAccepted = (appItem.checklist || []).filter((d) => !documentAccepted(appItem, d, getUploadedFile));
    if (notAccepted.length > 0) {
      return res.status(400).json({
        detail: `Pengajuan belum dapat diteruskan ke bank: terdapat ${notAccepted.length} dokumen yang belum diverifikasi dan disetujui (${notAccepted.map((d) => d.label).join(", ")}).`
      });
    }
  }
  if (action === "request_revision" && !String(note || "").trim()) {
    return res.status(400).json({ detail: "Catatan revisi wajib diisi" });
  }
  if (action === "validate" && !String(note || "").trim()) {
    return res.status(400).json({ detail: "Alasan Validate wajib diisi oleh Super Admin" });
  }
  if (action === "resolve_validate" && !String(note || "").trim()) {
    return res.status(400).json({ detail: "Catatan perbaikan Validate wajib diisi" });
  }
  if (action === "reject_bank" && !String(note || "").trim()) {
    return res.status(400).json({ detail: "Alasan penolakan bank wajib diisi" });
  }
  if (action === "advance") {
    {
      const notAccepted = (appItem.checklist || []).filter((d) => !documentAccepted(appItem, d, getUploadedFile));
      if (notAccepted.length > 0) {
        return res.status(400).json({
          detail: `Tahap pengajuan tidak dapat dimajukan: seluruh dokumen wajib diverifikasi dan disetujui (diterima) terlebih dahulu (${notAccepted.map((d) => d.label).join(", ")}).`
        });
      }
    }
    const nextIdx = Math.min(APP_STAGES.length - 2, appItem.stage_index + 1);
    const nextStage = APP_STAGES[nextIdx];
    if (nextStage.key === "booking_live" && (!booking_date || !credit_no)) {
      return res.status(400).json({ detail: "Tanggal booking dan Nomor Kredit Nasabah wajib diisi untuk Booking/Live" });
    }
  }

  const now = new Date().toISOString();
  withTransaction(() => {
    if (action === "submit") {
      appItem.pending = { party: "admin_ops", type: "pemeriksaan", note: note || "Menunggu pemeriksaan kelengkapan dokumen oleh Admin Operasional" };
    } else if (action === "request_revision") {
      appItem.pending = { party: "marketing", type: "revisi", note };
    } else if (action === "forward") {
      appItem.stage_index = 2; // verifikasi_bank
      appItem.stage = APP_STAGES[2].key;
      appItem.stage_data.pengajuan_bank = { by_name: req.user.name, date: process_date || now.slice(0, 10), ref_no };
      appItem.stage_data.verifikasi_bank = { by_name: req.user.name, date: process_date || now.slice(0, 10) };
      appItem.pending = null;
    } else if (action === "validate") {
      appItem.pending = { party: "admin_ops", type: "validate", note };
    } else if (action === "resolve_validate") {
      appItem.pending = { party: "super_admin", type: "pemeriksaan_validate", note };
    } else if (action === "accept_validate") {
      appItem.pending = null;
    } else if (action === "advance") {
      const nextIdx = Math.min(APP_STAGES.length - 2, appItem.stage_index + 1);
      const nextStage = APP_STAGES[nextIdx];
      if (nextStage.key === "booking_live") {
        appItem.booking = { date: booking_date, credit_no, confirmed_by: req.user.name };
        const lead = store.leads.find((l) => l.id === appItem.lead_id);
        if (lead) {
          lead.status = "berhasil";
          lead.updated_at = now;
        }
      }
      appItem.stage_index = nextIdx;
      appItem.stage = nextStage.key;
      appItem.stage_data[nextStage.key] = { by_name: req.user.name, date: process_date || now.slice(0, 10), ref_no };
      appItem.pending = null;
    } else if (action === "reject_bank") {
      appItem.rejected = true;
      appItem.reject_reason = note;
      appItem.stage = "ditolak";
      appItem.pending = null;
      const lead = store.leads.find((l) => l.id === appItem.lead_id);
      if (lead) {
        lead.status = "gagal";
        lead.updated_at = now;
      }
    }

    appItem.history.push({
      id: `h-${Date.now()}`,
      action,
      note: note || `Tahap: ${appItem.stage}`,
      user_name: req.user.name,
      role: req.user.role,
      at: now
    });
    addAuditLog(req.user, `app_${action}`, appItem.app_no, `${action} pada pengajuan ${appItem.app_no}`, req.ip);
  });
  res.json(appItem);
});

// ============================================================================
// 7. INCENTIVE CLAIMS
// ============================================================================
app.get("/api/claims/eligible", requireAuth, (req, res) => {
  const store = getStore();
  const activeClaimAppIds = new Set(
    store.claims.filter((c) => c.status !== "REJECTED").map((c) => c.application_id)
  );
  const eligible = store.applications.filter(
    (a) =>
      a.stage === "booking_live" &&
      !a.rejected &&
      !activeClaimAppIds.has(a.id) &&
      canAccessApplication(req.user, a)
  );
  res.json(eligible);
});

app.get("/api/claims", requireAuth, (req, res) => {
  const store = getStore();
  let list = store.claims.filter((c) => canAccessClaim(req.user, c));
  const { q, status } = req.query;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Number(req.query.page_size || 10));
  if (q) {
    const sq = String(q).toLowerCase();
    list = list.filter((c) =>
      c.claim_no.toLowerCase().includes(sq) ||
      c.lead_name.toLowerCase().includes(sq) ||
      c.marketing_name.toLowerCase().includes(sq)
    );
  }
  if (status) list = list.filter((c) => c.status === status);
  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize).map((c) => serializeClaimForUser(c, req.user));
  res.json({ items, total, page, page_size: pageSize });
});

app.post("/api/claims", requireAuth, upload.single("file"), (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.body?.application_id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  if (!canAccessApplication(req.user, appItem)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada pengajuan ini." });
  }
  if (!["marketing", "admin_ops", "super_admin"].includes(req.user.role)) {
    return res.status(403).json({ detail: "Peran Anda tidak berwenang membuat pengajuan klaim insentif." });
  }
  if (appItem.stage !== "booking_live" || appItem.rejected) {
    return res.status(400).json({
      detail: "Klaim insentif hanya dapat diajukan untuk pengajuan yang telah mencapai tahap Booking/Live."
    });
  }
  if (store.claims.some((c) => c.application_id === appItem.id && c.status !== "REJECTED")) {
    return res.status(409).json({
      detail: "Pengajuan ini sudah memiliki klaim insentif aktif (tidak boleh klaim ganda)."
    });
  }

  let claimAmount = Math.round((appItem.plafond || 100000000) * 0.02);
  if (req.body?.amount !== undefined && req.body?.amount !== null && String(req.body.amount).trim() !== "") {
    const parsedAmt = Number(req.body.amount);
    if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      return res.status(400).json({ detail: "Nominal klaim tidak valid atau bernilai negatif/nol." });
    }
    if (!["super_admin", "admin_ops"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Hanya Admin Operasional atau Super Admin yang dapat menentukan nominal klaim khusus." });
    }
    claimAmount = Math.round(parsedAmt);
  }

  let uploadedMime = "application/pdf";
  if (req.file) {
    const detected = detectSafeDocumentType(req.file.buffer, req.file.originalname);
    if (!detected) {
      return res.status(400).json({ detail: "Format berkas bukti tidak didukung atau mengandung konten aktif. Hanya PDF, JPG, atau PNG asli yang diperbolehkan." });
    }
    uploadedMime = detected.mime;
  }

  const isFixed = Boolean(["super_admin", "admin_ops"].includes(req.user.role) && req.body?.amount !== undefined && req.body?.amount !== null && String(req.body.amount).trim() !== "");
  const claim = withTransaction(() => {
    const seq = String(store.claims.length + 1).padStart(4, "0");
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const claimId = `clm-${Date.now()}`;
    if (req.file) {
      saveUploadedFile(`${claimId}-booking`, req.file.originalname, uploadedMime, req.file.buffer);
    }

    const createdClaim = {
      id: claimId,
      claim_no: `CLM-${ym}-${seq}`,
      application_id: appItem.id,
      app_no: appItem.app_no,
      lead_name: appItem.lead_name,
      bank_key: appItem.bank_key || "ams2",
      bank_name: appItem.bank_name,
      marketing_id: appItem.marketing_id,
      marketing_name: appItem.marketing_name,
      sales_manager_id: appItem.sales_manager_id || req.user.manager_id || null,
      sales_manager_name: appItem.sales_manager_name || req.user.manager_name || null,
      branch: appItem.branch,
      booking_date: appItem.booking?.date || new Date().toISOString().slice(0, 10),
      credit_no: req.body?.credit_no || appItem.booking?.credit_no || "",
      amount: claimAmount,
      amount_fixed: isFixed,
      status: "DRAFT",
      notes: req.body?.notes || "",
      booking_proof: req.file ? req.file.originalname : "bukti_akad.pdf",
      payment_proof: null,
      history: [
        { id: `ch-${Date.now()}`, action: "DRAFT", note: req.body?.notes || "Klaim dibuat", user_name: req.user.name, at: new Date().toISOString() }
      ],
      created_at: new Date().toISOString()
    };
    store.claims.unshift(createdClaim);
    addAuditLog(req.user, "create_claim", createdClaim.claim_no, `Membuat klaim insentif ${createdClaim.claim_no} (${createdClaim.app_no})`, req.ip);
    return createdClaim;
  });
  res.json(serializeClaimForUser(claim, req.user));
});

app.get("/api/claims/:id", requireAuth, (req, res) => {
  const store = getStore();
  const claim = store.claims.find((c) => c.id === req.params.id);
  if (!claim) return res.status(404).json({ detail: "Klaim tidak ditemukan" });
  if (!canAccessClaim(req.user, claim)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada klaim ini." });
  }
  res.json(serializeClaimForUser(claim, req.user));
});

app.post("/api/claims/:id/action", requireAuth, (req, res) => {
  const store = getStore();
  const claim = store.claims.find((c) => c.id === req.params.id);
  if (!claim) return res.status(404).json({ detail: "Klaim tidak ditemukan" });
  if (!canAccessClaim(req.user, claim)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada klaim ini." });
  }
  const { action, note, amount } = req.body || {};
  const map = { submit: "SUBMITTED", review: "REVIEW", revision: "REVISION", approve: "APPROVED", reject: "REJECTED", set_amount: claim.status };
  const nextStatus = map[action];
  if (!nextStatus) {
    return res.status(400).json({ detail: "Aksi klaim tidak valid." });
  }

  if (action === "set_amount") {
    if (!["super_admin", "admin_ops"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Hanya Admin Operasional atau Super Admin yang berwenang menetapkan nominal insentif." });
    }
  }

  if (action === "approve" && !["super_admin", "admin_ops"].includes(req.user.role)) {
    return res.status(403).json({ detail: "Hanya Admin Operasional atau Super Admin yang berwenang menyetujui klaim." });
  }
  if (action === "reject" && !["super_admin", "admin_ops"].includes(req.user.role)) {
    return res.status(403).json({ detail: "Hanya Admin Operasional atau Super Admin yang berwenang menolak klaim." });
  }

  if (claim.status === "PAID") {
    return res.status(400).json({ detail: "Klaim yang sudah dibayar (PAID) bersifat final dan tidak dapat diubah." });
  }

  // Validate amount modification authorization & non-negative business rule
  let parsedAmount = null;
  if (amount !== undefined && amount !== null && String(amount).trim() !== "") {
    parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ detail: "Nominal klaim harus berupa angka positif." });
    }
    if (!["super_admin", "admin_ops"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Hanya Admin Operasional atau Super Admin yang berwenang mengubah nominal klaim." });
    }
  }

  if (action === "set_amount" && parsedAmount === null) {
    return res.status(400).json({ detail: "Nominal insentif wajib diisi." });
  }

  if (action === "submit") {
    if (!["marketing", "admin_branch", "admin_ops", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Peran Anda tidak berwenang mengajukan klaim." });
    }
    if (!["DRAFT", "REVISION"].includes(claim.status)) {
      return res.status(409).json({ detail: `Klaim berstatus ${claim.status} tidak dapat diajukan ulang.` });
    }
  } else if (action === "approve") {
    if (!["super_admin", "admin_ops"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Hanya Admin Operasional atau Super Admin yang berwenang menyetujui klaim." });
    }
    if (claim.status === "PAID") {
      return res.status(409).json({ detail: "Klaim ini sudah disetujui & dibayarkan (PAID) sebelumnya." });
    }
    if (claim.status === "APPROVED") return res.status(409).json({ detail: "Klaim sudah disetujui. Lanjutkan pencatatan pembayaran dengan bukti transfer." });
    if (!["DRAFT", "SUBMITTED", "REVIEW", "REVISION"].includes(claim.status)) {
      return res.status(400).json({ detail: `Klaim berstatus ${claim.status} tidak dapat disetujui.` });
    }
  } else if (action === "reject") {
    if (!["super_admin", "admin_ops"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Hanya Admin Operasional atau Super Admin yang berwenang menolak klaim." });
    }
    if (claim.status === "REJECTED") {
      return res.status(409).json({ detail: "Klaim ini sudah ditolak sebelumnya." });
    }
    if (!String(note || "").trim()) {
      return res.status(400).json({ detail: "Catatan alasan penolakan klaim wajib diisi." });
    }
  } else if (action === "revision") {
    if (!["super_admin", "admin_ops", "admin_branch"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Peran Anda tidak berwenang meminta revisi klaim." });
    }
    if (!["DRAFT", "SUBMITTED", "REVIEW"].includes(claim.status)) {
      return res.status(400).json({ detail: `Klaim berstatus ${claim.status} tidak dapat diminta revisi.` });
    }
    if (!String(note || "").trim()) {
      return res.status(400).json({ detail: "Catatan alasan revisi klaim wajib diisi." });
    }
  } else if (action === "review") {
    if (!["super_admin", "admin_ops"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Peran Anda tidak berwenang mereview klaim." });
    }
  }

  withTransaction(() => {
    claim.status = nextStatus;
    if (parsedAmount !== null) {
      claim.amount = Math.round(parsedAmount);
      claim.amount_fixed = true;
    }
    if (action === "approve") {
      claim.approved_at = new Date().toISOString();
      claim.approved_by_id = req.user.id;
      claim.approved_by = req.user.name;
      if (claim.amount > 0) {
        claim.amount_fixed = true;
      }
    }
    if (action === "revision") claim.revision_note = note;
    if (action === "reject") claim.reject_reason = note;
    claim.history.push({
      id: `ch-${Date.now()}`,
      action: action === "set_amount" ? "SET_AMOUNT" : claim.status,
      note: note || (action === "set_amount" ? `Nominal insentif ditetapkan Admin menjadi Rp${claim.amount.toLocaleString("id-ID")}` : (action === "approve" ? "Klaim disetujui (APPROVED); menunggu pembayaran" : "")),
      user_name: req.user.name,
      at: new Date().toISOString()
    });
    addAuditLog(req.user, `claim_${action}`, claim.claim_no, `Aksi ${action} (${claim.status}) pada klaim ${claim.claim_no}`, req.ip);
  });
  res.json(serializeClaimForUser(claim, req.user));
});

app.post("/api/claims/:id/pay", requireAuth, requireRoles("super_admin", "admin_ops"), upload.single("file"), (req, res) => {
  const store = getStore();
  const claim = store.claims.find((c) => c.id === req.params.id);
  if (!claim) return res.status(404).json({ detail: "Klaim tidak ditemukan" });
  if (!canAccessClaim(req.user, claim)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada klaim ini." });
  }
  if (claim.status === "PAID") {
    return res.status(409).json({ detail: "Klaim ini sudah pernah dibayarkan (PAID)." });
  }
  if (claim.status !== "APPROVED") {
    return res.status(400).json({ detail: "Pembayaran klaim hanya dapat dilakukan setelah klaim berstatus APPROVED." });
  }
  if (!req.file && !getUploadedFile(`${claim.id}-payment`)) {
    return res.status(400).json({ detail: "Bukti transfer/pembayaran wajib diunggah untuk menyelesaikan pembayaran klaim." });
  }

  let parsedAmount = null;
  if (req.body?.amount !== undefined && req.body?.amount !== null && String(req.body.amount).trim() !== "") {
    parsedAmount = Number(req.body.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ detail: "Nominal pembayaran klaim tidak valid atau bernilai negatif/nol." });
    }
  }

  if (parsedAmount !== null && Math.round(parsedAmount) !== claim.amount) return res.status(409).json({ detail: "Nominal pembayaran harus sama dengan nominal klaim yang telah disetujui." });
  let payFileMime = "application/pdf";
  if (req.file) {
    const detected = detectSafeDocumentType(req.file.buffer, req.file.originalname);
    if (!detected) {
      return res.status(400).json({ detail: "Format bukti transfer tidak didukung atau mengandung konten aktif. Hanya PDF, JPG, atau PNG asli yang diperbolehkan." });
    }
    payFileMime = detected.mime;
  }

  withTransaction(() => {
    if (req.file) {
      saveUploadedFile(`${claim.id}-payment`, req.file.originalname, payFileMime, req.file.buffer);
      claim.payment_proof = req.file.originalname;
    }
    if (parsedAmount !== null) claim.amount = Math.round(parsedAmount);
    claim.status = "PAID";
    claim.paid_at = new Date().toISOString();
    claim.paid_by = req.user.name;
    claim.payment_note = req.body?.note || "";
    claim.history.push({ id: `ch-${Date.now()}`, action: "PAID", note: claim.payment_note, user_name: req.user.name, at: claim.paid_at });
    addAuditLog(req.user, "pay_claim", claim.claim_no, `Membayar klaim ${claim.claim_no} sebesar Rp${claim.amount.toLocaleString("id-ID")}`, req.ip);
  });
  res.json(serializeClaimForUser(claim, req.user));
});

app.post("/api/claims/:id/proof", requireAuth, upload.single("file"), (req, res) => {
  const store = getStore();
  const claim = store.claims.find((c) => c.id === req.params.id);
  if (!claim) return res.status(404).json({ detail: "Klaim tidak ditemukan" });
  if (!canAccessClaim(req.user, claim)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada klaim ini." });
  }
  if (!["marketing", "admin_ops", "super_admin"].includes(req.user.role)) {
    return res.status(403).json({ detail: "Peran Anda tidak berwenang mengubah bukti klaim." });
  }
  if (claim.status === "PAID") {
    return res.status(400).json({ detail: "Klaim yang sudah dibayar tidak dapat diubah." });
  }
  if (!req.file) {
    return res.status(400).json({ detail: "File bukti wajib diunggah." });
  }
  const detected = detectSafeDocumentType(req.file.buffer, req.file.originalname);
  if (!detected) {
    return res.status(400).json({ detail: "Format berkas bukti tidak didukung atau mengandung konten aktif. Hanya PDF, JPG, atau PNG asli yang diperbolehkan." });
  }
  withTransaction(() => {
    saveUploadedFile(`${claim.id}-booking`, req.file.originalname, detected.mime, req.file.buffer);
    claim.booking_proof = req.file.originalname;
  });
  res.json(serializeClaimForUser(claim, req.user));
});

app.get("/api/claims/:id/file/:type", requireAuth, (req, res) => {
  const store = getStore();
  const claim = store.claims.find((c) => c.id === req.params.id);
  if (!claim) return res.status(404).json({ detail: "Klaim tidak ditemukan" });
  if (!canAccessClaim(req.user, claim)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengunduh berkas klaim ini." });
  }
  const fileType = req.params.type === "payment" ? "payment" : "booking";
  const stored = getUploadedFile(`${claim.id}-${fileType}`);
  if (stored) {
    res.setHeader("Content-Type", stored.mime_type || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${stored.filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    return res.send(Buffer.from(stored.data));
  }
  return res.status(404).json({ detail: `Berkas bukti ${fileType === "payment" ? "pembayaran" : "booking"} belum diunggah.` });
});

// ============================================================================
// 8. USERS, AUDIT LOGS & BACKUP
// ============================================================================
app.get("/api/users", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const store = getStore();
  let users = store.users;
  if (!isGlobalBranchScope(req.user)) {
    users = users.filter((u) => canAccessBranch(req.user, u.branch));
  }
  if (isBsiScopedUser(req.user)) {
    users = users.filter((u) => isBsiScopedUser(u));
  }
  if (req.user.role === "sales_manager") {
    users = users.filter(
      (u) =>
        u.id === req.user.id ||
        (u.role === "marketing" && (!u.manager_id || u.manager_id === req.user.id))
    );
  } else if (req.user.role === "admin_branch") {
    users = users.filter((u) => !["super_admin", "admin_ops"].includes(u.role));
  }
  const list = users.map((u) => ({
    ...sanitizeUser(u),
    lead_count:
      u.role === "sales_manager"
        ? store.leads.filter((l) => isLeadInSmScope(store, u, l)).length
        : store.leads.filter((l) => l.assigned_to === u.id).length,
    team_count: u.role === "sales_manager" ? store.users.filter((m) => m.manager_id === u.id).length : undefined
  }));
  res.json(list);
});

app.get("/api/users/:id", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const store = getStore();
  const target = store.users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });
  if (!canAccessBranch(req.user, target.branch)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses ke pengguna cabang lain." });
  }
  if (!canAccessUserScope(req.user, target)) {
    return res.status(403).json({ detail: "Admin BSI tidak dapat mengakses data pengguna di luar cakupan BSI." });
  }
  if (req.user.role === "sales_manager") {
    const allowed =
      target.id === req.user.id ||
      (target.role === "marketing" && (!target.manager_id || target.manager_id === req.user.id));
    if (!allowed) {
      return res.status(403).json({ detail: "Sales Manager hanya dapat mengakses profilnya sendiri atau Marketing binaannya." });
    }
  } else if (req.user.role === "admin_branch" && ["super_admin", "admin_ops"].includes(target.role)) {
    return res.status(403).json({ detail: "Admin Cabang tidak memiliki akses ke akun pusat." });
  }
  res.json(sanitizeUser(target));
});

app.post("/api/users", requireAuth, requireRoles("super_admin", "admin_ops"), asyncHandler(async (req, res) => {
  const store = getStore();
  const body = req.body || {};
  const targetRole = body.role || "marketing";
  if (!ROLE_LABEL[targetRole]) {
    return res.status(400).json({ detail: "Peran pengguna tidak valid." });
  }
  if (req.user.role === "admin_ops" && !["admin_branch", "sales_manager", "marketing"].includes(targetRole)) {
    return res.status(403).json({ detail: "Admin Operasional hanya dapat membuat akun Admin Cabang/Mitra, Sales Manager, atau Marketing." });
  }
  if (isBsiScopedUser(req.user) && body.bank_scope && body.bank_scope !== "bsi_only") {
    return res.status(403).json({ detail: "Admin BSI hanya dapat membuat pengguna dengan cakupan khusus BSI." });
  }
  if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120 ||
      typeof body.email !== "string" || body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return res.status(400).json({ detail: "Isi nama dan alamat email yang valid (nama maksimal 120 karakter)." });
  }
  if (body.bank_scope !== undefined && !["all_bank", "bsi_only"].includes(body.bank_scope)) return res.status(400).json({ detail: "Cakupan bank tidak valid." });
  const passwordError = passwordProblem(body.password, IS_PROD);
  if (passwordError) return res.status(400).json({ detail: passwordError });
  const targetBranch = isGlobalBranchScope(req.user)
    ? (body.branch !== undefined ? normalizeBranch(body.branch) : normalizeBranch(req.user.branch || "BANDUNG"))
    : normalizeBranch(req.user.branch || "BANDUNG");
  if (!canAccessBranch(req.user, targetBranch)) {
    return res.status(403).json({ detail: "Anda tidak dapat membuat pengguna untuk cabang lain." });
  }
  if (store.users.some((u) => u.email.toLowerCase() === String(body.email || "").trim().toLowerCase())) {
    return res.status(400).json({ detail: "Email sudah terdaftar." });
  }

  const bankScope =
    ["super_admin", "admin_ops"].includes(req.user.role) && body.bank_scope === "bsi_only"
      ? "bsi_only"
      : (req.user.bank_scope === "bsi_only" ? "bsi_only" : "all_bank");

  let assignedManagerId = null;
  let assignedManagerName = null;
  if (targetRole === "marketing" && body.manager_id) {
    const mgr = store.users.find((u) => u.id === body.manager_id);
    if (!mgr || mgr.role !== "sales_manager" || mgr.active === false) {
      return res.status(400).json({ detail: "Sales Manager pembina yang dipilih tidak valid." });
    }
    if (normalizeBranch(mgr.branch) !== targetBranch) {
      return res.status(400).json({ detail: "Sales Manager pembina harus berada di cabang yang sama." });
    }
    if (bankScope === "all_bank" && isBsiScopedUser(mgr)) {
      return res.status(400).json({ detail: "Marketing All Bank tidak dapat dibawahi oleh Sales Manager khusus BSI." });
    }
    assignedManagerId = mgr.id;
    assignedManagerName = mgr.name;
  }

  const encodedPassword = await hashPassword(body.password);
  currentActor(req);
  const currentStore = getStore();
  if (assignedManagerId) {
    const manager = currentStore.users.find((u) => u.id === assignedManagerId && u.role === "sales_manager" && u.active !== false);
    if (!manager || normalizeBranch(manager.branch) !== targetBranch || (bankScope === "all_bank" && isBsiScopedUser(manager))) return res.status(409).json({ detail: "Data Sales Manager berubah. Muat ulang pengguna." });
    assignedManagerName = manager.name;
  }
  if (currentStore.users.some((u) => u.email.toLowerCase() === String(body.email).trim().toLowerCase())) return res.status(409).json({ detail: "Email sudah terdaftar." });
  const newUser = withTransaction(() => {
    const createdUser = {
      id: `u-${crypto.randomUUID()}`,
      name: String(body.name).trim(),
      email: String(body.email).trim().toLowerCase(),
      password_hash: encodedPassword,
      auth_version: 0,
      must_change_password: IS_PROD,
      role: targetRole,
      branch: targetBranch,
      bank_scope: bankScope,
      phone: String(body.phone || "").trim(),
      active: true,
      manager_id: assignedManagerId,
      manager_name: assignedManagerName,
      created_at: new Date().toISOString()
    };
    currentStore.users.push(createdUser);
    addAuditLog(req.user, "create_user", createdUser.email, `Membuat akun ${createdUser.name} (${ROLE_LABEL[createdUser.role]})`, req.ip);
    return createdUser;
  });
  res.json(sanitizeUser(newUser));
}));

app.patch("/api/users/:id", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), asyncHandler(async (req, res) => {
  const store = getStore();
  let target = store.users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });
  if (!canAccessBranch(req.user, target.branch)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengubah pengguna cabang lain." });
  }
  if (!canAccessUserScope(req.user, target)) {
    return res.status(403).json({ detail: "Admin BSI hanya dapat mengelola pengguna dengan cakupan BSI." });
  }
  if (req.user.role === "admin_ops" && !["admin_branch", "sales_manager", "marketing"].includes(target.role)) {
    return res.status(403).json({ detail: "Admin Operasional hanya dapat mengubah akun Admin Cabang/Mitra, Sales Manager, atau Marketing." });
  }
  if ((req.user.role === "admin_branch" || req.user.role === "sales_manager") && target.role !== "marketing") {
    return res.status(403).json({ detail: `${ROLE_LABEL[req.user.role]} hanya dapat mengubah akun Marketing.` });
  }
  if (req.user.role === "sales_manager" && !isMarketingInSmTeam(store, req.user, target.id)) {
    return res.status(403).json({ detail: "Sales Manager hanya dapat mengubah akun Marketing yang berada di dalam tim binaannya sendiri." });
  }

  const { name, role, branch, bank_scope, phone, active, password, manager_id } = req.body || {};
  if (req.user.role === "sales_manager" && manager_id !== undefined && manager_id !== req.user.id) {
    return res.status(403).json({ detail: "Sales Manager tidak dapat memindahkan anggota tim ke Sales Manager lain." });
  }
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.trim().length > 120)) return res.status(400).json({ detail: "Nama wajib diisi dan maksimal 120 karakter." });
  if (bank_scope !== undefined && !["all_bank", "bsi_only"].includes(bank_scope)) return res.status(400).json({ detail: "Cakupan bank tidak valid." });
  if (active !== undefined && typeof active !== "boolean") return res.status(400).json({ detail: "Status aktif harus berupa boolean." });
  if (IS_PROD && target.active === false && active === true && !password) return res.status(400).json({ detail: "Tetapkan kata sandi sementara baru saat mengaktifkan kembali akun." });
  if (password !== undefined && password !== "") {
    const problem = passwordProblem(password, IS_PROD);
    if (problem) return res.status(400).json({ detail: problem });
  }
  if (role !== undefined && role !== target.role) {
    if (!ROLE_LABEL[role]) return res.status(400).json({ detail: "Peran tidak valid." });
    const canChangeRole =
      req.user.role === "super_admin" ||
      (req.user.role === "admin_ops" && ["admin_branch", "sales_manager", "marketing"].includes(role));
    if (!canChangeRole) {
      return res.status(403).json({ detail: "Anda tidak berwenang mengubah peran pengguna ini." });
    }
  }
  if (branch !== undefined) {
    const normBranch = normalizeBranch(branch);
    if (!canAccessBranch(req.user, normBranch)) {
      return res.status(403).json({ detail: "Anda tidak dapat memindahkan pengguna ke cabang lain." });
    }
  }

  let newManagerId = undefined;
  let newManagerName = undefined;
  if (manager_id !== undefined) {
    if (manager_id && (target.role === "marketing" || role === "marketing")) {
      const mgr = store.users.find((u) => u.id === manager_id);
      if (!mgr || mgr.role !== "sales_manager" || mgr.active === false) {
        return res.status(400).json({ detail: "Sales Manager pembina yang dipilih tidak valid." });
      }
      const effectiveBranch = branch !== undefined ? normalizeBranch(branch) : normalizeBranch(target.branch);
      if (normalizeBranch(mgr.branch) !== effectiveBranch) {
        return res.status(400).json({ detail: "Sales Manager pembina harus berada di cabang yang sama." });
      }
      const effectiveScope = bank_scope !== undefined ? bank_scope : target.bank_scope;
      if (effectiveScope === "all_bank" && isBsiScopedUser(mgr)) {
        return res.status(400).json({ detail: "Marketing All Bank tidak dapat dibawahi oleh Sales Manager khusus BSI." });
      }
      newManagerId = mgr.id;
      newManagerName = mgr.name;
    } else {
      newManagerId = null;
      newManagerName = null;
    }
  }

  const previousHash = target.password_hash;
  const previousVersion = target.auth_version || 0;
  const encodedPassword = password ? await hashPassword(password) : null;
  currentActor(req);
  target = getStore().users.find((u) => u.id === req.params.id);
  if (!target || target.password_hash !== previousHash || (target.auth_version || 0) !== previousVersion) return res.status(409).json({ detail: "Akun berubah. Muat ulang data pengguna." });
  if (newManagerId) {
    const manager = getStore().users.find((u) => u.id === newManagerId && u.role === "sales_manager" && u.active !== false);
    const effectiveBranch = branch !== undefined ? normalizeBranch(branch) : normalizeBranch(target.branch);
    const effectiveScope = bank_scope !== undefined ? bank_scope : (target.bank_scope || "all_bank");
    if (!manager || normalizeBranch(manager.branch) !== effectiveBranch || (effectiveScope === "all_bank" && isBsiScopedUser(manager))) return res.status(409).json({ detail: "Data Sales Manager berubah. Muat ulang pengguna." });
    newManagerName = manager.name;
  }
  if (target.id === req.user.id && (active === false || (role && role !== "super_admin")) && target.role === "super_admin") return res.status(400).json({ detail: "Super Admin tidak dapat menonaktifkan atau menurunkan perannya sendiri." });
  withTransaction(() => {
    if (password || (role !== undefined && role !== target.role) ||
        (branch !== undefined && normalizeBranch(branch) !== normalizeBranch(target.branch)) ||
        (bank_scope !== undefined && bank_scope !== (target.bank_scope || "all_bank")) ||
        (active !== undefined && Boolean(active) !== (target.active !== false))) target.auth_version = (target.auth_version || 0) + 1;
    if (name !== undefined) target.name = String(name).trim();
    if (role !== undefined) target.role = role;
    const branchChanged =
      branch !== undefined && isGlobalBranchScope(req.user) && normalizeBranch(branch) !== normalizeBranch(target.branch);
    if (branch !== undefined && isGlobalBranchScope(req.user)) target.branch = normalizeBranch(branch);
    if (bank_scope !== undefined && ["super_admin", "admin_ops"].includes(req.user.role)) {
      target.bank_scope = bank_scope === "bsi_only" ? "bsi_only" : "all_bank";
    }
    if (phone !== undefined) target.phone = String(phone).trim();
    if (active !== undefined) target.active = Boolean(active);
    if (encodedPassword) { target.password_hash = encodedPassword; target.must_change_password = IS_PROD; }
    if (branchChanged && newManagerId === undefined && target.role === "marketing") {
      target.manager_id = null;
      target.manager_name = null;
    }
    if (newManagerId !== undefined) {
      target.manager_id = newManagerId;
      target.manager_name = newManagerName;
    }
    if (target.role === "marketing" && (newManagerId !== undefined || branchChanged)) {
      const effectiveSmId = target.manager_id || null;
      const effectiveSmName = target.manager_name || null;
      const targetBranchNorm = normalizeBranch(target.branch);
      for (const l of store.leads) {
        if (l.assigned_to === target.id && normalizeBranch(l.branch) === targetBranchNorm) {
          l.sales_manager_id = effectiveSmId;
          l.sales_manager_name = effectiveSmName;
        }
      }
      for (const s of store.simulations) {
        if ((s.marketing_id === target.id || s.created_by === target.id) && normalizeBranch(s.branch) === targetBranchNorm) {
          s.sales_manager_id = effectiveSmId;
          s.sales_manager_name = effectiveSmName;
        }
      }
      for (const a of store.applications) {
        if (a.marketing_id === target.id && normalizeBranch(a.branch) === targetBranchNorm) {
          a.sales_manager_id = effectiveSmId;
          a.sales_manager_name = effectiveSmName;
        }
      }
      for (const c of store.claims) {
        if (c.marketing_id === target.id && normalizeBranch(c.branch) === targetBranchNorm) {
          c.sales_manager_id = effectiveSmId;
          c.sales_manager_name = effectiveSmName;
        }
      }
    }
    if (target.role === "sales_manager" && name !== undefined) {
      for (const u of store.users) {
        if (u.manager_id === target.id) {
          u.manager_name = target.name;
        }
      }
      for (const l of store.leads) {
        if (l.sales_manager_id === target.id) l.sales_manager_name = target.name;
      }
      for (const s of store.simulations) {
        if (s.sales_manager_id === target.id) s.sales_manager_name = target.name;
      }
      for (const a of store.applications) {
        if (a.sales_manager_id === target.id) a.sales_manager_name = target.name;
      }
      for (const c of store.claims) {
        if (c.sales_manager_id === target.id) c.sales_manager_name = target.name;
      }
    }
    addAuditLog(req.user, "update_user", target.email, `Memperbarui profil pengguna ${target.name}`, req.ip);
  });
  res.json(sanitizeUser(target));
}));

app.get("/api/audit-logs", requireAuth, requireRoles("super_admin", "admin_ops"), (req, res) => {
  const store = getStore();
  const { q, action } = req.query;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Number(req.query.page_size || 20));
  let list = store.audit_logs;
  const actions = Array.from(new Set(list.map((a) => a.action)));
  if (q) {
    const sq = String(q).toLowerCase();
    list = list.filter((a) =>
      String(a.user_name || "").toLowerCase().includes(sq) ||
      String(a.detail || "").toLowerCase().includes(sq)
    );
  }
  if (action) list = list.filter((a) => a.action === action);
  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  res.json({ items, total, actions, page, page_size: pageSize });
});

app.get("/api/backup", requireAuth, requireRoles("super_admin"), (req, res) => {
  const store = getStore();
  const files = getAllUploadedFiles();
  const backupPayload = {
    ...store,
    _uploaded_files: files
  };
  addAuditLog(req.user, "download_backup", "database", "Mengunduh salinan backup JSON database lengkap dengan berkas dokumen", req.ip);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="layanan_pensiunan_backup.json"');
  res.send(JSON.stringify(backupPayload, null, 2));
});

app.post("/api/backup/restore", requireAuth, requireRoles("super_admin"), (req, res, next) => {
  if (IS_PROD) return res.status(403).json({ detail: "Pemulihan data produksi dilakukan pengelola sistem saat maintenance menggunakan backup SQLite terverifikasi." });
  next();
}, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "Pilih file JSON backup" });
  let incoming;
  try {
    incoming = JSON.parse(req.file.buffer.toString("utf8"));
  } catch {
    return res.status(400).json({ detail: "Format file JSON backup tidak valid." });
  }
  const store = getStore();
  const restored = withTransaction(() => {
    const counts = { leads: 0, simulations: 0, applications: 0, claims: 0, users: 0, files: 0 };
    if (Array.isArray(incoming.leads)) {
      store.leads = incoming.leads;
      counts.leads = incoming.leads.length;
    }
    if (Array.isArray(incoming.simulations)) {
      store.simulations = incoming.simulations;
      counts.simulations = incoming.simulations.length;
    }
    if (Array.isArray(incoming.applications)) {
      store.applications = incoming.applications;
      counts.applications = incoming.applications.length;
    }
    if (Array.isArray(incoming.claims)) {
      store.claims = incoming.claims;
      counts.claims = incoming.claims.length;
    }
    if (Array.isArray(incoming.users) && incoming.users.length > 0) {
      store.users = incoming.users;
      counts.users = incoming.users.length;
    }
    if (Array.isArray(incoming.lead_requests)) {
      store.lead_requests = incoming.lead_requests;
      counts.lead_requests = incoming.lead_requests.length;
    } else {
      store.lead_requests = [];
    }
    if (Array.isArray(incoming.parameter_proposals)) {
      store.parameter_proposals = incoming.parameter_proposals;
    }
    if (incoming.partner_parameters && typeof incoming.partner_parameters === "object") {
      store.partner_parameters = incoming.partner_parameters;
    }
    if (Array.isArray(incoming._uploaded_files)) {
      for (const f of incoming._uploaded_files) {
        if (f.id && f.filename && f.data_base64) {
          restoreUploadedFileFromBackup(f.id, f.filename, f.mime_type, f.data_base64, f.created_at);
          counts.files++;
        }
      }
    }
    addAuditLog(req.user, "restore_backup", "database", `Memulihkan database (${counts.leads} leads, ${counts.files} files)`, req.ip);
    return counts;
  });
  res.json({ restored });
});

// Serve built React frontend in production if `frontend/dist` exists
const FRONTEND_DIST = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(
    express.static(FRONTEND_DIST, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("sw.js") || filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          if (filePath.endsWith("sw.js")) {
            res.setHeader("Service-Worker-Allowed", "/");
          }
        } else if (filePath.endsWith(".webmanifest")) {
          res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.includes(`${path.sep}brand${path.sep}`) || filePath.includes("/brand/")) {
          res.setHeader("Cache-Control", "public, max-age=86400");
        }
      }
    })
  );
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof PasswordServiceBusy) {
    res.setHeader("Retry-After", "5");
    return res.status(503).json({ detail: error.message });
  }
  if (error instanceof multer.MulterError) return res.status(400).json({ detail: error.code === "LIMIT_FILE_SIZE" ? "Berkas melebihi batas 12 MB." : "Unggahan tidak valid. Silakan pilih ulang berkas." });
  if (req.is("multipart/form-data") && /^(Unexpected end of (form|file)|Multipart:)/i.test(error.message || "")) return res.status(400).json({ detail: "Unggahan terputus atau tidak lengkap. Silakan pilih ulang berkas." });
  if (error.type === "entity.too.large") return res.status(413).json({ detail: "Ukuran permintaan melebihi batas yang diperbolehkan." });
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ detail: "Format permintaan JSON tidak valid." });
  console.error("[API_ERROR]", req.method, req.path, error.code || error.name);
  res.status(error.status || 500).json({ detail: error.status ? error.message : "Operasi gagal. Hubungi administrator jika masalah berulang." });
});

// Validate/load state before accepting traffic; never reseed a failed production state.
getStore();

// A draft pension preview is a local validation tool; do not expose this development server to the LAN.
const BIND_HOST = process.env.HOST || (IS_PROD || process.env.BSI_PENSIUN_PREVIEW === "true" ? "127.0.0.1" : undefined);
app.listen(PORT, BIND_HOST, () => {
  console.log(`[Layanan Pensiunan Enterprise API] Running on http://localhost:${PORT}`);
});
