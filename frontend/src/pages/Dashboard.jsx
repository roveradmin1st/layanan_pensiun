import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
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
  CheckCircle2,
  FileCheck2,
  AlertCircle
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isAdmin, fmtDateTime, fmtDate, rp } from "../lib/format";
import { StatCard, PageHeader, CtaButton, Empty, StatusBadge, DashboardSkeleton } from "../components/common";
import { Button } from "../components/ui/button";

const Panel = ({ title, subtitle, action, children, className = "", testid }) => (
  <section className={`lp-card p-4 sm:p-6 ${className}`} data-testid={testid}>
    <div className="mb-4 sm:mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-sm sm:text-base font-bold text-[#17223B]">{title}</h2>
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
    <div className="h-[250px] sm:h-[280px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -10, right: 8, top: 12 }}>
          <CartesianGrid stroke="#EEF0F5" vertical={false} />
          <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `Rp${Math.round(v / 1000000)}jt`}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(val) => rp(val)}
            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="booking" name="Realisasi Booking" fill="#078D67" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="revenue" name="Estimasi Gross Fee (4%)" fill="#5720B8" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="insentif" name="Insentif PAID" fill="#F28A19" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AdminDashboard({ d }) {
  const s = d.by_status || { baru: 0, follow_up: 0, proses: 0, berhasil: 0, gagal: 0 };
  const fin = d.financials || {
    total_booking_volume: 0,
    est_gross_revenue: 0,
    total_paid_incentives: 0,
    net_company_profit: 0,
    pipeline_value: 0,
    booking_count: 0,
    pending_claims_count: 0
  };

  return (
    <>
      <PageHeader
        eyebrow="Command Center Eksekutif"
        title="Kinerja Profit & Realisasi Bisnis"
        desc="Pantau omzet pembiayaan riil, estimasi pendapatan fee perusahaan, insentif marketing terbayar (PAID), dan akuntabilitas kinerja tim."
        actions={
          <>
            <Button asChild variant="outline" data-testid="quick-import-button">
              <Link to="/impor">
                <Upload className="mr-2 h-4 w-4" />
                Impor Leads
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-[#078D67] text-[#078D67] hover:bg-emerald-50" data-testid="quick-claims-button">
              <Link to="/klaim">
                <Award className="mr-2 h-4 w-4" />
                Klaim Insentif ({fin.pending_claims_count || 0})
              </Link>
            </Button>
            <CtaButton asChild data-testid="quick-calc-button">
              <Link to="/kalkulator">
                <Calculator className="mr-2 h-4 w-4" />
                Buat Simulasi
              </Link>
            </CtaButton>
          </>
        }
      />

      {/* TIER 1: FINANCIAL & EXECUTIVE STAT CARDS */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total Realisasi Booking"
          value={rp(fin.total_booking_volume)}
          hint={`${fin.booking_count || 0} Akad Pembiayaan Berhasil`}
          tone="green"
          testid="stat-booking-volume"
        />
        <StatCard
          label="Estimasi Gross Fee (4%)"
          value={rp(fin.est_gross_revenue)}
          hint="Fee Bruto Kemitraan Bank"
          tone="royal"
          testid="stat-gross-revenue"
        />
        <StatCard
          label="Insentif Terbayar (PAID)"
          value={rp(fin.total_paid_incentives)}
          hint={`${fin.pending_claims_count || 0} Klaim Menunggu Tindakan`}
          tone="orange"
          testid="stat-paid-incentives"
        />
        <StatCard
          label="Laba Bersih Perusahaan"
          value={rp(fin.net_company_profit)}
          hint="Gross Fee - Insentif PAID"
          tone="navy"
          testid="stat-net-profit"
        />
        <StatCard
          label="Pipeline Aktif di Bank"
          value={rp(fin.pipeline_value)}
          hint="Potensi Plafond dalam Verifikasi"
          tone="purple"
          testid="stat-pipeline-value"
        />
      </div>

      {/* TIER 1.5: OPERATIONAL QUICK STATS */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Database Leads</p>
            <p className="text-lg font-bold text-slate-900 lp-num mt-0.5">{d.total_leads}</p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{d.unassigned} belum ditugaskan</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Prospek Berjalan</p>
            <p className="text-lg font-bold text-slate-900 lp-num mt-0.5">{s.follow_up + s.proses}</p>
          </div>
          <span className="text-xs text-amber-600 font-semibold">{s.proses} di proses bank</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Konversi Berhasil</p>
            <p className="text-lg font-bold text-[#078D67] lp-num mt-0.5">{s.berhasil}</p>
          </div>
          <span className="text-xs text-[#078D67] font-semibold">Tembus Booking</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Simulasi Dibuat</p>
            <p className="text-lg font-bold text-slate-900 lp-num mt-0.5">{d.total_simulations}</p>
          </div>
          <Link to="/simulasi" className="text-xs text-[#5720B8] font-semibold hover:underline">
            Lihat riwayat
          </Link>
        </div>
      </div>

      {/* TIER 2: CHARTS & PORTFOLIO BREAKDOWN */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title="Tren Realisasi Omzet & Insentif (6 Bulan)"
          subtitle="Perbandingan volume booking pencairan, gross fee perusahaan, dan insentif marketing PAID."
          className="xl:col-span-2"
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
            <ul className="divide-y divide-slate-100">
              {d.bank_breakdown.map((b) => (
                <li key={b.name} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-900 truncate" title={b.name}>{b.name}</p>
                    <p className="text-slate-400 mt-0.5">{b.count} pembiayaan disetujui</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#078D67] lp-num">{rp(b.volume)}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {fin.total_booking_volume > 0 ? Math.round((b.volume / fin.total_booking_volume) * 100) : 0}% portofolio
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Belum ada data pencairan bank mitra" />
          )}

          {d.branch_breakdown?.length > 1 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-2">Kontribusi per Cabang:</p>
              <div className="flex flex-wrap gap-2">
                {d.branch_breakdown.map((br) => (
                  <span key={br.branch} className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    <b>{br.branch}:</b> {rp(br.volume)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* TIER 3: MARKETING LEADERBOARD & ACCOUNTABILITY TABLE */}
      <div className="mt-6">
        <Panel
          title="Leaderboard Kinerja Marketing (Profit & Produktivitas Riil)"
          subtitle="Evaluasi siapa yang benar-benar menghasilkan closing booking nyata dan profit bagi perusahaan."
          action={
            <Link to="/pengguna" className="text-xs font-semibold text-[#5720B8] hover:underline">
              Kelola Petugas
            </Link>
          }
          testid="marketing-leaderboard-panel"
        >
          {d.marketing_leaderboard?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 pr-3">Petugas Marketing</th>
                    <th className="py-2.5 px-3">Cabang</th>
                    <th className="py-2.5 px-3 text-center">Leads / Sim</th>
                    <th className="py-2.5 px-3 text-right">Realisasi Booking</th>
                    <th className="py-2.5 px-3 text-right">Insentif PAID</th>
                    <th className="py-2.5 px-3 text-center">Rasio Sukses</th>
                    <th className="py-2.5 pl-3 text-center">Status Performa</th>
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
                      <tr key={m.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 pr-3 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-[#17223B]">{m.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">{m.branch}</td>
                        <td className="py-3 px-3 text-center text-slate-600 lp-num">
                          {m.assigned} <span className="text-slate-400">/</span> {m.simulasi}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#078D67] lp-num">
                          {m.booking_volume > 0 ? rp(m.booking_volume) : <span className="text-slate-400 font-normal">Rp 0</span>}
                          {m.booking_count > 0 && (
                            <span className="block text-[10px] text-slate-400 font-normal">{m.booking_count} berkas cair</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#5720B8] lp-num">
                          {m.paid_incentives > 0 ? rp(m.paid_incentives) : <span className="text-slate-400 font-normal">Rp 0</span>}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-700 lp-num">
                          {m.conversion_rate}%
                        </td>
                        <td className="py-3 pl-3 text-center">
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
      </div>

      {/* TIER 4: RECENT AUDIT & IMPORTS */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
                  <span className="shrink-0 text-xs font-bold text-[#078D67] bg-emerald-50 px-2 py-1 rounded-md">
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
    </>
  );
}

function MarketingDashboard({ d, user }) {
  const s = d.by_status || { baru: 0, follow_up: 0, proses: 0, berhasil: 0, gagal: 0 };
  const fin = d.financials || { total_booking_volume: 0, total_paid_incentives: 0, pipeline_value: 0 };

  return (
    <>
      <PageHeader
        eyebrow="Dashboard Marketing"
        title={`Selamat bekerja, ${user.name.split(" ")[0]}`}
        desc="Leads yang ditugaskan kepada Anda, realisasi pencairan, dan jadwal tindak lanjut hari ini."
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
      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3 mb-4">
        <StatCard
          label="Total Booking Cair Saya"
          value={rp(fin.total_booking_volume)}
          hint="Realisasi Akad Pembiayaan"
          tone="green"
          testid="stat-my-booking"
        />
        <StatCard
          label="Insentif Saya Terbayar (PAID)"
          value={rp(fin.total_paid_incentives)}
          hint="Dana Insentif Sudah Diterima"
          tone="royal"
          testid="stat-my-paid"
        />
        <StatCard
          label="Potensi Pipeline Saya"
          value={rp(fin.pipeline_value)}
          hint="Sedang Diproses di Bank"
          tone="orange"
          testid="stat-my-pipeline"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Leads Saya" value={d.total_leads} icon={Users} tone="purple" testid="stat-my-leads" />
        <StatCard label="Leads Baru" value={s.baru} icon={Inbox} tone="royal" testid="stat-new-leads" />
        <StatCard label="Follow-up Hari Ini" value={d.follow_up_today} icon={CalendarClock} tone="orange" testid="stat-followup-today" />
        <StatCard label="Dalam Proses" value={s.follow_up + s.proses} icon={PhoneCall} tone="navy" testid="stat-in-progress" />
        <StatCard label="Berhasil" value={s.berhasil} icon={BadgeCheck} tone="green" testid="stat-converted" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
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
    </>
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
