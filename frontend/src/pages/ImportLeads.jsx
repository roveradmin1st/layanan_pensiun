import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, UploadCloud, CheckCircle2, Users, MapPin, Building2, UserCheck } from "lucide-react";
import { api, errMsg, downloadFile } from "../lib/api";
import { fmtDateTime, KANWIL_BRANCHES } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { PageHeader, CtaButton, Empty, DesktopTable, MobileList, ListCard } from "../components/common";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";

export default function ImportLeads() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [targetBranch, setTargetBranch] = useState("auto");
  const [distributionMode, setDistributionMode] = useState("auto_round_robin");
  const [targetManagerId, setTargetManagerId] = useState("auto");
  const [salesManagers, setSalesManagers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const ref = useRef();

  const load = () => {
    api.get("/imports").then((r) => setHistory(r.data)).catch(() => {});
    api.get("/leads/meta").then((r) => setSalesManagers(r.data?.sales_managers || [])).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const isGlobalScope = !user || ["super_admin", "admin_ops"].includes(user.role);

  const filteredManagers = targetBranch === "auto"
    ? salesManagers
    : salesManagers.filter((sm) => !sm.branch || sm.branch.toUpperCase() === targetBranch.toUpperCase());

  const submit = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    if (isGlobalScope && targetBranch && targetBranch !== "auto") {
      fd.append("target_branch", targetBranch);
    }
    fd.append("distribution_mode", distributionMode);
    if (targetManagerId && targetManagerId !== "auto") {
      fd.append("target_manager_id", targetManagerId);
    }
    setBusy(true);
    try {
      const { data } = await api.post("/imports", fd);
      setResult(data);
      toast.success(`${data.inserted} leads berhasil diimpor & terdistribusi`);
      setFile(null);
      if (ref.current) ref.current.value = "";
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Database"
        title="Impor & Distribusi Otomatis Leads"
        desc="Unggah file Excel (.xlsx) atau CSV. Sistem secara cerdas memetakan cabang dan mendistribusikan data calon debitur ke jalur Sales Manager dan Marketing secara terstruktur. Nomor telepon dan NOPEN ganda otomatis disaring."
        actions={
          <Button variant="outline" onClick={() => downloadFile("/imports/template", "template_impor_leads.csv")} data-testid="download-template-button">
            <Download className="mr-2 h-4 w-4" />Unduh Template CSV
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lp-card p-6 lg:col-span-2">
          {/* Opsi Jalur Distribusi */}
          <div className="mb-4 space-y-1.5">
            <Label htmlFor="distribution-mode-select" className="text-xs font-semibold text-slate-700">
              Jalur Distribusi Leads
            </Label>
            <Select value={distributionMode} onValueChange={setDistributionMode}>
              <SelectTrigger id="distribution-mode-select" data-testid="distribution-mode-select">
                <SelectValue placeholder="Pilih Jalur Distribusi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto_round_robin">⚡ Otomatis (Round-Robin ke Marketing Cabang)</SelectItem>
                <SelectItem value="sm_queue">👔 Antrean Sales Manager (Dikelola & Dialokasikan SM)</SelectItem>
                <SelectItem value="branch_pool">🏢 Pool Cadangan Cabang (Bisa Diminta Marketing)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              {distributionMode === "auto_round_robin"
                ? "Leads langsung dialokasikan rata ke Marketing aktif di cabang terkait beserta tim Sales Manager."
                : distributionMode === "sm_queue"
                ? "Leads masuk ke antrean Sales Manager cabang untuk ditinjau dan ditugaskan secara manual ke tim."
                : "Leads disimpan di Pool Cadangan Cabang dan dapat dialokasikan melalui permohonan data harian."}
            </p>
          </div>

          {/* Opsi Target Cabang */}
          {isGlobalScope ? (
            <div className="mb-4 space-y-1.5">
              <Label htmlFor="target-branch-select" className="text-xs font-semibold text-slate-700">
                Alokasi Cabang Tujuan (Opsional)
              </Label>
              <Select value={targetBranch} onValueChange={(val) => { setTargetBranch(val); setTargetManagerId("auto"); }}>
                <SelectTrigger id="target-branch-select" data-testid="target-branch-select">
                  <SelectValue placeholder="Pilih Cabang atau Otomatis" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="auto">⚡ Otomatis (Sesuai Kolom Cabang / Kota)</SelectItem>
                  {KANWIL_BRANCHES.map((k) => (
                    <div key={k.code} className="py-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                        {k.code} - {k.name}
                      </div>
                      {k.branches.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500">
                {targetBranch === "auto"
                  ? "Sistem membaca kolom Cabang/Kota dan membagikan ke cabang terkait."
                  : `Semua baris dalam file ini akan dipetakan ke cabang ${targetBranch}.`}
              </p>
            </div>
          ) : (
            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200">
              <span className="font-bold text-slate-800">Cakupan Cabang:</span> {user?.branch || "Cabang Terdaftar"}
              <p className="mt-0.5 text-[11px] text-slate-500">Seluruh leads yang diimpor akan otomatis masuk ke cakupan cabang Anda.</p>
            </div>
          )}

          {/* Opsi Target Sales Manager */}
          {filteredManagers.length > 0 && (
            <div className="mb-4 space-y-1.5">
              <Label htmlFor="target-manager-select" className="text-xs font-semibold text-slate-700">
                Sales Manager Tujuan (Opsional)
              </Label>
              <Select value={targetManagerId} onValueChange={setTargetManagerId}>
                <SelectTrigger id="target-manager-select" data-testid="target-manager-select">
                  <SelectValue placeholder="Pilih Sales Manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">⚡ Otomatis / Sesuai Kolom File</SelectItem>
                  {filteredManagers.map((sm) => (
                    <SelectItem key={sm.id} value={sm.id}>
                      {sm.name} ({sm.branch})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <button
            onClick={() => ref.current.click()}
            className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#5720B8]/25 bg-[#5720B8]/[0.03] px-6 py-10 text-center transition-colors hover:border-[#5720B8]/50"
            data-testid="import-dropzone"
          >
            {file ? <FileSpreadsheet className="h-10 w-10 text-[#078D67]" /> : <UploadCloud className="h-10 w-10 text-[#351080]" />}
            <p className="mt-3 font-semibold text-[#17223B]">{file ? file.name : "Pilih file .xlsx atau .csv"}</p>
            <p className="mt-1 text-xs text-slate-500">Maksimal 10 MB • Format Excel (.xlsx) atau CSV standar</p>
          </button>
          <input
            ref={ref}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files[0] || null)}
            data-testid="import-file-input"
          />
          <CtaButton className="mt-4 w-full" disabled={!file || busy} onClick={submit} data-testid="import-submit-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Impor & Distribusikan Sekarang"}
          </CtaButton>

          {result && (
            <div className="mt-5 rounded-xl border border-[#078D67]/20 bg-[#078D67]/5 p-4 text-sm" data-testid="import-result">
              <p className="flex items-center gap-2 font-semibold text-[#078D67]">
                <CheckCircle2 className="h-4 w-4" />Impor & Distribusi Berhasil
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-700">
                <p>
                  Total Baris: <b>{result.total_rows}</b> • Baru: <b>{result.inserted}</b> • Duplikat: <b>{result.skipped_duplicates}</b> • Gagal: <b>{result.error_count}</b>
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                    ✓ Marketing: {result.assigned_count || 0}
                  </span>
                  {result.sm_queue_count > 0 && (
                    <span className="rounded-md bg-purple-100 px-2 py-0.5 font-bold text-purple-800">
                      👔 Antrean SM: {result.sm_queue_count}
                    </span>
                  )}
                  {result.unassigned_count > 0 && (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
                      ⚠ Pool Cabang: {result.unassigned_count}
                    </span>
                  )}
                </div>
              </div>

              {result.branch_breakdown && Object.keys(result.branch_breakdown).length > 0 && (
                <div className="mt-3 border-t border-emerald-200/60 pt-2 text-xs">
                  <p className="font-bold text-slate-700 mb-1">Rincian Per Cabang:</p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {Object.entries(result.branch_breakdown).map(([br, stat]) => (
                      <div key={br} className="flex justify-between text-[11px] text-slate-600 bg-white/70 px-2 py-1 rounded">
                        <span className="font-semibold text-slate-800">{br}</span>
                        <span>{stat.total} data ({stat.assigned} marketing, {stat.sm_queue || 0} antrean SM, {stat.pool} pool)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-red-600">
                  {result.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="lp-card lg:col-span-3">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-display font-bold text-[#17223B]">Riwayat Impor & Distribusi</h2>
          </div>
          
          <DesktopTable testid="import-history-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Oleh</TableHead>
                  <TableHead>Masuk</TableHead>
                  <TableHead>Marketing</TableHead>
                  <TableHead>Antrean SM</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead>Duplikat</TableHead>
                  <TableHead>Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium text-[#17223B]">{h.filename}</TableCell>
                    <TableCell>{h.user_name}</TableCell>
                    <TableCell className="font-semibold text-[#078D67] lp-num">+{h.inserted}</TableCell>
                    <TableCell className="text-emerald-700 font-semibold lp-num">{h.assigned_count ?? h.inserted}</TableCell>
                    <TableCell className="text-purple-700 font-semibold lp-num">{h.sm_queue_count ?? 0}</TableCell>
                    <TableCell className="text-amber-700 lp-num">{h.unassigned_count ?? 0}</TableCell>
                    <TableCell className="lp-num">{h.skipped_duplicates}</TableCell>
                    <TableCell className="text-xs text-slate-500">{fmtDateTime(h.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DesktopTable>

          <MobileList testid="import-history-mobile-list">
            {history.map((h) => (
              <ListCard
                key={h.id}
                testid={`import-history-card-${h.id}`}
                title={h.filename}
                subtitle={`Oleh: ${h.user_name}`}
                badge={<span className="font-bold text-xs text-[#078D67]">+{h.inserted} Baru</span>}
                meta={[fmtDateTime(h.created_at)]}
              >
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>Marketing: <b className="text-emerald-700">{h.assigned_count ?? h.inserted}</b></span>
                  <span>Antrean SM: <b className="text-purple-700">{h.sm_queue_count ?? 0}</b></span>
                  <span>Pool: <b className="text-amber-700">{h.unassigned_count ?? 0}</b></span>
                  <span>Duplikat: <b className="text-slate-700">{h.skipped_duplicates}</b></span>
                </div>
              </ListCard>
            ))}
          </MobileList>

          {!history.length && <Empty text="Belum ada riwayat impor" />}
        </div>
      </div>
    </div>
  );
}
