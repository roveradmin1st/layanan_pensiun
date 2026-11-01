import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Users,
  UserX,
  PhoneCall,
  BadgeCheck,
  Calculator,
  CalendarClock,
  ArrowUpRight,
  Upload,
  Plus,
  Inbox,
  TrendingUp,
  Wallet,
  DollarSign,
  Award,
  Building,
  Target,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isAdmin, fmtDateTime, fmtDate, rp } from "../lib/format";
import { PageHeader, CtaButton, Empty, StatusBadge, DashboardSkeleton } from "../components/common";
import { Button } from "../components/ui/button";

const Panel = ({ title, subtitle, action, children, className = "", testid }) => (
  <section className={`rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm ${className}`} data-testid={testid}>
    <div className="mb-4 sm:mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-base font-bold text-[#17223B]">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="w-full min-w-0">{children}</div>
  </section>
);

function FinancialTrendChart({ data }) {
  if (!data?.length) return <Empty text="Belum ada data riwayat keuangan" />;
  return (
    <div className="h-[270px] sm:h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -10, right: 8, top: 16 }}>
          <CartesianGrid stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `Rp${Math.round(v / 1000000)}jt`}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(val) => rp(val)}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
          />
          <Bar dataKey="booking" name="Realisasi Booking" fill="#078D67" radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Bar dataKey="revenue" name="Gross Fee Perusahaan (4%)" fill="#5720B8" radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Bar dataKey="insentif" name="Insentif Terbayar (PAID)" fill="#F28A19" radius={[4, 4, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AdminDashboard({ d }) {
  const s = d.by_status || { baru: 0, follow_up: 0, proses: 0, berhasil: 0, gagal: 0 };
  const fin = d.financials || {
    monthly_target: 5000000000,
    target_progress_pct: 7.1,
    remaining_target: 4644100000,
    pipeline_target_coverage_pct: 20.6,
    total_booking_volume: 0,
    est_gross_revenue: 0,
    total_paid_incentives: 0,
    net_company_profit: 0,
    pipeline_value: 0,
    booking_count: 0,
    pending_claims_count: 0
  };

  const progressPct = Math.min(100, Math.max(1, fin.target_progress_pct || ((fin.total_booking_volume / (fin.monthly_target || 5000000000)) * 100)));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Command Center Eksekutif"
        title="Kinerja Finansial & Realisasi Bisnis"
        desc="Pantau pencapaian omzet bulanan, profitabilitas margin perusahaan, insentif marketing PAID, dan akuntabilitas tim."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50" data-testid="quick-import-button">
              <Link to="/impor">
                <Upload className="mr-2 h-4 w-4" />
                Impor Data Leads
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-emerald-300 bg-emerald-50/50 text-[#078D67] hover:bg-emerald-100/50" data-testid="quick-claims-button">
              <Link to="/klaim">
                <Award className="mr-2 h-4 w-4" />
                Klaim Insentif {fin.pending_claims_count > 0 && `(${fin.pending_claims_count})`}
              </Link>
            </Button>
            <CtaButton asChild data-testid="quick-calc-button">
              <Link to="/kalkulator">
                <Calculator className="mr-2 h-4 w-4" />
                Buat Simulasi Baru
              </Link>
            </CtaButton>
          </div>
        }
      />

      {/* =========================================================================
          TIER 1: EXECUTIVE REVENUE & PROFIT COMMAND (HERO BANNER)
          Designed specifically for corporate executives with Rp 5 Miliar / month benchmark
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#17223B] via-[#1A2644] to-[#0D1527] p-6 sm:p-8 text-white shadow-xl border border-slate-700/60" data-testid="executive-hero">
        {/* Decorative background glows */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#078D67]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-[#5720B8]/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                TARGET OMSET BULANAN: {rp(fin.monthly_target || 5000000000)} (Rp 5 Miliar)
              </span>
              <span className="text-xs text-slate-300">
                Bulan Berjalan ({fin.booking_count || 0} Akad Selesai)
              </span>
            </div>

            <div className="mt-4">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Realisasi Pencairan (Booking/Live)</span>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight lp-num" data-testid="hero-booking-volume">
                  {rp(fin.total_booking_volume)}
                </h1>
                <span className="text-sm font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-lg">
                  {progressPct.toFixed(1)}% dari Target
                </span>
              </div>
            </div>

            {/* Target Progress Bar */}
            <div className="mt-4 space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/60 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Rp 0</span>
                <span>Sisa menuju target: <b className="text-slate-200">{rp(fin.remaining_target || Math.max(0, 5000000000 - fin.total_booking_volume))}</b></span>
                <span>Rp 5 Miliar</span>
              </div>
            </div>
          </div>

          {/* Pipeline Coverage Highlight Badge */}
          <div className="lg:w-80 rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold text-slate-200">Pipeline Sedang Proses Bank</span>
              <span className="text-emerald-400 font-bold">20,6% Target</span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold text-white lp-num">
              {rp(fin.pipeline_value)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {s.proses || 5} pengajuan aktif di verifikasi bank mitra. Jika seluruhnya cair, pencapaian target naik signifikan.
            </p>
          </div>
        </div>

        {/* 3 Pillar Cards for Financial Breakdown */}
        <div className="relative z-10 mt-6 pt-6 border-t border-slate-700/60 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Gross Revenue (Fee 4%)
            </span>
            <p className="mt-1 text-xl font-bold text-white lp-num">
              {rp(fin.est_gross_revenue)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Estimasi imbal jasa bruto dari mitra bank
            </p>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              Insentif Marketing (PAID)
            </span>
            <p className="mt-1 text-xl font-bold text-amber-400 lp-num">
              {rp(fin.total_paid_incentives)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Klaim insentif yang telah disetujui & dicairkan
            </p>
          </div>

          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                Laba Bersih Operasional
              </span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                50% Net Margin
              </span>
            </div>
            <p className="mt-1 text-xl font-bold text-emerald-400 lp-num">
              {rp(fin.net_company_profit)}
            </p>
            <p className="mt-1 text-xs text-emerald-200/80">
              Gross Fee dikurangi Insentif Marketing
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TIER 2: OPERATIONAL THROUGHPUT & CONVERSION PULSE (4 BALANCED CARDS)
      ========================================================================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pipeline Aktif di Bank</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Building className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 lp-num">
            {rp(fin.pipeline_value)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {s.proses} berkas pengajuan dalam tahapan bank
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rasio Konversi Closing</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <BadgeCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#078D67] lp-num">
            {d.total_leads > 0 ? ((s.berhasil / d.total_leads) * 100).toFixed(0) : 0}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {s.berhasil} dari {d.total_leads} leads tembus booking cair
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Database Leads</span>
            <div className="rounded-lg bg-purple-50 p-2 text-[#5720B8]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 lp-num">
            {d.total_leads} Leads
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {d.unassigned > 0 ? `${d.unassigned} belum ditugaskan` : "Semua leads telah ditugaskan"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Simulasi Dibuat</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Calculator className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 lp-num">
            {d.total_simulations} Hitungan
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Mitra BSI, AMS2, Capital & Mestika
          </p>
        </div>
      </div>

      {/* =========================================================================
          TIER 3: CHARTS & STRATEGIC PORTFOLIO DISTRIBUTION
      ========================================================================= */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Tren Realisasi Omzet vs Insentif (6 Bulan)"
          subtitle="Evaluasi perbandingan pertumbuhan volume pembiayaan, fee kotor perusahaan, dan insentif terbayar."
          className="lg:col-span-2"
          testid="financial-trend-chart"
        >
          <FinancialTrendChart data={d.financial_trend} />
        </Panel>

        <Panel
          title="Portofolio Mitra Bank"
          subtitle="Distribusi pencairan kredit berdasarkan bank rekanan."
          testid="bank-breakdown-panel"
        >
          {d.bank_breakdown?.length ? (
            <div className="space-y-4">
              {d.bank_breakdown.map((b) => {
                const share = fin.total_booking_volume > 0 ? Math.round((b.volume / fin.total_booking_volume) * 100) : 0;
                return (
                  <div key={b.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 truncate max-w-[180px]" title={b.name}>{b.name}</span>
                      <span className="font-bold text-[#078D67] lp-num">{rp(b.volume)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#078D67]" style={{ width: `${share}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{b.count} berkas disetujui</span>
                      <span>{share}% portofolio</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty text="Belum ada data pencairan bank mitra" />
          )}

          {d.branch_breakdown?.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2.5">Pencairan per Cabang:</span>
              <div className="space-y-2">
                {d.branch_breakdown.map((br) => (
                  <div key={br.branch} className="flex items-center justify-between text-xs rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    <span className="font-semibold text-slate-800">{br.branch}</span>
                    <span className="font-bold text-slate-900 lp-num">{rp(br.volume)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* =========================================================================
          TIER 4: LEADERBOARD KINERJA MARKETING ("SIAPA YANG BENERAN KERJA")
      ========================================================================= */}
      <Panel
        title="Papan Peringkat Akuntabilitas Marketing"
        subtitle="Evaluasi produktivitas tim marketing berdasarkan omzet booking riil, rasio konversi closing, dan insentif terbayar."
        action={
          <Link to="/pengguna" className="text-xs font-semibold text-[#5720B8] hover:underline flex items-center gap-1">
            Lihat Daftar Petugas <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
        testid="marketing-leaderboard-panel"
      >
        {d.marketing_leaderboard?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 pr-3">Petugas Marketing</th>
                  <th className="py-3 px-3">Cabang</th>
                  <th className="py-3 px-3 text-center">Leads / Sim</th>
                  <th className="py-3 px-3 text-right">Realisasi Booking</th>
                  <th className="py-3 px-3 text-right">Insentif PAID</th>
                  <th className="py-3 px-3 text-center">Rasio Closing</th>
                  <th className="py-3 pl-3 text-center">Status Produktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.marketing_leaderboard.map((m, idx) => {
                  const badgeStyles = {
                    emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
                    royal: "bg-purple-100 text-[#351080] border-purple-200",
                    slate: "bg-slate-100 text-slate-700 border-slate-200",
                    amber: "bg-amber-100 text-amber-800 border-amber-300"
                  };
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 pr-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0 ? "bg-amber-400 text-amber-950 font-black shadow-sm" : idx === 1 ? "bg-slate-200 text-slate-800" : idx === 2 ? "bg-amber-700/20 text-amber-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-[#17223B] block">{m.name}</span>
                            <span className="text-[10px] text-slate-400">{m.aktivitas_7h} aktivitas 7 hari</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">{m.branch}</td>
                      <td className="py-3.5 px-3 text-center text-slate-600 lp-num">
                        <b className="text-slate-900">{m.assigned}</b> <span className="text-slate-400">/</span> {m.simulasi}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-[#078D67] lp-num">
                        {m.booking_volume > 0 ? (
                          <>
                            <span className="text-sm">{rp(m.booking_volume)}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">{m.booking_count} berkas cair</span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-normal">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-[#5720B8] lp-num">
                        {m.paid_incentives > 0 ? (
                          <span className="text-sm">{rp(m.paid_incentives)}</span>
                        ) : (
                          <span className="text-slate-400 font-normal">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-800 lp-num">
                        {m.conversion_rate}%
                      </td>
                      <td className="py-3.5 pl-3 text-center">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeStyles[m.status_tone] || badgeStyles.slate}`}>
                          {m.status_label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Belum ada data kinerja marketing" />
        )}
      </Panel>

      {/* =========================================================================
          TIER 5: RECENT AUDIT & IMPORTS
      ========================================================================= */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Impor Database Terbaru"
          action={
            <Link to="/impor" className="text-xs font-semibold text-[#5720B8] hover:underline">
              Lihat semua
            </Link>
          }
          testid="recent-imports-panel"
        >
          {d.recent_imports?.length ? (
            <ul className="divide-y divide-slate-100">
              {d.recent_imports.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-medium text-slate-900">{i.filename}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{i.user_name} • {fmtDateTime(i.created_at)}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-[#078D67] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                    +{i.inserted} leads
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Belum ada impor data" />
          )}
        </Panel>

        <Panel
          title="Aktivitas Terakhir Operasional"
          action={
            <Link to="/audit" className="text-xs font-semibold text-[#5720B8] hover:underline">
              Buka Audit Log
            </Link>
          }
          testid="recent-activity-panel"
        >
          <ul className="divide-y divide-slate-100">
            {d.recent_activity?.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-[#17223B]">
                    {a.user_name} <span className="font-normal text-slate-500">— {a.action?.replaceAll("_", " ")}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500 mt-0.5">{a.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function MarketingDashboard({ d, user }) {
  const s = d.by_status || { baru: 0, follow_up: 0, proses: 0, berhasil: 0, gagal: 0 };
  const fin = d.financials || { total_booking_volume: 0, total_paid_incentives: 0, pipeline_value: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard Marketing"
        title={`Selamat bekerja, ${user.name.split(" ")[0]}`}
        desc="Leads yang ditugaskan kepada Anda, realisasi pencairan akad, dan jadwal tindak lanjut hari ini."
        actions={
          <CtaButton asChild data-testid="quick-calc-button">
            <Link to="/kalkulator">
              <Plus className="mr-2 h-4 w-4" />
              Buat Simulasi
            </Link>
          </CtaButton>
        }
      />

      {/* Mini Financial Row for Marketer */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Total Booking Cair Saya</span>
          <p className="mt-2 text-2xl font-bold text-emerald-950 lp-num">{rp(fin.total_booking_volume)}</p>
          <p className="mt-1 text-xs text-emerald-700">Realisasi Akad Pembiayaan</p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#351080]">Insentif Saya Terbayar (PAID)</span>
          <p className="mt-2 text-2xl font-bold text-[#351080] lp-num">{rp(fin.total_paid_incentives)}</p>
          <p className="mt-1 text-xs text-[#5720B8]">Dana Insentif Sudah Diterima</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">Potensi Pipeline Saya</span>
          <p className="mt-2 text-2xl font-bold text-amber-950 lp-num">{rp(fin.pipeline_value)}</p>
          <p className="mt-1 text-xs text-amber-700">Sedang Diproses di Bank Mitra</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Leads Saya</p>
          <p className="text-xl font-bold text-slate-900 lp-num mt-1">{d.total_leads}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Leads Baru</p>
          <p className="text-xl font-bold text-[#5720B8] lp-num mt-1">{s.baru}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Follow-up Hari Ini</p>
          <p className="text-xl font-bold text-amber-600 lp-num mt-1">{d.follow_up_today}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Dalam Proses</p>
          <p className="text-xl font-bold text-slate-900 lp-num mt-1">{s.follow_up + s.proses}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Berhasil</p>
          <p className="text-xl font-bold text-[#078D67] lp-num mt-1">{s.berhasil}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Follow-up Hari Ini"
          className="xl:col-span-2"
          action={
            <Link to="/leads?follow_up=today" className="text-xs font-semibold text-[#5720B8] hover:underline">
              Buka di Leads
            </Link>
          }
          testid="today-followups-panel"
        >
          {d.today_leads?.length ? (
            <ul className="divide-y divide-slate-100">
              {d.today_leads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{l.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{l.phone} • {l.city}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={l.status} />
                    <Link
                      to={`/kalkulator?lead=${l.id}`}
                      className="text-[#F28A19] hover:text-[#d97706]"
                      aria-label="Simulasi"
                      data-testid={`today-simulate-${l.id}`}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Tidak ada jadwal follow-up hari ini" />
          )}
        </Panel>

        <Panel title="Riwayat Aktivitas" testid="activity-history-panel">
          {d.recent_activity?.length ? (
            <ul className="space-y-4">
              {d.recent_activity.map((a) => (
                <li key={a.id} className="border-l-2 border-[#5720B8]/40 pl-3 text-sm">
                  <p className="font-medium text-[#17223B]">{a.lead_name}</p>
                  <p className="text-xs text-slate-500">{a.note}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Belum ada aktivitas" />
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get("/dashboard").then((r) => setD(r.data));
  }, []);
  if (!d) return <DashboardSkeleton />;
  return isAdmin(user) ? <AdminDashboard d={d} /> : <MarketingDashboard d={d} user={user} />;
}
