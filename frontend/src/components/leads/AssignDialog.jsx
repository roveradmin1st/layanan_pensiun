import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";

export default function AssignDialog({ open, onOpenChange, leadIds, marketers, onDone }) {
  const [uid, setUid] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/leads/assign", { lead_ids: leadIds, user_id: uid === "none" ? null : uid });
      toast.success(`${data.updated} leads diperbarui`);
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="assign-dialog">
        <DialogHeader><DialogTitle className="font-display">Tugaskan {leadIds.length} leads</DialogTitle></DialogHeader>
        <Select value={uid} onValueChange={setUid}>
          <SelectTrigger data-testid="assign-marketing-select"><SelectValue placeholder="Pilih marketing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Lepas penugasan —</SelectItem>
            {marketers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} • {m.branch}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button disabled={!uid || busy} onClick={submit} className="bg-[#351080] hover:bg-[#2a0c66]" data-testid="assign-confirm-button">Simpan Penugasan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

