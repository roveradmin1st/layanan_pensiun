import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { STATUS } from "../../lib/format";

export const StatusBadge = ({ status }) => {
  const s = STATUS[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span data-testid={`status-badge-${status}`} className={`inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
};

/**
 * Kartu ringkasan angka. Sengaja tanpa ikon berwarna agar tampilan tetap
 * tenang & korporat; aksen hanya berupa garis tipis di sisi kiri.
 */
export const StatCard = ({ label, value, tone = "purple", hint, testid }) => {
  const tones = {
    purple: "before:bg-[#351080]",
    royal: "before:bg-[#5720B8]",
    green: "before:bg-[#078D67]",
    orange: "before:bg-[#F28A19]",
    navy: "before:bg-[#17223B]",
  };
  return (
    <div
      className={`lp-card relative overflow-hidden p-4 before:absolute before:inset-y-0 before:left-0 before:w-[3px] sm:p-5 ${tones[tone] || tones.purple}`}
      data-testid={testid}
    >
      <p className="truncate text-xs font-medium text-slate-500 sm:text-[13px]">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 lp-num sm:mt-2 sm:text-[28px]" data-testid={testid && `${testid}-value`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
};

export const PageHeader = ({ eyebrow, title, desc, actions }) => (
  <div className="mb-5 flex flex-col gap-4 sm:mb-6 md:flex-row md:items-end md:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="lp-eyebrow mb-1.5">{eyebrow}</p>}
      <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl" data-testid="page-title">{title}</h1>
      {desc && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{desc}</p>}
    </div>
    {actions && (
      <div className="flex flex-col gap-2 xs:flex-row xs:flex-wrap md:shrink-0 [&>*]:w-full xs:[&>*]:w-auto">
        {actions}
      </div>
    )}
  </div>
);

export const Panel = ({ title, action, children, className = "", bodyClassName = "p-4 sm:p-5", testid }) => (
  <section className={`lp-card ${className}`} data-testid={testid}>
    {(title || action) && (
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="lp-section-title">{title}</h2>
        {action}
      </div>
    )}
    <div className={bodyClassName}>{children}</div>
  </section>
);

/** Bar filter: input & select menumpuk di mobile, sejajar di desktop. */
export const FilterBar = ({ children }) => (
  <div className="grid grid-cols-1 gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 sm:p-4 lg:flex lg:flex-wrap lg:items-center">
    {children}
  </div>
);

export const Pager = ({ page, pageSize, total, onPage, testid = "pager" }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2.5 text-xs text-slate-500 sm:px-4 sm:text-sm" data-testid={testid}>
      <span className="lp-num">
        {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} dari {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Halaman sebelumnya" data-testid={`${testid}-prev`}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[3.5rem] text-center lp-num">{page} / {pages}</span>
        <Button variant="outline" size="icon" className="h-9 w-9" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Halaman berikutnya" data-testid={`${testid}-next`}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const Empty = ({ text }) => <div className="px-4 py-10 text-center text-sm text-slate-400">{text}</div>;

export const Loading = () => (
  <div className="flex justify-center py-10">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#351080]" aria-label="Memuat" />
  </div>
);

export const CtaButton = ({ className = "", ...p }) => (
  <Button className={`bg-[#F28A19] text-white transition-colors hover:bg-[#DC7A0F] ${className}`} {...p} />
);

/* ---------------------------------------------------------------------------
 * Tampilan daftar responsif: tabel di >= md, kartu ringkas di < md.
 * ------------------------------------------------------------------------- */
export const DesktopTable = ({ children }) => <div className="hidden md:block">{children}</div>;

export const MobileList = ({ children }) => <div className="divide-y divide-slate-100 md:hidden">{children}</div>;

export const ListCard = ({ title, subtitle, badge, meta = [], leading, onClick, testid, footer }) => (
  <div
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
    className={`flex gap-3 px-4 py-3.5 ${onClick ? "cursor-pointer active:bg-slate-100 hover:bg-slate-50" : ""}`}
    data-testid={testid}
  >
    {leading && <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>{leading}</div>}
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {meta.length > 0 && (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {meta.filter(Boolean).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-slate-400">{k}</dt>
              <dd className="truncate font-medium text-slate-700 lp-num">{v ?? "-"}</dd>
            </div>
          ))}
        </dl>
      )}
      {footer}
    </div>
  </div>
);
