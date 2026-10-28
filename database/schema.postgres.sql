-- ============================================================================
-- LAYANAN PENSIUNAN — ENTERPRISE POSTGRESQL DATABASE SCHEMA
-- Dirancang untuk skala institusi finansial (ACID, Foreign Keys, Audit Trail)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel Pengguna & Role-Based Access Control (super_admin, admin_ops, marketing)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('super_admin', 'admin_ops', 'marketing')),
  branch VARCHAR(100) NOT NULL DEFAULT 'Pematangsiantar',
  phone VARCHAR(40),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Master Parameter Dinamis Mitra Bank & Koperasi (Versioning & Maker-Checker)
CREATE TABLE IF NOT EXISTS partner_parameters (
  partner_key VARCHAR(64) PRIMARY KEY,
  partner_name VARCHAR(180) NOT NULL,
  engine_type VARCHAR(32) NOT NULL CHECK (engine_type IN ('ams2', 'bsi_simas', 'partner_bank')),
  supported BOOLEAN NOT NULL DEFAULT TRUE,
  config_json JSONB NOT NULL,
  updated_by VARCHAR(150),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabel Usulan Perubahan Parameter (Maker-Checker Dual Control)
CREATE TABLE IF NOT EXISTS parameter_proposals (
  id VARCHAR(64) PRIMARY KEY,
  partner_key VARCHAR(64) NOT NULL REFERENCES partner_parameters(partner_key),
  proposed_config JSONB NOT NULL,
  proposed_by_id VARCHAR(64) NOT NULL REFERENCES users(id),
  proposed_by_name VARCHAR(150) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by_name VARCHAR(150),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 4. Tabel Database Leads Calon Nasabah Pensiunan / Prapensiun
CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  city VARCHAR(120),
  branch VARCHAR(100),
  source VARCHAR(120) DEFAULT 'Manual',
  nopen VARCHAR(64),
  nip VARCHAR(64),
  pension_salary BIGINT,
  birth_date DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'follow_up', 'proses', 'berhasil', 'gagal')),
  assigned_to VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  assigned_name VARCHAR(150),
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_branch ON leads(branch);

-- 5. Tabel Riwayat Aktivitas Tindak Lanjut Leads
CREATE TABLE IF NOT EXISTS lead_activities (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  note TEXT NOT NULL,
  user_id VARCHAR(64) REFERENCES users(id),
  user_name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabel Riwayat Impor Excel / CSV Leads
CREATE TABLE IF NOT EXISTS lead_imports (
  id VARCHAR(64) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  user_id VARCHAR(64) REFERENCES users(id),
  user_name VARCHAR(150) NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  inserted INT NOT NULL DEFAULT 0,
  skipped_duplicates INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  errors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tabel Riwayat Simulasi Kredit (AMS2, BSI Prapensiun, & Mitra Bank)
CREATE TABLE IF NOT EXISTS simulations (
  id VARCHAR(64) PRIMARY KEY,
  sim_no VARCHAR(64) UNIQUE NOT NULL,
  lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
  bank_key VARCHAR(64) NOT NULL,
  bank_name VARCHAR(180) NOT NULL,
  dapem VARCHAR(32),
  input_json JSONB NOT NULL,
  result_json JSONB NOT NULL,
  ai_summaries_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'saved',
  created_by VARCHAR(64) REFERENCES users(id),
  created_by_name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Tabel Aplikasi Pengajuan Kredit (8 Tahap Pipeline + Checklist 8 Dokumen PDF)
CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(64) PRIMARY KEY,
  app_no VARCHAR(64) UNIQUE NOT NULL,
  simulation_id VARCHAR(64) REFERENCES simulations(id) ON DELETE SET NULL,
  lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
  lead_name VARCHAR(160) NOT NULL,
  marketing_id VARCHAR(64) REFERENCES users(id),
  marketing_name VARCHAR(150) NOT NULL,
  branch VARCHAR(100) NOT NULL,
  bank_key VARCHAR(64) NOT NULL,
  bank_name VARCHAR(180) NOT NULL,
  debtor_type VARCHAR(100) NOT NULL,
  dapem VARCHAR(32),
  plafond BIGINT NOT NULL,
  tenor INT NOT NULL,
  stage VARCHAR(64) NOT NULL DEFAULT 'upload_dokumen',
  stage_index INT NOT NULL DEFAULT 0,
  rejected BOOLEAN NOT NULL DEFAULT FALSE,
  reject_reason TEXT,
  pending_json JSONB,
  stage_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  booking_json JSONB,
  history_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Tabel Pengajuan Klaim Insentif Marketing (Hanya Pengajuan BOOKING/LIVE)
CREATE TABLE IF NOT EXISTS claims (
  id VARCHAR(64) PRIMARY KEY,
  claim_no VARCHAR(64) UNIQUE NOT NULL,
  application_id VARCHAR(64) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  app_no VARCHAR(64) NOT NULL,
  lead_name VARCHAR(160) NOT NULL,
  bank_name VARCHAR(180) NOT NULL,
  marketing_id VARCHAR(64) REFERENCES users(id),
  marketing_name VARCHAR(150) NOT NULL,
  branch VARCHAR(100) NOT NULL,
  booking_date DATE,
  credit_no VARCHAR(100),
  amount BIGINT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'REVIEW', 'REVISION', 'APPROVED', 'PAID', 'REJECTED')),
  booking_proof VARCHAR(255),
  payment_proof VARCHAR(255),
  revision_note TEXT,
  reject_reason TEXT,
  paid_at TIMESTAMPTZ,
  paid_by VARCHAR(150),
  payment_note TEXT,
  history_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Tabel Immutable Audit Log Keamanan & Aktivitas Finansial
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  user_name VARCHAR(150) NOT NULL,
  role VARCHAR(32) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(150) NOT NULL,
  detail TEXT NOT NULL,
  ip VARCHAR(64) NOT NULL DEFAULT '127.0.0.1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
