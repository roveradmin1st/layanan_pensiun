import { useState } from "react";
import { toast } from "sonner";
import { FileText, Copy, Loader2, FileDown, ImageDown, Check, Send } from "lucide-react";
import { api, downloadFile, errMsg } from "../../lib/api";
import { fmtDateTime } from "../../lib/format";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export function DownloadActions({ sim }) {
  const [busy, setBusy] = useState("");
  const dl = async (kind) => {
    setBusy(kind);
    try {
      await downloadFile(`/simulations/${sim.id}/${kind}`, `simulasi_${sim.sim_no || "resmi"}.${kind}`);
    } catch (e) {
      toast.error(errMsg(e, "Gagal membuat file"));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4" data-testid="download-actions">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-slate-800">Unduh Dokumen &amp; Lembar Simulasi Resmi</p>
        <p className="text-xs text-slate-500">Pilih format berkas untuk keperluan arsip internal atau diberikan kepada calon nasabah.</p>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <Button
          onClick={() => dl("pdf")}
          disabled={!!busy}
          className="bg-[#351080] text-white hover:bg-[#280c63]"
          data-testid="download-pdf-button"
        >
          {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
          Unduh Dokumen PDF (A4)
        </Button>
        <Button
          variant="outline"
          onClick={() => dl("png")}
          disabled={!!busy}
          className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          data-testid="download-png-button"
        >
          {busy === "png" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageDown className="mr-2 h-4 w-4" />}
          Ringkasan Gambar (PNG/SVG)
        </Button>
      </div>
    </div>
  );
}

export function AiSummary({ sim }) {
  const [format, setFormat] = useState("whatsapp");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const history = sim.ai_summaries || [];

  const run = async () => {
    setBusy(true);
    setCopied(false);
    try {
      const res = await api.post(`/simulations/${sim.id}/ai-summary`, { format });
      const summaryText = res.data?.summary || res.data?.text || "";
      if (format === "whatsapp") {
        const r = sim.result || {};
        const isBsi = r.bank_key === "bsi_prapen" || !!r.bsi_details;
        const isCapital = r.bank_key === "bank_capital" || !!r.capital_details;
        const isAms2 = r.bank_key === "ams2";
        const bsi = r.bsi_details;
        const cap = r.capital_details;
        let waText = "";

        if (isCapital) {
          waText = [
            `*APLIKASI CALC CAPITAL — DASA CIPTA BERKARYA (PS3 CAPITAL)*`,
            `No. Referensi: ${sim.sim_no}`,
            `Produk / Tipe Angsuran: ${cap?.product_and_type_label || r.category}`,
            ``,
            `Yth. Bapak/Ibu *${r.name}*,`,
            `Berikut hasil simulasi fasilitas kredit pensiun PS3 CAPITAL Anda:`,
            `• Gaji Bulanan: Rp${Math.round(r.salary || 0).toLocaleString("id-ID")}`,
            `• Tenor Kredit / Tenor PP: ${cap?.credit_months ?? r.tenor} / ${cap?.pp_months ?? 0} bulan`,
            `• Tenor GP / Tenor PV: ${cap?.gp_months ?? 0} / ${cap?.pv_months ?? r.tenor} bulan`,
            `• Batas Angsuran Maksimal (90%): Rp${Math.round(cap?.payment_cap ?? ((r.salary || 0) * 0.9)).toLocaleString("id-ID")}`,
            `• Plafond Maksimal (PV): Rp${Math.round(cap?.recommendation_max_loan ?? r.plafond ?? 0).toLocaleString("id-ID")}`,
            `• Plafond Kredit yang Diajukan: Rp${Math.round(cap?.loan ?? r.plafond ?? 0).toLocaleString("id-ID")}`,
            `• Angsuran Aktual (PMT): Rp${Math.round(cap?.actual_payment ?? r.coop_installment ?? 0).toLocaleString("id-ID")}/bulan`,
            `• Biaya Kredit: Rp${Math.round(cap?.cost ?? r.total_fees ?? 0).toLocaleString("id-ID")}`,
            `• Total Retensi: Rp${Math.round(cap?.total_retention ?? r.retention ?? 0).toLocaleString("id-ID")}`,
            `• *Pencairan Bersih: Rp${Math.round(cap?.net_cash ?? r.net_disbursement ?? 0).toLocaleString("id-ID")}*`,
            `• Sisa Gaji Setelah Angsuran: Rp${Math.round(cap?.salary_left ?? r.remaining_salary ?? 0).toLocaleString("id-ID")}`,
            ``,
            `Petugas Pendamping: ${sim.created_by_name || "Petugas Layanan Pensiunan"}`,
            `_Estimasi simulasi berdasarkan parameter PS3 CAPITAL · DASA CIPTA BERKARYA_`
          ].join("\n");
        } else if (isBsi) {
          const sisaGajiPensiun = bsi?.sisa_gaji_pensiun ?? (r.pension_salary - r.coop_installment);
          waText = [
            `*LAYANAN PENSIUNAN — ESTIMASI BSI PRAPENSIUN (NOS v1.4.6)*`,
            `No. Referensi: ${sim.sim_no}`,
            `Mitra: ${r.bank_name || "BSI — Mitraguna Prima+ Prapensiun"}`,
            `Status Gaji: ${bsi?.status_gaji_label || "Payroll (BSI)"}`,
            `Sub-Produk: ${bsi?.sub_product_label || "Prapen 10 Tahun (Payroll)"}`,
            ``,
            `Yth. Bapak/Ibu *${r.name}*${bsi?.nip ? ` (NIP: ${bsi.nip})` : ""},`,
            `Berikut rincian estimasi fasilitas pembiayaan BSI Prapensiun Anda:`,
            `• Plafond Pengajuan: Rp${Math.round(r.plafond || 0).toLocaleString("id-ID")}`,
            `• Total Tenor: ${r.tenor} Bulan (${bsi?.active_months || 0} bln Aktif + ${bsi?.pension_months || 0} bln Pensiun)`,
            `• Angsuran Masa Aktif: Rp${Math.round(bsi?.active_installment || r.bank_installment || 0).toLocaleString("id-ID")}/bulan`,
            `• Angsuran Masa Pensiun: Rp${Math.round(bsi?.pension_installment || r.coop_installment || 0).toLocaleString("id-ID")}/bulan`,
            `• Sisa Gaji Pensiun: Rp${Math.round(sisaGajiPensiun || 0).toLocaleString("id-ID")}/bulan`,
            `• Margin Aktif / Pensiun: ${r.bank_rate}% / ${r.coop_rate}% p.a.`,
            `• Biaya ADM (1%): Rp${Math.round(r.proaq || 0).toLocaleString("id-ID")}`,
            `• Asuransi Simas Jiwa: Rp${Math.round(bsi?.simas?.premium || r.risk || 0).toLocaleString("id-ID")}`,
            `• Biaya Materai: Rp${Math.round(r.admin_fee || 0).toLocaleString("id-ID")}`,
            `• Blokir Angsuran: Rp${Math.round(r.retention || 0).toLocaleString("id-ID")}`,
            `• Estimasi Terima Bersih: Rp${Math.round(r.net_disbursement || 0).toLocaleString("id-ID")}`,
            ``,
            `Jadwal Proyeksi:`,
            `• Proyeksi Cair: ${bsi?.proyeksi_cair || "-"}`,
            `• Mulai Angsuran: ${bsi?.start_angsuran || "-"}`,
            ``,
            `Status Analisis: ${r.overall_ok ? "MEMENUHI PERSYARATAN" : "PERLU PENYESUAIAN"}`,
            ``,
            `Petugas Pendamping: ${sim.created_by_name || "Petugas Layanan Pensiunan"}`,
            `_Catatan: Angka di atas merupakan simulasi resmi BSI NOS v1.4.6 & Asuransi Simas Jiwa._`
          ].join("\n");
        } else if (isAms2) {
          waText = [
            `*LAYANAN PENSIUNAN — ESTIMASI KOPERASI AMS2*`,
            `No. Referensi: ${sim.sim_no}`,
            `Mitra: Koperasi Simpan Pinjam AMS2`,
            `Kategori: ${r.category}`,
            ``,
            `Yth. Bapak/Ibu *${r.name}*,`,
            `Berikut rincian estimasi pembiayaan pensiun Anda:`,
            `• Plafond Pengajuan: Rp${Math.round(r.plafond || 0).toLocaleString("id-ID")}`,
            `• Jangka Waktu (Tenor): ${r.tenor} Bulan`,
            `• Bunga Koperasi: ${r.coop_rate}% p.a.`,
            `• Angsuran Koperasi: Rp${Math.round(r.coop_installment || 0).toLocaleString("id-ID")}/bulan`,
            `• Sisa Gaji Pensiun: Rp${Math.round(r.remaining_salary || 0).toLocaleString("id-ID")}/bulan`,
            `• Estimasi Terima Bersih: Rp${Math.round(r.net_disbursement || 0).toLocaleString("id-ID")}`,
            ``,
            `Status Analisis: ${r.overall_ok ? "MEMENUHI PERSYARATAN" : "PERLU PENYESUAIAN"}`,
            ``,
            `Petugas Pendamping: ${sim.created_by_name || "Petugas Layanan Pensiunan"}`,
            `_Catatan: Simulasi resmi Koperasi AMS2._`
          ].join("\n");
        } else {
          waText = [
            `*LAYANAN PENSIUNAN — ESTIMASI KREDIT ${(r.bank_name || "").toUpperCase()}*`,
            `No. Referensi: ${sim.sim_no}`,
            `Mitra: ${r.bank_name}`,
            `Kategori: ${r.category}`,
            ``,
            `Yth. Bapak/Ibu *${r.name}*,`,
            `Berikut rincian estimasi fasilitas kredit pensiun Anda:`,
            `• Plafond Pengajuan: Rp${Math.round(r.plafond || 0).toLocaleString("id-ID")}`,
            `• Jangka Waktu (Tenor): ${r.tenor} Bulan`,
            `• Suku Bunga: ${r.bank_rate}% p.a.`,
            `• Angsuran Bulanan: Rp${Math.round(r.coop_installment || 0).toLocaleString("id-ID")}/bulan`,
            `• Sisa Gaji Pensiun: Rp${Math.round(r.remaining_salary || 0).toLocaleString("id-ID")}/bulan`,
            `• Estimasi Terima Bersih: Rp${Math.round(r.net_disbursement || 0).toLocaleString("id-ID")}`,
            ``,
            `Status Analisis: ${r.overall_ok ? "MEMENUHI PERSYARATAN" : "PERLU PENYESUAIAN"}`,
            ``,
            `Petugas Pendamping: ${sim.created_by_name || "Petugas Layanan Pensiunan"}`,
            `_Catatan: Simulasi resmi fasilitas kredit pensiun ${r.bank_name}._`
          ].join("\n");
        }
        setText(waText);
      } else {
        setText(summaryText);
      }
      toast.success("Format ringkasan berhasil disiapkan");
    } catch (e) {
      toast.error(errMsg(e, "Gagal menyiapkan ringkasan konsultasi. Silakan coba lagi."));
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Teks berhasil disalin ke clipboard");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="ai-summary-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#351080]" />
            <p className="font-display text-sm font-bold text-slate-900">Format Ringkasan Konsultasi &amp; Penawaran</p>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Draf pesan profesional siap kirim untuk calon debitur berdasarkan parameter simulasi final.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="h-9 w-[180px] bg-slate-50 text-xs font-medium" data-testid="ai-model-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">Format Ringkas (WhatsApp)</SelectItem>
              <SelectItem value="executive">Format Narasi Eksekutif</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={run}
            disabled={busy}
            className="h-9 bg-[#351080] text-xs font-semibold text-white hover:bg-[#270b61]"
            data-testid="ai-generate-button"
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
            Buat Draf
          </Button>
        </div>
      </div>

      {(text || busy) && (
        <div className="mt-3.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-800 sm:text-sm" data-testid="ai-summary-text">
          {busy ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#351080]" />
              <span>Menyusun draf informasi simulasi...</span>
            </div>
          ) : (
            <>
              <pre className="font-sans whitespace-pre-wrap">{text}</pre>
              <div className="mt-3 border-t border-slate-200 pt-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="h-8 border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100"
                  data-testid="ai-copy-button"
                >
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copied ? "Tersalin ke Clipboard" : "Salin Draf Pesan"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {!text && history.length > 0 && (
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-[#351080] hover:underline">
            Riwayat draf sebelumnya ({history.length})
          </summary>
          <div className="mt-2 space-y-2">
            {history.slice(-3).reverse().map((h) => (
              <div key={h.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[11px] text-slate-400">
                  {h.user_name} • {fmtDateTime(h.created_at)}
                </p>
                <p className="whitespace-pre-wrap text-slate-700">{h.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
