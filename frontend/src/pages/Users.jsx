import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../lib/format";
import { PageHeader, CtaButton, DesktopTable, MobileList, ListCard } from "../components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";

function UserDialog({ open, onOpenChange, editing, onSaved, me }) {
  const [v, setV] = useState({});
  useEffect(() => {
    setV(
      editing
        ? { ...editing, password: "", bank_scope: editing.bank_scope || "all_bank" }
        : {
            name: "",
            email: "",
            role: "marketing",
            branch: me?.branch || "",
            bank_scope: me?.bank_scope === "bsi_only" ? "bsi_only" : "all_bank",
            phone: "",
            password: ""
          }
    );
  }, [editing, open, me]);
  const roles =
    me.role === "super_admin"
      ? ["super_admin", "admin_ops", "admin_branch", "sales_manager", "marketing"]
      : me.role === "admin_ops"
      ? ["admin_branch", "sales_manager", "marketing"]
      : ["marketing"];
  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const body = {
          name: v.name,
          role: v.role,
          branch: v.branch,
          bank_scope: v.bank_scope || "all_bank",
          phone: v.phone,
          active: v.active
        };
        if (v.password) body.password = v.password;
        await api.patch(`/users/${editing.id}`, body);
      } else {
        await api.post("/users", {
          ...v,
          bank_scope: v.bank_scope || "all_bank"
        });
      }
      toast.success("Pengguna disimpan");
      onOpenChange(false); onSaved();
    } catch (err) { toast.error(errMsg(err)); }
  };
  const field = (k, label, props = {}) => (
    <div className="space-y-1.5"><Label htmlFor={`u-${k}`}>{label}</Label><Input id={`u-${k}`} value={v[k] || ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} data-testid={`user-form-${k}`} {...props} /></div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="user-dialog">
        <DialogHeader><DialogTitle className="font-display">{editing ? "Ubah Pengguna" : "Undang Pengguna Baru"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {field("name", "Nama lengkap", { required: true })}
          {!editing && field("email", "Email", { type: "email", required: true })}
          <div className="space-y-1.5"><Label>Peran</Label>
            <Select value={v.role} onValueChange={(r) => setV({ ...v, role: r })}><SelectTrigger data-testid="user-form-role"><SelectValue /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">{field("branch", "Cabang")}{field("phone", "Telepon")}</div>

          <div className="space-y-1.5">
            <Label htmlFor="u-bank-scope">Cakupan Mitra Bank (Bank Scope)</Label>
            <Select
              value={v.bank_scope || "all_bank"}
              disabled={me.role !== "super_admin" && me.role !== "admin_ops" && me.bank_scope === "bsi_only"}
              onValueChange={(val) => setV({ ...v, bank_scope: val })}
            >
              <SelectTrigger id="u-bank-scope" data-testid="user-form-bank-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_bank">Semua Bank (All Bank / Multi Mitra)</SelectItem>
                <SelectItem value="bsi_only">Khusus BSI (Bank Syariah Indonesia Only)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              {v.bank_scope === "bsi_only"
                ? "Akun khusus BSI: hanya dapat melihat, menghitung, dan memproses transaksi BSI."
                : "Akun All Bank: berwenang memantau seluruh transaksi mitra bank (AMS2, BSI, Capital, Mestika)."}
            </p>
          </div>

          {field("password", editing ? "Kata sandi baru (opsional)" : "Kata sandi awal (min. 8)", { type: "password", required: !editing, minLength: 8 })}
          {editing && <label className="flex items-center gap-3 text-sm"><Switch checked={v.active} onCheckedChange={(c) => setV({ ...v, active: c })} data-testid="user-form-active" />Akun aktif</label>}
          <DialogFooter><Button type="submit" className="bg-[#351080] hover:bg-[#2a0c66]" data-testid="user-form-submit">Simpan</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/users").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const canEdit = (u) => {
    if (user.role === "super_admin") return true;
    if (user.role === "admin_ops") return ["admin_branch", "sales_manager", "marketing"].includes(u.role);
    return u.role === "marketing";
  };

  return (
    <div>
      <PageHeader eyebrow="Administrasi" title="Pengguna & Peran" desc="Tidak ada registrasi publik. Seluruh akun dibuat oleh administrator yang berwenang."
        actions={<CtaButton onClick={() => { setEditing(null); setOpen(true); }} data-testid="add-user-button"><Plus className="mr-2 h-4 w-4" />Tambah Pengguna</CtaButton>} />
      <div className="lp-card">
        {/* Desktop Table View */}
        <DesktopTable testid="users-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Cakupan Bank</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => (
                <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                  <TableCell className="font-semibold text-[#17223B]">{u.name}</TableCell>
                  <TableCell className="text-slate-600">{u.email}</TableCell>
                  <TableCell>
                    <span className="rounded-md bg-[#5720B8]/10 px-2 py-0.5 text-xs font-semibold text-[#5720B8]">
                      {u.role_label}
                    </span>
                  </TableCell>
                  <TableCell>{u.branch || "-"}</TableCell>
                  <TableCell>
                    {u.bank_scope === "bsi_only" ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-[#078D67]" data-testid={`user-scope-${u.id}`}>
                        Khusus BSI
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600" data-testid={`user-scope-${u.id}`}>
                        Semua Bank
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="lp-num">{u.lead_count}</TableCell>
                  <TableCell>
                    {u.active ? (
                      <span className="text-xs font-semibold text-[#078D67]">Aktif</span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Nonaktif</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit(u) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditing(u); setOpen(true); }}
                        aria-label={`Ubah ${u.name}`}
                        data-testid={`edit-user-${u.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DesktopTable>

        {/* Mobile List View */}
        <MobileList testid="users-mobile-list">
          {list.map((u) => (
            <ListCard
              key={u.id}
              testid={`user-card-${u.id}`}
              title={u.name}
              subtitle={u.email}
              badge={
                <span className="rounded-md bg-[#5720B8]/10 px-2 py-0.5 text-xs font-semibold text-[#5720B8]">
                  {u.role_label}
                </span>
              }
              meta={[
                u.branch || "PUSAT",
                u.bank_scope === "bsi_only" ? "Khusus BSI" : "Semua Bank",
                `${u.lead_count} leads`,
                u.active ? "Aktif" : "Nonaktif",
              ]}
            >
              {canEdit(u) && (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => { setEditing(u); setOpen(true); }}
                    data-testid={`edit-user-card-${u.id}`}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Ubah Akun
                  </Button>
                </div>
              )}
            </ListCard>
          ))}
        </MobileList>
      </div>
      <UserDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={load} me={user} />
    </div>
  );
}

