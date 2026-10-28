import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../lib/api";
import { fmtDateTime, ROLE_LABEL } from "../lib/format";
import { PageHeader, Pager, DesktopTable, MobileList, ListCard, FilterBar } from "../components/common";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

export default function AuditLog() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => api.get("/audit-logs", { params: { q, action, page, page_size: 20 } }).then((r) => setData(r.data)), 250);
    return () => clearTimeout(t);
  }, [q, action, page]);

  return (
    <div>
      <PageHeader eyebrow="Keamanan" title="Audit Log" desc="Jejak seluruh aktivitas penting: login, perubahan data, penugasan, impor, simulasi, dan unduhan." />
      <div className="lp-card">
        <FilterBar>
          <div className="relative min-w-0 flex-1 sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Cari pengguna atau detail…"
              className="h-10 pl-9"
              data-testid="audit-search-input"
            />
          </div>
          <Select value={action || "all"} onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-10 w-full sm:w-[220px]" data-testid="audit-action-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua aksi</SelectItem>
              {(data?.actions || []).map((a) => <SelectItem key={a} value={a}>{a.replaceAll("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBar>

        {/* Desktop Table View */}
        <DesktopTable testid="audit-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Objek</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(a.created_at)}</TableCell>
                  <TableCell>
                    <p className="font-medium text-[#17223B]">{a.user_name}</p>
                    <p className="text-[11px] text-slate-400">{ROLE_LABEL[a.role] || ""}</p>
                  </TableCell>
                  <TableCell className="capitalize text-slate-700">{a.action.replaceAll("_", " ")}</TableCell>
                  <TableCell className="font-mono text-xs">{a.entity}</TableCell>
                  <TableCell className="max-w-[320px] truncate text-slate-600">{a.detail}</TableCell>
                  <TableCell className="text-xs text-slate-400">{a.ip}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DesktopTable>

        {/* Mobile List View */}
        <MobileList testid="audit-mobile-list">
          {data?.items.map((a) => (
            <ListCard
              key={a.id}
              testid={`audit-card-${a.id}`}
              title={a.user_name}
              subtitle={a.action.replaceAll("_", " ")}
              badge={
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-600">
                  {a.entity}
                </span>
              }
              meta={[
                ROLE_LABEL[a.role] || "",
                fmtDateTime(a.created_at),
              ]}
            >
              <p className="mt-2 text-xs text-slate-600 break-words">{a.detail}</p>
              <p className="mt-1 text-[11px] text-slate-400">IP: {a.ip}</p>
            </ListCard>
          ))}
        </MobileList>

        {data && <Pager page={page} pageSize={20} total={data.total} onPage={setPage} testid="audit-pager" />}
      </div>
    </div>
  );
}

