import { useEffect, useState } from "react";
import { Download, FileText, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import { Button } from "../ui/button";

export default function FilePreviewModal() {
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    const onPreview = (e) => {
      if (!e?.detail?.url) return;
      e.preventDefault();
      setDoc((prev) => {
        if (prev?.url && prev.url !== e.detail.url) {
          URL.revokeObjectURL(prev.url);
        }
        return e.detail;
      });
    };
    window.addEventListener("lp:preview-file", onPreview);
    return () => window.removeEventListener("lp:preview-file", onPreview);
  }, []);

  const handleClose = (nextOpen) => {
    if (!nextOpen && doc) {
      const oldUrl = doc.url;
      setDoc(null);
      setTimeout(() => URL.revokeObjectURL(oldUrl), 5000);
    }
  };

  const handleDownload = () => {
    if (!doc?.url) return;
    const a = document.createElement("a");
    a.href = doc.url;
    a.download = doc.filename || "dokumen";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleOpenNewTab = () => {
    if (!doc?.url) return;
    window.open(doc.url, "_blank", "noopener");
  };

  if (!doc) return null;

  const isImage = String(doc.mimeType || "").startsWith("image/");
  const isPdf = String(doc.mimeType || "").includes("pdf") || /\.pdf$/i.test(doc.filename || "");
  const isCorruptOrDummy = doc.blobSize !== undefined && doc.blobSize < 15;

  return (
    <Dialog open={Boolean(doc)} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl transition-all duration-200 animate-in fade-in-0 zoom-in-95" data-testid="file-preview-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#17223B]">
            <FileText className="h-4 w-4 shrink-0 text-[#351080]" />
            <span className="truncate">{doc.title || doc.filename || "Pratinjau Dokumen"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {doc.title && doc.filename ? `${doc.filename} • ` : ""}Pratinjau dokumen internal dengan verifikasi keamanan.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {isCorruptOrDummy ? (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="rounded-full bg-amber-100 p-3 text-amber-600">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Berkas Dokumen Belum Lengkap / Data Dummy Lama</h4>
                <p className="mt-1 max-w-md text-xs text-slate-500">
                  Berkas ini hanya berukuran {doc.blobSize} bytes (stub data uji coba UAT terdahulu) dan belum memuat halaman PDF utuh. Silakan minta petugas atau nasabah mengunggah ulang dokumen PDF / foto asli.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="mt-2 text-xs"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Unduh Data Mentah ({doc.blobSize} bytes)
              </Button>
            </div>
          ) : isImage ? (
            <div className="flex max-h-[68dvh] items-center justify-center overflow-auto p-2">
              <img
                src={doc.url}
                alt={doc.filename || "Dokumen"}
                className="max-h-[65dvh] w-auto rounded object-contain shadow-sm"
              />
            </div>
          ) : isPdf ? (
            <object
              data={doc.url}
              type="application/pdf"
              className="h-[65dvh] w-full bg-white"
              title={doc.filename || "Pratinjau PDF"}
            >
              <iframe
                src={doc.url}
                title={doc.filename || "Pratinjau PDF"}
                className="h-[65dvh] w-full bg-white border-0"
              >
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-600">
                  <FileText className="h-8 w-8 text-slate-400" />
                  <p>Peramban Anda tidak dapat merender pratinjau PDF di dalam bingkai.</p>
                  <Button type="button" variant="outline" size="sm" onClick={handleOpenNewTab}>
                    Buka Dokumen di Tab Baru
                  </Button>
                </div>
              </iframe>
            </object>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-600">
              <FileText className="h-8 w-8 text-slate-400" />
              <p>Format berkas ini perlu diunduh untuk dibuka di perangkat Anda.</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              data-testid="file-preview-close"
            >
              Tutup
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDownload}
              className="font-medium text-slate-700"
              data-testid="file-preview-download"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Unduh Berkas
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleOpenNewTab}
              className="text-xs text-slate-600 hover:text-slate-900"
              title="Buka dokumen di tab baru"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Buka di Tab Baru
            </Button>
          </div>

          {doc.reviewActions && (
            <div className="flex items-center gap-2">
              {doc.reviewActions.onReject && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleClose(false);
                    doc.reviewActions.onReject();
                  }}
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  data-testid="modal-reject-doc"
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Minta Revisi
                </Button>
              )}
              {doc.reviewActions.onAccept && (
                <Button
                  type="button"
                  onClick={() => {
                    handleClose(false);
                    doc.reviewActions.onAccept();
                  }}
                  className="bg-[#078D67] text-white hover:bg-[#067253] font-semibold"
                  data-testid="modal-accept-doc"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Terima Dokumen
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
