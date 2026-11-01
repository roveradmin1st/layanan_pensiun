import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, FileText } from "lucide-react";
import { api, errMsg, openFile } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { fmtDate, fmtDateTime, isAdmin, rp } from "../lib/format";
import { PageHeader, Pager, Empty, CtaButton, DesktopTable, MobileList, ListCard, FilterBar } from "../components/common";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

const STATUSES = ["DRAFT", "SUBMITTED", "REVIEW", "REVISION", "APPROVED", "PAID", "REJECTED"];
const CLS = { DRAFT: "bg-slate-100 text-slate-600", SUBMITTED: "bg-[#5720B8]/10 text-[#5720B8]", REVIEW: "bg-[#17223B]/8 text-[#17223B]",
  REVISION: "bg-[#F28A19]/12 text-[#B5620A]", APPROVED: "bg-[#078D67]/10 text-[#078D67]", PAID: "bg-[#078D67] text-white", REJECTED: "bg-red-50 text-red-700" };
const Badge = ({ s }) => <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${CLS[s]}`} data-testid={`claim-status-${s}`}>{s}</span>;
const sel = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

function CreateDialog({ open, onOpenChange, onSaved }) {
  const [apps, setApps] = useState([]);
  const [v, setV] = useState({ application_id: "", credit_no: "", notes: "" });
  const [file, setFile] = useState(null);
  useEffect(() => { if (open) api.get("/claims/eligible").then((r) => setApps(r.data)); }, [open]);
  const app = apps.find((a) => a.id === v.application_id);
  const submit = async (e) => {
    e.preventDefault();
    if (!file && !(v.credit_no || app?.booking?.credit_no)) return toast.error("Lampirkan foto akad dan/atau nomor kredit nasabah");
    const fd = new FormData();
    Object.entries(v).forEach(([k, val]) => fd.append(k, val));
    if (file) fd.append("file", file);
    try { await api.post("/claims", fd); toast.success("Klaim dibuat (DRAFT). Ajukan untuk diproses."); onOpenChange(false); setFile(null); setV({ application_id: "", credit_no: "", notes: "" }); onSaved(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="claim-create-dialog">
        <DialogHeader><DialogTitle className="font-display">Pengajuan Klaim Insentif</DialogTitle></DialogHeader>
        {!apps.length ? <p className="text-sm text-slate-500">Belum ada pengajuan berstatus BOOKING/LIVE yang dapat diklaim.</p> : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label>Referensi leads / pengajuan *</Label>
              <select required className={sel} value={v.application_id} onChange={(e) => setV({ ...v, application_id: e.target.value })} data-testid="claim-app-select">
                <option value="">— Pilih —</option>{apps.map((a) => <option key={a.id} value={a.id}>{a.app_no} • {a.lead_name} • {a.bank_name}</option>)}</select></div>
            {app && <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#F5F6FA] p-3 text-xs"><span>Nasabah: <b>{app.lead_name}</b></span><span>Bank: <b>{app.bank_name}</b></span>
              <span>Marketing: <b>{app.marketing_name}</b></span><span>Cabang: <b>{app.branch}</b></span><span>Tgl booking: <b>{fmtDate(app.booking?.date)}</b></span><span>No. kredit bank: <b>{app.booking?.credit_no}</b></span></div>}
            <div className="space-y-1.5"><Label>Nomor kredit nasabah</Label><Input value={v.credit_no} placeholder={app?.booking?.credit_no} onChange={(e) => setV({ ...v, credit_no: e.target.value })} data-testid="claim-credit-input" /></div>
            <div className="space-y-1.5"><Label>Bukti booking (foto akad JPG/PNG/PDF)</Label><Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFile(e.target.files[0] || null)} data-testid="claim-proof-input" /></div>
            <div className="space-y-1.5"><Label>Catatan</Label><Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} data-testid="claim-notes-input" /></div>
            <DialogFooter><Button type="submit" className="bg-[#F28A19] hover:bg-[#DC7A0F]" data-testid="claim-create-submit">Simpan Klaim</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClaimDetail({ claim, onClose, onChanged }) {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!claim) return null;
  const c = claim;
  const isSuperOrOps = user && ["super_admin", "admin_ops"].includes(user.role);
  const admin = isAdmin(user);
  const s = c.status;

  const act = async (action) => {
    if ((action === "revision" || action === "reject") && !note.trim()) {
      return toast.error("Catatan alasan penolakan/revisi wajib diisi.");
    }
    setBusy(true);
    try {
      await api.post(`/claims/${c.id}/action`, {
        action,
        note,
        amount: amount === "" ? null : Number(amount)
      });
      toast.success(
        action === "approve"
          ? "Klaim berhasil disetujui (APPROVED)"
          : action === "reject"
          ? "Klaim telah ditolak (REJECTED)"
          : action === "revision"
          ? "Klaim dikembalikan untuk revisi (REVISION)"
          : action === "submit"
          ? "Klaim diajukan (SUBMITTED)"
          : `Klaim berhasil diubah ke ${action}`
      );
      setNote("");
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!file) return toast.error("Bukti transaksi pembayaran wajib dilampirkan");
    if (!window.confirm("Konfirmasi pembayaran benar-benar telah dilakukan?")) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("note", note);
    if (amount !== "") fd.append("amount", amount);
    try {
      await api.post(`/claims/${c.id}/pay`, fd);
      toast.success("Klaim ditandai PAID (Sudah Dibayarkan)");
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const replace = async () => {
    if (!file) return toast.error("Pilih file bukti booking");
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/claims/${c.id}/proof`, fd);
      toast.success("Bukti booking diperbarui");
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" data-testid="claim-detail-dialog">
        <DialogHeader><DialogTitle className="font-display">{c.claim_no} — {c.lead_name}</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2"><Badge s={s} />{c.amount != null && <span className="text-sm font-semibold">{rp(c.amount)}</span>}</div>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#F5F6FA] p-3 text-xs">
          <span>Pengajuan: <b>{c.app_no}</b></span><span>Bank: <b>{c.bank_name}</b></span><span>Marketing: <b>{c.marketing_name}</b></span><span>Cabang: <b>{c.branch}</b></span>
          <span>Tgl booking: <b>{fmtDate(c.booking_date)}</b></span><span>No. kredit: <b>{c.credit_no || "-"}</b></span>
          {c.revision_note && <span className="col-span-2 text-[#B5620A]">Revisi: {c.revision_note}</span>}
          {c.reject_reason && <span className="col-span-2 text-red-700">Ditolak: {c.reject_reason}</span>}
          {c.paid_at && <span className="col-span-2 text-[#078D67]">Dibayar {fmtDateTime(c.paid_at)} oleh {c.paid_by} {c.payment_note && `— ${c.payment_note}`}</span>}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {c.booking_proof && <Button size="sm" variant="outline" onClick={() => openFile(`/claims/${c.id}/file/booking`)} data-testid="view-booking-proof"><FileText className="mr-1.5 h-4 w-4" />Bukti booking</Button>}
          {c.payment_proof && <Button size="sm" variant="outline" onClick={() => openFile(`/claims/${c.id}/file/payment`)} data-testid="view-payment-proof"><FileText className="mr-1.5 h-4 w-4" />Bukti transaksi</Button>}
        </div>
        {!["PAID", "REJECTED"].includes(s) && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <Label className="text-xs font-semibold text-slate-700">
              Catatan {(isSuperOrOps || admin) && "(wajib untuk revisi/penolakan)"}
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isSuperOrOps ? "Tuliskan catatan persetujuan, alasan revisi, atau penolakan..." : "Catatan pengajuan..."}
              data-testid="claim-action-note"
            />

            {/* Input nominal insentif jika Super Admin / Admin Ops */}
            {isSuperOrOps && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Nominal insentif (input berwenang)
                </Label>
                <Input
                  inputMode="numeric"
                  value={amount}
                  placeholder={`Default saat ini: ${rp(c.amount)}`}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  data-testid="claim-amount-input"
                />
              </div>
            )}

            {/* Upload bukti transaksi untuk Super Admin/Ops saat APPROVED, atau upload bukti booking untuk marketing */}
            {isSuperOrOps && s === "APPROVED" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Bukti transfer / pembayaran * (JPG/PNG/PDF)
                </Label>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  data-testid="claim-file-input"
                />
              </div>
            )}
            {!isSuperOrOps && ["DRAFT", "REVISION"].includes(s) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Ganti bukti booking
                </Label>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  data-testid="claim-file-input"
                />
              </div>
            )}

            {/* Tombol Aksi */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {/* Marketing aksi di DRAFT/REVISION */}
              {!isSuperOrOps && ["DRAFT", "REVISION"].includes(s) && (
                <>
                  <Button variant="outline" disabled={busy} onClick={replace} data-testid="claim-replace-proof">
                    Simpan Bukti
                  </Button>
                  <Button className="bg-[#351080] text-white hover:bg-[#280c61]" disabled={busy} onClick={() => act("submit")} data-testid="claim-submit">
                    Ajukan Klaim
                  </Button>
                </>
              )}

              {/* Super Admin & Admin Operasional */}
              {isSuperOrOps && (
                <>
                  {["DRAFT", "SUBMITTED", "REVIEW", "REVISION"].includes(s) && (
                    <Button
                      className="bg-[#078D67] text-white hover:bg-[#067253] font-semibold"
                      disabled={busy}
                      onClick={() => act("approve")}
                      data-testid="claim-approve"
                    >
                      Setujui Klaim
                    </Button>
                  )}
                  {["DRAFT", "SUBMITTED", "REVIEW", "REVISION", "APPROVED"].includes(s) && (
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold"
                      disabled={busy}
                      onClick={() => act("reject")}
                      data-testid="claim-reject"
                    >
                      Tolak Klaim
                    </Button>
                  )}
                  {["DRAFT", "SUBMITTED", "REVIEW"].includes(s) && (
                    <Button
                      className="bg-[#F28A19] text-white hover:bg-[#d97706] font-semibold"
                      disabled={busy}
                      onClick={() => act("revision")}
                      data-testid="claim-revision"
                    >
                      Minta Revisi
                    </Button>
                  )}
                  {["DRAFT", "REVISION"].includes(s) && (
                    <Button
                      variant="secondary"
                      className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                      disabled={busy}
                      onClick={() => act("submit")}
                      data-testid="claim-submit"
                    >
                      Ajukan (Submit)
                    </Button>
                  )}
                  {s === "APPROVED" && (
                    <Button
                      className="bg-[#078D67] text-white hover:bg-[#067253] font-semibold"
                      disabled={busy}
                      onClick={pay}
                      data-testid="claim-pay"
                    >
                      Konfirmasi Dibayar (PAID)
                    </Button>
                  )}
                </>
              )}

              {/* Admin Cabang / Sales Manager */}
              {(user.role === "admin_branch" || user.role === "sales_manager") && !isSuperOrOps && (
                <>
                  {["DRAFT", "REVISION"].includes(s) && (
                    <Button
                      variant="secondary"
                      className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                      disabled={busy}
                      onClick={() => act("submit")}
                      data-testid="claim-submit"
                    >
                      Ajukan Klaim
                    </Button>
                  )}
                  {["DRAFT", "SUBMITTED", "REVIEW"].includes(s) && (
                    <Button
                      className="bg-[#F28A19] text-white hover:bg-[#d97706]"
                      disabled={busy}
                      onClick={() => act("revision")}
                      data-testid="claim-revision"
                    >
                      Minta Revisi
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <ul className="space-y-2 text-sm" data-testid="claim-history">{[...c.history].reverse().map((h) => (
          <li key={h.id} className="border-l-2 border-[#5720B8]/30 pl-3"><b>{h.action}</b>{h.note && ` — ${h.note}`}<p className="text-[11px] text-slate-400">{h.user_name} • {fmtDateTime(h.at)}</p></li>))}</ul>
      </DialogContent>
    </Dialog>
  );
}

export default function Claims() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [create, setCreate] = useState(false);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => api.get("/claims", { params: { q, status, page, page_size: 10 } }).then((r) => {
    setData(r.data);
    setOpen((o) => (o ? r.data.items.find((x) => x.id === o.id) || o : o));
  }), [q, status, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <PageHeader eyebrow="Insentif" title="Pengajuan Klaim" desc="Klaim insentif marketing berdasarkan pengajuan yang telah BOOKING/LIVE. Klaim tidak otomatis dianggap dibayar."
        actions={user.role === "marketing" && <CtaButton onClick={() => setCreate(true)} data-testid="new-claim-button"><Plus className="mr-2 h-4 w-4" />Ajukan Klaim</CtaButton>} />
      <div className="lp-card">
        <FilterBar>
          <div className="relative min-w-0 flex-1 sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Cari nomor klaim, nasabah, marketing…"
              className="h-10 pl-9"
              data-testid="claims-search-input"
            />
          </div>
          <select
            className={`${sel} sm:w-[180px]`}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            data-testid="claims-status-filter"
          >
            <option value="">Semua status</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FilterBar>

        {/* Desktop Table View */}
        <DesktopTable testid="claims-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Klaim</TableHead>
                <TableHead>Nasabah</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Marketing</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Tgl Booking</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-[#5720B8]/[0.03]"
                  onClick={() => setOpen(c)}
                  data-testid={`claim-row-${c.id}`}
                >
                  <TableCell className="font-semibold text-[#351080]">{c.claim_no}</TableCell>
                  <TableCell className="font-medium text-[#17223B]">{c.lead_name}</TableCell>
                  <TableCell>{c.bank_name}</TableCell>
                  <TableCell>{c.marketing_name}</TableCell>
                  <TableCell>{c.branch}</TableCell>
                  <TableCell className="lp-num">{fmtDate(c.booking_date)}</TableCell>
                  <TableCell className="lp-num">{c.amount != null ? rp(c.amount) : "-"}</TableCell>
                  <TableCell><Badge s={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DesktopTable>

        {/* Mobile List View */}
        <MobileList testid="claims-mobile-list">
          {data?.items.map((c) => (
            <ListCard
              key={c.id}
              onClick={() => setOpen(c)}
              testid={`claim-card-${c.id}`}
              title={c.claim_no}
              subtitle={c.lead_name}
              badge={<Badge s={c.status} />}
              meta={[c.bank_name, c.marketing_name, fmtDate(c.booking_date)]}
            >
              <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                <span className="text-slate-500">Nominal Insentif:</span>
                <span className="font-bold text-[#078D67] lp-num">
                  {c.amount != null ? rp(c.amount) : "Menunggu penetapan"}
                </span>
              </div>
            </ListCard>
          ))}
        </MobileList>

        {data && !data.items.length && <Empty text="Belum ada klaim" />}
        {data && <Pager page={page} pageSize={10} total={data.total} onPage={setPage} testid="claims-pager" />}
      </div>
      <CreateDialog open={create} onOpenChange={setCreate} onSaved={load} />
      <ClaimDetail key={open?.id} claim={open} onClose={() => setOpen(null)} onChanged={load} />
    </div>
  );
}

