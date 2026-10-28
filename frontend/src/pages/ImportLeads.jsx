import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, UploadCloud, CheckCircle2 } from "lucide-react";
import { api, errMsg, downloadFile } from "../lib/api";
import { fmtDateTime } from "../lib/format";
import { PageHeader, CtaButton, Empty, DesktopTable, MobileList, ListCard } from "../components/common";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

export default function ImportLeads() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const ref = useRef();
  const load = () => api.get("/imports").then((r) => setHistory(r.data));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const { data } = await api.post("/imports", fd);
      setResult(data);
      toast.success(`${data.inserted} leads berhasil diimpor`);
      setFile(null);
      ref.current.value = "";
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Database"
        title="Impor Leads"
        desc="Unggah file Excel (.xlsx) atau CSV. Kolom wajib: Nama, Telepon. Kolom opsional: Kota, Cabang, Sumber, NOPEN, NIP, Gaji Pensiun, Tanggal Lahir. Nomor telepon duplikat dilewati otomatis."
        actions={
          <Button variant="outline" onClick={() => downloadFile("/imports/template", "template.xlsx")} data-testid="download-template-button">
            <Download className="mr-2 h-4 w-4" />Unduh Template
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lp-card p-6 lg:col-span-2">
          <button
            onClick={() => ref.current.click()}
            className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#5720B8]/25 bg-[#5720B8]/[0.03] px-6 py-12 text-center transition-colors hover:border-[#5720B8]/50"
            data-testid="import-dropzone"
          >
            {file ? <FileSpreadsheet className="h-10 w-10 text-[#078D67]" /> : <UploadCloud className="h-10 w-10 text-[#351080]" />}
            <p className="mt-3 font-semibold text-[#17223B]">{file ? file.name : "Pilih file .xlsx atau .csv"}</p>
            <p className="mt-1 text-xs text-slate-500">Maksimal 5 MB</p>
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Impor Sekarang"}
          </CtaButton>
          {result && (
            <div className="mt-5 rounded-xl border border-[#078D67]/20 bg-[#078D67]/5 p-4 text-sm" data-testid="import-result">
              <p className="flex items-center gap-2 font-semibold text-[#078D67]">
                <CheckCircle2 className="h-4 w-4" />Impor selesai
              </p>
              <p className="mt-2 lp-num">
                Total baris {result.total_rows} • Baru {result.inserted} • Duplikat {result.skipped_duplicates} • Error {result.error_count}
              </p>
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
            <h2 className="font-display font-bold text-[#17223B]">Riwayat Impor</h2>
          </div>
          
          <DesktopTable testid="import-history-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Oleh</TableHead>
                  <TableHead>Baru</TableHead>
                  <TableHead>Duplikat</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium text-[#17223B]">{h.filename}</TableCell>
                    <TableCell>{h.user_name}</TableCell>
                    <TableCell className="font-semibold text-[#078D67] lp-num">+{h.inserted}</TableCell>
                    <TableCell className="lp-num">{h.skipped_duplicates}</TableCell>
                    <TableCell className="lp-num text-red-600">{h.error_count}</TableCell>
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
                <div className="mt-2 flex gap-4 text-xs text-slate-500">
                  <span>Duplikat: <b className="text-slate-700">{h.skipped_duplicates}</b></span>
                  <span>Gagal: <b className="text-red-600">{h.error_count}</b></span>
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
