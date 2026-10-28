import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { rp, fmtDateTime } from "../lib/format";
import { PageHeader, Pager, Empty, DesktopTable, MobileList, ListCard } from "../components/common";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import ResultView from "../components/calc/ResultView";
import { AiSummary, DownloadActions } from "../components/calc/SimExtras";

export default function Simulations() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => api.get("/simulations", { params: { q, page, page_size: 10 } }).then((r) => setData(r.data)), 250);
    return () => clearTimeout(t);
  }, [q, page]);

  const show = (id) => api.get(`/simulations/${id}`).then((r) => setOpen(r.data));

  return (
    <div>
      <PageHeader eyebrow="Calc Platinum" title="Riwayat Simulasi" desc="Seluruh simulasi final yang telah tersimpan beserta file PDF & gambar." />
      <div className="lp-card">
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Cari nomor simulasi atau nama debitur…"
              className="pl-9"
              data-testid="sim-search-input"
            />
          </div>
        </div>

        {/* Desktop Table View */}
        <DesktopTable testid="simulations-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Simulasi</TableHead>
                <TableHead>Debitur</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Plafond</TableHead>
                <TableHead>Tenor</TableHead>
                <TableHead>Angsuran Bulanan</TableHead>
                <TableHead>Petugas</TableHead>
                <TableHead>Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {data?.items.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-[#5720B8]/[0.03]"
                  onClick={() => show(s.id)}
                  data-testid={`sim-row-${s.id}`}
                >
                  <TableCell className="font-semibold text-[#351080]">{s.sim_no}</TableCell>
                  <TableCell className="font-medium text-[#17223B]">{s.result.name}</TableCell>
                  <TableCell>{s.result.category}</TableCell>
                  <TableCell className="lp-num">{rp(s.result.plafond)}</TableCell>
                  <TableCell>{s.result.tenor} bln</TableCell>
                  <TableCell className="lp-num">
                    {s.result.bank_key === "bsi_prapen" || s.result.bsi_details ? (
                      <span className="text-xs">
                        <span className="text-slate-500">Aktif:</span> {rp(s.result.bsi_details?.active_installment || s.result.bank_installment)}
                        <br />
                        <span className="text-[#078D67] font-semibold">Pensiun:</span> {rp(s.result.bsi_details?.pension_installment || s.result.coop_installment)}
                      </span>
                    ) : (
                      rp(s.result.coop_installment)
                    )}
                  </TableCell>
                  <TableCell>{s.created_by_name}</TableCell>
                  <TableCell className="text-xs text-slate-500">{fmtDateTime(s.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DesktopTable>

        {/* Mobile List View */}
        <MobileList testid="simulations-mobile-list">
          {!data && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {data?.items.map((s) => (
            <ListCard
              key={s.id}
              onClick={() => show(s.id)}
              testid={`sim-card-${s.id}`}
              title={s.sim_no}
              subtitle={s.result.name}
              badge={<span className="rounded-full bg-[#078D67]/10 px-2 py-0.5 text-[10px] font-bold text-[#078D67]">{s.result.category}</span>}
              meta={[s.created_by_name, fmtDateTime(s.created_at)]}
            >
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                <div>
                  <span className="text-slate-400">Plafond:</span>{" "}
                  <b className="font-semibold text-[#17223B] lp-num">{rp(s.result.plafond)}</b>
                </div>
                <div>
                  <span className="text-slate-400">Tenor:</span>{" "}
                  <b className="font-semibold text-[#17223B]">{s.result.tenor} bln</b>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Angsuran:</span>{" "}
                  {s.result.bank_key === "bsi_prapen" || s.result.bsi_details ? (
                    <span className="font-semibold text-[#078D67] lp-num">
                      {rp(s.result.bsi_details?.active_installment || s.result.bank_installment)} (Aktif) / {rp(s.result.bsi_details?.pension_installment || s.result.coop_installment)} (Pensiun)
                    </span>
                  ) : (
                    <b className="font-semibold text-[#351080] lp-num">{rp(s.result.coop_installment)}</b>
                  )}
                </div>
              </div>
            </ListCard>
          ))}
        </MobileList>

        {data && !data.items.length && <Empty text="Belum ada simulasi" />}
        {data && <Pager page={page} pageSize={10} total={data.total} onPage={setPage} testid="sim-pager" />}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto" data-testid="sim-detail-dialog">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-lg sm:text-xl font-bold text-[#17223B]">
                  {open.sim_no} — {open.result.name}
                </DialogTitle>
              </DialogHeader>
              <ResultView r={open.result} />
              <div className="space-y-4">
                <DownloadActions sim={open} />
                <AiSummary sim={open} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

