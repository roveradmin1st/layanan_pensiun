// ============================================================================
// ENTERPRISE STORAGE & STATE MANAGEMENT SERVICE
// Menyimpan & mengelola seluruh data aplikasi sesuai struktur Emergent
// https://layananpensiunan.com/ + Dynamic Partner Parameters:
// - Users (super_admin, admin_ops, marketing)
// - Leads (Database Leads, Aktivitas, Dokumen, Penugasan)
// - Imports (Riwayat Impor Excel/CSV)
// - Simulations (Riwayat Simulasi Calc Platinum, BSI Prapensiun, & Mitra Bank)
// - Applications (List Progress Leads 8 Tahap + 8 Dokumen Wajib PDF + Validate)
// - Claims (Pengajuan Klaim Insentif Booking/Live)
// - Partner Parameters (Dinamis & Dapat Diedit sesuai command.md)
// - Audit Logs (Jejak aktivitas lengkap dengan IP)
// ============================================================================

const STORAGE_KEYS = {
  PARAMS: "lp_emergent_params_v3",
  USERS: "lp_emergent_users_v3",
  CURRENT_USER: "lp_emergent_current_user_v3",
  AUTH_STATE: "lp_emergent_auth_state_v3",
  LEADS: "lp_emergent_leads_v3",
  IMPORTS: "lp_emergent_imports_v3",
  SIMULATIONS: "lp_emergent_simulations_v3",
  APPLICATIONS: "lp_emergent_applications_v3",
  CLAIMS: "lp_emergent_claims_v3",
  AUDIT_LOGS: "lp_emergent_audit_logs_v3"
};

const APP_STAGES_TEMPLATE = [
  { key: "upload_dokumen", label: "Upload Dokumen" },
  { key: "pengajuan_bank", label: "Pengajuan ke Bank" },
  { key: "verifikasi_bank", label: "Verifikasi Bank" },
  { key: "approval_bank", label: "Approval Bank" },
  { key: "penjadwalan_akad", label: "Penjadwalan Akad" },
  { key: "akad_nasabah", label: "Akad Nasabah" },
  { key: "booking_live", label: "Booking/Live" },
  { key: "ditolak", label: "Ditolak Bank" }
];

const MANDATORY_CHECKLIST_TEMPLATE = [
  { key: "ktp_pasangan", label: "KTP Nasabah & Suami/Istri", group: "Identitas Wajib" },
  { key: "nikah_kematian", label: "Buku Nikah / Akta Kematian", group: "Identitas Wajib" },
  { key: "kk", label: "Kartu Keluarga (KK)", group: "Identitas Wajib" },
  { key: "taspen", label: "Kartu Identitas Pensiun / Taspen / Asabri", group: "Kepesertaan Pensiun" },
  { key: "sk", label: "Surat Keputusan (SK) Pensiun", group: "Kepesertaan Pensiun" },
  { key: "rekening", label: "Cetak Buku Rekening Gaji 3 Bulan Terakhir", group: "Keuangan" },
  { key: "ktp_ahliwaris", label: "KTP Ahli Waris", group: "Ahli Waris" },
  { key: "kk_ahliwaris", label: "Kartu Keluarga (KK) Ahli Waris", group: "Ahli Waris" }
];

const INITIAL_USERS = [
  {
    id: "USR-SA-001",
    name: "Teguh Pranada",
    email: "teguh@layananpensiunan.com",
    phone: "081260000001",
    role: "super_admin",
    role_label: "Super Admin",
    branch: "Pematangsiantar",
    active: true
  },
  {
    id: "USR-AO-001",
    name: "Dewi Sartika Nasution",
    email: "admin.ops@layananpensiunan.com",
    phone: "081260000002",
    role: "admin_ops",
    role_label: "Admin Operasional",
    branch: "Pematangsiantar",
    active: true
  },
  {
    id: "USR-MK-014",
    name: "Rizky Pratama Saragih",
    email: "rizky@layananpensiunan.com",
    phone: "081375000014",
    role: "marketing",
    role_label: "Marketing",
    branch: "Pematangsiantar",
    active: true
  },
  {
    id: "USR-MK-021",
    name: "Siti Rahmawati",
    email: "siti@layananpensiunan.com",
    phone: "081375000021",
    role: "marketing",
    role_label: "Marketing",
    branch: "Medan",
    active: true
  }
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const INITIAL_LEADS = [
  {
    id: "LEAD-9001",
    name: "H. Sarmadan Siregar",
    phone: "081263001122",
    city: "Kota Pematangsiantar",
    branch: "Pematangsiantar",
    source: "Data Taspen",
    nopen: "1200491827",
    nip: "195304121978031002",
    pension_salary: 3850000,
    birth_date: "1953-04-12",
    status: "proses",
    assigned_to: "USR-MK-014",
    assigned_name: "Rizky Pratama Saragih",
    follow_up_date: todayIso(),
    notes: "Nasabah setuju simulasi Pra Platinum Rp120 Juta, berkas sedang diverifikasi Admin Ops.",
    documents: [
      { id: "DOC-01", category: "KTP", filename: "KTP_Sarmadan.pdf", uploaded_at: "2026-10-26T14:15:00" },
      { id: "DOC-02", category: "SK Pensiun", filename: "SK_Pensiun_Sarmadan.pdf", uploaded_at: "2026-10-26T14:16:00" }
    ],
    activities: [
      { id: "ACT-1", type: "kunjungan", note: "Kunjungan rumah nasabah & penjelasan simulasi AMS2.", user_name: "Rizky Pratama Saragih", created_at: "2026-10-26T14:00:00" },
      { id: "ACT-2", type: "telepon", note: "Konfirmasi jadwal pengambilan dokumen asli.", user_name: "Rizky Pratama Saragih", created_at: "2026-10-25T10:30:00" }
    ]
  },
  {
    id: "LEAD-9002",
    name: "Siti Hafsah, S.Pd",
    phone: "081370004455",
    city: "Kabupaten Simalungun",
    branch: "Pematangsiantar",
    source: "Impor Data ASN",
    nopen: "1200881920",
    nip: "197610222002122001",
    pension_salary: 4600000,
    birth_date: "1976-10-22",
    status: "follow_up",
    assigned_to: "USR-MK-014",
    assigned_name: "Rizky Pratama Saragih",
    follow_up_date: todayIso(),
    notes: "Guru ASN aktif usia 50 thn, berminat BSI Prapensiun Dekade Berkah (PP10) plafon Rp480 Juta.",
    documents: [],
    activities: [
      { id: "ACT-3", type: "whatsapp", note: "Mengirimkan PDF simulasi BSI Prapensiun & Simas Jiwa.", user_name: "Rizky Pratama Saragih", created_at: "2026-10-26T16:10:00" }
    ]
  },
  {
    id: "LEAD-9003",
    name: "Drs. Parlindungan Purba",
    phone: "081265008899",
    city: "Kota Medan",
    branch: "Medan",
    source: "Data Taspen",
    nopen: "1200319044",
    nip: "194908191975011001",
    pension_salary: 3600000,
    birth_date: "1949-08-19",
    status: "berhasil",
    assigned_to: "USR-MK-021",
    assigned_name: "Siti Rahmawati",
    follow_up_date: "2026-10-25",
    notes: "Pengajuan telah BOOKING/LIVE.",
    documents: [],
    activities: [
      { id: "ACT-4", type: "kunjungan", note: "Pendampingan akad nasabah hingga pencairan.", user_name: "Siti Rahmawati", created_at: "2026-10-25T15:00:00" }
    ]
  },
  {
    id: "LEAD-9004",
    name: "Hj. Rosmawati Lubis",
    phone: "081396007711",
    city: "Kota Pematangsiantar",
    branch: "Pematangsiantar",
    source: "Data Taspen",
    nopen: "1200211988",
    nip: "194506101970022003",
    pension_salary: 3100000,
    birth_date: "1945-06-10",
    status: "berhasil",
    assigned_to: "USR-MK-014",
    assigned_name: "Rizky Pratama Saragih",
    follow_up_date: "2026-10-24",
    notes: "Nasabah Post Platinum Rp50 Juta sudah Booking/Live.",
    documents: [],
    activities: []
  },
  {
    id: "LEAD-9005",
    name: "Tumpal Sitorus",
    phone: "082166003344",
    city: "Kota Pematangsiantar",
    branch: "Pematangsiantar",
    source: "Impor Excel",
    nopen: "1200556712",
    nip: "195502181981031004",
    pension_salary: 3950000,
    birth_date: "1955-02-18",
    status: "baru",
    assigned_to: null,
    assigned_name: null,
    follow_up_date: todayIso(),
    notes: "Data baru hasil impor, siap ditugaskan ke marketing.",
    documents: [],
    activities: []
  },
  {
    id: "LEAD-9006",
    name: "H. Abdul Majid Harahap",
    phone: "081264559900",
    city: "Kabupaten Asahan",
    branch: "Pematangsiantar",
    source: "Impor Excel",
    nopen: "1200671234",
    nip: "194811051974021001",
    pension_salary: 3450000,
    birth_date: "1948-11-05",
    status: "baru",
    assigned_to: "USR-MK-014",
    assigned_name: "Rizky Pratama Saragih",
    follow_up_date: todayIso(),
    notes: "Jadwal telepon hari ini.",
    documents: [],
    activities: []
  }
];

const INITIAL_IMPORTS = [
  {
    id: "IMP-301",
    filename: "Data_Pensiunan_Taspen_Siantar_Okt2026.xlsx",
    user_name: "Dewi Sartika Nasution",
    total_rows: 45,
    inserted: 42,
    skipped_duplicates: 3,
    error_count: 0,
    created_at: "2026-10-26T09:15:00"
  },
  {
    id: "IMP-300",
    filename: "Database_Prapensiun_ASN_Simalungun.csv",
    user_name: "Teguh Pranada",
    total_rows: 30,
    inserted: 28,
    skipped_duplicates: 2,
    error_count: 0,
    created_at: "2026-10-24T14:20:00"
  }
];

const INITIAL_SIMULATIONS = [
  {
    id: "SIM-1001",
    sim_no: "SIM-202610-001",
    lead_id: "LEAD-9001",
    bank_key: "ams2",
    bank_name: "Koperasi AMS2 (Calc Platinum)",
    dapem: "TASPEN",
    created_by: "USR-MK-014",
    created_by_name: "Rizky Pratama Saragih",
    created_at: "2026-10-26T14:20:00",
    result: {
      engine: "ams2",
      name: "H. Sarmadan Siregar",
      birth_date: "1953-04-12",
      process_date: "2026-10-26",
      age: 73,
      category: "Pra Platinum",
      plafond: 120000000,
      tenor: 120,
      bank_rate: 12.0,
      coop_rate: 17.0,
      salary: 3850000,
      take_over: 0,
      tata_laksana_pct: 3.5,
      bank_installment: 1721651,
      coop_installment: 2085572,
      baa: 363920,
      ratio_pct: 54.17,
      proaq_pct: 10.0,
      proaq: 12000000,
      risk_pct: 20.0,
      risk: 24000000,
      admin_fee: 700000,
      tata_laksana_fee: 4200000,
      total_fees: 40900000,
      retention: 6256715,
      net_disbursement: 72843285,
      remaining_salary: 1764428,
      overall_ok: true,
      validations: [
        { key: "age", label: "Status Kategori & Usia Masuk (73 thn)", ok: true },
        { key: "end_age", label: "Batas Usia Akhir Kredit (84 thn 10 bln)", ok: true },
        { key: "tenor", label: "Status Tenor (120 bln ≤ Maks)", ok: true },
        { key: "plafond", label: "Status Plafond (≤ PV Maksimal)", ok: true },
        { key: "ratio", label: "Rasio Angsuran Aktual (54,17% ≤ 95%)", ok: true },
        { key: "tl", label: "Status Tata Laksana (0%–3,5%)", ok: true },
        { key: "overall", label: "Status Keseluruhan Simulasi", ok: true }
      ]
    },
    ai_summaries: []
  },
  {
    id: "SIM-1002",
    sim_no: "SIM-202610-002",
    lead_id: "LEAD-9002",
    bank_key: "bsi_prapen",
    bank_name: "BSI — Mitraguna Prima+ Prapensiun",
    dapem: "TASPEN",
    created_by: "USR-MK-014",
    created_by_name: "Rizky Pratama Saragih",
    created_at: "2026-10-26T16:05:00",
    result: {
      engine: "bsi_simas",
      name: "Siti Hafsah, S.Pd",
      birth_date: "1976-10-22",
      process_date: "2026-10-26",
      age: 50,
      category: "Dekade Berkah (Prapen 10 Thn)",
      plafond: 480000000,
      tenor: 180,
      bank_rate: 9.5,
      coop_rate: 10.5,
      salary: 8134916,
      take_over: 0,
      tata_laksana_pct: 0,
      bank_installment: 5694441,
      coop_installment: 5694441,
      baa: 4135096,
      ratio_pct: 70.0,
      proaq_pct: 1.0,
      proaq: 4800000,
      risk_pct: 7.69,
      risk: 39998267,
      admin_fee: 100000,
      tata_laksana_fee: 0,
      total_fees: 4900000,
      retention: 13964633,
      net_disbursement: 461135367,
      remaining_salary: 2440475,
      overall_ok: true,
      validations: [
        { key: "age", label: "Usia Jatuh Tempo Pembiayaan (≤ 74 thn 4 bln)", ok: true },
        { key: "dsr", label: "DBR Aktif (70%) & DSR Pensiun (≤ 90%)", ok: true },
        { key: "simas", label: "Asuransi Simas Jiwa (76,92‰ · Non Medical Check Up)", ok: true },
        { key: "overall", label: "Status Keseluruhan Akseptasi NOS BSI", ok: true }
      ]
    },
    ai_summaries: []
  }
];

const INITIAL_APPLICATIONS = [
  {
    id: "APP-5001",
    app_no: "APP-202610-001",
    lead_id: "LEAD-9001",
    lead_name: "H. Sarmadan Siregar",
    marketing_id: "USR-MK-014",
    marketing_name: "Rizky Pratama Saragih",
    branch: "Pematangsiantar",
    bank_key: "ams2",
    bank_name: "Koperasi AMS2 (Platinum)",
    debtor_type: "Pra Platinum",
    dapem: "TASPEN",
    plafond: 120000000,
    tenor: 120,
    created_at: "2026-10-26T14:25:00",
    stage: "upload_dokumen",
    stage_index: 0,
    rejected: false,
    reject_reason: null,
    pending: {
      party: "admin_ops",
      type: "pemeriksaan",
      note: "8 dokumen wajib PDF telah diunggah oleh Marketing. Menunggu pemeriksaan Admin Operasional."
    },
    stages: APP_STAGES_TEMPLATE,
    stage_data: {
      upload_dokumen: { by_name: "Rizky Pratama Saragih", date: "2026-10-26" }
    },
    checklist: MANDATORY_CHECKLIST_TEMPLATE.map(d => ({
      ...d,
      status: "diunggah",
      filename: `${d.key}_Sarmadan.pdf`,
      uploaded_at: "2026-10-26T14:30:00",
      versions: 1,
      note: ""
    })),
    booking: null,
    history: [
      { id: "H-1", action: "created", note: "Pengajuan dibuat dari persetujuan simulasi SIM-202610-001", user_name: "Rizky Pratama Saragih", role: "marketing", at: "2026-10-26T14:25:00" },
      { id: "H-2", action: "submit_dokumen", note: "Mengunggah 8 dokumen wajib PDF dan mengajukan untuk pemeriksaan Admin Operasional", user_name: "Rizky Pratama Saragih", role: "marketing", at: "2026-10-26T14:32:00" }
    ]
  },
  {
    id: "APP-5002",
    app_no: "APP-202610-002",
    lead_id: "LEAD-9004",
    lead_name: "Hj. Rosmawati Lubis",
    marketing_id: "USR-MK-014",
    marketing_name: "Rizky Pratama Saragih",
    branch: "Pematangsiantar",
    bank_key: "ams2",
    bank_name: "Koperasi AMS2 (Platinum)",
    debtor_type: "Post Platinum",
    dapem: "TASPEN",
    plafond: 50000000,
    tenor: 45,
    created_at: "2026-10-24T11:00:00",
    stage: "booking_live",
    stage_index: 6,
    rejected: false,
    reject_reason: null,
    pending: null,
    stages: APP_STAGES_TEMPLATE,
    stage_data: {
      upload_dokumen: { by_name: "Rizky Pratama Saragih", date: "2026-10-24" },
      pengajuan_bank: { by_name: "Dewi Sartika Nasution", date: "2026-10-24" },
      verifikasi_bank: { by_name: "Dewi Sartika Nasution", date: "2026-10-24" },
      approval_bank: { by_name: "Teguh Pranada", date: "2026-10-25" },
      penjadwalan_akad: { by_name: "Dewi Sartika Nasution", date: "2026-10-25" },
      akad_nasabah: { by_name: "Rizky Pratama Saragih", date: "2026-10-25" },
      booking_live: { by_name: "Teguh Pranada", date: "2026-10-25" }
    },
    checklist: MANDATORY_CHECKLIST_TEMPLATE.map(d => ({
      ...d,
      status: "diterima",
      filename: `${d.key}_Rosmawati.pdf`,
      uploaded_at: "2026-10-24T11:15:00",
      versions: 1,
      note: ""
    })),
    booking: {
      date: "2026-10-25",
      credit_no: "KRD-AMS2-2026-0881",
      confirmed_by: "Teguh Pranada"
    },
    history: [
      { id: "H-3", action: "booking_live", note: "Kredit telah cair / Booking Live No. KRD-AMS2-2026-0881", user_name: "Teguh Pranada", role: "super_admin", at: "2026-10-25T16:00:00" }
    ]
  },
  {
    id: "APP-5003",
    app_no: "APP-202610-003",
    lead_id: "LEAD-9003",
    lead_name: "Drs. Parlindungan Purba",
    marketing_id: "USR-MK-021",
    marketing_name: "Siti Rahmawati",
    branch: "Medan",
    bank_key: "ams2",
    bank_name: "Koperasi AMS2 (Platinum)",
    debtor_type: "Platinum",
    dapem: "TASPEN",
    plafond: 95000000,
    tenor: 85,
    created_at: "2026-10-23T09:30:00",
    stage: "booking_live",
    stage_index: 6,
    rejected: false,
    reject_reason: null,
    pending: null,
    stages: APP_STAGES_TEMPLATE,
    stage_data: {
      booking_live: { by_name: "Teguh Pranada", date: "2026-10-25" }
    },
    checklist: MANDATORY_CHECKLIST_TEMPLATE.map(d => ({
      ...d,
      status: "diterima",
      filename: `${d.key}_Parlindungan.pdf`,
      uploaded_at: "2026-10-23T10:00:00",
      versions: 1,
      note: ""
    })),
    booking: {
      date: "2026-10-25",
      credit_no: "KRD-AMS2-2026-0879",
      confirmed_by: "Teguh Pranada"
    },
    history: [
      { id: "H-4", action: "booking_live", note: "Booking Live terkonfirmasi", user_name: "Teguh Pranada", role: "super_admin", at: "2026-10-25T14:20:00" }
    ]
  }
];

const INITIAL_CLAIMS = [
  {
    id: "CLM-7001",
    claim_no: "CLM-202610-001",
    application_id: "APP-5002",
    app_no: "APP-202610-002",
    lead_name: "Hj. Rosmawati Lubis",
    bank_name: "Koperasi AMS2 (Platinum)",
    marketing_id: "USR-MK-014",
    marketing_name: "Rizky Pratama Saragih",
    branch: "Pematangsiantar",
    booking_date: "2026-10-25",
    credit_no: "KRD-AMS2-2026-0881",
    amount: 1250000,
    status: "SUBMITTED",
    booking_proof: "Foto_Akad_Rosmawati.jpg",
    payment_proof: null,
    revision_note: null,
    reject_reason: null,
    paid_at: null,
    paid_by: null,
    payment_note: null,
    history: [
      { id: "CH-1", action: "SUBMITTED", note: "Mengajukan klaim insentif atas pencairan Hj. Rosmawati Lubis", user_name: "Rizky Pratama Saragih", at: "2026-10-26T09:00:00" }
    ]
  },
  {
    id: "CLM-7002",
    claim_no: "CLM-202610-002",
    application_id: "APP-5003",
    app_no: "APP-202610-003",
    lead_name: "Drs. Parlindungan Purba",
    bank_name: "Koperasi AMS2 (Platinum)",
    marketing_id: "USR-MK-021",
    marketing_name: "Siti Rahmawati",
    branch: "Medan",
    booking_date: "2026-10-25",
    credit_no: "KRD-AMS2-2026-0879",
    amount: 1900000,
    status: "PAID",
    booking_proof: "Foto_Akad_Parlindungan.pdf",
    payment_proof: "Bukti_Transfer_Insentif_002.pdf",
    revision_note: null,
    reject_reason: null,
    paid_at: "2026-10-26T15:30:00",
    paid_by: "Teguh Pranada",
    payment_note: "Transfer Bank Mandiri selesai",
    history: [
      { id: "CH-2", action: "PAID", note: "Insentif Rp1.900.000 telah dibayarkan", user_name: "Teguh Pranada", at: "2026-10-26T15:30:00" }
    ]
  }
];

const INITIAL_AUDIT_LOGS = [
  {
    id: "AUD-9004",
    created_at: "2026-10-27T01:05:00",
    user_name: "Teguh Pranada",
    role: "super_admin",
    action: "parameter_initialized",
    entity: "Settings",
    detail: "Memuat parameter dinamis Calc Platinum (AMS2), BSI Prapensiun NOS v1.4.6 + Simas Jiwa, & 5 Mitra Bank",
    ip: "103.144.18.10"
  },
  {
    id: "AUD-9003",
    created_at: "2026-10-26T16:05:00",
    user_name: "Rizky Pratama Saragih",
    role: "marketing",
    action: "create_simulation",
    entity: "SIM-202610-002",
    detail: "Menyimpan simulasi BSI Prapensiun Dekade Berkah untuk Siti Hafsah, S.Pd (Rp480.000.000)",
    ip: "114.122.40.82"
  },
  {
    id: "AUD-9002",
    created_at: "2026-10-26T14:32:00",
    user_name: "Rizky Pratama Saragih",
    role: "marketing",
    action: "submit_application_docs",
    entity: "APP-202610-001",
    detail: "Mengunggah 8 berkas PDF H. Sarmadan Siregar ke pemeriksaan Admin Operasional",
    ip: "114.122.40.82"
  },
  {
    id: "AUD-9001",
    created_at: "2026-10-26T09:15:00",
    user_name: "Dewi Sartika Nasution",
    role: "admin_ops",
    action: "import_leads",
    entity: "IMP-301",
    detail: "Mengimpor 42 leads baru dari Data_Pensiunan_Taspen_Siantar_Okt2026.xlsx",
    ip: "103.144.18.12"
  }
];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

window.StorageService = {
  APP_STAGES_TEMPLATE,
  MANDATORY_CHECKLIST_TEMPLATE,

  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return deepClone(fallback);
      return JSON.parse(raw);
    } catch (_) {
      return deepClone(fallback);
    }
  },

  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Storage write error:", e);
    }
  },

  // --- Auth & Session ---
  isLoggedIn() {
    return this.read(STORAGE_KEYS.AUTH_STATE, true);
  },

  setLoggedIn(flag) {
    this.write(STORAGE_KEYS.AUTH_STATE, Boolean(flag));
  },

  getUsers() {
    return this.read(STORAGE_KEYS.USERS, INITIAL_USERS);
  },

  saveUsers(users) {
    this.write(STORAGE_KEYS.USERS, users);
  },

  getCurrentUser() {
    const saved = this.read(STORAGE_KEYS.CURRENT_USER, null);
    const users = this.getUsers();
    if (saved) {
      const found = users.find(u => u.id === saved.id);
      if (found) return found;
    }
    return users[0];
  },

  setCurrentUserById(userId) {
    const users = this.getUsers();
    const found = users.find(u => u.id === userId) || users[0];
    this.write(STORAGE_KEYS.CURRENT_USER, found);
    this.setLoggedIn(true);
    this.logAudit("switch_role", found.email, `Sesi aktif beralih ke ${found.name} (${found.role_label})`, found);
    return found;
  },

  setCurrentUserByRole(roleCode) {
    const norm = window.RBACGuard.normalizeRole(roleCode);
    const users = this.getUsers();
    const found = users.find(u => window.RBACGuard.normalizeRole(u.role) === norm && u.active) || users[0];
    return this.setCurrentUserById(found.id);
  },

  // --- Audit Logs ---
  getAuditLogs() {
    return this.read(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  },

  logAudit(action, entity, detail, actorOverride = null) {
    const user = actorOverride || this.getCurrentUser();
    const logs = this.getAuditLogs();
    logs.unshift({
      id: "AUD-" + Math.floor(1000 + Math.random() * 9000),
      created_at: new Date().toISOString(),
      user_name: user ? user.name : "Sistem",
      role: user ? window.RBACGuard.normalizeRole(user.role) : "super_admin",
      action,
      entity,
      detail,
      ip: "103.144.18." + Math.floor(10 + Math.random() * 80)
    });
    this.write(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 300));
  },

  // --- Dynamic Partner Parameters ---
  getPartnerParameters() {
    const stored = this.read(STORAGE_KEYS.PARAMS, null);
    if (!stored || !stored.ams2 || !stored.bsi_prapen) {
      this.write(STORAGE_KEYS.PARAMS, window.DEFAULT_PARTNER_PARAMETERS);
      return deepClone(window.DEFAULT_PARTNER_PARAMETERS);
    }
    return stored;
  },

  savePartnerParameters(newParams, note = "Pembaruan parameter mitra bank") {
    const user = this.getCurrentUser();
    newParams.lastUpdated = new Date().toISOString();
    newParams.updatedBy = `${user.name} (${user.role_label})`;
    this.write(STORAGE_KEYS.PARAMS, newParams);
    this.logAudit("update_parameter", "Settings", note);
    return newParams;
  },

  resetPartnerParametersToDefault() {
    const fresh = deepClone(window.DEFAULT_PARTNER_PARAMETERS);
    this.write(STORAGE_KEYS.PARAMS, fresh);
    this.logAudit("reset_parameter", "Settings", "Mengembalikan seluruh parameter mitra ke standar default resmi.");
    return fresh;
  },

  // --- Leads & Imports ---
  getLeads() {
    return this.read(STORAGE_KEYS.LEADS, INITIAL_LEADS);
  },

  saveLeads(list) {
    this.write(STORAGE_KEYS.LEADS, list);
  },

  getImports() {
    return this.read(STORAGE_KEYS.IMPORTS, INITIAL_IMPORTS);
  },

  saveImports(list) {
    this.write(STORAGE_KEYS.IMPORTS, list);
  },

  // --- Simulations ---
  getSimulations() {
    return this.read(STORAGE_KEYS.SIMULATIONS, INITIAL_SIMULATIONS);
  },

  saveSimulations(list) {
    this.write(STORAGE_KEYS.SIMULATIONS, list);
  },

  // --- Applications (Progress Leads 8 Stages) ---
  getApplications() {
    return this.read(STORAGE_KEYS.APPLICATIONS, INITIAL_APPLICATIONS);
  },

  saveApplications(list) {
    this.write(STORAGE_KEYS.APPLICATIONS, list);
  },

  // --- Claims ---
  getClaims() {
    return this.read(STORAGE_KEYS.CLAIMS, INITIAL_CLAIMS);
  },

  saveClaims(list) {
    this.write(STORAGE_KEYS.CLAIMS, list);
  },

  // --- Full Backup & Restore ---
  exportFullBackup() {
    return {
      exported_at: new Date().toISOString(),
      version: "3.0-ENTERPRISE",
      params: this.getPartnerParameters(),
      users: this.getUsers(),
      leads: this.getLeads(),
      imports: this.getImports(),
      simulations: this.getSimulations(),
      applications: this.getApplications(),
      claims: this.getClaims(),
      audit_logs: this.getAuditLogs()
    };
  },

  restoreFullBackup(data) {
    let count = 0;
    if (data.params) { this.write(STORAGE_KEYS.PARAMS, data.params); count++; }
    if (Array.isArray(data.users)) { this.saveUsers(data.users); count += data.users.length; }
    if (Array.isArray(data.leads)) { this.saveLeads(data.leads); count += data.leads.length; }
    if (Array.isArray(data.simulations)) { this.saveSimulations(data.simulations); count += data.simulations.length; }
    if (Array.isArray(data.applications)) { this.saveApplications(data.applications); count += data.applications.length; }
    if (Array.isArray(data.claims)) { this.saveClaims(data.claims); count += data.claims.length; }
    this.logAudit("restore_backup", "Backup", `Memulihkan ${count} entitas dari file backup JSON`);
    return count;
  }
};
