// ============================================================================
// PUBLIC LANDING PAGE LEAD CAPTURE ROUTE (POST /api/public/leads)
// Zero-trust public endpoint: 8KB body limit, IP rate limiter (5 req / 15 min),
// honeypot trap, optional Cloudflare Turnstile verification, strict field
// whitelist, formula-injection sanitization, anti-customer-enumeration, and
// transactional persistence into store.leads (lp-production-20261109-v1).
// ============================================================================

import express from "express";
import crypto from "node:crypto";
import { withTransaction, addPublicAuditLog } from "../db/database.js";
import { normalizeBranch, resolveBranchFromCityOrText } from "../config/branches.js";
import { parsePhone, sanitizeCellValue } from "../utils/lead-import-parser.js";
import { todayWibIso } from "../utils/time-wib.js";
import { normalizeClientIp } from "../security/login-limiter.js";

export const DEFAULT_PDP_CONSENT_VERSION = "UU-PDP-2026-v1";

export const ALLOWED_PUBLIC_INSTITUTIONS = Object.freeze([
  "TASPEN",
  "ASABRI",
  "PNS AKTIF",
  "BUMN",
  "LAINNYA"
]);

export const ALLOWED_PUBLIC_PENSION_STATUSES = Object.freeze([
  "Sudah Pensiun",
  "Prapensiun",
  "Janda/Duda Pensiun"
]);

export const PUBLIC_LEAD_SUCCESS_RESPONSE = Object.freeze({
  ok: true,
  message:
    "Terima kasih. Permohonan konsultasi Anda telah kami terima dan tim cabang terdekat akan segera menghubungi Anda."
});

export class PublicLeadLimiter {
  constructor({
    windowMs = 15 * 60 * 1000,
    maxRequests = 5,
    maxEntries = 10000,
    now = () => Date.now()
  } = {}) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
  }

  normalizeIp(ip) {
    return normalizeClientIp(ip);
  }

  sweep(currentTime) {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= currentTime) {
        this.entries.delete(key);
      }
    }
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  consume(ip) {
    const currentTime = this.now();
    const key = this.normalizeIp(ip);
    let entry = this.entries.get(key);

    if (!entry || entry.resetAt <= currentTime) {
      this.sweep(currentTime);
      entry = { count: 0, resetAt: currentTime + this.windowMs };
      this.entries.set(key, entry);
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000))
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - entry.count),
      retryAfterSeconds: 0
    };
  }
}

export async function defaultVerifyTurnstile(token, remoteIp, secretKey) {
  if (!secretKey || !token) return false;
  try {
    const params = new URLSearchParams();
    params.set("secret", secretKey);
    params.set("response", token);
    if (remoteIp) params.set("remoteip", String(remoteIp));

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.success === true;
  } catch {
    return false;
  }
}

export function createPublicLeadsRouter({
  limiter = new PublicLeadLimiter(),
  verifyTurnstile = defaultVerifyTurnstile
} = {}) {
  const router = express.Router();

  router.post("/", async (req, res, next) => {
    try {
      // 1. Rate Limiter per req.ip (Seam #5: relies on Express trust proxy = 1)
      const rateCheck = limiter.consume(req.ip);
      if (!rateCheck.allowed) {
        res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
        return res.status(429).json({
          detail:
            "Terlalu banyak permohonan konsultasi dari jaringan Anda. Silakan tunggu beberapa menit sebelum mencoba kembali."
        });
      }

      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};

      // 2. Honeypot Trap (company_website): silent 200 OK without saving
      if (typeof body.company_website === "string" && body.company_website.trim().length > 0) {
        return res.status(200).json(PUBLIC_LEAD_SUCCESS_RESPONSE);
      }

      // 3. Optional / Enforced Cloudflare Turnstile verification
      const turnstileSecret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
      const requireTurnstile =
        Boolean(turnstileSecret) || process.env.PUBLIC_LEADS_REQUIRE_TURNSTILE === "true";

      if (requireTurnstile) {
        const token = typeof body.turnstile_token === "string" ? body.turnstile_token.trim() : "";
        if (!token) {
          return res.status(400).json({
            detail: "Verifikasi keamanan gagal. Silakan muat ulang halaman dan coba lagi."
          });
        }
        const verified = await verifyTurnstile(token, req.ip, turnstileSecret);
        if (!verified) {
          return res.status(400).json({
            detail: "Verifikasi keamanan gagal. Silakan muat ulang halaman dan coba lagi."
          });
        }
      }

      // 4. Strict Whitelist Validation, UU PDP Explicit Consent & Formula-Injection Sanitization
      if (body.pdp_consent !== true) {
        return res.status(400).json({
          detail:
            "Persetujuan Pelindungan Data Pribadi (UU No. 27 Tahun 2022 / UU PDP) wajib dicentang sebelum mengirim permohonan konsultasi."
        });
      }
      let cleanConsentVersion = DEFAULT_PDP_CONSENT_VERSION;
      if (body.consent_version !== undefined && body.consent_version !== null && body.consent_version !== "") {
        if (typeof body.consent_version !== "string" || body.consent_version.length > 40) {
          return res.status(400).json({ detail: "Versi persetujuan UU PDP tidak valid." });
        }
        const sanitizedVersion = sanitizeCellValue(body.consent_version.trim());
        if (sanitizedVersion) cleanConsentVersion = sanitizedVersion.slice(0, 40);
      }

      if (typeof body.name !== "string") {
        return res.status(400).json({ detail: "Nama lengkap wajib diisi (3–120 karakter)." });
      }
      const cleanName = sanitizeCellValue(body.name);
      if (cleanName.length < 3 || cleanName.length > 120) {
        return res.status(400).json({ detail: "Nama lengkap wajib terdiri dari 3 hingga 120 karakter." });
      }

      if (typeof body.phone !== "string") {
        return res.status(400).json({ detail: "Nomor HP / WhatsApp wajib diisi dengan format yang valid." });
      }
      const normalizedPhone = parsePhone(body.phone);
      if (!/^08[0-9]{8,12}$/.test(normalizedPhone)) {
        return res.status(400).json({
          detail: "Nomor HP / WhatsApp tidak valid. Gunakan nomor aktif Indonesia (10–14 digit, contoh: 081234567890)."
        });
      }

      if (typeof body.city !== "string") {
        return res.status(400).json({ detail: "Kota / domisili wajib diisi (2–80 karakter)." });
      }
      const cleanCity = sanitizeCellValue(body.city);
      if (cleanCity.length < 2 || cleanCity.length > 80) {
        return res.status(400).json({ detail: "Kota / domisili wajib terdiri dari 2 hingga 80 karakter." });
      }
      const targetBranch = normalizeBranch(
        resolveBranchFromCityOrText(cleanCity, cleanCity, "", "PUSAT JAKARTA") || "PUSAT JAKARTA"
      );

      let institution = "TASPEN";
      if (body.institution !== undefined && body.institution !== null && String(body.institution).trim() !== "") {
        if (typeof body.institution !== "string" || !ALLOWED_PUBLIC_INSTITUTIONS.includes(body.institution.trim())) {
          return res.status(400).json({ detail: "Instansi pensiun tidak valid." });
        }
        institution = body.institution.trim();
      }

      let pensionStatus = "Sudah Pensiun";
      if (
        body.pension_status !== undefined &&
        body.pension_status !== null &&
        String(body.pension_status).trim() !== ""
      ) {
        if (
          typeof body.pension_status !== "string" ||
          !ALLOWED_PUBLIC_PENSION_STATUSES.includes(body.pension_status.trim())
        ) {
          return res.status(400).json({ detail: "Status pensiun tidak valid." });
        }
        pensionStatus = body.pension_status.trim();
      }

      // Seam #3: Age segmentation (prapen 50..59 vs pensiun >= 60 & <= 70)
      let resolvedAge = pensionStatus === "Prapensiun" ? 55 : 65;
      if (body.age !== undefined && body.age !== null && body.age !== "") {
        const rawAge = typeof body.age === "number" ? body.age : Number(String(body.age).trim());
        if (!Number.isInteger(rawAge) || rawAge < 40 || rawAge > 85) {
          return res.status(400).json({ detail: "Usia wajib berupa angka bulat antara 40 hingga 85 tahun." });
        }
        resolvedAge = rawAge;
      }

      let resolvedSalary = 0;
      if (body.salary_estimate !== undefined && body.salary_estimate !== null && body.salary_estimate !== "") {
        const rawSalary =
          typeof body.salary_estimate === "number"
            ? body.salary_estimate
            : Number(String(body.salary_estimate).trim());
        if (!Number.isInteger(rawSalary) || rawSalary < 0 || rawSalary > 100000000) {
          return res.status(400).json({
            detail: "Estimasi gaji pensiun wajib berupa angka bulat antara 0 hingga 100.000.000."
          });
        }
        resolvedSalary = rawSalary;
      }

      let cleanNotes = "";
      if (body.notes !== undefined && body.notes !== null && body.notes !== "") {
        if (typeof body.notes !== "string" || body.notes.length > 500) {
          return res.status(400).json({ detail: "Catatan tambahan maksimal 500 karakter." });
        }
        cleanNotes = sanitizeCellValue(body.notes);
        if (cleanNotes.length > 500) {
          return res.status(400).json({ detail: "Catatan tambahan maksimal 500 karakter." });
        }
      }

      // 5. Transactional persistence & Anti-Customer Enumeration (Seam #2, #3, #4)
      withTransaction((store) => {
        const isDuplicate = store.leads.some((l) => l.phone === normalizedPhone);
        if (isDuplicate) {
          addPublicAuditLog(
            "public_lead_duplicate",
            targetBranch,
            `Inquiry publik duplikat diabaikan (${targetBranch})`,
            req.ip
          );
          return;
        }

        const now = new Date().toISOString();
        const todayIso = todayWibIso();
        const formattedNote = `[${institution} • ${pensionStatus}]${cleanNotes ? " " + cleanNotes : ""}`;

        store.leads.unshift({
          id: `lead-web-${crypto.randomUUID()}`,
          name: cleanName,
          phone: normalizedPhone,
          nopen: "",
          nip: "",
          birth_date: null,
          age: resolvedAge,
          pension_salary: resolvedSalary,
          city: cleanCity,
          branch: targetBranch,
          source: "Website Landing Page",
          status: "baru",
          follow_up_date: todayIso,
          assigned_to: null,
          assigned_name: null,
          sales_manager_id: null,
          sales_manager_name: null,
          notes: formattedNote,
          consent_at: now,
          consent_version: cleanConsentVersion,
          activities: [], // Seam #2: MUST be empty array so untouchedCount (<= 1 post allocation) stays accurate
          documents: [],
          created_at: now,
          updated_at: now
        });

        addPublicAuditLog(
          "public_lead_inquiry",
          targetBranch,
          `Lead baru dari Website Landing Page (${cleanName} - ${targetBranch})`,
          req.ip
        );
      });

      return res.status(200).json(PUBLIC_LEAD_SUCCESS_RESPONSE);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
