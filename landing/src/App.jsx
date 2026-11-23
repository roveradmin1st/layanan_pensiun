import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LOAN_GOALS,
  PUBLIC_CALCULATOR_CONFIG,
  SITE_CONTENT
} from "./config/site-content.js";
import GameIntro from "./components/GameIntro.jsx";

const ALL_CITIES = SITE_CONTENT.kanwilList.flatMap((w) => w.branches);

const PENSION_STATUS_OPTIONS = [
  { value: "Sudah Pensiun", label: "Sudah Pensiun", defaultAge: 63, defaultInst: "TASPEN" },
  { value: "Prapensiun", label: "Prapensiun (Masih Aktif)", defaultAge: 55, defaultInst: "PNS AKTIF" },
  { value: "Janda/Duda Pensiun", label: "Pensiun Janda / Duda", defaultAge: 63, defaultInst: "TASPEN" }
];

const SALARY_PRESETS = [
  { label: "Rp 3 Jt", value: 3_000_000 },
  { label: "Rp 4,5 Jt", value: 4_500_000 },
  { label: "Rp 6 Jt", value: 6_000_000 },
  { label: "Rp 8 Jt", value: 8_000_000 }
];

const PLAFOND_QUICK_CHIPS = [
  { label: "Rp 50 Juta", value: 50_000_000 },
  { label: "Rp 100 Juta", value: 100_000_000 },
  { label: "Rp 150 Juta", value: 150_000_000 },
  { label: "Rp 200 Juta", value: 200_000_000 }
];

const TENOR_QUICK_CHIPS = [3, 5, 8, 10, 12, 15];

const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

function getDefaultRetirementDateIso(yearsAhead = 2) {
  const now = new Date();
  const monthOffset = now.getDate() > 15 ? 1 : 0;
  const target = new Date(now.getFullYear() + yearsAhead, now.getMonth() + monthOffset, 1);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function parseIsoDateLocal(isoStr) {
  if (!isoStr || typeof isoStr !== "string") return null;
  const parts = isoStr.trim().split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1980 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function formatIndonesianDate(isoStr) {
  const dt = parseIsoDateLocal(isoStr);
  if (!dt) return "-";
  return `${String(dt.getDate()).padStart(2, "0")} ${INDONESIAN_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

function formatMonthsHuman(totalMonths) {
  const m = Math.max(0, Math.round(totalMonths));
  const yrs = Math.floor(m / 12);
  const rem = m % 12;
  if (yrs > 0 && rem > 0) return `${yrs} Tahun ${rem} Bulan`;
  if (yrs > 0) return `${yrs} Tahun`;
  return `${rem} Bulan`;
}

function formatRupiah(amount) {
  const num = Math.max(0, Math.round(Number(amount) || 0));
  return "Rp " + num.toLocaleString("id-ID");
}

function formatRupiahCompact(amount) {
  const num = Math.max(0, Math.round(Number(amount) || 0));
  if (num >= 1_000_000) {
    const jt = num / 1_000_000;
    const str = Number.isInteger(jt) ? String(jt) : jt.toFixed(1).replace(".", ",");
    return `Rp ${str} Juta`;
  }
  return formatRupiah(num);
}

function calcAnnuityMonthly(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r <= 0) return principal / months;
  const factor = Math.pow(1 + r, months);
  return (principal * r * factor) / (factor - 1);
}

function roundToTenThousand(n) {
  return Math.round(n / 10_000) * 10_000;
}

/** Normalisasi nomor HP Indonesia identik dengan backend parsePhone (/^08[0-9]{8,12}$/) */
function normalizeIndonesianMobile(raw) {
  let digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("628")) {
    digits = "0" + digits.slice(2);
  } else if (digits.startsWith("8") && digits.length >= 9 && digits.length <= 13) {
    digits = "0" + digits;
  }
  return digits;
}

/** Sanitasi ketat parameter UTM (/[a-zA-Z0-9_-]{1,40}/) untuk atribusi sumber iklan ke CRM */
function sanitizeUtmParam(raw) {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40);
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(cleaned) || !/[a-zA-Z0-9]/.test(cleaned)) {
    return "";
  }
  return cleaned;
}

/** Baca & bentuk tag ringkas UTM dari URL awal kunjungan ([Sumber: <utm_source>/<utm_campaign>]) */
function readInitialUtmTag() {
  if (typeof window === "undefined" || !window.location?.search) return "";
  try {
    const params = new URLSearchParams(window.location.search);
    const source = sanitizeUtmParam(params.get("utm_source"));
    const medium = sanitizeUtmParam(params.get("utm_medium"));
    const campaign = sanitizeUtmParam(params.get("utm_campaign"));
    const parts = [source, medium, campaign].filter(Boolean);
    if (!parts.length) return "";
    return `[Sumber: ${parts.join("/")}]`;
  } catch {
    return "";
  }
}

export default function App() {
  // Tangkap tag atribusi UTM sekali saat kunjungan pertama agar tetap utuh saat berpindah halaman
  const [utmAttributionTag] = useState(() => readInitialUtmTag());
  // Phase tracking untuk sinkronisasi widget Turnstile pada langkah form
  const [activePhase, setActivePhase] = useState("dialog");
  // Mode permintaan: 'simulasi' (dari kalkulator) vs 'konsultasi-cabang' (Menu 04 / Profil Perusahaan)
  const [inquiryMode, setInquiryMode] = useState("simulasi");

  // Calculator State (Layman-Friendly Public Estimator)
  const [selectedGoalId, setSelectedGoalId] = useState("usaha");
  const [pensionStatus, setPensionStatus] = useState("Sudah Pensiun");
  const [age, setAge] = useState(63);
  const [ageInputText, setAgeInputText] = useState("63");
  const [ageTouched, setAgeTouched] = useState(false);
  const [retirementDate, setRetirementDate] = useState(() => getDefaultRetirementDateIso(2));
  const [salary, setSalary] = useState(4_500_000);
  const [salaryInputText, setSalaryInputText] = useState("4.500.000");
  const [plafond, setPlafond] = useState(100_000_000);
  const [tenorYears, setTenorYears] = useState(8);
  const [oldInstallment, setOldInstallment] = useState(0);
  const [oldInstallmentText, setOldInstallmentText] = useState("");

  // Lead Capture Form State (POST /api/public/leads)
  const [institution, setInstitution] = useState("TASPEN");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState(""); // Honeypot
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(null);

  const turnstileContainerRef = useRef(null);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

  const activeGoal = useMemo(
    () => LOAN_GOALS.find((g) => g.id === selectedGoalId) || LOAN_GOALS[0],
    [selectedGoalId]
  );

  const maxAllowedTenorYears = useMemo(() => {
    const remaining = PUBLIC_CALCULATOR_CONFIG.maxMaturityAge - age;
    return Math.max(1, Math.min(PUBLIC_CALCULATOR_CONFIG.maxTenorYears, remaining));
  }, [age]);

  const effectiveTenorYears = Math.min(tenorYears, maxAllowedTenorYears);
  const effectiveTenorMonths = effectiveTenorYears * 12;

  // Analisa Tanggal Pensiun (TMT Pensiun) khusus untuk Prapensiun
  const prapenAnalysis = useMemo(() => {
    if (pensionStatus !== "Prapensiun") {
      return null;
    }
    const retDt = parseIsoDateLocal(retirementDate);
    if (!retDt) {
      return {
        valid: false,
        status: "missing",
        monthsToRetirement: 0,
        activeTenorMonths: 0,
        pensionTenorMonths: effectiveTenorMonths,
        formattedDate: "-",
        remainingLabel: "-",
        badge: "Isi Tanggal Pensiun",
        detail: "Silakan pilih perkiraan tanggal pensiun (TMT) Bapak/Ibu agar estimasi masa dinas aktif dapat dihitung."
      };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = (retDt.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24);
    const monthsToRetirement = diffDays <= 0 ? 0 : Math.max(1, Math.round(diffDays / 30.4375));
    const activeTenorMonths = Math.min(effectiveTenorMonths, monthsToRetirement);
    const pensionTenorMonths = Math.max(0, effectiveTenorMonths - activeTenorMonths);
    const formattedDate = formatIndonesianDate(retirementDate);
    const remainingLabel = formatMonthsHuman(monthsToRetirement);

    if (monthsToRetirement <= 0) {
      return {
        valid: true,
        status: "already_retired",
        monthsToRetirement: 0,
        activeTenorMonths: 0,
        pensionTenorMonths: effectiveTenorMonths,
        formattedDate,
        remainingLabel: "0 Bulan",
        badge: "Sudah Memasuki Masa Pensiun",
        detail: `Tanggal ${formattedDate} sudah lewat atau jatuh bulan ini. Jika sudah menerima SK Pensiun, Bapak/Ibu dapat memilih status "Sudah Pensiun".`
      };
    }

    if (monthsToRetirement > PUBLIC_CALCULATOR_CONFIG.prapenMaxMonthsToRetirement) {
      return {
        valid: true,
        status: "over_limit",
        monthsToRetirement,
        activeTenorMonths,
        pensionTenorMonths,
        formattedDate,
        remainingLabel,
        badge: "Sisa Dinas > 10 Tahun",
        detail: `Sisa masa aktif ${remainingLabel} (${monthsToRetirement} bulan) melampaui batas umum Prapensiun 10 tahun. Pastikan tanggal pensiun sesuai atau konsultasikan ke petugas cabang.`
      };
    }

    if (monthsToRetirement <= PUBLIC_CALCULATOR_CONFIG.prapenNearTermMonths) {
      return {
        valid: true,
        status: "near_term",
        monthsToRetirement,
        activeTenorMonths,
        pensionTenorMonths,
        formattedDate,
        remainingLabel,
        badge: "Prapensiun Dekat Pensiun (≤ 3 Tahun)",
        detail: `Sisa masa dinas aktif ${remainingLabel} (${monthsToRetirement} bulan menuju ${formattedDate}). Cocok untuk program Prapensiun dekat masa purnabakti.`
      };
    }

    return {
      valid: true,
      status: "mid_long_term",
      monthsToRetirement,
      activeTenorMonths,
      pensionTenorMonths,
      formattedDate,
      remainingLabel,
      badge: "Prapensiun Menengah / Jangka Panjang",
      detail: `Sisa masa dinas aktif ${remainingLabel} (${monthsToRetirement} bulan menuju ${formattedDate}). Dapat didampingi dengan pilihan skema Prapensiun hingga 10 tahun sebelum pensiun.`
    };
  }, [pensionStatus, retirementDate, effectiveTenorMonths]);

  const estimate = useMemo(() => {
    const lowRaw = calcAnnuityMonthly(
      plafond,
      PUBLIC_CALCULATOR_CONFIG.indicativeAnnualRateLow,
      effectiveTenorMonths
    );
    const highRaw = calcAnnuityMonthly(
      plafond,
      PUBLIC_CALCULATOR_CONFIG.indicativeAnnualRateHigh,
      effectiveTenorMonths
    );
    const installmentLow = roundToTenThousand(lowRaw);
    const installmentHigh = Math.max(installmentLow + 10_000, roundToTenThousand(highRaw));
    const avgInstallment = (installmentLow + installmentHigh) / 2;
    const remainingSalary = Math.max(0, salary - Math.round(avgInstallment));
    const hasSalary = salary > 0;
    const ratio = hasSalary ? avgInstallment / salary : 1;
    const ratioPct = hasSalary ? Math.min(999, Math.round(ratio * 100)) : 100;
    const remainingRatioPct = hasSalary
      ? Math.max(0, Math.min(100, Math.round((remainingSalary / salary) * 100)))
      : 0;
    const isWithinSafeRatio = hasSalary && ratio <= PUBLIC_CALCULATOR_CONFIG.safeInstallmentRatio;
    const walletRemainingBarPct = !hasSalary
      ? 0
      : remainingSalary <= 0
        ? 0
        : Math.max(8, Math.min(92, remainingRatioPct));
    const ageAtMaturity = age + effectiveTenorYears;
    const isSeniorSpecialScheme = age > PUBLIC_CALCULATOR_CONFIG.seniorAdvisoryAge;
    const estimatedMonthlySaving =
      selectedGoalId === "takeover" && oldInstallment > 0
        ? Math.round(oldInstallment - avgInstallment)
        : 0;

    // Hitung plafon aman yang disarankan (cicilan <= 70% gaji pada tenor maksimum usia saat ini)
    let safeSuggestedPlafond = PUBLIC_CALCULATOR_CONFIG.minPlafond;
    if (hasSalary) {
      const maxMonths = maxAllowedTenorYears * 12;
      const midRate =
        (PUBLIC_CALCULATOR_CONFIG.indicativeAnnualRateLow +
          PUBLIC_CALCULATOR_CONFIG.indicativeAnnualRateHigh) /
        2;
      const maxMonthlyBudget = salary * PUBLIC_CALCULATOR_CONFIG.safeInstallmentRatio;
      const r = midRate / 12;
      const factor = Math.pow(1 + r, maxMonths);
      const pvMax = (maxMonthlyBudget * (factor - 1)) / (r * factor);
      const floored =
        Math.floor(pvMax / PUBLIC_CALCULATOR_CONFIG.plafondStep) *
        PUBLIC_CALCULATOR_CONFIG.plafondStep;
      safeSuggestedPlafond = Math.max(
        PUBLIC_CALCULATOR_CONFIG.minPlafond,
        Math.min(PUBLIC_CALCULATOR_CONFIG.maxPlafond, floored)
      );
    }

    return {
      installmentLow,
      installmentHigh,
      avgInstallment,
      remainingSalary,
      ratioPct,
      remainingRatioPct,
      isWithinSafeRatio,
      walletRemainingBarPct,
      safeSuggestedPlafond,
      ageAtMaturity,
      isSeniorSpecialScheme,
      estimatedMonthlySaving
    };
  }, [
    plafond,
    effectiveTenorMonths,
    effectiveTenorYears,
    salary,
    age,
    maxAllowedTenorYears,
    selectedGoalId,
    oldInstallment
  ]);

  // Mount Cloudflare Turnstile tepat saat form kontak tampil (activePhase === 'lead-form' && !submitSuccess)
  useEffect(() => {
    if (
      activePhase !== "lead-form" ||
      submitSuccess ||
      !turnstileSiteKey ||
      !turnstileContainerRef.current
    ) {
      return undefined;
    }

    let widgetId = null;

    const renderWidget = () => {
      if (window.turnstile && turnstileContainerRef.current) {
        turnstileContainerRef.current.replaceChildren();
        setTurnstileToken("");
        widgetId = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken("")
        });
      }
    };

    const cleanupWidget = () => {
      if (widgetId !== null && window.turnstile && typeof window.turnstile.remove === "function") {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // noop
        }
        widgetId = null;
      }
    };

    if (window.turnstile) {
      renderWidget();
      return cleanupWidget;
    }

    let script = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderWidget);
    return () => {
      script.removeEventListener("load", renderWidget);
      cleanupWidget();
    };
  }, [activePhase, submitSuccess, turnstileSiteKey]);

  const handleApplyIntentPreset = useCallback((intent) => {
    if (!intent) return;
    setInquiryMode(intent.id === "cek-cabang" ? "konsultasi-cabang" : "simulasi");
    setPensionStatus(intent.pensionStatus);
    setInstitution(intent.institution);
    setAge(intent.age);
    setAgeInputText(String(intent.age));
    setAgeTouched(intent.id === "prapensiun");
    setSelectedGoalId(intent.goalId);
    setPlafond(intent.plafond);
    setTenorYears(intent.tenorYears);
    if (intent.goalId !== "takeover") {
      setOldInstallment(0);
      setOldInstallmentText("");
    }
  }, []);

  const handleStatusSelect = useCallback(
    (opt) => {
      setPensionStatus(opt.value);
      setInstitution(opt.defaultInst);
      if (!ageTouched) {
        setAge(opt.defaultAge);
        setAgeInputText(String(opt.defaultAge));
      }
    },
    [ageTouched]
  );

  // Ketik bebas usia (misal hapus "63" lalu ketik "58") tanpa langsung ditarik ke 45 saat mengetik
  const handleAgeInputChange = useCallback((raw) => {
    const digits = String(raw || "").replace(/[^0-9]/g, "").slice(0, 2);
    setAgeInputText(digits);
    if (digits.length === 2) {
      const parsed = Number(digits);
      if (
        parsed >= PUBLIC_CALCULATOR_CONFIG.minAge &&
        parsed <= PUBLIC_CALCULATOR_CONFIG.maxAge
      ) {
        setAgeTouched(true);
        setAge(parsed);
      }
    }
  }, []);

  const handleAgeBlur = useCallback(() => {
    const parsed = Number(ageInputText);
    const fallback = Number.isFinite(parsed) && parsed > 0 ? parsed : age;
    const clamped = Math.max(
      PUBLIC_CALCULATOR_CONFIG.minAge,
      Math.min(PUBLIC_CALCULATOR_CONFIG.maxAge, Math.round(fallback))
    );
    setAgeTouched(true);
    setAge(clamped);
    setAgeInputText(String(clamped));
  }, [ageInputText, age]);

  const handleAgeStep = useCallback((nextAge) => {
    const clamped = Math.max(
      PUBLIC_CALCULATOR_CONFIG.minAge,
      Math.min(PUBLIC_CALCULATOR_CONFIG.maxAge, Math.round(Number(nextAge) || 63))
    );
    setAgeTouched(true);
    setAge(clamped);
    setAgeInputText(String(clamped));
  }, []);

  const handleRetirementQuickYears = useCallback((yearsAhead) => {
    setRetirementDate(getDefaultRetirementDateIso(yearsAhead));
  }, []);

  const handleSalaryTextChange = useCallback((raw) => {
    const digits = String(raw || "").replace(/[^0-9]/g, "");
    if (!digits) {
      setSalary(0);
      setSalaryInputText("");
      return;
    }
    const capped = Math.min(100_000_000, Number(digits));
    setSalary(capped);
    setSalaryInputText(capped.toLocaleString("id-ID"));
  }, []);

  const handleSalaryPreset = useCallback((val) => {
    setSalary(val);
    setSalaryInputText(val.toLocaleString("id-ID"));
  }, []);

  const handleOldInstallmentTextChange = useCallback((raw) => {
    const digits = String(raw || "").replace(/[^0-9]/g, "");
    if (!digits) {
      setOldInstallment(0);
      setOldInstallmentText("");
      return;
    }
    const capped = Math.min(50_000_000, Number(digits));
    setOldInstallment(capped);
    setOldInstallmentText(capped.toLocaleString("id-ID"));
  }, []);

  const handlePlafondChange = useCallback((nextPlafond) => {
    const clamped = Math.max(
      PUBLIC_CALCULATOR_CONFIG.minPlafond,
      Math.min(
        PUBLIC_CALCULATOR_CONFIG.maxPlafond,
        Math.round(Number(nextPlafond) / PUBLIC_CALCULATOR_CONFIG.plafondStep) *
          PUBLIC_CALCULATOR_CONFIG.plafondStep
      )
    );
    setPlafond(clamped);
  }, []);

  const handleTenorChange = useCallback(
    (nextYears) => {
      const clamped = Math.max(1, Math.min(maxAllowedTenorYears, Number(nextYears) || 1));
      setTenorYears(clamped);
    },
    [maxAllowedTenorYears]
  );

  const handleApplySafeSuggestion = useCallback(() => {
    setTenorYears(maxAllowedTenorYears);
    setPlafond(estimate.safeSuggestedPlafond);
  }, [maxAllowedTenorYears, estimate.safeSuggestedPlafond]);

  // Susun tautan WhatsApp untuk membagikan estimasi simulasi ke anak / keluarga
  const familyShareUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://layananpensiunan.id";
    const lines = [
      "Ringkasan Estimasi Awal — Layanan Pensiunan",
      `• Status: ${pensionStatus} (Usia ${age} thn)`
    ];
    if (pensionStatus === "Prapensiun" && prapenAnalysis?.valid) {
      lines.push(
        `• Rencana Pensiun (TMT): ${prapenAnalysis.formattedDate} (Sisa aktif ${prapenAnalysis.remainingLabel})`
      );
    }
    lines.push(
      `• Perkiraan Gaji: ${formatRupiah(salary)}/bln`,
      `• Dana yang Diinginkan: ${formatRupiah(plafond)} (${effectiveTenorYears} Tahun)`,
      `• Perkiraan Cicilan: ${formatRupiah(estimate.installmentLow)} – ${formatRupiah(estimate.installmentHigh)}/bln`,
      `• Sisa Uang di Tangan: ± ${formatRupiah(estimate.remainingSalary)}/bln`
    );
    if (estimate.estimatedMonthlySaving > 0) {
      lines.push(
        `• Perkiraan Lebih Ringan (Take Over): ± ${formatRupiah(estimate.estimatedMonthlySaving)}/bln`
      );
    }
    lines.push("", `Cek info resmi di: ${origin}`);
    return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [
    pensionStatus,
    age,
    prapenAnalysis,
    salary,
    plafond,
    effectiveTenorYears,
    estimate.installmentLow,
    estimate.installmentHigh,
    estimate.remainingSalary,
    estimate.estimatedMonthlySaving
  ]);

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    const trimmedName = name.trim();
    const normalizedPhone = normalizeIndonesianMobile(phone);
    const trimmedCity = city.trim();

    if (trimmedName.length < 3) {
      setSubmitError("Mohon isi Nama Lengkap Bapak/Ibu (minimal 3 huruf).");
      return;
    }
    if (!/^08[0-9]{8,12}$/.test(normalizedPhone)) {
      setSubmitError(
        "Mohon isi Nomor HP / WhatsApp Indonesia yang dimulai angka 08 (10–14 angka, contoh: 081234567890)."
      );
      return;
    }
    if (trimmedCity.length < 2) {
      setSubmitError("Mohon isi atau pilih Kota / Kabupaten tempat tinggal Bapak/Ibu.");
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setSubmitError("Mohon centang verifikasi keamanan di atas sebelum mengirim.");
      return;
    }

    const isBranchOnly = inquiryMode === "konsultasi-cabang";
    const cityCode = trimmedCity.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "IDN";
    const suffix = String(Date.now()).slice(-4);
    const refCode = `LP-${cityCode}-${suffix}`;

    // Perbaikan segmentasi Menu 4 (Cek Cabang): bila memilih PNS AKTIF tanpa simulasi, otomatis masuk pool Prapensiun (age 55)
    const submitPensionStatus = isBranchOnly
      ? institution === "PNS AKTIF"
        ? "Prapensiun"
        : "Sudah Pensiun"
      : pensionStatus;
    const submitAge = isBranchOnly ? (institution === "PNS AKTIF" ? 55 : 65) : age;

    const utmPrefix = utmAttributionTag ? ` ${utmAttributionTag}` : "";
    let rawSummary;
    if (isBranchOnly) {
      rawSummary = `[Ref: ${refCode}]${utmPrefix} Konsultasi Cabang Web: Meminta dihubungi petugas cabang terdekat.`;
    } else {
      const extraParts = [];
      if (pensionStatus === "Prapensiun" && prapenAnalysis?.valid) {
        extraParts.push(
          `TMT Pensiun ${prapenAnalysis.formattedDate} (Sisa ${prapenAnalysis.monthsToRetirement} bln)`
        );
      }
      if (selectedGoalId === "takeover" && oldInstallment > 0) {
        extraParts.push(`Cicilan Lama ${formatRupiah(oldInstallment)}/bln`);
      }
      const extraText = extraParts.length ? ` | ${extraParts.join(" | ")}` : "";
      rawSummary =
        `[Ref: ${refCode}]${utmPrefix} Simulasi Web (${activeGoal.shortLabel}): Plafon ${formatRupiah(plafond)} | ` +
        `Tenor ${effectiveTenorYears} thn (${effectiveTenorMonths} bln) | ` +
        `Est. Angsuran ${formatRupiah(estimate.installmentLow)}–${formatRupiah(estimate.installmentHigh)}/bln${extraText}`;
    }
    const simulationSummary = rawSummary.slice(0, 495);

    const payload = {
      name: trimmedName,
      phone: normalizedPhone,
      city: trimmedCity,
      institution,
      pension_status: submitPensionStatus,
      age: submitAge,
      salary_estimate: isBranchOnly
        ? 0
        : Math.max(0, Math.min(100_000_000, Math.round(salary))),
      notes: simulationSummary,
      company_website: companyWebsite
    };

    if (turnstileSiteKey && turnstileToken) {
      payload.turnstile_token = turnstileToken;
    }

    setSubmitting(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(
          data?.detail || "Permohonan belum dapat dikirim. Mohon periksa kembali data Bapak/Ibu."
        );
        return;
      }

      setSubmitSuccess({
        queueNo: refCode,
        visitorName: trimmedName,
        message:
          data?.message ||
          "Terima kasih. Permohonan konsultasi Anda telah kami terima dan tim cabang terdekat akan segera menghubungi Anda.",
        summary: simulationSummary,
        remainingMonthly: formatRupiah(estimate.remainingSalary),
        city: trimmedCity.toUpperCase(),
        isBranchOnly
      });
      setName("");
      setPhone("");
      setCompanyWebsite("");
      setTurnstileToken("");
    } catch (err) {
      setSubmitError(
        err?.name === "AbortError"
          ? "Waktu kirim habis karena koneksi lambat. Mohon coba kirim kembali."
          : "Koneksi internet sedang terputus. Mohon pastikan sinyal aktif lalu coba kirim kembali."
      );
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  };

  return (
    <GameIntro
      onPhaseChange={setActivePhase}
      inquiryMode={inquiryMode}
      setInquiryMode={setInquiryMode}
      selectedGoalId={selectedGoalId}
      pensionStatus={pensionStatus}
      pensionStatusOptions={PENSION_STATUS_OPTIONS}
      onStatusSelect={handleStatusSelect}
      age={age}
      ageInputText={ageInputText}
      onAgeInputChange={handleAgeInputChange}
      onAgeBlur={handleAgeBlur}
      onAgeStep={handleAgeStep}
      retirementDate={retirementDate}
      onRetirementDateChange={setRetirementDate}
      onRetirementQuickYears={handleRetirementQuickYears}
      prapenAnalysis={prapenAnalysis}
      maxAllowedTenorYears={maxAllowedTenorYears}
      salary={salary}
      salaryInputText={salaryInputText}
      salaryPresets={SALARY_PRESETS}
      onSalaryTextChange={handleSalaryTextChange}
      onSalaryPreset={handleSalaryPreset}
      oldInstallment={oldInstallment}
      oldInstallmentText={oldInstallmentText}
      onOldInstallmentTextChange={handleOldInstallmentTextChange}
      plafond={plafond}
      plafondQuickChips={PLAFOND_QUICK_CHIPS}
      onPlafondChange={handlePlafondChange}
      effectiveTenorYears={effectiveTenorYears}
      effectiveTenorMonths={effectiveTenorMonths}
      tenorQuickChips={TENOR_QUICK_CHIPS}
      onTenorChange={handleTenorChange}
      onApplySafeSuggestion={handleApplySafeSuggestion}
      activeGoal={activeGoal}
      estimate={estimate}
      familyShareUrl={familyShareUrl}
      formatRupiah={formatRupiah}
      formatRupiahCompact={formatRupiahCompact}
      formatMonthsHuman={formatMonthsHuman}
      onApplyIntentPreset={handleApplyIntentPreset}
      institution={institution}
      setInstitution={setInstitution}
      name={name}
      setName={setName}
      phone={phone}
      setPhone={setPhone}
      city={city}
      setCity={setCity}
      allCities={ALL_CITIES}
      companyWebsite={companyWebsite}
      setCompanyWebsite={setCompanyWebsite}
      submitting={submitting}
      submitError={submitError}
      setSubmitError={setSubmitError}
      submitSuccess={submitSuccess}
      setSubmitSuccess={setSubmitSuccess}
      onLeadSubmit={handleLeadSubmit}
      turnstileSiteKey={turnstileSiteKey}
      turnstileContainerRef={turnstileContainerRef}
    />
  );
}
