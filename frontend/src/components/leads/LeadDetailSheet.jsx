import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Calculator, FileUp, FileText, Loader2, Phone, MapPin, Trash2 } from "lucide-react";
import { api, errMsg, openFile } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { fmtDate, fmtDateTime, isAdmin, rp, STATUS } from "../../lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { StatusBadge } from "../common";

const DOC_CATS = ["KTP", "SK Pensiun", "Kartu Keluarga", "Slip Gaji", "Lainnya"];
const Info = ({ k, v }) => (<div><p className="text-[11px] uppercase tracking-wide text-slate-400">{k}</p><p className="text-sm font-medium text-[#17223B]">{v || "-"}</p></div>);

function Documents({ leadId, admin }) {
  const [docs, setDocs] = useState([]);
  const [cat, setCat] = useState("KTP");
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  const load = useCallback(() => api.get(`/leads/${leadId}/documents`).then((r) => setDocs(r.data)), [leadId]);
  useEffect(() => { load(); }, [load]);
  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      await api.post(`/leads/${leadId}/documents`, fd, { params: { category: cat } });
      toast.success("Dokumen diunggah");
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); ref.current.value = ""; }
  };
  const remove = async (id) => { await api.delete(`/documents/${id}`); load(); };
  return (
    <div>
      <div className="flex gap-2">
        <Select value={cat} onValueChange={setCat}><SelectTrigger className="w-[160px]" data-testid="doc-category-select"><SelectValue /></SelectTrigger>
          <SelectContent>{DOC_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => upload(e.target.files[0])} data-testid="doc-file-input" />
        <Button variant="outline" disabled={busy} onClick={() => ref.current.click()} data-testid="doc-upload-button">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}Unggah
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">PDF/JPG/PNG maks. 10 MB • tersimpan privat</p>
      <ul className="mt-3 space-y-2">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" data-testid={`doc-item-${d.id}`}>
            <button onClick={() => openFile(`/documents/${d.id}/download`)} className="flex min-w-0 items-center gap-2 text-left hover:text-[#5720B8]">
              <FileText className="h-4 w-4 shrink-0 text-[#5720B8]" /><span className="truncate">{d.category} — {d.filename}</span>
            </button>
            {admin && <button onClick={() => remove(d.id)} className="text-slate-400 hover:text-red-600" aria-label="Hapus dokumen"><Trash2 className="h-4 w-4" /></button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LeadDetailSheet({ leadId, onClose, onChanged, marketers }) {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [lead, setLead] = useState(null);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const [type, setType] = useState("telepon");

  const load = useCallback(() => {
    if (!leadId) return;
    api.get(`/leads/${leadId}`).then((r) => {
      setLead(r.data);
      setForm({ status: r.data.status, follow_up_date: r.data.follow_up_date || "", notes: r.data.notes || "" });
    }).catch((e) => { toast.error(errMsg(e)); onClose(); });
  }, [leadId, onClose]);
  useEffect(() => { setLead(null); load(); }, [load]);

  const save = async () => {
    try {
      await api.patch(`/leads/${leadId}`, { ...form, follow_up_date: form.follow_up_date || null });
      toast.success("Leads diperbarui");
      load(); onChanged();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const assign = async (uid) => {
    await api.post("/leads/assign", { lead_ids: [leadId], user_id: uid === "none" ? null : uid });
    toast.success("Penugasan diperbarui"); load(); onChanged();
  };
  const addAct = async () => {
    if (!note.trim()) return;
    await api.post(`/leads/${leadId}/activities`, { type, note });
    setNote(""); load();
  };

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-xl" data-testid="lead-detail-sheet">
        {!lead ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#5720B8]" /></div> : (
          <div className="space-y-7">
            <SheetHeader className="text-left">
              <p className="lp-eyebrow">Detail Leads</p>
              <SheetTitle className="font-display text-2xl text-[#17223B]" data-testid="lead-detail-name">{lead.name}</SheetTitle>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <StatusBadge status={lead.status} /><span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{lead.phone}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{lead.city} • {lead.branch}</span>
              </div>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#F5F6FA] p-4">
              <Info k="NOPEN" v={lead.nopen} /><Info k="NIP" v={lead.nip} /><Info k="Gaji Pensiun" v={lead.pension_salary ? rp(lead.pension_salary) : null} />
              <Info k="Tanggal Lahir" v={fmtDate(lead.birth_date)} /><Info k="Sumber" v={lead.source} />
              {admin && <Info k="Marketing" v={lead.assigned_name || "Belum ditugaskan"} />}
            </div>
            <Button asChild className="w-full bg-[#F28A19] hover:bg-[#DC7A0F]" data-testid="lead-simulate-button">
              <Link to={`/kalkulator?lead=${lead.id}`}><Calculator className="mr-2 h-4 w-4" />Buat Simulasi Calc Platinum</Link>
            </Button>
            {admin && (
              <div className="space-y-1.5"><Label>Tugaskan ke marketing</Label>
                <Select value={lead.assigned_to || "none"} onValueChange={assign}><SelectTrigger data-testid="lead-assign-select"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— Belum ditugaskan —</SelectItem>{marketers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
            <div className="space-y-4 rounded-xl border p-4">
              <p className="font-display text-sm font-bold">Tindak Lanjut</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger data-testid="lead-status-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Tanggal tindak lanjut</Label>
                  <Input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} data-testid="lead-followup-input" /></div>
              </div>
              <div className="space-y-1.5"><Label>Catatan</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="lead-notes-input" /></div>
              <Button onClick={save} className="bg-[#351080] hover:bg-[#2a0c66]" data-testid="lead-save-button">Simpan Perubahan</Button>
            </div>
            <div><p className="mb-3 font-display text-sm font-bold">Dokumen</p><Documents leadId={lead.id} admin={admin} /></div>
            {lead.simulations?.length > 0 && (
              <div><p className="mb-3 font-display text-sm font-bold">Simulasi</p>
                <ul className="space-y-1.5 text-sm">{lead.simulations.map((s) => <li key={s.id} className="flex justify-between rounded-lg bg-[#F5F6FA] px-3 py-2"><span className="font-medium">{s.sim_no}</span><span className="lp-num text-slate-500">{rp(s.input?.plafond)}</span></li>)}</ul></div>
            )}
            <div>
              <p className="mb-3 font-display text-sm font-bold">Riwayat Aktivitas</p>
              <div className="mb-4 flex gap-2">
                <Select value={type} onValueChange={setType}><SelectTrigger className="w-[130px]" data-testid="activity-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{["telepon", "kunjungan", "whatsapp", "catatan"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tulis aktivitas…" data-testid="activity-note-input" />
                <Button variant="outline" onClick={addAct} data-testid="activity-add-button">Catat</Button>
              </div>
              <ul className="space-y-4" data-testid="lead-activity-list">
                {lead.activities.map((a) => (
                  <li key={a.id} className="border-l-2 border-[#5720B8]/30 pl-3 text-sm">
                    <p className="text-[#17223B]"><span className="font-semibold capitalize">{a.type}</span> — {a.note}</p>
                    <p className="text-[11px] text-slate-400">{a.user_name} • {fmtDateTime(a.created_at)}</p>
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

