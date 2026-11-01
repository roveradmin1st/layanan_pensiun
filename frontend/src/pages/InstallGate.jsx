import { useState, useEffect, useRef } from "react";
import { Download, CheckCircle2, ExternalLink, Lock, X, Share, PlusSquare } from "lucide-react";
import { usePwaInstall } from "../lib/pwa";
import { toast } from "sonner";

const PORTAL_SECURITY_PIN = "153363";

export default function InstallGate({ onBypass }) {
  const { env, promptNativeInstall } = usePwaInstall();
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // State PIN Pengaman Portal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const pinInputRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleInstalled = () => {
        setInstalled(true);
        setShowManual(false);
        toast.success("Aplikasi berhasil dipasang.");
      };
      window.addEventListener("appinstalled", handleInstalled);
      return () => window.removeEventListener("appinstalled", handleInstalled);
    }
  }, []);

  useEffect(() => {
    if (pinModalOpen) {
      setPinValue("");
      setPinError("");
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 80);
    }
  }, [pinModalOpen]);

  const handleInstallClick = async () => {
    if (env.isIos) {
      setShowManual(true);
      return;
    }

    setInstalling(true);
    setShowManual(false);
    try {
      const res = await promptNativeInstall();
      if (res?.outcome === "accepted") {
        setInstalled(true);
        toast.success("Aplikasi berhasil dipasang di layar utama.");
        return;
      }
      if (res?.outcome === "unavailable" || res?.outcome === "ios") {
        setShowManual(true);
      }
    } catch (err) {
      console.error(err);
      setShowManual(true);
    } finally {
      setInstalling(false);
    }
  };

  const executeBypass = () => {
    sessionStorage.setItem("lp_bypass_pwa", "1");
    if (onBypass) {
      onBypass();
    } else {
      window.location.href = "/login";
    }
  };

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPinValue(val);
    if (pinError) setPinError("");

    // Otomatis buka jika 6 digit sesuai PIN 153363
    if (val.length === 6) {
      if (val === PORTAL_SECURITY_PIN) {
        toast.success("Akses portal dibuka.");
        executeBypass();
      } else {
        setPinError("Kode PIN pengaman tidak valid.");
        setTimeout(() => setPinValue(""), 250);
      }
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinValue === PORTAL_SECURITY_PIN) {
      toast.success("Akses portal dibuka.");
      executeBypass();
    } else {
      setPinError("Kode PIN pengaman tidak valid.");
      setPinValue("");
      pinInputRef.current?.focus();
    }
  };

  const needsChromeSwitch =
    env.isAndroid && (env.isInAppWebView || env.isOemBrowser || !env.isRecommendedChromium);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-8 selection:bg-purple-500 selection:text-white">
      {/* Spacer atas */}
      <div className="w-full max-w-sm mx-auto" />

      {/* Main Minimalist Container */}
      <div className="w-full max-w-sm mx-auto my-auto text-center">
        {/* App Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-3 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <img
              src="/brand/pwa-192x192.png"
              alt="Layanan Pensiunan"
              className="h-20 w-20 rounded-2xl object-contain shadow-md"
            />
          </div>
        </div>

        {/* Title — Bersih, formal, tanpa bocoran info operasional */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            Layanan Pensiunan
          </h1>
          <p className="mt-1 text-xs text-slate-400">Aplikasi Mobile</p>
        </div>

        {/* Action Button */}
        {installed ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-center">
            <div className="inline-flex p-2 rounded-full bg-emerald-500/20 text-emerald-400 mb-2">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-emerald-300">Aplikasi Sudah Terpasang</p>
            <p className="mt-1 text-xs text-slate-400">
              Silakan buka melalui ikon di layar utama HP Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {needsChromeSwitch ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300 space-y-3">
                <p className="text-slate-300">
                  Untuk memasang aplikasi, silakan buka melalui <b>Google Chrome</b>.
                </p>
                {env.chromeIntentUrl && (
                  <a
                    href={env.chromeIntentUrl}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition shadow-md"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Buka di Google Chrome</span>
                  </a>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                data-testid="install-gate-btn"
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-[#5720b8] hover:bg-[#6c28e0] active:scale-[0.98] py-3.5 px-4 font-semibold text-white shadow-lg shadow-purple-950/50 transition disabled:opacity-70"
              >
                <Download className="h-4 w-4" />
                <span>{installing ? "Menyiapkan Unduhan..." : "Pasang Aplikasi"}</span>
              </button>
            )}

            {/* Panduan Visual Khusus iPhone (iOS) */}
            {showManual && env.isIos && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 text-left text-xs text-slate-300 space-y-2.5 animate-in fade-in">
                <p className="font-semibold text-white text-center pb-1">
                  Cara Pasang di iPhone / iPad:
                </p>
                <div className="flex items-center gap-3 rounded-xl bg-slate-950/70 p-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                    <Share className="h-4 w-4" />
                  </div>
                  <span>
                    1. Ketuk tombol <b>Share / Bagikan</b> di bilah bawah Safari (atau kanan atas Chrome).
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-slate-950/70 p-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                    <PlusSquare className="h-4 w-4" />
                  </div>
                  <span>
                    2. Pilih <b>Tambahkan ke Layar Utama</b> (<i>Add to Home Screen</i>), lalu ketuk <b>Tambah</b>.
                  </span>
                </div>
              </div>
            )}

            {/* Panduan Fallback Android */}
            {showManual && !env.isIos && !needsChromeSwitch && (
              <p className="text-xs text-slate-400 pt-2 leading-relaxed">
                Jika aplikasi sudah pernah terpasang, silakan buka langsung dari layar utama HP. Atau ketuk menu (<b>⋮</b>) di kanan atas browser lalu pilih <b>Instal aplikasi</b>.
              </p>
            )}
          </div>
        )}

        {/* Tautan Masuk ke Portal dengan Proteksi PIN */}
        <div className="mt-8 pt-4">
          {!pinModalOpen ? (
            <button
              type="button"
              onClick={() => setPinModalOpen(true)}
              data-testid="open-portal-pin-btn"
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Masuk ke Portal →
            </button>
          ) : (
            <form
              onSubmit={handlePinSubmit}
              className="mx-auto max-w-[280px] rounded-2xl border border-slate-800 bg-slate-900/90 p-4 text-left shadow-xl animate-in fade-in"
              data-testid="portal-pin-form"
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <Lock className="h-3.5 w-3.5 text-purple-400" />
                  <span>PIN Pengaman Portal</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="text-slate-500 hover:text-slate-300 p-0.5"
                  aria-label="Tutup"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinValue}
                onChange={handlePinChange}
                placeholder="••••••"
                data-testid="portal-pin-input"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-center text-base font-bold tracking-[0.45em] text-white placeholder:tracking-normal placeholder:text-slate-600 focus:border-purple-500 focus:outline-none"
              />

              {pinError && (
                <p className="mt-2 text-center text-[11px] font-medium text-red-400" data-testid="portal-pin-error">
                  {pinError}
                </p>
              )}

              <button
                type="submit"
                data-testid="portal-pin-submit"
                className="mt-3 w-full rounded-xl bg-purple-600 hover:bg-purple-500 py-2 text-xs font-semibold text-white transition"
              >
                Buka Portal
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Spacer Bawah */}
      <div className="w-full max-w-sm mx-auto text-center text-[10px] text-slate-600">
        <p>© Layanan Pensiunan</p>
      </div>
    </div>
  );
}
