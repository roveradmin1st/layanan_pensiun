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
          const isCapPensiun = cap?.product === "pensiun";
          const maxTenorVal = cap?.max_credit_months || cap?.credit_months || r.tenor || 0;
          const reqTenorVal = cap?.credit_months ?? r.tenor ?? 0;
          const retLabel = isCapPensiun ? "Total Retensi (2x Angsuran)" : "Total Retensi";
          waText = [
            `*LAYANAN PENSIUNAN — SIMULASI KREDIT DASA CIPTA BERKARYA (PS3 CAPITAL)*`,
            `No. Referensi: ${sim.sim_no}`,
            `Produk: ${cap?.product_label || r.category}`,
            ``,
            `Yth. Bapak/Ibu *${r.name}*,`,
            `Berikut hasil simulasi fasilitas kredit pensiun Anda:`,
            `• Gaji Bulanan: Rp${Math.round(r.salary || 0).toLocaleString("id-ID")}`,
            `• Tenor Kredit Maksimal: ${maxTenorVal} bulan`,
            ...(!isCapPensiun ? [`• Tenor PP: ${cap?.pp_months ?? 0} bulan`] : []),
            `• Tenor Diajukan: ${reqTenorVal} bulan`,
            `• Batas Angsuran Maksimal (90%): Rp${Math.round(cap?.payment_cap ?? ((r.salary || 0) * 0.9)).toLocaleString("id-ID")}`,
            `• Angsuran Aktual: Rp${Math.round(cap?.actual_payment ?? r.coop_installment ?? 0).toLocaleString("id-ID")}/bulan`,
            `• Plafon Maksimal: Rp${Math.round(cap?.recommendation_max_loan ?? r.plafond ?? 0).toLocaleString("id-ID")}`,
            `• Plafon Diajukan: Rp${Math.round(cap?.loan ?? r.plafond ?? 0).toLocaleString("id-ID")}`,
            `• Biaya Kredit: Rp${Math.round(cap?.cost ?? r.total_fees ?? 0).toLocaleString("id-ID")}`,
            `• ${retLabel}: Rp${Math.round(cap?.total_retention ?? r.retention ?? 0).toLocaleString("id-ID")}`,
            `• Pencairan Bersih: Rp${Math.round(cap?.net_cash ?? r.net_disbursement ?? 0).toLocaleString("id-ID")}`,
            `• Sisa Gaji Setelah Angsuran: Rp${Math.round(cap?.salary_left ?? r.remaining_salary ?? 0).toLocaleString("id-ID")}`,
            ``,
            `*HIGHLIGHT POINT HASIL SIMULASI:*`,
            `• *PLAFON:* Rp${Math.round(cap?.loan ?? r.plafond ?? 0).toLocaleString("id-ID")}`,
            `• *TENOR:* ${reqTenorVal} Bulan`,
            `• *SISA BERSIH:* Rp${Math.round(cap?.net_cash ?? r.net_disbursement ?? 0).toLocaleString("id-ID")}`,
            `• *SISA GAJI:* Rp${Math.round(cap?.salary_left ?? r.remaining_salary ?? 0).toLocaleString("id-ID")}`,
            ``,
            `Petugas Pendamping: ${sim.created_by_name || "Petugas Layanan Pensiunan"}`,
            `_Estimasi simulasi fasilitas pembiayaan pensiun DASA CIPTA BERKARYA_`
          ].join("\n");
        } else if (isBsi) {
          const isTriBerkah = bsi?.sub_product === "PP3";
          const headerTitle = isTriBerkah ? "PRA PENSIUN TRI BERKAH" : "PRA PENSIUN DEKADE BERKAH";
          const blokirActiveCnt = bsi?.blokir_active_count ?? (isTriBerkah ? (bsi?.active_months || 1) : 1);
          const blokirPensionCnt = bsi?.blokir_pension_count ?? 2;
          const sisaGajiPensiun = bsi?.sisa_gaji_pensiun ?? (r.pension_salary - r.coop_installment);
          waText = [
            `*LAYANAN PENSIUNAN — ${headerTitle} (BANK BSI)*`,
            `No. Referensi: ${sim.sim_no}`,
            ``,
            `Yth. Bapak/Ibu *${r.name}*${bsi?.nip ? ` (NIP: ${bsi.nip})` : ""},`,
            `Berikut rincian estimasi fasilitas pembiayaan prapensiun Anda:`,
            `• Plafond: Rp${Math.round(r.plafond || 0).toLocaleString("id-ID")}`,
            `• Jangka Waktu: ${r.tenor} Bulan`,
            `• Angsuran saat Aktif PNS: Rp${Math.round(bsi?.active_installment || r.bank_installment || 0).toLocaleString("id-ID")}/bulan`,
            `• Angsuran saat Pensiun: Rp${Math.round(bsi?.pension_installment || r.coop_installment || 0).toLocaleString("id-ID")}/bulan`,
            ``,
            `*Rincian Biaya & Blokir Angsuran:*`,
            `• Administrasi (${r.proaq_pct ?? 1}%): Rp${Math.round(r.proaq || 0).toLocaleString("id-ID")}`,
            `• Asuransi: ${bsi?.is_atribusi ? "-" : `Rp${Math.round(r.risk || 0).toLocaleString("id-ID")}`}`,
            `• Materai: Rp${Math.round(r.admin_fee || 100000).toLocaleString("id-ID")}`,
            `• Blokir ${blokirActiveCnt}x Angs Masa Aktif: Rp${Math.round(bsi?.blokir_aktif || (bsi?.active_installment || r.bank_installment || 0) * blokirActiveCnt).toLocaleString("id-ID")}`,
            `• Blokir ${blokirPensionCnt}x Angs Masa Pensiun: Rp${Math.round(bsi?.blokir_pensiun || (bsi?.pension_installment || r.coop_installment || 0) * blokirPensionCnt).toLocaleString("id-ID")}`,
            ...(Number(r.buka_blokir_lama || bsi?.buka_blokir_lama || 0) > 0
              ? [`• Buka Blokir Yang Lama: Rp${Math.round(r.buka_blokir_lama || bsi?.buka_blokir_lama || 0).toLocaleString("id-ID")}`]
              : []),
            ...(Number(r.take_over || bsi?.pelunasan_lama || 0) > 0
              ? [`• Pelunasan Yang Lama: Rp${Math.round(r.take_over || bsi?.pelunasan_lama || 0).toLocaleString("id-ID")}`]
              : []),
            ``,
            `• *Terima Bersih: Rp${Math.round(r.net_disbursement || 0).toLocaleString("id-ID")}*`,
            `• Sisa Gaji Masa Pensiun: Rp${Math.round(sisaGajiPensiun || 0).toLocaleString("id-ID")}/bulan`,
            ``,
            `Petugas Pendamping: ${sim.created_by_name || "Petugas Layanan Pensiunan"}`,
            `_Estimasi simulasi fasilitas pembiayaan Bank Syariah Indonesia (BSI)_`
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
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2.5">
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
                <Button
                  size="sm"
                  onClick={() => {
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
                  }}
                  className="h-8 bg-[#078D67] text-xs font-semibold text-white hover:bg-[#067455]"
                  data-testid="wa-share-button"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Kirim via WhatsApp
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
