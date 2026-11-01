import { useEffect, useState } from "react";
import { isStandalonePwa } from "./api";

let deferredPrompt = (typeof window !== "undefined" && window.__lpDeferredPrompt) || null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

export function refreshManifestLink() {
  if (typeof document === "undefined") return;
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return;
  const next = document.createElement("link");
  next.rel = "manifest";
  next.href = `/manifest.webmanifest?v=${Date.now()}`;
  next.crossOrigin = "use-credentials";
  link.replaceWith(next);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.__lpDeferredPrompt = e;
    notify();
  });

  window.addEventListener("lp:pwa-prompt-ready", () => {
    if (window.__lpDeferredPrompt) {
      deferredPrompt = window.__lpDeferredPrompt;
      notify();
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.__lpDeferredPrompt = null;
    notify();
  });

  const mq = window.matchMedia?.("(display-mode: standalone)");
  if (mq?.addEventListener) {
    mq.addEventListener("change", notify);
  }
}

export function detectBrowserEnvironment() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isAndroid: false,
      isIos: false,
      isInAppWebView: false,
      isOemBrowser: false,
      isRecommendedChromium: true,
      chromeIntentUrl: ""
    };
  }

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isInAppWebView = /\bwv\b|FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger/i.test(ua);
  const isOemBrowser = /MiuiBrowser|VivoBrowser|HeyTapBrowser|OppoBrowser|HuaweiBrowser|UCBrowser|Firefox/i.test(ua);
  const isChromeOrEdge = /(Chrome|CriOS|EdgA|SamsungBrowser)\/\d+/i.test(ua) && !isInAppWebView && !isOemBrowser;

  let chromeIntentUrl = "";
  if (isAndroid) {
    const scheme = window.location.protocol.replace(":", "") || "https";
    const hostAndPath = `${window.location.host}${window.location.pathname}${window.location.search}`;
    chromeIntentUrl = `intent://${hostAndPath}#Intent;scheme=${scheme};package=com.android.chrome;end`;
  }

  return {
    isAndroid,
    isIos,
    isInAppWebView,
    isOemBrowser,
    isRecommendedChromium: isChromeOrEdge,
    chromeIntentUrl
  };
}

export function usePwaInstall() {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.__lpDeferredPrompt && !deferredPrompt) {
      deferredPrompt = window.__lpDeferredPrompt;
    }
    const rerender = () => setTick((t) => t + 1);
    listeners.add(rerender);
    return () => listeners.delete(rerender);
  }, []);

  const isStandalone = isStandalonePwa();
  const canNativePrompt = Boolean(deferredPrompt || (typeof window !== "undefined" && window.__lpDeferredPrompt)) && !isStandalone;
  const env = detectBrowserEnvironment();

  const promptNativeInstall = async () => {
    if (env.isIos) return { outcome: "ios" };

    let promptEvent = deferredPrompt || (typeof window !== "undefined" ? window.__lpDeferredPrompt : null);

    // Jika event native belum selesai dievaluasi oleh Chrome (misal baru saja buka halaman),
    // segarkan manifest via Service Worker dan tunggu hingga 2.5 detik
    if (!promptEvent) {
      refreshManifestLink();
      for (let i = 0; i < 16; i++) {
        await new Promise((r) => setTimeout(r, 150));
        promptEvent = deferredPrompt || (typeof window !== "undefined" ? window.__lpDeferredPrompt : null);
        if (promptEvent) break;
      }
    }

    if (!promptEvent) return { outcome: "unavailable" };

    promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (choice?.outcome === "accepted") {
      deferredPrompt = null;
      if (typeof window !== "undefined") window.__lpDeferredPrompt = null;
      notify();
    }
    return choice;
  };

  return {
    isStandalone,
    canNativePrompt,
    env,
    promptNativeInstall
  };
}

export function initPwaServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Mode development (localhost:5173): pastikan tidak ada Service Worker aktif yang menahan HMR / kode baru
  if (!import.meta.env.PROD) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) {
        reg.unregister();
      }
    }).catch(() => {});
    return;
  }

  // Mode production: daftarkan Service Worker segera agar manifest & icon ter-cache untuk prompt instalasi
  const registerSw = () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Saat SW pertama kali mengambil alih halaman (kunjungan pertama via Ngrok),
      // segarkan link manifest agar Chrome mengevaluasi ulang PWA melalui SW
      if (!hadController) {
        if (!deferredPrompt && !window.__lpDeferredPrompt) {
          refreshManifestLink();
        }
        return;
      }
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (reg.active && !deferredPrompt && !window.__lpDeferredPrompt) {
          refreshManifestLink();
        }
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            reg.update().catch(() => {});
          }
        });
      })
      .catch(() => {});
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerSw, { once: true });
  } else {
    registerSw();
  }
}
