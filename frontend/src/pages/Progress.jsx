import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Search, Loader2, Check, FileUp, FileText, AlertTriangle, AlertCircle } from "lucide-react";
import { api, errMsg, openFile } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { fmtDate, fmtDateTime, isAdmin, rp } from "../lib/format";
import { PageHeader, Pager, Empty, DesktopTable, MobileList, ListCard, FilterBar } from "../components/common";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

const STAGE_OPTS = [["", "Semua tahap"], ["upload_dokumen", "Upload Dokumen"], ["pengajuan_bank", "Pengajuan ke Bank"], ["verifikasi_bank", "Verifikasi Bank"],
  ["approval_bank", "Approval Bank"], ["penjadwalan_akad", "Penjadwalan Akad"], ["akad_nasabah", "Akad Nasabah"], ["booking_live", "Booking/Live"], ["ditolak", "Ditolak Bank"]];
const PARTY = { marketing: "Marketing", admin_ops: "Admin Operasional", super_admin: "Super Admin" };
const sel = "h-10 rounded-md border border-input bg-white px-3 text-sm";

export const PendingBadge = ({ app }) => {
  if (app.rejected) return <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">DITOLAK BANK</span>;
  const p = app.pending;
  if (!p && app.stage === "booking_live") {
    if (app.claim?.status === "PAID") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#078D67] px-2.5 py-0.5 text-xs font-bold text-white shadow-sm" data-testid="badge-booking-paid">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-200" />
          BOOKING • PAID
        </span>
      );
    }
    if (app.claim?.status) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#5720B8] px-2 py-0.5 text-xs font-semibold text-white">
          BOOKING • {app.claim.status}
        </span>
      );
    }
    return <span className="rounded-md bg-[#078D67] px-2 py-0.5 text-xs font-semibold text-white">BOOKING/LIVE</span>;
  }
  if (!p) return <span className="rounded-md bg-[#078D67]/10 px-2 py-0.5 text-xs font-semibold text-[#078D67]">Diproses bank</span>;
  const cls = p.type === "revisi" ? "bg-[#F28A19]/12 text-[#B5620A]" : p.type === "validate" ? "bg-red-50 text-red-700" : "bg-[#5720B8]/10 text-[#5720B8]";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{p.type.replace("_", " ").toUpperCase()} • {PARTY[p.party]}</span>;
};

export const StageTracker = ({ app }) => {
  const normalStages = (app.stages || []).filter((s) => s.key !== "ditolak");
  return (
    <div className="space-y-3" data-testid="stage-tracker">
      {app.rejected && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="font-bold text-red-800">Pengajuan Ditolak Bank</p>
            <p className="mt-0.5 text-red-700">{app.reject_reason || "Tidak ada rincian alasan penolakan."}</p>
          </div>
        </div>
      )}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {normalStages.map((s, i) => {
          const done = i < app.stage_index || (i === app.stage_index && s.key === "booking_live");
          const cur = i === app.stage_index && !done;
          return (
            <li
              key={s.key}
              className={`flex flex-col justify-between rounded-xl border p-2.5 text-xs transition ${
                done
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-800"
                  : cur
                  ? app.rejected
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-[#5720B8] bg-[#5720B8]/10 text-[#351080] shadow-sm"
                  : "border-slate-200 bg-slate-50/60 text-slate-400"
              }`}
              data-testid={`stage-${s.key}`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {done && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                <span className="truncate">{i + 1}. {s.label}</span>
              </div>
              <div className="mt-2 border-t border-slate-100/80 pt-1.5 text-[10px] leading-tight">
                {app.stage_data?.[s.key] ? (
                  <>
                    <p className="truncate font-medium text-slate-700" title={app.stage_data[s.key].by_name}>
                      {app.stage_data[s.key].by_name}
                    </p>
                    <p className="text-slate-400 mt-0.5">
                      {fmtDate(app.stage_data[s.key].date || app.stage_data[s.key].at)}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-400 font-normal">Belum diproses</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

function DocChecklist({ app, admin, canUpload, onChanged }) {
  const ref = useRef();
  const [target, setTarget] = useState(null);
  const upload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast.error("Format dokumen harus PDF"); return; }
    const fd = new FormData();
    fd.append("file", file);
    try { await api.post(`/applications/${app.id}/documents/${target}`, fd); toast.success("Dokumen diunggah"); onChanged(); } catch (e) { toast.error(errMsg(e)); } finally { ref.current.value = ""; }
  };
  const review = async (key, status) => {
    const note = status === "ditolak" ? window.prompt("Catatan revisi dokumen (wajib):") : "";
    if (status === "ditolak" && !note) return;
    try { await api.post(`/applications/${app.id}/documents/${key}/review`, { status, note }); toast.success(status === "ditolak" ? "Dokumen ditandai perlu revisi" : "Dokumen diterima"); onChanged(); } catch (e) { toast.error(errMsg(e)); }
  };
  const done = app.checklist.filter((d) => ["diunggah", "diterima"].includes(d.status)).length;
  return (
    <div data-testid="doc-checklist">
      <input ref={ref} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => upload(e.target.files[0])} data-testid="app-doc-file-input" />
      <p className="mb-2 text-xs text-slate-500" data-testid="doc-progress">
        Kelengkapan Berkas: <b className="font-semibold text-slate-800">{done}/{app.checklist.length}</b> dokumen (PDF)
      </p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {app.checklist.map((d) => (
          <li key={d.key} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid={`doc-row-${d.key}`}>
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-semibold text-[#17223B]">
                {d.label} <span className="text-[11px] font-normal text-slate-400">• {d.group}</span>
              </p>
              {d.filename ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <button
                    onClick={() => openFile(`/applications/${app.id}/documents/${d.key}`)}
                    className="flex max-w-[280px] items-center gap-1 truncate font-medium text-[#5720B8] hover:underline"
                    title={d.filename}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{d.filename}</span>
                  </button>
                  <span className="text-slate-400">•</span>
                  <span className="whitespace-nowrap">{fmtDateTime(d.uploaded_at)}</span>
                  {d.versions > 1 && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                      v{d.versions}
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-0.5 text-xs text-slate-400">Belum diunggah</p>
              )}
              {d.status === "ditolak" && <p className="mt-1 text-xs font-semibold text-red-600">Revisi: {d.note}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                d.status === "diterima"
                  ? "bg-[#078D67]/10 text-[#078D67]"
                  : d.status === "ditolak"
                  ? "bg-red-50 text-red-700"
                  : d.status
                  ? "bg-[#5720B8]/10 text-[#5720B8]"
                  : "bg-slate-100 text-slate-500"
              }`}>
                {d.status ? d.status.toUpperCase() : "KOSONG"}
              </span>
              {canUpload && (
                <Button size="sm" variant="outline" onClick={() => { setTarget(d.key); ref.current.click(); }} data-testid={`upload-${d.key}`} title="Unggah PDF" className="h-8 px-2.5">
                  <FileUp className="h-3.5 w-3.5" />
                </Button>
              )}
              {admin && d.status && app.stage === "upload_dokumen" && (
                <>
                  <Button size="sm" variant="ghost" className="h-8 text-[#078D67] hover:bg-emerald-50 px-2 font-medium" onClick={() => review(d.key, "diterima")} data-testid={`accept-${d.key}`}>
                    Terima
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:bg-red-50 px-2 font-medium" onClick={() => review(d.key, "ditolak")} data-testid={`reject-${d.key}`}>
                    Tolak
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionPanel({ app, user, onChanged }) {
  const [v, setV] = useState({ note: "", process_date: new Date().toISOString().slice(0, 10), ref_no: "", booking_date: "", credit_no: "" });
  const [busy, setBusy] = useState(false);
  const role = user.role, p = app.pending || {};
  const run = async (action, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try { await api.post(`/applications/${app.id}/action`, { action, ...v }); toast.success("Status pengajuan diperbarui"); setV({ ...v, note: "" }); onChanged(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const acts = [];
  const pre = app.stage === "upload_dokumen";
  if (app.rejected) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Ditolak bank: {app.reject_reason}</p>;
  if (pre && p.party === "marketing" && (role === "marketing" || isAdmin(user))) acts.push(["submit", "Ajukan untuk Pemeriksaan", "bg-[#351080]"]);
  if (isAdmin(user) && pre && !["validate", "pemeriksaan_validate"].includes(p.type)) acts.push(["request_revision", "Kembalikan ke Marketing (Revisi)", "bg-[#F28A19]"]);
  if (isAdmin(user) && pre && p.party === "admin_ops" && p.type === "pemeriksaan") acts.push(["forward", `Teruskan ke ${app.bank_name}`, "bg-[#078D67]", `Teruskan pengajuan ke ${app.bank_name}?`]);
  if (role === "super_admin" && !["validate", "pemeriksaan_validate"].includes(p.type) && app.stage !== "booking_live") acts.push(["validate", "Validate (kembalikan ke Admin Ops)", "bg-red-600"]);
  if (role === "admin_ops" && p.type === "validate") acts.push(["resolve_validate", "Tandai Validate Sudah Diperbaiki", "bg-[#351080]"]);
  if (role === "super_admin" && p.type === "pemeriksaan_validate") acts.push(["accept_validate", "Terima Perbaikan Validate", "bg-[#078D67]"]);
  const nextIdx = app.stage_index + 1;
  if (isAdmin(user) && app.stage_index >= 2 && nextIdx < app.stages.length && !app.pending) {
    acts.push(["advance", `Lanjut ke ${app.stages[nextIdx].label}`, "bg-[#5720B8]", `Konfirmasi tahap ${app.stages[nextIdx].label} telah benar-benar terjadi?`]);
    acts.push(["reject_bank", "Ditolak Bank", "bg-red-600", "Tandai pengajuan ditolak bank?"]);
  }
  if (!acts.length) return <p className="text-sm text-slate-500" data-testid="no-actions">{app.stage === "booking_live" ? "Pengajuan telah BOOKING/LIVE." : `Menunggu tindakan ${PARTY[p.party] || "bank"}.`}</p>;
  const showStage = acts.some((a) => a[0] === "advance" || a[0] === "forward");
  return (
    <div className="space-y-3" data-testid="action-panel">
      <div className="space-y-1.5"><Label>Catatan / alasan {acts.some((a) => ["request_revision", "validate", "resolve_validate", "reject_bank"].includes(a[0])) && "(wajib untuk revisi, Validate, penolakan)"}</Label>
        <Textarea value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} data-testid="action-note-input" /></div>
      {showStage && <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Tanggal proses</Label><Input type="date" value={v.process_date} onChange={(e) => setV({ ...v, process_date: e.target.value })} data-testid="action-date-input" /></div>
        <div className="space-y-1.5"><Label>No. referensi bank</Label><Input value={v.ref_no} onChange={(e) => setV({ ...v, ref_no: e.target.value })} data-testid="action-ref-input" /></div>
        {app.stages[nextIdx]?.key === "booking_live" && <>
          <div className="space-y-1.5"><Label>Tanggal booking *</Label><Input type="date" value={v.booking_date} onChange={(e) => setV({ ...v, booking_date: e.target.value })} data-testid="booking-date-input" /></div>
          <div className="space-y-1.5"><Label>Nomor kredit nasabah *</Label><Input value={v.credit_no} onChange={(e) => setV({ ...v, credit_no: e.target.value })} data-testid="credit-no-input" /></div>
        </>}
      </div>}
      <div className="flex flex-wrap gap-2">
        {acts.map(([a, label, cls, conf]) => <Button key={a} disabled={busy} onClick={() => run(a, conf)} className={`${cls} text-white hover:opacity-90 font-medium`} data-testid={`action-${a}`}>{label}</Button>)}
      </div>
    </div>
  );
}

function AppDetail({ appId, onClose, onChanged }) {
  const { user } = useAuth();
  const [app, setApp] = useState(null);
  const load = useCallback(() => appId && api.get(`/applications/${appId}`).then((r) => setApp(r.data)).catch((e) => { toast.error(errMsg(e)); onClose(); }), [appId, onClose]);
  useEffect(() => { setApp(null); load(); }, [load]);
  const changed = () => { load(); onChanged(); };
  const canUpload = app && app.stage === "upload_dokumen" && !app.rejected && (isAdmin(user) || app.pending?.party === "marketing");
  return (
    <Sheet open={!!appId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-2xl" data-testid="app-detail-sheet">
        {!app ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#5720B8]" /></div> : (
          <div className="space-y-6">
            <SheetHeader className="text-left border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-[#5720B8]">{app.app_no}</span>
                <PendingBadge app={app} />
              </div>
              <SheetTitle className="font-display text-2xl font-bold uppercase text-[#17223B]" data-testid="app-detail-name">
                {app.lead_name}
              </SheetTitle>

              {/* Stat & Info Cards */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Plafond Pengajuan</p>
                  <p className="mt-0.5 text-sm font-bold text-[#17223B] lp-num">{rp(app.plafond)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tenor Kredit</p>
                  <p className="mt-0.5 text-sm font-bold text-[#17223B]">{app.tenor} Bulan</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mitra Pembiayaan</p>
                  <p className="mt-0.5 truncate text-xs font-bold text-slate-800" title={app.bank_name}>{app.bank_name}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Marketing / Cabang</p>
                  <p className="mt-0.5 truncate text-xs font-bold text-slate-800" title={`${app.marketing_name} (${app.branch})`}>
                    {app.marketing_name} • {app.branch}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {app.debtor_type}
                </span>
                {app.dapem && (
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    Dapem: <b>{app.dapem}</b>
                  </span>
                )}
              </div>
            </SheetHeader>

            {app.pending?.note && (
              <div className="flex gap-2.5 rounded-xl border border-[#F28A19]/30 bg-[#F28A19]/8 p-3.5 text-sm text-[#9A5200]" data-testid="pending-note">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{PARTY[app.pending.party] || "Petugas"} perlu menindaklanjuti:</span>
                  <p className="mt-0.5">{app.pending.note}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="font-display text-sm font-bold text-[#17223B]">Progres 7 Tahapan Pengajuan</p>
              <StageTracker app={app} />
            </div>

            {app.booking && (
              <div className="space-y-2" data-testid="booking-info">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900">
                  <div className="rounded-full bg-emerald-200/70 p-1 text-emerald-800 shrink-0 mt-0.5">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Tanggal Booking</span>
                      <b className="mt-0.5 block text-xs font-bold text-emerald-950">{fmtDate(app.booking.date)}</b>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Nomor Kredit Bank</span>
                      <b className="mt-0.5 block font-mono text-xs font-bold text-emerald-950">{app.booking.credit_no}</b>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Dikonfirmasi Oleh</span>
                      <b className="mt-0.5 block truncate text-xs font-bold text-emerald-950" title={app.booking.confirmed_by}>{app.booking.confirmed_by}</b>
                    </div>
                  </div>
                </div>
                {app.claim && (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs">
                    <span className="text-slate-600 font-medium">
                      Status Insentif Marketing:
                    </span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      app.claim.status === "PAID"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-purple-100 text-purple-800"
                    }`}>
                      {app.claim.status === "PAID" ? "LUNAS (PAID)" : app.claim.status} • {rp(app.claim.amount)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="font-display text-sm font-bold text-[#17223B]">Dokumen Calon Debitur</p>
              <DocChecklist app={app} admin={isAdmin(user)} canUpload={canUpload} onChanged={changed} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <p className="font-display text-sm font-bold text-[#17223B]">Tindakan Tahapan</p>
              <ActionPanel app={app} user={user} onChanged={changed} />
            </div>

            <div className="space-y-2">
              <p className="font-display text-sm font-bold text-[#17223B]">Riwayat Aktivitas</p>
              <ul className="space-y-2.5" data-testid="app-history">
                {[...app.history].reverse().map((h) => (
                  <li key={h.id} className="border-l-2 border-[#5720B8]/40 pl-3 text-sm">
                    <p className="text-[#17223B]">
                      <b className="capitalize font-semibold">{h.action.replaceAll("_", " ")}</b>
                      {h.note && ` — ${h.note}`}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {h.user_name} ({PARTY[h.role] || h.role}) • {fmtDateTime(h.at)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function Progress() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ q: "", stage: "", branch: "", date_from: "", date_to: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(sp.get("app"));
  const load = useCallback(() => api.get("/applications", { params: { ...f, page, page_size: 10 } }).then((r) => setData(r.data)), [f, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setPage(1); };
  const close = useCallback(() => setOpenId(null), []);

  return (
    <div>
      <PageHeader
        eyebrow="Pengajuan"
        title="List Progress Leads"
        desc={user.role === "marketing" ? "Progress pengajuan calon debitur milik Anda." : user.role === "admin_ops" ? `Pengajuan marketing cabang ${user.branch}.` : "Seluruh pengajuan di semua cabang."}
      />
      <div className="lp-card">
        <FilterBar>
          <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={f.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Cari nama, ID, marketing…"
              className="h-10 pl-9"
              data-testid="progress-search-input"
            />
          </div>
          <select className={sel} value={f.stage} onChange={(e) => set("stage", e.target.value)} data-testid="progress-stage-filter">
            {STAGE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {user.role === "super_admin" && (
            <select className={sel} value={f.branch} onChange={(e) => set("branch", e.target.value)} data-testid="progress-branch-filter">
              <option value="">Semua cabang</option>
              {(data?.branches || []).map((b) => <option key={b}>{b}</option>)}
            </select>
          )}
          <div className="flex items-center gap-2">
            <Input type="date" className="h-10 w-full sm:w-auto" value={f.date_from} onChange={(e) => set("date_from", e.target.value)} aria-label="Dari tanggal" data-testid="progress-date-from" />
            <span className="text-xs text-slate-400">s/d</span>
            <Input type="date" className="h-10 w-full sm:w-auto" value={f.date_to} onChange={(e) => set("date_to", e.target.value)} aria-label="Sampai tanggal" data-testid="progress-date-to" />
          </div>
        </FilterBar>

        {/* Desktop Table View */}
        <DesktopTable testid="progress-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px] whitespace-nowrap">ID Pengajuan</TableHead>
                <TableHead className="min-w-[150px]">Calon Nasabah</TableHead>
                <TableHead className="w-[160px] whitespace-nowrap">Tahap Proses</TableHead>
                <TableHead className="w-[140px] whitespace-nowrap">Status</TableHead>
                <TableHead className="w-[140px] whitespace-nowrap">Plafond & Tenor</TableHead>
                <TableHead className="w-[160px]">Bank Mitra</TableHead>
                {user.role !== "marketing" && <TableHead className="w-[140px]">Marketing</TableHead>}
                <TableHead className="w-[110px] whitespace-nowrap">Cabang</TableHead>
                <TableHead className="w-[110px] whitespace-nowrap">Tgl Masuk</TableHead>
                <TableHead className="min-w-[160px]">Catatan / Alasan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer hover:bg-[#5720B8]/[0.03]"
                  onClick={() => setOpenId(a.id)}
                  data-testid={`progress-row-${a.id}`}
                >
                  <TableCell className="whitespace-nowrap font-mono text-xs font-bold text-[#351080]">
                    {a.app_no}
                  </TableCell>
                  <TableCell>
                    <p className="font-bold text-[#17223B] uppercase">{a.lead_name}</p>
                    <p className="text-[11px] text-slate-500 font-normal">{a.debtor_type}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {a.rejected ? (
                      <span className="text-xs font-bold text-red-600">Ditolak Bank</span>
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-slate-800">
                          {Math.min(7, a.stage_index + 1)}/7 • {a.stages[a.stage_index]?.label || a.stage}
                        </span>
                        <div className="mt-1 h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${a.stage === "booking_live" ? "bg-[#078D67]" : "bg-[#5720B8]"}`}
                            style={{ width: `${Math.min(100, ((a.stage_index + 1) / 7) * 100)}%` }}
                          />
                        </div>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <PendingBadge app={a} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p className="text-xs font-bold text-[#17223B] lp-num">{rp(a.plafond)}</p>
                    <p className="text-[11px] text-slate-500">{a.tenor} Bulan</p>
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    <span className="block truncate text-xs font-medium text-slate-800" title={a.bank_name}>
                      {a.bank_name}
                    </span>
                  </TableCell>
                  {user.role !== "marketing" && (
                    <TableCell className="max-w-[140px]">
                      <span className="block truncate text-xs font-medium text-slate-700" title={a.marketing_name}>
                        {a.marketing_name}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap text-xs text-slate-600">
                    {a.branch}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-slate-600 lp-num">
                    {fmtDate(a.created_at)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-slate-500" title={a.reject_reason || a.pending?.note || ""}>
                    {a.reject_reason || a.pending?.note || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DesktopTable>

        {/* Mobile List View */}
        <MobileList testid="progress-mobile-list">
          {data?.items.map((a) => (
            <ListCard
              key={a.id}
              onClick={() => setOpenId(a.id)}
              testid={`progress-card-${a.id}`}
              title={a.lead_name}
              subtitle={`${a.app_no} • ${a.bank_name}`}
              badge={<PendingBadge app={a} />}
              meta={[
                user.role !== "marketing" ? `${a.marketing_name} (${a.branch})` : a.branch,
                `${rp(a.plafond)} / ${a.tenor} bln`,
                fmtDate(a.created_at)
              ]}
            >
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {a.rejected ? "Status Penolakan" : `Tahap ${Math.min(7, a.stage_index + 1)} dari 7`}
                  </span>
                  <span className={`font-semibold ${a.rejected ? "text-red-600" : "text-[#351080]"}`}>
                    {a.rejected ? "Ditolak Bank" : a.stages[a.stage_index]?.label}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${a.rejected ? "bg-red-500" : a.stage === "booking_live" ? "bg-[#078D67]" : "bg-[#5720B8]"}`}
                    style={{ width: `${Math.min(100, ((a.stage_index + 1) / 7) * 100)}%` }}
                  />
                </div>
                {(a.reject_reason || a.pending?.note) && (
                  <p className="mt-1 truncate text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                    {a.reject_reason || a.pending?.note}
                  </p>
                )}
              </div>
            </ListCard>
          ))}
        </MobileList>

        {data && !data.items.length && <Empty text="Belum ada pengajuan" />}
        {data && <Pager page={page} pageSize={10} total={data.total} onPage={setPage} testid="progress-pager" />}
      </div>
      <AppDetail appId={openId} onClose={close} onChanged={load} />
    </div>
  );
}

