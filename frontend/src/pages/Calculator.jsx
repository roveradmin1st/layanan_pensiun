import { memo, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Save,
  Lock,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Calendar,
  Info,
  ChevronRight,
  UserCheck,
  Percent
} from "lucide-react";
import { api, errMsg } from "../lib/api";
import { rp, pct, fmtDate, ddmmyyyyToIso } from "../lib/format";
import { cn } from "../lib/utils";
import { Logo, PartnerLogo } from "../components/brand/Logo";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import CurrencyInput from "../components/calc/CurrencyInput";
import ResultView from "../components/calc/ResultView";
import { AiSummary, DownloadActions } from "../components/calc/SimExtras";

const Step = ({ n, title, children, testid }) => (
  <section className="lp-card p-4 sm:p-6" data-testid={testid}>
    <div className="mb-4 sm:mb-5 flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#351080] text-xs font-bold text-white shrink-0">{n}</span>
      <h2 className="font-display text-base font-bold text-[#17223B]">{title}</h2>
    </div>
    {children}
  </section>
);

const MaxRow = ({ k, v, strong, testid }) => (
  <div className="flex justify-between items-center gap-3 border-b border-slate-100 py-2 sm:py-2.5 text-xs sm:text-sm last:border-0">
    <span className="text-slate-500 shrink-0">{k}</span><span className={`lp-num text-right font-semibold truncate ${strong ? "text-[#351080]" : "text-[#17223B]"}`} data-testid={testid}>{v}</span>
  </div>
);

const MaxCard = memo(function MaxCard({ mx }) {
  if (!mx.processable) return (
    <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5 text-sm text-red-700" data-testid="max-stop-reason">
      <AlertTriangle className="h-5 w-5 shrink-0" /><div><p className="font-semibold">Pengajuan tidak dapat diproses</p><p>{mx.stop_reason}</p></div>
    </div>
  );
  const isBsi = mx.bank_key === "bsi_prapen";
  const isAms2 = mx.bank_key === "ams2";

  if (isBsi) {
    return (
      <div className="lp-card p-4 sm:p-6 lp-fade border-l-4 border-l-[#078D67]" data-testid="max-result">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
          <PartnerLogo bankKey="bsi_prapen" size="sm" />
          <div>
            <p className="lp-eyebrow text-[#078D67]">Hasil Maksimal Pembiayaan BSI • {mx.bank_name || "Bank BSI"}</p>
            <p className="font-display text-base font-bold text-[#17223B]">Calon Debitur: {mx.name}</p>
          </div>
        </div>
        <div>
          <MaxRow k="Tanggal Proses" v={fmtDate(mx.process_date)} />
          <MaxRow k="Usia Saat Ini" v={`${mx.age} tahun`} testid="max-age" />
          {mx.bsi_status_gaji_label && (
            <MaxRow k="Status Gaji" v={mx.bsi_status_gaji_label} strong testid="max-status-gaji" />
          )}
          {mx.bsi_sub_product_label && (
            <MaxRow k="Sub-Produk BSI" v={mx.bsi_sub_product_label} testid="max-sub-product" />
          )}
          <MaxRow k="Kategori & Akad" v={mx.category} strong testid="max-category" />
          <MaxRow k="Price / Margin Saat Aktif" v={`${pct(mx.bank_rate)} per tahun`} />
          <MaxRow k="Price / Margin Saat Pensiun" v={`${pct(mx.coop_rate)} per tahun`} testid="max-coop-rate" />
          <MaxRow k="Gaji Masa Aktif Diakui" v={rp(mx.salary)} />
          {mx.pension_salary > 0 && (
            <MaxRow k="Estimasi Gaji Pensiun" v={rp(mx.pension_salary)} />
          )}
          <MaxRow
            k={`Angsuran Maksimal Aktif (DBR ${mx.dbr_active_rate || 70}%)`}
            v={rp(mx.max_installment)}
            strong
            testid="max-installment"
          />
          {mx.max_installment_pension > 0 && (
            <MaxRow k="Angsuran Maksimal Pensiun (DSR 90%)" v={rp(mx.max_installment_pension)} />
          )}
          <MaxRow k="Tenor Maksimal" v={`${mx.max_tenor} bulan`} testid="max-tenor" />
          <MaxRow k="Plafond Maksimal" v={rp(mx.max_plafond)} strong testid="max-plafond" />
          <MaxRow k="Nilai Take Over" v={rp(mx.take_over)} />
        </div>
      </div>
    );
  }

  if (isAms2) {
    return (
      <div className="lp-card p-4 sm:p-6 lp-fade border-l-4 border-l-[#351080]" data-testid="max-result">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
          <PartnerLogo bankKey="ams2" size="sm" />
          <div>
            <p className="lp-eyebrow">Hasil Maksimal Simulasi • Asia Madani Sejahtera (AMS2)</p>
            <p className="font-display text-base font-bold text-[#17223B]">Nama Debitur: {mx.name}</p>
          </div>
        </div>
        <div>
          <MaxRow k="Tanggal Proses" v={fmtDate(mx.process_date)} />
          <MaxRow k="Usia Saat Ini" v={`${mx.age} tahun ${mx.age_months ? `(${mx.age_months} bln)` : ""}`} testid="max-age" />
          <MaxRow k="Kategori Produk" v={mx.category} strong testid="max-category" />
          <MaxRow k="Bunga Bank" v={`${pct(mx.bank_rate)} per tahun`} />
          <MaxRow k="Bunga Koperasi" v={`${pct(mx.coop_rate)} per tahun`} strong testid="max-coop-rate" />
          <MaxRow k="Cadangan Risiko" v={pct(mx.risk_pct)} />
          <MaxRow k="Gaji Pensiun Bulanan" v={rp(mx.salary)} />
          <MaxRow k="Angsuran Maksimal (90% Gaji)" v={rp(mx.max_installment)} strong testid="max-installment" />
          <MaxRow k="Tenor Maksimal" v={`${mx.max_tenor} bulan`} testid="max-tenor" />
          <MaxRow k="Plafond Maksimal" v={rp(mx.max_plafond)} strong testid="max-plafond" />
          <MaxRow k="Nilai Take Over" v={rp(mx.take_over)} />
        </div>
      </div>
    );
  }

  // Mitra Bank Konvensional
  return (
    <div className="lp-card p-4 sm:p-6 lp-fade border-l-4 border-l-[#17223B]" data-testid="max-result">
      <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
        <PartnerLogo bankKey={mx.bank_key} size="sm" />
        <div>
          <p className="lp-eyebrow">Hasil Maksimal Kredit • {mx.bank_name || "Mitra Bank"}</p>
          <p className="font-display text-base font-bold text-[#17223B]">Nama Debitur: {mx.name}</p>
        </div>
      </div>
      <div>
        <MaxRow k="Tanggal Proses" v={fmtDate(mx.process_date)} />
        <MaxRow k="Usia Saat Ini" v={`${mx.age} tahun`} testid="max-age" />
        <MaxRow k="Kategori Produk" v={mx.category} strong testid="max-category" />
        <MaxRow k="Suku Bunga Kredit" v={`${pct(mx.bank_rate)} per tahun`} strong testid="max-coop-rate" />
        <MaxRow k="Gaji Pensiun Bulanan" v={rp(mx.salary)} />
        <MaxRow k="Angsuran Maksimal" v={rp(mx.max_installment)} strong testid="max-installment" />
        <MaxRow k="Tenor Maksimal" v={`${mx.max_tenor} bulan`} testid="max-tenor" />
        <MaxRow k="Plafond Maksimal" v={rp(mx.max_plafond)} strong testid="max-plafond" />
        <MaxRow k="Nilai Take Over" v={rp(mx.take_over)} />
      </div>
    </div>
  );
});

function addMonthsClampedLocal(date, months) {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last));
}

function fullMonthsLocal(from, to) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
  if (addMonthsClampedLocal(from, months) > to) months--;
  return months;
}

function parseIsoDateLocal(val) {
  if (!val) return null;
  const d = new Date(`${String(val).slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function todayIsoLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function computeCapitalRecommendation(d) {
  const rate = 0.10 / 12;
  const process = parseIsoDateLocal(d.capital_process_iso);
  const dob = parseIsoDateLocal(d.capital_birth_iso);
  const tmt = parseIsoDateLocal(d.capital_tmt_iso);
  const salary = Number(d.salary || 0);
  const product = d.capital_product || "";
  const isPensiun = product === "pensiun";
  const type = isPensiun ? "non" : (d.capital_payment_type || "");
  const gpManual = String(d.capital_gp_manual ?? "").trim();

  const errors = [];
  if (!process) {
    errors.push("Tanggal proses tidak valid.");
    return { errors, ready: false, maxCreditMonths: 0, ppMonths: null, gpMonths: 0, pvMonths: null, maxLoan: null, canEstimate: false };
  }
  if (!dob) {
    return { errors, ready: false, maxCreditMonths: 0, ppMonths: null, gpMonths: 0, pvMonths: null, maxLoan: null, canEstimate: false };
  }
  const ageLimit = addMonthsClampedLocal(dob, 74 * 12 + 11);
  const maxCreditMonths = fullMonthsLocal(process, ageLimit);
  if (dob > process) errors.push("Tanggal lahir tidak boleh setelah tanggal proses.");
  if (maxCreditMonths <= 0) errors.push("Batas usia kredit sudah tercapai; tenor maksimal tidak positif.");

  let ppMonths = isPensiun ? 0 : null;
  let gpMonths = 0;
  let pvMonths = null;
  let maxLoan = null;

  if (salary <= 0) errors.push("Isi gaji bulanan untuk menghitung batas angsuran dan plafond.");
  if (!product) errors.push("Pilih produk kredit.");
  if (product === "pra" && !type) errors.push("Pilih tipe angsuran.");
  if (product === "pra" && !tmt) errors.push("Isi TMT Pensiun untuk menghitung Tenor PP dan Tenor PV.");

  if (!isPensiun && tmt && process) {
    ppMonths = fullMonthsLocal(process, tmt);
    if (tmt < process) errors.push("TMT Pensiun tidak boleh sebelum tanggal proses.");
    if (product === "pra" && type === "gp") {
      gpMonths = gpManual === "" ? Math.min(ppMonths, 48) : Number(gpManual);
      if (!Number.isInteger(gpMonths) || gpMonths < 0) errors.push("Tenor GP manual harus berupa bilangan bulat nol atau lebih.");
      if (gpManual !== "" && (gpMonths > ppMonths || gpMonths > 48)) errors.push("Tenor GP manual melampaui Tenor PP atau batas 48 bulan.");
      if (gpMonths < 1) errors.push("Tenor GP kurang dari 1 bulan; perhitungan simulasi belum dapat ditetapkan secara valid.");
    }
  }
  if (maxCreditMonths > 0 && gpMonths >= 0) pvMonths = maxCreditMonths - gpMonths;
  if (pvMonths !== null && pvMonths <= 0) errors.push("Tenor PV harus lebih dari 0 bulan.");

  const tmtOk = isPensiun ? true : Boolean(tmt && process && tmt >= process);
  const typeOk = isPensiun ? true : Boolean(type);
  const canEstimate = Boolean(
    product &&
    typeOk &&
    salary > 0 &&
    pvMonths > 0 &&
    process &&
    tmtOk &&
    dob <= process &&
    maxCreditMonths > 0 &&
    !errors.some((e) => e.includes("Tenor GP manual") || e.includes("Tenor GP kurang"))
  );
  if (canEstimate) {
    maxLoan = (salary * 0.9 * (1 - Math.pow(1 + rate, -pvMonths))) / rate;
  }
  return { errors, ready: true, ageLimit, maxCreditMonths, ppMonths, gpMonths, pvMonths, maxLoan, canEstimate };
}

function computeAgeLocal(dob, process) {
  if (!dob || !process) return { years: 0, months: 0 };
  let years = process.getFullYear() - dob.getFullYear();
  let months = process.getMonth() - dob.getMonth();
  const days = process.getDate() - dob.getDate();
  if (days < 0) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months };
}

function computeMestikaRecommendation(d, cfg = {}) {
  const process = parseIsoDateLocal(d.mestika_process_iso);
  const dob = parseIsoDateLocal(d.mestika_birth_iso);
  const salaryInput = Number(d.salary || 0);
  const salaryType = d.mestika_salary_type === "idpb" ? "idpb" : "pensiun";

  const regulerMaxAge = cfg.regulerMaxAgeYears ?? 65;
  const maxEntryAge = cfg.maxEntryAgeYears ?? 69;
  const endAgeYears = cfg.maxEndAgeYears ?? 79;
  const endAgeMonths = cfg.maxEndAgeMonths ?? 11;
  const maxTenorCap = cfg.maxTenorMonths ?? 240;
  const batasPlafond = cfg.maxPlafondAbsolute ?? 500000000;
  const dsrPct = cfg.maxInstallmentRatio ?? 99.0;
  const deductionPct = cfg.pensionDeductionPercent ?? 13.0;
  const costPct = cfg.disbursementCostPercent ?? 22.0;

  const basicSalary = salaryType === "pensiun"
    ? salaryInput * (1 - deductionPct / 100)
    : salaryInput;
  const paymentCap = basicSalary * (dsrPct / 100);

  const errors = [];
  if (!process) {
    errors.push("Tanggal proses tidak valid.");
    return { errors, ready: false, basicSalary, paymentCap, deductionPct, dsrPct, batasPlafond, canEstimate: false };
  }
  if (!dob) {
    return { errors, ready: false, basicSalary, paymentCap, deductionPct, dsrPct, batasPlafond, canEstimate: false };
  }
  if (dob > process) errors.push("Tanggal lahir tidak boleh setelah tanggal proses.");

  const ageObj = computeAgeLocal(dob, process);
  const ageLabel = `${ageObj.years} thn ${ageObj.months} bln`;
  const ageRejected = ageObj.years >= maxEntryAge;
  if (ageRejected) {
    errors.push(`Usia calon debitur (${ageLabel}) telah mencapai ${maxEntryAge} tahun atau lebih (batas usia masuk di bawah ${maxEntryAge} tahun).`);
  }

  const isReguler = ageObj.years < regulerMaxAge;
  const productLabel = isReguler ? "Reguler" : "Reguler Plus";
  const rateAnnual = isReguler ? (cfg.interestRateAnnual ?? 10.0) : (cfg.interestRatePlusAnnual ?? 12.0);
  const rateMonthly = rateAnnual / 100 / 12;

  const endAgeDate = addMonthsClampedLocal(dob, endAgeYears * 12 + endAgeMonths);
  const remainingAgeMonths = fullMonthsLocal(process, endAgeDate);
  const maxTenor = Math.max(0, Math.min(maxTenorCap, remainingAgeMonths));
  if (maxTenor <= 0) errors.push("Batas usia kredit telah tercapai; sisa tenor tidak positif.");
  if (salaryInput <= 0) {
    errors.push(salaryType === "idpb" ? "Isi Gaji Pokok IDPB untuk menghitung plafond." : "Isi Gaji Pensiun untuk menghitung plafond.");
  }

  const canEstimate = Boolean(
    dob &&
    process &&
    dob <= process &&
    !ageRejected &&
    maxTenor > 0 &&
    basicSalary > 0
  );

  let altPlafond = null;
  let maxPlafond = null;
  if (canEstimate) {
    altPlafond = (paymentCap * (1 - Math.pow(1 + rateMonthly, -maxTenor))) / rateMonthly;
    maxPlafond = Math.min(batasPlafond, altPlafond);
  }

  return {
    errors,
    ready: true,
    ageObj,
    ageLabel,
    ageRejected,
    productLabel,
    rateAnnual,
    costPct,
    endAgeYears,
    endAgeMonths,
    endAgeDate,
    remainingAgeMonths,
    maxTenor,
    basicSalary,
    paymentCap,
    deductionPct,
    dsrPct,
    batasPlafond,
    altPlafond,
    maxPlafond,
    canEstimate
  };
}

function nextMonth25IsoLocal(baseIso) {
  const d = parseIsoDateLocal(baseIso) || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function roundHalfUpLocal(value, decimals = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = Math.pow(10, decimals);
  const clean = Number((num * factor).toPrecision(12));
  return (clean >= 0 ? Math.floor(clean + 0.5) : Math.ceil(clean - 0.5)) / factor;
}

function pvWithFvLocal(monthlyRate, nMonths, pmtVal, fvVal = 0) {
  if (nMonths <= 0) return 0;
  if (monthlyRate === 0) return pmtVal * nMonths + fvVal;
  const factor = Math.pow(1 + monthlyRate, nMonths);
  return (pmtVal * (factor - 1) / monthlyRate + fvVal) / factor;
}

function isLastDayOfFebLocal(dateObj) {
  if (!dateObj || dateObj.getMonth() !== 1) return false;
  const year = dateObj.getFullYear();
  return dateObj.getDate() === new Date(year, 2, 0).getDate();
}

function days360USLocal(startDate, endDate) {
  let y1 = startDate.getFullYear();
  let m1 = startDate.getMonth() + 1;
  let d1 = startDate.getDate();
  let y2 = endDate.getFullYear();
  let m2 = endDate.getMonth() + 1;
  let d2 = endDate.getDate();

  const startLastFeb = isLastDayOfFebLocal(startDate);
  const endLastFeb = isLastDayOfFebLocal(endDate);
  if (startLastFeb && endLastFeb) d2 = 30;
  if (startLastFeb) d1 = 30;
  if (d2 === 31 && d1 >= 30) d2 = 30;
  if (d1 === 31) d1 = 30;
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

function getNearestAge30_360Local(dobDate, startDate) {
  if (!dobDate || !startDate || isNaN(dobDate.getTime()) || isNaN(startDate.getTime())) return 0;
  const d360 = days360USLocal(dobDate, startDate);
  if (d360 < 0) return 0;
  return Math.floor((d360 + 180) / 360);
}

function computeExactAgeLocal(dob, process) {
  if (!dob || !process) return { years: 0, months: 0, days: 0, totalMonths: 0, exactText: "-" };
  let years = process.getFullYear() - dob.getFullYear();
  let months = process.getMonth() - dob.getMonth();
  let days = process.getDate() - dob.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(process.getFullYear(), process.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalMonths = Math.max(0, years * 12 + months);
  return {
    years,
    months,
    days,
    totalMonths,
    exactText: `${years} Tahun ${months} Bulan ${days} Hari`
  };
}

function computeBsiLiveRecommendation(d, cfg = {}) {
  const dob = parseIsoDateLocal(d.bsi_birth_iso);
  const cairDate = parseIsoDateLocal(d.bsi_proyeksi_cair) || parseIsoDateLocal(todayIsoLocal());
  const startAngsuranDate = parseIsoDateLocal(d.bsi_start_angsuran) || (cairDate ? new Date(cairDate.getFullYear(), cairDate.getMonth(), 1) : new Date());

  const gp = Math.max(0, Number(d.gaji_pokok || 0));
  const um = Math.max(0, Number(d.uang_makan || 0));
  const tr1 = Math.max(0, Number(d.tunjangan_rutin_1 || 0));
  const tr3 = Math.max(0, Number(d.tunjangan_rutin_3 || 0));
  const tl1 = Math.max(0, Number(d.tunjangan_lain_1 || 0));
  const tht = Math.max(0, Number(d.tht || 0));
  const pensionSalary = Math.max(0, Number(d.pension_salary || 0));

  const w = cfg.incomeWeights || {
    gajiPokok: 100,
    uangMakan: 90,
    tunjanganRutin1Bln: 90,
    tunjanganRutin3Bln: 50,
    tunjanganLain1Bln: 80,
    tht: 75
  };

  const recognizedSalary = Math.round(
    gp * (Number(w.gajiPokok) / 100) +
    um * (Number(w.uangMakan) / 100) +
    tr1 * (Number(w.tunjanganRutin1Bln) / 100) +
    tr3 * (Number(w.tunjanganRutin3Bln) / 100) +
    tl1 * (Number(w.tunjanganLain1Bln) / 100)
  );
  const thtRecognized = Math.round(tht * ((Number(w.tht) || 75) / 100));

  const statusGaji = d.bsi_status_gaji || "payroll";
  const dbrRate = statusGaji === "non_payroll" ? 50 : 70;
  const dbrLabel = statusGaji === "comitted_payroll"
    ? "Comitted Payroll"
    : statusGaji === "non_payroll"
    ? "Non Payroll"
    : "Payroll";

  const angsuranBsi = Math.max(0, Number(d.angsuran_bsi || 0));
  const angsuranSelainBsi = Math.max(0, Number(d.angsuran_selain_bsi || 0));
  let akseptasiAktifRaw = 0;
  if (statusGaji === "payroll") {
    akseptasiAktifRaw = (recognizedSalary * (dbrRate / 100) - angsuranSelainBsi) - angsuranBsi;
  } else if (statusGaji === "comitted_payroll") {
    akseptasiAktifRaw = recognizedSalary * (dbrRate / 100) - (angsuranBsi + angsuranSelainBsi);
  } else {
    akseptasiAktifRaw = (recognizedSalary - angsuranSelainBsi) * (dbrRate / 100) - angsuranBsi;
  }
  const akseptasiAktif = Math.floor(Math.max(0, akseptasiAktifRaw));
  const akseptasiPensiun = Math.floor(Math.max(0, pensionSalary * 0.9));

  const subProduct = d.bsi_sub_product === "PP3" ? "PP3" : "PP10";
  const isAtribusi = d.bsi_skema !== "Non-Atribusi";
  const baseRateAktifAnnual = Number(String(d.bsi_price_aktif || "9.25").replace(",", ".")) || 9.25;
  const baseRatePensiunAnnual = Number(String(d.bsi_price_pensiun || "10.50").replace(",", ".")) || 10.50;

  if (!dob || !cairDate) {
    return {
      ready: false,
      recognizedSalary,
      thtRecognized,
      dbrRate,
      dbrLabel,
      akseptasiAktif,
      akseptasiPensiun,
      baseRateAktifAnnual,
      baseRatePensiunAnnual
    };
  }

  const ageObj = computeExactAgeLocal(dob, cairDate);
  const nearestAge = getNearestAge30_360Local(dob, startAngsuranDate);
  const bupAge = Math.max(55, Number(d.bup_age || 58));
  const explicitBupYear = Number(d.tmt_pensiun_year) || 0;
  const targetBupYear = explicitBupYear >= 1990 ? explicitBupYear : (dob.getFullYear() + bupAge);
  const bupDate = new Date(targetBupYear, dob.getMonth() + 1, 1);
  const rawDaysToBup = (bupDate.getTime() - cairDate.getTime()) / (1000 * 60 * 60 * 24);
  const actualMonthsToBup = rawDaysToBup > 0 ? Math.max(0, Math.round(rawDaysToBup / 30.5)) : 0;

  const maxEndMonths = (Number(cfg.maxEndAgeYears) || 74) * 12 + (Number(cfg.maxEndAgeMonths) || 4);
  const endAgeLimitDate = addMonthsClampedLocal(dob, maxEndMonths);
  const remainingAgeMonths = Math.max(0, fullMonthsLocal(cairDate, endAgeLimitDate));
  const maxTenor = Math.max(0, Math.min(Number(cfg.maxTenorMonths) || 180, remainingAgeMonths));

  const rawReqTenor = Number(d.bsi_req_tenor);
  const requestedTenor = Number.isInteger(rawReqTenor) && rawReqTenor > 0
    ? rawReqTenor
    : (maxTenor > 0 ? maxTenor : 180);
  const activeMonths = actualMonthsToBup > 0 ? Math.min(requestedTenor, actualMonthsToBup) : 0;
  const pensionMonths = Math.max(0, requestedTenor - activeMonths);

  const selesaiAngsuranDate = addMonthsClampedLocal(startAngsuranDate, Math.max(0, requestedTenor));
  const selesaiAngsuranIso = `${selesaiAngsuranDate.getFullYear()}-${String(selesaiAngsuranDate.getMonth() + 1).padStart(2, "0")}-${String(selesaiAngsuranDate.getDate()).padStart(2, "0")}`;
  const endLoanAgeObj = computeExactAgeLocal(dob, selesaiAngsuranDate);

  // Rekomendasi produk berdasarkan usia & sisa bulan ke BUP
  let recommendedSubProduct = "PP10";
  let ageStatusTone = "emerald"; // "emerald" | "amber" | "red"
  let ageRecommendationTitle = "Memenuhi Syarat Usia & Masa Aktif (Dekade Berkah PP10)";
  let ageRecommendationDetail = `Sisa masa aktif ${actualMonthsToBup} bulan ke BUP (${targetBupYear}). Direkomendasikan menggunakan 1. Prapen 10 Tahun (PP10 Dekade Berkah).`;

  if (nearestAge < 45 || nearestAge > 65) {
    ageStatusTone = "red";
    ageRecommendationTitle = `Usia Asuransi Simas (${nearestAge} Thn) Di Luar Rentang 45–65 Tahun`;
    ageRecommendationDetail = "Ketentuan Underwriting PT Asuransi Simas Jiwa mensyaratkan usia masuk Nearest Birthday antara 45 s.d. 65 tahun.";
  } else if (remainingAgeMonths < 12) {
    ageStatusTone = "red";
    ageRecommendationTitle = "Batas Usia Maksimal Kredit (74 Thn 4 Bln) Tercapai";
    ageRecommendationDetail = "Sisa waktu ke batas usia 74 tahun 4 bulan kurang dari 12 bulan.";
  } else if (actualMonthsToBup <= 0) {
    recommendedSubProduct = "SUDAH_PENSIUN";
    ageStatusTone = "red";
    ageRecommendationTitle = "Nasabah Sudah Memasuki Masa Pensiun (0 Bulan Aktif)";
    ageRecommendationDetail = `Tanggal BUP (${fmtDate(`${targetBupYear}-${String(dob.getMonth() + 2 > 12 ? 1 : dob.getMonth() + 2).padStart(2, "0")}-01`)}) telah terlewati. Gunakan skema Pensiun Reguler.`;
  } else if (actualMonthsToBup > 120) {
    recommendedSubProduct = "BELUM_MASUK_JENDELA";
    ageStatusTone = "amber";
    ageRecommendationTitle = `Sisa Masa Aktif ${actualMonthsToBup} Bulan (> 120 Bulan / 10 Tahun)`;
    ageRecommendationDetail = "Melebihi batas maksimal masa aktif Prapensiun 10 Tahun (120 bulan). Periksa kembali Tanggal Lahir atau Usia BUP (58/60/65).";
  } else if (actualMonthsToBup <= 36) {
    recommendedSubProduct = "PP3";
    ageStatusTone = "emerald";
    ageRecommendationTitle = `Sisa Aktif ≤ 36 Bulan (${actualMonthsToBup} Bln) — Cocok PP3 Tri Berkah / PP10`;
    ageRecommendationDetail = `Nasabah sangat ideal memilih 2. Prapen 3 Tahun (PP3 Tri Berkah — pokok masa aktif ringan Rp10.000/bln, juga bisa Non-Payroll) atau 1. Prapen 10 Tahun (PP10).`;
  } else if (subProduct === "PP3" && actualMonthsToBup > 36) {
    recommendedSubProduct = "PP10";
    ageStatusTone = "amber";
    ageRecommendationTitle = `Sisa Aktif ${actualMonthsToBup} Bulan (> 36 Bln) — Wajib Ganti ke Prapen 10 Tahun`;
    ageRecommendationDetail = "Skema 2. Prapen 3 Tahun (PP3) hanya untuk sisa masa aktif ≤ 36 bulan. Klik tombol rekomendasi untuk beralih ke 1. Prapen 10 Tahun (PP10).";
  }

  // Simas Jiwa Tarif & Premi Live
  const simasCfg = cfg.simasInsurance || {};
  const insTotalMonths = requestedTenor + 6;
  const insYears = Math.floor(Math.max(0, insTotalMonths) / 12);
  const insRemMonths = Math.max(0, insTotalMonths) % 12;
  const endCoverageAge = nearestAge + insYears + insRemMonths / 12;
  const maxUpAllowed = (nearestAge > 64 || endCoverageAge > 70) ? 500000000 : 1000000000;
  const mcuThreshold = nearestAge >= 56 ? 500000000 : (nearestAge >= 51 ? 800000000 : 1000000000);

  const ageRow = simasCfg.decreasingRateTable?.[nearestAge];
  let tarifPerMil = 0;
  if (Array.isArray(ageRow) && insTotalMonths >= 1 && insTotalMonths <= 240) {
    if (insTotalMonths < 12) {
      const mult = simasCfg.monthMultipliers?.[insTotalMonths] || 0;
      tarifPerMil = roundHalfUpLocal(mult * (Number(ageRow[0]) || 0), 2);
    } else {
      const y1 = Number(ageRow[insYears - 1]) || 0;
      const y2 = insRemMonths > 0 ? (Number(ageRow[insYears]) || 0) : y1;
      const rawRate = insRemMonths > 0 ? (y1 + (y2 - y1) * (insRemMonths / 12)) : y1;
      tarifPerMil = roundHalfUpLocal(rawRate, 2);
    }
  }

  const calcSimasForPlafond = (pVal) => {
    if (!pVal || pVal <= 0 || tarifPerMil <= 0) {
      return { santunan: 0, premi: 0 };
    }
    const q = tarifPerMil / 1000;
    const santunanRaw = isAtribusi && q > 0 && q < 1 ? (pVal / (1 - q)) : pVal;
    const premiRaw = isAtribusi ? (tarifPerMil * santunanRaw) / 1000 : (tarifPerMil * pVal) / 1000;
    return {
      santunan: Math.round(santunanRaw),
      premi: Math.round(premiRaw)
    };
  };

  // Hitung Rekomendasi Plafond Maksimal (Iterasi Konvergen sama persis dengan Backend)
  const manualIns = Math.max(0, Number(d.bsi_manual_insurance || 0));
  let maxPlafond = 0;
  if (activeMonths > 0 && akseptasiAktif > 0 && (pensionMonths === 0 || akseptasiPensiun > 0)) {
    let candP = Number(d.bsi_req_loan) > 0 ? Number(d.bsi_req_loan) : 400000000;
    for (let iter = 0; iter < 5; iter++) {
      const simCand = calcSimasForPlafond(candP);
      const atribNominal = !isAtribusi ? 0 : (manualIns > 0 ? manualIns : simCand.premi);
      const atribPerBln = requestedTenor > 0 ? atribNominal / requestedTenor : 0;
      const hasAtrib = isAtribusi && atribNominal > 0;

      if (subProduct === "PP3") {
        const availAktif = akseptasiAktif - atribPerBln - 10000;
        const capAktif = availAktif > 0 ? Math.floor(((availAktif * 12) / (baseRateAktifAnnual / 100)) / 10000000) * 10000000 : 0;
        if (pensionMonths > 0) {
          const ratePenCap = (baseRatePensiunAnnual / 100) + (hasAtrib ? 0.01 : 0);
          const availPen = akseptasiPensiun - atribPerBln;
          const capPen = availPen > 0 ? Math.floor(pvWithFvLocal(ratePenCap / 12, pensionMonths, availPen, 0) / 10000000) * 10000000 : 0;
          maxPlafond = Math.max(0, Math.min(800000000, capAktif, capPen));
        } else {
          maxPlafond = Math.max(0, Math.min(800000000, capAktif));
        }
      } else {
        const rateAktCap = (baseRateAktifAnnual / 100) + (hasAtrib ? 0.001 : 0);
        const ratePenCap = (baseRatePensiunAnnual / 100) + (hasAtrib ? 0.01 : 0);
        const availAkt = akseptasiAktif - atribPerBln;
        const availPen = akseptasiPensiun - atribPerBln;
        if (availAkt > 0 && (pensionMonths === 0 || availPen > 0)) {
          const pvPen = pensionMonths > 0 ? pvWithFvLocal(ratePenCap / 12, pensionMonths, availPen, 0) : 0;
          const rawPvAkt = pvWithFvLocal(rateAktCap / 12, activeMonths, availAkt, pvPen);
          maxPlafond = Math.max(0, Math.min(800000000, Math.floor(rawPvAkt / 1000000) * 1000000));
        } else {
          maxPlafond = 0;
        }
      }
      if (Number(d.bsi_req_loan) > 0 || maxPlafond <= 0 || Math.abs(maxPlafond - candP) < 1000000) break;
      candP = maxPlafond;
    }
  }

  const evalPlafond = Number(d.bsi_req_loan) > 0 ? Number(d.bsi_req_loan) : maxPlafond;
  const simasLive = calcSimasForPlafond(evalPlafond);
  const effectivePremi = manualIns > 0 ? manualIns : simasLive.premi;
  const taksasiMmq = evalPlafond > 0 ? Math.ceil((evalPlafond * 1.02) / 1000000) * 1000000 : 0;

  let mcuStatus = "Non Medical Check Up (Auto Acceptance)";
  if (simasLive.santunan > maxUpAllowed || evalPlafond > maxUpAllowed) {
    mcuStatus = `Melebihi Maks UP Rp${(maxUpAllowed / 1e6).toFixed(0)} Juta`;
  } else if (nearestAge >= 56 && simasLive.santunan > 500000000) {
    mcuStatus = "Wajib Medical Check Up (MCU — Usia ≥ 56 & UP > 500 Jt)";
  } else if (nearestAge >= 51 && simasLive.santunan > 800000000) {
    mcuStatus = "Wajib Medical Check Up (MCU — Usia 51–55 & UP > 800 Jt)";
  }

  return {
    ready: true,
    ageObj,
    nearestAge,
    bupAge,
    targetBupYear,
    bupDateIso: `${bupDate.getFullYear()}-${String(bupDate.getMonth() + 1).padStart(2, "0")}-01`,
    actualMonthsToBup,
    remainingAgeMonths,
    maxTenor,
    requestedTenor,
    activeMonths,
    pensionMonths,
    selesaiAngsuranIso,
    endLoanAgeObj,
    recommendedSubProduct,
    ageStatusTone,
    ageRecommendationTitle,
    ageRecommendationDetail,
    recognizedSalary,
    thtRecognized,
    dbrRate,
    dbrLabel,
    akseptasiAktif,
    akseptasiPensiun,
    baseRateAktifAnnual,
    baseRatePensiunAnnual,
    tarifPerMil,
    insYears,
    insRemMonths,
    endCoverageAge: Number(endCoverageAge.toFixed(1)),
    maxUpAllowed,
    mcuThreshold,
    mcuStatus,
    santunanSimas: simasLive.santunan,
    premiSimas: effectivePremi,
    maxPlafond,
    evalPlafond,
    taksasiMmq
  };
}

function computeAms2LiveRecommendation(d, cfg) {
  const dob = parseIsoDateLocal(d.ams2_birth_iso);
  const at = parseIsoDateLocal(d.ams2_process_iso) || parseIsoDateLocal(todayIsoLocal());
  const salary = Math.max(0, Number(d.salary || 0));
  const principal = Math.max(0, Number(d.ams2_req_loan || 0));
  const n = Math.max(0, Math.floor(Number(d.ams2_req_tenor || 0)));
  const to = d.ams2_takeover_type === "yes" ? Math.max(0, Number(d.take_over || 0)) : 0;

  let age = null;
  if (dob && at) {
    age = at.getFullYear() - dob.getFullYear();
    const m = at.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && at.getDate() < dob.getDate())) age--;
  }

  const maxEntryAge = Number(cfg?.maxEntryAgeYears ?? 84);
  let cat = "—";
  let coopRate = null;
  let coopRatePct = 0;
  let riskRate = 0;
  let riskRatePct = 0;
  if (age !== null && age >= 0) {
    if (age <= 75) {
      cat = "Pra Platinum";
      coopRatePct = 17;
      coopRate = 0.17;
      riskRatePct = 20;
      riskRate = 0.2;
    } else if (age <= 80) {
      cat = "Platinum";
      coopRatePct = 19;
      coopRate = 0.19;
      riskRatePct = 25;
      riskRate = 0.25;
    } else if (age <= maxEntryAge) {
      cat = "Post Platinum";
      coopRatePct = 21;
      coopRate = 0.21;
      riskRatePct = 30;
      riskRate = 0.3;
    } else {
      cat = "Di luar kategori";
      coopRate = null;
    }
  }

  const maxEndAgeYears = Number(cfg?.maxEndAgeYears ?? 84);
  const maxEndAgeMonths = Number(cfg?.maxEndAgeMonths ?? 10);
  const maxTenorCap = Number(cfg?.maxTenorMonths ?? 120);
  const finalLimit = dob ? addMonthsClampedLocal(dob, maxEndAgeYears * 12 + maxEndAgeMonths) : null;

  let recMaxTenor = 0;
  if (dob && at && finalLimit) {
    const months = (finalLimit.getFullYear() - at.getFullYear()) * 12 + (finalLimit.getMonth() - at.getMonth());
    const candidateEnd = new Date(at);
    candidateEnd.setMonth(candidateEnd.getMonth() + Math.max(0, months));
    recMaxTenor = Math.max(0, months);
    if (candidateEnd > finalLimit) recMaxTenor = Math.max(0, recMaxTenor - 1);
    recMaxTenor = Math.min(maxTenorCap, recMaxTenor);
  }

  const effectiveTenor = n > 0 ? Math.min(n, maxTenorCap, recMaxTenor || maxTenorCap) : recMaxTenor;
  const cap = salary * 0.95;
  const recRate = coopRate !== null ? coopRate / 12 : null;
  const maxPlafondAbs = Number(cfg?.maxPlafondAbsolute ?? 250000000);

  let recMaxPlafon = 0;
  if (salary > 0 && recRate !== null && effectiveTenor > 0) {
    const maxBySalary = cap * ((1 - Math.pow(1 + recRate, -effectiveTenor)) / recRate);
    recMaxPlafon = Math.min(maxPlafondAbs, Math.floor(maxBySalary / 100000) * 100000);
  }

  let maxPlafondAtMaxTenor = 0;
  if (salary > 0 && recRate !== null && recMaxTenor > 0) {
    const maxBySalaryFull = cap * ((1 - Math.pow(1 + recRate, -recMaxTenor)) / recRate);
    maxPlafondAtMaxTenor = Math.min(maxPlafondAbs, Math.floor(maxBySalaryFull / 100000) * 100000);
  }

  const evalLoan = principal > 0 ? principal : recMaxPlafon;
  const evalTenor = n > 0 ? n : recMaxTenor;
  const pmtCalc = (rMonthly, nper, pvVal) => {
    if (nper <= 0 || pvVal <= 0) return 0;
    if (rMonthly === 0) return pvVal / nper;
    const f = Math.pow(1 + rMonthly, nper);
    return (pvVal * rMonthly * f) / (f - 1);
  };
  const instRaw = coopRate !== null && evalTenor > 0 && evalLoan > 0 ? pmtCalc(coopRate / 12, evalTenor, evalLoan) : 0;
  const proaqRaw = evalLoan * (0.1 + 0.035);
  const riskRaw = evalLoan * riskRate;
  const adminRaw = evalLoan > 0 ? 700000 : 0;
  const totalRaw = proaqRaw + riskRaw + adminRaw;
  const retRaw = instRaw * 3;
  const netRaw = evalLoan - totalRaw - to - retRaw;
  const remainingRaw = salary - instRaw;
  const end = at && evalTenor > 0 ? addMonthsClampedLocal(at, evalTenor) : null;

  return {
    dob,
    at,
    age,
    cat,
    inCategory: coopRate !== null,
    coopRatePct,
    riskRatePct,
    finalLimit,
    end,
    recMaxTenor,
    effectiveTenor,
    recMaxPlafon,
    maxPlafondAtMaxTenor,
    cap: Math.round(cap),
    salary,
    principal,
    n,
    to,
    evalLoan,
    evalTenor,
    installment: Math.round(instRaw),
    proaq: Math.round(proaqRaw),
    risk: Math.round(riskRaw),
    admin: Math.round(adminRaw),
    totalFees: Math.round(totalRaw),
    retention: Math.round(retRaw),
    net: Math.round(netRaw),
    remaining: Math.round(remainingRaw)
  };
}

export default function CalculatorPage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const leadId = sp.get("lead");
  const bankParam = sp.get("bank");
  const [banks, setBanks] = useState([]);
  const [partnerParams, setPartnerParams] = useState(null);
  const [bankKey, setBankKey] = useState(bankParam || "bsi_prapen");
  const [viewStage, setViewStage] = useState(leadId || bankParam ? "workspace" : "hub"); // "hub" | "transition" | "workspace"
  const [transitionBankKey, setTransitionBankKey] = useState("");
  const [dapem, setDapem] = useState("TASPEN");
  const [phone, setPhone] = useState("");
  const [simStatus, setSimStatus] = useState("");
  const bank = banks.find((b) => b.key === bankKey);
  const [d, setD] = useState({
    name: "",
    birth: "",
    salary: "",
    take_over: 0,
    // Simulasi AMS V2 — Koperasi Asia Madani Sejahtera Specific:
    ams2_birth_iso: "",
    ams2_process_iso: todayIsoLocal(),
    ams2_takeover_type: "no", // "no" | "yes"
    ams2_req_loan: "",
    ams2_req_tenor: "",
    ams2_pic: "MUHAMMAD TEGUH PRANADA",
    ams2_sm: "",
    ams2_sm_hp: "",
    ams2_marketing: "",
    ams2_marketing_hp: "",
    // BSI Mitraguna Prapensiun (NOS v1.4.6 + Simas Jiwa) — Sesuai Urutan Sheet Akseptasi 1-17:
    bsi_birth_iso: "",
    nip: "",
    bsi_sub_product: "PP10", // "PP10" (1. Prapen 10 Tahun) | "PP3" (2. Prapen 3 Tahun)
    bsi_status_gaji: "payroll", // "payroll" | "comitted_payroll" | "non_payroll"
    gaji_pokok: "",
    uang_makan: "",
    tunjangan_rutin_1: "",
    tunjangan_rutin_3: "",
    tunjangan_lain_1: "",
    tmt_bekerja: "",
    bup_age: "58",
    tmt_pensiun_year: "",
    tht: "",
    pension_salary: "",
    bsi_req_tenor: "180",
    bsi_price_aktif: "9.25",
    bsi_price_pensiun: "10.50",
    bsi_proyeksi_cair: todayIsoLocal(),
    bsi_start_angsuran: nextMonth25IsoLocal(todayIsoLocal()),
    bsi_skema: "Atribusi", // "Atribusi" (2. Atribusi Asuransi) | "Non-Atribusi" (1. No Atribusi)
    bsi_manual_insurance: "",
    buka_blokir_lama: 0,
    pelunasan_lama: 0,
    angsuran_bsi: 0,
    angsuran_selain_bsi: 0,
    bsi_req_loan: "",
    bsi_akad: "MMQ",
    // Calc Capital (PS3 CAPITAL — DASA CIPTA BERKARYA) Specific:
    capital_birth_iso: "",
    capital_product: "", // "" | "pra" | "pensiun"
    capital_tmt_iso: "",
    capital_payment_type: "", // "" | "gp" | "non"
    capital_gp_manual: "",
    capital_process_iso: todayIsoLocal(),
    capital_req_loan: "",
    capital_req_tenor: "",
    // Tiga Bermuda Amanah • Bank Mestika (TBA-MSTK 1.0) Specific:
    mestika_birth_iso: "",
    mestika_process_iso: todayIsoLocal(),
    mestika_salary_type: "pensiun", // "pensiun" | "idpb"
    mestika_has_dependents: "tidak", // "tidak" | "ada"
    mestika_dependent_type: "istri", // "istri" | "istri_anak_1" | "istri_anak_2" | "istri_anak_3"
    mestika_req_loan: "",
    mestika_req_tenor: "",
  });
  const [mx, setMx] = useState(null);
  const [tl, setTl] = useState("3.5");
  const [mode, setMode] = useState("max");
  const [custom, setCustom] = useState({ plafond: "", tenor: "" });
  const [res, setRes] = useState(null);
  const [sim, setSim] = useState(null);
  const [busy, setBusy] = useState("");
  const [ams2Error, setAms2Error] = useState("");
  const [capError, setCapError] = useState("");
  const [mestikaError, setMestikaError] = useState("");
  const [bsiError, setBsiError] = useState("");
  const [showExistingOblig, setShowExistingOblig] = useState(false);

  const handleSelectBank = (targetKey) => {
    setTransitionBankKey(targetKey);
    setBankKey(targetKey);
    reset();
    setViewStage("transition");
    setTimeout(() => {
      setViewStage("workspace");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 360);
  };

  const handleGajiComponentChange = (field, val) => {
    const updated = { ...d, [field]: val };
    const gp = Number(field === "gaji_pokok" ? val : updated.gaji_pokok || 0);
    const um = Number(field === "uang_makan" ? val : updated.uang_makan || 0);
    const tr1 = Number(field === "tunjangan_rutin_1" ? val : updated.tunjangan_rutin_1 || 0);
    const tr3 = Number(field === "tunjangan_rutin_3" ? val : updated.tunjangan_rutin_3 || 0);
    const tl1 = Number(field === "tunjangan_lain_1" ? val : updated.tunjangan_lain_1 || 0);

    // Hitung total recognized jika ada komponen yang diisi sesuai bobot resmi BSI Sheet Akseptasi
    if (gp > 0 || um > 0 || tr1 > 0 || tr3 > 0 || tl1 > 0) {
      const calcTotal = Math.round((gp * 1.0) + (um * 0.9) + (tr1 * 0.9) + (tr3 * 0.5) + (tl1 * 0.8));
      updated.salary = calcTotal;
    }
    setD(updated);
    setBsiError("");
    reset();
  };

  useEffect(() => {
    api.get("/banks").then((r) => {
      setBanks(r.data.banks || []);
      if (r.data.banks?.length && !bankKey) setBankKey(r.data.banks[0].key);
    });
    api.get("/calc/params").then((r) => {
      if (r.data?.partners) setPartnerParams(r.data.partners);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!leadId) return;
    api.get(`/leads/${leadId}`).then(({ data }) =>
      setD((p) => ({
        ...p,
        name: data.name,
        salary: data.pension_salary || "",
        birth: data.birth_date ? data.birth_date.slice(0, 10) : "",
        ams2_birth_iso: data.birth_date ? data.birth_date.slice(0, 10) : "",
        bsi_birth_iso: data.birth_date ? data.birth_date.slice(0, 10) : "",
        capital_birth_iso: data.birth_date ? data.birth_date.slice(0, 10) : "",
        mestika_birth_iso: data.birth_date ? data.birth_date.slice(0, 10) : "",
      }))
    ).catch(() => toast.error("Leads tidak ditemukan atau bukan milik Anda"));
  }, [leadId]);

  const isBsi = bankKey === "bsi_prapen";
  const isAms2 = bankKey === "ams2";
  const isCapital = bankKey === "bank_capital";
  const isMestika = bankKey === "bank_mestika";

  const base = () => ({
    bank_key: bankKey,
    name: d.name,
    birth_date: isCapital
      ? d.capital_birth_iso
      : isMestika
      ? d.mestika_birth_iso
      : isBsi
      ? d.bsi_birth_iso
      : isAms2
      ? (d.ams2_birth_iso || ddmmyyyyToIso(d.birth))
      : ddmmyyyyToIso(d.birth),
    salary: Number(d.salary || 0),
    take_over: isCapital
      ? 0
      : isBsi
      ? Number(d.pelunasan_lama || d.take_over || 0)
      : isAms2
      ? (d.ams2_takeover_type === "yes" ? Number(d.take_over || 0) : 0)
      : Number(d.take_over || 0),
    takeover_type: isAms2 ? d.ams2_takeover_type : undefined,
    pic: isAms2 ? d.ams2_pic : undefined,
    sales_manager: isAms2 ? d.ams2_sm : undefined,
    sales_manager_hp: isAms2 ? d.ams2_sm_hp : undefined,
    marketing: isAms2 ? d.ams2_marketing : undefined,
    marketing_hp: isAms2 ? d.ams2_marketing_hp : undefined,
    bsi_status_gaji: d.bsi_status_gaji,
    bsi_sub_product: d.bsi_sub_product,
    bsi_akad: d.bsi_akad,
    bsi_skema: d.bsi_skema,
    bup_age: Number(d.bup_age || 58),
    nip: d.nip,
    gaji_pokok: Number(d.gaji_pokok || 0),
    uang_makan: Number(d.uang_makan || 0),
    tunjangan_rutin_1: Number(d.tunjangan_rutin_1 || 0),
    tunjangan_rutin_3: Number(d.tunjangan_rutin_3 || 0),
    tunjangan_lain_1: Number(d.tunjangan_lain_1 || 0),
    tht: Number(d.tht || 0),
    pension_salary: Number(d.pension_salary || 0),
    bsi_tmt_bekerja: d.tmt_bekerja,
    tmt_bekerja: d.tmt_bekerja,
    tmt_pensiun_year: Number(d.tmt_pensiun_year || 0),
    bsi_price_aktif: Number(String(d.bsi_price_aktif || "0").replace(",", ".")) || 0,
    bsi_price_pensiun: Number(String(d.bsi_price_pensiun || "0").replace(",", ".")) || 0,
    bsi_proyeksi_cair: d.bsi_proyeksi_cair,
    bsi_start_angsuran: d.bsi_start_angsuran,
    bsi_manual_insurance: Number(d.bsi_manual_insurance || 0),
    buka_blokir_lama: Number(d.buka_blokir_lama || 0),
    pelunasan_lama: Number(d.pelunasan_lama || d.take_over || 0),
    angsuran_bsi: Number(d.angsuran_bsi || 0),
    angsuran_selain_bsi: Number(d.angsuran_selain_bsi || 0),
    // Calc Capital fields:
    capital_product: d.capital_product,
    tmt_pensiun_date: d.capital_product === "pensiun" ? "" : d.capital_tmt_iso,
    capital_payment_type: d.capital_product === "pensiun" ? "non" : d.capital_payment_type,
    capital_gp_manual: d.capital_product === "pensiun" ? "" : d.capital_gp_manual,
    process_date: isMestika
      ? d.mestika_process_iso
      : isBsi
      ? (d.bsi_proyeksi_cair || todayIsoLocal())
      : isAms2
      ? (d.ams2_process_iso || todayIsoLocal())
      : d.capital_process_iso,
    // Bank Mestika (TBA-MSTK 1.0) fields:
    mestika_salary_type: d.mestika_salary_type,
    mestika_has_dependents: d.mestika_has_dependents,
    mestika_dependent_type: d.mestika_has_dependents === "ada" ? d.mestika_dependent_type : "",
  });

  const reset = () => {
    setMx(null);
    setRes(null);
    setSim(null);
    setSimStatus("");
    setAms2Error("");
    setCapError("");
    setMestikaError("");
    setBsiError("");
  };

  const approve = async () => {
    setBusy("approve");
    try {
      const { data } = await api.post(`/simulations/${sim.id}/approve`, { phone: phone || null });
      toast.success(`Pengajuan ${data.app_no} dibuat. Lanjutkan upload dokumen.`);
      nav(`/progress?app=${data.id}`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); }
  };

  const cancel = async () => {
    try {
      await api.post(`/simulations/${sim.id}/cancel`);
      setSimStatus("dibatalkan");
      toast.info("Pengajuan dibatalkan. Simulasi tetap tersimpan.");
    } catch (err) { toast.error(errMsg(err)); }
  };

  const calcMax = async (e) => {
    e.preventDefault();
    if (!ddmmyyyyToIso(d.birth)) return toast.error("Pilih atau isi Tanggal Lahir yang valid");
    setBusy("max"); setRes(null); setSim(null);
    try {
      const { data } = await api.post("/calc/max", base());
      setMx(data);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); }
  };

  const tlNum = tl === "" ? null : Number(String(tl).replace(",", "."));
  const tlError = isAms2 && tl !== "" && (isNaN(tlNum) || tlNum < 0 || tlNum > 3.5) ? "Tata Laksana tidak boleh negatif atau melebihi 3,5%." : "";

  const bsiRec = isBsi ? computeBsiLiveRecommendation(d, partnerParams?.bsi_prapen) : null;
  const ams2Rec = isAms2 ? computeAms2LiveRecommendation(d, partnerParams?.ams2) : null;

  const payload = () => {
    if (isAms2) {
      const usePlafond = d.ams2_req_loan ? Number(d.ams2_req_loan) : (ams2Rec?.recMaxPlafon || "");
      const useTenor = d.ams2_req_tenor ? Number(d.ams2_req_tenor) : (ams2Rec?.recMaxTenor || 120);
      return {
        ...base(),
        tata_laksana_pct: 3.5, // Otomatis 3.5% tersembunyi & digabung ke Biaya Provisi dan Akuisisi
        lead_id: leadId || null,
        bank_key: bankKey,
        dapem: dapem || null,
        plafond: usePlafond,
        tenor: useTenor,
      };
    }
    if (isBsi) {
      const usePlafond = d.bsi_req_loan ? Number(d.bsi_req_loan) : (bsiRec?.maxPlafond || "");
      const useTenor = d.bsi_req_tenor ? Number(d.bsi_req_tenor) : (bsiRec?.maxTenor || 180);
      return {
        ...base(),
        tata_laksana_pct: 0,
        lead_id: leadId || null,
        bank_key: bankKey,
        dapem: dapem || null,
        plafond: usePlafond,
        tenor: useTenor,
      };
    }
    if (isCapital) {
      return {
        ...base(),
        tata_laksana_pct: 0,
        lead_id: leadId || null,
        bank_key: bankKey,
        dapem: dapem || null,
        plafond: d.capital_req_loan ? Number(d.capital_req_loan) : "",
        tenor: d.capital_req_tenor ? Number(d.capital_req_tenor) : "",
      };
    }
    if (isMestika) {
      return {
        ...base(),
        tata_laksana_pct: 0,
        lead_id: leadId || null,
        bank_key: bankKey,
        dapem: dapem || null,
        plafond: d.mestika_req_loan ? Number(d.mestika_req_loan) : "",
        tenor: d.mestika_req_tenor ? Number(d.mestika_req_tenor) : "",
      };
    }
    return {
      ...base(),
      tata_laksana_pct: 0,
      lead_id: leadId || null,
      bank_key: bankKey,
      dapem: dapem || null,
      plafond: mode === "max" ? mx.max_plafond : Number(custom.plafond),
      tenor: mode === "max" ? mx.max_tenor : Number(custom.tenor),
    };
  };

  const capRec = isCapital ? computeCapitalRecommendation(d) : null;
  const mstRec = isMestika ? computeMestikaRecommendation(d, partnerParams?.bank_mestika) : null;

  const calcAms2Submit = async (e) => {
    if (e) e.preventDefault();
    setAms2Error("");
    const errs = [];
    if (!d.name?.trim()) errs.push("Nama lengkap debitur wajib diisi.");
    if (!parseIsoDateLocal(d.ams2_birth_iso)) errs.push("Tanggal lahir wajib diisi.");
    if (!d.salary || Number(d.salary) <= 0) errs.push("Gaji bulanan wajib diisi dan harus lebih dari Rp0.");
    if (ams2Rec && !ams2Rec.inCategory && parseIsoDateLocal(d.ams2_birth_iso)) {
      errs.push("Usia nasabah berada di luar kategori usia produk (maksimal 84 tahun).");
    }
    const usePlafond = d.ams2_req_loan ? Number(d.ams2_req_loan) : (ams2Rec?.recMaxPlafon || 0);
    const useTenor = d.ams2_req_tenor ? Number(d.ams2_req_tenor) : (ams2Rec?.recMaxTenor || 0);
    if (usePlafond <= 0) errs.push("Plafon kredit wajib diisi (atau gunakan rekomendasi plafon maksimal).");
    if (useTenor <= 0) errs.push("Tenor (bulan) wajib diisi (atau gunakan rekomendasi tenor maksimal).");
    if (errs.length > 0) {
      setAms2Error(errs.join(" "));
      toast.error(errs[0]);
      return;
    }

    setBusy("final");
    setSim(null);
    try {
      const pld = payload();
      const { data } = await api.post("/calc/preview", pld);
      setRes(data);
      setViewStage("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Simulasi AMS V2 berhasil dihitung.");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy("");
    }
  };

  const resetAms2Form = () => {
    setD({
      ...d,
      name: "",
      salary: "",
      take_over: 0,
      ams2_birth_iso: "",
      ams2_process_iso: todayIsoLocal(),
      ams2_takeover_type: "no",
      ams2_req_loan: "",
      ams2_req_tenor: "",
      ams2_pic: "MUHAMMAD TEGUH PRANADA",
      ams2_sm: "",
      ams2_sm_hp: "",
      ams2_marketing: "",
      ams2_marketing_hp: "",
    });
    reset();
    setViewStage("workspace");
  };

  const prefillAms2ChairulSaleh = () => {
    setD({
      ...d,
      name: "CHAIRUL SALEH",
      ams2_birth_iso: "1951-02-24",
      ams2_process_iso: "2026-10-26",
      salary: 2734000,
      ams2_takeover_type: "no",
      take_over: 0,
      ams2_req_loan: 143700000,
      ams2_req_tenor: "109",
      ams2_pic: "MUHAMMAD TEGUH PRANADA",
      ams2_sm: "IRFAN",
      ams2_sm_hp: "",
      ams2_marketing: "IRFAN",
      ams2_marketing_hp: "",
    });
    reset();
    toast.info("Contoh data nasabah (Chairul Saleh) berhasil dimuat.");
  };

  const calcBsiSubmit = async (e) => {
    if (e) e.preventDefault();
    setBsiError("");
    const errs = [];
    if (!d.name?.trim()) errs.push("Nama Calon Debitur wajib diisi.");
    if (!parseIsoDateLocal(d.bsi_birth_iso)) errs.push("Tanggal Lahir wajib diisi.");
    if ((bsiRec?.recognizedSalary || 0) <= 0) errs.push("Komponen Penghasilan Aktif (minimal Gaji Pokok) wajib diisi.");
    if (Number(d.pension_salary || 0) <= 0 && (bsiRec?.pensionMonths || 0) > 0) {
      errs.push("Manfaat Pensiun Bulanan wajib diisi karena tenor melewati masa pensiun (BUP).");
    }
    if (!d.bsi_price_aktif || Number(String(d.bsi_price_aktif).replace(",", ".")) <= 0) {
      errs.push("Price Saat Aktif (% p.a.) wajib diisi.");
    }
    if (!d.bsi_price_pensiun || Number(String(d.bsi_price_pensiun).replace(",", ".")) <= 0) {
      errs.push("Price Saat Pensiun (% p.a.) wajib diisi.");
    }
    if (errs.length > 0) {
      setBsiError(errs.join(" "));
      toast.error(errs[0]);
      return;
    }

    setBusy("final");
    setSim(null);
    try {
      const pld = payload();
      const [maxResp, prevResp] = await Promise.all([
        api.post("/calc/max", pld),
        api.post("/calc/preview", pld)
      ]);
      setMx(maxResp.data);
      setRes(prevResp.data);
      setViewStage("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Simulasi BSI Mitraguna Prapensiun berhasil dihitung.");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy("");
    }
  };

  const resetBsiForm = () => {
    const today = todayIsoLocal();
    setD({
      ...d,
      name: "",
      bsi_birth_iso: "",
      nip: "",
      bsi_sub_product: "PP10",
      bsi_status_gaji: "payroll",
      gaji_pokok: "",
      uang_makan: "",
      tunjangan_rutin_1: "",
      tunjangan_rutin_3: "",
      tunjangan_lain_1: "",
      tmt_bekerja: "",
      bup_age: "58",
      tmt_pensiun_year: "",
      tht: "",
      pension_salary: "",
      bsi_req_tenor: "180",
      bsi_price_aktif: "9.25",
      bsi_price_pensiun: "10.50",
      bsi_proyeksi_cair: today,
      bsi_start_angsuran: nextMonth25IsoLocal(today),
      bsi_skema: "Atribusi",
      bsi_manual_insurance: "",
      buka_blokir_lama: 0,
      pelunasan_lama: 0,
      angsuran_bsi: 0,
      angsuran_selain_bsi: 0,
      bsi_req_loan: "",
      bsi_akad: "MMQ",
      salary: "",
      take_over: 0
    });
    reset();
    setViewStage("workspace");
  };

  const prefillBsiSitiHafsah = () => {
    setD({
      ...d,
      name: "SITI HAFSAH",
      bsi_birth_iso: "1976-10-24",
      nip: "1968012220071012004",
      bsi_sub_product: "PP10",
      bsi_status_gaji: "payroll",
      gaji_pokok: 4254800,
      uang_makan: 550000,
      tunjangan_rutin_1: 3761240,
      tunjangan_rutin_3: 0,
      tunjangan_lain_1: 0,
      salary: 8134916,
      tmt_bekerja: "2007-01-01",
      bup_age: "60",
      tmt_pensiun_year: "2036",
      tht: 78600000,
      pension_salary: 4600000,
      bsi_req_tenor: "180",
      bsi_price_aktif: "9.25",
      bsi_price_pensiun: "10.50",
      bsi_proyeksi_cair: "2026-11-07",
      bsi_start_angsuran: "2026-11-01",
      bsi_skema: "Atribusi",
      bsi_manual_insurance: "",
      buka_blokir_lama: 0,
      pelunasan_lama: 0,
      angsuran_bsi: 0,
      angsuran_selain_bsi: 0,
      bsi_req_loan: 480000000,
      bsi_akad: "MMQ",
      take_over: 0
    });
    reset();
    toast.info("Contoh data nasabah berhasil dimuat. Klik 'Hitung Simulasi BSI Prapensiun'.");
  };

  const calcMestikaSubmit = async (e) => {
    if (e) e.preventDefault();
    setMestikaError("");
    const rec = computeMestikaRecommendation(d, partnerParams?.bank_mestika);
    const rawErrs = [...rec.errors];
    if (!d.name?.trim()) rawErrs.push("Nama Debitur wajib diisi.");
    if (!parseIsoDateLocal(d.mestika_birth_iso)) rawErrs.push("Tanggal Lahir wajib diisi.");
    if (!parseIsoDateLocal(d.mestika_process_iso)) rawErrs.push("Tanggal Proses wajib diisi dengan tanggal valid.");
    if (!d.salary || Number(d.salary) <= 0) {
      rawErrs.push(
        d.mestika_salary_type === "idpb"
          ? "Gaji Pokok IDPB wajib diisi dan harus lebih dari Rp0."
          : "Gaji Pensiun wajib diisi dan harus lebih dari Rp0."
      );
    }
    if (String(d.mestika_req_loan || "").trim() !== "" && Number(d.mestika_req_loan) <= 0) {
      rawErrs.push("Plafond Kredit yang Diajukan harus lebih dari Rp0.");
    }
    if (
      String(d.mestika_req_tenor || "").trim() !== "" &&
      (!Number.isInteger(Number(d.mestika_req_tenor)) || Number(d.mestika_req_tenor) <= 0)
    ) {
      rawErrs.push("Tenor Kredit yang Diajukan harus berupa bilangan bulat lebih dari 0.");
    }
    const errs = Array.from(new Set(rawErrs));
    if (errs.length || !rec.canEstimate) {
      setMestikaError(errs.join(" ") || "Data belum cukup untuk menetapkan hasil simulasi Bank Mestika.");
      setRes(null);
      setSim(null);
      return;
    }
    setBusy("final");
    setSim(null);
    try {
      const { data } = await api.post("/calc/preview", payload());
      if (data.mestika_details?.errors?.length) {
        setMestikaError(data.mestika_details.errors.join(" "));
        setRes(null);
      } else {
        setRes(data);
        setViewStage("result");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy("");
    }
  };

  const resetMestikaForm = () => {
    setD({
      ...d,
      name: "",
      salary: "",
      take_over: 0,
      mestika_birth_iso: "",
      mestika_process_iso: todayIsoLocal(),
      mestika_salary_type: "pensiun",
      mestika_has_dependents: "tidak",
      mestika_dependent_type: "istri",
      mestika_req_loan: "",
      mestika_req_tenor: "",
    });
    reset();
    setViewStage("workspace");
  };

  const calcCapitalSubmit = async (e) => {
    if (e) e.preventDefault();
    setCapError("");
    const rec = computeCapitalRecommendation(d);
    const rawErrs = [...rec.errors];
    if (!d.name?.trim()) rawErrs.push("Nama Debitur wajib diisi.");
    if (!parseIsoDateLocal(d.capital_birth_iso)) rawErrs.push("Tanggal Lahir wajib diisi.");
    if (!d.salary || Number(d.salary) <= 0) rawErrs.push("Gaji Bulanan wajib diisi dan harus lebih dari Rp0.");
    if (!d.capital_product) rawErrs.push("Produk Kredit wajib dipilih.");
    if (d.capital_product === "pra" && !d.capital_payment_type) rawErrs.push("Tipe Angsuran wajib dipilih untuk Pra Pensiun.");
    if (!parseIsoDateLocal(d.capital_process_iso)) {
      rawErrs.push("Tanggal Proses wajib diisi dengan tanggal valid.");
    }
    if (d.capital_product === "pra" && !parseIsoDateLocal(d.capital_tmt_iso)) {
      rawErrs.push("TMT Pensiun wajib diisi untuk produk Pra Pensiun.");
    }
    if (String(d.capital_req_loan || "").trim() !== "" && Number(d.capital_req_loan) <= 0) {
      rawErrs.push("Plafond Kredit yang Diajukan harus lebih dari Rp0.");
    }
    if (String(d.capital_req_tenor || "").trim() !== "" && (!Number.isInteger(Number(d.capital_req_tenor)) || Number(d.capital_req_tenor) <= 0)) {
      rawErrs.push("Tenor Kredit yang Diajukan harus berupa bilangan bulat lebih dari 0.");
    }
    const errs = Array.from(new Set(rawErrs));
    const gpManualMismatch = errs.some((er) => er.includes("Tenor GP manual") || er.includes("Tenor GP kurang"));
    if (errs.length || !rec.canEstimate || gpManualMismatch) {
      setCapError(errs.join(" ") || "Data belum cukup untuk menetapkan hasil simulasi yang valid.");
      setRes(null);
      setSim(null);
      return;
    }
    setBusy("final");
    setSim(null);
    try {
      const { data } = await api.post("/calc/preview", payload());
      if (data.capital_details?.errors?.length) {
        setCapError(data.capital_details.errors.join(" "));
        setRes(null);
      } else {
        setRes(data);
        setViewStage("result");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy("");
    }
  };

  const resetCapitalForm = () => {
    setD({
      ...d,
      name: "",
      salary: "",
      capital_birth_iso: "",
      capital_product: "",
      capital_tmt_iso: "",
      capital_payment_type: "",
      capital_gp_manual: "",
      capital_process_iso: todayIsoLocal(),
      capital_req_loan: "",
      capital_req_tenor: "",
    });
    reset();
    setViewStage("workspace");
  };

  const calcFinal = async () => {
    if (isAms2 && (tl === "" || tlError)) return toast.error(tlError || "Masukkan persentase Tata Laksana");
    if (mode === "custom" && (!custom.plafond || !custom.tenor)) return toast.error("Lengkapi plafond dan tenor");
    setBusy("final"); setSim(null);
    try {
      const { data } = await api.post("/calc/preview", payload());
      setRes(data);
      setViewStage("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); }
  };

  const backToEditSimulation = () => {
    setViewStage("workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetCurrentBankFromZero = () => {
    if (isAms2) return resetAms2Form();
    if (isBsi) return resetBsiForm();
    if (isCapital) return resetCapitalForm();
    if (isMestika) return resetMestikaForm();
    setD({ ...d, name: "", birth: "", salary: "", take_over: 0 });
    setTl("3.5");
    setMode("max");
    setCustom({ plafond: "", tenor: "" });
    reset();
    setViewStage("workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    setBusy("save");
    try {
      const { data } = await api.post("/simulations", payload());
      setSim(data);
      toast.success(`Simulasi ${data.sim_no} tersimpan`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(""); }
  };

  return (
    <div>
      <div className="lp-card mb-6 flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Logo size="md" data-testid="calc-header-logo" />
          <div className="sm:border-l sm:border-slate-200 sm:pl-5">
            <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#351080]" data-testid="calc-title">LAYANAN PENSIUNAN SuperApps Navigator</h1>
            <p className="text-xs sm:text-sm text-[#078D67]" data-testid="calc-subtitle">Your Business Partner. Growing Together. One Hand Solution.</p>
          </div>
        </div>
      </div>

      {viewStage === "hub" && (
        <section className="lp-card mb-6 p-4 sm:p-6 lp-fade" data-testid="bank-select-step">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#17223B]">
              Pilih Mitra Bank / Koperasi
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Pilih mitra penyalur kredit untuk memulai perhitungan simulasi.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {banks.map((b) => {
              const isSupported = b.supported !== false;
              const isSelected = bankKey === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  disabled={!isSupported}
                  onClick={() => {
                    if (!isSupported) return;
                    handleSelectBank(b.key);
                  }}
                  data-testid={`bank-option-${b.key}`}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                    !isSupported
                      ? "cursor-not-allowed border-slate-200/70 bg-slate-50/70 text-slate-400 opacity-60"
                      : isSelected
                      ? "border-[#078D67] bg-gradient-to-br from-[#078D67]/5 to-[#351080]/8 text-[#17223B] ring-2 ring-[#078D67]/25 shadow-sm"
                      : "border-slate-200/90 bg-white text-[#17223B] hover:border-[#351080]/50 hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <PartnerLogo bankKey={b.key} size="md" />
                    {!isSupported && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        <Lock className="h-2.5 w-2.5" /> Segera Hadir
                      </span>
                    )}
                  </div>

                  <div className="mt-3.5">
                    <div className="font-display text-base font-bold leading-snug group-hover:text-[#351080]">
                      {b.name}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                      {b.full_name || b.name}
                    </p>
                    {isSupported && (
                      <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-2.5">
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#351080] group-hover:translate-x-0.5 transition-transform">
                          Buka Simulasi <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {viewStage === "transition" && (
        <div
          className="lp-card my-8 flex min-h-[340px] flex-col items-center justify-center p-8 text-center lp-fade"
          data-testid="bank-transition-screen"
        >
          <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#351080]/10 to-[#078D67]/15 p-3 shadow-inner">
            <PartnerLogo bankKey={transitionBankKey || bankKey} size="lg" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#078D67] text-white shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          </div>
          <h2 className="mt-1 font-display text-xl font-extrabold text-[#17223B]">
            {bank?.full_name || bank?.name || "Mitra Pembiayaan"}
          </h2>
          <p className="mt-1.5 max-w-md text-xs text-slate-500">
            Memuat formulir simulasi...
          </p>
        </div>
      )}

      {viewStage === "workspace" && bank && (
        <section className="lp-card mb-6 p-3.5 sm:p-4 lp-fade" data-testid="active-partner-bar">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewStage("hub")}
                className="h-9 gap-1.5 border-slate-200 bg-white px-3 text-xs font-bold text-[#351080] hover:bg-[#351080]/5"
                data-testid="back-to-bank-hub-btn"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Ganti Mitra Bank
              </Button>
              <div className="flex items-center gap-2.5 border-l border-slate-200 pl-2.5 sm:pl-3">
                <PartnerLogo bankKey={bank.key} size="sm" />
                <span className="font-display text-sm font-bold text-[#17223B]">
                  {bank.full_name || bank.name}
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#17223B]">
              Dapem:
              <select
                value={dapem}
                onChange={(e) => setDapem(e.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-[#351080]"
                data-testid="dapem-select"
              >
                <option value="TASPEN">TASPEN</option>
                <option value="ASABRI">ASABRI</option>
              </select>
            </label>
          </div>

          {res && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#078D67]/25 bg-[#078D67]/8 px-3.5 py-2.5 text-xs">
              <span className="font-semibold text-[#17223B]">
                Mode Edit Simulasi Aktif — Ubah angka di bawah lalu klik <b>Hitung Simulasi</b> untuk memperbarui hasil.
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setViewStage("result");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="h-8 bg-[#078D67] px-3 text-xs font-bold text-white hover:bg-[#067455]"
                data-testid="return-to-last-result-btn"
              >
                Lihat Hasil Terakhir <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </section>
      )}

      {viewStage === "workspace" && bank && isCapital && (
        <div className="grid gap-6 xl:grid-cols-[440px_1fr]" data-testid="capital-calculator-layout">
          <div className="space-y-6">
            <Step n="1" title="Data Debitur &amp; Parameter PS3 Capital" testid="capital-step-1">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
                <PartnerLogo bankKey="bank_capital" size="md" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#17223B]">
                    DASA CIPTA BERKARYA PEMATANGSIANTAR
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    PS3 CAPITAL • Bank Capital Indonesia
                  </p>
                </div>
              </div>

              <form onSubmit={calcCapitalSubmit} className="space-y-4" noValidate>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cap-name" className="text-xs font-bold text-[#17223B]">Nama Debitur</Label>
                    <Input
                      id="cap-name"
                      required
                      placeholder="Nama sesuai identitas"
                      className="h-10 border-slate-200"
                      value={d.name}
                      onChange={(e) => { setD({ ...d, name: e.target.value }); setCapError(""); }}
                      data-testid="capital-name-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cap-birth" className="text-xs font-bold text-[#17223B]">Tanggal Lahir</Label>
                    <Input
                      id="cap-birth"
                      type="date"
                      required
                      className="h-10 border-slate-200 lp-num"
                      value={d.capital_birth_iso}
                      onChange={(e) => { setD({ ...d, capital_birth_iso: e.target.value }); setCapError(""); }}
                      data-testid="capital-birth-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-[#17223B]">Gaji Bulanan (Rp)</Label>
                    <CurrencyInput
                      required
                      placeholder="0"
                      value={d.salary}
                      onChange={(v) => { setD({ ...d, salary: v }); setCapError(""); }}
                      data-testid="capital-salary-input"
                    />
                  </div>

                  <div className={cn("space-y-1.5", d.capital_product !== "pra" && "sm:col-span-2")}>
                    <Label htmlFor="cap-product" className="text-xs font-bold text-[#17223B]">Produk Kredit</Label>
                    <select
                      id="cap-product"
                      required
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-[#17223B]"
                      value={d.capital_product}
                      onChange={(e) => {
                        const prod = e.target.value;
                        setD({
                          ...d,
                          capital_product: prod,
                          capital_tmt_iso: prod === "pensiun" ? "" : d.capital_tmt_iso,
                          capital_payment_type: prod === "pensiun" ? "non" : (d.capital_product === "pensiun" ? "" : d.capital_payment_type),
                          capital_gp_manual: prod === "pensiun" ? "" : d.capital_gp_manual,
                        });
                        reset();
                      }}
                      data-testid="capital-product-select"
                    >
                      <option value="">Pilih produk</option>
                      <option value="pra">Pra Pensiun</option>
                      <option value="pensiun">Pensiun</option>
                    </select>
                  </div>

                  {d.capital_product === "pra" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="cap-tmt" className="text-xs font-bold text-[#17223B]">TMT Pensiun</Label>
                      <Input
                        id="cap-tmt"
                        type="date"
                        required
                        className="h-10 border-slate-200 lp-num"
                        value={d.capital_tmt_iso}
                        onChange={(e) => { setD({ ...d, capital_tmt_iso: e.target.value }); setCapError(""); }}
                        data-testid="capital-tmt-input"
                      />
                    </div>
                  )}

                  {d.capital_product === "pra" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="cap-paytype" className="text-xs font-bold text-[#17223B]">Tipe Angsuran</Label>
                      <select
                        id="cap-paytype"
                        required
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-[#17223B]"
                        value={d.capital_payment_type}
                        onChange={(e) => { setD({ ...d, capital_payment_type: e.target.value }); setCapError(""); }}
                        data-testid="capital-payment-type-select"
                      >
                        <option value="">Pilih tipe angsuran</option>
                        <option value="gp">Grace Period</option>
                        <option value="non">Non Grace Period</option>
                      </select>
                    </div>
                  )}

                  {d.capital_product === "pra" && d.capital_payment_type === "gp" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="cap-gp" className="text-xs font-bold text-[#17223B]">Tenor GP Manual (bulan, opsional)</Label>
                      <Input
                        id="cap-gp"
                        type="number"
                        min="1"
                        max="48"
                        step="1"
                        placeholder="Kosongkan untuk otomatis"
                        className="h-10 border-slate-200 lp-num"
                        value={d.capital_gp_manual}
                        onChange={(e) => { setD({ ...d, capital_gp_manual: e.target.value }); setCapError(""); }}
                        data-testid="capital-gp-manual-input"
                      />
                      <small className="block text-[11px] text-slate-500">
                        Otomatis memakai nilai lebih kecil antara Tenor PP dan 48 bulan.
                      </small>
                    </div>
                  )}

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cap-proc" className="text-xs font-bold text-[#17223B]">Tanggal Proses</Label>
                    <Input
                      id="cap-proc"
                      type="date"
                      required
                      className="h-10 border-slate-200 lp-num"
                      value={d.capital_process_iso}
                      onChange={(e) => { setD({ ...d, capital_process_iso: e.target.value }); setCapError(""); }}
                      data-testid="capital-process-date-input"
                    />
                    <small className="block text-[11px] text-slate-500">Diisi otomatis hari ini, dapat disesuaikan.</small>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="mb-3">
                    <h3 className="font-display text-sm font-bold text-[#17223B]">Rincian Pengajuan Khusus (Opsional)</h3>
                    <p className="text-[11px] text-slate-500">
                      Kosongkan pengajuan bila ingin memakai nilai rekomendasi maksimal yang tampil di bawah kolom.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-[#17223B]">Plafond Kredit Diajukan (Rp)</Label>
                      <CurrencyInput
                        placeholder="Kosongkan untuk rekomendasi"
                        value={d.capital_req_loan}
                        onChange={(v) => { setD({ ...d, capital_req_loan: v }); setCapError(""); }}
                        data-testid="capital-requested-loan-input"
                      />
                      <small className="block text-[11px] font-semibold text-[#07887E]" data-testid="capital-loan-recommendation">
                        {capRec?.maxLoan !== null
                          ? `Rekomendasi max: ${rp(capRec.maxLoan)}${d.capital_req_loan ? " (manual)" : ""}`
                          : "Lengkapi data simulasi"}
                      </small>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cap-tenor" className="text-xs font-bold text-[#17223B]">Tenor Kredit Diajukan (bln)</Label>
                      <Input
                        id="cap-tenor"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Kosongkan untuk rekomendasi"
                        className="h-10 border-slate-200 lp-num"
                        value={d.capital_req_tenor}
                        onChange={(e) => { setD({ ...d, capital_req_tenor: e.target.value.replace(/\D/g, "") }); setCapError(""); }}
                        data-testid="capital-requested-tenor-input"
                      />
                      <small className="block text-[11px] font-semibold text-[#07887E]" data-testid="capital-tenor-recommendation">
                        {capRec?.maxCreditMonths > 0
                          ? `Rekomendasi max: ${capRec.maxCreditMonths.toLocaleString("id-ID")} bln${d.capital_req_tenor ? " (manual)" : ""}`
                          : "Isi tanggal lahir"}
                      </small>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <Button
                    type="submit"
                    disabled={busy === "final"}
                    className="h-11 flex-1 bg-[#07887E] font-bold text-white hover:bg-[#06746b]"
                    data-testid="capital-submit-button"
                  >
                    {busy === "final" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Hitung Simulasi PS3 Capital
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetCapitalForm}
                    className="h-11 border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                    data-testid="capital-reset-button"
                  >
                    Atur Ulang
                  </Button>
                </div>
              </form>
            </Step>
          </div>

          <div className="space-y-6">
            {/* Dark-Teal Recommendation Panel with Partner Identity */}
            <section
              className="rounded-xl bg-gradient-to-br from-[#123d39] to-[#07887e] p-5 sm:p-6 text-white shadow-sm"
              data-testid="capital-recommend-card"
            >
              <div className="mb-4 flex items-center justify-between border-b border-white/15 pb-3">
                <div className="flex items-center gap-2.5">
                  <PartnerLogo bankKey="bank_capital" size="sm" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#9de6dc]">
                      Rekomendasi Plafon &amp; Tenor Maksimal
                    </p>
                    <h2 className="font-display text-base font-bold text-white">
                      Estimasi Batas Pengajuan PS3 Capital
                    </h2>
                  </div>
                </div>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  Batas Usia 75 Thn
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="rounded-lg border border-white/15 bg-white/10 p-3">
                  <span className="block text-xs text-white/75">Tenor Kredit Maksimal</span>
                  <strong className="mt-1 block text-base font-bold lp-num" data-testid="recommend-max-tenor">
                    {capRec?.maxCreditMonths > 0 ? `${capRec.maxCreditMonths.toLocaleString("id-ID")} bulan` : "—"}
                  </strong>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/10 p-3">
                  <span className="block text-xs text-white/75">Batas Angsuran (90% gaji)</span>
                  <strong className="mt-1 block text-base font-bold lp-num" data-testid="recommend-payment-cap">
                    {Number(d.salary) > 0 ? rp(Number(d.salary) * 0.9) : "—"}
                  </strong>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/10 p-3">
                  <span className="block text-xs text-white/75">Tenor Diajukan</span>
                  <strong className="mt-1 block text-base font-bold lp-num" data-testid="recommend-gp-pv">
                    {d.capital_req_tenor
                      ? `${Number(d.capital_req_tenor).toLocaleString("id-ID")} bulan`
                      : capRec?.maxCreditMonths > 0
                      ? `${capRec.maxCreditMonths.toLocaleString("id-ID")} bulan`
                      : "—"}
                  </strong>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/15 p-3">
                  <span className="block text-xs text-white/80">Plafon Maksimal</span>
                  <strong className="mt-1 block text-lg font-extrabold text-[#b9fff5] lp-num" data-testid="recommend-max-loan">
                    {capRec?.maxLoan !== null ? rp(capRec.maxLoan) : "—"}
                  </strong>
                </div>
              </div>
              {capRec?.errors?.length > 0 && (
                <div className="mt-3 rounded-lg bg-black/20 p-2.5 text-xs leading-relaxed text-amber-200" data-testid="recommend-errors">
                  {capRec.errors.join(" ")}
                </div>
              )}
            </section>

            {/* Result Card using lp-card */}
            <div className="lp-card p-4 sm:p-6 lp-fade" aria-live="polite">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <PartnerLogo bankKey="bank_capital" size="sm" />
                  <div>
                    <p className="lp-eyebrow text-[#07887E]">Hasil Simulasi Perhitungan</p>
                    <h2 className="font-display text-lg font-bold text-[#17223B]">Ringkasan Kredit PS3 Capital</h2>
                  </div>
                </div>
                {sim && (
                  <span className="rounded-md bg-[#07887E]/10 px-3 py-1 text-xs font-bold text-[#07887E]" data-testid="sim-number">
                    {sim.sim_no}
                  </span>
                )}
              </div>

              {!res && (
                <div
                  className={`rounded-lg border border-dashed p-8 text-center text-sm ${
                    capError ? "border-red-300 bg-red-50 text-red-700 font-semibold" : "border-slate-200 bg-slate-50/50 text-slate-500"
                  }`}
                  data-testid="capital-result-placeholder"
                >
                  {capError || "Lengkapi data debitur pada formulir di sebelah kiri, lalu tekan tombol 'Hitung Simulasi PS3 Capital'."}
                </div>
              )}

              {res && (
                <div className="space-y-6">
                  <ResultView r={res} />
                  <div className="space-y-4 pt-2">
                    {!sim && (
                      <Button
                        onClick={save}
                        disabled={busy === "save"}
                        className="h-11 w-full bg-[#07887E] font-bold text-white hover:bg-[#06746b]"
                        data-testid="calc-save-button"
                      >
                        {busy === "save" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Simpan Simulasi &amp; Unduh PDF
                          </>
                        )}
                      </Button>
                    )}
                    {sim && (
                      <>
                        <DownloadActions sim={sim} />
                        <div className="rounded-xl border border-slate-200 p-4" data-testid="sim-approval-panel">
                          <p className="font-display text-sm font-bold text-[#17223B]">Persetujuan Simulasi</p>
                          {simStatus === "dibatalkan" ? (
                            <p className="mt-2 text-sm text-slate-500" data-testid="sim-cancelled">Pengajuan dibatalkan.</p>
                          ) : (
                            <>
                              {!leadId && (
                                <div className="mt-3 max-w-xs space-y-1.5">
                                  <Label htmlFor="cap-phone" className="text-xs">No. telepon calon debitur (untuk data leads)</Label>
                                  <Input id="cap-phone" inputMode="tel" className="h-9" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="approve-phone-input" />
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button onClick={approve} disabled={busy === "approve"} className="bg-[#07887E] hover:bg-[#06746b] font-bold" data-testid="approve-sim-button">
                                  Setujui Simulasi &amp; Lanjut Pengajuan
                                </Button>
                                <Button variant="outline" onClick={cancel} className="text-red-600 font-semibold" data-testid="cancel-sim-button">
                                  Batalkan Pengajuan
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                        <AiSummary sim={sim} />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewStage === "workspace" && bank && isMestika && (
        <div className="grid gap-6 xl:grid-cols-[440px_1fr]" data-testid="mestika-calculator-layout">
          <div className="space-y-6">
            <Step n="1" title="Data Debitur &amp; Parameter Bank Mestika" testid="mestika-step-1">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
                <PartnerLogo bankKey="bank_mestika" size="md" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#17223B]">
                    TIGA BERMUDA AMANAH • BANK MESTIKA
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Simulasi DASA Group (TBA-MSTK 1.0) • Kredit Pensiun &amp; Take Over
                  </p>
                </div>
              </div>

              <form onSubmit={calcMestikaSubmit} className="space-y-4" noValidate>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="mst-name" className="text-xs font-bold text-[#17223B]">Nama Debitur</Label>
                    <Input
                      id="mst-name"
                      required
                      placeholder="Nama sesuai identitas / SK Pensiun"
                      className="h-10 border-slate-200"
                      value={d.name}
                      onChange={(e) => { setD({ ...d, name: e.target.value }); setMestikaError(""); }}
                      data-testid="mestika-name-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mst-birth" className="text-xs font-bold text-[#17223B]">Tanggal Lahir</Label>
                    <Input
                      id="mst-birth"
                      type="date"
                      required
                      className="h-10 border-slate-200 lp-num"
                      value={d.mestika_birth_iso}
                      onChange={(e) => { setD({ ...d, mestika_birth_iso: e.target.value }); setMestikaError(""); }}
                      data-testid="mestika-birth-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mst-proc" className="text-xs font-bold text-[#17223B]">Tanggal Proses</Label>
                    <Input
                      id="mst-proc"
                      type="date"
                      required
                      className="h-10 border-slate-200 lp-num"
                      value={d.mestika_process_iso}
                      onChange={(e) => { setD({ ...d, mestika_process_iso: e.target.value }); setMestikaError(""); }}
                      data-testid="mestika-process-date-input"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-bold text-[#17223B]">Produk Kredit &amp; Skema Usia (Otomatis)</Label>
                    <div
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-xs font-semibold",
                        mstRec?.ready && mstRec.ageRejected
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-emerald-200/80 bg-emerald-50/70 text-[#165B26]"
                      )}
                      data-testid="mestika-auto-product"
                    >
                      <span>Kredit Pensiun</span>
                      {mstRec?.ready ? (
                        mstRec.ageRejected ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                            Usia {mstRec.ageLabel} (&ge; 69 Thn — Tidak Memenuhi)
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#1E7E34] px-2.5 py-0.5 text-[11px] font-bold text-white">
                            {mstRec.productLabel} • Rate {mstRec.rateAnnual}% • Biaya {mstRec.costPct}% ({mstRec.ageLabel})
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500">
                          Otomatis (&lt;65 Thn: Reguler 10% • 65–&lt;69 Thn: Reguler Plus 12%)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="mst-salary-type" className="text-xs font-bold text-[#17223B]">Pilihan Jenis Gaji</Label>
                    <select
                      id="mst-salary-type"
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#17223B]"
                      value={d.mestika_salary_type}
                      onChange={(e) => {
                        setD({ ...d, mestika_salary_type: e.target.value });
                        setMestikaError("");
                      }}
                      data-testid="mestika-salary-type-select"
                    >
                      <option value="pensiun">Sesuai Gaji Pensiun</option>
                      <option value="idpb">Sesuai Gaji IDPB</option>
                    </select>
                  </div>

                  {d.mestika_salary_type === "pensiun" ? (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-[#17223B]">Gaji Pensiun (Rp)</Label>
                        <CurrencyInput
                          required
                          placeholder="0"
                          value={d.salary}
                          onChange={(v) => { setD({ ...d, salary: v }); setMestikaError(""); }}
                          data-testid="mestika-salary-input"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-[#165B26]">
                          Estimasi Gaji Pokok (-{mstRec?.deductionPct ?? 13}%)
                        </Label>
                        <div
                          className="flex h-10 items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/60 px-3 text-xs font-bold text-[#165B26] lp-num"
                          data-testid="mestika-estimated-basic-salary"
                        >
                          <span>{Number(d.salary) > 0 ? rp(Math.round(mstRec?.basicSalary || 0)) : "Rp0"}</span>
                          <span className="rounded bg-[#1E7E34]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#165B26]">
                            -{mstRec?.deductionPct ?? 13}%
                          </span>
                        </div>
                      </div>
                      <small className="block text-[11px] text-slate-500 sm:col-span-2">
                        DSR 99% dihitung dari Estimasi Gaji Pokok (Gaji Pensiun dikurangi {mstRec?.deductionPct ?? 13}%).
                      </small>
                    </>
                  ) : (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-[#17223B]">Gaji Pokok IDPB (Rp)</Label>
                      <CurrencyInput
                        required
                        placeholder="0"
                        value={d.salary}
                        onChange={(v) => { setD({ ...d, salary: v }); setMestikaError(""); }}
                        data-testid="mestika-idpb-salary-input"
                      />
                      <small className="block text-[11px] font-semibold text-[#165B26]" data-testid="mestika-idpb-hint">
                        Input Gaji Pokok sesuai IDPB (Tanpa Tanggungan)
                      </small>
                    </div>
                  )}

                  <div className={cn("space-y-1.5", d.mestika_has_dependents !== "ada" && "sm:col-span-2")}>
                    <Label htmlFor="mst-has-dep" className="text-xs font-bold text-[#17223B]">Status Tanggungan</Label>
                    <select
                      id="mst-has-dep"
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-[#17223B]"
                      value={d.mestika_has_dependents}
                      onChange={(e) => {
                        setD({ ...d, mestika_has_dependents: e.target.value });
                        setMestikaError("");
                      }}
                      data-testid="mestika-dependents-select"
                    >
                      <option value="tidak">Tidak Ada Tanggungan</option>
                      <option value="ada">Ada Tanggungan</option>
                    </select>
                  </div>

                  {d.mestika_has_dependents === "ada" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="mst-dep-type" className="text-xs font-bold text-[#17223B]">Rincian Tanggungan</Label>
                      <select
                        id="mst-dep-type"
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-[#17223B]"
                        value={d.mestika_dependent_type}
                        onChange={(e) => {
                          setD({ ...d, mestika_dependent_type: e.target.value });
                          setMestikaError("");
                        }}
                        data-testid="mestika-dependent-type-select"
                      >
                        <option value="istri">Hanya Istri</option>
                        <option value="istri_anak_1">Istri dan Anak 1</option>
                        <option value="istri_anak_2">Istri dan Anak 2</option>
                        <option value="istri_anak_3">Istri dan Anak 3</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="mb-3">
                    <h3 className="font-display text-sm font-bold text-[#17223B]">Pengajuan &amp; Take Over (Opsional)</h3>
                    <p className="text-[11px] text-slate-500">
                      Kosongkan Plafond/Tenor bila ingin menggunakan nilai maksimal otomatis. Isi Take Over bila menutup pinjaman lama (misal TO BWS).
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-[#17223B]">Plafond Diajukan (Rp)</Label>
                      <CurrencyInput
                        placeholder="Kosongkan untuk maks"
                        value={d.mestika_req_loan}
                        onChange={(v) => { setD({ ...d, mestika_req_loan: v }); setMestikaError(""); }}
                        data-testid="mestika-requested-loan-input"
                      />
                      <small className="block text-[11px] font-semibold text-[#1E7E34]" data-testid="mestika-loan-recommendation">
                        {mstRec?.maxPlafond !== null && mstRec?.maxPlafond !== undefined
                          ? `Maks: ${rp(Math.round(mstRec.maxPlafond))}${d.mestika_req_loan ? " (manual)" : ""}`
                          : "Lengkapi tanggal lahir & gaji"}
                      </small>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="mst-tenor" className="text-xs font-bold text-[#17223B]">Tenor Diajukan (bln)</Label>
                      <Input
                        id="mst-tenor"
                        type="number"
                        min="1"
                        max="240"
                        step="1"
                        placeholder="Kosongkan untuk maks"
                        className="h-10 border-slate-200 lp-num"
                        value={d.mestika_req_tenor}
                        onChange={(e) => { setD({ ...d, mestika_req_tenor: e.target.value.replace(/\D/g, "") }); setMestikaError(""); }}
                        data-testid="mestika-requested-tenor-input"
                      />
                      <small className="block text-[11px] font-semibold text-[#1E7E34]" data-testid="mestika-tenor-recommendation">
                        {mstRec?.maxTenor > 0
                          ? `Maks: ${mstRec.maxTenor} bln${d.mestika_req_tenor ? " (manual)" : ""}`
                          : "Isi tanggal lahir"}
                      </small>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-[#17223B]">Nominal Pelunasan Take Over / TO (Rp, Opsional)</Label>
                      <CurrencyInput
                        placeholder="0 (kosongkan jika tanpa Take Over)"
                        value={d.take_over}
                        onChange={(v) => { setD({ ...d, take_over: v }); setMestikaError(""); }}
                        data-testid="mestika-takeover-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <Button
                    type="submit"
                    disabled={busy === "final"}
                    className="h-11 flex-1 bg-[#1E7E34] font-bold text-white hover:bg-[#165B26]"
                    data-testid="mestika-submit-button"
                  >
                    {busy === "final" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Hitung Simulasi Bank Mestika
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetMestikaForm}
                    className="h-11 border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                    data-testid="mestika-reset-button"
                  >
                    Atur Ulang
                  </Button>
                </div>
              </form>
            </Step>
          </div>

          <div className="space-y-6">
            {/* Emerald-Forest Recommendation Panel with Tiga Bermuda Amanah Identity */}
            <section
              className="rounded-2xl bg-gradient-to-br from-[#165B26] to-[#1E7E34] p-5 sm:p-6 text-white shadow-sm"
              data-testid="mestika-recommendation-panel"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PartnerLogo bankKey="bank_mestika" size="sm" className="ring-2 ring-white/25" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-200">
                      PARAMETER &amp; ALTERNATIF PLAFOND (TBA-MSTK 1.0)
                    </p>
                    <h2 className="font-display text-base sm:text-lg font-bold text-white">
                      Estimasi Batas Pengajuan Bank Mestika
                    </h2>
                  </div>
                </div>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-50">
                  Usia Lunas s.d. 80 Thn (79 Thn 11 Bln)
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/15 bg-white/10 p-3.5">
                  <span className="block text-xs text-emerald-100/85">Maksimal Tenor (Maks 20 Thn)</span>
                  <strong className="mt-1 block font-display text-lg font-bold lp-num">
                    {mstRec?.maxTenor > 0
                      ? `${mstRec.maxTenor} bulan`
                      : "—"}
                  </strong>
                  {mstRec?.remainingAgeMonths > 0 && (
                    <span className="mt-0.5 block text-[11px] text-emerald-100/80 lp-num">
                      Sisa usia s.d. 79 thn 11 bln: {mstRec.remainingAgeMonths} bln
                    </span>
                  )}
                </div>
                <div className="rounded-xl border border-white/15 bg-white/10 p-3.5">
                  <span className="block text-xs text-emerald-100/85">
                    Batas Angsuran (DSR {mstRec?.dsrPct ?? 99}% Gaji Pokok)
                  </span>
                  <strong className="mt-1 block font-display text-lg font-bold lp-num">
                    {Number(d.salary) > 0 ? rp(Math.round(mstRec?.paymentCap || 0)) : "—"}
                  </strong>
                  {Number(d.salary) > 0 && (
                    <span className="mt-0.5 block text-[11px] text-emerald-100/80 lp-num">
                      Gaji Pokok diakui: {rp(Math.round(mstRec?.basicSalary || 0))}
                    </span>
                  )}
                </div>
                <div className="rounded-xl border border-white/15 bg-white/10 p-3.5">
                  <span className="block text-xs text-emerald-100/85">Maksimal Plafond (Batas Plafond)</span>
                  <strong className="mt-1 block font-display text-lg font-bold text-emerald-100 lp-num">
                    {mstRec?.maxPlafond !== null && mstRec?.maxPlafond !== undefined
                      ? rp(Math.round(mstRec.maxPlafond))
                      : "—"}
                  </strong>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/10 p-3.5">
                  <span className="block text-xs text-emerald-100/85">Alternatif Plafond (PV Murni 99%)</span>
                  <strong className="mt-1 block font-display text-lg font-bold text-amber-200 lp-num">
                    {mstRec?.altPlafond !== null && mstRec?.altPlafond !== undefined
                      ? rp(Math.round(mstRec.altPlafond))
                      : "—"}
                  </strong>
                </div>
              </div>
            </section>

            {/* Error Alert */}
            {mestikaError && (
              <div
                className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-medium text-red-700"
                data-testid="mestika-error-box"
              >
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                <div>{mestikaError}</div>
              </div>
            )}

            {/* Final Result Section */}
            <div className="lp-card p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <PartnerLogo bankKey="bank_mestika" size="sm" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1E7E34]">
                      HASIL SIMULASI PERHITUNGAN
                    </p>
                    <h2 className="font-display text-lg font-bold text-[#17223B]">
                      Ringkasan Kredit Bank Mestika (TBA-MSTK 1.0)
                    </h2>
                  </div>
                </div>
                {sim && (
                  <span className="rounded-md bg-[#1E7E34]/10 px-3 py-1 text-xs font-bold text-[#165B26]" data-testid="sim-number">
                    {sim.sim_no}
                  </span>
                )}
              </div>

              {!res ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-sm text-slate-500">
                  Lengkapi data debitur pada formulir di sebelah kiri, lalu tekan tombol &apos;Hitung Simulasi Bank Mestika&apos;.
                </div>
              ) : (
                <div className="space-y-6 lp-fade">
                  <ResultView r={res} />

                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    {!sim && (
                      <Button
                        onClick={save}
                        disabled={busy === "save"}
                        className="h-11 w-full bg-[#1E7E34] font-bold text-white hover:bg-[#165B26]"
                        data-testid="calc-save-button"
                      >
                        {busy === "save" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Simpan Simulasi Bank Mestika
                          </>
                        )}
                      </Button>
                    )}

                    {sim && (
                      <>
                        <DownloadActions sim={sim} />
                        <div className="rounded-xl border border-slate-200 p-4" data-testid="sim-approval-panel">
                          <p className="font-display text-sm font-bold text-[#17223B]">Persetujuan Simulasi</p>
                          {simStatus === "dibatalkan" ? (
                            <p className="mt-2 text-sm text-slate-500" data-testid="sim-cancelled">Pengajuan dibatalkan.</p>
                          ) : (
                            <>
                              {!leadId && (
                                <div className="mt-3 max-w-xs space-y-1.5">
                                  <Label htmlFor="mst-phone" className="text-xs">No. telepon calon debitur (untuk data leads)</Label>
                                  <Input id="mst-phone" inputMode="tel" className="h-9" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="approve-phone-input" />
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button onClick={approve} disabled={busy === "approve"} className="bg-[#1E7E34] hover:bg-[#165B26] font-bold" data-testid="approve-sim-button">
                                  Setujui Simulasi &amp; Lanjut Pengajuan
                                </Button>
                                <Button variant="outline" onClick={cancel} className="text-red-600 font-semibold" data-testid="cancel-sim-button">
                                  Batalkan Pengajuan
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                        <AiSummary sim={sim} />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewStage === "workspace" && bank && isBsi && (
        <div className="grid gap-6 xl:grid-cols-[480px_1fr] lp-fade" data-testid="bsi-calculator-layout">
          <div className="space-y-6">
            <Step n="1" title="Formulir Simulasi Pembiayaan BSI Mitraguna Prapensiun" testid="bsi-step-1">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
                <PartnerLogo bankKey="bsi_prapen" size="md" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#17223B]">
                    PT Swara Ganiyy Utama • Bank Syariah Indonesia
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Simulasi Pembiayaan Syariah • Dekade Berkah (PP10) &amp; Tri Berkah (PP3)
                  </p>
                </div>
              </div>

              <form onSubmit={calcBsiSubmit} className="space-y-4" noValidate>
                {/* BAGIAN A: IDENTITAS, TANGGAL LAHIR (+ NOTIF UMUR), NIP, TIPE PRODUK & PAYROLL */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#078D67]">
                      A. Identitas, Usia &amp; Skema Produk
                    </span>
                  </div>

                  {/* 1. Nama */}
                  <div className="space-y-1.5">
                    <Label htmlFor="bsi-name" className="text-xs font-bold text-[#17223B]">
                      1. Nama Calon Nasabah
                    </Label>
                    <Input
                      id="bsi-name"
                      required
                      placeholder="Nama lengkap sesuai KTP / SK"
                      className="h-10 border-slate-200 text-xs font-semibold"
                      value={d.name}
                      onChange={(e) => { setD({ ...d, name: e.target.value }); setBsiError(""); reset(); }}
                      data-testid="calc-name-input"
                    />
                  </div>

                  {/* 2. Tanggal Lahir (Format Date Picker sama seperti Bank Capital & Mestika) + 3. NIP */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-birth" className="text-xs font-bold text-[#17223B]">
                        2. Tanggal Lahir
                      </Label>
                      <Input
                        id="bsi-birth"
                        type="date"
                        required
                        className="h-10 border-slate-200 lp-num text-xs font-semibold"
                        value={d.bsi_birth_iso}
                        onChange={(e) => {
                          const iso = e.target.value;
                          const dobObj = parseIsoDateLocal(iso);
                          const nextBupYr = dobObj ? String(dobObj.getFullYear() + Number(d.bup_age || 58)) : d.tmt_pensiun_year;
                          setD({ ...d, bsi_birth_iso: iso, birth: iso, tmt_pensiun_year: nextBupYr });
                          setBsiError("");
                          reset();
                        }}
                        data-testid="bsi-birth-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-nip" className="text-xs font-bold text-[#17223B]">
                        3. NIP Pegawai
                      </Label>
                      <Input
                        id="bsi-nip"
                        placeholder="18 digit NIP (opsional)"
                        className="h-10 border-slate-200 font-mono text-xs"
                        value={d.nip}
                        onChange={(e) => setD({ ...d, nip: e.target.value })}
                        data-testid="bsi-nip-input"
                      />
                    </div>
                  </div>

                  {/* NOTIFIKASI UMUR & REKOMENDASI USIA NASABAH OTOMATIS */}
                  {bsiRec?.ready && (
                    <div
                      className={cn(
                        "rounded-xl border p-3.5 text-xs transition-all lp-fade",
                        bsiRec.ageStatusTone === "red"
                          ? "border-red-200 bg-red-50/90 text-red-900"
                          : bsiRec.ageStatusTone === "amber"
                          ? "border-amber-200 bg-amber-50/90 text-amber-900"
                          : "border-[#078D67]/25 bg-gradient-to-br from-[#078D67]/8 to-emerald-50/80 text-[#17223B]"
                      )}
                      data-testid="bsi-age-notification-card"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-black/10 pb-2">
                        <div className="flex items-center gap-2">
                          <UserCheck
                            className={cn(
                              "h-4 w-4 shrink-0",
                              bsiRec.ageStatusTone === "red"
                                ? "text-red-600"
                                : bsiRec.ageStatusTone === "amber"
                                ? "text-amber-600"
                                : "text-[#078D67]"
                            )}
                          />
                          <span className="font-display font-bold">
                            {bsiRec.ageRecommendationTitle}
                          </span>
                        </div>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-extrabold text-[#351080] shadow-2xs lp-num">
                          Simas Nearest: {bsiRec.nearestAge} Thn
                        </span>
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div className="rounded-lg bg-white/75 p-2 border border-black/5">
                          <span className="block text-[10px] text-slate-500">Usia Eksak</span>
                          <strong className="mt-0.5 block text-[11px] font-bold text-[#17223B] lp-num" data-testid="bsi-exact-age-text">
                            {bsiRec.ageObj.exactText}
                          </strong>
                        </div>
                        <div className="rounded-lg bg-white/75 p-2 border border-black/5">
                          <span className="block text-[10px] text-slate-500">Sisa Aktif ke BUP ({bsiRec.targetBupYear})</span>
                          <strong className="mt-0.5 block text-[11px] font-bold text-[#078D67] lp-num" data-testid="bsi-months-to-bup">
                            {bsiRec.actualMonthsToBup} Bulan
                          </strong>
                        </div>
                        <div className="col-span-2 sm:col-span-1 rounded-lg bg-white/75 p-2 border border-black/5">
                          <span className="block text-[10px] text-slate-500">Maks Tenor Usia (74th 4bln)</span>
                          <strong className="mt-0.5 block text-[11px] font-bold text-[#351080] lp-num" data-testid="bsi-max-age-tenor">
                            {bsiRec.maxTenor} Bulan (Maks UP Rp{(bsiRec.maxUpAllowed / 1e6).toFixed(0)} Jt)
                          </strong>
                        </div>
                      </div>

                      <p className="mt-2 text-[11px] leading-relaxed opacity-90">
                        {bsiRec.ageRecommendationDetail}
                      </p>

                      {bsiRec.recommendedSubProduct === "PP10" && d.bsi_sub_product !== "PP10" && (
                        <button
                          type="button"
                          onClick={() => {
                            setD({
                              ...d,
                              bsi_sub_product: "PP10",
                              bsi_status_gaji: d.bsi_status_gaji === "non_payroll" ? "payroll" : d.bsi_status_gaji
                            });
                            reset();
                          }}
                          className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#078D67] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#067455]"
                          data-testid="bsi-apply-age-rec-btn"
                        >
                          Terapkan Rekomendasi: 1. Prapen 10 Tahun (PP10)
                        </button>
                      )}
                      {bsiRec.recommendedSubProduct === "PP3" && d.bsi_sub_product !== "PP3" && (
                        <button
                          type="button"
                          onClick={() => {
                            setD({ ...d, bsi_sub_product: "PP3" });
                            reset();
                          }}
                          className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#351080] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#2a0c66]"
                          data-testid="bsi-apply-age-rec-btn"
                        >
                          Opsional: Gunakan 2. Prapen 3 Tahun (PP3 Pokok Aktif Rp10rb)
                        </button>
                      )}
                    </div>
                  )}

                  {/* 4. Tipe Produk & 5. Status Payroll */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-sub-product" className="text-xs font-bold text-[#17223B]">
                        4. Tipe Produk
                      </Label>
                      <select
                        id="bsi-sub-product"
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#17223B] focus:border-[#078D67] focus:outline-none"
                        value={d.bsi_sub_product}
                        onChange={(e) => {
                          const sub = e.target.value;
                          const nextStatus = sub === "PP10" && d.bsi_status_gaji === "non_payroll" ? "payroll" : d.bsi_status_gaji;
                          setD({ ...d, bsi_sub_product: sub, bsi_status_gaji: nextStatus });
                          setBsiError("");
                          reset();
                        }}
                        data-testid="bsi-sub-product-select"
                      >
                        <option value="PP10">1. Prapen 10 Tahun (Dekade Berkah)</option>
                        <option value="PP3">2. Prapen 3 Tahun (Tri Berkah)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-status-gaji" className="text-xs font-bold text-[#17223B]">
                        5. Status Payroll
                      </Label>
                      <select
                        id="bsi-status-gaji"
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#17223B] focus:border-[#078D67] focus:outline-none"
                        value={d.bsi_status_gaji}
                        onChange={(e) => {
                          const stat = e.target.value;
                          const nextSub = stat === "non_payroll" ? "PP3" : d.bsi_sub_product;
                          setD({ ...d, bsi_status_gaji: stat, bsi_sub_product: nextSub });
                          setBsiError("");
                          reset();
                        }}
                        data-testid="bsi-status-gaji-select"
                      >
                        <option value="payroll">Payroll (DBR 70%)</option>
                        <option value="comitted_payroll">Comitted Payroll (DBR 70%)</option>
                        <option value="non_payroll">Non Payroll (DBR 50% • Khusus PP3)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* BAGIAN B: KOMPONEN PENGHASILAN AKTIF (Urutan Akseptasi Baris 6) */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#078D67]">
                        B. 6. Komponen Penghasilan Masa Aktif (Bobot Resmi BSI)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Gaji Pokok 100% • Uang Makan 90% • Tunj. Rutin 1 Bln 90% • Tunj. 3 Bln 50% • Tunj. Lain 80%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-[#17223B]">Gaji Pokok (Diakui 100%)</Label>
                      <CurrencyInput
                        required
                        value={d.gaji_pokok}
                        onChange={(v) => handleGajiComponentChange("gaji_pokok", v)}
                        placeholder="0"
                        data-testid="bsi-gaji-pokok-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Uang Makan (Diakui 90%)</Label>
                      <CurrencyInput
                        value={d.uang_makan}
                        onChange={(v) => handleGajiComponentChange("uang_makan", v)}
                        placeholder="0"
                        data-testid="bsi-uang-makan-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Tunjangan Rutin Tiap 1 Bulan (90%)</Label>
                      <CurrencyInput
                        value={d.tunjangan_rutin_1}
                        onChange={(v) => handleGajiComponentChange("tunjangan_rutin_1", v)}
                        placeholder="0"
                        data-testid="bsi-tunjangan-1-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Tunjangan Rutin Tiap 3 Bulan (50%)</Label>
                      <CurrencyInput
                        value={d.tunjangan_rutin_3}
                        onChange={(v) => handleGajiComponentChange("tunjangan_rutin_3", v)}
                        placeholder="0"
                        data-testid="bsi-tunjangan-3-input"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-semibold text-slate-700">Tunjangan Lain Tiap 1 Bulan (80%)</Label>
                      <CurrencyInput
                        value={d.tunjangan_lain_1}
                        onChange={(v) => handleGajiComponentChange("tunjangan_lain_1", v)}
                        placeholder="0"
                        data-testid="bsi-tunjangan-lain-input"
                      />
                    </div>
                  </div>

                  {/* Ringkasan Penghasilan Aktif Diakui & Akseptasi Aktif */}
                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs sm:grid-cols-2">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase text-slate-500">
                        Total Penghasilan Diakui
                      </span>
                      <strong className="mt-0.5 block text-sm font-extrabold text-[#17223B] lp-num" data-testid="bsi-recognized-salary-summary">
                        {rp(bsiRec?.recognizedSalary || 0)}
                      </strong>
                    </div>
                    <div className="sm:text-right">
                      <span className="block text-[10px] font-semibold uppercase text-slate-500">
                        Akseptasi Aktif ({bsiRec?.dbrLabel} • DBR {bsiRec?.dbrRate}%)
                      </span>
                      <strong className="mt-0.5 block text-sm font-extrabold text-[#078D67] lp-num" data-testid="bsi-active-acceptance-summary">
                        {rp(bsiRec?.akseptasiAktif || 0)} / bln
                      </strong>
                    </div>
                  </div>
                </div>

                {/* BAGIAN C: MASA KERJA, PENSIUN, TENOR & PRICE MANUAL */}
                <div className="border-t border-slate-100 pt-4 space-y-3.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#078D67]">
                    C. Masa Kerja, Pensiun, Tenor &amp; Price Manual
                  </span>

                  {/* 7. TMT Bekerja & 8. TMT Pensiun + BUP */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-tmt-kerja" className="text-xs font-bold text-[#17223B]">
                        7. TMT Bekerja
                      </Label>
                      <Input
                        id="bsi-tmt-kerja"
                        type="date"
                        className="h-10 border-slate-200 lp-num text-xs"
                        value={d.tmt_bekerja}
                        onChange={(e) => setD({ ...d, tmt_bekerja: e.target.value })}
                        data-testid="bsi-tmt-bekerja-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-bup" className="text-xs font-bold text-[#17223B]">
                        8a. Usia BUP
                      </Label>
                      <select
                        id="bsi-bup"
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#17223B]"
                        value={d.bup_age}
                        onChange={(e) => {
                          const nextBup = e.target.value;
                          const dobObj = parseIsoDateLocal(d.bsi_birth_iso);
                          const nextYear = dobObj ? String(dobObj.getFullYear() + Number(nextBup)) : d.tmt_pensiun_year;
                          setD({ ...d, bup_age: nextBup, tmt_pensiun_year: nextYear });
                          reset();
                        }}
                        data-testid="bsi-bup-age-select"
                      >
                        <option value="58">58 Thn (Reguler)</option>
                        <option value="60">60 Thn (Guru/Dosen)</option>
                        <option value="65">65 Thn (Ahli/Utama)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-tmt" className="text-xs font-bold text-[#17223B]">
                        8b. Tahun TMT Pensiun
                      </Label>
                      <Input
                        id="bsi-tmt"
                        type="number"
                        placeholder="2028"
                        className="h-10 border-slate-200 lp-num text-xs font-semibold"
                        value={d.tmt_pensiun_year}
                        onChange={(e) => { setD({ ...d, tmt_pensiun_year: e.target.value }); reset(); }}
                        data-testid="bsi-tmt-pensiun-input"
                      />
                    </div>
                  </div>

                  {/* 9. THT & 10. Pensiun / Manfaat Pensiun */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-[#17223B]">
                        9. THT / Tabungan Hari Tua (Diakui 75%)
                      </Label>
                      <CurrencyInput
                        value={d.tht}
                        onChange={(v) => setD({ ...d, tht: v })}
                        placeholder="0"
                        data-testid="bsi-tht-input"
                      />
                      <small className="block text-[11px] text-slate-500 lp-num">
                        75% THT diakui: {rp(bsiRec?.thtRecognized || 0)}
                      </small>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-[#17223B]">
                          10. Manfaat Pensiun (DSR 90%)
                        </Label>
                        {Number(d.gaji_pokok) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setD({ ...d, pension_salary: Math.round(Number(d.gaji_pokok) * 0.75) });
                              reset();
                            }}
                            className="text-[10px] font-bold text-[#351080] hover:underline"
                          >
                            Isi 75% GP
                          </button>
                        )}
                      </div>
                      <CurrencyInput
                        required
                        value={d.pension_salary}
                        onChange={(v) => { setD({ ...d, pension_salary: v }); setBsiError(""); reset(); }}
                        placeholder="Wajib diisi sesuai estimasi SK Pensiun"
                        data-testid="bsi-pension-salary-input"
                      />
                      <small className="block text-[11px] font-semibold text-[#078D67] lp-num">
                        Akseptasi Pensiun (90%): {rp(bsiRec?.akseptasiPensiun || 0)} / bln
                      </small>
                    </div>
                  </div>

                  {/* 11. Tenor Pembiayaan */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bsi-tenor" className="text-xs font-bold text-[#17223B]">
                        11. Tenor Pembiayaan (Bulan • Maks 180 Bulan)
                      </Label>
                      {bsiRec?.maxTenor > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setD({ ...d, bsi_req_tenor: String(bsiRec.maxTenor) });
                            reset();
                          }}
                          className="text-[11px] font-bold text-[#078D67] hover:underline"
                        >
                          Gunakan Maks Tenor ({bsiRec.maxTenor} bln)
                        </button>
                      )}
                    </div>
                    <Input
                      id="bsi-tenor"
                      type="number"
                      min="12"
                      max="180"
                      step="1"
                      className="h-10 border-slate-200 lp-num text-xs font-bold"
                      value={d.bsi_req_tenor}
                      onChange={(e) => { setD({ ...d, bsi_req_tenor: e.target.value.replace(/\D/g, "") }); reset(); }}
                      data-testid="bsi-tenor-input"
                    />
                    {bsiRec?.ready && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600 lp-num">
                        <span>
                          Terbagi otomatis: <b className="text-[#078D67]">{bsiRec.activeMonths} bln Masa Aktif</b> +{" "}
                          <b className="text-[#351080]">{bsiRec.pensionMonths} bln Masa Pensiun</b>
                        </span>
                        <span>Polis Simas (+6 bln): {(bsiRec.requestedTenor || 0) + 6} bln</span>
                      </div>
                    )}
                  </div>

                  {/* 12. Price Saat Aktif & 13. Price Saat Pensiun (MANUAL INPUT SESUAI KEADAAN REAL) */}
                  <div className="rounded-xl border border-[#351080]/20 bg-[#351080]/[0.03] p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Percent className="h-3.5 w-3.5 text-[#351080]" />
                        <span className="text-xs font-bold text-[#17223B]">
                          12 &amp; 13. Price Saat Aktif &amp; Price Saat Pensiun (Input Manual Real)
                        </span>
                      </div>
                      <span className="rounded bg-[#351080]/10 px-2 py-0.5 text-[10px] font-bold text-[#351080]">
                        Fleksibel Sesuai Lapangan
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="bsi-price-aktif" className="text-xs font-bold text-[#17223B]">
                          12. Price Saat Aktif (% p.a.)
                        </Label>
                        <Input
                          id="bsi-price-aktif"
                          type="number"
                          step="0.01"
                          min="1"
                          max="30"
                          placeholder="Contoh: 9.25"
                          className="h-10 border-slate-200 bg-white lp-num text-xs font-bold text-[#078D67]"
                          value={d.bsi_price_aktif}
                          onChange={(e) => { setD({ ...d, bsi_price_aktif: e.target.value }); reset(); }}
                          data-testid="bsi-price-aktif-input"
                        />
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {["9.25", "9.50", "10.00", "10.50"].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => { setD({ ...d, bsi_price_aktif: val }); reset(); }}
                              className={cn(
                                "rounded border px-2 py-0.5 text-[10px] font-bold lp-num transition-colors",
                                d.bsi_price_aktif === val
                                  ? "border-[#078D67] bg-[#078D67] text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-[#078D67]"
                              )}
                            >
                              {val.replace(".", ",")}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="bsi-price-pensiun" className="text-xs font-bold text-[#17223B]">
                          13. Price Saat Pensiun (% p.a.)
                        </Label>
                        <Input
                          id="bsi-price-pensiun"
                          type="number"
                          step="0.01"
                          min="1"
                          max="30"
                          placeholder="Contoh: 10.50"
                          className="h-10 border-slate-200 bg-white lp-num text-xs font-bold text-[#351080]"
                          value={d.bsi_price_pensiun}
                          onChange={(e) => { setD({ ...d, bsi_price_pensiun: e.target.value }); reset(); }}
                          data-testid="bsi-price-pensiun-input"
                        />
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {["10.50", "11.00", "11.50", "12.00"].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => { setD({ ...d, bsi_price_pensiun: val }); reset(); }}
                              className={cn(
                                "rounded border px-2 py-0.5 text-[10px] font-bold lp-num transition-colors",
                                d.bsi_price_pensiun === val
                                  ? "border-[#351080] bg-[#351080] text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-[#351080]"
                              )}
                            >
                              {val.replace(".", ",")}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BAGIAN D: PROYEKSI CAIR, ASURANSI SIMAS JIWA, PELUNASAN & PLAFOND */}
                <div className="border-t border-slate-100 pt-4 space-y-3.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#078D67]">
                    D. Tanggal Transaksi, Asuransi Simas, Blokir/Pelunasan &amp; Plafond
                  </span>

                  {/* 14. Proyeksi Cair & Start Angsuran */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-cair" className="text-xs font-bold text-[#17223B]">
                        14a. Proyeksi Cair
                      </Label>
                      <Input
                        id="bsi-cair"
                        type="date"
                        className="h-10 border-slate-200 lp-num text-xs font-semibold"
                        value={d.bsi_proyeksi_cair}
                        onChange={(e) => {
                          const cairIso = e.target.value;
                          setD({
                            ...d,
                            bsi_proyeksi_cair: cairIso,
                            bsi_start_angsuran: nextMonth25IsoLocal(cairIso)
                          });
                          reset();
                        }}
                        data-testid="bsi-proyeksi-cair-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-start-angs" className="text-xs font-bold text-[#17223B]">
                        14b. Start Angsuran
                      </Label>
                      <Input
                        id="bsi-start-angs"
                        type="date"
                        className="h-10 border-slate-200 lp-num text-xs font-semibold"
                        value={d.bsi_start_angsuran}
                        onChange={(e) => { setD({ ...d, bsi_start_angsuran: e.target.value }); reset(); }}
                        data-testid="bsi-start-angsuran-input"
                      />
                    </div>
                  </div>

                  {bsiRec?.ready && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 lp-num">
                      <span>
                        Selesai Angsuran: <b>{fmtDate(bsiRec.selesaiAngsuranIso)}</b>
                      </span>
                      <span>
                        Usia Jatuh Tempo: <b className="text-[#351080]">{bsiRec.endLoanAgeObj.years} Thn {bsiRec.endLoanAgeObj.months} Bln</b>
                      </span>
                    </div>
                  )}

                  {/* 15. Skema Atribusi & Biaya Asuransi Simas Jiwa */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-skema" className="text-xs font-bold text-[#17223B]">
                        15a. Skema Asuransi
                      </Label>
                      <select
                        id="bsi-skema"
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#17223B]"
                        value={d.bsi_skema}
                        onChange={(e) => { setD({ ...d, bsi_skema: e.target.value }); reset(); }}
                        data-testid="bsi-skema-select"
                      >
                        <option value="Atribusi">2. Atribusi Asuransi (Dicicil di Margin)</option>
                        <option value="Non-Atribusi">1. No Atribusi (Potong Pencairan)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-[#17223B]">
                        15b. Biaya Asuransi Simas Jiwa
                      </Label>
                      <div className="flex h-10 items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/70 px-3 text-xs font-bold text-[#078D67] lp-num">
                        <span>{bsiRec?.ready ? rp(bsiRec.premiSimas) : "Rp0"}</span>
                        {bsiRec?.ready && (
                          <span className="rounded bg-[#078D67]/15 px-1.5 py-0.5 text-[10px]">
                            {bsiRec.tarifPerMil.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ‰
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 16. Buka Blokir Yang Lama (+) & Pelunasan Yang Lama / Take Over (-) */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-[#078D67]">
                        16a. Buka Blokir Yang Lama (+ Rp)
                      </Label>
                      <CurrencyInput
                        placeholder="0"
                        value={d.buka_blokir_lama}
                        onChange={(v) => { setD({ ...d, buka_blokir_lama: v }); reset(); }}
                        data-testid="bsi-buka-blokir-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-red-700">
                        16b. Pelunasan Yang Lama / TO (- Rp)
                      </Label>
                      <CurrencyInput
                        placeholder="0"
                        value={d.pelunasan_lama}
                        onChange={(v) => { setD({ ...d, pelunasan_lama: v, take_over: v }); reset(); }}
                        data-testid="bsi-pelunasan-lama-input"
                      />
                    </div>
                  </div>

                  {/* Opsional: Angsuran Eksisting di BSI / Selain BSI */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowExistingOblig(!showExistingOblig)}
                      className="text-[11px] font-semibold text-[#351080] hover:underline"
                    >
                      {showExistingOblig
                        ? "− Sembunyikan Angsuran Eksisting Berjalan"
                        : "+ Ada Angsuran Eksisting Berjalan yang Tidak Dilunasi? (Opsional)"}
                    </button>
                    {showExistingOblig && (
                      <div className="mt-2 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">Angsuran Eksisting di BSI</Label>
                          <CurrencyInput
                            placeholder="0"
                            value={d.angsuran_bsi}
                            onChange={(v) => { setD({ ...d, angsuran_bsi: v }); reset(); }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">Angsuran Eksisting Selain BSI</Label>
                          <CurrencyInput
                            placeholder="0"
                            value={d.angsuran_selain_bsi}
                            onChange={(v) => { setD({ ...d, angsuran_selain_bsi: v }); reset(); }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 17. Plafond Pra Pensiun Diajukan & Akad Pembiayaan */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-[#17223B]">
                          17a. Plafond Pra Pensiun (Rp)
                        </Label>
                        {bsiRec?.maxPlafond > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setD({ ...d, bsi_req_loan: bsiRec.maxPlafond });
                              reset();
                            }}
                            className="text-[10px] font-bold text-[#078D67] hover:underline"
                          >
                            Isi Maks ({rp(bsiRec.maxPlafond)})
                          </button>
                        )}
                      </div>
                      <CurrencyInput
                        placeholder="Kosongkan untuk otomatis Plafond Maksimal"
                        value={d.bsi_req_loan}
                        onChange={(v) => { setD({ ...d, bsi_req_loan: v }); setBsiError(""); reset(); }}
                        data-testid="bsi-requested-loan-input"
                      />
                      <small className="block text-[11px] font-semibold text-[#078D67] lp-num" data-testid="bsi-loan-recommendation">
                        {bsiRec?.maxPlafond > 0
                          ? `Kapasitas Maksimal: ${rp(bsiRec.maxPlafond)}${d.bsi_req_loan ? " (Mode Manual)" : " (Otomatis)"}`
                          : "Lengkapi tanggal lahir, penghasilan & manfaat pensiun"}
                      </small>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bsi-akad" className="text-xs font-bold text-[#17223B]">
                        17b. Akad Pembiayaan
                      </Label>
                      <select
                        id="bsi-akad"
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#17223B]"
                        value={d.bsi_akad}
                        onChange={(e) => { setD({ ...d, bsi_akad: e.target.value }); reset(); }}
                        data-testid="bsi-akad-select"
                      >
                        <option value="MMQ">MMQ (Musyarakah Mutanaqishah)</option>
                        <option value="Murabahah">Murabahah</option>
                      </select>
                      {d.bsi_akad === "MMQ" && bsiRec?.taksasiMmq > 0 && (
                        <small className="block text-[11px] text-slate-500 lp-num">
                          Taksasi MMQ: <b>{rp(bsiRec.taksasiMmq)}</b>
                        </small>
                      )}
                    </div>
                  </div>
                </div>

                {bsiError && (
                  <div className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700" data-testid="bsi-error-box">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{bsiError}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <Button
                    type="submit"
                    disabled={busy === "final"}
                    className="h-11 flex-1 bg-[#078D67] font-bold text-white hover:bg-[#067455] shadow-xs"
                    data-testid="bsi-submit-button"
                  >
                    {busy === "final" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Hitung Simulasi BSI Prapensiun
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetBsiForm}
                    className="h-11 border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                    data-testid="bsi-reset-button"
                  >
                    Atur Ulang
                  </Button>
                </div>
              </form>
            </Step>
          </div>

          <div className="space-y-6">
            {/* Panel Ringkasan & Rekomendasi Live BSI NOS v1.4.6 + Simas Jiwa */}
            <section
              className="rounded-2xl bg-gradient-to-br from-[#065f46] via-[#078D67] to-[#1e1b4b] p-5 sm:p-6 text-white shadow-sm"
              data-testid="bsi-recommendation-panel"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
                <div className="flex items-center gap-3">
                  <PartnerLogo bankKey="bsi_prapen" size="sm" className="ring-2 ring-white/25" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
                      MONITORING AKSEPTASI &amp; SIMAS JIWA (LIVE)
                    </p>
                    <h2 className="font-display text-base sm:text-lg font-bold text-white">
                      {d.bsi_sub_product === "PP3"
                        ? "2. Prapen 3 Tahun (Tri Berkah)"
                        : "1. Prapen 10 Tahun (Dekade Berkah)"}
                    </h2>
                  </div>
                </div>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-emerald-50 lp-num">
                  Price: {String(d.bsi_price_aktif).replace(".", ",")}% Aktif • {String(d.bsi_price_pensiun).replace(".", ",")}% Pensiun
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/15 bg-white/10 p-3.5">
                  <span className="block text-xs text-emerald-100/85">
                    Akseptasi Masa Aktif ({bsiRec?.dbrLabel} {bsiRec?.dbrRate}%)
                  </span>
                  <strong className="mt-1 block font-display text-lg font-bold lp-num">
                    {bsiRec?.akseptasiAktif > 0 ? rp(bsiRec.akseptasiAktif) : "—"}
                  </strong>
                  <span className="mt-0.5 block text-[11px] text-emerald-100/75 lp-num">
                    Penghasilan diakui: {rp(bsiRec?.recognizedSalary || 0)}
                  </span>
                </div>

                <div className="rounded-xl border border-white/15 bg-white/10 p-3.5">
                  <span className="block text-xs text-emerald-100/85">
                    Akseptasi Masa Pensiun (DSR 90%)
                  </span>
                  <strong className="mt-1 block font-display text-lg font-bold lp-num">
                    {bsiRec?.akseptasiPensiun > 0 ? rp(bsiRec.akseptasiPensiun) : "—"}
                  </strong>
                  <span className="mt-0.5 block text-[11px] text-emerald-100/75 lp-num">
                    Tenor Aktif/Pensiun: {bsiRec?.ready ? `${bsiRec.activeMonths} / ${bsiRec.pensionMonths} bln` : "—"}
                  </span>
                </div>

                <div className="rounded-xl border border-white/15 bg-white/10 p-3.5">
                  <span className="block text-xs text-emerald-100/85">
                    Premi Simas Jiwa ({d.bsi_skema === "Non-Atribusi" ? "No Atribusi" : "Atribusi"})
                  </span>
                  <strong className="mt-1 block font-display text-lg font-bold text-amber-200 lp-num">
                    {bsiRec?.ready && bsiRec.premiSimas > 0 ? rp(bsiRec.premiSimas) : "—"}
                  </strong>
                  <span className="mt-0.5 block text-[11px] text-emerald-100/75 lp-num">
                    {bsiRec?.ready
                      ? `Tarif ${bsiRec.tarifPerMil.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ‰ • Santunan ${rp(bsiRec.santunanSimas)}`
                      : "Pilih tanggal lahir & plafond"}
                  </span>
                </div>

                <div className="rounded-xl border border-white/20 bg-white/15 p-3.5">
                  <span className="block text-xs text-emerald-50">
                    Kapasitas Plafond Maksimal
                  </span>
                  <strong className="mt-1 block font-display text-lg font-extrabold text-[#b9fff5] lp-num">
                    {bsiRec?.maxPlafond > 0 ? rp(bsiRec.maxPlafond) : "—"}
                  </strong>
                  <span className="mt-0.5 block text-[11px] text-emerald-100/80 lp-num">
                    {bsiRec?.ready ? bsiRec.mcuStatus : "Menunggu data lengkap"}
                  </span>
                </div>
              </div>
            </section>

            {/* Hasil Simulasi Final BSI */}
            <div className="lp-card p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <PartnerLogo bankKey="bsi_prapen" size="sm" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#078D67]">
                      HASIL SIMULASI PEMBIAYAAN BSI
                    </p>
                    <h2 className="font-display text-lg font-bold text-[#17223B]">
                      Rincian Angsuran, Pencairan &amp; Jadwal Amortisasi
                    </h2>
                  </div>
                </div>
                {sim && (
                  <span className="rounded-md bg-[#078D67]/10 px-3 py-1 text-xs font-bold text-[#078D67]" data-testid="sim-number">
                    {sim.sim_no}
                  </span>
                )}
              </div>

              {!res ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-sm text-slate-500">
                  Lengkapi formulir di sebelah kiri, lalu tekan tombol <b>Hitung Simulasi BSI Prapensiun</b>.
                </div>
              ) : (
                <div className="space-y-6 lp-fade">
                  {!res.overall_ok && res.issues?.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-700" data-testid="final-issues">
                      <p className="font-bold">Catatan Validasi Ketentuan BSI &amp; Simas Jiwa:</p>
                      <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
                        {res.issues.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <ResultView r={res} />

                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    {!sim && (
                      <Button
                        onClick={save}
                        disabled={busy === "save"}
                        className="h-11 w-full bg-[#078D67] font-bold text-white hover:bg-[#067455]"
                        data-testid="calc-save-button"
                      >
                        {busy === "save" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Simpan Simulasi &amp; Unduh PDF Resmi BSI
                          </>
                        )}
                      </Button>
                    )}

                    {sim && (
                      <>
                        <DownloadActions sim={sim} />
                        <div className="rounded-xl border border-slate-200 p-4" data-testid="sim-approval-panel">
                          <p className="font-display text-sm font-bold text-[#17223B]">Persetujuan Simulasi</p>
                          {simStatus === "dibatalkan" ? (
                            <p className="mt-2 text-sm text-slate-500" data-testid="sim-cancelled">Pengajuan dibatalkan.</p>
                          ) : (
                            <>
                              {!leadId && (
                                <div className="mt-3 max-w-xs space-y-1.5">
                                  <Label htmlFor="bsi-phone" className="text-xs">No. telepon calon debitur (untuk data leads)</Label>
                                  <Input id="bsi-phone" inputMode="tel" className="h-9" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="approve-phone-input" />
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button onClick={approve} disabled={busy === "approve"} className="bg-[#078D67] hover:bg-[#067455] font-bold" data-testid="approve-sim-button">
                                  Setujui Simulasi &amp; Lanjut Pengajuan
                                </Button>
                                <Button variant="outline" onClick={cancel} className="text-red-600 font-semibold" data-testid="cancel-sim-button">
                                  Batalkan Pengajuan
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                        <AiSummary sim={sim} />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewStage === "workspace" && bank && isAms2 && ams2Rec && (
        <div className="grid gap-6 xl:grid-cols-[480px_1fr] lp-fade" data-testid="ams2-calculator-layout">
          <div className="space-y-6">
            <Step n="1" title="Simulasi AMS V2 — Data Debitur, Plafon &amp; Tenor" testid="ams2-step-1">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
                <PartnerLogo bankKey="ams2" size="md" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#17223B]">
                    KOPERASI ASIA MADANI SEJAHTERA
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Simulasi AMS V2 • Pra Platinum / Platinum / Post Platinum
                  </p>
                </div>
              </div>

              {/* Catatan Pengingat Pengisian Gaji & Tanggal Lahir */}
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900">
                <p className="font-bold">Catatan Pengisian:</p>
                <p className="mt-0.5 leading-relaxed">
                  Jangan lupa mengisi <b>Gaji Bulanan</b> dan <b>Tanggal Lahir</b> terlebih dahulu ya agar rekomendasi batas plafon maksimal dan jangka waktu (tenor) tampil secara otomatis.
                </p>
              </div>

              {ams2Error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700" data-testid="ams2-error-box">
                  {ams2Error}
                </div>
              )}

              <form onSubmit={calcAms2Submit} className="space-y-5" noValidate>
                {/* Bagian 1: Data Debitur */}
                <div className="space-y-3.5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C3D9C]">
                    1. Data Debitur
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="ams2-name" className="text-xs font-bold text-[#17223B]">
                      Nama lengkap debitur
                    </Label>
                    <Input
                      id="ams2-name"
                      required
                      placeholder="Masukkan nama lengkap debitur"
                      className="h-10 border-slate-200 text-xs font-medium"
                      value={d.name}
                      onChange={(e) => {
                        setD({ ...d, name: e.target.value });
                        setAms2Error("");
                      }}
                      data-testid="calc-name-input"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ams2-birth" className="text-xs font-bold text-[#17223B]">
                        Tanggal lahir
                      </Label>
                      <Input
                        id="ams2-birth"
                        type="date"
                        required
                        className="h-10 border-slate-200 text-xs font-medium lp-num"
                        value={d.ams2_birth_iso}
                        onChange={(e) => {
                          setD({ ...d, ams2_birth_iso: e.target.value });
                          setAms2Error("");
                        }}
                        data-testid="calc-birth-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ams2-process" className="text-xs font-bold text-[#17223B]">
                        Tanggal simulasi
                      </Label>
                      <Input
                        id="ams2-process"
                        type="date"
                        required
                        className="h-10 border-slate-200 text-xs font-medium lp-num"
                        value={d.ams2_process_iso}
                        onChange={(e) => {
                          setD({ ...d, ams2_process_iso: e.target.value });
                          setAms2Error("");
                        }}
                        data-testid="ams2-process-date-input"
                      />
                    </div>
                  </div>

                  {/* Notifikasi Usia & Rekomendasi Kategori */}
                  {ams2Rec.age !== null && (
                    <div
                      className={cn(
                        "rounded-xl border px-3.5 py-2.5 text-xs",
                        ams2Rec.inCategory
                          ? "border-[#DCC7E0] bg-[#F5EBF7]/80 text-[#351080]"
                          : "border-red-200 bg-red-50 text-red-700"
                      )}
                      data-testid="ams2-age-notification"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1 font-bold">
                        <span>Usia saat simulasi: {ams2Rec.age} tahun</span>
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-[#8C3D9C] shadow-2xs">
                          Kategori: {ams2Rec.cat}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] opacity-90">
                        {ams2Rec.inCategory
                          ? `Rekomendasi: Masuk kategori ${ams2Rec.cat} (Bunga Koperasi ${ams2Rec.coopRatePct}% p.a. • Cadangan Risiko ${ams2Rec.riskRatePct}%). Tenor maks s.d. usia 84 thn 10 bln: ${ams2Rec.recMaxTenor} bulan.`
                          : "Usia debitur melebihi batas maksimal kategori usia produk (84 tahun)."}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-[#17223B]">Gaji bulanan (Rp)</Label>
                      <CurrencyInput
                        required
                        placeholder="Contoh: 2.734.000"
                        value={d.salary}
                        onChange={(v) => {
                          setD({ ...d, salary: v });
                          setAms2Error("");
                        }}
                        data-testid="calc-salary-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ams2-takeover-type" className="text-xs font-bold text-[#17223B]">
                        Jenis pengajuan
                      </Label>
                      <select
                        id="ams2-takeover-type"
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#17223B]"
                        value={d.ams2_takeover_type}
                        onChange={(e) => {
                          const tv = e.target.value;
                          setD({
                            ...d,
                            ams2_takeover_type: tv,
                            take_over: tv === "no" ? 0 : d.take_over
                          });
                        }}
                        data-testid="ams2-takeover-select"
                      >
                        <option value="no">Non Take Over</option>
                        <option value="yes">Take Over</option>
                      </select>
                    </div>
                  </div>

                  {d.ams2_takeover_type === "yes" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-[#17223B]">Nilai Take Over (Rp)</Label>
                      <CurrencyInput
                        placeholder="Contoh: 20.000.000"
                        value={d.take_over}
                        onChange={(v) => setD({ ...d, take_over: v })}
                        data-testid="calc-takeover-input"
                      />
                    </div>
                  )}
                </div>

                {/* Bagian 2: Plafon dan Tenor (Dengan Rekomendasi Maksimal Langsung) */}
                <div className="space-y-3.5 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C3D9C]">
                    2. Plafon dan Tenor
                  </p>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-[#17223B]">Plafon kredit (Rp)</Label>
                      {ams2Rec.recMaxPlafon > 0 && (
                        <button
                          type="button"
                          onClick={() => setD({ ...d, ams2_req_loan: ams2Rec.recMaxPlafon })}
                          className="text-[11px] font-bold text-[#8C3D9C] hover:underline"
                          data-testid="ams2-use-max-plafond-btn"
                        >
                          Gunakan Rekomendasi Maks
                        </button>
                      )}
                    </div>
                    <CurrencyInput
                      placeholder={
                        ams2Rec.recMaxPlafon > 0
                          ? `Maks: ${ams2Rec.recMaxPlafon.toLocaleString("id-ID")}`
                          : "Contoh: 143.700.000"
                      }
                      value={d.ams2_req_loan}
                      onChange={(v) => {
                        setD({ ...d, ams2_req_loan: v });
                        setAms2Error("");
                      }}
                      data-testid="calc-plafond-input"
                    />
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-[11px] font-semibold",
                        ams2Rec.recMaxPlafon > 0
                          ? ams2Rec.principal > ams2Rec.recMaxPlafon
                            ? "border border-red-200 bg-red-50 text-red-700"
                            : "border border-emerald-200/80 bg-emerald-50/80 text-emerald-800"
                          : "border border-slate-200 bg-slate-50 text-slate-500"
                      )}
                      data-testid="ams2-rec-plafond-hint"
                    >
                      {ams2Rec.recMaxPlafon > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span>
                            Rekomendasi plafon maksimal:{" "}
                            <strong className="lp-num">{rp(ams2Rec.recMaxPlafon)}</strong>{" "}
                            {ams2Rec.n > 0
                              ? `(untuk tenor ${ams2Rec.effectiveTenor} bulan)`
                              : `(berdasarkan tenor maksimal ${ams2Rec.effectiveTenor} bulan)`}
                          </span>
                          {ams2Rec.principal > ams2Rec.recMaxPlafon && (
                            <span className="font-bold text-red-600">Melebihi batas!</span>
                          )}
                        </div>
                      ) : (
                        <span>
                          Rekomendasi plafon maksimal: — (Isi gaji bulanan dan tanggal lahir terlebih dahulu)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="ams2-tenor" className="text-xs font-bold text-[#17223B]">
                        Tenor (bulan)
                      </Label>
                      {ams2Rec.recMaxTenor > 0 && (
                        <button
                          type="button"
                          onClick={() => setD({ ...d, ams2_req_tenor: String(ams2Rec.recMaxTenor) })}
                          className="text-[11px] font-bold text-[#8C3D9C] hover:underline"
                          data-testid="ams2-use-max-tenor-btn"
                        >
                          Gunakan Tenor Maks ({ams2Rec.recMaxTenor} bln)
                        </button>
                      )}
                    </div>
                    <Input
                      id="ams2-tenor"
                      type="number"
                      min="1"
                      max="120"
                      placeholder={ams2Rec.recMaxTenor > 0 ? `Maks: ${ams2Rec.recMaxTenor}` : "1 - 120"}
                      className="h-10 border-slate-200 text-xs font-semibold lp-num"
                      value={d.ams2_req_tenor}
                      onChange={(e) => {
                        setD({ ...d, ams2_req_tenor: e.target.value.replace(/\D/g, "") });
                        setAms2Error("");
                      }}
                      data-testid="calc-tenor-input"
                    />
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-[11px] font-semibold",
                        ams2Rec.recMaxTenor > 0
                          ? ams2Rec.n > ams2Rec.recMaxTenor
                            ? "border border-red-200 bg-red-50 text-red-700"
                            : "border border-emerald-200/80 bg-emerald-50/80 text-emerald-800"
                          : "border border-slate-200 bg-slate-50 text-slate-500"
                      )}
                      data-testid="ams2-rec-tenor-hint"
                    >
                      {ams2Rec.recMaxTenor > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span>
                            Rekomendasi tenor maksimal:{" "}
                            <strong className="lp-num">{ams2Rec.recMaxTenor} bulan</strong>
                          </span>
                          {ams2Rec.n > ams2Rec.recMaxTenor && (
                            <span className="font-bold text-red-600">Melebihi batas usia!</span>
                          )}
                        </div>
                      ) : (
                        <span>Rekomendasi tenor maksimal: — (Isi tanggal lahir terlebih dahulu)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bagian 3: Informasi Petugas (Opsional untuk PDF) */}
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    3. Informasi Petugas (Untuk Dokumen PDF)
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="ams2-pic" className="text-[11px] font-semibold text-slate-600">
                        PIC Koperasi
                      </Label>
                      <Input
                        id="ams2-pic"
                        className="h-9 text-xs"
                        value={d.ams2_pic}
                        onChange={(e) => setD({ ...d, ams2_pic: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ams2-sm" className="text-[11px] font-semibold text-slate-600">
                        Nama Sales Manager
                      </Label>
                      <Input
                        id="ams2-sm"
                        placeholder="Contoh: IRFAN"
                        className="h-9 text-xs"
                        value={d.ams2_sm}
                        onChange={(e) => setD({ ...d, ams2_sm: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ams2-mkt" className="text-[11px] font-semibold text-slate-600">
                        Nama Marketing
                      </Label>
                      <Input
                        id="ams2-mkt"
                        placeholder="Contoh: IRFAN"
                        className="h-9 text-xs"
                        value={d.ams2_marketing}
                        onChange={(e) => setD({ ...d, ams2_marketing: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <Button
                    type="submit"
                    disabled={busy === "final"}
                    className="h-11 flex-1 bg-[#351080] hover:bg-[#2a0c66] font-bold text-white shadow-sm rounded-xl"
                    data-testid="calc-final-button"
                  >
                    {busy === "final" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Hitung Simulasi AMS V2"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetAms2Form}
                    className="h-11 border-slate-200 px-4 text-xs font-bold text-slate-600"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              </form>
            </Step>
          </div>

          {/* Kolom Kanan: Ringkasan Live Rekomendasi & Estimasi AMS2 */}
          <div className="space-y-5">
            <div className="lp-card overflow-hidden p-0">
              <div className="bg-gradient-to-r from-[#12264D] via-[#243B6B] to-[#6E3080] p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-purple-200">
                      KOPERASI ASIA MADANI SEJAHTERA
                    </p>
                    <h3 className="font-display text-lg font-extrabold">
                      Ringkasan Rekomendasi &amp; Estimasi Cepat
                    </h3>
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                    {ams2Rec.cat}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/10 p-3.5 backdrop-blur-xs border border-white/15">
                    <p className="text-[11px] font-semibold text-purple-200">
                      REKOMENDASI PLAFON MAKSIMAL
                    </p>
                    <p className="mt-1 font-display text-2xl font-extrabold text-white lp-num">
                      {ams2Rec.recMaxPlafon > 0 ? rp(ams2Rec.recMaxPlafon) : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-200">
                      {ams2Rec.effectiveTenor > 0
                        ? `Berdasarkan tenor ${ams2Rec.effectiveTenor} bulan & batas 95% gaji`
                        : "Isi gaji & tanggal lahir terlebih dahulu"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3.5 backdrop-blur-xs border border-white/15">
                    <p className="text-[11px] font-semibold text-purple-200">
                      REKOMENDASI TENOR MAKSIMAL
                    </p>
                    <p className="mt-1 font-display text-2xl font-extrabold text-amber-300 lp-num">
                      {ams2Rec.recMaxTenor > 0 ? `${ams2Rec.recMaxTenor} bulan` : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-200">
                      Maksimal usia lunas 84 tahun 10 bulan (maks 120 bln)
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                    <p className="text-[11px] font-bold uppercase text-slate-500">
                      ESTIMASI PENCAIRAN BERSIH
                    </p>
                    <p className="mt-1 font-display text-xl font-extrabold text-[#12264D] lp-num">
                      {ams2Rec.evalLoan > 0 ? rp(ams2Rec.net) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                    <p className="text-[11px] font-bold uppercase text-slate-500">
                      ANGSURAN KOPERASI / BULAN
                    </p>
                    <p className="mt-1 font-display text-xl font-extrabold text-[#8C3D9C] lp-num">
                      {ams2Rec.evalLoan > 0 ? rp(ams2Rec.installment) : "—"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                  <div className="bg-[#F5EBF7] px-4 py-2 font-extrabold text-[#8C3D9C] uppercase tracking-wider">
                    Pratinjau Rincian Biaya &amp; Potongan
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Plafon Kredit / Tenor Dievaluasi</span>
                      <span className="font-bold text-slate-900 lp-num">
                        {ams2Rec.evalLoan > 0 ? `${rp(ams2Rec.evalLoan)} / ${ams2Rec.evalTenor} bln` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Biaya Provisi dan Akuisisi</span>
                      <span className="font-bold text-slate-900 lp-num">
                        {ams2Rec.evalLoan > 0 ? rp(ams2Rec.proaq) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Cadangan Risiko</span>
                      <span className="font-bold text-slate-900 lp-num">
                        {ams2Rec.evalLoan > 0 ? rp(ams2Rec.risk) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Administrasi</span>
                      <span className="font-bold text-slate-900 lp-num">
                        {ams2Rec.evalLoan > 0 ? rp(ams2Rec.admin) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#F5EBF7]/60 px-4 py-2.5 font-extrabold text-[#8C3D9C]">
                      <span>TOTAL BIAYA KREDIT</span>
                      <span className="lp-num">{ams2Rec.evalLoan > 0 ? rp(ams2Rec.totalFees) : "—"}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Take Over</span>
                      <span className="font-bold text-slate-900 lp-num">
                        {ams2Rec.evalLoan > 0 ? rp(ams2Rec.to) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Retensi (3 x angsuran koperasi)</span>
                      <span className="font-bold text-slate-900 lp-num">
                        {ams2Rec.evalLoan > 0 ? rp(ams2Rec.retention) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Sisa Gaji / Bulan</span>
                      <span className="font-bold text-emerald-700 lp-num">
                        {ams2Rec.evalLoan > 0 ? rp(ams2Rec.remaining) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewStage === "workspace" && bank && !isCapital && !isMestika && !isBsi && !isAms2 && (
        <div className="grid gap-6 xl:grid-cols-[440px_1fr] lp-fade">
          <div className="space-y-6">
            <Step
              n="1"
              title={
                isAms2
                  ? "Data Debitur & Parameter AMS2"
                  : `Data Debitur & Parameter ${bank.name}`
              }
              testid="calc-step-1"
            >
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
                <PartnerLogo bankKey={bankKey} size="md" />
                <div>
                  <h3 className="font-display text-sm font-bold text-[#17223B]">
                    {isAms2
                      ? "Koperasi Asia Madani Sejahtera (AMS2)"
                      : bank.full_name || bank.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isAms2
                      ? "Koperasi Simpan Pinjam • Kredit Pra/Platinum/Post Pensiun"
                      : "Kredit Pensiun Mitra Perbankan"}
                  </p>
                </div>
              </div>

              <form onSubmit={calcMax} className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-name" className="text-xs font-semibold text-slate-700">Nama Calon Debitur</Label>
                    <Input
                      id="c-name"
                      required
                      placeholder="Nama lengkap sesuai KTP"
                      className="h-10 text-xs font-medium text-slate-800"
                      value={d.name}
                      onChange={(e) => { setD({ ...d, name: e.target.value }); reset(); }}
                      data-testid="calc-name-input"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-birth" className="text-xs font-semibold text-slate-700">Tanggal Lahir</Label>
                      <Input
                        id="c-birth"
                        type="date"
                        required
                        className="h-10 text-xs font-medium text-slate-800 lp-num"
                        value={d.birth}
                        onChange={(e) => { setD({ ...d, birth: e.target.value }); reset(); }}
                        data-testid="calc-birth-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Gaji Bulanan</Label>
                      <CurrencyInput
                        required
                        value={d.salary}
                        onChange={(v) => { setD({ ...d, salary: v }); reset(); }}
                        data-testid="calc-salary-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Nilai Take Over (TO)</Label>
                    <CurrencyInput
                      placeholder="0"
                      value={d.take_over}
                      onChange={(v) => { setD({ ...d, take_over: v }); reset(); }}
                      data-testid="calc-takeover-input"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={busy === "max"}
                  className="h-11 w-full bg-[#351080] hover:bg-[#2a0c66] font-bold text-white shadow-xs rounded-lg transition-colors"
                  data-testid="calc-max-button"
                >
                  {busy === "max" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Hitung Hasil Maksimal"}
                </Button>
              </form>
            </Step>

            {mx?.processable && (
              <Step
                n="2"
                title={
                  isAms2
                    ? "Tata Laksana, Plafond & Tenor Koperasi"
                    : `Plafond & Tenor Kredit ${bank.name}`
                }
                testid="calc-step-2"
              >
                <div className="space-y-5">
                  {isAms2 ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="c-tl">Tata Laksana (%)</Label>
                      <Input
                        id="c-tl"
                        inputMode="decimal"
                        placeholder="0 – 3,5"
                        className="h-11"
                        value={tl}
                        onChange={(e) => { setTl(e.target.value); setRes(null); setSim(null); }}
                        data-testid="calc-tl-input"
                      />
                      <p className={`text-xs ${tlError ? "text-red-600" : "text-slate-500"}`} data-testid="calc-tl-hint">
                        {tlError || "Standar maksimal Tata Laksana adalah 3,5% dari plafond pengajuan. Tidak boleh negatif."}
                      </p>
                    </div>
                  ) : null}

                  <RadioGroup value={mode} onValueChange={(v) => { setMode(v); setRes(null); setSim(null); }} className="gap-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-[#5720B8]"><RadioGroupItem value="max" data-testid="calc-mode-max" />Gunakan plafond &amp; tenor maksimal</label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-[#5720B8]"><RadioGroupItem value="custom" data-testid="calc-mode-custom" />Tentukan plafond &amp; tenor sendiri</label>
                  </RadioGroup>
                  {mode === "custom" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1.5"><Label>Plafond</Label><CurrencyInput value={custom.plafond} onChange={(v) => { setCustom({ ...custom, plafond: v }); setRes(null); }} data-testid="calc-plafond-input" /></div>
                      <div className="space-y-1.5"><Label htmlFor="c-tenor">Tenor (bulan)</Label><Input id="c-tenor" inputMode="numeric" className="h-11" value={custom.tenor} onChange={(e) => { setCustom({ ...custom, tenor: e.target.value.replace(/\D/g, "") }); setRes(null); }} data-testid="calc-tenor-input" /></div>
                    </div>
                  )}
                  <Button onClick={calcFinal} disabled={busy === "final"} className="h-11 w-full bg-[#351080] hover:bg-[#2a0c66] font-bold text-white shadow-xs rounded-lg transition-colors" data-testid="calc-final-button">
                    {busy === "final" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hitung Simulasi Final"}
                  </Button>
                </div>
              </Step>
            )}
          </div>

          <div className="space-y-6">
            {!mx && (
              <div className="lp-card flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
                <Logo variant="vertical" size="sm" className="opacity-90" />
                <p className="mt-6 max-w-sm text-sm text-slate-500">Masukkan nama, tanggal lahir, gaji per bulan, dan nilai Take Over untuk memulai simulasi pada mitra <b>{bank.full_name}</b>.</p>
              </div>
            )}
            {mx && <MaxCard mx={mx} />}
            {res && (
              <div className="lp-card p-6 lp-fade">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <PartnerLogo bankKey={bankKey} size="md" />
                    <div>
                      <p className="lp-eyebrow">{res.bank_name || "Layanan Pensiunan SuperApps"}</p>
                      <h2 className="font-display text-xl font-bold text-[#17223B]">Hasil Simulasi Final</h2>
                    </div>
                  </div>
                  {sim && <span className="rounded-md bg-[#351080]/8 px-3 py-1 text-sm font-semibold text-[#351080]" data-testid="sim-number">{sim.sim_no}</span>}
                </div>
                {!res.overall_ok && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="final-issues">
                    <p className="font-semibold">Pengajuan belum sesuai ketentuan. Mohon koreksi nilai pengajuan:</p>
                    <ul className="mt-1 list-disc pl-5">{res.issues.map((i) => <li key={i}>{i}</li>)}</ul>
                  </div>
                )}
                <ResultView r={res} />
                <div className="mt-6 space-y-4">
                  {res.overall_ok && !sim && (
                    <Button
                      onClick={save}
                      disabled={busy === "save"}
                      className="h-11 w-full bg-[#351080] hover:bg-[#2a0c66] font-bold text-white shadow-xs rounded-lg transition-colors"
                      data-testid="calc-save-button"
                    >
                      {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Simpan Simulasi</>}
                    </Button>
                  )}
                  {sim && (
                    <>
                      <DownloadActions sim={sim} />
                      <div className="rounded-xl border border-[#351080]/15 p-4" data-testid="sim-approval-panel">
                        <p className="font-display text-sm font-bold text-[#351080]">Persetujuan Simulasi</p>
                        {simStatus === "dibatalkan" ? (
                          <p className="mt-2 text-sm text-slate-500" data-testid="sim-cancelled">Pengajuan dibatalkan.</p>
                        ) : (
                          <>
                            {!leadId && (
                              <div className="mt-3 max-w-xs space-y-1.5">
                                <Label htmlFor="c-phone">No. telepon calon debitur (untuk data leads)</Label>
                                <Input id="c-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="approve-phone-input" />
                              </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button onClick={approve} disabled={busy === "approve"} className="bg-[#078D67] hover:bg-[#067556]" data-testid="approve-sim-button">Setujui Simulasi &amp; Lanjut Pengajuan</Button>
                              <Button variant="outline" onClick={cancel} className="text-red-600" data-testid="cancel-sim-button">Batalkan Pengajuan</Button>
                            </div>
                          </>
                        )}
                      </div>
                      <AiSummary sim={sim} />
                    </>
                  )}
                  <Button variant="ghost" onClick={resetCurrentBankFromZero} data-testid="calc-reset-button">
                    <RotateCcw className="mr-2 h-4 w-4" />Simulasi baru
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewStage === "result" && res && (
        <div
          className="mx-auto w-full max-w-3xl min-w-0 space-y-5 lp-fade"
          data-testid="dedicated-result-page"
        >
          {/* Sticky / Top Navigation Bar untuk Edit Simulasi Cepat Tanpa Mengulang dari 0 */}
          <div className="lp-card flex flex-wrap items-center justify-between gap-2.5 p-3.5 sm:p-4">
            <Button
              type="button"
              onClick={backToEditSimulation}
              className="h-10 gap-2 bg-[#351080] px-4 text-xs sm:text-sm font-bold text-white hover:bg-[#2a0c66] shadow-xs"
              data-testid="edit-simulation-back-button"
            >
              <ArrowLeft className="h-4 w-4" />
              Edit Simulasi Kembali
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {sim && (
                <span
                  className="rounded-md bg-[#078D67]/10 px-3 py-1 text-xs font-bold text-[#078D67]"
                  data-testid="sim-number"
                >
                  {sim.sim_no}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={resetCurrentBankFromZero}
                className="h-9 gap-1.5 border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                data-testid="calc-reset-button"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Ulangi dari 0
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewStage("hub")}
                className="h-9 border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                data-testid="result-change-bank-btn"
              >
                Ganti Mitra Bank
              </Button>
            </div>
          </div>

          {/* Kartu Utama Hasil Simulasi */}
          <div className="lp-card p-4 sm:p-6 min-w-0 max-w-full">
            {!res.overall_ok && Array.isArray(res.issues) && res.issues.length > 0 && (
              <div
                className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-700"
                data-testid="final-issues"
              >
                <p className="font-bold">Catatan Validasi Ketentuan:</p>
                <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
                  {res.issues.map((i) => (
                    <li key={i} className="break-words">{i}</li>
                  ))}
                </ul>
              </div>
            )}

            <ResultView r={res} />

            {/* Panel Aksi: Simpan, Unduh PDF/Gambar, Edit Kembali & Persetujuan */}
            <div className="mt-6 space-y-4 border-t border-slate-200/80 pt-5">
              {!sim && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Button
                    onClick={save}
                    disabled={busy === "save"}
                    className="h-11 w-full bg-[#078D67] font-bold text-white hover:bg-[#067455] shadow-xs"
                    data-testid="calc-save-button"
                  >
                    {busy === "save" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Simpan &amp; Unduh PDF Simulasi
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={backToEditSimulation}
                    className="h-11 w-full border-[#351080]/30 font-bold text-[#351080] hover:bg-[#351080]/5"
                    data-testid="edit-simulation-bottom-button"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Belum Cocok? Edit Simulasi Kembali
                  </Button>
                </div>
              )}

              {sim && (
                <>
                  <DownloadActions sim={sim} />
                  <div className="rounded-xl border border-slate-200 p-4" data-testid="sim-approval-panel">
                    <p className="font-display text-sm font-bold text-[#17223B]">Persetujuan Simulasi</p>
                    {simStatus === "dibatalkan" ? (
                      <p className="mt-2 text-sm text-slate-500" data-testid="sim-cancelled">
                        Pengajuan dibatalkan.
                      </p>
                    ) : (
                      <>
                        {!leadId && (
                          <div className="mt-3 max-w-xs space-y-1.5">
                            <Label htmlFor="res-phone" className="text-xs">
                              No. telepon calon debitur (untuk data leads)
                            </Label>
                            <Input
                              id="res-phone"
                              inputMode="tel"
                              className="h-9"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              data-testid="approve-phone-input"
                            />
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            onClick={approve}
                            disabled={busy === "approve"}
                            className="bg-[#078D67] hover:bg-[#067455] font-bold"
                            data-testid="approve-sim-button"
                          >
                            Setujui Simulasi &amp; Lanjut Pengajuan
                          </Button>
                          <Button
                            variant="outline"
                            onClick={cancel}
                            className="text-red-600 font-semibold"
                            data-testid="cancel-sim-button"
                          >
                            Batalkan Pengajuan
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={backToEditSimulation}
                            className="border-[#351080]/30 font-bold text-[#351080] hover:bg-[#351080]/5"
                          >
                            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                            Edit Simulasi Kembali
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  <AiSummary sim={sim} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
