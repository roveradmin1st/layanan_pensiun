import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { ddmmyyyyToIso } from "../../lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import CurrencyInput from "../calc/CurrencyInput";

const FIELDS = [
  ["name", "Nama *"], ["phone", "Nomor Telepon *"], ["city", "Kota"], ["branch", "Cabang"], ["source", "Sumber Data"],
  ["nopen", "NOPEN"], ["nip", "NIP"], ["pension_salary", "Gaji Pensiun (Rp)"], ["birth_date", "Tanggal Lahir (DD/MM/YYYY)"],
];
const EMPTY = Object.fromEntries(FIELDS.map(([k]) => [k, ""]));

export default function LeadFormDialog({ open, onOpenChange, onSaved }) {
  const [v, setV] = useState({ ...EMPTY, source: "Manual" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const bd = v.birth_date ? ddmmyyyyToIso(v.birth_date) : null;
    if (v.birth_date && !bd) return toast.error("Format tanggal lahir harus DD/MM/YYYY");
    setBusy(true);
    try {
      await api.post("/leads", { ...v, birth_date: bd, pension_salary: v.pension_salary ? Number(String(v.pension_salary).replace(/\D/g, "")) : null });
      toast.success("Leads ditambahkan");
      setV({ ...EMPTY, source: "Manual" });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="lead-form-dialog">
        <DialogHeader><DialogTitle className="font-display">Tambah Leads</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`lf-${k}`}>{label}</Label>
              {k === "pension_salary"
                ? <CurrencyInput value={v[k]} onChange={(n) => setV({ ...v, [k]: n })} data-testid={`lead-form-${k}`} />
                : <Input id={`lf-${k}`} value={v[k]} required={label.includes("*")} placeholder={k === "birth_date" ? "15/03/1958" : undefined} onChange={(e) => setV({ ...v, [k]: e.target.value })} data-testid={`lead-form-${k}`} />}
            </div>
          ))}
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={busy} className="bg-[#F28A19] hover:bg-[#DC7A0F]" data-testid="lead-form-submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

