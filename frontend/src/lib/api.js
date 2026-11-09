import axios from "axios";

const BASE = (import.meta.env?.VITE_BACKEND_URL || "").replace(/\/$/, "");
export const API = `${BASE}/api`;
export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: {
    "ngrok-skip-browser-warning": "true"
  }
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("lp_access_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = null;
api.interceptors.response.use(
  (r) => {
    if (r.data?.access_token) sessionStorage.setItem("lp_access_token", r.data.access_token);
    return r;
  },
  async (err) => {
    const cfg = err.config || {};
    if (err.response?.data?.error_code === "PASSWORD_CHANGE_REQUIRED") window.dispatchEvent(new Event("auth:password-required"));
    if (err.response?.status === 401 && !cfg._retry && !String(cfg.url).includes("/auth/")) {
      cfg._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh");
        const { data } = await refreshing;
        if (data?.access_token) sessionStorage.setItem("lp_access_token", data.access_token);
        refreshing = null;
        return api(cfg);
      } catch {
        refreshing = null;
        sessionStorage.removeItem("lp_access_token");
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    return Promise.reject(err);
  }
);

export function errMsg(e, fallback = "Terjadi kesalahan. Silakan coba lagi.") {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message ? fallback : fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return d.msg || String(d);
}

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const isMedia = Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches);
  const isNav = window.navigator?.standalone === true;
  const isParam = Boolean(new URLSearchParams(window.location.search).get("source") === "pwa");
  return isMedia || isNav || isParam;
}

export async function downloadFile(path, fallbackName) {
  const res = await api.get(path, { responseType: "blob" });
  const cd = res.headers["content-disposition"] || "";
  const m = cd.match(/filename="([^"]+)"/);
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = m ? m[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Jeda 30 detik agar Download Manager Android selesai membaca blob pada HP RAM kecil
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function openFile(path, options = {}) {
  const res = await api.get(path, { responseType: "blob" });
  const cd = res.headers["content-disposition"] || "";
  const m = cd.match(/filename="([^"]+)"/);
  const filename = m ? m[1] : (path.split("/").pop() || "dokumen");
  const rawMime = res.data?.type || res.headers["content-type"] || "application/octet-stream";
  const isPdf = filename.toLowerCase().endsWith(".pdf") || rawMime.includes("pdf");
  const mimeType = isPdf ? "application/pdf" : rawMime;

  let blob = res.data;
  if (isPdf && blob.type !== "application/pdf") {
    blob = new Blob([res.data], { type: "application/pdf" });
  }

  const blobSize = blob.size;
  const url = URL.createObjectURL(blob);
  const document = { version: Number(res.headers["x-document-version"]), sha256: res.headers["x-document-sha256"] };

  // Selalu prioritaskan preview in-app modal (popup animasi ringan) agar admin/petugas tidak perlu buka tab baru
  if (typeof window !== "undefined" && !options?.forceNewTab) {
    const ev = new CustomEvent("lp:preview-file", {
      cancelable: true,
      detail: { url, filename, mimeType, blobSize, document, ...options }
    });
    const cancelled = !window.dispatchEvent(ev);
    if (cancelled) return document;
  }

  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return document;
}
