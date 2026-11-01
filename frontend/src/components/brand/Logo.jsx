import { COPYRIGHT_1, COPYRIGHT_2 } from "../../lib/format";
import { Building2 } from "lucide-react";

const SIZES = {
  horizontal: { xs: "h-9", sm: "h-11", md: "h-14", lg: "h-20" },
  vertical: { sm: "h-28", md: "h-40", lg: "h-56" },
};

export const Logo = ({ variant = "horizontal", size = "md", className = "", ...rest }) => (
  <img
    src={`/brand/layanan-pensiunan-logo-${variant}.png`}
    alt="LAYANAN PENSIUNAN — Solusi Kredit Pensiun"
    className={`lp-logo w-auto ${SIZES[variant][size]} ${className}`}
    draggable={false}
    {...rest}
  />
);

export const PartnerLogo = ({ bankKey, size = "md", className = "" }) => {
  const sizeMap = {
    xs: "h-7 w-7",
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-14 w-14",
  };
  const sz = sizeMap[size] || sizeMap.md;

  if (bankKey === "bsi_prapen") {
    return (
      <img
        src="/brand/logo-bsi.jpg"
        alt="BSI - Bank Syariah Indonesia • Swara Ganiyy Utama"
        className={`rounded-full border border-slate-200 bg-white object-contain shadow-xs shrink-0 ${sz} ${className}`}
      />
    );
  }

  if (bankKey === "bank_capital") {
    return (
      <img
        src="/brand/logo-dasa.jpg"
        alt="DASA CIPTA BERKARYA PEMATANGSIANTAR • PS3 CAPITAL"
        className={`rounded-full border border-slate-200 bg-white object-contain shadow-xs shrink-0 ${sz} ${className}`}
      />
    );
  }

  if (bankKey === "ams2") {
    return (
      <img
        src="/brand/logo-ams.png"
        alt="Koperasi Asia Madani Sejahtera (AMS2)"
        className={`rounded-full border border-slate-200 bg-white object-contain shadow-xs shrink-0 ${sz} ${className}`}
      />
    );
  }

  if (bankKey === "mandiri_taspen" || bankKey === "bank_mantap") {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-extrabold shadow-xs shrink-0 text-[10px] tracking-tight ${sz} ${className}`}
        title="Bank Mandiri Taspen"
      >
        MTP
      </div>
    );
  }

  if (bankKey === "bank_mnc") {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-extrabold shadow-xs shrink-0 text-[10px] tracking-tight ${sz} ${className}`}
        title="Bank MNC"
      >
        MNC
      </div>
    );
  }

  if (bankKey === "bank_bni") {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-extrabold shadow-xs shrink-0 text-[10px] tracking-tight ${sz} ${className}`}
        title="Bank BNI"
      >
        BNI
      </div>
    );
  }

  if (bankKey === "bank_mestika") {
    return (
      <img
        src="/brand/logo-mestika.png"
        alt="Tiga Bermuda Amanah • Bank Mestika (TBA-MSTK)"
        className={`rounded-full border border-slate-200 bg-white object-contain shadow-xs shrink-0 ${sz} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200 shrink-0 ${sz} ${className}`}
    >
      <Building2 className="h-4 w-4" />
    </div>
  );
};

export const Copyright = ({ className = "" }) => (
  <div className={`text-center text-[11px] leading-relaxed text-slate-500 ${className}`} data-testid="app-copyright">
    <p className="font-semibold text-slate-600">{COPYRIGHT_1}</p>
    {COPYRIGHT_2 ? <p>{COPYRIGHT_2}</p> : null}
  </div>
);

