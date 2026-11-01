import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, Smartphone } from "lucide-react";
import { usePwaInstall } from "../../lib/pwa";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import { Button } from "../ui/button";

export default function InstallAppButton({ variant = "sidebar", className = "" }) {
  const { isStandalone, canNativePrompt, env, promptNativeInstall } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  // Sembunyikan seluruh tombol instalasi apabila aplikasi sudah berjalan di mode layar penuh (Standalone WebAPK)
  if (isStandalone) return null;

  const handleClick = async () => {
    if (canNativePrompt) {
      const res = await promptNativeInstall();
      if (res?.outcome === "accepted") {
        toast.success("Aplikasi Layanan Pensiunan sedang dipasang ke layar utama.");
      }
      return;
    }
    setGuideOpen(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Alamat aplikasi disalin. Buka Google Chrome lalu tempel alamat tersebut.");
    } catch {
      toast.info(`Salin alamat ini ke Google Chrome: ${window.location.origin}`);
    }
  };

  const needsChromeSwitch = env.isAndroid && (env.isInAppWebView || env.isOemBrowser || !env.isRecommendedChromium);

  return (
    <>
      {variant === "header" && (
        <button
          type="button"
          onClick={handleClick}
          data-testid="pwa-install-header"
          className={`inline-flex items-center gap-1 rounded-md border border-[#351080]/20 bg-[#351080]/5 px-2.5 py-1 text-[11px] font-bold text-[#351080] transition hover:bg-[#351080]/10 ${className}`}
        >
          <Download className="h-3.5 w-3.5" />
          <span>Instal</span>
        </button>
      )}

      {variant === "sidebar" && (
        <button
          type="button"
          onClick={handleClick}
          data-testid="pwa-install-sidebar"
          className={`mb-2.5 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-[#17223B] transition hover:border-[#351080]/40 hover:bg-slate-50 ${className}`}
        >
          <span className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 shrink-0 text-[#351080]" />
            <span>Pasang Aplikasi di HP</span>
          </span>
          <span className="rounded bg-[#351080]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#351080]">
            Aplikasi
          </span>
        </button>
      )}

      {variant === "login" && (
        <div
          className={`mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 ${className}`}
          data-testid="pwa-install-login"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Smartphone className="h-4 w-4 shrink-0 text-[#351080]" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#17223B]">Gunakan sebagai Aplikasi HP</p>
              <p className="truncate text-[11px] text-slate-500">Tampilan layar penuh tanpa bar alamat browser</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleClick}
            className="h-8 shrink-0 border-[#351080]/30 text-xs font-bold text-[#351080] hover:bg-[#351080]/5"
            data-testid="pwa-install-login-btn"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Pasang
          </Button>
        </div>
      )}

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-md" data-testid="pwa-install-dialog">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#17223B]">
              Pasang Aplikasi Layanan Pensiunan
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ikuti langkah singkat berikut agar aplikasi berjalan layar penuh seperti aplikasi Android tanpa bar alamat web.
            </DialogDescription>
          </DialogHeader>

          {needsChromeSwitch ? (
            <div className="space-y-3 text-xs text-slate-700">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <p className="font-bold">Gunakan Browser Google Chrome</p>
                <p className="mt-1 leading-relaxed">
                  Saat ini Anda membuka dari browser bawaan / WhatsApp. Agar aplikasi terpasang penuh (tanpa bar alamat), buka melalui <b>Google Chrome</b>.
                </p>
              </div>
              <ol className="list-decimal space-y-1.5 pl-4 leading-relaxed">
                <li>Ketuk tombol <b>Buka di Google Chrome</b> di bawah (atau salin link ke Chrome).</li>
                <li>Setelah terbuka di Chrome, ketuk tombol <b>Pasang</b> atau menu <b>⋮</b> di pojok kanan atas lalu pilih <b>Instal aplikasi</b>.</li>
              </ol>
            </div>
          ) : env.isIos ? (
            <div className="space-y-2.5 text-xs text-slate-700">
              <ol className="list-decimal space-y-2 pl-4 leading-relaxed">
                <li>Pastikan halaman ini dibuka menggunakan browser <b>Safari</b>.</li>
                <li>Ketuk ikon <b>Bagikan (Share)</b> di bagian bawah layar.</li>
                <li>Pilih menu <b>Tambahkan ke Layar Utama</b> (<i>Add to Home Screen</i>), lalu ketuk <b>Tambah</b>.</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-2.5 text-xs text-slate-700">
              <ol className="list-decimal space-y-2 pl-4 leading-relaxed">
                <li>Pastikan Anda membuka alamat ini menggunakan <b>Google Chrome</b>.</li>
                <li>Ketuk ikon menu tiga titik (<b>⋮</b>) di pojok kanan atas Chrome (atau ikon instal di kanan bar alamat).</li>
                <li>Pilih <b>Instal aplikasi</b> (<i>Install app</i>) atau <b>Tambahkan ke layar utama</b>.</li>
              </ol>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" size="sm" onClick={copyLink} data-testid="pwa-copy-link-btn">
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Salin Link
            </Button>
            {needsChromeSwitch && env.chromeIntentUrl ? (
              <a
                href={env.chromeIntentUrl}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#351080] px-3.5 text-xs font-bold text-white hover:bg-[#290c66]"
                data-testid="pwa-open-chrome-intent"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Buka di Google Chrome
              </a>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setGuideOpen(false)}
                className="bg-[#351080] text-xs font-bold text-white hover:bg-[#290c66]"
              >
                Mengerti
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
