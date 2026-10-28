import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Search, Loader2, Check, FileUp, FileText, AlertTriangle } from "lucide-react";
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
  if (!p && app.stage === "booking_live") return <span className="rounded-md bg-[#078D67] px-2 py-0.5 text-xs font-semibold text-white">BOOKING/LIVE</span>;
  if (!p) return <span className="rounded-md bg-[#078D67]/10 px-2 py-0.5 text-xs font-semibold text-[#078D67]">Diproses bank</span>;
  const cls = p.type === "revisi" ? "bg-[#F28A19]/12 text-[#B5620A]" : p.type === "validate" ? "bg-red-50 text-red-700" : "bg-[#5720B8]/10 text-[#5720B8]";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{p.type.replace("_", " ").toUpperCase()} • {PARTY[p.party]}</span>;
};

export const StageTracker = ({ app }) => (
  <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="stage-tracker">
    {app.stages.map((s, i) => {
      const done = i < app.stage_index || (i === app.stage_index && s.key === "booking_live");
      const cur = i === app.stage_index;
      return (
        <li key={s.key} className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${done ? "border-[#078D67]/30 bg-[#078D67]/8 text-[#078D67]" : cur ? (app.rejected ? "border-red-300 bg-red-50 text-red-700" : "border-[#5720B8] bg-[#5720B8]/8 text-[#351080]") : "border-slate-200 text-slate-400"}`} data-testid={`stage-${s.key}`}>
          <span className="flex items-center gap-1">{done && <Check className="h-3 w-3" />}{i + 1}. {s.label}</span>
          {app.stage_data?.[s.key] && <span className="mt-0.5 block font-normal">{app.stage_data[s.key].by_name} • {fmtDate(app.stage_data[s.key].date || app.stage_data[s.key].at)}</span>}
        </li>
      );
    })}
  </ol>
);

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
      <p className="mb-2 text-xs text-slate-500" data-testid="doc-progress">Kelengkapan: <b className="text-[#17223B]">{done}/{app.checklist.length}</b> dokumen (PDF)</p>
      <ul className="divide-y rounded-lg border">
        {app.checklist.map((d) => (
          <li key={d.key} className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid={`doc-row-${d.key}`}>
            <div className="min-w-0">
              <p className="font-medium text-[#17223B]">{d.label} <span className="text-[11px] font-normal text-slate-400">• {d.group}</span></p>
              {d.filename ? <button onClick={() => openFile(`/applications/${app.id}/documents/${d.key}`)} className="flex items-center gap-1 text-xs text-[#5720B8] hover:underline"><FileText className="h-3 w-3" />{d.filename} • {fmtDateTime(d.uploaded_at)}{d.versions > 1 && ` • v${d.versions}`}</button>
                : <p className="text-xs text-slate-400">Belum diunggah</p>}
              {d.status === "ditolak" && <p className="text-xs text-red-600">Revisi: {d.note}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${d.status === "diterima" ? "bg-[#078D67]/10 text-[#078D67]" : d.status === "ditolak" ? "bg-red-50 text-red-700" : d.status ? "bg-[#5720B8]/10 text-[#5720B8]" : "bg-slate-100 text-slate-500"}`}>{d.status || "kosong"}</span>
              {canUpload && <Button size="sm" variant="outline" onClick={() => { setTarget(d.key); ref.current.click(); }} data-testid={`upload-${d.key}`}><FileUp className="h-3.5 w-3.5" /></Button>}
              {admin && d.status && app.stage === "upload_dokumen" && <>
                <Button size="sm" variant="ghost" className="text-[#078D67]" onClick={() => review(d.key, "diterima")} data-testid={`accept-${d.key}`}>Terima</Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => review(d.key, "ditolak")} data-testid={`reject-${d.key}`}>Tolak</Button>
              </>}
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
  if (app.rejected) return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Ditolak bank: {app.reject_reason}</p>;
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
        {acts.map(([a, label, cls, conf]) => <Button key={a} disabled={busy} onClick={() => run(a, conf)} className={`${cls} text-white hover:opacity-90`} data-testid={`action-${a}`}>{label}</Button>)}
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
            <SheetHeader className="text-left">
              <p className="lp-eyebrow">{app.app_no} • {app.bank_name}</p>
              <SheetTitle className="font-display text-2xl text-[#17223B]" data-testid="app-detail-name">{app.lead_name}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><PendingBadge app={app} /><span>{app.debtor_type}{app.dapem && ` • ${app.dapem}`}</span><span>• {app.marketing_name} • {app.branch}</span><span>• {rp(app.plafond)} / {app.tenor} bln</span></div>
            </SheetHeader>
            {app.pending?.note && <div className="flex gap-2 rounded-lg border border-[#F28A19]/30 bg-[#F28A19]/8 p-3 text-sm text-[#9A5200]" data-testid="pending-note"><AlertTriangle className="h-4 w-4 shrink-0" /><span><b>{PARTY[app.pending.party]}</b> perlu menindaklanjuti: {app.pending.note}</span></div>}
            <StageTracker app={app} />
            {app.booking && <p className="text-sm" data-testid="booking-info">Booking: <b>{fmtDate(app.booking.date)}</b> • No. kredit <b>{app.booking.credit_no}</b> • dikonfirmasi {app.booking.confirmed_by}</p>}
            <div><p className="mb-2 font-display text-sm font-bold">Dokumen Calon Debitur</p><DocChecklist app={app} admin={isAdmin(user)} canUpload={canUpload} onChanged={changed} /></div>
            <div className="rounded-xl border p-4"><p className="mb-3 font-display text-sm font-bold">Tindakan</p><ActionPanel app={app} user={user} onChanged={changed} /></div>
            <div><p className="mb-3 font-display text-sm font-bold">Riwayat Aktivitas</p>
              <ul className="space-y-3" data-testid="app-history">{[...app.history].reverse().map((h) => (
                <li key={h.id} className="border-l-2 border-[#5720B8]/30 pl-3 text-sm"><p className="text-[#17223B]"><b className="capitalize">{h.action.replaceAll("_", " ")}</b>{h.note && ` — ${h.note}`}</p>
                  <p className="text-[11px] text-slate-400">{h.user_name} ({PARTY[h.role]}) • {fmtDateTime(h.at)}</p></li>))}</ul></div>
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
      <PageHeader eyebrow="Pengajuan" title="List Progress Leads" desc={user.role === "marketing" ? "Progress pengajuan calon debitur milik Anda." : user.role === "admin_ops" ? `Pengajuan marketing cabang ${user.branch}.` : "Seluruh pengajuan di semua cabang."} />
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
                <TableHead>ID</TableHead>
                <TableHead>Calon Nasabah</TableHead>
                {user.role !== "marketing" && <TableHead>Marketing</TableHead>}
                <TableHead>Cabang</TableHead>
                <TableHead>Bank Mitra</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Tgl Pengajuan</TableHead>
                <TableHead>Tahap</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catatan</TableHead>
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
                  <TableCell className="text-xs font-semibold text-[#351080]">
                    {a.app_no}
                    <span className="block font-normal text-slate-400">Lead {a.lead_id.slice(0, 8)}</span>
                  </TableCell>
                  <TableCell className="font-semibold text-[#17223B]">{a.lead_name}</TableCell>
                  {user.role !== "marketing" && <TableCell>{a.marketing_name}</TableCell>}
                  <TableCell>{a.branch}</TableCell>
                  <TableCell>{a.bank_name}</TableCell>
                  <TableCell>{a.debtor_type}</TableCell>
                  <TableCell className="lp-num">{fmtDate(a.created_at)}</TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold">{a.stage_index + 1}/8 • {a.stages[a.stage_index].label}</span>
                    <div className="mt-1 h-1.5 w-24 rounded bg-slate-100">
                      <div className="h-1.5 rounded bg-[#5720B8]" style={{ width: `${((a.stage_index + 1) / 8) * 100}%` }} />
                    </div>
                  </TableCell>
                  <TableCell><PendingBadge app={a} /></TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-slate-500">{a.reject_reason || a.pending?.note || "-"}</TableCell>
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
                fmtDate(a.created_at),
              ]}
            >
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Tahap {a.stage_index + 1} dari 8</span>
                  <span className="font-semibold text-[#351080]">{a.stages[a.stage_index].label}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#5720B8]"
                    style={{ width: `${((a.stage_index + 1) / 8) * 100}%` }}
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

