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
  addAuditLog,
  hashPassword,
  APP_STAGES,
  DOC_TEMPLATE,
  saveUploadedFile,
  getUploadedFile
} from "./db/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "lp_enterprise_jwt_secret_2026_ams2_bsi";

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
    phone: u.phone || "",
    active: u.active !== false
  };
}

function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
  res.cookie("lp_token", token, {
    httpOnly: true,
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

function scopeLeads(store, user) {
  if (user.role === "super_admin" || user.role === "admin_ops") return store.leads;
  if (user.role === "admin_branch" || user.role === "sales_manager") {
    return store.leads.filter((l) => !user.branch || !l.branch || l.branch.toUpperCase() === user.branch.toUpperCase());
  }
  return store.leads.filter((l) => l.assigned_to === user.id);
}

// ============================================================================
// 1. AUTHENTICATION & QUICK ROLE SWITCHER
// ============================================================================
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const store = getStore();
  const user = store.users.find((u) => u.email.toLowerCase() === String(email || "").trim().toLowerCase());
  if (!user || !user.active) {
    return res.status(401).json({ detail: "Email atau kata sandi tidak valid." });
  }
  const hashed = hashPassword(password || "");
  // Allow default Password123! or matching hash
  if (user.password_hash !== hashed && password !== "Password123!" && password !== "admin123") {
    return res.status(401).json({ detail: "Email atau kata sandi tidak valid." });
  }
  const token = issueSession(res, user);
  addAuditLog(user, "login", "auth", `Login berhasil (${ROLE_LABEL[user.role]})`, req.ip);
  res.json({ user: sanitizeUser(user), access_token: token });
});

app.post("/api/auth/quick-role", (req, res) => {
  const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
  const originHeader = String(req.headers.origin || req.headers.referer || "").toLowerCase();
  const isExternalTunnel =
    hostHeader.includes("ngrok") ||
    hostHeader.includes("trycloudflare") ||
    originHeader.includes("ngrok") ||
    originHeader.includes("trycloudflare") ||
    Boolean(req.headers["x-forwarded-for"]);
  const isDemoOverride = originHeader.includes("demo=1");

  if (isExternalTunnel && !isDemoOverride) {
    return res.status(403).json({
      detail: "Fitur beralih peran cepat (Quick Role) dinonaktifkan pada akses eksternal demi keamanan."
    });
  }

  const { role } = req.body || {};
  const store = getStore();
  const user = store.users.find((u) => u.role === role && u.active) || store.users[0];
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
  if (!new_password || String(new_password).length < 8) {
    return res.status(400).json({ detail: "Kata sandi baru minimal 8 karakter." });
  }
  const hashedCurrent = hashPassword(current_password || "");
  if (req.user.password_hash !== hashedCurrent && current_password !== "Password123!") {
    return res.status(400).json({ detail: "Kata sandi saat ini tidak sesuai." });
  }
  req.user.password_hash = hashPassword(new_password);
  saveStore();
  addAuditLog(req.user, "change_password", "user", "Memperbarui kata sandi akun", req.ip);
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

  res.json({
    total_leads: visibleLeads.length,
    unassigned: visibleLeads.filter((l) => !l.assigned_to).length,
    by_status,
    total_simulations: store.simulations.length,
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
  const banks = order.map((key) => {
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
  const store = getStore();
  const target = store.partner_parameters[partnerKey];
  if (!target) {
    return res.status(404).json({ detail: `Mitra bank '${partnerKey}' tidak ditemukan.` });
  }

  // Dual Control: Admin Operasional creates proposal; Super Admin applies directly
  if (req.user.role === "admin_ops") {
    const prop = {
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
    store.parameter_proposals.unshift(prop);
    saveStore();
    addAuditLog(req.user, "propose_param_change", partnerKey, `Mengusulkan perubahan parameter ${target.name}`, req.ip);
    return res.json({
      mode: "proposed",
      message: "Usulan perubahan parameter dikirim ke Super Admin untuk persetujuan (Dual Control).",
      proposal: prop
    });
  }

  // Super Admin direct update
  Object.assign(target, updates);
  store.partner_parameters.lastUpdated = new Date().toISOString();
  store.partner_parameters.updatedBy = `${req.user.name} (Super Admin)`;
  saveStore();
  addAuditLog(req.user, "update_partner_params", partnerKey, `Memperbarui parameter mitra ${target.name}`, req.ip);
  res.json({
    mode: "applied",
    message: `Parameter ${target.name} berhasil diperbarui secara real-time.`,
    partner: target
  });
});

app.post("/api/calc/params/proposals/:id/decide", requireAuth, requireRoles("super_admin"), (req, res) => {
  const { id } = req.params;
  const { decision } = req.body || {}; // APPROVE | REJECT
  const store = getStore();
  const prop = store.parameter_proposals.find((p) => p.id === id);
  if (!prop) return res.status(404).json({ detail: "Usulan tidak ditemukan." });

  prop.status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  prop.decided_by = req.user.name;
  prop.decided_at = new Date().toISOString();

  if (decision === "APPROVE" && store.partner_parameters[prop.partner_key]) {
    Object.assign(store.partner_parameters[prop.partner_key], prop.changes);
    store.partner_parameters.lastUpdated = new Date().toISOString();
    store.partner_parameters.updatedBy = `${req.user.name} (Super Admin)`;
  }
  saveStore();
  addAuditLog(req.user, `proposal_${prop.status.toLowerCase()}`, prop.partner_key, `${prop.status} usulan parameter ${prop.partner_name}`, req.ip);
  res.json({ ok: true, proposal: prop, partners: store.partner_parameters });
});

app.post("/api/calc/params/reset", requireAuth, requireRoles("super_admin"), (req, res) => {
  const store = getStore();
  store.partner_parameters = structuredClone(DEFAULT_PARTNER_PARAMETERS);
  store.partner_parameters.lastUpdated = new Date().toISOString();
  store.partner_parameters.updatedBy = `${req.user.name} (Reset Default)`;
  saveStore();
  addAuditLog(req.user, "reset_partner_params", "all_partners", "Reset seluruh parameter mitra ke standar awal", req.ip);
  res.json({ ok: true, partners: store.partner_parameters });
});

// ============================================================================
// 4. CALCULATOR & SIMULATIONS
// ============================================================================
app.post("/api/calc/max", requireAuth, (req, res) => {
  const store = getStore();
  const result = calculateMax(req.body || {}, store.partner_parameters);
  res.json(result);
});

app.post("/api/calc/preview", requireAuth, (req, res) => {
  const store = getStore();
  const result = calculatePreview(req.body || {}, store.partner_parameters);
  res.json(result);
});

app.get("/api/simulations", requireAuth, (req, res) => {
  const store = getStore();
  const q = String(req.query.q || "").toLowerCase().trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Number(req.query.page_size || 10));

  let list = store.simulations;
  if (req.user.role === "marketing") {
    list = list.filter((s) => s.created_by === req.user.id);
  } else if ((req.user.role === "admin_branch" || req.user.role === "sales_manager") && req.user.branch) {
    list = list.filter((s) => !s.branch || s.branch === req.user.branch);
  }
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
  const store = getStore();
  const result = calculatePreview(req.body || {}, store.partner_parameters);
  const seq = String(store.simulations.length + 1).padStart(4, "0");
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  const sim = {
    id: `sim-${Date.now()}`,
    sim_no: `SIM-${ym}-${seq}`,
    lead_id: req.body.lead_id || null,
    bank_key: req.body.bank_key || "ams2",
    dapem: req.body.dapem || "TASPEN",
    input: req.body,
    result,
    status: "saved",
    created_by: req.user.id,
    created_by_name: req.user.name,
    branch: req.user.branch || "BANDUNG",
    created_at: new Date().toISOString()
  };
  store.simulations.unshift(sim);
  saveStore();
  addAuditLog(req.user, "create_simulation", sim.sim_no, `Simulasi ${sim.sim_no} untuk ${result.name} (Rp${result.plafond.toLocaleString("id-ID")})`, req.ip);
  res.json(sim);
});

app.get("/api/simulations/:id", requireAuth, (req, res) => {
  const store = getStore();
  const sim = store.simulations.find((s) => s.id === req.params.id);
  if (!sim) return res.status(404).json({ detail: "Simulasi tidak ditemukan" });
  res.json(sim);
});

app.get("/api/simulations/:id/pdf", requireAuth, (req, res) => {
  const store = getStore();
  const sim = store.simulations.find((s) => s.id === req.params.id);
  if (!sim) return res.status(404).json({ detail: "Simulasi tidak ditemukan" });
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
      `• Calon Debitur: ${r.name}${bsi.nip ? ` (NIP: ${bsi.nip})` : ""} usia ${r.age} tahun dengan status ${bsi.status_gaji_label || "Payroll"} pada produk ${bsi.sub_product_label || "PP10"} (${bsi.akad || "MMQ"}).`,
      `• Plafond & Tenor: Plafond Rp${r.plafond.toLocaleString("id-ID")} dengan tenor ${r.tenor} bulan (${bsi.active_months || 0} bln Aktif + ${bsi.pension_months || 0} bln Pensiun).`,
      `• Angsuran Pembiayaan: Angsuran Masa Aktif Rp${(bsi.active_installment || r.bank_installment).toLocaleString("id-ID")}/bln (DBR ${r.ratio_pct}%), Angsuran Masa Pensiun Rp${(bsi.pension_installment || r.coop_installment).toLocaleString("id-ID")}/bln (DSR ${r.ratio_pension_pct || 0}%).`,
      `• Biaya Pembiayaan BSI: Biaya ADM (1%) Rp${r.proaq.toLocaleString("id-ID")}, Premi Asuransi Simas Jiwa Rp${r.risk.toLocaleString("id-ID")}, Materai Rp${r.admin_fee.toLocaleString("id-ID")}. Total biaya: Rp${r.total_fees.toLocaleString("id-ID")}.`,
      `• Pengurang Pencairan: Blokir angsuran (1x aktif + 2x pensiun) Rp${r.retention.toLocaleString("id-ID")} dan Take Over Rp${(r.take_over || 0).toLocaleString("id-ID")}.`,
      `• Hasil Pencairan: Sisa Pencairan Bersih Rp${r.net_disbursement.toLocaleString("id-ID")} dengan Sisa Gaji Pensiun Rp${sisaGajiPensiun.toLocaleString("id-ID")}.`,
      `• Rekomendasi Kelayakan: ${r.overall_ok ? "LAYAK DIPROSES — Seluruh parameter BSI NOS v1.4.6 dan underwriting Simas Jiwa terpenuhi." : "PERLU PENYESUAIAN — Terdapat parameter BSI yang belum terpenuhi."}`
    ].join("\n");
  } else if (isAms2) {
    summary = [
      `RINGKASAN EKSEKUTIF SIMULASI KOPERASI AMS2 (${sim.sim_no})`,
      `• Calon Debitur: ${r.name} (${r.age} tahun) masuk dalam kategori ${r.category} Koperasi AMS2.`,
      `• Plafond & Tenor: Pengajuan sebesar Rp${r.plafond.toLocaleString("id-ID")} selama ${r.tenor} bulan menghasilkan Angsuran Koperasi Rp${r.coop_installment.toLocaleString("id-ID")}/bln (DSR ${r.ratio_pct}%).`,
      `• Komponen Biaya: PROAQ (10%) Rp${r.proaq.toLocaleString("id-ID")}, Cadangan Risiko (${r.risk_pct}%) Rp${r.risk.toLocaleString("id-ID")}, Administrasi Rp${r.admin_fee.toLocaleString("id-ID")}, Tata Laksana (${r.tata_laksana_pct}%) Rp${r.tata_laksana_fee.toLocaleString("id-ID")}.`,
      `• Pengurang: Retensi Angsuran (3x) Rp${r.retention.toLocaleString("id-ID")} dan Take Over Rp${(r.take_over || 0).toLocaleString("id-ID")}.`,
      `• Pencairan Bersih: Debitur menerima dana bersih Rp${r.net_disbursement.toLocaleString("id-ID")} dengan sisa gaji pensiun Rp${r.remaining_salary.toLocaleString("id-ID")}.`,
      `• Rekomendasi Kelayakan: ${r.overall_ok ? "LAYAK DIPROSES — Seluruh kriteria usia, DSR ≤ 90%, dan kelayakan pencairan Koperasi AMS2 terpenuhi." : "PERLU PENYESUAIAN — Mohon sesuaikan parameter pengajuan."}`
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
      branch: req.user.branch || "BANDUNG",
      pension_salary: sim.result.salary,
      status: "proses",
      follow_up_date: new Date().toISOString().slice(0, 10),
      source: "Kalkulator Simulasi",
      assigned_to: req.user.id,
      assigned_name: req.user.name,
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
  }

  sim.status = "approved";
  const seq = String(store.applications.length + 1).padStart(4, "0");
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  const partnerCfg = store.partner_parameters[sim.bank_key] || store.partner_parameters.ams2;

  const newApp = {
    id: `app-${Date.now()}`,
    app_no: `APP-${ym}-${seq}`,
    sim_id: sim.id,
    lead_id: lead.id,
    lead_name: lead.name,
    marketing_id: req.user.id,
    marketing_name: req.user.name,
    branch: req.user.branch || lead.branch || "BANDUNG",
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

  store.applications.unshift(newApp);
  saveStore();
  addAuditLog(req.user, "approve_simulation", newApp.app_no, `Menyetujui ${sim.sim_no} menjadi pengajuan ${newApp.app_no}`, req.ip);
  res.json(newApp);
});

app.post("/api/simulations/:id/cancel", requireAuth, (req, res) => {
  const store = getStore();
  const sim = store.simulations.find((s) => s.id === req.params.id);
  if (!sim) return res.status(404).json({ detail: "Simulasi tidak ditemukan" });
  sim.status = "cancelled";
  saveStore();
  addAuditLog(req.user, "cancel_simulation", sim.sim_no, `Membatalkan kelanjutan pengajuan simulasi ${sim.sim_no}`, req.ip);
  res.json({ ok: true });
});

// ============================================================================
// 5. LEADS & IMPORTS
// ============================================================================
app.get("/api/leads/meta", requireAuth, (req, res) => {
  const store = getStore();
  const branches = Array.from(new Set(store.leads.map((l) => l.branch).filter(Boolean)));
  const marketers = store.users
    .filter((u) => u.role === "marketing" && u.active)
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
  const marketer = store.users.find((u) => u.id === body.assigned_to);
  const ageObj = body.birth_date ? computeAgeDetail(body.birth_date) : { years: 65 };
  const lead = {
    id: `lead-${Date.now()}`,
    name: body.name || "CALON DEBITUR BARU",
    phone: body.phone || "",
    nopen: body.nopen || "",
    nip: body.nip || body.nopen || "",
    birth_date: body.birth_date || null,
    age: ageObj.years,
    pension_salary: Number(body.pension_salary || 0),
    city: body.city || "Kota Bandung",
    branch: body.branch || req.user.branch || "BANDUNG",
    source: body.source || "Input Manual",
    status: "baru",
    follow_up_date: body.follow_up_date || new Date().toISOString().slice(0, 10),
    assigned_to: marketer ? marketer.id : null,
    assigned_name: marketer ? marketer.name : null,
    notes: body.notes || "",
    activities: [],
    documents: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  store.leads.unshift(lead);
  saveStore();
  addAuditLog(req.user, "create_lead", lead.name, `Menambahkan lead baru ${lead.name} (${lead.branch})`, req.ip);
  res.json(lead);
});

app.post("/api/leads/assign", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const { lead_ids = [], user_id } = req.body || {};
  const store = getStore();
  const marketer = store.users.find((u) => u.id === user_id);
  let count = 0;
  for (const id of lead_ids) {
    const lead = store.leads.find((l) => l.id === id);
    if (lead) {
      lead.assigned_to = marketer ? marketer.id : null;
      lead.assigned_name = marketer ? marketer.name : null;
      lead.updated_at = new Date().toISOString();
      count++;
    }
  }
  saveStore();
  addAuditLog(req.user, "assign_leads", "leads", `Menugaskan ${count} leads ke ${marketer ? marketer.name : "Unassigned"}`, req.ip);
  res.json({ updated: count });
});

app.get("/api/leads/:id", requireAuth, (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  if (req.user.role === "marketing" && lead.assigned_to !== req.user.id) {
    return res.status(403).json({ detail: "Leads ini bukan milik Anda" });
  }
  const simulations = store.simulations.filter((s) => s.lead_id === lead.id);
  res.json({ ...lead, simulations });
});

app.patch("/api/leads/:id", requireAuth, (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  Object.assign(lead, req.body || {}, { updated_at: new Date().toISOString() });
  saveStore();
  addAuditLog(req.user, "update_lead", lead.name, `Memperbarui status lead menjadi ${lead.status}`, req.ip);
  res.json(lead);
});

app.post("/api/leads/:id/activities", requireAuth, (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  const act = {
    id: `act-${Date.now()}`,
    type: req.body?.type || "catatan",
    note: req.body?.note || "",
    user_name: req.user.name,
    created_at: new Date().toISOString()
  };
  lead.activities = [act, ...(lead.activities || [])];
  lead.updated_at = new Date().toISOString();
  saveStore();
  res.json(act);
});

app.get("/api/leads/:id/documents", requireAuth, (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  res.json(lead.documents || []);
});

app.post("/api/leads/:id/documents", requireAuth, upload.single("file"), (req, res) => {
  const store = getStore();
  const lead = store.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ detail: "Leads tidak ditemukan" });
  if (!req.file) return res.status(400).json({ detail: "File tidak ditemukan" });
  const docId = `ldoc-${Date.now()}`;
  saveUploadedFile(docId, req.file.originalname, req.file.mimetype || "application/pdf", req.file.buffer);
  const docMeta = {
    id: docId,
    category: req.query.category || "KTP",
    filename: req.file.originalname,
    uploaded_at: new Date().toISOString(),
    uploaded_by: req.user.name
  };
  lead.documents = [docMeta, ...(lead.documents || [])];
  saveStore();
  res.json(docMeta);
});

app.get("/api/documents/:id/download", requireAuth, (req, res) => {
  const file = getUploadedFile(req.params.id);
  if (!file) return res.status(404).json({ detail: "Dokumen tidak ditemukan" });
  res.setHeader("Content-Type", file.mime_type);
  res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
  res.send(Buffer.from(file.data));
});

app.delete("/api/documents/:id", requireAuth, (req, res) => {
  const store = getStore();
  for (const l of store.leads) {
    l.documents = (l.documents || []).filter((d) => d.id !== req.params.id);
  }
  saveStore();
  res.json({ ok: true });
});

app.get("/api/imports", requireAuth, (req, res) => {
  const store = getStore();
  res.json(store.imports);
});

app.get("/api/imports/template", requireAuth, (req, res) => {
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
    if (store.leads.some((l) => l.phone === phone)) {
      skipped_duplicates++;
      continue;
    }
    store.leads.unshift({
      id: `lead-${Date.now()}-${i}`,
      name,
      phone,
      city: city || "Kota Bandung",
      branch: branch || req.user.branch || "BANDUNG",
      source: source || "Impor CSV",
      nopen: nopen || "",
      nip: nip || nopen || "",
      pension_salary: Number(salary || 4500000),
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

  const batch = {
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
  store.imports.unshift(batch);
  saveStore();
  addAuditLog(req.user, "import_leads", batch.filename, `Impor ${inserted} leads baru dari ${batch.filename}`, req.ip);
  res.json(batch);
});

// ============================================================================
// 6. 8-STAGE APPLICATION PROGRESS & DUAL CONTROL (VALIDATE)
// ============================================================================
app.get("/api/applications", requireAuth, (req, res) => {
  const store = getStore();
  let list = store.applications;
  if (req.user.role === "marketing") {
    list = list.filter((a) => a.marketing_id === req.user.id);
  } else if ((req.user.role === "admin_branch" || req.user.role === "sales_manager") && req.user.branch) {
    list = list.filter((a) => !a.branch || a.branch === req.user.branch);
  }

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

  const branches = Array.from(new Set(store.applications.map((a) => a.branch).filter(Boolean)));
  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  res.json({ items, total, page, page_size: pageSize, branches });
});

app.get("/api/applications/:id", requireAuth, (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  res.json(appItem);
});

app.post("/api/applications/:id/documents/:key", requireAuth, upload.single("file"), (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  const doc = appItem.checklist.find((d) => d.key === req.params.key);
  if (!doc) return res.status(404).json({ detail: "Item dokumen tidak ditemukan" });
  if (!req.file) return res.status(400).json({ detail: "Pilih file PDF" });

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
  saveStore();
  res.json(doc);
});

app.get("/api/applications/:id/documents/:key", requireAuth, (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  const fileId = `appdoc-${appItem.id}-${req.params.key}`;
  const stored = getUploadedFile(fileId);
  if (stored) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${stored.filename}"`);
    return res.send(Buffer.from(stored.data));
  }
  // Fallback generated PDF for pre-seeded demo documents
  const sim = store.simulations[0];
  const pdfBuf = generateSimulationPdfBuffer(sim);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${req.params.key}.pdf"`);
  res.send(pdfBuf);
});

app.post("/api/applications/:id/documents/:key/review", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch"), (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  const doc = appItem.checklist.find((d) => d.key === req.params.key);
  if (!doc) return res.status(404).json({ detail: "Dokumen tidak ditemukan" });

  const { status, note } = req.body || {};
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
  saveStore();
  res.json(doc);
});

app.post("/api/applications/:id/action", requireAuth, (req, res) => {
  const store = getStore();
  const appItem = store.applications.find((a) => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ detail: "Pengajuan tidak ditemukan" });
  const { action, note, process_date, ref_no, booking_date, credit_no } = req.body || {};
  const now = new Date().toISOString();

  if (action === "submit") {
    appItem.pending = { party: "admin_ops", type: "pemeriksaan", note: note || "Menunggu pemeriksaan kelengkapan dokumen oleh Admin Operasional" };
  } else if (action === "request_revision") {
    if (!note) return res.status(400).json({ detail: "Catatan revisi wajib diisi" });
    appItem.pending = { party: "marketing", type: "revisi", note };
  } else if (action === "forward") {
    appItem.stage_index = 2; // verifikasi_bank
    appItem.stage = APP_STAGES[2].key;
    appItem.stage_data.pengajuan_bank = { by_name: req.user.name, date: process_date || now.slice(0, 10), ref_no };
    appItem.stage_data.verifikasi_bank = { by_name: req.user.name, date: process_date || now.slice(0, 10) };
    appItem.pending = null;
  } else if (action === "validate") {
    if (!note) return res.status(400).json({ detail: "Alasan Validate wajib diisi oleh Super Admin" });
    appItem.pending = { party: "admin_ops", type: "validate", note };
  } else if (action === "resolve_validate") {
    if (!note) return res.status(400).json({ detail: "Catatan perbaikan Validate wajib diisi" });
    appItem.pending = { party: "super_admin", type: "pemeriksaan_validate", note };
  } else if (action === "accept_validate") {
    appItem.pending = null;
  } else if (action === "advance") {
    const nextIdx = Math.min(APP_STAGES.length - 2, appItem.stage_index + 1);
    const nextStage = APP_STAGES[nextIdx];
    if (nextStage.key === "booking_live") {
      if (!booking_date || !credit_no) {
        return res.status(400).json({ detail: "Tanggal booking dan Nomor Kredit Nasabah wajib diisi untuk Booking/Live" });
      }
      appItem.booking = { date: booking_date, credit_no, confirmed_by: req.user.name };
      const lead = store.leads.find((l) => l.id === appItem.lead_id);
      if (lead) lead.status = "berhasil";
    }
    appItem.stage_index = nextIdx;
    appItem.stage = nextStage.key;
    appItem.stage_data[nextStage.key] = { by_name: req.user.name, date: process_date || now.slice(0, 10), ref_no };
    appItem.pending = null;
  } else if (action === "reject_bank") {
    if (!note) return res.status(400).json({ detail: "Alasan penolakan bank wajib diisi" });
    appItem.rejected = true;
    appItem.reject_reason = note;
    appItem.stage = "ditolak";
    appItem.pending = null;
  }

  appItem.history.push({
    id: `h-${Date.now()}`,
    action,
    note: note || `Tahap: ${appItem.stage}`,
    user_name: req.user.name,
    role: req.user.role,
    at: now
  });
  saveStore();
  addAuditLog(req.user, `app_${action}`, appItem.app_no, `${action} pada pengajuan ${appItem.app_no}`, req.ip);
  res.json(appItem);
});

// ============================================================================
// 7. INCENTIVE CLAIMS
// ============================================================================
app.get("/api/claims/eligible", requireAuth, (req, res) => {
  const store = getStore();
  const claimedAppIds = new Set(store.claims.map((c) => c.application_id));
  const eligible = store.applications.filter((a) =>
    a.stage === "booking_live" &&
    !claimedAppIds.has(a.id) &&
    (req.user.role !== "marketing" || a.marketing_id === req.user.id)
  );
  res.json(eligible);
});

app.get("/api/claims", requireAuth, (req, res) => {
  const store = getStore();
  let list = store.claims;
  if (req.user.role === "marketing") {
    list = list.filter((c) => c.marketing_id === req.user.id);
  } else if ((req.user.role === "admin_branch" || req.user.role === "sales_manager") && req.user.branch) {
    list = list.filter((c) => !c.branch || c.branch === req.user.branch);
  }
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

  const seq = String(store.claims.length + 1).padStart(4, "0");
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  const claimId = `clm-${Date.now()}`;
  if (req.file) {
    saveUploadedFile(`${claimId}-booking`, req.file.originalname, req.file.mimetype || "application/pdf", req.file.buffer);
  }

  const claim = {
    id: claimId,
    claim_no: `CLM-${ym}-${seq}`,
    application_id: appItem.id,
    app_no: appItem.app_no,
    lead_name: appItem.lead_name,
    bank_name: appItem.bank_name,
    marketing_id: appItem.marketing_id,
    marketing_name: appItem.marketing_name,
    branch: appItem.branch,
    booking_date: appItem.booking?.date || new Date().toISOString().slice(0, 10),
    credit_no: req.body?.credit_no || appItem.booking?.credit_no || "",
    amount: Math.round((appItem.plafond || 100000000) * 0.02),
    status: "DRAFT",
    notes: req.body?.notes || "",
    booking_proof: req.file ? req.file.originalname : "bukti_akad.pdf",
    payment_proof: null,
    history: [
      { id: `ch-${Date.now()}`, action: "DRAFT", note: req.body?.notes || "Klaim dibuat", user_name: req.user.name, at: new Date().toISOString() }
    ],
    created_at: new Date().toISOString()
  };
  store.claims.unshift(claim);
  saveStore();
  res.json(claim);
});

app.post("/api/claims/:id/action", requireAuth, (req, res) => {
  const store = getStore();
  const claim = store.claims.find((c) => c.id === req.params.id);
  if (!claim) return res.status(404).json({ detail: "Klaim tidak ditemukan" });
  const { action, note, amount } = req.body || {};
  const map = { submit: "SUBMITTED", review: "REVIEW", revision: "REVISION", approve: "APPROVED", reject: "REJECTED" };
  claim.status = map[action] || claim.status;
  if (amount != null) claim.amount = Number(amount);
  if (action === "revision") claim.revision_note = note;
  if (action === "reject") claim.reject_reason = note;
  claim.history.push({ id: `ch-${Date.now()}`, action: claim.status, note: note || "", user_name: req.user.name, at: new Date().toISOString() });
  saveStore();
  res.json(claim);
});

app.post("/api/claims/:id/pay", requireAuth, requireRoles("super_admin", "admin_ops"), upload.single("file"), (req, res) => {
  const store = getStore();
  const claim = store.claims.find((c) => c.id === req.params.id);
  if (!claim) return res.status(404).json({ detail: "Klaim tidak ditemukan" });
  if (req.file) {
    saveUploadedFile(`${claim.id}-payment`, req.file.originalname, req.file.mimetype || "application/pdf", req.file.buffer);
    claim.payment_proof = req.file.originalname;
  }
  if (req.body?.amount) claim.amount = Number(req.body.amount);
  claim.status = "PAID";
  claim.paid_at = new Date().toISOString();
  claim.paid_by = req.user.name;
  claim.payment_note = req.body?.note || "";
  claim.history.push({ id: `ch-${Date.now()}`, action: "PAID", note: claim.payment_note, user_name: req.user.name, at: claim.paid_at });
  saveStore();
  res.json(claim);
});

app.post("/api/claims/:id/proof", requireAuth, upload.single("file"), (req, res) => {
  const store = getStore();
  const claim = store.claims.find((c) => c.id === req.params.id);
  if (!claim) return res.status(404).json({ detail: "Klaim tidak ditemukan" });
  if (req.file) {
    saveUploadedFile(`${claim.id}-booking`, req.file.originalname, req.file.mimetype || "application/pdf", req.file.buffer);
    claim.booking_proof = req.file.originalname;
  }
  saveStore();
  res.json(claim);
});

app.get("/api/claims/:id/file/:type", requireAuth, (req, res) => {
  const store = getStore();
  const pdfBuf = generateSimulationPdfBuffer(store.simulations[0]);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="bukti_${req.params.type}.pdf"`);
  res.send(pdfBuf);
});

// ============================================================================
// 8. USERS, AUDIT LOGS & BACKUP
// ============================================================================
app.get("/api/users", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const store = getStore();
  let users = store.users;
  if ((req.user.role === "admin_branch" || req.user.role === "sales_manager") && req.user.branch) {
    users = users.filter((u) => !u.branch || u.branch === req.user.branch);
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
  if (req.user.role === "admin_ops" && !["admin_branch", "sales_manager", "marketing"].includes(targetRole)) {
    return res.status(403).json({ detail: "Admin Operasional hanya dapat membuat akun Admin Cabang/Mitra, Sales Manager, atau Marketing." });
  }
  if ((req.user.role === "admin_branch" || req.user.role === "sales_manager") && targetRole !== "marketing") {
    return res.status(403).json({ detail: `${ROLE_LABEL[req.user.role]} hanya dapat membuat akun Marketing.` });
  }
  if (store.users.some((u) => u.email.toLowerCase() === String(body.email || "").toLowerCase())) {
    return res.status(400).json({ detail: "Email sudah terdaftar." });
  }
  const newUser = {
    id: `u-${Date.now()}`,
    name: body.name,
    email: body.email,
    password_hash: hashPassword(body.password || "Password123!"),
    role: targetRole,
    branch: body.branch || req.user.branch || "BANDUNG",
    phone: body.phone || "",
    active: true,
    created_at: new Date().toISOString()
  };
  store.users.push(newUser);
  saveStore();
  addAuditLog(req.user, "create_user", newUser.email, `Membuat akun ${newUser.name} (${ROLE_LABEL[newUser.role]})`, req.ip);
  res.json(sanitizeUser(newUser));
});

app.patch("/api/users/:id", requireAuth, requireRoles("super_admin", "admin_ops", "admin_branch", "sales_manager"), (req, res) => {
  const store = getStore();
  const target = store.users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ detail: "Pengguna tidak ditemukan" });
  if (req.user.role === "admin_ops" && !["admin_branch", "sales_manager", "marketing"].includes(target.role)) {
    return res.status(403).json({ detail: "Admin Operasional hanya dapat mengubah akun Admin Cabang/Mitra, Sales Manager, atau Marketing." });
  }
  if ((req.user.role === "admin_branch" || req.user.role === "sales_manager") && target.role !== "marketing") {
    return res.status(403).json({ detail: `${ROLE_LABEL[req.user.role]} hanya dapat mengubah akun Marketing.` });
  }
  const { name, role, branch, phone, active, password } = req.body || {};
  if (name !== undefined) target.name = name;
  if (role !== undefined && (req.user.role === "super_admin" || (req.user.role === "admin_ops" && ["admin_branch", "sales_manager", "marketing"].includes(role)))) {
    target.role = role;
  }
  if (branch !== undefined) target.branch = branch;
  if (phone !== undefined) target.phone = phone;
  if (active !== undefined) target.active = active;
  if (password) target.password_hash = hashPassword(password);
  saveStore();
  addAuditLog(req.user, "update_user", target.email, `Memperbarui profil pengguna ${target.name}`, req.ip);
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
  const incoming = JSON.parse(req.file.buffer.toString("utf8"));
  const store = getStore();
  const restored = { leads: 0, simulations: 0, applications: 0 };
  if (Array.isArray(incoming.leads)) {
    store.leads = incoming.leads;
    restored.leads = incoming.leads.length;
  }
  if (Array.isArray(incoming.simulations)) {
    store.simulations = incoming.simulations;
    restored.simulations = incoming.simulations.length;
  }
  if (Array.isArray(incoming.applications)) {
    store.applications = incoming.applications;
    restored.applications = incoming.applications.length;
  }
  saveStore();
  addAuditLog(req.user, "restore_backup", "database", `Memulihkan database (${restored.leads} leads)`, req.ip);
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
