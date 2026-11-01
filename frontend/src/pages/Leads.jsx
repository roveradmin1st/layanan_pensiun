import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isAdmin, fmtDate, STATUS, rp } from "../lib/format";
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

export default function Leads() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [sp] = useSearchParams();
  const [meta, setMeta] = useState({ branches: [], marketers: [] });
  const [f, setF] = useState({ q: "", status: "", branch: "", assigned: "", follow_up: sp.get("follow_up") || "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const load = useCallback(() => {
    const params = { ...f, page, page_size: 10 };
    api.get("/leads", { params }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [f, page]);

  useEffect(() => {
    api.get("/leads/meta").then((r) => setMeta(r.data));
  }, []);

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
    <div>
      <PageHeader
        eyebrow="Database"
        title="Database Leads"
        desc={admin ? "Kelola, tugaskan, dan pantau seluruh leads calon debitur pensiunan." : "Daftar leads yang sedang ditugaskan kepada Anda."}
        actions={admin && (
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
        )}
      />

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
                  ...(meta.marketers || []).map((m) => ({ value: m.id, label: m.name })),
                ]}
              />
            )}
            <FilterSelect
              value={f.follow_up}
              onChange={(v) => setFilter("follow_up", v)}
              placeholder="Semua jadwal"
              testid="filter-followup"
              options={[
                { value: "today", label: "Follow-up hari ini" },
                { value: "overdue", label: "Terlambat" },
              ]}
            />
          </div>
        </div>

        {/* Tampilan Desktop: Tabel Lengkap */}
        <DesktopTable>
          <div className="overflow-x-auto">
            <Table data-testid="leads-table">
              <TableHeader>
                <TableRow className="bg-slate-50/75">
                  {admin && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={items.length > 0 && selected.length === items.length}
                        onCheckedChange={(c) => setSelected(c ? items.map((i) => i.id) : [])}
                        aria-label="Pilih semua"
                        data-testid="select-all-leads"
                      />
                    </TableHead>
                  )}
                  <TableHead>Nama</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Kota</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead>Status</TableHead>
                  {admin && <TableHead>Marketing</TableHead>}
                  <TableHead>Tindak Lanjut</TableHead>
                  <TableHead>Sumber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data && <TableSkeleton cols={admin ? 9 : 7} rows={6} />}
                {items.map((l) => (
                  <TableRow
                    key={l.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() => setOpenId(l.id)}
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
                    <TableCell className="font-semibold text-slate-900">{l.name}</TableCell>
                    <TableCell className="lp-num text-slate-600">{l.phone}</TableCell>
                    <TableCell className="text-slate-600">{l.city || "-"}</TableCell>
                    <TableCell className="text-slate-600">{l.branch || "-"}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                    {admin && (
                      <TableCell>
                        {l.assigned_name || <span className="text-xs font-medium text-amber-700">Belum ditugaskan</span>}
                      </TableCell>
                    )}
                    <TableCell className="lp-num text-slate-600">{fmtDate(l.follow_up_date)}</TableCell>
                    <TableCell className="text-slate-500">{l.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DesktopTable>

        {/* Tampilan Mobile: Kartu Responsif Berorientasi Sentuhan */}
        <MobileList>
          {!data && <CardListSkeleton rows={5} />}
          {items.map((l) => (
            <ListCard
              key={l.id}
              testid={`lead-row-${l.id}`}
              title={l.name}
              subtitle={`${l.phone} • ${l.city || l.branch || "-"}`}
              badge={<StatusBadge status={l.status} />}
              meta={[
                admin ? ["Marketing", l.assigned_name || "Belum ditugaskan"] : null,
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
    </div>
  );
}
