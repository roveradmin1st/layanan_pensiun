import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";
import { initPwaServiceWorker } from "@/lib/pwa";

// Pemulihan otomatis pasca-rilis ketika chunk Vite lama sudah tidak tersedia di server.
// Guard waktu 30 detik di sessionStorage mencegah reload berulang bila jaringan benar-benar offline.
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    try {
      const key = "lp_vite_preload_retry_at";
      const lastRetry = Number(window.sessionStorage?.getItem(key) || "0");
      const now = Date.now();
      if (!lastRetry || now - lastRetry > 30_000) {
        event.preventDefault();
        window.sessionStorage?.setItem(key, String(now));
        window.location.reload();
      }
    } catch {
      /* fallback ke ErrorBoundary */
    }
  });
}

initPwaServiceWorker();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
