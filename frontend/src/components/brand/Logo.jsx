import { COPYRIGHT_1, COPYRIGHT_2 } from "../../lib/format";

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

export const Copyright = ({ className = "" }) => (
  <div className={`text-center text-[11px] leading-relaxed text-slate-500 ${className}`} data-testid="app-copyright">
    <p className="font-semibold text-[#351080]">{COPYRIGHT_1}</p>
    <p>{COPYRIGHT_2}</p>
  </div>
);

