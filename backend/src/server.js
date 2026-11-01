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
  hashPassword,
  APP_STAGES,
  DOC_TEMPLATE,
  saveUploadedFile,
  getUploadedFile,
  deleteUploadedFile
} from "./db/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const IS_PROD = process.env.NODE_ENV === "production";
const DEFAULT_DEV_JWT_SECRET = "lp_enterprise_jwt_secret_2026_ams2_bsi";

if (
  IS_PROD &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET === DEFAULT_DEV_JWT_SECRET ||
    String(process.env.JWT_SECRET).trim().length < 32)
) {
  console.error(
    "[FATAL] Production startup aborted: JWT_SECRET wajib dikonfigurasi secara aman (minimal 32 karakter)."
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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

app.use(cors({ origin: true, credentials: true }));
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
    branch: u.branch || "PUSAT JAKARTA",
    bank_scope: u.bank_scope || "all_bank",
    phone: u.phone || "",
    active: u.active !== false
  };
}

function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
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
    return user || null;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ detail: "Sesi berakhir atau belum login." });
  req.user = user;
  next();
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
  return !b || b === "PUSAT" || b === "PUSAT JAKARTA" || b === "ALL" || b === "ALL BANK";
}

function canAccessBranch(user, entityBranch) {
  if (!user) return false;
  if (isGlobalBranchScope(user)) return true;
  if (!entityBranch) return true;
  return String(entityBranch).trim().toUpperCase() === String(user.branch || "").trim().toUpperCase();
}

// Aturan Owner: Admin Cabang All Bank dapat melihat seluruh bank (termasuk BSI),
// sedangkan akun khusus BSI (bank_scope === "bsi_only") tidak boleh mencampuri bank lain di Cabang All Bank.
function canAccessBank(user, bankKey) {
  if (!user) return false;
  const normalizedBank = String(bankKey || "ams2").trim().toLowerCase();
  if (user.bank_scope === "bsi_only") {
    return normalizedBank === "bsi_prapen";
  }
  return true;
}

function canAccessLead(user, lead) {
  if (!user || !lead) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  if (user.role === "admin_branch" || user.role === "sales_manager") {
    return canAccessBranch(user, lead.branch);
  }
  return lead.assigned_to === user.id;
}

function canAccessSimulation(user, sim, store) {
  if (!user || !sim) return false;
  const simBank = sim.bank_key || sim.result?.bank_key || "ams2";
  if (!canAccessBank(user, simBank)) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  if (user.role === "admin_branch" || user.role === "sales_manager") {
    return canAccessBranch(user, sim.branch);
  }
  if (sim.created_by === user.id) return true;
  if (sim.lead_id && store) {
    const lead = store.leads.find((l) => l.id === sim.lead_id);
    if (lead && lead.assigned_to === user.id) return true;
  }
  return false;
}

function canAccessApplication(user, appItem) {
  if (!user || !appItem) return false;
  if (!canAccessBank(user, appItem.bank_key || "ams2")) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  if (user.role === "admin_branch" || user.role === "sales_manager") {
    return canAccessBranch(user, appItem.branch);
  }
  return appItem.marketing_id === user.id;
}

function canAccessClaim(user, claim) {
  if (!user || !claim) return false;
  const claimBank =
    claim.bank_key ||
    (String(claim.bank_name || "").toLowerCase().includes("bsi") ? "bsi_prapen" : "ams2");
  if (!canAccessBank(user, claimBank)) return false;
  if (user.role === "super_admin" || user.role === "admin_ops") return true;
  if (user.role === "admin_branch" || user.role === "sales_manager") {
    return canAccessBranch(user, claim.branch);
  }
  return claim.marketing_id === user.id;
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
  if (user.role === "admin_branch" || user.role === "sales_manager") {
    return store.leads.filter((l) => canAccessBranch(user, l.branch));
  }
  return store.leads.filter((l) => l.assigned_to === user.id);
}

// ============================================================================
// 1. AUTHENTICATION & QUICK ROLE SWITCHER
// ============================================================================
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || typeof password !== "string") {
    return res.status(401).json({ detail: "Email atau kata sandi tidak valid." });
  }
  const store = getStore();
  const user = store.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || user.active === false) {
    return res.status(401).json({ detail: "Email atau kata sandi tidak valid." });
  }
  const hashed = hashPassword(password);
  if (user.password_hash !== hashed) {
    return res.status(401).json({ detail: "Email atau kata sandi tidak valid." });
  }
  const token = issueSession(res, user);
  addAuditLog(user, "login", "auth", `Login berhasil (${ROLE_LABEL[user.role]})`, req.ip);
  res.json({ user: sanitizeUser(user), access_token: token });
});

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
  if (user) addAuditLog(user, "logout", "auth", "Logout dari aplikasi", req.ip);
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

app.post("/api/auth/change-password", requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || typeof current_password !== "string") {
    return res.status(400).json({ detail: "Kata sandi saat ini wajib diisi." });
  }
  if (!new_password || typeof new_password !== "string" || String(new_password).length < 8) {
    return res.status(400).json({ detail: "Kata sandi baru minimal 8 karakter." });
  }
  const hashedCurrent = hashPassword(current_password);
  if (req.user.password_hash !== hashedCurrent) {
    return res.status(400).json({ detail: "Kata sandi saat ini tidak sesuai." });
  }
  withTransaction(() => {
    req.user.password_hash = hashPassword(new_password);
    addAuditLog(req.user, "change_password", "user", "Memperbarui kata sandi akun", req.ip);
  });
  res.json({ ok: true });
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

  if (req.user.role === "marketing") {
    const today_leads = visibleLeads.filter((l) => !l.follow_up_date || l.follow_up_date <= todayIso);
    const recent_activity = [];
    for (const l of visibleLeads) {
      for (const a of l.activities || []) {
        recent_activity.push({ ...a, lead_name: l.name });
      }
    }
    recent_activity.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return res.json({
      total_leads: visibleLeads.length,
      by_status,
      follow_up_today: today_leads.length,
      today_leads: today_leads.slice(0, 8),
      recent_activity: recent_activity.slice(0, 8),
      growth
    });
  }

  const marketers = store.users.filter(
    (u) => u.role === "marketing" && (req.user.role === "super_admin" || req.user.role === "admin_ops" || u.branch === req.user.branch)
  );
  const marketing_stats = marketers.map((m) => {
    const mLeads = store.leads.filter((l) => l.assigned_to === m.id);
    const berhasil = mLeads.filter((l) => l.status === "berhasil").length;
    const aktivitas_7h = mLeads.reduce((acc, l) => acc + (l.activities?.length || 0), 0);
    return {
      id: m.id,
      name: m.name,
      branch: m.branch,
      assigned: mLeads.length,
      berhasil,
      aktivitas_7h
    };
  });

  const visibleSimulations = store.simulations.filter((s) => canAccessSimulation(req.user, s, store));
  res.json({
    total_leads: visibleLeads.length,
    unassigned: visibleLeads.filter((l) => !l.assigned_to).length,
    by_status,
    total_simulations: visibleSimulations.length,
    growth,
    marketing_stats,
    recent_imports: store.imports.slice(0, 5),
    recent_activity: store.audit_logs.slice(0, 8)
  });
});

// ============================================================================
// 3. BANKS & DYNAMIC PARTNER PARAMETERS (EDITABLE BY ROLE)
// ============================================================================
app.get("/api/banks", requireAuth, (req, res) => {
  const store = getStore();
  const p = store.partner_parameters;
  const order = ["ams2", "bsi_prapen", "bank_capital", "bank_mestika", "bank_mantap", "bank_mnc", "bank_bni"];
  const banks = order
    .filter((key) => canAccessBank(req.user, key))
    .map((key) => {
      const item = p[key];
      return {
        key,
        name: item?.shortName || item?.name || key,
        full_name: item?.name || key,
        engine: item?.engine || "partner_bank",
        supported: item?.active !== false,
        description: item?.description || ""
      };
    });
  res.json({ banks });
});

app.get("/api/calc/params", requireAuth, (req, res) => {
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

app.put("/api/calc/params/:partnerKey", requireAuth, requireRoles("super_admin", "admin_ops"), (req, res) => {
  const { partnerKey } = req.params;
  const { updates, reason } = req.body || {};
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

  // Super Admin direct update
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

  withTransaction(() => {
    prop.status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    prop.decided_by = req.user.name;
    prop.decided_at = new Date().toISOString();

    if (decision === "APPROVE" && store.partner_parameters[prop.partner_key]) {
      Object.assign(store.partner_parameters[prop.partner_key], prop.changes);
      store.partner_parameters.lastUpdated = new Date().toISOString();
      store.partner_parameters.updatedBy = `${req.user.name} (Super Admin)`;
    }
    addAuditLog(req.user, `proposal_${prop.status.toLowerCase()}`, prop.partner_key, `${prop.status} usulan parameter ${prop.partner_name}`, req.ip);
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
  "blokir_count",
  "blokir_1_override",
  "blokir_2_override",
  "blokir_3_override"
];

app.post("/api/calc/max", requireAuth, (req, res) => {
  const body = req.body || {};
  if (!canAccessBank(req.user, body.bank_key || "ams2")) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada mitra bank yang dipilih." });
  }
  const err = validateNonNegativeFields(body, CALC_NON_NEGATIVE_FIELDS);
  if (err) return res.status(400).json({ detail: err });
  const store = getStore();
  const result = calculateMax(body, store.partner_parameters);
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
  if (body.lead_id) {
    const linkedLead = store.leads.find((l) => l.id === body.lead_id);
    if (!linkedLead) {
      return res.status(404).json({ detail: "Lead terkait tidak ditemukan." });
    }
    if (!canAccessLead(req.user, linkedLead)) {
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

  const sim = withTransaction(() => {
    const seq = String(store.simulations.length + 1).padStart(4, "0");
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const createdSim = {
      id: `sim-${Date.now()}`,
      sim_no: `SIM-${ym}-${seq}`,
      lead_id: body.lead_id || null,
      bank_key: bankKey,
      dapem: body.dapem || "TASPEN",
      input: body,
      result,
      status: "saved",
      created_by: req.user.id,
      created_by_name: req.user.name,
      branch: req.user.branch || "BANDUNG",
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
        branch: sim.branch || req.user.branch || "BANDUNG",
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

    const createdApp = {
      id: `app-${Date.now()}`,
      app_no: `APP-${ym}-${seq}`,
      sim_id: sim.id,
      lead_id: lead.id,
      lead_name: lead.name,
      marketing_id: sim.created_by || req.user.id,
      marketing_name: sim.created_by_name || req.user.name,
      branch: sim.branch || req.user.branch || lead.branch || "BANDUNG",
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
    .filter((u) => u.role === "marketing" && u.active !== false && canAccessBranch(req.user, u.branch))
    .map((u) => ({ id: u.id, name: u.name, branch: u.branch }));
  res.json({ branches, marketers });
});

app.get("/api/leads", requireAuth, (req, res) => {
  const store = getStore();
  let list = scopeLeads(store, req.user);
  const { q, status, branch, assigned, follow_up } = req.query;
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

  const targetBranch = body.branch || req.user.branch || "BANDUNG";
  if (!canAccessBranch(req.user, targetBranch)) {
    return res.status(403).json({ detail: "Anda tidak dapat membuat lead untuk cabang lain." });
  }

  const marketer = body.assigned_to ? store.users.find((u) => u.id === body.assigned_to) : null;
  if (marketer && !canAccessBranch(req.user, marketer.branch)) {
    return res.status(403).json({ detail: "Marketing yang dipilih berada di luar cakupan cabang Anda." });
  }

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
  const { lead_ids = [], user_id } = req.body || {};
  if (!Array.isArray(lead_ids)) {
    return res.status(400).json({ detail: "Daftar lead_ids tidak valid." });
  }
  const store = getStore();
  const marketer = user_id ? store.users.find((u) => u.id === user_id) : null;
  if (user_id && !marketer) {
    return res.status(404).json({ detail: "Marketing tujuan tidak ditemukan." });
  }
  if (marketer && !canAccessBranch(req.user, marketer.branch)) {
    return res.status(403).json({ detail: "Anda tidak dapat menugaskan lead ke marketing cabang lain." });
  }

  for (const id of lead_ids) {
    const lead = store.leads.find((l) => l.id === id);
    if (lead && !canAccessLead(req.user, lead)) {
      return res.status(403).json({ detail: `Anda tidak memiliki akses pada lead '${lead.name}'.` });
    }
  }

  const count = withTransaction(() => {
    let updatedCount = 0;
    for (const id of lead_ids) {
      const lead = store.leads.find((l) => l.id === id);
      if (lead) {
        lead.assigned_to = marketer ? marketer.id : null;
        lead.assigned_name = marketer ? marketer.name : null;
        lead.updated_at = new Date().toISOString();
        updatedCount++;
      }
    }
    addAuditLog(req.user, "assign_leads", "leads", `Menugaskan ${updatedCount} leads ke ${marketer ? marketer.name : "Unassigned"}`, req.ip);
    return updatedCount;
  });
  res.json({ updated: count });
});

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
  if (body.branch !== undefined && !canAccessBranch(req.user, body.branch)) {
    return res.status(403).json({ detail: "Anda tidak dapat memindahkan lead ke cabang lain." });
  }

  withTransaction(() => {
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        if (key === "pension_salary") {
          lead.pension_salary = Number(body.pension_salary);
        } else if (key === "assigned_to") {
          const m = body.assigned_to ? store.users.find((u) => u.id === body.assigned_to) : null;
          lead.assigned_to = m ? m.id : null;
          lead.assigned_name = m ? m.name : null;
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
  const docMeta = withTransaction(() => {
    const docId = `ldoc-${Date.now()}`;
    saveUploadedFile(docId, req.file.originalname, req.file.mimetype || "application/pdf", req.file.buffer);
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
  res.setHeader("Content-Type", file.mime_type);
  res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
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
  res.json(store.imports);
});

app.get("/api/imports/template", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const csv = "Nama,Telepon,Kota,Cabang,Sumber,NOPEN,NIP,Gaji Pensiun,Tanggal Lahir\nH. AHMAD SUBAGJA,081234567890,Kota Bandung,BANDUNG,Data Taspen,195201011977031001,195201011977031001,4650000,1952-01-01\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="template_impor_leads.csv"');
  res.send(csv);
});

app.post("/api/imports", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch"), upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "Pilih file terlebih dahulu" });
  const store = getStore();
  const text = req.file.buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const dataLines = lines.slice(1);

  const batch = withTransaction(() => {
    let inserted = 0;
    let skipped_duplicates = 0;
    const errors = [];

    for (let i = 0; i < dataLines.length; i++) {
      const cols = dataLines[i].split(",").map((c) => c.trim());
      const [name, phone, city, branch, source, nopen, nip, salary, birth] = cols;
      if (!name || !phone) {
        errors.push(`Baris ${i + 2}: Nama & Telepon wajib diisi`);
        continue;
      }
      const parsedSalary = salary ? Number(salary) : 4500000;
      if (!Number.isFinite(parsedSalary) || parsedSalary < 0) {
        errors.push(`Baris ${i + 2}: Gaji Pensiun tidak valid`);
        continue;
      }
      const targetBranch = isGlobalBranchScope(req.user)
        ? (branch || req.user.branch || "BANDUNG")
        : (req.user.branch || "BANDUNG");

      if (store.leads.some((l) => l.phone === phone)) {
        skipped_duplicates++;
        continue;
      }
      store.leads.unshift({
        id: `lead-${Date.now()}-${i}`,
        name,
        phone,
        city: city || "Kota Bandung",
        branch: targetBranch,
        source: source || "Impor CSV",
        nopen: nopen || "",
        nip: nip || nopen || "",
        pension_salary: parsedSalary,
        birth_date: birth || "1954-05-10",
        status: "baru",
        follow_up_date: new Date().toISOString().slice(0, 10),
        assigned_to: null,
        assigned_name: null,
        notes: "",
        activities: [],
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
      total_rows: dataLines.length,
      inserted,
      skipped_duplicates,
      error_count: errors.length,
      errors,
      created_at: new Date().toISOString()
    };
    store.imports.unshift(createdBatch);
    addAuditLog(req.user, "import_leads", createdBatch.filename, `Impor ${inserted} leads baru dari ${createdBatch.filename}`, req.ip);
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

  const { q, stage, branch, date_from, date_to } = req.query;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Number(req.query.page_size || 10));

  if (q) {
    const sq = String(q).toLowerCase();
    list = list.filter((a) =>
      a.app_no.toLowerCase().includes(sq) ||
      a.lead_name.toLowerCase().includes(sq) ||
      a.marketing_name.toLowerCase().includes(sq)
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
  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  res.json({ items, total, page, page_size: pageSize, branches: visibleBranches });
});

app.get("/api/applications/:id", requireAuth, (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  if (!canAccessApplication(req.user, appItem)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada pengajuan ini." });
  }
  res.json(appItem);
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
  if (!req.file) return res.status(400).json({ detail: "Pilih file PDF" });

  withTransaction(() => {
    const fileId = `appdoc-${appItem.id}-${doc.key}`;
    saveUploadedFile(fileId, req.file.originalname, "application/pdf", req.file.buffer);
    doc.status = "diunggah";
    doc.filename = req.file.originalname;
    doc.uploaded_at = new Date().toISOString();
    doc.versions = (doc.versions || 0) + 1;
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
  const fileId = `appdoc-${appItem.id}-${req.params.key}`;
  const stored = getUploadedFile(fileId);
  if (stored) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${stored.filename}"`);
    return res.send(Buffer.from(stored.data));
  }
  // Fallback generated PDF for pre-seeded demo documents
  const sim = store.simulations.find((s) => s.id === appItem.sim_id) || store.simulations[0];
  const pdfBuf = generateSimulationPdfBuffer(sim);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${req.params.key}.pdf"`);
  res.send(pdfBuf);
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

  const { status, note } = req.body || {};
  if (!["lengkap", "ditolak", "diunggah"].includes(status)) {
    return res.status(400).json({ detail: "Status verifikasi dokumen tidak valid." });
  }
  if (status === "ditolak" && !String(note || "").trim()) {
    return res.status(400).json({ detail: "Catatan alasan penolakan/revisi dokumen wajib diisi." });
  }

  withTransaction(() => {
    doc.status = status;
    doc.note = note || "";
    if (status === "ditolak") {
      appItem.pending = { party: "marketing", type: "revisi", note: `Revisi dokumen ${doc.label}: ${note}` };
    }
    appItem.history.push({
      id: `h-${Date.now()}`,
      action: `review_${status}`,
      note: `${doc.label}: ${status}${note ? ` (${note})` : ""}`,
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
  const items = list.slice((page - 1) * pageSize, page * pageSize);
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

  const claim = withTransaction(() => {
    const seq = String(store.claims.length + 1).padStart(4, "0");
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const claimId = `clm-${Date.now()}`;
    if (req.file) {
      saveUploadedFile(`${claimId}-booking`, req.file.originalname, req.file.mimetype || "application/pdf", req.file.buffer);
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
      branch: appItem.branch,
      booking_date: appItem.booking?.date || new Date().toISOString().slice(0, 10),
      credit_no: req.body?.credit_no || appItem.booking?.credit_no || "",
      amount: claimAmount,
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
  res.json(claim);
});

app.post("/api/claims/:id/action", requireAuth, (req, res) => {
  const store = getStore();
  const claim = store.claims.find((c) => c.id === req.params.id);
  if (!claim) return res.status(404).json({ detail: "Klaim tidak ditemukan" });
  if (!canAccessClaim(req.user, claim)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses pada klaim ini." });
  }
  if (claim.status === "PAID") {
    return res.status(400).json({ detail: "Klaim yang sudah dibayar (PAID) bersifat final dan tidak dapat diubah." });
  }

  const { action, note, amount } = req.body || {};
  const map = { submit: "SUBMITTED", review: "REVIEW", revision: "REVISION", approve: "APPROVED", reject: "REJECTED" };
  const nextStatus = map[action];
  if (!nextStatus) {
    return res.status(400).json({ detail: "Aksi klaim tidak valid." });
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

  if (action === "submit") {
    if (!["marketing", "admin_ops", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Peran Anda tidak berwenang mengajukan klaim." });
    }
    if (!["DRAFT", "REVISION"].includes(claim.status)) {
      return res.status(409).json({ detail: `Klaim berstatus ${claim.status} tidak dapat diajukan ulang.` });
    }
  } else {
    // review, revision, approve, reject are restricted to super_admin and admin_ops
    if (!["super_admin", "admin_ops"].includes(req.user.role)) {
      return res.status(403).json({ detail: "Hanya Admin Operasional atau Super Admin yang berwenang memverifikasi/menyetujui klaim." });
    }
    if (action === "approve") {
      if (claim.status === "APPROVED") {
        return res.status(409).json({ detail: "Klaim ini sudah disetujui sebelumnya." });
      }
      if (!["SUBMITTED", "REVIEW"].includes(claim.status)) {
        return res.status(400).json({ detail: "Klaim harus berstatus SUBMITTED atau REVIEW sebelum disetujui (APPROVED)." });
      }
    }
    if ((action === "revision" || action === "reject") && !String(note || "").trim()) {
      return res.status(400).json({ detail: "Catatan alasan revisi atau penolakan klaim wajib diisi." });
    }
  }

  withTransaction(() => {
    claim.status = nextStatus;
    if (parsedAmount !== null) claim.amount = Math.round(parsedAmount);
    if (action === "revision") claim.revision_note = note;
    if (action === "reject") claim.reject_reason = note;
    claim.history.push({
      id: `ch-${Date.now()}`,
      action: claim.status,
      note: note || "",
      user_name: req.user.name,
      at: new Date().toISOString()
    });
    addAuditLog(req.user, `claim_${action}`, claim.claim_no, `Aksi ${action} (${claim.status}) pada klaim ${claim.claim_no}`, req.ip);
  });
  res.json(claim);
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
  if (!req.file && !claim.payment_proof) {
    return res.status(400).json({ detail: "Bukti transfer/pembayaran wajib diunggah untuk menyelesaikan pembayaran klaim." });
  }

  let parsedAmount = null;
  if (req.body?.amount !== undefined && req.body?.amount !== null && String(req.body.amount).trim() !== "") {
    parsedAmount = Number(req.body.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ detail: "Nominal pembayaran klaim tidak valid atau bernilai negatif/nol." });
    }
  }

  withTransaction(() => {
    if (req.file) {
      saveUploadedFile(`${claim.id}-payment`, req.file.originalname, req.file.mimetype || "application/pdf", req.file.buffer);
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
  res.json(claim);
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
  withTransaction(() => {
    saveUploadedFile(`${claim.id}-booking`, req.file.originalname, req.file.mimetype || "application/pdf", req.file.buffer);
    claim.booking_proof = req.file.originalname;
  });
  res.json(claim);
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
    return res.send(Buffer.from(stored.data));
  }
  const pdfBuf = generateSimulationPdfBuffer(store.simulations[0]);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="bukti_${fileType}.pdf"`);
  res.send(pdfBuf);
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
  const list = users.map((u) => ({
    ...sanitizeUser(u),
    lead_count: store.leads.filter((l) => l.assigned_to === u.id).length
  }));
  res.json(list);
});

app.post("/api/users", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const store = getStore();
  const body = req.body || {};
  const targetRole = body.role || "marketing";
  if (!ROLE_LABEL[targetRole]) {
    return res.status(400).json({ detail: "Peran pengguna tidak valid." });
  }
  if (req.user.role === "admin_ops" && !["admin_branch", "sales_manager", "marketing"].includes(targetRole)) {
    return res.status(403).json({ detail: "Admin Operasional hanya dapat membuat akun Admin Cabang/Mitra, Sales Manager, atau Marketing." });
  }
  if ((req.user.role === "admin_branch" || req.user.role === "sales_manager") && targetRole !== "marketing") {
    return res.status(403).json({ detail: `${ROLE_LABEL[req.user.role]} hanya dapat membuat akun Marketing.` });
  }
  if (!body.email || !body.name) {
    return res.status(400).json({ detail: "Nama dan email wajib diisi." });
  }
  if (body.password !== undefined && String(body.password).length < 8) {
    return res.status(400).json({ detail: "Kata sandi minimal 8 karakter." });
  }
  const targetBranch = isGlobalBranchScope(req.user)
    ? (body.branch || req.user.branch || "BANDUNG")
    : (req.user.branch || "BANDUNG");
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

  const newUser = withTransaction(() => {
    const createdUser = {
      id: `u-${Date.now()}`,
      name: String(body.name).trim(),
      email: String(body.email).trim().toLowerCase(),
      password_hash: hashPassword(body.password || "Password123!"),
      role: targetRole,
      branch: targetBranch,
      bank_scope: bankScope,
      phone: String(body.phone || "").trim(),
      active: true,
      created_at: new Date().toISOString()
    };
    store.users.push(createdUser);
    addAuditLog(req.user, "create_user", createdUser.email, `Membuat akun ${createdUser.name} (${ROLE_LABEL[createdUser.role]})`, req.ip);
    return createdUser;
  });
  res.json(sanitizeUser(newUser));
});

app.patch("/api/users/:id", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const store = getStore();
  const target = store.users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });
  if (!canAccessBranch(req.user, target.branch)) {
    return res.status(403).json({ detail: "Anda tidak memiliki akses untuk mengubah pengguna cabang lain." });
  }
  if (req.user.role === "admin_ops" && !["admin_branch", "sales_manager", "marketing"].includes(target.role)) {
    return res.status(403).json({ detail: "Admin Operasional hanya dapat mengubah akun Admin Cabang/Mitra, Sales Manager, atau Marketing." });
  }
  if ((req.user.role === "admin_branch" || req.user.role === "sales_manager") && target.role !== "marketing") {
    return res.status(403).json({ detail: `${ROLE_LABEL[req.user.role]} hanya dapat mengubah akun Marketing.` });
  }

  const { name, role, branch, bank_scope, phone, active, password } = req.body || {};
  if (password !== undefined && password !== "" && String(password).length < 8) {
    return res.status(400).json({ detail: "Kata sandi baru minimal 8 karakter." });
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
  if (branch !== undefined && !canAccessBranch(req.user, branch)) {
    return res.status(403).json({ detail: "Anda tidak dapat memindahkan pengguna ke cabang lain." });
  }

  withTransaction(() => {
    if (name !== undefined) target.name = String(name).trim();
    if (role !== undefined) target.role = role;
    if (branch !== undefined && isGlobalBranchScope(req.user)) target.branch = String(branch).trim();
    if (bank_scope !== undefined && ["super_admin", "admin_ops"].includes(req.user.role)) {
      target.bank_scope = bank_scope === "bsi_only" ? "bsi_only" : "all_bank";
    }
    if (phone !== undefined) target.phone = String(phone).trim();
    if (active !== undefined) target.active = Boolean(active);
    if (password) target.password_hash = hashPassword(password);
    addAuditLog(req.user, "update_user", target.email, `Memperbarui profil pengguna ${target.name}`, req.ip);
  });
  res.json(sanitizeUser(target));
});

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
  addAuditLog(req.user, "download_backup", "database", "Mengunduh salinan backup JSON database", req.ip);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="layanan_pensiunan_backup.json"');
  res.send(JSON.stringify(store, null, 2));
});

app.post("/api/backup/restore", requireAuth, requireRoles("super_admin"), upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "Pilih file JSON backup" });
  let incoming;
  try {
    incoming = JSON.parse(req.file.buffer.toString("utf8"));
  } catch {
    return res.status(400).json({ detail: "Format file JSON backup tidak valid." });
  }
  const store = getStore();
  const restored = withTransaction(() => {
    const counts = { leads: 0, simulations: 0, applications: 0 };
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
    addAuditLog(req.user, "restore_backup", "database", `Memulihkan database (${counts.leads} leads)`, req.ip);
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

app.listen(PORT, () => {
  console.log(`[Layanan Pensiunan Enterprise API] Running on http://localhost:${PORT}`);
});
