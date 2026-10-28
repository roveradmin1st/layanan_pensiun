import { CheckCircle2, XCircle } from "lucide-react";
import { rp, pct, fmtDate } from "../../lib/format";

const Row = ({ k, v, strong, testid }) => (
  <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm odd:bg-[#F5F6FA]">
    <span className="text-slate-500 shrink-0">{k}</span>
    <span className={`lp-num text-right font-semibold truncate ${strong ? "text-[#351080]" : "text-[#17223B]"}`} data-testid={testid}>{v}</span>
  </div>
);

const Block = ({ title, accent, children }) => (
  <div>
    <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#351080]">
      <span className="h-3 w-[3px] rounded" style={{ background: accent }} />{title}
    </p>
    <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">{children}</div>
  </div>
);

function ValidationList({ validations }) {
  if (!validations?.length) return null;
  return (
    <Block title="Validasi Kelayakan" accent="#078D67">
      {validations.map((v) => (
        <div
          key={v.key}
          className={`flex items-center justify-between gap-3 px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm odd:bg-[#F5F6FA] ${
            v.key === "overall" ? "font-bold" : ""
          }`}
          data-testid={`validation-${v.key}`}
        >
          <span className="text-slate-600">{v.label}</span>
          <span className={`flex shrink-0 items-center gap-1 font-semibold ${v.ok ? "text-[#078D67]" : "text-red-600"}`}>
            {v.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {v.ok ? "Sesuai" : "Tidak Sesuai"}
          </span>
        </div>
      ))}
    </Block>
  );
}

// ============================================================================
// 1. BSI MITRAGUNA PRIMA+ PRAPENSIUN (100% Terminologi Resmi BSI & Simas Jiwa)
// ============================================================================
export function BsiResultView({ r }) {
  const bsi = r.bsi_details || {};
  const sisaGajiPensiun = bsi.sisa_gaji_pensiun ?? (r.pension_salary - r.coop_installment);

  return (
    <div className="space-y-6" data-testid="final-result">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Kolom Kiri */}
        <div className="space-y-6">
          <Block title="Identitas Calon Debitur (BSI)" accent="#078D67">
            <Row k="Nama Calon Debitur" v={r.name} />
            {bsi.nip && <Row k="NIP Calon Debitur" v={bsi.nip} testid="bsi-result-nip" />}
            <Row k="Mitra Pembiayaan" v={r.bank_name || "Bank BSI"} />
            <Row k="Status Gaji" v={bsi.status_gaji_label || "Payroll (BSI)"} strong testid="bsi-result-status-gaji" />
            <Row k="Sub-Produk BSI" v={bsi.sub_product_label || "Prapen 10 Tahun (Payroll)"} strong testid="bsi-result-sub-product" />
            <Row k="Akad & Skema" v={`${bsi.akad || "MMQ"} (${bsi.skema || "Atribusi"})`} />
            <Row k="Tanggal Proses" v={fmtDate(r.process_date)} />
            <Row k="Usia Saat Proses" v={`${r.age} tahun`} />
            <Row k="Kategori Produk" v={r.category} strong testid="result-category" />
          </Block>

          <Block title="Parameter Pembiayaan & Jadwal Proyeksi" accent="#F28A19">
            <Row k="Plafond Pembiayaan" v={rp(r.plafond)} strong testid="result-plafond" />
            <Row k="Tenor Total" v={`${r.tenor} bulan`} />
            <Row k="Pembagian Tenor" v={`${bsi.active_months || 0} bln Aktif + ${bsi.pension_months || 0} bln Pensiun`} strong />
            {bsi.proyeksi_cair && <Row k="Proyeksi Tanggal Cair" v={fmtDate(bsi.proyeksi_cair)} />}
            {bsi.start_angsuran && <Row k="Mulai Angsuran" v={fmtDate(bsi.start_angsuran)} />}
            {bsi.selesai_angsuran && <Row k="Selesai Angsuran" v={fmtDate(bsi.selesai_angsuran)} />}
            <Row k="Margin Masa Aktif" v={`${pct(r.bank_rate)} per tahun`} />
            <Row k="Margin Masa Pensiun" v={`${pct(r.coop_rate)} per tahun`} />
            <Row k="Gaji Masa Aktif Diakui" v={rp(r.salary)} />
            {r.pension_salary > 0 && <Row k="Estimasi Gaji Pensiun" v={rp(r.pension_salary)} />}
            {bsi.tht > 0 && <Row k="Tabungan Hari Tua (THT)" v={rp(bsi.tht)} />}
            <Row k="Nilai Take Over" v={rp(r.take_over)} />
          </Block>

          <Block title="Rincian Angsuran BSI" accent="#5720B8">
            <Row k="Angsuran Masa Aktif" v={rp(bsi.active_installment || r.bank_installment)} testid="result-bank-installment" />
            <Row k="Angsuran Masa Pensiun" v={rp(bsi.pension_installment || r.coop_installment)} strong testid="result-coop-installment" />
            <Row k="Sisa Gaji Pensiun" v={rp(sisaGajiPensiun)} strong testid="result-sisa-gaji-pensiun" />
            <Row k={`DBR Masa Aktif (Maks ${bsi.dbr_active_rate || 70}%)`} v={pct(r.ratio_pct)} testid="result-ratio" />
            {r.ratio_pension_pct > 0 && (
              <Row k={`DSR Masa Pensiun (Maks ${bsi.dsr_pension_rate || 90}%)`} v={pct(r.ratio_pension_pct)} testid="result-ratio-pension" />
            )}
          </Block>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-6">
          <Block title="Detail Asuransi Simas Jiwa Syariah" accent="#078D67">
            <Row k="Perusahaan Asuransi" v={bsi.simas?.company || "PT Asuransi Simas Jiwa"} />
            <Row k="Usia Masuk Asuransi (x)" v={`${bsi.simas?.entry_age || r.age} tahun`} />
            <Row k="Tarif Kontribusi Simas" v={`${bsi.simas?.rate_permil} ‰ (per mil)`} />
            <Row k="Biaya Asuransi Simas" v={rp(bsi.simas?.premium || r.risk)} strong testid="result-risk" />
            <Row k="Masa Pertanggungan" v={`${bsi.simas?.effective_years || Math.ceil(r.tenor / 12)} tahun`} />
            {bsi.taksasi_mmq > 0 && <Row k="Estimasi Taksasi MMQ" v={rp(bsi.taksasi_mmq)} />}
          </Block>

          <Block title="Rincian Biaya Pembiayaan BSI" accent="#5720B8">
            <Row k={`Biaya ADM (${pct(r.proaq_pct)})`} v={rp(r.proaq)} testid="result-proaq" />
            <Row k="Biaya Asuransi Simas Jiwa" v={rp(r.risk)} />
            <Row k="Biaya Materai" v={rp(r.admin_fee)} testid="result-admin" />
            <Row k="Total Biaya Pembiayaan" v={rp(r.total_fees)} strong testid="result-total-fees" />
          </Block>

          <Block title="Rincian Pengurang Pencairan BSI" accent="#F28A19">
            <Row k="Total Biaya Pembiayaan" v={rp(r.total_fees)} />
            <Row k="Nilai Take Over (TO)" v={rp(r.take_over)} />
            <Row k="Blokir Angsuran (1× Aktif + 2× Pen)" v={rp(r.retention)} strong testid="result-retention" />
          </Block>

          <ValidationList validations={r.validations} />
        </div>
      </div>

      {/* Bottom Summary Banner */}
      <div className="grid gap-px overflow-hidden rounded-xl bg-[#078D67] sm:grid-cols-3">
        <div className="p-4 sm:p-5 text-white">
          <p className="text-xs text-white/75 font-medium">Sisa Pencairan Bersih Nasabah</p>
          <p className="mt-1 font-display text-2xl sm:text-3xl font-bold lp-num truncate" data-testid="result-net">
            {rp(r.net_disbursement)}
          </p>
        </div>
        <div className="p-4 sm:p-5 text-white sm:border-l sm:border-white/15">
          <p className="text-xs text-white/75 font-medium">Sisa Gaji Masa Pensiun</p>
          <p className="mt-1 font-display text-2xl sm:text-3xl font-bold lp-num truncate" data-testid="result-sisa-pensiun">
            {rp(sisaGajiPensiun)}
          </p>
        </div>
        <div className="p-4 sm:p-5 text-white sm:border-l sm:border-white/15">
          <p className="text-xs text-white/75 font-medium">Sisa Gaji Masa Aktif</p>
          <p className="mt-1 font-display text-2xl sm:text-3xl font-bold lp-num truncate" data-testid="result-remaining-salary">
            {rp(r.remaining_salary)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. KOPERASI SIMPAN PINJAM AMS2 (100% Terminologi Koperasi AMS2)
// ============================================================================
export function Ams2ResultView({ r }) {
  return (
    <div className="space-y-6" data-testid="final-result">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Kolom Kiri */}
        <div className="space-y-6">
          <Block title="Identitas Debitur (Koperasi)" accent="#351080">
            <Row k="Nama Debitur" v={r.name} />
            <Row k="Mitra Pembiayaan" v={r.bank_name || "Koperasi AMS2"} />
            <Row k="Kategori Produk" v={r.category} strong testid="result-category" />
            <Row k="Tanggal Proses" v={fmtDate(r.process_date)} />
            <Row k="Usia Saat Proses" v={`${r.age} tahun`} />
          </Block>

          <Block title="Parameter Pengajuan Koperasi" accent="#F28A19">
            <Row k="Plafond Pembiayaan" v={rp(r.plafond)} strong testid="result-plafond" />
            <Row k="Tenor Pembiayaan" v={`${r.tenor} bulan`} />
            <Row k="Bunga Bank" v={`${pct(r.bank_rate)} per tahun`} />
            <Row k="Bunga Koperasi" v={`${pct(r.coop_rate)} per tahun`} strong />
            <Row k="Gaji Pensiun Bulanan" v={rp(r.salary)} />
            <Row k="Nilai Take Over" v={rp(r.take_over)} />
            <Row k="Tata Laksana" v={pct(r.tata_laksana_pct)} />
          </Block>

          <Block title="Rincian Angsuran Koperasi" accent="#5720B8">
            <Row k="Angsuran Bank per Bulan" v={rp(r.bank_installment)} testid="result-bank-installment" />
            <Row k="Angsuran Koperasi per Bulan" v={rp(r.coop_installment)} strong testid="result-coop-installment" />
            <Row k="BAA per Bulan" v={rp(r.baa)} testid="result-baa" />
            <Row k="Rasio Angsuran Aktual" v={pct(r.ratio_pct)} testid="result-ratio" />
          </Block>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-6">
          <Block title="Rincian Biaya Kredit Koperasi" accent="#5720B8">
            <Row k={`Biaya PROAQ (${pct(r.proaq_pct)})`} v={rp(r.proaq)} testid="result-proaq" />
            <Row k={`Cadangan Risiko (${pct(r.risk_pct)})`} v={rp(r.risk)} testid="result-risk" />
            <Row k="Biaya Administrasi" v={rp(r.admin_fee)} testid="result-admin" />
            <Row k={`Biaya Tata Laksana (${pct(r.tata_laksana_pct)})`} v={rp(r.tata_laksana_fee)} testid="result-tl" />
            <Row k="Total Biaya Kredit" v={rp(r.total_fees)} strong testid="result-total-fees" />
          </Block>

          <Block title="Rincian Pengurang Pencairan Koperasi" accent="#F28A19">
            <Row k="Total Biaya Kredit" v={rp(r.total_fees)} />
            <Row k="Nilai Take Over (TO)" v={rp(r.take_over)} />
            <Row k={`Retensi Angsuran (${r.retention_multiplier || 3}×)`} v={rp(r.retention)} strong testid="result-retention" />
          </Block>

          <ValidationList validations={r.validations} />
        </div>
      </div>

      {/* Bottom Summary Banner */}
      <div className="grid gap-px overflow-hidden rounded-xl bg-[#351080] sm:grid-cols-2">
        <div className="p-4 sm:p-5 text-white">
          <p className="text-xs text-white/70 font-medium">Hasil Pencairan — Sisa Pencairan Bersih</p>
          <p className="mt-1 font-display text-2xl sm:text-3xl font-bold lp-num truncate" data-testid="result-net">
            {rp(r.net_disbursement)}
          </p>
        </div>
        <div className="p-4 sm:p-5 text-white sm:border-l sm:border-white/15">
          <p className="text-xs text-white/70 font-medium">Sisa Gaji setelah Angsuran</p>
          <p className="mt-1 font-display text-2xl sm:text-3xl font-bold lp-num truncate" data-testid="result-remaining-salary">
            {rp(r.remaining_salary)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MITRA BANK KONVENSIONAL (Mandiri Taspen, Capital, MNC, BNI, Mestika)
// ============================================================================
export function ConventionalBankResultView({ r }) {
  return (
    <div className="space-y-6" data-testid="final-result">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Kolom Kiri */}
        <div className="space-y-6">
          <Block title={`Identitas Debitur (${(r.bank_name || "Bank").toUpperCase()})`} accent="#351080">
            <Row k="Nama Debitur" v={r.name} />
            <Row k="Mitra Perbankan" v={r.bank_name} />
            <Row k="Kategori Produk" v={r.category} strong testid="result-category" />
            <Row k="Tanggal Proses" v={fmtDate(r.process_date)} />
            <Row k="Usia Saat Proses" v={`${r.age} tahun`} />
          </Block>

          <Block title="Parameter Pengajuan Kredit Bank" accent="#F28A19">
            <Row k="Plafond Kredit" v={rp(r.plafond)} strong testid="result-plafond" />
            <Row k="Tenor Kredit" v={`${r.tenor} bulan`} />
            <Row k="Suku Bunga Kredit" v={`${pct(r.bank_rate)} per tahun`} strong />
            <Row k="Gaji Pensiun Bulanan" v={rp(r.salary)} />
            <Row k="Nilai Take Over" v={rp(r.take_over)} />
          </Block>

          <Block title="Rincian Angsuran Kredit" accent="#5720B8">
            <Row k="Angsuran Kredit per Bulan" v={rp(r.coop_installment)} strong testid="result-coop-installment" />
            <Row k="DSR Angsuran Aktual" v={pct(r.ratio_pct)} testid="result-ratio" />
          </Block>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-6">
          <Block title="Rincian Biaya Kredit Bank" accent="#5720B8">
            <Row k={`Biaya Provisi (${pct(r.proaq_pct)})`} v={rp(r.proaq)} testid="result-proaq" />
            <Row k={`Biaya Asuransi Jiwa (${pct(r.risk_pct)})`} v={rp(r.risk)} testid="result-risk" />
            <Row k="Biaya Administrasi Bank" v={rp(r.admin_fee)} testid="result-admin" />
            <Row k="Total Biaya Kredit" v={rp(r.total_fees)} strong testid="result-total-fees" />
          </Block>

          <Block title="Rincian Pengurang Pencairan" accent="#F28A19">
            <Row k="Total Biaya Kredit" v={rp(r.total_fees)} />
            <Row k="Nilai Take Over (TO)" v={rp(r.take_over)} />
            <Row k={`Blokir / Retensi Angsuran (${r.retention_multiplier || 2}×)`} v={rp(r.retention)} strong testid="result-retention" />
          </Block>

          <ValidationList validations={r.validations} />
        </div>
      </div>

      {/* Bottom Summary Banner */}
      <div className="grid gap-px overflow-hidden rounded-xl bg-[#17223B] sm:grid-cols-2">
        <div className="p-4 sm:p-5 text-white">
          <p className="text-xs text-white/70 font-medium">Hasil Pencairan — Sisa Pencairan Bersih</p>
          <p className="mt-1 font-display text-2xl sm:text-3xl font-bold lp-num truncate" data-testid="result-net">
            {rp(r.net_disbursement)}
          </p>
        </div>
        <div className="p-4 sm:p-5 text-white sm:border-l sm:border-white/15">
          <p className="text-xs text-white/70 font-medium">Sisa Gaji setelah Angsuran</p>
          <p className="mt-1 font-display text-2xl sm:text-3xl font-bold lp-num truncate" data-testid="result-remaining-salary">
            {rp(r.remaining_salary)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DISPATCHER: Menampilkan UI & Terminologi sesuai Bank masing-masing
// ============================================================================
export default function ResultView(props) {
  const bankKey = props.r?.bank_key;
  if (bankKey === "bsi_prapen" || !!props.r?.bsi_details) {
    return <BsiResultView {...props} />;
  }
  if (bankKey === "ams2") {
    return <Ams2ResultView {...props} />;
  }
  return <ConventionalBankResultView {...props} />;
}
