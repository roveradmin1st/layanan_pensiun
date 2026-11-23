import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, ExternalLink, MapPin } from "lucide-react";
import { SITE_CONTENT } from "../config/site-content.js";
import IndonesiaBranchMap from "./IndonesiaBranchMap.jsx";

/**
 * HALAMAN KORPORAT EDITORIAL PENUH (Full-Page Institutional View — Anti-AI-Slop)
 * Ritme visual berwibawa khas institusi keuangan nasional:
 *  1. Split Hero Editorial + Foto Dokumentasi Konsultasi Tatap Muka & Info Kantor Resmi (#corp-profil)
 *  2. Pita Kontras Biru Dongker Institusi (#17223B) untuk 3 Standar Anti-Penipuan + Batas Kewenangan Resmi
 *  3. Identitas PT Kolaborasi Ekosistem Nusantara (KEN), Visi, Nilai PRIMA, & Cara Kerja Connect–Grow
 *  4. 4 Kartu Segmen Sejajar + Eksplorator Interaktif 7 Kantor Wilayah (tanpa lubang orphan)
 *  5. 6 Tahap Pendampingan Resmi Layanan Pensiunan (grid 3x2 seimbang)
 *  6. Bagian Edukasi Bergaya Majalah Editorial (#corp-edukasi) & FAQ 2-Kolom Terpisah
 *  7. Bagian Karir & Pembinaan Jaringan (#corp-karir) serta Mitra, Portofolio & Investasi (#corp-mitra)
 */

const NAV_TABS = [
  { id: "profil", label: "Profil Perusahaan" },
  { id: "edukasi", label: "Edukasi" },
  { id: "karir", label: "Karir" },
  { id: "mitra", label: "Mitra" }
];

const SEGMENT_ACCENTS = ["#351080", "#078D67", "#17223B", "#D97706"];

const STANDARD_BORDER_CLASSES = [
  "border-t-2 border-[#34D399]",
  "border-t-2 border-[#A78BFA]",
  "border-t-2 border-[#F59E0B]"
];

function normalizeSectionId(raw) {
  if (raw === "edukasi" || raw === "panduan") return "edukasi";
  if (raw === "karier" || raw === "karir") return "karir";
  if (raw === "investor" || raw === "mitra") return "mitra";
  return "profil";
}

function formatPendingField(rawValue, fallbackLabel) {
  const str = String(rawValue || "").trim();
  if (!str || str.includes("[KONFIRMASI PEMILIK")) {
    return fallbackLabel;
  }
  return str;
}

export default function CorporateView({
  initialSection = "profil",
  initialArticleId = null,
  onBackToCompanion,
  onSelectCityForConsult,
  onStartSimulation
}) {
  const [activeSection, setActiveSection] = useState(() => normalizeSectionId(initialSection));
  const [activeKanwilCode, setActiveKanwilCode] = useState(
    () => SITE_CONTENT.kanwilList[0]?.code || "WIL-1"
  );
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [activeEduId, setActiveEduId] = useState(
    () => initialArticleId || SITE_CONTENT.education.articles[0]?.id || ""
  );
  const [openFaqIdx, setOpenFaqIdx] = useState(0);

  // Penyusun pesan lamaran karir (terpisah total dari antrean pengajuan kredit nasabah)
  const [careerName, setCareerName] = useState("");
  const [careerCity, setCareerCity] = useState("");
  const [careerRole, setCareerRole] = useState("Marketing Officer Cabang");
  const [careerExp, setCareerExp] = useState("");
  const [careerCopied, setCareerCopied] = useState(false);

  // Penyusun korespondensi Mitra & Investor (terpisah dari antrean CS nasabah)
  const [invName, setInvName] = useState("");
  const [invOrg, setInvOrg] = useState("");
  const [invTopic, setInvTopic] = useState("Permintaan Profil Perusahaan & Diskusi Direksi");
  const [invCopied, setInvCopied] = useState(false);

  const allCities = useMemo(
    () => SITE_CONTENT.kanwilList.flatMap((k) => k.branches),
    []
  );

  const activeEduIndex = useMemo(() => {
    const idx = SITE_CONTENT.education.articles.findIndex((a) => a.id === activeEduId);
    return idx >= 0 ? idx : 0;
  }, [activeEduId]);

  const activeEduArticle = SITE_CONTENT.education.articles[activeEduIndex];

  const scrollToSection = (sectionId) => {
    const target = normalizeSectionId(sectionId);
    setActiveSection(target);
    try {
      window.history.replaceState(window.history.state, "", `#${target}`);
    } catch {
      // noop
    }
    const el = document.getElementById(`corp-${target}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    const target = normalizeSectionId(initialSection);
    setActiveSection(target);
    if (initialArticleId) {
      setActiveEduId(initialArticleId);
    }
    if (target !== "profil") {
      const t = window.setTimeout(() => {
        document
          .getElementById(`corp-${target}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return () => window.clearTimeout(t);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    return undefined;
  }, [initialSection, initialArticleId]);

  const careerDraft =
    `Lamaran Karir — Layanan Pensiunan (PT KEN)\n` +
    `Nama: ${careerName.trim() || "-"}\n` +
    `Posisi: ${careerRole}\n` +
    `Domisili / Cabang: ${careerCity.trim() || "-"}\n` +
    `Pengalaman Singkat: ${careerExp.trim() || "-"}`;

  const investorDraft =
    `Permohonan Diskusi Kemitraan / Investasi — PT Kolaborasi Ekosistem Nusantara (KEN)\n` +
    `Nama: ${invName.trim() || "-"}\n` +
    `Institusi / Perusahaan: ${invOrg.trim() || "-"}\n` +
    `Topik: ${invTopic}`;

  const careerWhatsappHref = `${SITE_CONTENT.contact.whatsappHref}?text=${encodeURIComponent(careerDraft)}`;
  const investorWhatsappHref = `${SITE_CONTENT.contact.whatsappHref}?text=${encodeURIComponent(investorDraft)}`;

  const copyText = async (text, onDone) => {
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }
    if (copied) {
      onDone(true);
      window.setTimeout(() => onDone(false), 2600);
    }
  };

  const handleSelectEduCard = (articleId) => {
    setActiveEduId(articleId);
    if (window.innerWidth < 1024) {
      document
        .getElementById("corp-edu-reader")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      data-testid="corporate-view"
      className="lp-fade-in min-h-screen bg-[#F6F5F2] text-[#17223B]"
    >
      {/* ====================================================================
          HEADER KORPORAT INSTITUSIONAL & STICKY
          ==================================================================== */}
      <header className="sticky top-0 z-40 border-b border-[#17223B]/10 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1160px] items-center justify-between gap-4 px-5 sm:px-8">
          <button
            type="button"
            onClick={onBackToCompanion}
            className="focus:outline-none"
            aria-label="Kembali ke Pendamping Layanan Pensiunan"
          >
            <img
              src={SITE_CONTENT.brand.logoHorizontal}
              alt="Layanan Pensiunan"
              className="h-8 w-auto object-contain sm:h-9"
            />
          </button>

          <nav className="hidden items-center gap-7 text-[14px] font-semibold md:flex">
            {NAV_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid={`corp-nav-${t.id}`}
                onClick={() => scrollToSection(t.id)}
                className={`border-b-2 py-1 transition-colors ${
                  activeSection === t.id
                    ? "border-[#351080] text-[#351080]"
                    : "border-transparent text-[#17223B]/70 hover:text-[#17223B]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={onBackToCompanion}
            data-testid="close-company-profile-btn"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#351080] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#5720B8] sm:px-5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Kembali ke Pendamping</span>
            <span className="sm:hidden">Kembali</span>
          </button>
        </div>

        {/* Sub-navigasi mobile — Pas 1 baris tanpa scrollbar horizontal */}
        <div className="grid grid-cols-4 gap-1.5 border-t border-[#17223B]/10 bg-[#F6F5F2]/90 px-4 py-2 md:hidden">
          {NAV_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => scrollToSection(t.id)}
              className={`rounded-lg py-1.5 text-center text-[12px] font-bold transition-colors ${
                activeSection === t.id
                  ? "bg-[#351080] text-white"
                  : "bg-white text-[#17223B]/75 lp-ring"
              }`}
            >
              {t.id === "profil" ? "Profil" : t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ====================================================================
          BAGIAN 1: HERO JARGON FLAGSHIP PT KEN & MASKOT PENI (TANPA AI SLOP)
          ==================================================================== */}
      <section id="corp-profil" className="scroll-mt-24 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Kiri: Hanya Jargon Utama Flagship Business PT KEN */}
            <div className="lg:col-span-7">
              <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#078D67]">
                PT Kolaborasi Ekosistem Nusantara (KEN)
              </div>

              <h1
                data-testid="corp-flagship-jargon"
                className="mt-3.5 font-display text-[30px] font-extrabold leading-[1.16] tracking-[-0.025em] text-[#17223B] sm:text-[42px] lg:text-[48px]"
              >
                <span className="text-[#351080]">LAYANAN PENSIUNAN</span>{" "}
                <span className="font-semibold text-[#17223B]/80">
                  is flagship business from
                </span>{" "}
                <span className="mt-1 block text-[#17223B]">
                  PT KOLABORASI EKOSISTEM NUSANTARA
                </span>
              </h1>

              <div className="mt-6 h-[3px] w-16 bg-[#351080]" />

              <p className="mt-5 max-w-[540px] text-[16px] leading-[1.7] text-[#17223B]/72 sm:text-[17px]">
                {SITE_CONTENT.companyProfile.parentTagline} —{" "}
                {SITE_CONTENT.companyProfile.parentTaglineMeaning}
              </p>
            </div>

            {/* Kanan: Maskot Resmi "Peni" Menyatu dengan Halaman (Tanpa Kotak Gelap AI Slop) */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto flex max-w-[380px] flex-col items-center">
                {/* Siluet logo resmi lembut di belakang maskot */}
                <img
                  src={SITE_CONTENT.brand.logoSilhouette}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-[280px] select-none opacity-[0.08] sm:w-[320px]"
                />

                <img
                  src="/brand/mascot-intro-salam.webp"
                  alt="Peni — Pendamping Resmi Layanan Pensiunan PT Kolaborasi Ekosistem Nusantara"
                  data-testid="corp-hero-photo"
                  className="relative z-10 h-[320px] w-auto object-contain drop-shadow-[0_18px_32px_rgba(23,34,59,0.12)] sm:h-[370px]"
                />

                <div className="relative z-20 -mt-3 w-full rounded-xl border border-[#17223B]/10 bg-white/95 px-5 py-3.5 text-center shadow-[0_14px_30px_-18px_rgba(23,34,59,0.22)] backdrop-blur-sm">
                  <div className="font-display text-[16px] font-bold text-[#17223B]">
                    Peni — Pendamping Resmi Layanan Pensiunan
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-medium text-[#078D67]">
                    PT Kolaborasi Ekosistem Nusantara (KEN)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PITA KONTRAS BIRU DONGKER INSTITUSI (#17223B) — 3 STANDAR ANTI-PENIPUAN
          ==================================================================== */}
      <section
        data-testid="corp-trust-band"
        className="relative overflow-hidden bg-[#17223B] py-16 text-white sm:py-20"
      >
        {/* Watermark siluet logo resmi yang sangat halus di tepi kanan */}
        <img
          src={SITE_CONTENT.brand.logoSilhouette}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 top-1/2 w-[360px] -translate-y-1/2 select-none opacity-[0.04] brightness-0 invert"
        />

        <div className="relative z-10 mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[680px]">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#34D399]">
                Jaminan Keamanan Nasabah
              </div>
              <h2 className="mt-2.5 font-display text-[28px] font-bold leading-[1.18] tracking-[-0.02em] text-white sm:text-[36px]">
                Tiga standar layanan resmi yang membedakan kami dari pinjaman ilegal.
              </h2>
            </div>

            <button
              type="button"
              onClick={onStartSimulation}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-white/20"
            >
              <span>Mulai Simulasi Aman</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-11 grid grid-cols-1 gap-8 md:grid-cols-3">
            {SITE_CONTENT.companyProfile.antiFraudStandards.map((item, idx) => (
              <div
                key={item.no}
                className={`${STANDARD_BORDER_CLASSES[idx % STANDARD_BORDER_CLASSES.length]} pt-6`}
              >
                <div className="font-display text-[13px] font-bold tracking-wider text-slate-400">
                  STANDAR {item.no}
                </div>
                <h3 className="mt-2 font-display text-[19px] font-bold leading-snug text-white">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-[1.7] text-slate-300">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Batas Kewenangan Resmi (Pemisahan Peran KEN / Layanan Pensiunan vs Bank Mitra) */}
          <div
            data-testid="corp-authority-boundary"
            className="mt-11 grid grid-cols-1 gap-4 border-t border-white/15 pt-8 lg:grid-cols-12 lg:items-start lg:gap-8"
          >
            <div className="lg:col-span-4">
              <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#34D399]">
                Transparansi Peran &amp; Kepatuhan
              </div>
              <h3 className="mt-1.5 font-display text-[20px] font-bold text-white">
                {SITE_CONTENT.companyProfile.authorityBoundaryTitle}
              </h3>
            </div>
            <p className="text-[14.5px] leading-[1.72] text-slate-200 lg:col-span-8">
              {SITE_CONTENT.companyProfile.authorityBoundary}
            </p>
          </div>
        </div>
      </section>

      {/* ====================================================================
          ENTITAS PENGELOLA: PT KOLABORASI EKOSISTEM NUSANTARA (KEN) & NILAI PRIMA
          ==================================================================== */}
      <section
        data-testid="corp-ken-identity"
        className="border-b border-[#17223B]/10 bg-[#F6F5F2] py-16 sm:py-20"
      >
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
            {/* Kiri: Cerita Singkat & Visi PT KEN */}
            <div className="lg:col-span-5">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#351080]">
                Tentang Pengelola • PT KEN
              </div>
              <h2 className="mt-2.5 font-display text-[28px] font-bold leading-[1.16] tracking-[-0.02em] text-[#17223B] sm:text-[34px]">
                {SITE_CONTENT.companyProfile.kenStoryHeadline}
              </h2>

              <div className="mt-4 space-y-3.5 text-[15px] leading-[1.72] text-[#17223B]/78">
                {SITE_CONTENT.companyProfile.kenStoryParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              {/* Visi Resmi KEN — Ringkas & Berwibawa */}
              <blockquote className="mt-6 border-l-[3px] border-[#078D67] pl-4">
                <div className="font-display text-[17px] font-bold text-[#17223B]">
                  {SITE_CONTENT.companyProfile.parentTagline}.
                </div>
                <p className="mt-1 text-[14px] leading-[1.6] text-[#17223B]/72">
                  {SITE_CONTENT.companyProfile.parentTaglineMeaning}
                </p>
              </blockquote>
            </div>

            {/* Kanan: 5 Nilai Perilaku PRIMA — Tipografi Jernih Tanpa Ikon Dekoratif */}
            <div className="rounded-2xl bg-white p-6 lp-ring sm:p-8 lg:col-span-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#17223B]/10 pb-4">
                <div>
                  <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#078D67]">
                    Standar Perilaku Layanan
                  </div>
                  <h3 className="mt-1 font-display text-[21px] font-bold text-[#17223B]">
                    Nilai Kerja Perusahaan — PRIMA
                  </h3>
                </div>
                <span className="text-[12.5px] font-semibold text-[#17223B]/55">
                  Berlaku di seluruh cabang &amp; mitra
                </span>
              </div>

              <div className="divide-y divide-[#17223B]/10">
                {SITE_CONTENT.companyProfile.primaValues.map((val) => (
                  <div key={val.letter} className="flex items-start gap-4 py-4 first:pt-5 last:pb-1">
                    <div className="w-8 shrink-0 pt-0.5 font-display text-[24px] font-extrabold leading-none text-[#351080]">
                      {val.letter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-display text-[16px] font-bold text-[#17223B]">
                          {val.name}
                        </span>
                        <span className="text-[12.5px] font-semibold text-[#078D67]">
                          • {val.subtitle}
                        </span>
                      </div>
                      <p className="mt-1 text-[13.8px] leading-[1.6] text-[#17223B]/72">
                        {val.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Langkah Cara Kerja KEN: Connect -> Enable -> Empower -> Grow */}
          <div className="mt-12 border-t border-[#17223B]/12 pt-9">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#351080]">
              Cara Kerja Ekosistem KEN
            </div>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SITE_CONTENT.companyProfile.philosophySteps.map((step, idx) => (
                <div key={step.code} className="border-t-2 border-[#17223B]/15 pt-3.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[12px] font-extrabold text-[#078D67]">
                      0{idx + 1}
                    </span>
                    <span className="font-display text-[14px] font-extrabold tracking-wide text-[#351080]">
                      {step.code}
                    </span>
                    <span className="text-[13px] font-semibold text-[#17223B]/75">
                      — {step.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-[1.6] text-[#17223B]/70">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SEGMEN PENERIMA MANFAAT (4 KARTU SEJAJAR) + EKSPLORATOR INTERAKTIF 7 WILAYAH
          ==================================================================== */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          {/* 4 Segmen Sejajar */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#351080]">
                Segmen Penerima Manfaat
              </div>
              <h2 className="mt-2 font-display text-[26px] font-bold text-[#17223B] sm:text-[32px]">
                Instansi yang Kami Layani
              </h2>
            </div>
            <p className="max-w-[420px] text-[14px] leading-[1.6] text-[#17223B]/65">
              Melayani pensiunan murni, pensiun janda/duda, maupun pegawai aktif menjelang masa
              purnabakti (Prapensiun).
            </p>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SITE_CONTENT.companyProfile.servedSegments.map((seg, idx) => (
              <div
                key={seg.code}
                style={{ borderTopColor: SEGMENT_ACCENTS[idx % SEGMENT_ACCENTS.length] }}
                className="flex flex-col justify-between rounded-xl border-t-[3px] bg-[#F6F5F2] p-5 lp-ring"
              >
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#078D67]">
                    {seg.code}
                  </div>
                  <h3 className="mt-1.5 font-display text-[17.5px] font-bold text-[#17223B]">
                    {seg.label}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-[1.6] text-[#17223B]/70">{seg.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Peta Interaktif Wilayah Indonesia + Eksplorator 7 Kantor Wilayah */}
          <div className="mt-16 border-t border-[#17223B]/10 pt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#351080]">
                  Jaringan Cabang Resmi Nasional
                </div>
                <h2 className="mt-2 font-display text-[26px] font-bold text-[#17223B] sm:text-[32px]">
                  7 Kantor Wilayah • Pusat &amp; 29 Kota Cabang
                </h2>
              </div>
              <button
                type="button"
                data-testid="corp-toggle-all-branches"
                onClick={() => setShowAllBranches((v) => !v)}
                className="text-[13.5px] font-bold text-[#351080] hover:underline"
              >
                {showAllBranches
                  ? "← Kembali ke Peta Interaktif Indonesia"
                  : `Lihat Daftar Seluruh ${allCities.length} Titik Layanan →`}
              </button>
            </div>

            {showAllBranches ? (
              <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {SITE_CONTENT.kanwilList.map((kw) => (
                  <div
                    key={kw.code}
                    className="rounded-xl bg-[#F6F5F2] p-4 lp-ring"
                  >
                    <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#351080]">
                      {kw.code} • {kw.branches.length} Titik
                    </div>
                    <div className="mt-0.5 font-display text-[14.5px] font-bold text-[#17223B]">
                      {kw.name}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {kw.branches.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => onSelectCityForConsult(b)}
                          className="rounded-md bg-white px-2.5 py-1 text-[12px] font-semibold text-[#17223B] lp-ring transition-colors hover:bg-[#351080] hover:text-white"
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Kartu ke-8 Penyeimbang Grid 4x2 (Tanpa Lubang Kosong) */}
                <div className="flex flex-col justify-between rounded-xl bg-[#17223B] p-5 text-white">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#34D399]">
                      Kota Tidak Terdaftar?
                    </div>
                    <div className="mt-1 font-display text-[16px] font-bold leading-snug">
                      Kabupaten sekitar tetap dilayani cabang terdekat.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectCityForConsult("")}
                    className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#34D399] hover:underline"
                  >
                    <span>Tanya Petugas Cabang</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <IndonesiaBranchMap
                kanwilList={SITE_CONTENT.kanwilList}
                activeKanwilCode={activeKanwilCode}
                onSelectKanwil={setActiveKanwilCode}
                onSelectCity={onSelectCityForConsult}
                operationalHours={SITE_CONTENT.contact.operationalHours}
                onStartSimulation={onStartSimulation}
              />
            )}
          </div>
        </div>
      </section>

      {/* ====================================================================
          ALUR PENDAMPINGAN RESMI 6 TAHAP (GRID 3x2 SEIMBANG)
          ==================================================================== */}
      <section
        data-testid="corp-service-journey"
        className="border-y border-[#17223B]/10 bg-[#F6F5F2] py-16"
      >
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-[700px]">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#351080]">
                Alur Layanan Resmi • Layanan Pensiunan
              </div>
              <h2 className="mt-1.5 font-display text-[25px] font-bold leading-[1.2] text-[#17223B] sm:text-[31px]">
                Enam Tahap Pendampingan dari Mengenal Kebutuhan Hingga Tindak Lanjut
              </h2>
            </div>
            <p className="max-w-[400px] text-[14px] leading-[1.6] text-[#17223B]/68">
              Setiap interaksi dirancang agar calon nasabah memahami informasi, dokumen, proses, dan
              bank mitra yang berwenang mengambil keputusan.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SITE_CONTENT.companyProfile.serviceJourney.map((st, idx) => (
              <div
                key={st.no}
                className="flex flex-col justify-between rounded-2xl bg-white p-6 lp-ring"
              >
                <div>
                  <div
                    className={`font-display text-[12.5px] font-extrabold uppercase tracking-wider ${
                      idx % 2 === 0 ? "text-[#351080]" : "text-[#078D67]"
                    }`}
                  >
                    Tahap {st.no}
                  </div>
                  <h3 className="mt-2 font-display text-[18px] font-bold text-[#17223B]">
                    {st.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-[1.65] text-[#17223B]/74">
                    {st.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====================================================================
          BAGIAN 2: EDUKASI PENSIUN & PRAPENSIUN (GAYA MAJALAH EDITORIAL — BUKAN ACCORDION)
          ==================================================================== */}
      <section
        id="corp-edukasi"
        data-testid="corp-edukasi-section"
        className="scroll-mt-24 bg-white py-16 sm:py-20"
      >
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[720px]">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#078D67]">
                {SITE_CONTENT.education.eyebrow}
              </div>
              <h2 className="mt-2.5 font-display text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[#17223B] sm:text-[38px]">
                {SITE_CONTENT.education.headline}
              </h2>
              <p className="mt-3 text-[15.5px] leading-[1.7] text-[#17223B]/72">
                {SITE_CONTENT.education.summary}
              </p>
            </div>

            <button
              type="button"
              onClick={onStartSimulation}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#351080] px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-[#5720B8]"
            >
              <span>Kembali ke Kalkulator Simulasi</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Panel Baca Utama Bergaya Majalah: Foto Keluarga Indonesia + Isi Panduan Aktif */}
          <div
            id="corp-edu-reader"
            data-testid="corp-edu-active-reader"
            className="mt-10 grid grid-cols-1 overflow-hidden rounded-2xl bg-[#F6F5F2] lp-ring lg:grid-cols-12"
          >
            <div className="flex flex-col bg-[#17223B] lg:col-span-5">
              <img
                src="/brand/editorial-family-guide.webp"
                alt="Keluarga pensiunan Indonesia berdiskusi tenang bersama anak saat merencanakan keuangan masa purnabakti"
                data-testid="corp-edu-photo"
                className="min-h-[240px] w-full flex-1 object-cover"
              />
              <div className="border-t border-white/10 bg-[#17223B] px-5 py-4 text-white">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#34D399]">
                  Transparan Bersama Keluarga
                </div>
                <p className="mt-1 text-[13px] leading-[1.55] text-slate-200">
                  Diskusikan rincian estimasi dan kelengkapan dokumen dengan tenang bersama anak dan
                  pasangan sebelum memutuskan.
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-7">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-bold uppercase tracking-wider">
                  <span className="text-[#078D67]">{activeEduArticle.category}</span>
                  <span className="text-[#17223B]/45">
                    Panduan 0{activeEduIndex + 1} dari 0{SITE_CONTENT.education.articles.length}
                  </span>
                </div>

                <h3 className="mt-2.5 font-display text-[22px] font-bold leading-[1.25] text-[#17223B] sm:text-[26px]">
                  {activeEduArticle.title}
                </h3>

                <p className="mt-2.5 text-[15px] leading-[1.65] text-[#17223B]/75">
                  {activeEduArticle.summary}
                </p>

                <ul className="mt-5 space-y-3 border-t border-[#17223B]/10 pt-5 text-[14.5px] leading-[1.68] text-[#17223B]/85">
                  {activeEduArticle.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#351080]" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#17223B]/10 pt-4">
                <span className="text-[12.5px] font-medium text-[#17223B]/60">
                  Pilih topik panduan lain di bawah ini
                </span>
                <button
                  type="button"
                  onClick={onStartSimulation}
                  className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#078D67] hover:underline"
                >
                  <span>Hitung Estimasi Sekarang</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Grid 6 Kartu Topik Edukasi — Seimbang 3x2, Klik untuk Membaca */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SITE_CONTENT.education.articles.map((art, idx) => {
              const isSelected = art.id === activeEduArticle.id;
              return (
                <article
                  key={art.id}
                  className={`overflow-hidden rounded-xl border-t-[3px] transition-all ${
                    isSelected
                      ? "border-t-[#351080] bg-white shadow-[0_14px_34px_-16px_rgba(53,16,128,0.28)] ring-2 ring-[#351080]"
                      : "border-t-[#17223B]/15 bg-[#F6F5F2] lp-ring hover:bg-white hover:border-t-[#078D67]"
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`edu-article-${art.id}`}
                    onClick={() => handleSelectEduCard(art.id)}
                    className="flex h-full w-full flex-col justify-between p-5 text-left"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11.5px] font-bold uppercase tracking-wider">
                        <span className="text-[#078D67]">
                          0{idx + 1} • {art.category}
                        </span>
                        {isSelected && (
                          <span className="text-[11px] font-bold text-[#351080]">Dibaca</span>
                        )}
                      </div>
                      <h4 className="mt-2 font-display text-[16px] font-bold leading-snug text-[#17223B]">
                        {art.title}
                      </h4>
                      <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-[1.55] text-[#17223B]/68">
                        {art.summary}
                      </p>
                    </div>

                    <div className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#351080]">
                      <span>{isSelected ? "Sedang ditampilkan di atas" : "Baca panduan"}</span>
                      {!isSelected && <ArrowRight className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====================================================================
          FAQ 2-KOLOM TERPISAH (TIDAK MENUMPUK DENGAN ACCORDION LAIN)
          ==================================================================== */}
      <section className="border-t border-[#17223B]/10 bg-[#F6F5F2] py-16">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#351080]">
                Tanya Jawab Singkat
              </div>
              <h2 className="mt-2 font-display text-[26px] font-bold leading-[1.2] text-[#17223B]">
                Pertanyaan Umum Calon Nasabah
              </h2>
              <p className="mt-3 text-[14.5px] leading-[1.65] text-[#17223B]/70">
                Masih ada hal yang ingin dipastikan sebelum mengisi simulasi? Petugas cabang kami
                siap menjelaskan tanpa kewajiban mengajukan.
              </p>
              <button
                type="button"
                onClick={() => onSelectCityForConsult("")}
                className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#078D67] hover:underline"
              >
                <span>Konsultasi dengan Petugas Cabang</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 lg:col-span-8">
              {SITE_CONTENT.faqs.map((faq, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={faq.question}
                    className="rounded-xl bg-white px-5 py-1 lp-ring"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqIdx(isOpen ? -1 : idx)}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left"
                    >
                      <span className="font-display text-[16px] font-bold text-[#17223B]">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-[#351080] transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p className="border-t border-[#17223B]/8 pb-4 pt-3 pr-6 text-[14.5px] leading-[1.68] text-[#17223B]/75">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          BAGIAN 3: KARIR (TERPISAH DARI LEADS NASABAH)
          ==================================================================== */}
      <section
        id="corp-karir"
        className="scroll-mt-24 border-t border-[#17223B]/10 bg-white py-16 sm:py-20"
      >
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="max-w-[760px]">
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#351080]">
              {SITE_CONTENT.marketingCareers.eyebrow}
            </div>
            <h2 className="mt-2.5 font-display text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[#17223B] sm:text-[38px]">
              {SITE_CONTENT.marketingCareers.headline}
            </h2>
            <p className="mt-3.5 text-[15.5px] leading-[1.7] text-[#17223B]/75">
              {SITE_CONTENT.marketingCareers.summary}
            </p>
          </div>

          {/* Arah Pembinaan Jaringan 3 Tahun (1.000 -> 4.000 -> 10.000 Indikatif) */}
          <div
            data-testid="corp-career-roadmap"
            className="mt-10 rounded-2xl bg-[#F6F5F2] p-6 lp-ring sm:p-8"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#078D67]">
                  Visi Pengembangan SDM Pemasaran
                </div>
                <h3 className="mt-1 font-display text-[21px] font-bold text-[#17223B] sm:text-[23px]">
                  {SITE_CONTENT.marketingCareers.visionHeadline}
                </h3>
              </div>
              <span className="text-[12.5px] font-semibold text-[#17223B]/60">
                Sasaran Strategis Bertahap
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 border-t border-[#17223B]/10 pt-6 md:grid-cols-3">
              {SITE_CONTENT.marketingCareers.stagedTargets.map((item, idx) => (
                <div
                  key={item.stage}
                  className={idx > 0 ? "md:border-l md:border-[#17223B]/10 md:pl-6" : ""}
                >
                  <div className="text-[12px] font-bold uppercase tracking-wider text-[#351080]">
                    {item.stage}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-[32px] font-extrabold leading-none text-[#17223B] tabular-nums">
                      {item.target}
                    </span>
                    <span className="text-[12.5px] font-semibold text-[#078D67]">{item.unit}</span>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-[1.6] text-[#17223B]/72">{item.focus}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 border-t border-[#17223B]/10 pt-3.5 text-[12px] leading-[1.55] text-[#17223B]/58">
              {SITE_CONTENT.marketingCareers.visionNote}
            </p>
          </div>

          {/* 3 Keunggulan Sistem untuk Tim */}
          <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
            {SITE_CONTENT.marketingCareers.advantages.map((adv) => (
              <div key={adv.no} className="rounded-xl bg-[#F6F5F2] p-5 lp-ring">
                <div className="font-display text-[12.5px] font-bold text-[#078D67]">{adv.no}</div>
                <h3 className="mt-1.5 font-display text-[17px] font-bold text-[#17223B]">
                  {adv.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-[1.65] text-[#17223B]/70">
                  {adv.description}
                </p>
              </div>
            ))}
          </div>

          {/* Posisi Terbuka + Penyusun Lamaran Karir */}
          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              {SITE_CONTENT.marketingCareers.positions.map((pos) => (
                <div key={pos.title} className="rounded-2xl border border-[#17223B]/10 bg-white p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-[20px] font-bold text-[#17223B]">
                      {pos.title}
                    </h3>
                    <span className="rounded-md bg-[#351080]/8 px-2.5 py-1 text-[12px] font-bold text-[#351080]">
                      {pos.type}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[14.5px] leading-[1.65] text-[#17223B]/75">
                    {pos.scope}
                  </p>
                  <ul className="mt-4 space-y-1.5 border-t border-[#17223B]/8 pt-3.5 text-[14px] text-[#17223B]/80">
                    {pos.requirements.map((req) => (
                      <li key={req} className="flex items-start gap-2.5">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#351080]" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-[#F6F5F2] p-6 lp-ring lg:col-span-5">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#351080]">
                Karir &amp; Rekrutmen
              </div>
              <h3 className="mt-1.5 font-display text-[20px] font-bold text-[#17223B]">
                Siapkan Ringkasan Lamaran Anda
              </h3>
              <p className="mt-1 text-[13.5px] leading-[1.55] text-[#17223B]/70">
                Jalur ini khusus lamaran karir (terpisah dari antrean pengajuan kredit nasabah).
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="corp-career-name"
                    className="block text-[13px] font-bold text-[#17223B]"
                  >
                    Nama Lengkap
                  </label>
                  <input
                    id="corp-career-name"
                    type="text"
                    value={careerName}
                    onChange={(e) => setCareerName(e.target.value)}
                    placeholder="Nama Anda"
                    className="mt-1 h-10 w-full rounded-lg bg-white px-3 text-[14.5px] text-[#17223B] lp-ring focus:outline-none focus:ring-2 focus:ring-[#351080]"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="corp-career-role"
                      className="block text-[13px] font-bold text-[#17223B]"
                    >
                      Posisi
                    </label>
                    <select
                      id="corp-career-role"
                      value={careerRole}
                      onChange={(e) => setCareerRole(e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg bg-white px-2.5 text-[14px] text-[#17223B] lp-ring focus:outline-none focus:ring-2 focus:ring-[#351080]"
                    >
                      <option value="Marketing Officer Cabang">Marketing Officer</option>
                      <option value="Sales Manager Wilayah">Sales Manager</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="corp-career-city"
                      className="block text-[13px] font-bold text-[#17223B]"
                    >
                      Kota Penempatan
                    </label>
                    <input
                      id="corp-career-city"
                      type="text"
                      list="corp-career-cities"
                      value={careerCity}
                      onChange={(e) => setCareerCity(e.target.value)}
                      placeholder="Contoh: MEDAN"
                      className="mt-1 h-10 w-full rounded-lg bg-white px-3 text-[14.5px] text-[#17223B] lp-ring focus:outline-none focus:ring-2 focus:ring-[#351080]"
                    />
                    <datalist id="corp-career-cities">
                      {allCities.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="corp-career-exp"
                    className="block text-[13px] font-bold text-[#17223B]"
                  >
                    Pengalaman Singkat
                  </label>
                  <input
                    id="corp-career-exp"
                    type="text"
                    value={careerExp}
                    onChange={(e) => setCareerExp(e.target.value)}
                    placeholder="Contoh: 2 tahun marketing kredit / perbankan"
                    className="mt-1 h-10 w-full rounded-lg bg-white px-3 text-[14.5px] text-[#17223B] lp-ring focus:outline-none focus:ring-2 focus:ring-[#351080]"
                  />
                </div>

                <a
                  href={careerWhatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="career-whatsapp-btn"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#078D67] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#056C4F]"
                >
                  <span>Kirim Lamaran via WhatsApp ({SITE_CONTENT.contact.contactPerson})</span>
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </a>

                <button
                  type="button"
                  data-testid="copy-career-draft-btn"
                  onClick={() => copyText(careerDraft, setCareerCopied)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-[13.5px] font-bold text-[#351080] lp-ring transition-colors hover:bg-[#EDE9F8]"
                >
                  {careerCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>
                    {careerCopied
                      ? "Format Lamaran Tersalin ke Clipboard"
                      : "Salin Format Lamaran ke Clipboard"}
                  </span>
                </button>

                <div className="border-t border-[#17223B]/10 pt-2.5 text-[12px] leading-[1.55] text-[#17223B]/65">
                  Kontak resmi Rekrutmen PT KEN:{" "}
                  <a
                    href={SITE_CONTENT.contact.whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#17223B] hover:text-[#351080] hover:underline"
                  >
                    {formatPendingField(
                      SITE_CONTENT.marketingCareers.hrContactDisplay,
                      "Kantor Wilayah & Cabang Terdekat di 29 Kota Layanan"
                    )}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          BAGIAN 4: MITRA & INVESTASI (BANK MITRA, KOPERASI & INVESTOR)
          ==================================================================== */}
      <section
        id="corp-mitra"
        className="scroll-mt-24 border-t border-[#17223B]/10 bg-[#F6F5F2] py-16 sm:py-20"
      >
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="max-w-[800px]">
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#078D67]">
              {SITE_CONTENT.investorRelations.eyebrow}
            </div>
            <h2 className="mt-2.5 font-display text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[#17223B] sm:text-[38px]">
              {SITE_CONTENT.investorRelations.headline}
            </h2>
            <p className="mt-3.5 text-[15.5px] leading-[1.7] text-[#17223B]/75">
              {SITE_CONTENT.investorRelations.summary}
            </p>
          </div>

          {/* 4 Pilar Kemitraan & Tata Kelola — Kartu Putih Seimbang 2x2 */}
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {SITE_CONTENT.investorRelations.pillars.map((p) => (
              <div
                key={p.no}
                className="rounded-xl border-t-[3px] border-t-[#351080] bg-white p-6 lp-ring"
              >
                <div className="font-display text-[12.5px] font-bold text-[#078D67]">
                  PILAR {p.no}
                </div>
                <h3 className="mt-1.5 font-display text-[19px] font-bold text-[#17223B]">
                  {p.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-[1.68] text-[#17223B]/75">
                  {p.description}
                </p>
              </div>
            ))}
          </div>

          {/* Portofolio Ekosistem PT KEN (Flagship + 5 Kapabilitas Bertahap) */}
          <div data-testid="corp-ken-portfolio" className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-[700px]">
                <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#351080]">
                  Arah Portofolio • PT Kolaborasi Ekosistem Nusantara
                </div>
                <h3 className="mt-1.5 font-display text-[23px] font-bold text-[#17223B] sm:text-[28px]">
                  Satu Perusahaan, Portofolio yang Saling Menguatkan
                </h3>
              </div>
              <p className="max-w-[420px] text-[13px] leading-[1.6] text-[#17223B]/65">
                Layanan Pensiunan menjadi prioritas pengembangan utama (<em>flagship</em>), didukung
                lima kapabilitas lintas sektor yang dibangun bertahap.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SITE_CONTENT.investorRelations.ecosystemPortfolio.map((unit) => (
                <div
                  key={unit.title}
                  className={`rounded-xl p-5 ${
                    unit.isFlagship
                      ? "border-t-[3px] border-t-[#351080] bg-[#F2EEFA]/85 ring-1 ring-[#351080]/20"
                      : "border-t-2 border-t-[#17223B]/20 bg-white lp-ring"
                  }`}
                >
                  <div
                    className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
                      unit.isFlagship ? "text-[#351080]" : "text-[#078D67]"
                    }`}
                  >
                    {unit.isFlagship ? "UNIT UTAMA • FLAGSHIP" : `KAPABILITAS ${unit.code}`}
                  </div>
                  <h4 className="mt-1.5 font-display text-[17px] font-bold text-[#17223B]">
                    {unit.title}
                  </h4>
                  <p className="mt-1.5 text-[13.5px] leading-[1.6] text-[#17223B]/72">
                    {unit.detail}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-[12px] leading-[1.6] text-[#17223B]/58">
              {SITE_CONTENT.investorRelations.portfolioCaveat}
            </p>
          </div>

          {/* 4 Tahap Ekspansi Terukur (Staged Growth) */}
          <div className="mt-8 rounded-2xl bg-white p-6 lp-ring sm:p-8">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#078D67]">
              Disiplin Pertumbuhan Bertahap (Staged Growth)
            </div>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SITE_CONTENT.investorRelations.growthStages.map((stg) => (
                <div key={stg.no} className="border-t-2 border-[#17223B]/15 pt-3.5">
                  <div className="font-display text-[12px] font-extrabold text-[#351080]">
                    TAHAP {stg.no}
                  </div>
                  <div className="mt-1 font-display text-[16.5px] font-bold text-[#17223B]">
                    {stg.name}
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-[1.6] text-[#17223B]/70">
                    {stg.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Blok Eksekutif Kemitraan Bank & Investor */}
          <div className="mt-10 rounded-2xl bg-[#17223B] p-7 text-slate-200 sm:p-10">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#34D399]">
                  Korespondensi Direksi &amp; Kemitraan Strategis
                </div>
                <h3 className="mt-2.5 font-display text-[24px] font-bold leading-[1.2] text-white sm:text-[28px]">
                  Diskusi Investasi, Ekspansi Wilayah, atau Kemitraan Perbankan.
                </h3>
                <p className="mt-3 text-[14.5px] leading-[1.68] text-slate-300">
                  Kami terbuka untuk pertemuan bersama perbankan mitra, lembaga jasa keuangan
                  nasional, serta investor institusional. Informasi korporasi dan data pendukung
                  tersedia melalui korespondensi resmi.
                </p>
                <div className="mt-5 space-y-1.5 text-[13px] text-slate-300">
                  <div>
                    Kontak Resmi PT KEN:{" "}
                    <a
                      href={SITE_CONTENT.contact.whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-white hover:text-[#34D399] hover:underline"
                    >
                      {formatPendingField(
                        SITE_CONTENT.investorRelations.irContactDisplay,
                        "Sekretariat Direksi & Koordinator 7 Kantor Wilayah"
                      )}
                    </a>
                  </div>
                  <div>
                    Kantor:{" "}
                    <a
                      href={SITE_CONTENT.contact.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-200 hover:text-[#34D399] hover:underline"
                    >
                      {SITE_CONTENT.contact.headOfficeShort} (Buka Maps ↗)
                    </a>
                  </div>
                </div>
                <p className="mt-5 border-t border-white/12 pt-4 text-[12px] leading-[1.6] text-slate-400">
                  {SITE_CONTENT.investorRelations.investmentDisclaimer}
                </p>
              </div>

              <div className="space-y-3 lg:col-span-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="corp-inv-name"
                      className="block text-[12.5px] font-semibold text-slate-300"
                    >
                      Nama &amp; Jabatan
                    </label>
                    <input
                      id="corp-inv-name"
                      type="text"
                      value={invName}
                      onChange={(e) => setInvName(e.target.value)}
                      placeholder="Nama Anda"
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-[14px] text-white placeholder:text-slate-400 focus:border-[#34D399] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="corp-inv-org"
                      className="block text-[12.5px] font-semibold text-slate-300"
                    >
                      Institusi / Perusahaan
                    </label>
                    <input
                      id="corp-inv-org"
                      type="text"
                      value={invOrg}
                      onChange={(e) => setInvOrg(e.target.value)}
                      placeholder="Nama Bank / Dana Investasi"
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-[14px] text-white placeholder:text-slate-400 focus:border-[#34D399] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="corp-inv-topic"
                    className="block text-[12.5px] font-semibold text-slate-300"
                  >
                    Agenda Pembicaraan
                  </label>
                  <select
                    id="corp-inv-topic"
                    value={invTopic}
                    onChange={(e) => setInvTopic(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#1E2C4A] px-3 text-[14px] text-white focus:border-[#34D399] focus:outline-none"
                  >
                    <option value="Permintaan Profil Perusahaan & Diskusi Direksi">
                      Permintaan Profil Perusahaan &amp; Diskusi Direksi
                    </option>
                    <option value="Kemitraan Penyaluran Bank / Koperasi">
                      Kemitraan Penyaluran Bank / Koperasi
                    </option>
                    <option value="Diskusi Investasi & Ekspansi Wilayah">
                      Diskusi Investasi &amp; Ekspansi Wilayah
                    </option>
                  </select>
                </div>

                <a
                  href={investorWhatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="investor-whatsapp-btn"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#078D67] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#056C4F]"
                >
                  <span>Hubungi via WhatsApp ({SITE_CONTENT.contact.contactPerson})</span>
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </a>

                <button
                  type="button"
                  data-testid="copy-investor-draft-btn"
                  onClick={() => copyText(investorDraft, setInvCopied)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-white/20"
                >
                  {invCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>
                    {invCopied
                      ? "Format Permintaan Diskusi Tersalin"
                      : "Salin Format Permintaan Diskusi"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          LOKASI KANTOR RESMI (GOOGLE MAPS INTERAKTIF) & FOOTER KORPORAT
          ==================================================================== */}
      <footer className="border-t border-[#17223B]/12 bg-white py-14 text-[#17223B]/75">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          {/* Bagian Peta Lokasi Kantor Resmi Google Maps */}
          <div
            data-testid="corp-office-map-section"
            className="grid grid-cols-1 items-center gap-8 border-b border-[#17223B]/10 pb-12 lg:grid-cols-12 lg:gap-10"
          >
            <div className="lg:col-span-5">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#078D67]">
                Lokasi Kantor &amp; Kontak Resmi
              </div>
              <h2 className="mt-2 font-display text-[24px] font-bold leading-[1.2] text-[#17223B] sm:text-[28px]">
                Temukan Kantor Kami di Google Maps
              </h2>
              <p className="mt-3 text-[14.5px] leading-[1.7] text-[#17223B]/75">
                {SITE_CONTENT.contact.headOfficeAddress}
              </p>

              <div className="mt-4 space-y-1.5 border-t border-[#17223B]/10 pt-4 text-[13.5px]">
                <div>
                  Kontak Resmi (WhatsApp):{" "}
                  <a
                    href={SITE_CONTENT.contact.whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="corp-footer-wa-link"
                    className="font-bold text-[#078D67] hover:underline"
                  >
                    {SITE_CONTENT.contact.whatsappDisplay}
                  </a>
                </div>
                <div>
                  Jam Operasional:{" "}
                  <strong className="text-[#17223B]">{SITE_CONTENT.contact.operationalHours}</strong>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href={SITE_CONTENT.contact.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="corp-footer-maps-link"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#351080] px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-[#5720B8]"
                >
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>Buka Petunjuk Arah Google Maps</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
                <a
                  href={SITE_CONTENT.contact.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#F6F5F2] px-4 text-[13.5px] font-bold text-[#17223B] lp-ring transition-colors hover:bg-[#EDE9F8] hover:text-[#351080]"
                >
                  <span>Chat Peni (WhatsApp)</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="overflow-hidden rounded-2xl border border-[#17223B]/12 bg-[#F6F5F2]">
                <iframe
                  data-testid="corp-google-maps-iframe"
                  title="Peta Lokasi Kantor PT Kolaborasi Ekosistem Nusantara (KEN) - Layanan Pensiunan"
                  src="https://www.google.com/maps?q=Rumah+Makan+Mesran,+Jalan+Sisingamangaraja+No.+11,+Setia+Negara,+Siantar+Sitalasari,+Kota+Pematangsiantar,+Sumatera+Utara+21137&hl=id&z=17&output=embed"
                  className="block h-[280px] w-full border-0 sm:h-[340px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          </div>

          {/* Catatan Kepatuhan & Identitas Badan Hukum */}
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
            <div className="md:col-span-8">
              <div className="flex flex-wrap items-center gap-3">
                <img
                  src={SITE_CONTENT.brand.logoHorizontal}
                  alt="Layanan Pensiunan"
                  className="h-8 w-auto object-contain"
                />
                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#351080]">
                  • {SITE_CONTENT.companyProfile.parentCompany}
                </span>
              </div>
              <p className="mt-2.5 max-w-[680px] text-[12.5px] leading-[1.65] text-[#17223B]/62">
                {SITE_CONTENT.companyProfile.disclaimer}{" "}
                {formatPendingField(
                  SITE_CONTENT.contact.partnerDisclosure,
                  "Penyaluran pembiayaan dilaksanakan langsung oleh Bank Mitra dan lembaga jasa keuangan yang bekerja sama di masing-masing wilayah layanan."
                )}
              </p>
            </div>

            <div className="text-[12.5px] md:col-span-4 md:text-right">
              <div className="font-bold text-[#17223B]">
                {SITE_CONTENT.companyProfile.legalEntity}
              </div>
              <div className="mt-0.5 text-[#17223B]/60">
                Unit Utama: Layanan Pensiunan (7 Kanwil • Pusat &amp; 29 Kota Cabang)
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#17223B]/10 pt-5 text-[12.5px] text-[#17223B]/55">
            <span>
              © {new Date().getFullYear()} Layanan Pensiunan —{" "}
              {SITE_CONTENT.companyProfile.parentCompany}. Kepatuhan Perlindungan Data Pribadi (UU
              PDP).
            </span>
            <button
              type="button"
              onClick={onBackToCompanion}
              className="font-bold text-[#351080] hover:underline"
            >
              ← Kembali ke Halaman Utama
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
