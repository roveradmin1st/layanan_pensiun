import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  UserPlus,
  Loader2,
  Send,
  History,
  Check,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isAdmin, fmtDate, fmtDateTime, STATUS, rp } from "../lib/format";
import {
  PageHeader,
  Pager,
  StatusBadge,
  Empty,
  CtaButton,
  DesktopTable,
  MobileList,
  ListCard,
  TableSkeleton,
  CardListSkeleton,
} from "../components/common";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import LeadDetailSheet from "../components/leads/LeadDetailSheet";
import LeadFormDialog from "../components/leads/LeadFormDialog";
import AssignDialog from "../components/leads/AssignDialog";

const ALL = "__all";

const FilterSelect = ({ value, onChange, placeholder, options, testid }) => (
  <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
    <SelectTrigger className="h-10 w-full bg-white text-xs font-medium sm:w-[170px]" data-testid={testid}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={ALL}>{placeholder}</SelectItem>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

function LeadRequestModal({ open, onOpenChange, requestMeta, onSaved }) {
  const [count, setCount] = useState(5);
  const [segment, setSegment] = useState("all");
  const [targetBank, setTargetBank] = useState("all");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const canRequest = requestMeta?.can_request_today !== false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canRequest) return;
    setBusy(true);
    try {
      const res = await api.post("/lead-requests", {
        requested_count: Number(count),
        target_segment: segment,
        target_bank: targetBank,
        notes: notes.trim(),
      });
      toast.success(`Permohonan ${res.data.request_no} (${count} data) berhasil diajukan ke Admin Operasional.`);
      onOpenChange(false);
      setNotes("");
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-6" data-testid="lead-request-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#351080]/10 text-[#351080]">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="font-display text-base font-bold text-slate-900">
                Permohonan Data Prospek Baru
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Ajukan permintaan kuota data calon debitur (maksimal 5 data) ke Admin Operasional.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!canRequest ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Permohonan Belum Dapat Diajukan</span>
            </div>
            {requestMeta?.branch_valid === false && (
              <p>
                Akun Anda belum memiliki penugasan kantor cabang resmi. Hubungi Admin Operasional untuk menetapkan cabang Anda sebelum mengajukan data prospek.
              </p>
            )}
            {requestMeta?.pending_request && (
              <p>
                Anda masih memiliki 1 permohonan aktif (<b>{requestMeta.pending_request.request_no}</b>) yang sedang berstatus <b>PENDING</b> menunggu persetujuan Admin Operasional.
              </p>
            )}
            {requestMeta?.today_approved_count > 0 && !requestMeta?.pending_request && (
              <p>
                Anda sudah mendapatkan alokasi <b>{requestMeta.today_approved_count} data prospek</b> untuk hari ini. Sesuai tata kelola kuota harian, permohonan data prospek berikutnya dapat diajukan kembali <b>besok hari</b>.
              </p>
            )}
            {requestMeta?.untouched_leads_count > 15 && (
              <p>
                Anda masih memiliki <b>{requestMeta.untouched_leads_count} prospek belum di-follow up</b>. Silakan tindak lanjuti prospek yang ada terlebih dahulu.
              </p>
            )}
            {requestMeta?.branch_stock?.total_unassigned === 0 && !requestMeta?.pending_request && requestMeta?.today_approved_count === 0 && (
              <p>
                Stok data prospek belum ditugaskan (unassigned) di Cabang <b>{requestMeta?.user_branch || "Anda"}</b> saat ini sedang kosong (0 data). Silakan hubungi Admin Operasional untuk penambahan/import database.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">🏢 Cabang Penugasan:</span>
                <span className="rounded-md bg-blue-200/80 px-2.5 py-0.5 font-bold text-blue-950">
                  {requestMeta?.user_branch || "BANDUNG"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Stok Cabang: </span>
                <span className="font-bold text-emerald-700">
                  {requestMeta?.branch_stock?.total_unassigned || 0} Siap Alokasi
                </span>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Jumlah Data yang Diminta (Maks. 5 permohonan per hari)
              </Label>
              <div className="mt-2 flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    data-testid={`quota-select-${n}`}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                      count === n
                        ? "border-[#351080] bg-[#351080] text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {n} Data
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Target Segmentasi Nasabah</Label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
                data-testid="target-segment-select"
              >
                <option value="all">Semua Kategori (Prapensiun &amp; Pensiunan)</option>
                <option value="prapen">Prapensiun ASN (Usia 50 – 59 Tahun)</option>
                <option value="pensiun">Pensiunan Murni (Usia 60+ Tahun)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Preferensi Mitra Bank Target</Label>
              <select
                value={targetBank}
                onChange={(e) => setTargetBank(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
                data-testid="target-bank-select"
              >
                <option value="all">Multi Mitra (Fleksibel / Sesuai Stok Terbaik)</option>
                <option value="bsi">Bank Syariah Indonesia (BSI Pensiun Berkah &amp; Prapen)</option>
                <option value="ams2">KSP AMS2 (Platinum / Reguler)</option>
                <option value="bank_mestika">Bank Mestika (TBA-MSTK)</option>
                <option value="bank_capital">Bank Capital (PS3)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Alasan / Rencana Prospek Kanvasing <span className="text-slate-400 font-normal">(Opsional)</span>
              </Label>
              <Textarea
                rows={2}
                placeholder="Contoh: Jadwal kanvasing ke kantor dinas pendidikan atau follow-up data lama sudah closing..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5 text-xs"
                data-testid="request-notes-input"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <CtaButton type="submit" disabled={busy} data-testid="submit-lead-request-btn">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Kirim Permintaan ke Admin Ops
              </CtaButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LeadRequestHistoryDialog({ open, onOpenChange, requests }) {
  const items = requests || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white p-6" data-testid="lead-request-history-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#078D67]/10 text-[#078D67]">
              <History className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="font-display text-base font-bold text-slate-900">
                Riwayat Permintaan Data Prospek
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Daftar permohonan kuota data yang pernah Anda ajukan ke Admin Operasional.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {!items.length ? (
            <p className="py-8 text-center text-xs text-slate-400">Belum ada riwayat permohonan data.</p>
          ) : (
            items.map((r) => {
              const isPending = r.status === "PENDING";
              const isApproved = r.status === "APPROVED";
              const isRejected = r.status === "REJECTED";

              return (
                <div key={r.id} className="py-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-[#351080]">{r.request_no}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isPending
                          ? "bg-amber-100 text-amber-800"
                          : isApproved
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {isPending && <Clock className="h-3 w-3" />}
                      {isApproved && <CheckCircle2 className="h-3 w-3" />}
                      {isRejected && <XCircle className="h-3 w-3" />}
                      {isPending ? "Menunggu Persetujuan" : isApproved ? `Disetujui (${r.allocated_count || r.requested_count} Data)` : "Ditolak"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500">
                    <span>Diajukan: <b>{fmtDateTime(r.created_at)}</b></span>
                    <span>Permintaan: <b>{r.requested_count} Data</b></span>
                    <span>Segmen: <b>{r.target_segment === "prapen" ? "Prapensiun" : r.target_segment === "pensiun" ? "Pensiunan Murni" : "Semua Segmen"}</b></span>
                  </div>

                  {r.notes && <p className="text-slate-600 italic">"{r.notes}"</p>}

                  {r.admin_notes && (
                    <div className={`rounded-lg p-2.5 ${isApproved ? "bg-emerald-50/70 border border-emerald-100 text-emerald-900" : "bg-red-50/70 border border-red-100 text-red-900"}`}>
                      <p className="font-semibold text-[11px]">Catatan Admin Operasional ({r.processed_by_name || "Admin Ops"}):</p>
                      <p className="mt-0.5">{r.admin_notes}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminRequestsPanel({ requests, onRefresh }) {
  const [rejectId, setRejectId] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleApprove = async (id, reqNo, requesterName) => {
    if (!window.confirm(`Setujui permohonan ${reqNo} dan alokasikan data prospek unassigned ke ${requesterName}?`)) return;
    setBusy(true);
    try {
      const res = await api.post(`/lead-requests/${id}/approve`);
      toast.success(res.data.message || `Berhasil mengalokasikan data ke ${requesterName}`);
      onRefresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error("Alasan penolakan wajib diisi");
    setBusy(true);
    try {
      await api.post(`/lead-requests/${rejectId}/reject`, { reason: reason.trim() });
      toast.success("Permohonan berhasil ditolak");
      setRejectId(null);
      setReason("");
      onRefresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const items = requests || [];

  return (
    <div className="space-y-4" data-testid="admin-requests-panel">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <TableHead>No. Permohonan</TableHead>
              <TableHead>Waktu Pengajuan</TableHead>
              <TableHead>Pemohon (Marketing)</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead>Jumlah Data</TableHead>
              <TableHead>Segmen / Target</TableHead>
              <TableHead>Alasan Marketing</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi Otorisasi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!items.length ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-xs text-slate-400">
                  Tidak ada permohonan data prospek saat ini.
                </TableCell>
              </TableRow>
            ) : (
              items.map((r) => {
                const isPending = r.status === "PENDING";
                const isApproved = r.status === "APPROVED";
                const isRejected = r.status === "REJECTED";

                return (
                  <TableRow key={r.id} className="text-xs hover:bg-slate-50/80">
                    <TableCell className="font-mono font-bold text-[#351080]">{r.request_no}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">{fmtDateTime(r.created_at)}</TableCell>
                    <TableCell className="font-bold text-slate-900">
                      {r.requester_name}
                      <span className="block font-normal text-[11px] text-slate-400">{r.requester_email}</span>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {r.branch}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-slate-800">
                      {r.requested_count} Data
                      {isApproved && r.allocated_count && (
                        <span className="block text-[11px] text-emerald-600">({r.allocated_count} terealisasi)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <span className="block font-medium">
                        {r.target_segment === "prapen" ? "Prapensiun ASN" : r.target_segment === "pensiun" ? "Pensiunan Murni" : "Semua Segmen"}
                      </span>
                      <span className="text-[11px] text-slate-400">Bank: {r.target_bank}</span>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-slate-500" title={r.notes}>
                      {r.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isPending
                            ? "bg-amber-100 text-amber-800"
                            : isApproved
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {isPending ? "PENDING" : isApproved ? "APPROVED" : "REJECTED"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => handleApprove(r.id, r.request_no, r.requester_name)}
                            className="bg-[#078D67] hover:bg-[#067354] text-white h-8 text-xs font-bold"
                            data-testid={`approve-btn-${r.id}`}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" /> Setujui (Auto FIFO)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => { setRejectId(r.id); setReason(""); }}
                            className="border-red-200 text-red-600 hover:bg-red-50 h-8 text-xs font-bold"
                            data-testid={`reject-btn-${r.id}`}
                          >
                            <X className="mr-1 h-3.5 w-3.5" /> Tolak
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          {isApproved ? `Disetujui ${fmtDateTime(r.processed_at)}` : `Ditolak: ${r.admin_notes || "-"}`}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reject Reason Modal */}
      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent className="max-w-md bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold text-red-700">
              Tolak Permohonan Data Prospek
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Berikan catatan alasan penolakan agar staf marketing dapat memahami kendala stok atau permohonannya.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReject} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Alasan Penolakan</Label>
              <Textarea
                required
                rows={3}
                placeholder="Contoh: Stok calon debitur cabang Medan sedang kosong, silakan maksimalkan follow up leads..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1.5 text-xs"
                data-testid="reject-reason-input"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectId(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={busy} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-reject-btn">
                {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Konfirmasi Tolak Permohonan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const isCentral = user?.role === "super_admin" || user?.role === "admin_ops";
  const isMarketing = user?.role === "marketing";

  const [activeTab, setActiveTab] = useState("leads"); // "leads" | "requests"
  const [sp] = useSearchParams();
  const [meta, setMeta] = useState({ branches: [], marketers: [], sales_managers: [] });
  const [f, setF] = useState({ q: "", status: "", branch: "", assigned: "", manager_id: "", follow_up: sp.get("follow_up") || "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  // Lead Request states
  const [requestMeta, setRequestMeta] = useState(null);
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const loadRequests = useCallback(() => {
    api.get("/lead-requests").then((r) => setRequestMeta(r.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    const params = { ...f, page, page_size: 10 };
    api.get("/leads", { params }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
    loadRequests();
  }, [f, page, loadRequests]);

  useEffect(() => {
    api.get("/leads/meta").then((r) => setMeta(r.data)).catch(() => {});
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const setFilter = (k, v) => {
    setF((p) => ({ ...p, [k]: v }));
    setPage(1);
    setSelected([]);
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const items = data?.items || [];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Database"
        title="Database Leads"
        desc={
          admin
            ? "Kelola, tugaskan, dan pantau seluruh leads calon debitur pensiunan."
            : "Daftar leads yang sedang ditugaskan kepada Anda untuk di-follow up."
        }
        actions={
          admin ? (
            <>
              <Button
                variant="outline"
                disabled={!selected.length}
                onClick={() => setAssignOpen(true)}
                className="h-10 border-slate-300 bg-white"
                data-testid="bulk-assign-button"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Tugaskan ({selected.length})
              </Button>
              <CtaButton onClick={() => setFormOpen(true)} className="h-10" data-testid="add-lead-button">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Leads
              </CtaButton>
            </>
          ) : isMarketing ? (
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                Distribusi Otomatis Aktif ({user.branch || "Cabang"})
              </span>
              {requestMeta?.items?.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setHistoryModalOpen(true)}
                  className="h-9 border-slate-300 bg-white text-xs font-semibold"
                  data-testid="history-request-btn"
                >
                  <History className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                  Riwayat
                </Button>
              )}
            </div>
          ) : null
        }
      />

      {/* Marketing Banners */}
      {isMarketing && requestMeta?.pending_request && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs" data-testid="pending-request-banner">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Permohonan Data Aktif: {requestMeta.pending_request.request_no}</span>
              <p className="mt-0.5 text-amber-800">
                Meminta {requestMeta.pending_request.requested_count} data prospek. Sedang menunggu persetujuan Admin Operasional.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
            PENDING
          </span>
        </div>
      )}

      {/* Tab Switcher for Admin Central */}
      {isCentral && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab("leads")}
            data-testid="tab-leads"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === "leads"
                ? "bg-[#351080] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>Daftar Seluruh Leads</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
              {data?.total || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            data-testid="tab-requests"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeTab === "requests"
                ? "bg-[#351080] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Send className="h-4 w-4" />
            <span>Permintaan Data Marketing</span>
            {requestMeta?.pending_count > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {requestMeta.pending_count} Baru
              </span>
            )}
          </button>
        </div>
      )}

      {/* Render Active Tab Content */}
      {isCentral && activeTab === "requests" ? (
        <AdminRequestsPanel requests={requestMeta?.items || []} onRefresh={load} />
      ) : (
        <div className="lp-card overflow-hidden">
          {/* Filter Bar Responsif */}
          <div className="flex flex-col gap-2.5 border-b border-slate-100 p-3 sm:p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={f.q}
                onChange={(e) => setFilter("q", e.target.value)}
                placeholder="Cari nama, nomor telepon, NOPEN, kota..."
                className="h-10 pl-9 text-xs sm:text-sm"
                data-testid="leads-search-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <FilterSelect
                value={f.status}
                onChange={(v) => setFilter("status", v)}
                placeholder="Semua status"
                testid="filter-status"
                options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))}
              />
              <FilterSelect
                value={f.branch}
                onChange={(v) => setFilter("branch", v)}
                placeholder="Semua cabang"
                testid="filter-branch"
                options={meta.branches.map((b) => ({ value: b, label: b }))}
              />
              {admin && (
                <FilterSelect
                  value={f.assigned}
                  onChange={(v) => setFilter("assigned", v)}
                  placeholder="Semua marketing"
                  testid="filter-assigned"
                  options={[
                    { value: "unassigned", label: "Belum ditugaskan" },
                    ...meta.marketers.map((m) => ({ value: m.id, label: m.name })),
                  ]}
                />
              )}
              {admin && (meta.sales_managers || []).length > 0 && (
                <FilterSelect
                  value={f.manager_id}
                  onChange={(v) => setFilter("manager_id", v)}
                  placeholder="Semua Sales Manager"
                  testid="filter-sales-manager"
                  options={meta.sales_managers.map((sm) => ({ value: sm.id, label: `${sm.name} (${sm.branch})` }))}
                />
              )}
            </div>
          </div>

          {/* Desktop Table View */}
          <DesktopTable>
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8F9FD] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {admin && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={items.length > 0 && selected.length === items.length}
                        onCheckedChange={(c) => setSelected(c ? items.map((x) => x.id) : [])}
                        aria-label="Pilih semua baris"
                        data-testid="select-all-leads"
                      />
                    </TableHead>
                  )}
                  <TableHead>Nama Nasabah</TableHead>
                  <TableHead>Telepon &amp; Kota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cabang</TableHead>
                  {admin && <TableHead>Ditugaskan Ke</TableHead>}
                  <TableHead>Follow-up</TableHead>
                  <TableHead>Gaji Pensiun</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data === null ? (
                  <TableSkeleton rows={8} cols={admin ? 8 : 7} />
                ) : (
                  items.map((l) => (
                    <TableRow
                      key={l.id}
                      onClick={() => setOpenId(l.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80"
                      data-testid={`lead-row-${l.id}`}
                    >
                      {admin && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.includes(l.id)}
                            onCheckedChange={() => toggle(l.id)}
                            aria-label={`Pilih ${l.name}`}
                            data-testid={`select-lead-${l.id}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <p className="font-semibold text-slate-900">{l.name}</p>
                        <p className="text-[11px] text-slate-400">NOPEN: {l.nopen || "-"}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-800">{l.phone}</p>
                        <p className="text-[11px] text-slate-400">{l.city || "-"}</p>
                      </TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                      <TableCell><span className="text-xs text-slate-600">{l.branch || "-"}</span></TableCell>
                      {admin && (
                        <TableCell>
                          <span className="text-xs font-semibold text-slate-800">
                            {l.assigned_name || <i className="text-slate-400 font-normal">Belum ditugaskan</i>}
                          </span>
                          {l.sales_manager_name && (
                            <span className="block text-[10px] font-medium text-purple-700" title={`SM: ${l.sales_manager_name}`}>
                              SM: {l.sales_manager_name}
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-xs text-slate-600">{fmtDate(l.follow_up_date)}</TableCell>
                      <TableCell className="font-medium text-slate-900 lp-num">
                        {l.pension_salary ? rp(l.pension_salary) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DesktopTable>

          {/* Mobile Card List View */}
          <MobileList>
            {data === null && <CardListSkeleton count={4} />}
            {data && items.map((l) => (
              <ListCard
                key={l.id}
                testid={`lead-row-${l.id}`}
                title={l.name}
                subtitle={`${l.phone} • ${l.city || l.branch || "-"}`}
                badge={<StatusBadge status={l.status} />}
                meta={[
                  admin ? ["Marketing", l.assigned_name ? `${l.assigned_name}${l.sales_manager_name ? ` (SM: ${l.sales_manager_name})` : ""}` : "Belum ditugaskan"] : null,
                  ["Follow-up", fmtDate(l.follow_up_date)],
                  ["Sumber", l.source],
                  ["Gaji Pensiun", l.pension_salary ? rp(l.pension_salary) : null],
                ]}
                leading={admin ? (
                  <Checkbox
                    checked={selected.includes(l.id)}
                    onCheckedChange={() => toggle(l.id)}
                    aria-label={`Pilih ${l.name}`}
                    data-testid={`select-lead-${l.id}`}
                  />
                ) : null}
                onClick={() => setOpenId(l.id)}
              />
            ))}
          </MobileList>

          {data && !items.length && <Empty text="Tidak ada data leads yang sesuai dengan filter pencarian" />}
          {data && <Pager page={page} pageSize={10} total={data.total} onPage={setPage} testid="leads-pager" />}
        </div>
      )}

      {/* Sheets & Dialogs */}
      <LeadDetailSheet leadId={openId} onClose={() => setOpenId(null)} onChanged={load} marketers={meta.marketers || []} />
      {admin && <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={load} />}
      {admin && (
        <AssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          leadIds={selected}
          marketers={meta.marketers || []}
          onDone={() => { setSelected([]); load(); }}
        />
      )}

      {/* Marketing Modals */}
      {isMarketing && (
        <>
          <LeadRequestModal
            open={reqModalOpen}
            onOpenChange={setReqModalOpen}
            requestMeta={requestMeta}
            onSaved={load}
          />
          <LeadRequestHistoryDialog
            open={historyModalOpen}
            onOpenChange={setHistoryModalOpen}
            requests={requestMeta?.items || []}
          />
        </>
      )}
    </div>
  );
}
