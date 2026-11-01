// ============================================================================
// ENTERPRISE DATABASE LAYER (SQLite Built-in `node:sqlite` + ACID Persistence)
// Menyimpan seluruh entitas di `backend/data/enterprise.sqlite`
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { DEFAULT_PARTNER_PARAMETERS, INDONESIA_PROVINCES } from "../config/default-parameters.js";
import { calculatePreview } from "../engines/calc-engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SQLITE_PATH = path.join(DATA_DIR, "enterprise.sqlite");
const db = new DatabaseSync(SQLITE_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS kv_store (
    collection TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS uploaded_files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export const APP_STAGES = [
  { key: "upload_dokumen", label: "Upload Dokumen" },
  { key: "pengajuan_bank", label: "Pengajuan ke Bank" },
  { key: "verifikasi_bank", label: "Verifikasi Bank" },
  { key: "approval_bank", label: "Approval Bank" },
  { key: "penjadwalan_akad", label: "Penjadwalan Akad" },
  { key: "akad_nasabah", label: "Akad Nasabah" },
  { key: "booking_live", label: "Booking/Live" },
  { key: "ditolak", label: "Ditolak Bank" }
];

export const DOC_TEMPLATE = [
  { key: "ktp_pasangan", label: "KTP Nasabah & Suami/Istri", group: "Identitas Wajib" },
  { key: "nikah_kematian", label: "Buku Nikah / Akta Kematian", group: "Identitas Wajib" },
  { key: "kk", label: "Kartu Keluarga (KK)", group: "Identitas Wajib" },
  { key: "taspen", label: "Kartu Identitas Pensiun / Taspen / Asabri", group: "Dokumen Pensiun" },
  { key: "sk", label: "Surat Keputusan (SK) Pensiun", group: "Dokumen Pensiun" },
  { key: "rekening", label: "Cetak Buku Tabungan / Rekening 3 Bln", group: "Keuangan" },
  { key: "ktp_ahliwaris", label: "KTP Ahli Waris", group: "Ahli Waris" },
  { key: "kk_ahliwaris", label: "Kartu Keluarga (KK) Ahli Waris", group: "Ahli Waris" }
];

export function hashPassword(plain) {
  return crypto.createHash("sha256").update(`lp_salt_2026_${plain}`).digest("hex");
}

function buildChecklist(prefilled = false) {
  const now = new Date().toISOString();
  return DOC_TEMPLATE.map((d, idx) => ({
    ...d,
    status: prefilled ? (idx < 6 ? "diterima" : "diunggah") : null,
    filename: prefilled ? `${d.key}_verified.pdf` : null,
    uploaded_at: prefilled ? now : null,
    versions: prefilled ? 1 : 0,
    note: ""
  }));
}

function createInitialState() {
  const now = new Date().toISOString();
  const defaultPwdHash = hashPassword("Password123!");

  const users = [
    {
      id: "u-super-1",
      name: "MUHAMMAD TEGUH PRANADA",
      email: "superadmin@layananpensiunan.id",
      password_hash: defaultPwdHash,
      role: "super_admin",
      branch: "PUSAT JAKARTA",
      phone: "08119001100",
      active: true,
      created_at: "2026-01-10T08:00:00.000Z"
    },
    {
      id: "u-ops-1",
      name: "RINA KARTIKA SARI",
      email: "adminops@layananpensiunan.id",
      password_hash: defaultPwdHash,
      role: "admin_ops",
      branch: "BANDUNG",
      phone: "08122334455",
      active: true,
      created_at: "2026-01-12T08:30:00.000Z"
    },
    {
      id: "u-ops-2",
      name: "SITI RAHMAWATI",
      email: "adminops.medan@layananpensiunan.id",
      password_hash: defaultPwdHash,
      role: "admin_ops",
      branch: "MEDAN",
      phone: "08126007008",
      active: true,
      created_at: "2026-01-15T09:00:00.000Z"
    },
    {
      id: "u-branch-1",
      name: "DEDY KURNIAWAN",
      email: "admincabang@layananpensiunan.id",
      password_hash: defaultPwdHash,
      role: "admin_branch",
      branch: "BANDUNG",
      phone: "081265001122",
      active: true,
      created_at: "2026-01-16T09:00:00.000Z"
    },
    {
      id: "u-sm-1",
      name: "HENDRA WIJAYA",
      email: "salesmanager@layananpensiunan.id",
      password_hash: defaultPwdHash,
      role: "sales_manager",
      branch: "BANDUNG",
      phone: "081322003344",
      active: true,
      created_at: "2026-01-18T09:00:00.000Z"
    },
    {
      id: "u-mkt-1",
      name: "ANDI PRATAMA",
      email: "marketing@layananpensiunan.id",
      password_hash: defaultPwdHash,
      role: "marketing",
      branch: "BANDUNG",
      phone: "081388899900",
      active: true,
      created_at: "2026-01-20T09:00:00.000Z"
    },
    {
      id: "u-mkt-2",
      name: "BUDI SANTOSO",
      email: "marketing2@layananpensiunan.id",
      password_hash: defaultPwdHash,
      role: "marketing",
      branch: "MEDAN",
      phone: "081377766655",
      active: true,
      created_at: "2026-01-22T09:15:00.000Z"
    }
  ];

  const partner_parameters = structuredClone(DEFAULT_PARTNER_PARAMETERS);

  const parameter_proposals = [
    {
      id: "prop-001",
      partner_key: "bank_capital",
      partner_name: "Bank Capital / Aladin — Kredit Pensiun",
      proposed_by_id: "u-ops-1",
      proposed_by_name: "RINA KARTIKA SARI (Admin Operasional)",
      created_at: "2026-10-25T14:20:00.000Z",
      status: "PENDING",
      reason: "Penyesuaian suku bunga promo Q4 Bank Capital dari 13.5% menjadi 12.9% p.a.",
      changes: { interestRateAnnual: 12.9, maxPlafondAbsolute: 350000000 }
    }
  ];

  const todayIso = new Date().toISOString().slice(0, 10);
  const leads = [
    {
      id: "lead-1001",
      name: "H. SUPARMAN WIDJAJA",
      nopen: "195304121978031002",
      nip: "195304121978031002",
      nik: "3273011204530001",
      birth_date: "1953-04-12",
      age: 73,
      phone: "08122001953",
      address: "Jl. Buah Batu No. 114, Lengkong",
      province: "Jawa Barat",
      city: "Kota Bandung",
      district: "Lengkong",
      branch: "BANDUNG",
      sk_type: "Pensiun Sendiri",
      institution: "PNS Pusat / Kemendikbud",
      pay_office: "BRI Kanca Bandung Dewi Sartika",
      pension_salary: 4850000,
      status: "proses",
      follow_up_date: todayIso,
      source: "Data Taspen",
      assigned_to: "u-mkt-1",
      assigned_name: "ANDI PRATAMA",
      notes: "Nasabah sehat, siap akad minggu ini untuk renovasi rumah.",
      activities: [
        { id: "act-1", type: "telepon", status: "proses", note: "Nasabah setuju simulasi Pra Platinum Rp150 Juta.", user_name: "ANDI PRATAMA", created_at: "2026-10-20T09:30:00.000Z" }
      ],
      documents: [],
      created_at: "2026-10-18T08:00:00.000Z",
      updated_at: "2026-10-24T10:15:00.000Z"
    },
    {
      id: "lead-1002",
      name: "HJ. ENDANG SULISTYOWATI",
      nopen: "194908171974022001",
      nip: "194908171974022001",
      nik: "3273045708490003",
      birth_date: "1949-08-17",
      age: 77,
      phone: "081321001949",
      address: "Jl. Setiabudi No. 88, Sukasari",
      province: "Jawa Barat",
      city: "Kota Bandung",
      district: "Sukasari",
      branch: "BANDUNG",
      sk_type: "Pensiun Janda/Duda",
      institution: "PNS Pemprov Jawa Barat",
      pay_office: "BTPN Bandung",
      pension_salary: 4200000,
      status: "berhasil",
      follow_up_date: "2026-10-23",
      source: "Kunjungan Lapangan",
      assigned_to: "u-mkt-1",
      assigned_name: "ANDI PRATAMA",
      notes: "Sudah akad dan booking live di AMS2 Platinum.",
      activities: [
        { id: "act-2", type: "kunjungan", status: "berhasil", note: "Akad selesai dan pencairan telah masuk ke rekening nasabah.", user_name: "ANDI PRATAMA", created_at: "2026-10-22T15:00:00.000Z" }
      ],
      documents: [],
      created_at: "2026-10-15T08:00:00.000Z",
      updated_at: "2026-10-23T11:00:00.000Z"
    },
    {
      id: "lead-1003",
      name: "DRS. BAMBANG HERMAWAN",
      nopen: "197005201996031004",
      nip: "197005201996031004",
      nik: "3273082005700002",
      birth_date: "1970-05-20",
      age: 56,
      phone: "081122334455",
      address: "Jl. Dago Asri II No. 19",
      province: "Jawa Barat",
      city: "Kota Bandung",
      district: "Coblong",
      branch: "BANDUNG",
      sk_type: "Prapensiun BUP 58",
      institution: "Kementerian Keuangan",
      pay_office: "BSI KCP Bandung Dago",
      pension_salary: 8950000,
      status: "follow_up",
      follow_up_date: todayIso,
      source: "Referral",
      assigned_to: "u-mkt-1",
      assigned_name: "ANDI PRATAMA",
      notes: "Berminat program BSI Mitraguna Prima+ Prapensiun Dekade Berkah (PP10).",
      activities: [
        { id: "act-3", type: "whatsapp", status: "follow_up", note: "Dikirimkan PDF simulasi BSI Prapensiun Rp320 Juta.", user_name: "ANDI PRATAMA", created_at: "2026-10-25T11:20:00.000Z" }
      ],
      documents: [],
      created_at: "2026-10-21T09:00:00.000Z",
      updated_at: "2026-10-25T11:20:00.000Z"
    },
    {
      id: "lead-1004",
      name: "LETKOL (PURN) SYAHRIAL NASUTION",
      nopen: "194411101968011009",
      nip: "194411101968011009",
      nik: "1271041011440002",
      birth_date: "1944-11-10",
      age: 81,
      phone: "081265001944",
      address: "Jl. Sei Serayu No. 42",
      province: "Sumatera Utara",
      city: "Kota Medan",
      district: "Medan Sunggal",
      branch: "MEDAN",
      sk_type: "Pensiun ASABRI",
      institution: "TNI AD / Kodam I BB",
      pay_office: "Bank Mandiri Taspen Medan",
      pension_salary: 5150000,
      status: "follow_up",
      follow_up_date: todayIso,
      source: "Database Asabri",
      assigned_to: "u-mkt-2",
      assigned_name: "BUDI SANTOSO",
      notes: "Masuk segmen Post Platinum (81 tahun), siap dokumen lengkap.",
      activities: [],
      documents: [],
      created_at: "2026-10-22T10:00:00.000Z",
      updated_at: "2026-10-25T14:00:00.000Z"
    },
    {
      id: "lead-1005",
      name: "DRA. RATNAWATI SIREGAR",
      nopen: "195502141980032005",
      nip: "195502141980032005",
      nik: "1271075402550004",
      birth_date: "1955-02-14",
      age: 71,
      phone: "081361112233",
      address: "Jl. Sisingamangaraja No. 210",
      province: "Sumatera Utara",
      city: "Kota Medan",
      district: "Medan Kota",
      branch: "MEDAN",
      sk_type: "Pensiun Sendiri",
      institution: "Dinas Pendidikan Sumut",
      pay_office: "POS Giro Medan",
      pension_salary: 4450000,
      status: "baru",
      follow_up_date: null,
      source: "Impor Master Taspen",
      assigned_to: null,
      assigned_name: null,
      notes: "Lead baru siap ditugaskan ke marketing cabang Medan.",
      activities: [],
      documents: [],
      created_at: "2026-10-26T08:00:00.000Z",
      updated_at: "2026-10-26T08:00:00.000Z"
    }
  ];

  const sim1Result = calculatePreview({
    bank_key: "ams2",
    name: "H. SUPARMAN WIDJAJA",
    birth_date: "1953-04-12",
    salary: 4850000,
    take_over: 15000000,
    tata_laksana_pct: 3.5,
    plafond: 150000000,
    tenor: 96
  }, partner_parameters);

  const sim2Result = calculatePreview({
    bank_key: "ams2",
    name: "HJ. ENDANG SULISTYOWATI",
    birth_date: "1949-08-17",
    salary: 4200000,
    take_over: 0,
    tata_laksana_pct: 3.0,
    plafond: 110000000,
    tenor: 60
  }, partner_parameters);

  const sim3Result = calculatePreview({
    bank_key: "bsi_prapen",
    name: "DRS. BAMBANG HERMAWAN",
    birth_date: "1970-05-20",
    salary: 8950000,
    take_over: 25000000,
    tata_laksana_pct: 1.5,
    plafond: 320000000,
    tenor: 120,
    bsi_sub_product: "PP10",
    bsi_akad: "MMQ",
    bsi_skema: "Atribusi"
  }, partner_parameters);

  const simulations = [
    {
      id: "sim-2001",
      sim_no: "SIM-202610-0001",
      lead_id: "lead-1001",
      bank_key: "ams2",
      dapem: "TASPEN",
      result: sim1Result,
      status: "approved",
      created_by: "u-mkt-1",
      created_by_name: "ANDI PRATAMA",
      branch: "BANDUNG",
      created_at: "2026-10-24T09:45:00.000Z"
    },
    {
      id: "sim-2002",
      sim_no: "SIM-202610-0002",
      lead_id: "lead-1002",
      bank_key: "ams2",
      dapem: "TASPEN",
      result: sim2Result,
      status: "approved",
      created_by: "u-mkt-1",
      created_by_name: "ANDI PRATAMA",
      branch: "BANDUNG",
      created_at: "2026-10-19T14:10:00.000Z"
    },
    {
      id: "sim-2003",
      sim_no: "SIM-202610-0003",
      lead_id: "lead-1003",
      bank_key: "bsi_prapen",
      dapem: "TASPEN",
      result: sim3Result,
      status: "saved",
      created_by: "u-mkt-1",
      created_by_name: "ANDI PRATAMA",
      branch: "BANDUNG",
      created_at: "2026-10-25T11:15:00.000Z"
    }
  ];

  const applications = [
    {
      id: "app-3001",
      app_no: "APP-202610-0001",
      sim_id: "sim-2001",
      lead_id: "lead-1001",
      lead_name: "H. SUPARMAN WIDJAJA",
      marketing_id: "u-mkt-1",
      marketing_name: "ANDI PRATAMA",
      branch: "BANDUNG",
      bank_key: "ams2",
      bank_name: "Koperasi Asia Madani Sejahtera (AMS2)",
      debtor_type: "PRA PLATINUM",
      dapem: "TASPEN",
      plafond: 150000000,
      tenor: 96,
      stage: "upload_dokumen",
      stage_index: 0,
      stages: APP_STAGES,
      stage_data: {
        upload_dokumen: { by_name: "ANDI PRATAMA", at: "2026-10-24T10:00:00.000Z" }
      },
      pending: {
        party: "admin_ops",
        type: "pemeriksaan",
        note: "Dokumen utama telah diunggah oleh Marketing, menunggu pemeriksaan Admin Operasional."
      },
      rejected: false,
      reject_reason: null,
      booking: null,
      checklist: buildChecklist(true),
      history: [
        { id: "h-1", action: "created", note: "Pengajuan dibuat dari persetujuan simulasi SIM-202610-0001", user_name: "ANDI PRATAMA", role: "marketing", at: "2026-10-24T10:00:00.000Z" },
        { id: "h-2", action: "submit_for_review", note: "Mengajukan dokumen untuk pemeriksaan Admin Operasional", user_name: "ANDI PRATAMA", role: "marketing", at: "2026-10-24T11:30:00.000Z" }
      ],
      created_at: "2026-10-24T10:00:00.000Z"
    },
    {
      id: "app-3002",
      app_no: "APP-202610-0002",
      sim_id: "sim-2002",
      lead_id: "lead-1002",
      lead_name: "HJ. ENDANG SULISTYOWATI",
      marketing_id: "u-mkt-1",
      marketing_name: "ANDI PRATAMA",
      branch: "BANDUNG",
      bank_key: "ams2",
      bank_name: "Koperasi Asia Madani Sejahtera (AMS2)",
      debtor_type: "PLATINUM",
      dapem: "TASPEN",
      plafond: 110000000,
      tenor: 60,
      stage: "booking_live",
      stage_index: 6,
      stages: APP_STAGES,
      stage_data: {
        upload_dokumen: { by_name: "ANDI PRATAMA", date: "2026-10-19" },
        pengajuan_bank: { by_name: "RINA KARTIKA SARI", date: "2026-10-20" },
        verifikasi_bank: { by_name: "RINA KARTIKA SARI", date: "2026-10-21" },
        approval_bank: { by_name: "RINA KARTIKA SARI", date: "2026-10-21" },
        penjadwalan_akad: { by_name: "RINA KARTIKA SARI", date: "2026-10-22" },
        akad_nasabah: { by_name: "RINA KARTIKA SARI", date: "2026-10-22" },
        booking_live: { by_name: "RINA KARTIKA SARI", date: "2026-10-23" }
      },
      pending: null,
      rejected: false,
      reject_reason: null,
      booking: {
        date: "2026-10-23",
        credit_no: "PK-AMS2-2026-08891",
        confirmed_by: "RINA KARTIKA SARI"
      },
      checklist: buildChecklist(true).map((d) => ({ ...d, status: "diterima" })),
      history: [
        { id: "h-21", action: "created", note: "Pengajuan dibuat dari SIM-202610-0002", user_name: "ANDI PRATAMA", role: "marketing", at: "2026-10-19T14:15:00.000Z" },
        { id: "h-22", action: "forward_bank", note: "Dokumen lengkap, diteruskan ke Koperasi AMS2", user_name: "RINA KARTIKA SARI", role: "admin_ops", at: "2026-10-20T09:00:00.000Z" },
        { id: "h-23", action: "booking_live", note: "Kredit telah cair & aktif dengan No. PK-AMS2-2026-08891", user_name: "RINA KARTIKA SARI", role: "admin_ops", at: "2026-10-23T11:00:00.000Z" }
      ],
      created_at: "2026-10-19T14:15:00.000Z"
    }
  ];

  const claims = [
    {
      id: "clm-4001",
      claim_no: "CLM-202610-0001",
      application_id: "app-3002",
      app_no: "APP-202610-0002",
      lead_name: "HJ. ENDANG SULISTYOWATI",
      bank_name: "Koperasi Asia Madani Sejahtera (AMS2)",
      marketing_id: "u-mkt-1",
      marketing_name: "ANDI PRATAMA",
      branch: "BANDUNG",
      booking_date: "2026-10-23",
      credit_no: "PK-AMS2-2026-08891",
      amount: 2200000,
      status: "REVIEW",
      notes: "Pengajuan klaim insentif pencairan Platinum Rp110 Juta.",
      revision_note: null,
      reject_reason: null,
      booking_proof: "foto_akad_endang.pdf",
      payment_proof: null,
      paid_at: null,
      paid_by: null,
      payment_note: null,
      history: [
        { id: "ch-1", action: "SUBMITTED", note: "Klaim diajukan oleh Marketing beserta foto akad", user_name: "ANDI PRATAMA", at: "2026-10-23T14:00:00.000Z" },
        { id: "ch-2", action: "REVIEW", note: "Sedang diverifikasi oleh Admin Operasional", user_name: "RINA KARTIKA SARI", at: "2026-10-24T09:15:00.000Z" }
      ],
      created_at: "2026-10-23T13:50:00.000Z"
    }
  ];

  const imports = [
    {
      id: "imp-5001",
      filename: "master_dapem_taspen_jabar_okt2026.csv",
      total_rows: 125,
      inserted: 122,
      skipped_duplicates: 3,
      error_count: 0,
      errors: [],
      user_name: "MUHAMMAD TEGUH PRANADA",
      created_at: "2026-10-15T07:30:00.000Z"
    }
  ];

  const audit_logs = [
    {
      id: "aud-1",
      user_id: "u-super-1",
      user_name: "MUHAMMAD TEGUH PRANADA",
      role: "super_admin",
      action: "system_init",
      entity: "enterprise_database",
      detail: "Inisialisasi database SQLite Enterprise & Parameter Mitra Dinamis v2.5.0",
      ip: "127.0.0.1",
      created_at: now
    }
  ];

  return {
    users,
    partner_parameters,
    parameter_proposals,
    leads,
    simulations,
    applications,
    claims,
    imports,
    audit_logs,
    meta: {
      provinces: INDONESIA_PROVINCES,
      statuses: ["baru", "follow_up", "proses", "berhasil", "gagal"],
      sk_types: ["Pensiun Sendiri", "Pensiun Janda/Duda", "Pensiun Yatim", "Prapensiun BUP 58", "Prapensiun BUP 60", "Pensiun ASABRI"],
      sources: ["Data Taspen", "Database Asabri", "Kunjungan Lapangan", "Referral", "Impor Master Taspen", "Walk-in"]
    }
  };
}

let stateCache = null;

function ensureStoreUpgrades(state) {
  let changed = false;
  const defaultPwdHash = hashPassword("Password123!");

  if (!state.users.some((u) => u.role === "admin_branch")) {
    state.users.push({
      id: "u-branch-1",
      name: "DEDY KURNIAWAN",
      email: "admincabang@layananpensiunan.id",
      password_hash: defaultPwdHash,
      role: "admin_branch",
      branch: "BANDUNG",
      phone: "081265001122",
      active: true,
      created_at: "2026-01-16T09:00:00.000Z"
    });
    changed = true;
  }

  if (!state.users.some((u) => u.role === "sales_manager")) {
    state.users.push({
      id: "u-sm-1",
      name: "HENDRA WIJAYA",
      email: "salesmanager@layananpensiunan.id",
      password_hash: defaultPwdHash,
      role: "sales_manager",
      branch: "BANDUNG",
      phone: "081322003344",
      active: true,
      created_at: "2026-01-18T09:00:00.000Z"
    });
    changed = true;
  }

  if (
    !state.partner_parameters?.bank_capital ||
    state.partner_parameters.bank_capital.engine !== "capital_ps3"
  ) {
    state.partner_parameters = state.partner_parameters || {};
    state.partner_parameters.bank_capital = structuredClone(DEFAULT_PARTNER_PARAMETERS.bank_capital);
    changed = true;
  }

  if (
    !state.partner_parameters?.ams2 ||
    state.partner_parameters.ams2.plafondRoundingStep !== 100000
  ) {
    state.partner_parameters = state.partner_parameters || {};
    state.partner_parameters.ams2 = structuredClone(DEFAULT_PARTNER_PARAMETERS.ams2);
    changed = true;
  }

  if (
    !state.partner_parameters?.bank_mestika ||
    state.partner_parameters.bank_mestika.engine !== "mestika_tba"
  ) {
    state.partner_parameters = state.partner_parameters || {};
    state.partner_parameters.bank_mestika = structuredClone(DEFAULT_PARTNER_PARAMETERS.bank_mestika);
    changed = true;
  }

  for (const inactiveKey of ["bank_mantap", "bank_mnc", "bank_bni"]) {
    if (state.partner_parameters?.[inactiveKey]?.active !== false) {
      state.partner_parameters[inactiveKey].active = false;
      changed = true;
    }
  }

  return changed;
}

export function getStore() {
  if (stateCache) return stateCache;
  const row = db.prepare("SELECT payload FROM kv_store WHERE collection = 'enterprise_state'").get();
  if (row && row.payload) {
    try {
      stateCache = JSON.parse(row.payload);
      if (ensureStoreUpgrades(stateCache)) {
        saveStore();
      }
      return stateCache;
    } catch {
      // fallback to re-seed
    }
  }
  stateCache = createInitialState();
  saveStore();
  return stateCache;
}

export function saveStore() {
  if (!stateCache) return;
  const now = new Date().toISOString();
  const payload = JSON.stringify(stateCache);
  db.prepare(`
    INSERT INTO kv_store (collection, payload, updated_at)
    VALUES ('enterprise_state', ?, ?)
    ON CONFLICT(collection) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).run(payload, now);
}

export function addAuditLog(user, action, entity, detail, ip = "127.0.0.1") {
  const store = getStore();
  store.audit_logs.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: user?.id || "system",
    user_name: user?.name || "System",
    role: user?.role || "system",
    action,
    entity,
    detail,
    ip,
    created_at: new Date().toISOString()
  });
  if (store.audit_logs.length > 1000) store.audit_logs.length = 1000;
  saveStore();
}

export function saveUploadedFile(id, filename, mimeType, buffer) {
  db.prepare(`
    INSERT INTO uploaded_files (id, filename, mime_type, data, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET filename = excluded.filename, mime_type = excluded.mime_type, data = excluded.data, created_at = excluded.created_at
  `).run(id, filename, mimeType, buffer, new Date().toISOString());
}

export function getUploadedFile(id) {
  return db.prepare("SELECT id, filename, mime_type, data, created_at FROM uploaded_files WHERE id = ?").get(id);
}
