import { memo } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { rp, pct, fmtDate } from "../../lib/format";
import { PartnerLogo } from "../brand/Logo";

function fmtExcelInt(n) {
  const v = Math.round(Number(n || 0));
  const sign = v < 0 ? "-" : "";
  return sign + Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtExcelDec2(n, dashIfZero = false) {
  const num = Number(n || 0);
  if (dashIfZero && Math.abs(num) < 0.005) return "-";
  const sign = num < 0 ? "-" : "";
  const fixed = Math.abs(num).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${intFormatted},${decPart}`;
}

const Row = ({ k, v, strong, testid }) => (
  <div className="flex items-start justify-between gap-2 px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm odd:bg-[#F5F6FA] min-w-0">
    <span className="text-slate-500 min-w-0 break-words flex-1">{k}</span>
    <span
      className={`lp-num text-right font-semibold break-words max-w-[58%] sm:max-w-[62%] ${
        strong ? "text-[#351080]" : "text-[#17223B]"
      }`}
      data-testid={testid}
    >
      {v}
    </span>
  </div>
);

const Block = ({ title, accent, children }) => (
  <div className="min-w-0 max-w-full">
    <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#351080]">
      <span className="h-3 w-[3px] shrink-0 rounded" style={{ background: accent }} />
      <span className="break-words">{title}</span>
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
// 1. BSI MITRAGUNA PRIMA+ PRAPENSIUN (Tampilan Profesional Keuangan Modern)
// ============================================================================
export function BsiResultView({ r }) {
  const bsi = r.bsi_details || {};
  const sisaGajiPensiun = bsi.sisa_gaji_pensiun ?? (r.pension_salary - r.coop_installment);
  const simas = bsi.simas || {};
  const isTriBerkah = bsi.sub_product === "PP3";
  const productHeaderTitle = isTriBerkah ? "PRA PENSIUN TRI BERKAH" : "PRA PENSIUN DEKADE BERKAH";
  const blokirActiveCnt = bsi.blokir_active_count ?? (isTriBerkah ? (bsi.active_months || 1) : 1);
  const blokirPensionCnt = bsi.blokir_pension_count ?? 2;
  const schedulePreview = Array.isArray(bsi.schedule_preview) ? bsi.schedule_preview : [];

  const angsAktifExact = bsi.active_installment_exact ?? bsi.active_installment ?? r.bank_installment ?? 0;
  const angsPensiunExact = bsi.pension_installment_exact ?? bsi.pension_installment ?? r.coop_installment ?? 0;
  const biayaAdmExact = bsi.biaya_adm_exact ?? r.proaq ?? 0;
  const biayaAsuransiExact = bsi.biaya_asuransi_exact ?? (bsi.is_atribusi ? 0 : (r.risk ?? 0));
  const biayaMateraiExact = bsi.biaya_materai_exact ?? r.admin_fee ?? 100000;
  const blokirAktifExact = bsi.blokir_aktif_exact ?? (angsAktifExact * blokirActiveCnt);
  const blokirPensiunExact = bsi.blokir_pensiun_exact ?? (angsPensiunExact * blokirPensionCnt);
  const bukaBlokirLamaExact = bsi.buka_blokir_lama_exact ?? bsi.buka_blokir_lama ?? r.buka_blokir_lama ?? 0;
  const pelunasanLamaExact = bsi.pelunasan_lama_exact ?? bsi.pelunasan_lama ?? r.take_over ?? 0;
  const terimaBersihExact =
    bsi.sisa_pencairan_bersih_exact ??
    (Number(r.plafond || 0) -
      biayaAdmExact -
      biayaAsuransiExact -
      biayaMateraiExact -
      blokirAktifExact -
      blokirPensiunExact +
      bukaBlokirLamaExact -
      pelunasanLamaExact);

  const statementRows = [
    { type: "text", label: "Nama Nasabah", val: String(r.name || "-").toUpperCase() },
    { type: "num", label: "Plafond", val: fmtExcelInt(r.plafond), boldVal: true, highlight: true },
    { type: "num", label: "Jangka Waktu", val: `${r.tenor || 0} Bulan` },
    { type: "divider" },
    { type: "num", label: "Angsuran saat Aktif PNS", val: fmtExcelDec2(angsAktifExact), boldVal: true },
    { type: "num", label: "Angsuran saat Pensiun", val: fmtExcelDec2(angsPensiunExact), boldVal: true },
    { type: "section", label: "Biaya" },
    { type: "num", label: `Administrasi (${r.proaq_pct ?? 1}%)`, val: fmtExcelDec2(biayaAdmExact) },
    { type: "num", label: "Asuransi", val: fmtExcelDec2(biayaAsuransiExact, true) },
    { type: "num", label: "Materai", val: fmtExcelDec2(biayaMateraiExact) },
    { type: "section", label: "Blokir Angsuran" },
    { type: "num", label: `Blokir ${blokirActiveCnt}x Angs Masa Aktif`, val: fmtExcelDec2(blokirAktifExact) },
    { type: "num", label: `Blokir ${blokirPensionCnt}x Angs Masa Pensiun`, val: fmtExcelDec2(blokirPensiunExact) },
    { type: "divider" },
    { type: "num", label: "Buka Blokir Yang Lama", val: fmtExcelDec2(bukaBlokirLamaExact, true) },
    { type: "num", label: "Pelunasan Yang Lama", val: fmtExcelDec2(pelunasanLamaExact, true) }
  ];

  return (
    <div className="space-y-6 min-w-0 max-w-full" data-testid="final-result">
      {/* Header Identitas Resmi BSI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <PartnerLogo bankKey="bsi_prapen" size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base sm:text-lg font-bold text-[#17223B]">
                BANK SYARIAH INDONESIA (BSI)
              </h3>
              <span className="rounded-full bg-[#078D67]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#078D67]">
                {isTriBerkah ? "Tri Berkah (PP3)" : "Dekade Berkah (PP10)"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Ringkasan Eksekutif Pembiayaan Mitraguna Prapensiun &amp; Estimasi Pencairan Nasabah
            </p>
          </div>
        </div>
        <div className="sm:self-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              r.overall_ok ? "bg-[#078D67]/10 text-[#078D67]" : "bg-amber-100 text-amber-800"
            }`}
          >
            {r.overall_ok ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Memenuhi Kriteria Akseptasi
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5" /> Periksa Ketentuan Akseptasi
              </>
            )}
          </span>
        </div>
      </div>

      {/* KARTU RINGKASAN FINANSIAL MODERN NASABAH */}
      <div className="mx-auto w-full max-w-xl">
        <div
          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
          data-testid="bsi-excel-summary-table"
        >
          {/* Executive Banking Header */}
          <div className="bg-gradient-to-r from-[#065F46] via-[#078D67] to-[#0D9488] px-4 py-3.5 sm:px-6 sm:py-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/90">
                  RINGKASAN PEMBIAYAAN NASABAH
                </p>
                <h4 className="mt-0.5 font-display text-base sm:text-lg font-extrabold tracking-tight text-white">
                  {productHeaderTitle}
                </h4>
              </div>
              <span className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-amber-200">
                Akad {bsi.akad || "MMQ"}
              </span>
            </div>
          </div>

          {/* Statement Rows */}
          <div className="divide-y divide-slate-100 px-4 py-2 sm:px-6">
            {statementRows.map((row, idx) => {
              if (row.type === "divider") {
                return <div key={idx} className="h-2 bg-slate-50/70 -mx-4 sm:-mx-6 border-y border-slate-100" />;
              }
              if (row.type === "section") {
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-slate-50/90 -mx-4 px-4 py-2 sm:-mx-6 sm:px-6"
                  >
                    <span className="h-3.5 w-1 rounded-full bg-[#078D67]" />
                    <span className="font-display text-xs font-extrabold uppercase tracking-wider text-[#17223B]">
                      {row.label}
                    </span>
                  </div>
                );
              }
              if (row.type === "text") {
                return (
                  <div key={idx} className="flex items-center justify-between gap-3 py-2.5 text-xs sm:text-sm">
                    <span className="font-medium text-slate-600">{row.label}</span>
                    <span className="font-display font-bold text-[#17223B] text-right break-words">
                      {row.val}
                    </span>
                  </div>
                );
              }
              const isDash = row.val === "-";
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between gap-3 py-2.5 text-xs sm:text-sm ${
                    row.highlight ? "bg-emerald-50/40 -mx-4 px-4 sm:-mx-6 sm:px-6" : ""
                  }`}
                >
                  <span className={row.boldVal ? "font-semibold text-[#17223B]" : "text-slate-600"}>
                    {row.label}
                  </span>
                  <span
                    className={`lp-num text-right ${
                      isDash
                        ? "text-slate-400 font-medium pr-3"
                        : row.highlight
                        ? "font-display text-sm sm:text-base font-extrabold text-[#078D67]"
                        : row.boldVal
                        ? "font-bold text-[#17223B]"
                        : "font-semibold text-slate-800"
                    }`}
                  >
                    {row.val}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Executive Highlight Footer: Terima Bersih */}
          <div className="border-t-2 border-[#078D67]/20 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-amber-50/70 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block font-display text-sm sm:text-base font-extrabold text-[#17223B]">
                  Terima Bersih
                </span>
                <span className="block text-[11px] font-medium text-slate-500">
                  Estimasi Dana Cair Bersih Diterima Nasabah
                </span>
              </div>
              <span
                className="font-display text-lg sm:text-2xl font-extrabold text-[#078D67] lp-num"
                data-testid="bsi-excel-terima-bersih"
              >
                {fmtExcelDec2(terimaBersihExact)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ringkasan Cepat 4 Indikator Utama */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 min-w-0">
          <p className="text-[11px] font-semibold text-emerald-800">Angsuran Aktif ({bsi.active_months || 0} bln)</p>
          <p className="mt-1 font-display text-sm sm:text-base font-extrabold text-[#078D67] lp-num break-words" data-testid="result-bank-installment">
            {rp(bsi.active_installment || r.bank_installment)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            DBR: <b>{pct(r.ratio_pct)}</b> (Maks {bsi.dbr_active_rate || 70}%)
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 min-w-0">
          <p className="text-[11px] font-semibold text-amber-900">Sisa Pokok Saat Pensiun</p>
          <p className="mt-1 font-display text-sm sm:text-base font-extrabold text-amber-800 lp-num break-words" data-testid="result-sisa-os-pensiun">
            {rp(bsi.sisa_os_saat_pensiun || 0)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Akhir bulan ke-{bsi.active_months || 0}
          </p>
        </div>

        <div className="rounded-xl border border-purple-200/80 bg-purple-50/60 p-3 min-w-0">
          <p className="text-[11px] font-semibold text-[#351080]">Angsuran Pensiun ({bsi.pension_months || 0} bln)</p>
          <p className="mt-1 font-display text-sm sm:text-base font-extrabold text-[#351080] lp-num break-words" data-testid="result-coop-installment">
            {rp(bsi.pension_installment || r.coop_installment)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            DSR: <b>{pct(r.ratio_pension_pct || 0)}</b> (Maks 90%)
          </p>
        </div>

        <div className="rounded-xl border border-teal-200/80 bg-teal-50/60 p-3 min-w-0">
          <p className="text-[11px] font-semibold text-teal-900">Proteksi Asuransi ({simas.tarif_permil ?? simas.rate_permil ?? 0} ‰)</p>
          <p className="mt-1 font-display text-sm sm:text-base font-extrabold text-teal-800 lp-num break-words" data-testid="result-risk">
            {rp(bsi.premi_asuransi_tertanggung || simas.total_kontribusi || simas.premium || 0)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {bsi.is_atribusi ? `Atribusi Margin` : "Potong Pencairan"}
          </p>
        </div>
      </div>

      {/* Bottom Summary Banner */}
      <div className="grid gap-px overflow-hidden rounded-xl bg-gradient-to-r from-[#065F46] to-[#078D67] sm:grid-cols-3 shadow-xs">
        <div className="p-3.5 sm:p-5 text-white min-w-0">
          <p className="text-xs text-white/75 font-medium">Terima Bersih Nasabah</p>
          <p className="mt-1 font-display text-xl sm:text-2xl font-bold lp-num break-words" data-testid="result-net">
            Rp {fmtExcelDec2(terimaBersihExact)}
          </p>
        </div>
        <div className="p-3.5 sm:p-5 text-white sm:border-l sm:border-white/15 min-w-0">
          <p className="text-xs text-white/75 font-medium">Sisa Gaji Masa Pensiun</p>
          <p className="mt-1 font-display text-xl sm:text-2xl font-bold lp-num break-words" data-testid="result-sisa-pensiun">
            {rp(sisaGajiPensiun)}
          </p>
        </div>
        <div className="p-3.5 sm:p-5 text-white sm:border-l sm:border-white/15 min-w-0">
          <p className="text-xs text-white/75 font-medium">Sisa Gaji Masa Aktif</p>
          <p className="mt-1 font-display text-xl sm:text-2xl font-bold lp-num break-words" data-testid="result-remaining-salary">
            {rp(r.remaining_salary)}
          </p>
        </div>
      </div>

      {/* Collapsible Rincian Teknis Akseptasi, Asuransi & Jadwal Amortisasi */}
      <details className="group rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-xs sm:text-sm font-bold text-[#17223B] hover:bg-slate-100/80">
          <span>Lihat Rincian Parameter Pembiayaan, Proteksi Asuransi &amp; Jadwal Amortisasi</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="space-y-6 border-t border-slate-200 bg-white p-3.5 sm:p-5">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Kolom Kiri */}
            <div className="space-y-6 min-w-0">
              <Block title="1. Identitas & Akseptasi Debitur" accent="#078D67">
                <Row k="Nama Calon Debitur" v={r.name || "-"} />
                <Row k="Tanggal Lahir" v={fmtDate(r.birth_date)} />
                <Row k="Usia Saat Ini" v={bsi.age_exact_text || `${r.age} Tahun`} strong />
                <Row k="Usia Pertanggungan Asuransi" v={`${bsi.nearest_age ?? r.age} Tahun`} />
                {bsi.nip && <Row k="NIP Calon Debitur" v={bsi.nip} testid="bsi-result-nip" />}
                <Row k="Tipe Produk" v={bsi.sub_product_label || "Dekade Berkah (Prapen 10 Tahun)"} strong testid="bsi-result-sub-product" />
                <Row k="Status Payroll" v={`${bsi.status_gaji_label || "Payroll"} (DBR Maks ${bsi.dbr_active_rate || 70}%)`} strong testid="bsi-result-status-gaji" />
                {bsi.tmt_bekerja && <Row k="TMT Bekerja" v={fmtDate(bsi.tmt_bekerja)} />}
                <Row k="TMT Pensiun / BUP" v={`Tahun ${bsi.bup_year || "-"} (BUP ${bsi.bup_age || 58} Thn • Sisa ${bsi.actual_months_to_bup ?? bsi.active_months ?? 0} bln)`} />
                <Row k="Total Penghasilan Aktif Diakui" v={rp(r.salary)} strong />
                {bsi.tht > 0 && <Row k="THT (Diakui 75%)" v={`${rp(bsi.tht)} (Diakui ${rp(bsi.tht_recognized || Math.round(bsi.tht * 0.75))})`} />}
                <Row k="Manfaat Pensiun (DSR Maks 90%)" v={`${rp(r.pension_salary)} (Maks Angs ${rp(bsi.max_installment_pension || Math.floor((r.pension_salary || 0) * 0.9))})`} />
                <Row k="Kategori & Akad" v={r.category} testid="result-category" />
              </Block>

              <Block title="2. Parameter Pembiayaan, Pricing & Jadwal" accent="#F28A19">
                <Row k="Plafond Pra Pensiun" v={rp(r.plafond)} strong testid="result-plafond" />
                {bsi.max_plafond_at_tenor > 0 && (
                  <Row k="Kapasitas Plafond Maksimal" v={rp(bsi.max_plafond_at_tenor)} />
                )}
                <Row k="Tenor Total" v={`${r.tenor} bulan (${bsi.active_months || 0} bln Aktif + ${bsi.pension_months || 0} bln Pensiun)`} strong />
                <Row k="Margin Saat Aktif (Base -> +Atrib)" v={`${pct(bsi.base_rate_aktif ?? r.bank_rate)} -> ${pct(bsi.price_atrib_aktif_pct ?? r.bank_rate)} p.a.`} strong />
                <Row k="Margin Saat Pensiun (Base -> +Atrib)" v={`${pct(bsi.base_rate_pensiun ?? r.coop_rate)} -> ${pct(bsi.price_atrib_pensiun_pct ?? r.coop_rate)} p.a.`} strong />
                {bsi.proyeksi_cair && <Row k="Proyeksi Pencairan" v={fmtDate(bsi.proyeksi_cair)} />}
                {bsi.start_angsuran && <Row k="Mulai Angsuran" v={fmtDate(bsi.start_angsuran)} />}
                {bsi.selesai_angsuran && (
                  <Row
                    k="Jatuh Tempo Pembiayaan"
                    v={`${fmtDate(bsi.selesai_angsuran)}${bsi.end_loan_age_text ? ` (${bsi.end_loan_age_text})` : ""}`}
                  />
                )}
                {bsi.taksasi_mmq > 0 && <Row k="Nilai Taksasi Aset MMQ" v={rp(bsi.taksasi_mmq)} />}
              </Block>

              <Block title="3. Rincian Angsuran & Saldo Transisi" accent="#5720B8">
                <Row k="Angsuran Masa Aktif" v={`Rp ${fmtExcelDec2(angsAktifExact)}`} strong />
                <Row k={`DBR Masa Aktif (Maks ${bsi.dbr_active_rate || 70}%)`} v={pct(r.ratio_pct)} testid="result-ratio" />
                <Row k="Sisa Pokok Saat Pensiun (Transisi)" v={rp(bsi.sisa_os_saat_pensiun || 0)} strong />
                <Row k="Angsuran Masa Pensiun" v={`Rp ${fmtExcelDec2(angsPensiunExact)}`} strong />
                <Row k={`DSR Masa Pensiun (Maks ${bsi.dsr_pension_rate || 90}%)`} v={pct(r.ratio_pension_pct || 0)} testid="result-ratio-pension" />
                <Row k="Sisa Gaji Masa Aktif" v={rp(r.remaining_salary)} />
                <Row k="Sisa Gaji Masa Pensiun" v={rp(sisaGajiPensiun)} strong testid="result-sisa-gaji-pensiun" />
              </Block>
            </div>

            {/* Kolom Kanan */}
            <div className="space-y-6 min-w-0">
              <Block title="4. Rincian Proteksi Asuransi Jiwa Syariah" accent="#078D67">
                <Row k="Lembaga Penjaminan" v="Asuransi Jiwa Pembiayaan Syariah" />
                <Row k="Usia Masuk Pertanggungan" v={`${simas.nearest_age ?? simas.entry_age ?? r.age} tahun`} />
                <Row
                  k="Masa Pertanggungan (+6 Bln Buffer)"
                  v={`${simas.insurance_months || (r.tenor + 6)} bln (${simas.ins_years ?? Math.floor((r.tenor + 6) / 12)} thn ${simas.ins_rem_months ?? ((r.tenor + 6) % 12)} bln)`}
                />
                <Row k="Usia Akhir Pertanggungan" v={`${simas.end_coverage_age ?? "-"} tahun (Maks 75 thn)`} />
                <Row k="Tarif Kontribusi Asuransi" v={`${simas.tarif_permil ?? simas.rate_permil ?? 0} ‰ (per mil)`} strong />
                <Row k="Nilai Santunan Pertanggungan" v={rp(simas.santunan_setelah_atribusi || r.plafond)} strong />
                <Row k="Batas Maksimal UP Usia Ini" v={rp(simas.max_up_allowed || 1000000000)} />
                <Row k="Total Kontribusi / Premi" v={rp(bsi.premi_asuransi_tertanggung || simas.total_kontribusi || simas.premium || 0)} strong />
                <Row k="Status Underwriting Medis" v={simas.medical_status || "Non Medical Check Up"} strong />
                <Row k="Skema Pembayaran Premi" v={bsi.is_atribusi ? "Atribusi Asuransi (Masuk Margin)" : "Non-Atribusi (Potong Pencairan)"} />
              </Block>

              <Block title="5. Rincian ke Nasabah (Biaya, Blokir & Pencairan)" accent="#F28A19">
                <Row k={`Biaya Administrasi (${pct(r.proaq_pct)})`} v={`Rp ${fmtExcelDec2(biayaAdmExact)}`} testid="result-proaq" />
                <Row k="Biaya Asuransi Dipotong Tunai" v={bsi.is_atribusi ? "Rp0 (Skema Atribusi)" : `Rp ${fmtExcelDec2(biayaAsuransiExact)}`} />
                <Row k="Biaya Materai" v={`Rp ${fmtExcelDec2(biayaMateraiExact)}`} testid="result-admin" />
                <Row k="Total Biaya Pembiayaan" v={rp(r.total_fees)} strong testid="result-total-fees" />
                <Row
                  k={`Blokir Angsuran Aktif (${blokirActiveCnt}×)`}
                  v={`Rp ${fmtExcelDec2(blokirAktifExact)}`}
                />
                <Row
                  k={`Blokir Angsuran Pensiun (${blokirPensionCnt}×)`}
                  v={`Rp ${fmtExcelDec2(blokirPensiunExact)}`}
                />
                <Row k="Total Blokir Angsuran" v={rp(r.retention)} strong testid="result-retention" />
                <Row k="Pelunasan Yang Lama / Take Over (-)" v={rp(bsi.pelunasan_lama ?? r.take_over ?? 0)} />
                <Row k="Buka Blokir Yang Lama (+)" v={rp(bsi.buka_blokir_lama ?? r.buka_blokir_lama ?? 0)} strong />
                <Row k="Terima Bersih ke Nasabah" v={`Rp ${fmtExcelDec2(terimaBersihExact)}`} strong />
              </Block>

              <ValidationList validations={r.validations} />
            </div>
          </div>

          {/* Ringkasan Jadwal Amortisasi Transisi Aktif ke Pensiun */}
          {schedulePreview.length > 0 && (
            <Block title="6. Preview Jadwal Amortisasi Pokok & Margin (Masa Aktif -> Masa Pensiun)" accent="#351080">
              <div className="overflow-x-auto max-w-full">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-100">
                    <tr>
                      <th className="px-3 py-2">Bln</th>
                      <th className="px-3 py-2">Fase</th>
                      <th className="px-3 py-2 text-right">OS Awal</th>
                      <th className="px-3 py-2 text-right">Pokok</th>
                      <th className="px-3 py-2 text-right">Margin/Ujrah</th>
                      <th className="px-3 py-2 text-right">Angsuran</th>
                      <th className="px-3 py-2 text-right">OS Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedulePreview.map((row) => (
                      <tr
                        key={row.month}
                        className={
                          row.month === bsi.active_months
                            ? "bg-amber-50/70 font-semibold text-amber-900"
                            : row.phase === "Masa Pensiun"
                            ? "bg-purple-50/30"
                            : ""
                        }
                      >
                        <td className="px-3 py-2 font-mono font-semibold">#{row.month}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              row.phase === "Masa Aktif"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-purple-100 text-[#351080]"
                            }`}
                          >
                            {row.phase}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right lp-num">{rp(row.openingOs)}</td>
                        <td className="px-3 py-2 text-right lp-num">{rp(row.principalPayment)}</td>
                        <td className="px-3 py-2 text-right lp-num">{rp(row.marginPayment)}</td>
                        <td className="px-3 py-2 text-right lp-num font-semibold">{rp(row.totalInstallment)}</td>
                        <td className="px-3 py-2 text-right lp-num font-bold">{rp(row.closingOs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Block>
          )}
        </div>
      </details>
    </div>
  );
}

function fmtDateLongId(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(`${String(isoStr).slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return isoStr;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

// ============================================================================
// 2. KOPERASI ASIA MADANI SEJAHTERA — SIMULASI AMS V2
// ============================================================================
export function Ams2ResultView({ r }) {
  const ams = r.ams2_details || {};
  const catLabel = ams.category_label || r.category || "—";
  const pengajuanLabel = ams.takeover_label || (Number(r.take_over || 0) > 0 ? "Take Over" : "Non Take Over");
  const picName = ams.pic || "MUHAMMAD TEGUH PRANADA";
  const smName = ams.sales_manager || "—";
  const mktName = ams.marketing || "—";

  const costRows = [
    { label: "Biaya Provisi dan Akuisisi", val: rp(r.proaq), testid: "result-proaq" },
    { label: "Cadangan Risiko", val: rp(r.risk), testid: "result-risk" },
    { label: "Administrasi", val: rp(r.admin_fee), testid: "result-admin" },
    { label: "TOTAL BIAYA KREDIT", val: rp(r.total_fees), highlight: true, testid: "result-total-fees" },
    { label: "Take Over", val: rp(r.take_over || 0) },
    { label: "Retensi (3 x angsuran koperasi)", val: rp(r.retention), testid: "result-retention" }
  ];

  return (
    <div className="space-y-5" data-testid="final-result">
      {/* Header Banner Resmi Koperasi Asia Madani Sejahtera */}
      <div className="relative overflow-hidden rounded-2xl bg-[#12264D] text-white shadow-lg border border-[#1E3A70]">
        <div className="absolute inset-y-0 left-0 w-2.5 bg-[#A659B8]" />
        <div className="absolute inset-y-0 left-2.5 w-1.5 bg-[#FF8F1F]" />
        <div className="pl-7 pr-5 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="rounded-xl bg-white p-1.5 shadow-sm shrink-0">
              <PartnerLogo bankKey="ams2" size="lg" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-purple-200">
                KOPERASI ASIA MADANI SEJAHTERA
              </p>
              <h3 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-white">
                RINCIAN SIMULASI KREDIT
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                AMS2 CREDIT CALCULATOR &nbsp;|&nbsp; TANGGAL: {fmtDateLongId(r.process_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:self-center">
            <span className="inline-flex flex-col items-center justify-center rounded-lg bg-[#A659B8] px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
              <span>DOKUMEN</span>
              <span>SIMULASI</span>
            </span>
          </div>
        </div>
      </div>

      {/* 01 INFORMASI DEBITUR */}
      <div className="rounded-2xl border border-[#DCC7E0] bg-[#F5EBF7]/75 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#8C3D9C]">
            01 &nbsp;INFORMASI DEBITUR
          </p>
          {ams.rec_max_plafond > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 border border-[#DCC7E0] px-3 py-0.5 text-[11px] font-semibold text-[#5A2D68]">
              Rekomendasi Maks: <strong className="lp-num">{rp(ams.rec_max_plafond)}</strong> ({ams.rec_max_tenor || r.tenor} bln)
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-extrabold text-slate-900">
              Nama: {r.name || "—"}
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              Tanggal lahir: <strong className="text-slate-800">{fmtDateLongId(r.birth_date)}</strong>
              {" "}&nbsp;|&nbsp;{" "}
              Usia: <strong className="text-slate-800">{r.age} tahun</strong>
              {" "}&nbsp;|&nbsp;{" "}
              Kategori:{" "}
              <strong className="text-[#8C3D9C]" data-testid="result-category">
                {catLabel}
              </strong>
            </p>
          </div>
          <div className="space-y-1 sm:text-right">
            <p className="text-sm sm:text-base font-extrabold text-slate-900 lp-num">
              Gaji: {rp(r.salary)}
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              Pengajuan: <strong className="text-slate-800">{pengajuanLabel}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* PRIMARY SUMMARY BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-[#12264D] text-white shadow-md">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[#FF8F1F]" />
        <div className="grid gap-4 sm:grid-cols-2 p-5 pl-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              ESTIMASI PENCAIRAN BERSIH
            </p>
            <p
              className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white lp-num truncate"
              data-testid="result-net"
            >
              {rp(r.net_disbursement)}
            </p>
          </div>
          <div className="sm:border-l sm:border-white/15 sm:pl-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              ANGSURAN KOPERASI / BULAN
            </p>
            <p
              className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-amber-300 lp-num truncate"
              data-testid="result-coop-installment"
            >
              {rp(r.coop_installment)}
            </p>
          </div>
        </div>
      </div>

      {/* 3 MINI CARDS: PLAFON KREDIT, TENOR, SISA GAJI / BULAN */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-[#EDF5FC] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            PLAFON KREDIT
          </p>
          <p className="mt-1 font-display text-lg font-extrabold text-slate-900 lp-num" data-testid="result-plafond">
            {rp(r.plafond)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-[#EDF5FC] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            TENOR
          </p>
          <p className="mt-1 font-display text-lg font-extrabold text-slate-900 lp-num">
            {r.tenor ? `${r.tenor} bulan` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-[#EDF5FC] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            SISA GAJI / BULAN
          </p>
          <p
            className="mt-1 font-display text-lg font-extrabold text-emerald-700 lp-num"
            data-testid="result-remaining-salary"
          >
            {rp(r.remaining_salary)}
          </p>
        </div>
      </div>

      {/* 02 RINCIAN BIAYA & POTONGAN */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between bg-[#A659B8] px-4 sm:px-5 py-2.5 text-white">
          <span className="text-xs font-extrabold uppercase tracking-wider">
            02 &nbsp;RINCIAN BIAYA &amp; POTONGAN
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-wider">
            NOMINAL (IDR)
          </span>
        </div>
        <div className="divide-y divide-slate-200/80">
          {costRows.map((row, idx) => (
            <div
              key={row.label}
              className={`flex items-center justify-between px-4 sm:px-5 py-3 text-sm ${
                row.highlight
                  ? "bg-[#F5EBF7] font-extrabold text-[#8C3D9C]"
                  : idx % 2 === 0
                  ? "bg-slate-50/60 text-slate-800"
                  : "bg-white text-slate-800"
              }`}
            >
              <span>{row.label}</span>
              <span
                className={`lp-num ${row.highlight ? "font-extrabold text-[#8C3D9C]" : "font-bold text-slate-900"}`}
                data-testid={row.testid}
              >
                {row.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 03 VALIDASI SIMULASI */}
      <ValidationList validations={r.validations} />

      {/* PERNYATAAN NASABAH & PETUGAS */}
      <div className="relative overflow-hidden rounded-xl border border-[#DCC7E0] bg-[#F5EBF7]/75 p-4 pl-5">
        <div className="absolute inset-y-0 left-0 w-1 bg-[#FF8F1F]" />
        <p className="text-xs font-extrabold uppercase tracking-wider text-[#8C3D9C]">
          PERNYATAAN NASABAH
        </p>
        <p className="mt-1 text-xs text-slate-700 leading-relaxed">
          Saya telah menerima penjelasan simulasi dan memahami bahwa hasil ini merupakan estimasi, bukan persetujuan kredit final.
        </p>
        <div className="mt-3 pt-2.5 border-t border-[#DCC7E0]/70 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-600">
          <span>
            PIC Koperasi: <strong className="text-slate-900">{picName}</strong>
          </span>
          <span>
            Sales Manager: <strong className="text-slate-900">{smName}</strong>
          </span>
          <span>
            Marketing: <strong className="text-slate-900">{mktName}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. CALC CAPITAL — PS3 CAPITAL (DASA CIPTA BERKARYA)
// ============================================================================

export function CapitalResultView({ r }) {
  const cap = r.capital_details || {};
  const isPensiun = cap.product === "pensiun";
  const tmtIso = cap.tmt_pensiun_date || cap.tmt_date || "";
  const warnings = cap.warnings || [];
  const hasWarnings = warnings.length > 0;
  const numFmt = (n) => Number(n || 0).toLocaleString("id-ID");
  const maxTenorVal = cap.max_credit_months || cap.credit_months || r.tenor || 0;
  const reqTenorVal = cap.credit_months ?? r.tenor ?? 0;

  return (
    <div className="space-y-6" data-testid="final-result">
      {/* Header Identitas Resmi DASA CIPTA BERKARYA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <PartnerLogo bankKey="bank_capital" size="lg" />
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-[#17223B]">
              DASA CIPTA BERKARYA PEMATANGSIANTAR
            </h3>
            <p className="text-xs text-slate-500">
              Bank Capital Indonesia • Simulasi Pembiayaan {cap.product_label || (isPensiun ? "Pensiun" : "Pra Pensiun")}
            </p>
          </div>
        </div>
        <div className="text-right sm:self-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              hasWarnings
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
            data-testid="capital-result-status"
          >
            {hasWarnings ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" /> Periksa Catatan Validasi
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Simulasi Valid Sesuai Parameter
              </>
            )}
          </span>
        </div>
      </div>

      {/* HIGHLIGHT POINT: PLAFON, TENOR, SISA BERSIH, SISA GAJI */}
      <div className="overflow-hidden rounded-2xl border border-[#07887E]/25 bg-gradient-to-r from-[#123D39] via-[#0E5953] to-[#07887E] p-4 sm:p-5 text-white shadow-sm">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9de6dc]">
          Highlight Point Hasil Simulasi
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/15 bg-white/10 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/75">PLAFON</p>
            <p className="mt-1 font-display text-lg sm:text-xl font-extrabold text-white lp-num" data-testid="result-plafond">
              {rp(cap.loan ?? r.plafond)}
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/75">TENOR</p>
            <p className="mt-1 font-display text-lg sm:text-xl font-extrabold text-white lp-num">
              {numFmt(reqTenorVal)} Bulan
            </p>
          </div>
          <div className="rounded-xl border border-[#B9FFF5]/30 bg-white/15 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#B9FFF5]">SISA BERSIH</p>
            <p className="mt-1 font-display text-lg sm:text-xl font-extrabold text-[#B9FFF5] lp-num" data-testid="result-net">
              {rp(cap.net_cash ?? r.net_disbursement)}
            </p>
          </div>
          <div className="rounded-xl border border-[#B9FFF5]/30 bg-white/15 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#B9FFF5]">SISA GAJI</p>
            <p className="mt-1 font-display text-lg sm:text-xl font-extrabold text-white lp-num" data-testid="result-remaining-salary">
              {rp(cap.salary_left ?? r.remaining_salary)}
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Architecture */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Kolom Kiri */}
        <div className="space-y-6">
          <Block title="Informasi Debitur" accent="#07887E">
            <Row k="Nama Debitur" v={r.name || "—"} testid="capital-res-name" />
            <Row k="Tanggal Lahir" v={fmtDateLongId(cap.birth_date || r.birth_date)} />
            <Row k="Gaji Bulanan" v={rp(r.salary)} />
            <Row k="Produk Kredit" v={cap.product_label || (isPensiun ? "Pensiun" : "Pra Pensiun")} strong testid="result-category" />
            {!isPensiun && tmtIso && <Row k="TMT Pensiun" v={fmtDateLongId(tmtIso)} />}
            <Row k="Tanggal Proses" v={fmtDateLongId(cap.process_date || r.process_date)} />
          </Block>

          <Block title="Rincian Tenor" accent="#F28A19">
            <Row k="Batas Usia Kredit" v={fmtDateLongId(cap.age_limit_date)} />
            <Row k="Tenor Kredit Maksimal" v={`${numFmt(maxTenorVal)} bulan`} strong />
            {!isPensiun && <Row k="Tenor PP" v={`${numFmt(cap.pp_months ?? 0)} bulan`} />}
            <Row k="Tenor Diajukan" v={`${numFmt(reqTenorVal)} bulan`} strong />
          </Block>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-6">
          <Block title="Hasil Simulasi" accent="#07887E">
            <Row k="Batas Angsuran Maksimal (90%)" v={rp(cap.payment_cap ?? Math.round((r.salary || 0) * 0.9))} />
            <Row k="Angsuran Aktual" v={rp(cap.actual_payment ?? r.coop_installment)} strong testid="result-coop-installment" />
            <Row k="Plafon Maksimal" v={rp(cap.max_loan_pv ?? cap.recommendation_max_loan ?? r.plafond)} strong />
            <Row k="Plafon Diajukan" v={rp(cap.loan ?? r.plafond)} strong />
            <Row k="Biaya Kredit" v={rp(cap.cost ?? r.total_fees)} strong testid="result-total-fees" />
            <Row k={isPensiun ? "Total Retensi (2x Angsuran)" : "Total Retensi"} v={rp(cap.total_retention ?? r.retention)} strong testid="result-retention" />
            <Row k="Sisa Bersih" v={rp(cap.net_cash ?? r.net_disbursement)} strong />
            <Row k="Sisa Gaji Setelah Angsuran" v={rp(cap.salary_left ?? r.remaining_salary)} strong />
          </Block>

          <ValidationList validations={r.validations} />
        </div>
      </div>

      {hasWarnings && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4" data-testid="capital-result-warnings">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Catatan Khusus Hasil Simulasi:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3b. TIGA BERMUDA AMANAH • BANK MESTIKA (SIMULASI DASA GROUP — TBA-MSTK 1.0)
// ============================================================================
export function MestikaResultView({ r }) {
  const mst = r.mestika_details || {};
  const isGajiPensiun = mst.salary_type === "pensiun";

  return (
    <div className="space-y-6" data-testid="final-result">
      {/* Header Identitas Resmi Tiga Bermuda Amanah • Bank Mestika */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <PartnerLogo bankKey="bank_mestika" size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base sm:text-lg font-bold text-[#165B26]">
                TIGA BERMUDA AMANAH • BANK MESTIKA
              </h3>
              <span className="rounded-full bg-[#1E7E34]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#1E7E34]">
                TBA-MSTK 1.0 • Kredit Pensiun
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Simulasi DASA Group • Pembiayaan Pensiun &amp; Take Over s.d. Usia 80 Tahun
            </p>
          </div>
        </div>
        <div className="text-right sm:self-center">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
              r.overall_ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {r.overall_ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {r.overall_ok ? "Parameter TBA-MSTK Terverifikasi" : "Periksa Catatan Validasi"}
          </span>
        </div>
      </div>

      {Array.isArray(mst.warnings) && mst.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3.5 text-xs text-amber-800 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Catatan Validasi Simulasi:
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            {mst.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Kolom Kiri */}
        <div className="space-y-6">
          <Block title="Input Data Debitur (TBA-MSTK 1.0)" accent="#1E7E34">
            <Row k="Nama Debitur" v={r.name} />
            <Row k="Tanggal Lahir" v={fmtDate(r.birth_date)} />
            <Row k="Tanggal Proses" v={fmtDate(r.process_date)} />
            <Row k="Usia Saat Proses" v={mst.age_label || `${r.age} tahun`} />
            <Row
              k="Produk Otomatis"
              v={`${mst.product_label || "Reguler"} (${pct(r.bank_rate)} p.a.)`}
              strong
              testid="result-category"
            />
            <Row k="Jenis Gaji" v={mst.salary_type_label || "Sesuai Gaji IDPB"} />
            {isGajiPensiun ? (
              <>
                <Row k="Gaji Pensiun Diinput" v={rp(mst.salary_input)} />
                <Row
                  k={`Estimasi Gaji Pokok (-${mst.pension_deduction_pct ?? 13}%)`}
                  v={rp(mst.basic_salary ?? r.salary)}
                  strong
                />
              </>
            ) : (
              <Row
                k="Gaji Pokok IDPB (Tanpa Tanggungan)"
                v={rp(mst.basic_salary ?? r.salary)}
                strong
              />
            )}
            <Row k="Status Tanggungan" v={mst.dependent_label || "Tidak Ada Tanggungan"} />
          </Block>

          <Block title="Parameter &amp; Alternatif Plafond" accent="#165B26">
            <Row
              k={`Tgl Akhir Usia (${mst.end_age_years ?? 79} Thn ${mst.end_age_months ?? 11} Bln)`}
              v={`${fmtDate(mst.end_age_date)} (${mst.remaining_age_months || 0} bln)`}
            />
            <Row k="Maksimal Tenor" v={`${mst.max_tenor ?? r.tenor} bulan`} />
            <Row k={`Batas Angsuran (DSR ${mst.dsr_pct ?? 99}%)`} v={rp(mst.payment_cap)} />
            <Row k="Maksimal Plafond (Batas Plafond)" v={rp(mst.max_plafond ?? r.plafond)} strong />
            <Row k="Alternatif Plafond (PV Murni 99%)" v={rp(mst.alt_plafond ?? r.plafond)} />
          </Block>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-6">
          <Block title="Pengajuan &amp; Potongan Pencairan" accent="#1E7E34">
            <Row k="Plafond Pengajuan" v={rp(r.plafond)} strong testid="result-plafond" />
            <Row k="Tenor Pengajuan" v={`${r.tenor} bulan`} />
            <Row k="Suku Bunga Kredit" v={`${pct(r.bank_rate)} per tahun`} />
            <Row k="Angsuran per Bulan" v={rp(r.coop_installment)} strong testid="result-coop-installment" />
            <Row k="DSR Angsuran Aktual" v={`${pct(r.ratio_pct)} (Maks ${mst.dsr_pct ?? 99}%)`} testid="result-ratio" />
            <Row
              k={`Biaya Pencairan (${pct(mst.cost_rate_pct ?? 22)})`}
              v={rp(r.total_fees)}
              testid="result-total-fees"
            />
            <Row
              k={`Retensi Angsuran (${mst.retention_multiplier ?? 3}× Angsuran)`}
              v={rp(r.retention)}
              testid="result-retention"
            />
            <Row k="Pelunasan Take Over (TO)" v={rp(r.take_over || 0)} />
          </Block>

          <ValidationList validations={r.validations} />
        </div>
      </div>

      {/* Tabel Referensi Produk (Reguler vs Reguler Plus) sesuai Excel TBA-MSTK 1.0 */}
      {Array.isArray(mst.comparison) && mst.comparison.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#165B26]">
            <span className="h-3 w-[3px] rounded bg-[#1E7E34]" />
            Perbandingan Skema Produk Bank Mestika (TBA-MSTK 1.0)
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[540px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Produk</th>
                  <th className="px-3 py-2.5 text-right">Bunga</th>
                  <th className="px-3 py-2.5 text-right">Biaya</th>
                  <th className="px-3 py-2.5 text-right">Plafond Maks</th>
                  <th className="px-3 py-2.5 text-right">Alternatif Plafond</th>
                  <th className="px-3 py-2.5 text-right">Angsuran Real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mst.comparison.map((c) => (
                  <tr key={c.code} className={c.active ? "bg-emerald-50/70 font-semibold text-[#165B26]" : "text-slate-600"}>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        {c.label}
                        {c.active && (
                          <span className="rounded-full bg-[#1E7E34] px-2 py-0.5 text-[10px] font-bold text-white">
                            Aktif
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right lp-num">{pct(c.rate_pct)}</td>
                    <td className="px-3 py-2.5 text-right lp-num">{pct(c.cost_pct)}</td>
                    <td className="px-3 py-2.5 text-right lp-num">{rp(c.max_plafond)}</td>
                    <td className="px-3 py-2.5 text-right lp-num">{rp(c.alt_plafond)}</td>
                    <td className="px-3 py-2.5 text-right lp-num">{rp(c.installment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom Summary Banner */}
      <div className="grid gap-px overflow-hidden rounded-xl bg-[#165B26] sm:grid-cols-2">
        <div className="p-4 sm:p-5 text-white">
          <p className="text-xs text-emerald-100/80 font-medium">Sisa Bersih — Terima Bersih Nasabah</p>
          <p className="mt-1 font-display text-2xl sm:text-3xl font-bold lp-num truncate" data-testid="result-net">
            {rp(r.net_disbursement)}
          </p>
        </div>
        <div className="p-4 sm:p-5 text-white sm:border-l sm:border-white/15">
          <p className="text-xs text-emerald-100/80 font-medium">Sisa Gaji (dari Gaji Pokok)</p>
          <p className="mt-1 font-display text-2xl sm:text-3xl font-bold lp-num truncate" data-testid="result-remaining-salary">
            {rp(r.remaining_salary)}
          </p>
          {isGajiPensiun && (
            <p className="mt-1 text-[11px] text-emerald-100/85 lp-num">
              Sisa dari Total Gaji Pensiun: <b>{rp(mst.salary_left_pension)}</b>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. MITRA BANK KONVENSIONAL (Mandiri Taspen, MNC, BNI)
// ============================================================================
export function ConventionalBankResultView({ r }) {
  return (
    <div className="space-y-6" data-testid="final-result">
      {/* Header Identitas Resmi Bank */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <PartnerLogo bankKey={r.bank_key} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base sm:text-lg font-bold text-[#17223B]">
                {(r.bank_name || "Mitra Perbankan").toUpperCase()}
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                Kredit Pensiun
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Simulasi Pembiayaan Pensiun Mitra Perbankan
            </p>
          </div>
        </div>
        <div className="text-right sm:self-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Parameter Terhubung
          </span>
        </div>
      </div>

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
const ResultView = memo(function ResultView(props) {
  const bankKey = props.r?.bank_key;
  if (bankKey === "bank_mestika" || !!props.r?.mestika_details) {
    return <MestikaResultView {...props} />;
  }
  if (bankKey === "bank_capital" || !!props.r?.capital_details) {
    return <CapitalResultView {...props} />;
  }
  if (bankKey === "bsi_prapen" || !!props.r?.bsi_details) {
    return <BsiResultView {...props} />;
  }
  if (bankKey === "ams2") {
    return <Ams2ResultView {...props} />;
  }
  return <ConventionalBankResultView {...props} />;
});

export default ResultView;
