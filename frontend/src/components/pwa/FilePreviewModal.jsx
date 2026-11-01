import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
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

  if (!doc) return null;

  const isImage = String(doc.mimeType || "").startsWith("image/");
  const isPdf = String(doc.mimeType || "").includes("pdf") || /\.pdf$/i.test(doc.filename || "");

  return (
    <Dialog open={Boolean(doc)} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl" data-testid="file-preview-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#17223B]">
            <FileText className="h-4 w-4 shrink-0 text-[#351080]" />
            <span className="truncate">{doc.filename || "Pratinjau Dokumen"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Pratinjau dokumen internal. Gunakan tombol Unduh Berkas jika ingin membuka dokumen di pembaca PDF perangkat.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {isImage ? (
            <div className="flex max-h-[65dvh] items-center justify-center overflow-auto p-2">
              <img
                src={doc.url}
                alt={doc.filename || "Dokumen"}
                className="max-h-[62dvh] w-auto rounded object-contain"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={doc.url}
              title={doc.filename || "Pratinjau PDF"}
              className="h-[62dvh] w-full bg-white"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-600">
              <FileText className="h-8 w-8 text-slate-400" />
              <p>Format berkas ini perlu diunduh untuk dibuka di perangkat Anda.</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
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
            onClick={handleDownload}
            className="bg-[#351080] font-semibold text-white hover:bg-[#290c66]"
            data-testid="file-preview-download"
          >
            <Download className="mr-2 h-4 w-4" />
            Unduh Berkas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
