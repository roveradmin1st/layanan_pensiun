import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX
} from "lucide-react";
import {
  GAME_INTRO_CONFIG,
  MASCOT_INTENT_MENUS,
  PUBLIC_CALCULATOR_CONFIG,
  SITE_CONTENT
} from "../config/site-content.js";

const CorporateView = React.lazy(() => import("./CorporateView.jsx"));

/**
 * PENDAMPING INTERAKTIF KHUSUS LANSIA (TENANG, PROPORSIONAL, & BEBAS CELAH)
 * Perbaikan visual utama:
 * 1. Header 1 baris rapi di HP maupun Desktop (tidak pernah pecah jadi 3 baris).
 * 2. Maskot tidak pernah mengambang putus di tengah udara:
 *    - Mode A (Sambutan/4 Pilihan): Maskot muncul dari balik tepi atas kartu dialog (-mt-10)
 *      dan seluruh elemen muat 100% dalam 1 layar (tanpa scrollbar vertikal di 1280x900 maupun 390x844).
 *    - Mode B (Langkah Simulasi): Pada Desktop, maskot menapak penuh di tepi bawah layar (bottom-0)
 *      di kolom kiri; pada HP, kartu dialog menempel rapat (-mt-7) menutup batas bawah maskot.
 * 3. Sayap Perisai Brand utuh di dalam bingkai layar tanpa lingkaran putih belang.
 */

const KANWIL_SHORT_LABELS = {
  "WIL-1": "Sumut & Aceh",
  "WIL-2": "Riau, Sumbar, Sumsel & Lampung",
  "WIL-3": "Jabodetabek & Banten",
  "WIL-4": "Jawa Barat",
  "WIL-5": "Jateng & DIY",
  "WIL-6": "Jatim, Bali & Nusra",
  "WIL-7": "Kalimantan & Sulawesi"
};

const BRANCH_COVERAGE_DETAILS = {
  MEDAN: {
    label: "Cabang Medan",
    coverage: "Kota Medan, Binjai, Deli Serdang, Karo & sekitarnya",
    keywords: ["medan", "binjai", "deli serdang", "karo"]
  },
  PEMATANGSIANTAR: {
    label: "Cabang Pematangsiantar",
    coverage:
      "Pematangsiantar, Simalungun, Tebing Tinggi, Toba, Asahan, Batu Bara, Humbahas & Tapanuli",
    keywords: [
      "pematangsiantar",
      "siantar",
      "simalungun",
      "tebing tinggi",
      "toba",
      "asahan",
      "batu bara",
      "humbahas",
      "tapanuli"
    ]
  },
  NIAS: {
    label: "Cabang Nias",
    coverage: "Gunungsitoli, Nias Selatan, Nias Utara & Nias Barat",
    keywords: ["nias", "gunungsitoli", "gunung sitoli"]
  },
  "BANDA ACEH": {
    label: "Cabang Banda Aceh",
    coverage: "Banda Aceh, Aceh Besar, Lhokseumawe & Aceh Barat",
    keywords: ["banda aceh", "aceh", "lhokseumawe"]
  },
  PEKANBARU: {
    label: "Cabang Pekanbaru",
    coverage: "Pekanbaru, Dumai, Kampar, Rokan & wilayah Riau",
    keywords: ["pekanbaru", "riau", "dumai", "kampar", "rokan"]
  },
  PADANG: {
    label: "Cabang Padang",
    coverage: "Padang, Bukittinggi, Agam, Solok & Sumatera Barat",
    keywords: ["padang", "sumbar", "bukittinggi", "agam", "solok"]
  },
  PALEMBANG: {
    label: "Cabang Palembang",
    coverage: "Palembang, Ogan Ilir, Banyuasin, Prabumulih & Sumatera Selatan",
    keywords: ["palembang", "sumsel", "ogan ilir", "banyuasin", "prabumulih"]
  },
  "BANDAR LAMPUNG": {
    label: "Cabang Bandar Lampung",
    coverage: "Bandar Lampung, Metro, Lampung Selatan & wilayah Lampung",
    keywords: ["bandar lampung", "lampung", "metro"]
  },
  "PUSAT JAKARTA": {
    label: "Kantor Pusat Jakarta",
    coverage: "DKI Jakarta (Jakarta Pusat, Selatan, Timur, Barat & Utara)",
    keywords: ["jakarta", "pusat jakarta", "dki"]
  },
  BOGOR: {
    label: "Cabang Bogor & Depok",
    coverage: "Kota Bogor, Kab. Bogor & Kota Depok",
    keywords: ["bogor", "depok"]
  },
  TANGERANG: {
    label: "Cabang Tangerang",
    coverage: "Kota Tangerang, Tangerang Selatan (Tangsel) & Kab. Tangerang",
    keywords: ["tangerang", "tangsel"]
  },
  BEKASI: {
    label: "Cabang Bekasi",
    coverage: "Kota Bekasi, Kab. Bekasi & sekitarnya",
    keywords: ["bekasi", "cikarang"]
  },
  SERANG: {
    label: "Cabang Serang",
    coverage: "Kota Serang, Cilegon, Pandeglang & Lebak (Banten)",
    keywords: ["serang", "banten", "cilegon", "pandeglang", "lebak"]
  },
  BANDUNG: {
    label: "Cabang Bandung",
    coverage: "Kota Bandung, Kab. Bandung, Bandung Barat & Cimahi",
    keywords: ["bandung", "cimahi"]
  },
  CIREBON: {
    label: "Cabang Cirebon",
    coverage: "Kota/Kab. Cirebon, Indramayu, Majalengka & Kuningan",
    keywords: ["cirebon", "indramayu", "majalengka", "kuningan"]
  },
  TASIKMALAYA: {
    label: "Cabang Tasikmalaya",
    coverage: "Tasikmalaya, Garut, Ciamis, Banjar & Pangandaran",
    keywords: ["tasikmalaya", "tasik", "garut", "ciamis", "banjar", "pangandaran"]
  },
  SUKABUMI: {
    label: "Cabang Sukabumi",
    coverage: "Kota/Kab. Sukabumi & Cianjur",
    keywords: ["sukabumi", "cianjur"]
  },
  SEMARANG: {
    label: "Cabang Semarang",
    coverage: "Kota Semarang, Kendal, Demak & Salatiga",
    keywords: ["semarang", "kendal", "demak", "salatiga"]
  },
  SOLO: {
    label: "Cabang Solo (Surakarta)",
    coverage: "Surakarta (Solo), Sukoharjo, Klaten, Boyolali, Karanganyar & Sragen",
    keywords: ["solo", "surakarta", "sukoharjo", "klaten", "boyolali", "karanganyar", "sragen"]
  },
  YOGYAKARTA: {
    label: "Cabang Yogyakarta",
    coverage: "Kota Yogyakarta, Sleman, Bantul, Kulon Progo & Gunungkidul",
    keywords: ["yogyakarta", "jogja", "sleman", "bantul", "kulon progo", "gunungkidul"]
  },
  PURWOKERTO: {
    label: "Cabang Purwokerto",
    coverage: "Purwokerto (Banyumas), Cilacap, Purbalingga & Banjarnegara",
    keywords: ["purwokerto", "banyumas", "cilacap", "purbalingga", "banjarnegara"]
  },
  SURABAYA: {
    label: "Cabang Surabaya",
    coverage: "Kota Surabaya, Sidoarjo, Gresik & Mojokerto",
    keywords: ["surabaya", "sidoarjo", "gresik", "mojokerto"]
  },
  MALANG: {
    label: "Cabang Malang",
    coverage: "Kota/Kab. Malang, Kota Batu, Pasuruan & Probolinggo",
    keywords: ["malang", "batu", "pasuruan", "probolinggo"]
  },
  JEMBER: {
    label: "Cabang Jember",
    coverage: "Jember, Banyuwangi, Lumajang & Situbondo",
    keywords: ["jember", "banyuwangi", "lumajang", "situbondo"]
  },
  DENPASAR: {
    label: "Cabang Denpasar",
    coverage: "Denpasar, Badung, Gianyar, Tabanan, Buleleng & seluruh Bali",
    keywords: ["denpasar", "bali", "badung", "gianyar", "tabanan", "buleleng"]
  },
  MATARAM: {
    label: "Cabang Mataram",
    coverage: "Mataram, Lombok, Sumbawa, Bima & Kupang (NTB & NTT)",
    keywords: ["mataram", "lombok", "ntb", "ntt", "sumbawa", "bima", "kupang"]
  },
  BALIKPAPAN: {
    label: "Cabang Balikpapan",
    coverage: "Balikpapan, Samarinda, Kutai Kartanegara & Kalimantan Timur",
    keywords: ["balikpapan", "samarinda", "kutai", "kaltim"]
  },
  BANJARMASIN: {
    label: "Cabang Banjarmasin",
    coverage: "Banjarmasin, Banjarbaru, Barito & Kalimantan Selatan",
    keywords: ["banjarmasin", "banjarbaru", "barito", "kalsel"]
  },
  MAKASSAR: {
    label: "Cabang Makassar",
    coverage: "Makassar, Gowa, Maros, Parepare, Bone & Sulawesi Selatan",
    keywords: ["makassar", "ujung pandang", "gowa", "maros", "parepare", "bone", "sulsel"]
  },
  MANADO: {
    label: "Cabang Manado",
    coverage: "Manado, Minahasa, Tomohon, Bitung, Ambon & Jayapura",
    keywords: ["manado", "minahasa", "tomohon", "bitung", "ambon", "jayapura", "sulut"]
  }
};

function splitPages(pages) {
  const total = pages.reduce((sum, p) => sum + p.length, 0);
  let acc = 0;
  return pages.map((text) => {
    const start = acc / total;
    acc += text.length;
    return { text, start, end: acc / total };
  });
}

function parseHashCorporateSection() {
  if (typeof window === "undefined") return null;
  const h = String(window.location.hash || "")
    .replace(/^#\/?/, "")
    .toLowerCase()
    .trim();
  if (h === "profil" || h === "corp-profil") return "profil";
  if (h === "edukasi" || h === "panduan" || h === "corp-edukasi") return "edukasi";
  if (h === "karir" || h === "karier" || h === "corp-karir") return "karir";
  if (h === "mitra" || h === "investor" || h === "corp-mitra") return "mitra";
  return null;
}

export default function GameIntro({
  onPhaseChange,
  inquiryMode,
  setInquiryMode,
  selectedGoalId,
  pensionStatus,
  pensionStatusOptions,
  onStatusSelect,
  age,
  ageInputText,
  onAgeInputChange,
  onAgeBlur,
  onAgeStep,
  retirementDate,
  onRetirementDateChange,
  onRetirementQuickYears,
  prapenAnalysis,
  maxAllowedTenorYears,
  salary,
  salaryInputText,
  salaryPresets,
  onSalaryTextChange,
  onSalaryPreset,
  oldInstallmentText,
  onOldInstallmentTextChange,
  plafond,
  plafondQuickChips,
  onPlafondChange,
  effectiveTenorYears,
  effectiveTenorMonths,
  tenorQuickChips,
  onTenorChange,
  onApplySafeSuggestion,
  estimate,
  familyShareUrl,
  formatRupiah,
  formatRupiahCompact,
  formatMonthsHuman,
  onApplyIntentPreset,
  institution,
  setInstitution,
  name,
  setName,
  phone,
  setPhone,
  city,
  setCity,
  allCities,
  pdpConsent,
  setPdpConsent,
  pdpConsentVersion = "UU-PDP-2026-v1",
  companyWebsite,
  setCompanyWebsite,
  submitting,
  submitError,
  setSubmitError,
  submitSuccess,
  setSubmitSuccess,
  onLeadSubmit,
  turnstileSiteKey,
  turnstileContainerRef
}) {
  const initialCorpFromHash = useMemo(() => parseHashCorporateSection(), []);
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const [gateStage, setGateStage] = useState(() =>
    initialCorpFromHash || prefersReducedMotion ? "done" : "closed"
  );
  const [phase, setPhase] = useState(() => (initialCorpFromHash ? "choices" : "dialog"));
  const [corporateSection, setCorporateSection] = useState(() => initialCorpFromHash);
  const [corporateArticleId, setCorporateArticleId] = useState(null);
  const [profileWarning, setProfileWarning] = useState("");
  const [activeKanwilCode, setActiveKanwilCode] = useState("WIL-1");
  const [branchSearch, setBranchSearch] = useState("");
  const [selectedBranchCity, setSelectedBranchCity] = useState(null);
  const [soundOn, setSoundOn] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [progress, setProgress] = useState(() => (initialCorpFromHash ? 1 : 0));
  const [showPdpModal, setShowPdpModal] = useState(false);

  useEffect(() => {
    if (!showPdpModal) return undefined;
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") setShowPdpModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPdpModal]);

  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const fallbackStartRef = useRef(0);
  const usingFallbackRef = useRef(true);
  const timersRef = useRef([]);
  const soundOnRef = useRef(soundOn);
  const phaseRef = useRef(phase);
  const gateOpenedRef = useRef(initialCorpFromHash || prefersReducedMotion);
  const historyReadyRef = useRef(false);

  const pushHistoryView = useCallback(
    (nextPhase, nextCorp = null, nextBranch = null, nextArticleId = null) => {
      try {
        const hash = nextCorp ? `#${nextCorp}` : "";
        const targetUrl = `${window.location.pathname}${window.location.search}${hash}`;
        window.history.pushState(
          {
            lpPhase: nextPhase,
            lpCorp: nextCorp,
            lpBranch: nextBranch,
            lpArticle: nextArticleId
          },
          "",
          targetUrl
        );
      } catch {
        // noop
      }
    },
    []
  );

  // Sinkronisasi Tombol Back HP (Android/iOS) & Deep-Link Hash via Browser History API
  useEffect(() => {
    if (!historyReadyRef.current) {
      historyReadyRef.current = true;
      try {
        const initHash = initialCorpFromHash ? `#${initialCorpFromHash}` : "";
        window.history.replaceState(
          {
            lpPhase: initialCorpFromHash ? "choices" : "dialog",
            lpCorp: initialCorpFromHash,
            lpBranch: null,
            lpArticle: null
          },
          "",
          `${window.location.pathname}${window.location.search}${initHash}`
        );
      } catch {
        // noop
      }
    }

    const onPopState = (ev) => {
      const st = ev.state;
      if (st && typeof st.lpPhase === "string") {
        setCorporateSection(st.lpCorp || null);
        setCorporateArticleId(st.lpArticle || null);
        setSelectedBranchCity(st.lpBranch || null);
        setPhase(st.lpPhase);
        if (st.lpPhase !== "dialog") setProgress(1);
        return;
      }
      const fromHash = parseHashCorporateSection();
      setCorporateSection(fromHash);
      setCorporateArticleId(null);
      if (fromHash) {
        setPhase("choices");
        setProgress(1);
      } else {
        setSelectedBranchCity(null);
        setPhase("choices");
        setProgress(1);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialCorpFromHash]);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    phaseRef.current = phase;
    if (onPhaseChange) onPhaseChange(corporateSection ? "corporate" : phase);
  }, [phase, corporateSection, onPhaseChange]);

  const pages = useMemo(() => splitPages(GAME_INTRO_CONFIG.dialogPages), []);
  const fullLength = useMemo(
    () => GAME_INTRO_CONFIG.dialogPages.reduce((s, p) => s + p.length, 0),
    []
  );

  const currentPageIdx = useMemo(() => {
    const idx = pages.findIndex((p) => progress < p.end);
    return idx === -1 ? pages.length - 1 : idx;
  }, [pages, progress]);

  const currentPage = pages[currentPageIdx];
  const dialogSentence = currentPage.text;

  const usePointingPose =
    phase === "choices" ||
    phase === "ask-profile" ||
    phase === "ask-loan" ||
    phase === "result" ||
    phase === "branch-picker" ||
    (phase === "dialog" && progress >= 0.55);

  const isInteractiveStep =
    phase === "ask-profile" ||
    phase === "ask-loan" ||
    phase === "result" ||
    phase === "branch-picker" ||
    phase === "lead-form";

  const selectedBranchInfo = useMemo(() => {
    if (!selectedBranchCity) return null;
    const kw = SITE_CONTENT.kanwilList.find((k) => k.branches.includes(selectedBranchCity));
    const detail = BRANCH_COVERAGE_DETAILS[selectedBranchCity] || {
      label: `Cabang ${selectedBranchCity}`,
      coverage: `${selectedBranchCity} dan wilayah sekitarnya`
    };
    return {
      city: selectedBranchCity,
      label: detail.label,
      coverage: detail.coverage,
      kanwilCode: kw ? kw.code : "WIL",
      kanwilName: kw ? kw.name : "Jaringan Cabang Nasional"
    };
  }, [selectedBranchCity]);

  const filteredBranchItems = useMemo(() => {
    const q = branchSearch.trim().toLowerCase();
    if (q) {
      const matches = [];
      SITE_CONTENT.kanwilList.forEach((kw) => {
        kw.branches.forEach((b) => {
          const detail = BRANCH_COVERAGE_DETAILS[b] || {
            label: `Cabang ${b}`,
            coverage: b,
            keywords: []
          };
          const hay =
            `${b} ${detail.label} ${detail.coverage} ${(detail.keywords || []).join(" ")} ${kw.name}`.toLowerCase();
          if (hay.includes(q)) {
            matches.push({
              city: b,
              label: detail.label,
              coverage: detail.coverage,
              kanwilCode: kw.code,
              kanwilName: kw.name
            });
          }
        });
      });
      return matches;
    }

    const activeKw =
      SITE_CONTENT.kanwilList.find((k) => k.code === activeKanwilCode) ||
      SITE_CONTENT.kanwilList[0];
    return activeKw.branches.map((b) => {
      const detail = BRANCH_COVERAGE_DETAILS[b] || {
        label: `Cabang ${b}`,
        coverage: b
      };
      return {
        city: b,
        label: detail.label,
        coverage: detail.coverage,
        kanwilCode: activeKw.code,
        kanwilName: activeKw.name
      };
    });
  }, [branchSearch, activeKanwilCode]);

  const companionSpeech = useMemo(() => {
    if (submitSuccess) {
      const targetLabel =
        submitSuccess.city === "PUSAT JAKARTA"
          ? "Kantor Pusat Jakarta"
          : `cabang ${submitSuccess.city}`;
      return `Terima kasih Bapak/Ibu ${submitSuccess.visitorName}. Nomor antrean ${targetLabel} Anda adalah ${submitSuccess.queueNo}. Petugas kami akan segera menghubungi.`;
    }
    if (phase === "dialog") return dialogSentence;
    if (phase === "choices") return GAME_INTRO_CONFIG.choicePrompt;
    if (phase === "branch-picker") {
      if (selectedBranchInfo) {
        return `${selectedBranchInfo.label} siap melayani Bapak/Ibu. Silakan jadwalkan konsultasi cabang atau hitung simulasi dana terlebih dahulu.`;
      }
      return "Silakan pilih wilayah atau sentuh kota terdekat Bapak/Ibu, nanti petugas cabang kami yang menyapa langsung.";
    }
    if (phase === "ask-profile") {
      return "Baik. Pertama, silakan pilih perkiraan gaji pensiun dan usia Bapak/Ibu.";
    }
    if (phase === "ask-loan") {
      return "Sekarang, silakan pilih jumlah dana dan lama cicilan yang terasa paling nyaman.";
    }
    if (phase === "result") {
      if (!estimate.isWithinSafeRatio) {
        return `Untuk gaji ${formatRupiahCompact(salary)}, cicilan dana ${formatRupiahCompact(plafond)} (${effectiveTenorYears} tahun) terasa agak berat. Bapak/Ibu bisa tekan Sesuaikan ke Cicilan Aman.`;
      }
      return `Untuk dana ${formatRupiahCompact(plafond)} (${effectiveTenorYears} tahun), sisa uang pensiun di tangan Bapak/Ibu tetap ± ${formatRupiah(estimate.remainingSalary)} per bulan.`;
    }
    if (phase === "lead-form") {
      return "Terima kasih Bapak/Ibu. Silakan isi nama dan nomor WhatsApp aktif. Tidak perlu unggah KTP, petugas cabang kami akan menghubungi dengan sopan.";
    }
    return GAME_INTRO_CONFIG.choicePrompt;
  }, [
    submitSuccess,
    phase,
    dialogSentence,
    selectedBranchInfo,
    estimate.isWithinSafeRatio,
    estimate.remainingSalary,
    formatRupiah,
    formatRupiahCompact,
    salary,
    plafond,
    effectiveTenorYears
  ]);

  const clearPendingTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  const later = useCallback((fn, ms) => {
    const t = window.setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // noop
    }
  }, []);

  const playClip = useCallback((clipSrc, forcePlay = false) => {
    const audio = audioRef.current;
    if (!audio || (!soundOnRef.current && !forcePlay)) return;
    try {
      audio.pause();
      if (audio.getAttribute("src") !== clipSrc) {
        audio.src = clipSrc;
      }
      audio.muted = false;
      audio.currentTime = 0;
      const pr = audio.play();
      if (pr && typeof pr.then === "function") {
        pr.then(() => {
          usingFallbackRef.current = false;
          setNeedsAudioUnlock(false);
        }).catch(() => {
          usingFallbackRef.current = true;
          setNeedsAudioUnlock(true);
        });
      }
    } catch {
      usingFallbackRef.current = true;
      setNeedsAudioUnlock(true);
    }
  }, []);

  const tick = useCallback(() => {
    if (phaseRef.current !== "dialog") return;
    const audio = audioRef.current;
    let p;
    if (
      !usingFallbackRef.current &&
      audio &&
      !audio.paused &&
      audio.duration &&
      Number.isFinite(audio.duration)
    ) {
      p = audio.currentTime / (audio.duration * 0.94);
    } else {
      const elapsed = Math.max(0, (performance.now() - fallbackStartRef.current) / 1000);
      p = elapsed / (fullLength / GAME_INTRO_CONFIG.fallbackCharsPerSecond);
    }
    p = Math.max(0, Math.min(1, p));
    setProgress(p);
    if (p >= 1) {
      later(() => {
        if (phaseRef.current === "dialog") setPhase("choices");
      }, 320);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [fullLength, later]);

  const triggerWelcomeGateOpen = useCallback(
    (_fromUserTap = false) => {
      if (gateOpenedRef.current) return;
      gateOpenedRef.current = true;
      setGateStage("opening");

      fallbackStartRef.current = performance.now() + 260;
      rafRef.current = requestAnimationFrame(tick);

      if (soundOnRef.current) {
        const audioTimer = window.setTimeout(() => {
          playClip(GAME_INTRO_CONFIG.voiceClips.welcome);
        }, 260);
        timersRef.current.push(audioTimer);
      }

      const doneTimer = window.setTimeout(() => {
        setGateStage("done");
      }, 980);
      timersRef.current.push(doneTimer);
    },
    [playClip, tick]
  );

  useEffect(() => {
    const preloadSources = [
      SITE_CONTENT.brand.logoVertical,
      GAME_INTRO_CONFIG.poseGreeting,
      GAME_INTRO_CONFIG.posePointing,
      SITE_CONTENT.brand.logoHorizontal,
      SITE_CONTENT.brand.logoSilhouette
    ];
    let greetingImg = null;
    preloadSources.forEach((src) => {
      const img = new Image();
      img.src = src;
      if (src === GAME_INTRO_CONFIG.poseGreeting) {
        greetingImg = img;
      }
    });

    if (initialCorpFromHash) {
      return () => {
        cancelAnimationFrame(rafRef.current);
        clearPendingTimers();
        stopAudio();
      };
    }

    if (prefersReducedMotion) {
      fallbackStartRef.current = performance.now() + 200;
      rafRef.current = requestAnimationFrame(tick);
      const startAudioTimer = window.setTimeout(() => {
        playClip(GAME_INTRO_CONFIG.voiceClips.welcome);
      }, 200);
      timersRef.current.push(startAudioTimer);
      return () => {
        cancelAnimationFrame(rafRef.current);
        clearPendingTimers();
        stopAudio();
      };
    }

    // Tahan sebentar (~380ms) agar logo resmi terbaca utuh sambil memastikan maskot siap, lalu buka gerbang halus
    let minDelayPassed = false;
    let mascotReady = Boolean(greetingImg && greetingImg.complete);

    const tryOpen = () => {
      if (minDelayPassed && mascotReady) {
        triggerWelcomeGateOpen(false);
      }
    };

    if (greetingImg && !mascotReady) {
      greetingImg.onload = () => {
        mascotReady = true;
        tryOpen();
      };
      greetingImg.onerror = () => {
        mascotReady = true;
        tryOpen();
      };
    }

    const minHoldTimer = window.setTimeout(() => {
      minDelayPassed = true;
      tryOpen();
    }, 380);
    const maxHoldTimer = window.setTimeout(() => {
      triggerWelcomeGateOpen(false);
    }, 620);
    timersRef.current.push(minHoldTimer, maxHoldTimer);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearPendingTimers();
      stopAudio();
    };
  }, [
    initialCorpFromHash,
    prefersReducedMotion,
    playClip,
    tick,
    clearPendingTimers,
    stopAudio,
    triggerWelcomeGateOpen
  ]);

  useEffect(() => {
    if (submitSuccess && soundOnRef.current && !corporateSection) {
      playClip(GAME_INTRO_CONFIG.voiceClips.salam);
    }
  }, [submitSuccess, corporateSection, playClip]);

  const currentStepAudioClip = useCallback(() => {
    if (phaseRef.current === "ask-profile") return GAME_INTRO_CONFIG.voiceClips.profile;
    if (phaseRef.current === "ask-loan" || phaseRef.current === "result") {
      return GAME_INTRO_CONFIG.voiceClips.loan;
    }
    if (phaseRef.current === "branch-picker") return GAME_INTRO_CONFIG.voiceClips.branch;
    if (phaseRef.current === "lead-form") return GAME_INTRO_CONFIG.voiceClips.salam;
    return GAME_INTRO_CONFIG.voiceClips.welcome;
  }, []);

  const handleStageTap = () => {
    if (needsAudioUnlock && soundOnRef.current) {
      playClip(currentStepAudioClip(), true);
    }
    if (phase === "dialog") {
      cancelAnimationFrame(rafRef.current);
      clearPendingTimers();
      setProgress(1);
      setPhase("choices");
      pushHistoryView("choices", null, null, null);
    }
  };

  const handleUnlockGreetingAudio = (e) => {
    e.stopPropagation();
    setSoundOn(true);
    soundOnRef.current = true;
    setNeedsAudioUnlock(false);
    playClip(GAME_INTRO_CONFIG.voiceClips.welcome, true);
  };

  const handleResetToChoices = (e) => {
    if (e) e.stopPropagation();
    cancelAnimationFrame(rafRef.current);
    clearPendingTimers();
    stopAudio();
    setProfileWarning("");
    setSubmitSuccess(null);
    setSubmitError("");
    setSelectedBranchCity(null);
    setCorporateSection(null);
    setCorporateArticleId(null);
    setProgress(1);
    setPhase("choices");
    pushHistoryView("choices", null, null, null);
  };

  const openCorporatePage = (sectionId, e, articleId = null) => {
    if (e) e.stopPropagation();
    cancelAnimationFrame(rafRef.current);
    clearPendingTimers();
    stopAudio();
    const targetPhase = phase === "dialog" ? "choices" : phase;
    if (phase === "dialog") {
      setProgress(1);
      setPhase("choices");
    }
    setCorporateArticleId(articleId);
    setCorporateSection(sectionId);
    pushHistoryView(targetPhase, sectionId, selectedBranchCity, articleId);
  };

  const handleCloseCorporate = () => {
    setCorporateSection(null);
    setCorporateArticleId(null);
    pushHistoryView(phase, null, selectedBranchCity, null);
  };

  const handleReplaySpeech = (e) => {
    if (e) e.stopPropagation();
    cancelAnimationFrame(rafRef.current);
    clearPendingTimers();
    setProfileWarning("");
    setSubmitSuccess(null);
    setSubmitError("");
    setSoundOn(true);
    soundOnRef.current = true;
    setNeedsAudioUnlock(false);
    setProgress(0);
    setPhase("dialog");
    phaseRef.current = "dialog";
    fallbackStartRef.current = performance.now();
    playClip(GAME_INTRO_CONFIG.voiceClips.welcome, true);
    rafRef.current = requestAnimationFrame(tick);
  };

  const toggleSound = (e) => {
    e.stopPropagation();
    if (needsAudioUnlock) {
      setSoundOn(true);
      soundOnRef.current = true;
      playClip(currentStepAudioClip(), true);
      return;
    }
    setSoundOn((prev) => {
      const next = !prev;
      soundOnRef.current = next;
      if (!next) {
        stopAudio();
      } else {
        playClip(currentStepAudioClip(), true);
      }
      return next;
    });
  };

  const handleSelectMenu = (item) => {
    cancelAnimationFrame(rafRef.current);
    clearPendingTimers();
    setProfileWarning("");
    setSubmitSuccess(null);
    setSubmitError("");

    if (item.id === "cek-cabang") {
      setSelectedBranchCity(null);
      setBranchSearch("");
      setPhase("branch-picker");
      pushHistoryView("branch-picker", null, null, null);
      playClip(GAME_INTRO_CONFIG.voiceClips.branch);
      return;
    }

    onApplyIntentPreset(item);
    setPhase("ask-profile");
    pushHistoryView("ask-profile", null, null, null);
    playClip(GAME_INTRO_CONFIG.voiceClips.profile);
  };

  const handleAdvanceToLoan = () => {
    onAgeBlur();
    if (!salary || salary < 100_000) {
      setProfileWarning(
        "Mohon pilih tombol gaji atau ketik perkiraan uang pensiun bulanan Bapak/Ibu terlebih dahulu."
      );
      return;
    }
    if (pensionStatus === "Prapensiun" && !prapenAnalysis?.valid) {
      setProfileWarning(
        "Mohon isi perkiraan Tanggal Pensiun (TMT) Bapak/Ibu terlebih dahulu agar skema Prapensiun dapat dihitung."
      );
      return;
    }
    setProfileWarning("");
    setPhase("ask-loan");
    pushHistoryView("ask-loan", null, null, null);
    playClip(GAME_INTRO_CONFIG.voiceClips.loan);
  };

  const handleOpenLeadStep = (prefillCity = null, modeOverride = null) => {
    if (prefillCity) setCity(prefillCity);
    if (modeOverride) setInquiryMode(modeOverride);
    setSubmitSuccess(null);
    setSubmitError("");
    setPhase("lead-form");
    pushHistoryView("lead-form", null, prefillCity || selectedBranchCity, null);
    playClip(GAME_INTRO_CONFIG.voiceClips.salam);
  };

  if (corporateSection) {
    return (
      <React.Suspense
        fallback={
          <div className="flex min-h-[100dvh] items-center justify-center bg-[#F6F5F2] p-6 text-base font-semibold text-[#17223B]">
            Memuat halaman informasi resmi…
          </div>
        }
      >
        <CorporateView
          initialSection={corporateSection}
          initialArticleId={corporateArticleId}
          onBackToCompanion={handleCloseCorporate}
          onSelectCityForConsult={(selectedCity) => {
            setCorporateSection(null);
            setCorporateArticleId(null);
            handleOpenLeadStep(selectedCity, "konsultasi-cabang");
          }}
          onStartSimulation={() => {
            setCorporateSection(null);
            setCorporateArticleId(null);
            if (phase === "ask-profile" || phase === "ask-loan" || phase === "result") {
              pushHistoryView(phase, null, selectedBranchCity, null);
            } else {
              handleSelectMenu(MASCOT_INTENT_MENUS[0]);
            }
          }}
        />
      </React.Suspense>
    );
  }

  return (
    <div
      data-testid="game-intro"
      data-phase={phase}
      role="main"
      aria-label="Pendamping Interaktif Layanan Pensiunan"
      onClick={phase === "dialog" ? handleStageTap : undefined}
      className={`relative flex w-full flex-col justify-between overflow-x-hidden bg-[#F6F5F2] text-[#17223B] ${
        isInteractiveStep ? "min-h-[100dvh]" : "h-[100dvh] min-h-[640px]"
      }`}
    >
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => {
          if (phaseRef.current === "dialog") {
            setPhase("choices");
          }
        }}
      />

      {/* ====================================================================
          GERBANG PEMBUKA LOGO RESMI (TERBELAH HALUS KIRI-KANAN SAAT LINK DIBUKA)
          ==================================================================== */}
      {gateStage !== "done" && (
        <div
          data-testid="welcome-logo-gate"
          data-gate-stage={gateStage}
          onClick={() => triggerWelcomeGateOpen(true)}
          aria-hidden={gateStage === "opening"}
          className={`fixed inset-0 z-50 overflow-hidden ${
            gateStage === "opening" ? "pointer-events-none" : "cursor-pointer"
          }`}
        >
          {/* Daun Gerbang Kiri — Membawa tepat 50% kiri logo resmi */}
          <div
            className={`lp-welcome-gate-panel absolute inset-y-0 left-0 w-1/2 overflow-hidden bg-[#F6F5F2] ${
              gateStage === "opening"
                ? "lp-welcome-gate-left-open border-r border-[#351080]/12 shadow-[12px_0_36px_rgba(23,34,59,0.08)]"
                : "border-r border-transparent"
            }`}
          >
            <div className="pointer-events-none absolute right-0 top-1/2 flex -translate-y-1/2 translate-x-1/2 flex-col items-center">
              <img
                src={SITE_CONTENT.brand.logoVertical}
                alt="Layanan Pensiunan"
                className="w-[clamp(196px,28vw,224px)] max-w-none select-none object-contain"
              />
            </div>
          </div>

          {/* Daun Gerbang Kanan — Membawa tepat 50% kanan logo resmi */}
          <div
            className={`lp-welcome-gate-panel absolute inset-y-0 right-0 w-1/2 overflow-hidden bg-[#F6F5F2] ${
              gateStage === "opening"
                ? "lp-welcome-gate-right-open border-l border-[#351080]/12 shadow-[-12px_0_36px_rgba(23,34,59,0.08)]"
                : "border-l border-transparent"
            }`}
          >
            <div className="pointer-events-none absolute left-0 top-1/2 flex -translate-y-1/2 -translate-x-1/2 flex-col items-center">
              <img
                src={SITE_CONTENT.brand.logoVertical}
                alt=""
                aria-hidden="true"
                className="w-[clamp(196px,28vw,224px)] max-w-none select-none object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          HEADER INSTITUSIONAL BERSIH (TANPA IKON DEKORATIF AI)
          ==================================================================== */}
      <header
        className={`relative z-40 w-full shrink-0 border-b border-[#17223B]/10 bg-white/90 backdrop-blur-sm transition-opacity duration-700 ${
          gateStage === "closed" ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="mx-auto flex min-h-[60px] w-full max-w-[1200px] items-center justify-between gap-1.5 px-2.5 sm:min-h-[66px] sm:gap-4 sm:px-8">
          <button
            type="button"
            onClick={handleResetToChoices}
            className="inline-flex min-h-[44px] shrink-0 items-center py-1 focus:outline-none"
            title="Kembali ke Menu Pilihan Awal"
          >
            <img
              src={SITE_CONTENT.brand.logoHorizontal}
              alt="Layanan Pensiunan"
              className="h-7 w-auto object-contain sm:h-8"
            />
          </button>

          <div className="flex items-center gap-1 sm:gap-4">
            <nav
              aria-label="Informasi Perusahaan"
              className="flex items-center gap-0.5 text-[12.5px] font-bold text-[#17223B] sm:gap-2 sm:text-[14px]"
            >
              <button
                type="button"
                onClick={(e) => openCorporatePage("profil", e)}
                data-testid="open-company-profile-btn"
                className="inline-flex min-h-[42px] items-center rounded-lg px-1.5 transition-colors hover:bg-[#351080]/8 hover:text-[#351080] sm:min-h-[44px] sm:px-2.5"
              >
                <span className="hidden sm:inline">Profil Perusahaan</span>
                <span className="sm:hidden">Profil</span>
              </button>

              <span className="hidden h-3.5 w-[1px] bg-[#17223B]/20 sm:inline-block" aria-hidden="true" />

              <button
                type="button"
                onClick={(e) => openCorporatePage("edukasi", e)}
                data-testid="open-education-btn"
                className="inline-flex min-h-[42px] items-center rounded-lg px-1.5 transition-colors hover:bg-[#351080]/8 hover:text-[#351080] sm:min-h-[44px] sm:px-2.5"
              >
                Edukasi
              </button>

              <span className="hidden h-3.5 w-[1px] bg-[#17223B]/20 sm:inline-block" aria-hidden="true" />

              <button
                type="button"
                onClick={(e) => openCorporatePage("karir", e)}
                data-testid="open-careers-btn"
                className="inline-flex min-h-[42px] items-center rounded-lg px-1.5 transition-colors hover:bg-[#351080]/8 hover:text-[#351080] sm:min-h-[44px] sm:px-2.5"
              >
                Karir
              </button>

              <span className="hidden h-3.5 w-[1px] bg-[#17223B]/20 sm:inline-block" aria-hidden="true" />

              <button
                type="button"
                onClick={(e) => openCorporatePage("mitra", e)}
                data-testid="open-investor-btn"
                className="inline-flex min-h-[42px] items-center rounded-lg px-1.5 transition-colors hover:bg-[#351080]/8 hover:text-[#351080] sm:min-h-[44px] sm:px-2.5"
              >
                Mitra
              </button>
            </nav>

            <button
              type="button"
              onClick={toggleSound}
              data-testid="mascot-voice-toggle"
              aria-pressed={soundOn && !needsAudioUnlock}
              title={soundOn ? "Matikan Suara Panduan" : "Nyalakan Suara Panduan"}
              className={`inline-flex min-h-[42px] min-w-[42px] items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-bold transition-colors sm:min-h-[44px] sm:px-3 ${
                needsAudioUnlock
                  ? "bg-[#078D67] text-white"
                  : soundOn
                    ? "bg-[#351080]/12 text-[#351080] hover:bg-[#351080]/18"
                    : "bg-[#F6F5F2] text-[#334155] lp-ring"
              }`}
            >
              {soundOn && !needsAudioUnlock ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span className="hidden md:inline">
                {needsAudioUnlock ? "Dengar Suara" : soundOn ? "Suara Aktif" : "Suara"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          MODE A: PEMBUKAAN & 4 PILIHAN AWAL (SILUET LOGO RESMI DI BELAKANG MASKOT)
          ==================================================================== */}
      {!isInteractiveStep ? (
        <div className="relative z-10 mx-auto flex w-full max-w-[1160px] flex-1 min-h-0 flex-col items-center justify-end px-3 pb-3 sm:px-6 sm:pb-5">
          {/* Maskot + Siluet Logo Resmi Layanan Pensiunan di Belakangnya */}
          <div
            data-testid="welcome-lobby-stage"
            className="pointer-events-none relative z-10 -mb-9 flex w-full flex-1 min-h-[240px] items-end justify-center pt-1 transition-all duration-500 ease-out sm:-mb-9"
          >
            {/* Siluet Logo Aplikasi Resmi — Halus & Nyaman di Mata */}
            <img
              src={SITE_CONTENT.brand.logoSilhouette}
              alt=""
              aria-hidden="true"
              data-testid="logo-backdrop-silhouette"
              className={`pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none object-contain transition-all duration-700 ${
                gateStage === "closed" ? "scale-95 opacity-0" : "scale-100 opacity-[0.075]"
              } ${
                phase === "dialog"
                  ? "w-[330px] sm:w-[440px] lg:w-[480px]"
                  : "w-[260px] sm:w-[370px] lg:w-[410px]"
              }`}
            />

            <div
              className={`lp-welcome-mascot-reveal relative z-10 h-full ${
                gateStage === "closed"
                  ? "translate-y-5 scale-[0.94] opacity-0"
                  : "translate-y-0 scale-100 opacity-100"
              } ${
                phase === "dialog"
                  ? "max-h-[670px] sm:max-h-[610px]"
                  : "max-h-[470px] sm:max-h-[510px]"
              }`}
            >
              <img
                src={GAME_INTRO_CONFIG.poseGreeting}
                alt="Konsultan Layanan Pensiunan menyambut Bapak dan Ibu"
                data-testid={usePointingPose ? undefined : "mascot-pose-img"}
                className={`lp-intro-mascot h-full w-auto max-w-none object-contain object-bottom transition-opacity duration-500 ${
                  usePointingPose ? "opacity-0" : "opacity-100"
                }`}
              />
              <img
                src={GAME_INTRO_CONFIG.posePointing}
                alt="Konsultan Layanan Pensiunan memandu pilihan Bapak dan Ibu"
                data-testid={usePointingPose ? "mascot-pose-img" : undefined}
                className={`lp-intro-mascot absolute inset-0 h-full w-auto max-w-none object-contain object-bottom transition-opacity duration-500 ${
                  usePointingPose ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          </div>

          {/* Kartu Dialog & 4 Pilihan — Muncul lembut setelah gerbang logo terbuka */}
          <div
            data-testid="intro-dialog"
            onClick={(e) => e.stopPropagation()}
            className={`relative z-20 w-full max-w-[760px] shrink-0 rounded-[20px] bg-white p-4 shadow-[0_18px_44px_-18px_rgba(23,34,59,0.18)] lp-ring-strong transition-all duration-700 sm:p-5 ${
              gateStage === "closed"
                ? "translate-y-5 opacity-0"
                : "translate-y-0 opacity-100"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                data-testid="voice-status-pill"
                className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-[#351080]"
              >
                {GAME_INTRO_CONFIG.speakerName}
              </div>

              <div className="flex items-center gap-2">
                {(!soundOn || needsAudioUnlock) && phase === "dialog" && (
                  <button
                    type="button"
                    data-testid="mobile-unlock-audio-btn"
                    onClick={handleUnlockGreetingAudio}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#078D67] px-3 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-[#056C4F]"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>Dengar Sapaan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReplaySpeech}
                  data-testid="replay-voice-btn"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-[#334155] hover:bg-[#351080]/8 hover:text-[#351080]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Ulangi Sapaan</span>
                </button>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <p
                key={phase === "dialog" ? `dlg-${currentPageIdx}` : "choices-prompt"}
                data-testid="mascot-speech-text"
                aria-live="polite"
                className="lp-fade-in font-display text-[16px] font-semibold leading-[1.48] text-[#17223B] sm:text-[18px]"
              >
                {companionSpeech}
              </p>

              {phase === "dialog" && (
                <button
                  type="button"
                  data-testid="open-gate-btn"
                  onClick={handleStageTap}
                  className="inline-flex min-h-[42px] shrink-0 items-center rounded-lg bg-[#351080] px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-[#5720B8]"
                >
                  Lanjut →
                </button>
              )}
            </div>

            {phase === "choices" && (
              <div className="mt-3">
                <div
                  data-testid="intent-menu-grid"
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {MASCOT_INTENT_MENUS.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`intent-card-${item.id}`}
                      onClick={() => handleSelectMenu(item)}
                      style={{ animationDelay: `${0.03 + idx * 0.05}s` }}
                      className="lp-intro-choice group flex min-h-[52px] items-center gap-3 rounded-xl bg-[#F6F5F2] px-3.5 py-2.5 text-left transition-all hover:bg-white lp-ring hover:ring-2 hover:ring-[#351080]"
                    >
                      <span className="w-5 shrink-0 font-display text-[14px] font-bold text-[#351080]">
                        {idx + 1}.
                      </span>
                      <span className="flex-1 text-[13.5px] font-bold leading-snug text-[#17223B] sm:text-[14px]">
                        {item.introLabel || item.title}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#351080] transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#17223B]/10 pt-2.5 text-[12px]">
                  <span className="text-[#475569]">
                    <button
                      type="button"
                      onClick={(e) => openCorporatePage("profil", e)}
                      className="font-bold text-[#351080] hover:underline"
                    >
                      Profil Perusahaan
                    </button>
                    {" • "}
                    <button
                      type="button"
                      onClick={(e) => openCorporatePage("edukasi", e)}
                      className="font-bold text-[#351080] hover:underline"
                    >
                      Edukasi
                    </button>
                    {" • "}
                    <button
                      type="button"
                      onClick={(e) => openCorporatePage("karir", e)}
                      className="font-bold text-[#351080] hover:underline"
                    >
                      Karir
                    </button>
                    {" • "}
                    <button
                      type="button"
                      onClick={(e) => openCorporatePage("mitra", e)}
                      className="font-bold text-[#351080] hover:underline"
                    >
                      Mitra
                    </button>
                  </span>

                  <button
                    type="button"
                    data-testid="switch-full-calculator"
                    onClick={() => handleSelectMenu(MASCOT_INTENT_MENUS[0])}
                    className="font-bold text-[#078D67] hover:underline"
                  >
                    Mulai Hitung Sekarang →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================================================================
           MODE B: PENDAMPINGAN INTERAKTIF (MASKOT + SILUET LOGO RESMI DI BELAKANGNYA)
           ================================================================== */
        <div className="relative z-10 mx-auto flex w-full max-w-[1160px] flex-1 items-start px-3 pt-1 sm:px-8 lg:items-end">
          <div className="grid w-full grid-cols-1 items-end gap-0 lg:grid-cols-12 lg:gap-8">
            <div
              data-testid="welcome-lobby-stage"
              className="pointer-events-none relative z-10 -mb-8 flex flex-col items-center justify-end lg:col-span-5 lg:mb-0"
            >
              {/* Siluet Logo Aplikasi Resmi di Belakang Maskot */}
              <img
                src={SITE_CONTENT.brand.logoSilhouette}
                alt=""
                aria-hidden="true"
                data-testid="logo-backdrop-silhouette"
                className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[210px] -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.07] sm:w-[250px] lg:w-[420px]"
              />

              <div className="relative z-10 h-[260px] sm:h-[290px] lg:h-[78dvh] lg:max-h-[680px]">
                <img
                  src={GAME_INTRO_CONFIG.poseGreeting}
                  alt="Konsultan Layanan Pensiunan menyambut Bapak dan Ibu"
                  data-testid={usePointingPose ? undefined : "mascot-pose-img"}
                  className={`h-full w-auto max-w-none object-contain object-bottom drop-shadow-[0_18px_32px_rgba(23,34,59,0.12)] transition-opacity duration-500 ${
                    usePointingPose ? "opacity-0" : "opacity-100"
                  }`}
                />
                <img
                  src={GAME_INTRO_CONFIG.posePointing}
                  alt="Konsultan Layanan Pensiunan memandu langkah Bapak dan Ibu"
                  data-testid={usePointingPose ? "mascot-pose-img" : undefined}
                  className={`absolute inset-0 h-full w-auto max-w-none object-contain object-bottom drop-shadow-[0_18px_32px_rgba(23,34,59,0.12)] transition-opacity duration-500 ${
                    usePointingPose ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>
            </div>

            {/* KOLOM KANAN (7 COLS): PANEL LANGKAH BERSIH */}
            <div className="relative z-20 pb-4 sm:pb-6 lg:col-span-7 lg:self-center lg:pb-10">
              <div
                data-testid="intro-dialog"
                className="lp-intro-dialog-up rounded-[20px] bg-white p-5 shadow-[0_18px_44px_-18px_rgba(23,34,59,0.16)] lp-ring-strong sm:p-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#17223B]/10 pb-3.5">
                  <div
                    data-testid="voice-status-pill"
                    className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#351080]"
                  >
                    {submitSuccess
                      ? "Nomor Antrean Cabang"
                      : phase === "ask-profile"
                        ? "Langkah 1 dari 3 • Gaji & Usia"
                        : phase === "ask-loan"
                          ? "Langkah 2 dari 3 • Jumlah Dana"
                          : phase === "result"
                            ? "Langkah 3 dari 3 • Hasil Hitungan"
                            : phase === "branch-picker"
                              ? "Pilih Kota Cabang Terdekat"
                              : "Kirim ke Petugas Cabang"}
                  </div>

                  <button
                    type="button"
                    onClick={handleResetToChoices}
                    data-testid="touch-mascot-start"
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#17223B]/65 hover:text-[#351080]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Menu Awal</span>
                  </button>
                </div>

                <p
                  data-testid="mascot-speech-text"
                  className="mt-3.5 font-display text-[16px] font-semibold leading-[1.45] text-[#17223B] sm:text-[17.5px]"
                >
                  {companionSpeech}
                </p>

                {/* KONTEN LANGKAH 1: GAJI & USIA */}
                {phase === "ask-profile" && (
                  <div data-testid="guided-wizard-panel" className="mt-4 space-y-4">
                    {profileWarning && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[13px] font-semibold text-amber-900"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{profileWarning}</span>
                      </div>
                    )}

                    <div>
                      <div className="text-[13px] font-bold text-[#17223B]/75">
                        1. Status Bapak/Ibu Saat Ini
                      </div>
                      <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {pensionStatusOptions.map((opt) => {
                          const active = pensionStatus === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              data-testid={`calc-status-${opt.value}`}
                              onClick={() => onStatusSelect(opt)}
                              className={`h-11 rounded-xl px-3 text-[13.5px] font-bold transition-colors ${
                                active
                                  ? "bg-[#351080] text-white"
                                  : "bg-[#F6F5F2] text-[#17223B] hover:bg-[#EDE9F8] lp-ring"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                      <div className="sm:col-span-7">
                        <label
                          htmlFor="calc-salary"
                          className="block text-[13px] font-bold text-[#17223B]/75"
                        >
                          2. Uang Pensiun / Gaji per Bulan
                        </label>
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          {salaryPresets.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => {
                                setProfileWarning("");
                                onSalaryPreset(p.value);
                              }}
                              className={`h-9 rounded-lg text-[12.5px] font-bold transition-colors ${
                                salary === p.value
                                  ? "bg-[#351080] text-white"
                                  : "bg-[#F6F5F2] text-[#17223B] lp-ring hover:bg-[#EDE9F8]"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 flex h-11 items-center overflow-hidden rounded-xl bg-[#F6F5F2] lp-ring focus-within:bg-white focus-within:ring-2 focus-within:ring-[#351080]">
                          <span className="pl-3.5 pr-2 text-[14px] font-bold text-[#475569]">
                            Rp
                          </span>
                          <input
                            id="calc-salary"
                            data-testid="calc-input-salary"
                            type="text"
                            inputMode="numeric"
                            value={salaryInputText}
                            onChange={(e) => {
                              setProfileWarning("");
                              onSalaryTextChange(e.target.value);
                            }}
                            placeholder="4.500.000"
                            className="h-full w-full bg-transparent pr-3 text-[17px] font-extrabold text-[#17223B] tabular-nums focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-5">
                        <label
                          htmlFor="calc-age"
                          className="block text-[13px] font-bold text-[#17223B]/75"
                        >
                          3. Usia Bapak/Ibu ({PUBLIC_CALCULATOR_CONFIG.minAge}–
                          {PUBLIC_CALCULATOR_CONFIG.maxAge} Thn)
                        </label>
                        <div className="mt-1.5 flex h-12 items-center overflow-hidden rounded-xl bg-[#F6F5F2] lp-ring">
                          <button
                            type="button"
                            aria-label="Kurangi usia"
                            onClick={() => onAgeStep(age - 1)}
                            className="flex h-full w-12 items-center justify-center text-[#17223B] hover:bg-[#EDE9F8]"
                          >
                            <Minus className="h-5 w-5" />
                          </button>
                          <input
                            id="calc-age"
                            data-testid="calc-input-age"
                            type="text"
                            inputMode="numeric"
                            value={ageInputText}
                            onChange={(e) => onAgeInputChange(e.target.value)}
                            onBlur={onAgeBlur}
                            className="h-full w-full bg-white text-center text-[19px] font-extrabold text-[#17223B] tabular-nums focus:outline-none"
                          />
                          <button
                            type="button"
                            aria-label="Tambah usia"
                            onClick={() => onAgeStep(age + 1)}
                            className="flex h-full w-12 items-center justify-center text-[#17223B] hover:bg-[#EDE9F8]"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="mt-1.5 text-[12px] text-[#475569]">
                          Maks. lama cicilan: <strong>{maxAllowedTenorYears} tahun</strong>
                        </div>
                        {estimate.isSeniorSpecialScheme && (
                          <div className="mt-1 text-[11.5px] font-medium text-[#351080]">
                            Usia di atas {PUBLIC_CALCULATOR_CONFIG.seniorAdvisoryAge} thn: cabang
                            siap mencarikan skema khusus senior.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* INPUT KHUSUS PRAPENSIUN: TANGGAL PENSIUN (TMT PENSIUN) */}
                    {pensionStatus === "Prapensiun" && (
                      <div
                        data-testid="prapen-tmt-box"
                        className="space-y-2.5 rounded-xl bg-[#F6F5F2] p-3.5 lp-ring"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label
                            htmlFor="calc-retirement-date"
                            className="text-[13px] font-bold text-[#17223B]"
                          >
                            4. Perkiraan Tanggal Pensiun (TMT Pensiun)
                          </label>
                          {prapenAnalysis?.valid && prapenAnalysis.monthsToRetirement > 0 && (
                            <span
                              data-testid="prapen-remaining-badge"
                              className="rounded-md bg-[#078D67]/12 px-2 py-0.5 text-[11.5px] font-bold text-[#078D67]"
                            >
                              Sisa Dinas: {prapenAnalysis.remainingLabel}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                          <div className="sm:col-span-5">
                            <input
                              id="calc-retirement-date"
                              data-testid="calc-input-retirement-date"
                              type="date"
                              value={retirementDate}
                              onChange={(e) => {
                                setProfileWarning("");
                                onRetirementDateChange(e.target.value);
                              }}
                              className="h-10 w-full rounded-lg bg-white px-3 text-[14px] font-bold text-[#17223B] lp-ring focus:outline-none focus:ring-2 focus:ring-[#351080]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 sm:col-span-7 sm:grid-cols-4">
                            {[1, 2, 3, 5].map((yr) => (
                              <button
                                key={yr}
                                type="button"
                                data-testid={`prapen-quick-${yr}y`}
                                onClick={() => {
                                  setProfileWarning("");
                                  onRetirementQuickYears(yr);
                                }}
                                className="h-10 rounded-lg bg-white px-2 text-[12px] font-bold text-[#17223B] lp-ring transition-colors hover:bg-[#351080] hover:text-white"
                              >
                                {yr} Thn Lagi
                              </button>
                            ))}
                          </div>
                        </div>

                        {prapenAnalysis && (
                          <div
                            data-testid="prapen-analysis-note"
                            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-[12px] leading-[1.5] ${
                              prapenAnalysis.status === "already_retired" ||
                              prapenAnalysis.status === "over_limit"
                                ? "border border-amber-300 bg-amber-50 text-amber-950"
                                : "bg-white text-[#17223B]/80 lp-ring"
                            }`}
                          >
                            <span>
                              <strong className="text-[#351080]">{prapenAnalysis.badge}:</strong>{" "}
                              {prapenAnalysis.detail}
                            </span>
                            {prapenAnalysis.status === "already_retired" && (
                              <button
                                type="button"
                                onClick={() => onStatusSelect(pensionStatusOptions[0])}
                                className="rounded-md bg-[#351080] px-2.5 py-1 text-[11.5px] font-bold text-white"
                              >
                                Pindah ke Sudah Pensiun
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={handleResetToChoices}
                        className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-[#F6F5F2] px-4 py-2.5 text-[14px] font-bold text-[#17223B] lp-ring"
                      >
                        <ArrowLeft className="h-4 w-4 shrink-0" />
                        <span>Ganti Keperluan</span>
                      </button>

                      <button
                        type="button"
                        data-testid="guided-next-step-1"
                        onClick={handleAdvanceToLoan}
                        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#351080] px-5 py-2.5 text-[15px] font-bold text-white hover:bg-[#5720B8]"
                      >
                        <span>Lanjut Pilih Jumlah Dana</span>
                        <ArrowRight className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                )}

                {/* KONTEN LANGKAH 2: DANA & LAMA CICILAN */}
                {phase === "ask-loan" && (
                  <div data-testid="guided-wizard-panel" className="mt-4 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[13.5px] font-bold text-[#17223B]/80">
                          1. Berapa Dana yang Bapak/Ibu Butuhkan?
                        </span>
                        <span
                          data-testid="calc-plafond-display"
                          className="font-display text-[22px] font-extrabold text-[#351080] tabular-nums"
                        >
                          {formatRupiah(plafond)}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {plafondQuickChips.map((chip) => (
                          <button
                            key={chip.value}
                            type="button"
                            onClick={() => onPlafondChange(chip.value)}
                            className={`h-10 rounded-xl text-[13px] font-bold transition-colors ${
                              plafond === chip.value
                                ? "bg-[#351080] text-white"
                                : "bg-[#F6F5F2] text-[#17223B] lp-ring hover:bg-[#EDE9F8]"
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-2.5 flex items-center gap-2.5">
                        <button
                          type="button"
                          aria-label="Kurangi dana"
                          onClick={() =>
                            onPlafondChange(plafond - PUBLIC_CALCULATOR_CONFIG.plafondStep)
                          }
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6F5F2] text-[#17223B] lp-ring"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          id="calc-plafond"
                          data-testid="calc-slider-plafond"
                          type="range"
                          min={PUBLIC_CALCULATOR_CONFIG.minPlafond}
                          max={PUBLIC_CALCULATOR_CONFIG.maxPlafond}
                          step={PUBLIC_CALCULATOR_CONFIG.plafondStep}
                          value={plafond}
                          onChange={(e) => onPlafondChange(Number(e.target.value))}
                          className="lp-slider"
                        />
                        <button
                          type="button"
                          aria-label="Tambah dana"
                          onClick={() =>
                            onPlafondChange(plafond + PUBLIC_CALCULATOR_CONFIG.plafondStep)
                          }
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6F5F2] text-[#17223B] lp-ring"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-[#17223B]/10 pt-3.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[13.5px] font-bold text-[#17223B]/80">
                          2. Ingin Dicicil Berapa Lama?
                        </span>
                        <span
                          data-testid="calc-tenor-display"
                          className="font-display text-[19px] font-extrabold text-[#17223B] tabular-nums"
                        >
                          {effectiveTenorYears} Tahun ({effectiveTenorMonths} bln)
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                        {tenorQuickChips.map((yr) => {
                          const disabled = yr > maxAllowedTenorYears;
                          return (
                            <button
                              key={yr}
                              type="button"
                              disabled={disabled}
                              onClick={() => onTenorChange(yr)}
                              className={`h-10 rounded-xl text-[13px] font-bold transition-colors ${
                                disabled
                                  ? "cursor-not-allowed bg-slate-100 text-slate-500"
                                  : effectiveTenorYears === yr
                                    ? "bg-[#351080] text-white"
                                    : "bg-[#F6F5F2] text-[#17223B] lp-ring hover:bg-[#EDE9F8]"
                              }`}
                            >
                              {yr} Thn
                            </button>
                          );
                        })}
                      </div>

                      <input
                        id="calc-tenor"
                        data-testid="calc-slider-tenor"
                        type="range"
                        min={1}
                        max={maxAllowedTenorYears}
                        step={1}
                        value={effectiveTenorYears}
                        onChange={(e) => onTenorChange(Number(e.target.value))}
                        className="lp-slider mt-2.5"
                      />
                    </div>

                    {/* INPUT OPSIONAL KHUSUS TAKE OVER: CICILAN LAMA PER BULAN */}
                    {selectedGoalId === "takeover" && (
                      <div className="border-t border-[#17223B]/10 pt-3.5">
                        <label
                          htmlFor="calc-old-installment"
                          className="block text-[13px] font-bold text-[#17223B]/80"
                        >
                          3. Perkiraan Cicilan Pinjaman Lama / Bulan (Opsional)
                        </label>
                        <div className="mt-1.5 flex h-11 items-center overflow-hidden rounded-xl bg-[#F6F5F2] lp-ring focus-within:bg-white focus-within:ring-2 focus-within:ring-[#351080]">
                          <span className="pl-3.5 pr-2 text-[14px] font-bold text-[#475569]">
                            Rp
                          </span>
                          <input
                            id="calc-old-installment"
                            data-testid="calc-input-old-installment"
                            type="text"
                            inputMode="numeric"
                            value={oldInstallmentText}
                            onChange={(e) => onOldInstallmentTextChange(e.target.value)}
                            placeholder="Contoh: 3.000.000 (boleh dikosongkan)"
                            className="h-full w-full bg-transparent pr-3 text-[15.5px] font-bold text-[#17223B] tabular-nums focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setPhase("ask-profile");
                          pushHistoryView("ask-profile", null, null, null);
                        }}
                        className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-[#F6F5F2] px-4 py-2.5 text-[14px] font-bold text-[#17223B] lp-ring"
                      >
                        <ArrowLeft className="h-4 w-4 shrink-0" />
                        <span>Ubah Gaji/Usia</span>
                      </button>

                      <button
                        type="button"
                        data-testid="guided-next-step-2"
                        onClick={() => {
                          setPhase("result");
                          pushHistoryView("result", null, null, null);
                        }}
                        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#078D67] px-5 py-2.5 text-[15px] font-bold text-white hover:bg-[#056C4F]"
                      >
                        <span>Lihat Hasil Hitungan Saya</span>
                        <ArrowRight className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                )}

                {/* KONTEN LANGKAH 3: HASIL HITUNGAN */}
                {phase === "result" && (
                  <div data-testid="calc-result-box" className="mt-4 space-y-4">
                    {!estimate.isWithinSafeRatio && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-950">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                          <span>
                            Cicilan melebihi batas nyaman 70% gaji. Rekomendasi aman:{" "}
                            <strong>
                              {formatRupiahCompact(estimate.safeSuggestedPlafond)} (
                              {maxAllowedTenorYears} Thn)
                            </strong>
                            .
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid="apply-safe-suggestion-btn"
                          onClick={onApplySafeSuggestion}
                          className="rounded-lg bg-[#351080] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#5720B8]"
                        >
                          Sesuaikan ke Cicilan Aman
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 border-y border-[#17223B]/12 py-4 sm:grid-cols-2">
                      <div>
                        <div className="text-[12.5px] font-semibold text-[#17223B]/65">
                          Sisa Uang Pensiun di Tangan / Bulan
                        </div>
                        <div
                          data-testid="calc-remaining-salary"
                          className="mt-1 font-display text-[26px] font-extrabold text-[#078D67] tabular-nums"
                        >
                          ± {formatRupiah(estimate.remainingSalary)}
                        </div>
                        <div className="mt-0.5 text-[12px] text-[#475569]">
                          Tetap utuh untuk kebutuhan sehari-hari
                        </div>
                      </div>

                      <div className="sm:border-l sm:border-[#17223B]/12 sm:pl-5">
                        <div className="text-[12.5px] font-semibold text-[#17223B]/65">
                          Perkiraan Cicilan / Bulan
                        </div>
                        <div
                          data-testid="calc-installment-range"
                          className="mt-1 font-display text-[21px] font-extrabold text-[#17223B] tabular-nums"
                        >
                          {formatRupiah(estimate.installmentLow)} –{" "}
                          {formatRupiah(estimate.installmentHigh)}
                        </div>
                        <div className="mt-0.5 text-[12px] text-[#475569]">
                          Dana {formatRupiahCompact(plafond)} • {effectiveTenorYears} Tahun • Usia
                          saat lunas: <strong>{estimate.ageAtMaturity} thn</strong>
                        </div>
                      </div>
                    </div>

                    {/* Ringkasan Pembagian Tenor Prapensiun (Masa Dinas Aktif vs Masa Pensiun) */}
                    {pensionStatus === "Prapensiun" &&
                      prapenAnalysis?.valid &&
                      prapenAnalysis.monthsToRetirement > 0 && (
                        <div
                          data-testid="prapen-result-split"
                          className="rounded-xl bg-[#F6F5F2] px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-[#17223B]/80 lp-ring"
                        >
                          <div className="font-bold text-[#351080]">
                            Rencana Prapensiun • TMT {prapenAnalysis.formattedDate}
                          </div>
                          <div className="mt-0.5">
                            Pembagian tenor {effectiveTenorYears} tahun:{" "}
                            <strong>
                              {formatMonthsHuman(prapenAnalysis.activeTenorMonths)} masa dinas aktif
                            </strong>
                            {prapenAnalysis.pensionTenorMonths > 0
                              ? ` + ${formatMonthsHuman(prapenAnalysis.pensionTenorMonths)} setelah pensiun.`
                              : " (lunas sebelum masa pensiun)."}
                          </div>
                        </div>
                      )}

                    {/* Ringkasan Perkiraan Penghematan Take Over */}
                    {selectedGoalId === "takeover" && estimate.estimatedMonthlySaving > 0 && (
                      <div
                        data-testid="takeover-saving-box"
                        className="rounded-xl border border-[#078D67]/25 bg-[#078D67]/8 px-3.5 py-2.5 text-[13px] font-semibold text-[#056C4F]"
                      >
                        Perkiraan cicilan lebih ringan ±{" "}
                        <strong>{formatRupiah(estimate.estimatedMonthlySaving)}/bulan</strong>{" "}
                        dibanding cicilan lama Bapak/Ibu.
                      </div>
                    )}

                    <div>
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#E2E6F0]">
                        <div
                          style={{ width: `${estimate.walletRemainingBarPct}%` }}
                          className="bg-[#078D67] transition-all duration-500"
                        />
                        <div
                          style={{ width: `${100 - estimate.walletRemainingBarPct}%` }}
                          className="bg-[#351080] transition-all duration-500"
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[12px] font-semibold">
                        <span className="text-[#078D67]">
                          Sisa Gaji di Tangan ({estimate.remainingRatioPct}%)
                        </span>
                        <span className="text-[#351080]">
                          Perkiraan Cicilan ({estimate.ratioPct}%)
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-[12px] leading-[1.55] text-[#475569]">
                      <p>
                        *Angka di atas adalah estimasi awal dan bukan persetujuan kredit mengikat.
                        Rincian uang terima bersih dihitung tertulis oleh petugas cabang sesuai Bank
                        Mitra.
                      </p>
                      <button
                        type="button"
                        data-testid="result-read-education-link"
                        onClick={(e) => openCorporatePage("edukasi", e, "plafon-vs-terima-bersih")}
                        className="font-semibold text-[#351080] hover:underline"
                      >
                        Ingin tahu beda Plafon &amp; Uang Terima Bersih? Baca panduan singkat →
                      </button>
                    </div>

                    <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          setPhase("ask-loan");
                          pushHistoryView("ask-loan", null, null, null);
                        }}
                        className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[#F6F5F2] px-4 text-[14px] font-bold text-[#17223B] lp-ring"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Ubah Angka</span>
                      </button>

                      <button
                        type="button"
                        data-testid="open-lead-form-btn"
                        onClick={() => handleOpenLeadStep(null, "simulasi")}
                        className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#078D67] px-5 text-[15px] font-bold text-white hover:bg-[#056C4F]"
                      >
                        <span>Minta Petugas Hitungkan Terima Bersih (Gratis)</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex justify-center border-t border-[#17223B]/10 pt-2.5">
                      <a
                        href={familyShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="share-family-wa-btn"
                        className="text-[13px] font-bold text-[#351080] hover:underline"
                      >
                        Bagikan Ringkasan Hitungan Ini ke WA Anak / Keluarga →
                      </a>
                    </div>
                  </div>
                )}

                {/* KONTEN MENU 04: CEK KANTOR CABANG & KONFIRMASI WILAYAH (TANPA LOMPATAN TINGGI KARTU) */}
                {phase === "branch-picker" && (
                  <div data-testid="branch-picker-panel" className="mt-4 space-y-3.5">
                    {selectedBranchInfo ? (
                      <div
                        data-testid="branch-detail-card"
                        className="lp-fade-in space-y-3.5 rounded-2xl bg-[#F6F5F2] p-4 lp-ring sm:p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#078D67]">
                            Kantor Cabang Resmi Aktif
                          </span>
                          <span className="text-[12px] font-bold text-[#351080]">
                            {selectedBranchInfo.kanwilCode} • {selectedBranchInfo.kanwilName}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-display text-[21px] font-bold text-[#17223B] sm:text-[23px]">
                            {selectedBranchInfo.label}
                          </h3>
                          <p className="mt-1 text-[13.5px] leading-[1.6] text-[#17223B]/75">
                            <strong className="text-[#17223B]">Cakupan Wilayah Layanan:</strong>{" "}
                            {selectedBranchInfo.coverage}.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-2 border-y border-[#17223B]/10 py-3 text-[12.5px] sm:grid-cols-2">
                          <div>
                            <span className="font-bold text-[#17223B]">Standar Layanan:</span>{" "}
                            <span className="text-[#17223B]/75">
                              Pendampingan Tatap Muka &amp; Hitung Terima Bersih Gratis (Rp 0)
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-[#17223B]">Jam Operasional:</span>{" "}
                            <span className="text-[#17223B]/75">
                              {SITE_CONTENT.contact.operationalHours}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            data-testid="branch-consult-cta"
                            onClick={() =>
                              handleOpenLeadStep(selectedBranchInfo.city, "konsultasi-cabang")
                            }
                            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#078D67] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#056C4F]"
                          >
                            <span>
                              Minta Petugas {selectedBranchInfo.label} Menghubungi Saya
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0" />
                          </button>

                          <button
                            type="button"
                            data-testid="branch-simulate-cta"
                            onClick={() => {
                              setInquiryMode("simulasi");
                              setCity(selectedBranchInfo.city);
                              setPhase("ask-profile");
                              pushHistoryView("ask-profile", null, selectedBranchInfo.city, null);
                              playClip(GAME_INTRO_CONFIG.voiceClips.profile);
                            }}
                            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#351080] px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-[#5720B8]"
                          >
                            <span>Hitung Simulasi Dulu</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            data-testid="branch-back-to-list"
                            onClick={() => {
                              setSelectedBranchCity(null);
                              pushHistoryView("branch-picker", null, null, null);
                            }}
                            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#351080] hover:underline"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            <span>Pilih Kota atau Wilayah Lain</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => openCorporatePage("profil", e)}
                            className="text-[12.5px] font-semibold text-[#17223B]/65 hover:text-[#351080] hover:underline"
                          >
                            Lihat Daftar Lengkap 7 Kanwil →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Kotak Pencarian Kota/Kabupaten (Mendukung Alias Kabupaten seperti Simalungun, Depok, Sidoarjo) */}
                        <div>
                          <input
                            type="text"
                            data-testid="branch-search-input"
                            value={branchSearch}
                            onChange={(e) => setBranchSearch(e.target.value)}
                            placeholder="Cari kota / kabupaten (contoh: Medan, Simalungun, Bandung)..."
                            className="h-10 w-full rounded-xl bg-[#F6F5F2] px-3.5 text-[13.5px] font-semibold text-[#17223B] placeholder:text-[#475569] lp-ring focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#351080]"
                          />
                        </div>

                        {/* Pil 7 Wilayah Kanwil — Menjaga Tinggi Kartu Tetap Stabil Tanpa Melompat */}
                        {!branchSearch.trim() && (
                          <div
                            data-testid="branch-kanwil-tabs"
                            className="flex flex-wrap gap-1.5"
                          >
                            {SITE_CONTENT.kanwilList.map((kw) => {
                              const active = activeKanwilCode === kw.code;
                              return (
                                <button
                                  key={kw.code}
                                  type="button"
                                  data-testid={`kanwil-tab-${kw.code}`}
                                  onClick={() => setActiveKanwilCode(kw.code)}
                                  className={`rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition-colors ${
                                    active
                                      ? "bg-[#351080] text-white"
                                      : "bg-[#F6F5F2] text-[#17223B]/80 hover:bg-[#EDE9F8] lp-ring"
                                  }`}
                                >
                                  {KANWIL_SHORT_LABELS[kw.code] || kw.name}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Daftar Cabang pada Wilayah Aktif / Hasil Pencarian — Nama Utuh Tanpa Truncate & Tanpa Scrollbar Dalam Saat Mode Wilayah */}
                        {filteredBranchItems.length > 0 ? (
                          <div
                            className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${
                              branchSearch.trim() ? "max-h-[260px] overflow-y-auto pr-0.5" : ""
                            }`}
                          >
                            {filteredBranchItems.map((item) => (
                              <button
                                key={item.city}
                                type="button"
                                data-testid={`branch-city-btn-${item.city}`}
                                onClick={() => {
                                  setSelectedBranchCity(item.city);
                                  pushHistoryView("branch-picker", null, item.city, null);
                                }}
                                className="group flex flex-col items-start rounded-xl bg-[#F6F5F2] px-3.5 py-2.5 text-left transition-colors hover:bg-white lp-ring hover:ring-2 hover:ring-[#351080]"
                              >
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-[#17223B] group-hover:text-[#351080]">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#078D67]" />
                                    <span>{item.label}</span>
                                  </span>
                                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#351080] opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                                </div>
                                <span className="mt-0.5 line-clamp-1 pl-5 text-[11.5px] text-[#17223B]/65">
                                  {item.coverage}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-[#F6F5F2] p-4 text-[13px] text-[#17223B]/75 lp-ring">
                            Kota <strong>&ldquo;{branchSearch}&rdquo;</strong> belum ditemukan di
                            filter cepat. Bapak/Ibu tetap dapat melanjutkan konsultasi dan petugas
                            wilayah terdekat kami akan membantu.
                            <div className="mt-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenLeadStep(
                                    branchSearch.trim().toUpperCase(),
                                    "konsultasi-cabang"
                                  )
                                }
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#351080] px-3.5 text-[12.5px] font-bold text-white"
                              >
                                <span>Konsultasi untuk Wilayah {branchSearch.trim()}</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#17223B]/10 pt-3">
                          <button
                            type="button"
                            onClick={handleResetToChoices}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#F6F5F2] px-3.5 text-[13px] font-bold text-[#17223B] lp-ring"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            <span>Kembali</span>
                          </button>

                          <span className="text-[12px] font-semibold text-[#475569]">
                            7 Wilayah • Kantor Pusat &amp; 29 Cabang Kota
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* KONTEN LANGKAH 4: FORM KONTAK & TIKET ANTREAN */}
                {phase === "lead-form" && (
                  <div className="mt-4">
                    {submitSuccess ? (
                      <div
                        data-testid="public-lead-success"
                        className="space-y-4 border-t border-[#17223B]/10 pt-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#078D67] px-4 py-3 text-white">
                          <span className="font-display text-[14px] font-bold uppercase tracking-wider">
                            Nomor Antrean Cabang
                          </span>
                          <span className="rounded-md bg-white/20 px-3 py-0.5 text-[13px] font-bold tabular-nums">
                            No. {submitSuccess.queueNo}
                          </span>
                        </div>

                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#078D67]" />
                          <div>
                            <div className="font-display text-[18px] font-bold text-[#17223B]">
                              Terima kasih, Bapak/Ibu {submitSuccess.visitorName}
                            </div>
                            <p className="mt-0.5 text-[14px] leading-[1.6] text-[#17223B]/75">
                              Permohonan Anda sudah masuk ke{" "}
                              <strong className="text-[#351080]">
                                {submitSuccess.city === "PUSAT JAKARTA"
                                  ? "KANTOR PUSAT JAKARTA"
                                  : `CABANG ${submitSuccess.city}`}
                              </strong>
                              . Petugas kami akan segera menghubungi Bapak/Ibu.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={(e) => openCorporatePage("profil", e)}
                            className="text-[13px] font-bold text-[#351080] hover:underline"
                          >
                            Lihat Profil Perusahaan →
                          </button>

                          <button
                            type="button"
                            onClick={handleResetToChoices}
                            className="inline-flex h-11 items-center rounded-xl bg-[#351080] px-5 text-[14px] font-bold text-white hover:bg-[#5720B8]"
                          >
                            Selesai &amp; Kembali ke Menu Awal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form
                        onSubmit={onLeadSubmit}
                        noValidate
                        data-testid="public-lead-form"
                        className="space-y-3.5"
                      >
                        {submitError && (
                          <div
                            role="alert"
                            data-testid="public-lead-error"
                            className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-[13.5px] font-semibold text-red-900"
                          >
                            {submitError}
                          </div>
                        )}

                        <div className="sr-only" aria-hidden="true">
                          <input
                            type="text"
                            name="company_website"
                            tabIndex={-1}
                            autoComplete="off"
                            value={companyWebsite}
                            onChange={(e) => setCompanyWebsite(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="lp-name"
                              className="block text-[13px] font-bold text-[#17223B]"
                            >
                              1. Nama Lengkap Bapak/Ibu *
                            </label>
                            <input
                              id="lp-name"
                              data-testid="input-name"
                              type="text"
                              required
                              maxLength={120}
                              placeholder="Contoh: H. Budi Santoso"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="mt-1 h-11 w-full rounded-xl bg-[#F6F5F2] px-3.5 text-[16px] font-semibold text-[#17223B] lp-ring focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#351080]"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="lp-phone"
                              className="block text-[13px] font-bold text-[#17223B]"
                            >
                              2. Nomor HP / WhatsApp Aktif *
                            </label>
                            <input
                              id="lp-phone"
                              data-testid="input-phone"
                              type="tel"
                              required
                              maxLength={20}
                              placeholder="081234567890"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="mt-1 h-11 w-full rounded-xl bg-[#F6F5F2] px-3.5 text-[16px] font-semibold text-[#17223B] lp-ring focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#351080]"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="lp-city"
                              className="block text-[13px] font-bold text-[#17223B]"
                            >
                              3. Kota Tempat Tinggal *
                            </label>
                            <input
                              id="lp-city"
                              data-testid="input-city"
                              type="text"
                              list="lp-companion-city-list"
                              required
                              maxLength={80}
                              placeholder="Ketik / pilih kota"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              className="mt-1 h-11 w-full rounded-xl bg-[#F6F5F2] px-3.5 text-[16px] font-semibold text-[#17223B] lp-ring focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#351080]"
                            />
                            <datalist id="lp-companion-city-list">
                              {allCities.map((c) => (
                                <option key={c} value={c} />
                              ))}
                            </datalist>
                          </div>

                          <div>
                            <label
                              htmlFor="lp-institution"
                              className="block text-[13px] font-bold text-[#17223B]"
                            >
                              4. Instansi Pensiun
                            </label>
                            <select
                              id="lp-institution"
                              data-testid="select-institution"
                              value={institution}
                              onChange={(e) => setInstitution(e.target.value)}
                              className="mt-1 h-11 w-full rounded-xl bg-[#F6F5F2] px-3.5 text-[15px] font-semibold text-[#17223B] lp-ring focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#351080]"
                            >
                              <option value="TASPEN">PT TASPEN (ASN / PNS)</option>
                              <option value="ASABRI">PT ASABRI (TNI / Polri)</option>
                              <option value="PNS AKTIF">PNS / ASN Aktif (Prapensiun)</option>
                              <option value="BUMN">Dana Pensiun BUMN</option>
                              <option value="LAINNYA">Instansi Lainnya</option>
                            </select>
                          </div>
                        </div>

                        {turnstileSiteKey && (
                          <div>
                            <div ref={turnstileContainerRef} />
                          </div>
                        )}

                        <div className="rounded-xl border border-[#351080]/15 bg-[#F6F5F2] p-3">
                          <label
                            htmlFor="lp-pdp-consent"
                            className="flex min-h-[44px] cursor-pointer items-start gap-3 text-[13px] leading-[1.5] text-[#17223B]"
                          >
                            <input
                              id="lp-pdp-consent"
                              data-testid="checkbox-pdp-consent"
                              type="checkbox"
                              checked={Boolean(pdpConsent)}
                              onChange={(e) => {
                                if (setPdpConsent) setPdpConsent(e.target.checked);
                                if (e.target.checked && submitError) setSubmitError("");
                              }}
                              required
                              className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#351080]/40 accent-[#078D67]"
                            />
                            <span>
                              Saya menyetujui pengolahan data kontak dan estimasi simulasi saya
                              untuk keperluan konsultasi oleh petugas cabang resmi sesuai{" "}
                              <button
                                type="button"
                                data-testid="open-pdp-modal-btn"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowPdpModal(true);
                                }}
                                className="font-bold text-[#351080] underline decoration-[#351080]/50 underline-offset-2 hover:text-[#5720B8]"
                              >
                                Pemberitahuan Privasi &amp; Pelindungan Data Pribadi (UU No. 27
                                Tahun 2022)
                              </button>
                              . *
                            </span>
                          </label>
                        </div>

                        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => {
                              const prevPhase =
                                inquiryMode === "konsultasi-cabang" ? "branch-picker" : "result";
                              setPhase(prevPhase);
                              pushHistoryView(prevPhase, null, selectedBranchCity, null);
                            }}
                            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[#F6F5F2] px-4 text-[14px] font-bold text-[#17223B] lp-ring"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            <span>Kembali</span>
                          </button>

                          <button
                            type="submit"
                            disabled={submitting}
                            data-testid="submit-public-lead"
                            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#078D67] px-5 text-[15px] font-bold text-white hover:bg-[#056C4F] disabled:opacity-60"
                          >
                            <span>
                              {submitting
                                ? "Mengirim ke Cabang..."
                                : "Kirim & Ambil Nomor Antrean Cabang"}
                            </span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="text-center text-[11.5px] text-[#475569]">
                          Gratis tanpa biaya di muka. Data pribadi dilindungi sesuai UU No. 27 Tahun
                          2022 (UU PDP) tanpa unggah KTP.
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPdpModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lp-pdp-modal-title"
          data-testid="pdp-privacy-modal"
          onClick={() => setShowPdpModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1527]/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#078D67]">
                  Kepatuhan UU No. 27 Tahun 2022 (UU PDP)
                </p>
                <h2
                  id="lp-pdp-modal-title"
                  className="mt-0.5 font-display text-[17px] font-bold text-[#17223B]"
                >
                  Pemberitahuan Privasi &amp; Pelindungan Data Pribadi
                </h2>
              </div>
              <button
                type="button"
                aria-label="Tutup Pemberitahuan Privasi"
                onClick={() => setShowPdpModal(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-[13.5px] leading-[1.6] text-[#17223B]/85">
              <div>
                <h3 className="font-bold text-[#17223B]">1. Data yang Dikumpulkan &amp; Tujuan</h3>
                <p className="mt-0.5">
                  Layanan Pensiunan hanya mengumpulkan nama lengkap, nomor HP/WhatsApp, kota
                  domisili, status/instansi pensiun, dan estimasi simulasi untuk keperluan
                  menghubungi serta mendampingi konsultasi pembiayaan pensiun melalui petugas
                  cabang resmi terdekat.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-[#17223B]">2. Pembatasan &amp; Keamanan Data</h3>
                <p className="mt-0.5">
                  Situs ini tidak meminta unggah foto KTP, SK Pensiun, PIN, maupun kode OTP. Data
                  Bapak/Ibu disimpan secara terbatas di sistem internal dan tidak diperjualbelikan
                  kepada pihak ketiga yang tidak berkepentingan.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-[#17223B]">3. Hak Subjek Data (UU PDP)</h3>
                <p className="mt-0.5">
                  Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Bapak/Ibu berhak
                  memperoleh kejelasan penggunaan data, memperbarui atau melengkapi data, menarik
                  kembali persetujuan, serta meminta penghentian pemrosesan atau penghapusan data
                  pribadi kapan saja melalui petugas cabang resmi kami.
                </p>
              </div>

              <div className="rounded-xl bg-[#F6F5F2] px-3.5 py-2 text-[12px] text-[#475569]">
                Versi Pemberitahuan Privasi: <strong className="text-[#17223B]">{pdpConsentVersion}</strong>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                data-testid="close-pdp-modal-btn"
                onClick={() => setShowPdpModal(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-4 text-[13.5px] font-bold text-[#17223B] hover:bg-slate-200"
              >
                Tutup
              </button>
              <button
                type="button"
                data-testid="accept-pdp-modal-btn"
                onClick={() => {
                  if (setPdpConsent) setPdpConsent(true);
                  if (submitError) setSubmitError("");
                  setShowPdpModal(false);
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#078D67] px-5 text-[13.5px] font-bold text-white hover:bg-[#056C4F]"
              >
                Saya Mengerti &amp; Setuju
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
