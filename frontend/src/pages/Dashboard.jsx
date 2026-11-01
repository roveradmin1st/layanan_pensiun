import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, UserX, PhoneCall, BadgeCheck, Calculator, CalendarClock, Loader2, ArrowUpRight, Upload, Plus, Inbox } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isAdmin, fmtDateTime, fmtDate } from "../lib/format";
import { StatCard, PageHeader, CtaButton, Empty, StatusBadge, DashboardSkeleton } from "../components/common";
import { Button } from "../components/ui/button";

const Panel = ({ title, action, children, className = "", testid }) => (
  <section className={`lp-card p-4 sm:p-6 ${className}`} data-testid={testid}>
    <div className="mb-4 sm:mb-5 flex items-center justify-between">
      <h2 className="font-display text-sm sm:text-base font-bold text-[#17223B]">{title}</h2>
      {action}
    </div>
    <div className="w-full min-w-0">{children}</div>
  </section>
);

function GrowthChart({ data }) {
  return (
    <div className="h-[240px] sm:h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="lpg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5720B8" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#5720B8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EEF0F5" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => d.slice(8, 10) + "/" + d.slice(5, 7)} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={4} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={fmtDate} contentStyle={{ borderRadius: 10, border: "1px solid #eee", fontSize: 12 }} />
          <Area type="monotone" dataKey="kumulatif" name="Total leads" stroke="#5720B8" strokeWidth={2} fill="url(#lpg)" />
          <Area type="monotone" dataKey="baru" name="Leads baru" stroke="#078D67" strokeWidth={2} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AdminDashboard({ d }) {
  const s = d.by_status;
  return (
    <>
      <PageHeader eyebrow="Dashboard Eksekutif" title="Ringkasan Operasional" desc="Pantau perkembangan database leads, produktivitas tim marketing, dan realisasi simulasi pembiayaan."
        actions={<>
          <Button asChild variant="outline" data-testid="quick-import-button"><Link to="/impor"><Upload className="mr-2 h-4 w-4" />Impor Leads</Link></Button>
          <CtaButton asChild data-testid="quick-calc-button"><Link to="/kalkulator"><Calculator className="mr-2 h-4 w-4" />Buat Simulasi</Link></CtaButton>
        </>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Leads" value={d.total_leads} icon={Users} tone="purple" testid="stat-total-leads" />
        <StatCard label="Belum Ditugaskan" value={d.unassigned} icon={UserX} tone="orange" testid="stat-unassigned" />
        <StatCard label="Ditindaklanjuti" value={s.follow_up + s.proses} icon={PhoneCall} tone="royal" testid="stat-in-progress" />
        <StatCard label="Berhasil Dikonversi" value={s.berhasil} icon={BadgeCheck} tone="green" testid="stat-converted" />
        <StatCard label="Total Simulasi" value={d.total_simulations} icon={Calculator} tone="navy" testid="stat-simulations" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Perkembangan Leads (30 hari)" className="xl:col-span-2" testid="leads-growth-chart"><GrowthChart data={d.growth} /></Panel>
        <Panel title="Aktivitas Marketing" testid="marketing-activity-panel">
          {d.marketing_stats.length ? (
            <>
              <div className="h-[150px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.marketing_stats} margin={{ left: -24 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                    <Bar dataKey="assigned" name="Ditugaskan" fill="#5720B8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="berhasil" name="Berhasil" fill="#078D67" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 divide-y">
                {d.marketing_stats.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div><p className="font-semibold text-[#17223B]">{m.name}</p><p className="text-xs text-slate-500">{m.branch}</p></div>
                    <div className="text-right text-xs text-slate-500 lp-num"><p><b className="text-[#17223B]">{m.assigned}</b> leads • <b className="text-[#078D67]">{m.berhasil}</b> berhasil</p><p>{m.aktivitas_7h} aktivitas / 7 hari</p></div>
                  </li>
                ))}
              </ul>
            </>
          ) : <Empty text="Belum ada akun marketing" />}
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Impor Terbaru" action={<Link to="/impor" className="text-xs font-semibold text-[#5720B8]">Lihat semua</Link>} testid="recent-imports-panel">
          {d.recent_imports.length ? (
            <ul className="divide-y">
              {d.recent_imports.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{i.filename}</p><p className="text-xs text-slate-500">{i.user_name} • {fmtDateTime(i.created_at)}</p></div>
                  <span className="shrink-0 text-xs font-semibold text-[#078D67]">+{i.inserted} leads</span>
                </li>
              ))}
            </ul>
          ) : <Empty text="Belum ada impor data" />}
        </Panel>
        <Panel title="Aktivitas Terakhir" action={<Link to="/audit" className="text-xs font-semibold text-[#5720B8]">Audit log</Link>} testid="recent-activity-panel">
          <ul className="divide-y">
            {d.recent_activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0"><p className="font-medium text-[#17223B]">{a.user_name} <span className="font-normal text-slate-500">— {a.action.replaceAll("_", " ")}</span></p><p className="truncate text-xs text-slate-500">{a.detail}</p></div>
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
  const s = d.by_status;
  return (
    <>
      <PageHeader eyebrow="Dashboard Marketing" title={`Selamat bekerja, ${user.name.split(" ")[0]}`} desc="Leads yang ditugaskan kepada Anda dan jadwal tindak lanjut hari ini."
        actions={<CtaButton asChild data-testid="quick-calc-button"><Link to="/kalkulator"><Plus className="mr-2 h-4 w-4" />Buat Simulasi</Link></CtaButton>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Leads Saya" value={d.total_leads} icon={Users} tone="purple" testid="stat-my-leads" />
        <StatCard label="Leads Baru" value={s.baru} icon={Inbox} tone="royal" testid="stat-new-leads" />
        <StatCard label="Follow-up Hari Ini" value={d.follow_up_today} icon={CalendarClock} tone="orange" testid="stat-followup-today" />
        <StatCard label="Dalam Proses" value={s.follow_up + s.proses} icon={PhoneCall} tone="navy" testid="stat-in-progress" />
        <StatCard label="Berhasil" value={s.berhasil} icon={BadgeCheck} tone="green" testid="stat-converted" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Follow-up Hari Ini" className="xl:col-span-2" action={<Link to="/leads?follow_up=today" className="text-xs font-semibold text-[#5720B8]">Buka di Leads</Link>} testid="today-followups-panel">
          {d.today_leads.length ? (
            <ul className="divide-y">
              {d.today_leads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div><p className="font-semibold">{l.name}</p><p className="text-xs text-slate-500">{l.phone} • {l.city}</p></div>
                  <div className="flex items-center gap-3"><StatusBadge status={l.status} />
                    <Link to={`/kalkulator?lead=${l.id}`} className="text-[#F28A19]" aria-label="Simulasi" data-testid={`today-simulate-${l.id}`}><ArrowUpRight className="h-4 w-4" /></Link></div>
                </li>
              ))}
            </ul>
          ) : <Empty text="Tidak ada jadwal follow-up hari ini" />}
        </Panel>
        <Panel title="Riwayat Aktivitas" testid="activity-history-panel">
          {d.recent_activity.length ? (
            <ul className="space-y-4">
              {d.recent_activity.map((a) => (
                <li key={a.id} className="border-l-2 border-[#5720B8]/30 pl-3 text-sm">
                  <p className="font-medium text-[#17223B]">{a.lead_name}</p>
                  <p className="text-xs text-slate-500">{a.note}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : <Empty text="Belum ada aktivitas" />}
        </Panel>
      </div>
      <Panel title="Perkembangan Leads Saya" className="mt-6"><GrowthChart data={d.growth} /></Panel>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/dashboard").then((r) => setD(r.data)); }, []);
  if (!d) return <DashboardSkeleton />;
  return isAdmin(user) ? <AdminDashboard d={d} /> : <MarketingDashboard d={d} user={user} />;
}

