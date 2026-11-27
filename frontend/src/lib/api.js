import axios from "axios";

const BASE = (import.meta.env?.VITE_BACKEND_URL || "").replace(/\/$/, "");
export const API = `${BASE}/api`;

// Wave 3 (P1): sesi hanya dibawa oleh cookie HttpOnly `lp_token` (Secure; SameSite=Lax).
// Token akses tidak lagi disimpan di sessionStorage agar tidak dapat dibaca skrip (XSS).
// Header X-Requested-With wajib dikirim untuk lolos proteksi CSRF pada mutasi internal.
const LEGACY_TOKEN_KEY = "lp_access_token";
try {
  if (typeof window !== "undefined") window.sessionStorage?.removeItem(LEGACY_TOKEN_KEY);
} catch {
  /* storage tidak tersedia */
}

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: {
    "X-Requested-With": "XMLHttpRequest",
    "ngrok-skip-browser-warning": "true"
  }
});

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err.config || {};
    if (err.response?.data?.error_code === "PASSWORD_CHANGE_REQUIRED") window.dispatchEvent(new Event("auth:password-required"));
    if (err.response?.status === 401 && !cfg._retry && !String(cfg.url).includes("/auth/")) {
      cfg._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh");
        await refreshing;
        refreshing = null;
        return api(cfg);
      } catch {
        refreshing = null;
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

export const SAFE_PREVIEW_MIME_TYPES = Object.freeze(["application/pdf", "image/png", "image/jpeg"]);

export function resolveSafePreviewMime(rawMime, filename = "") {
  const mime = String(rawMime || "").split(";")[0].trim().toLowerCase();
  if (SAFE_PREVIEW_MIME_TYPES.includes(mime)) return mime;
  if (mime === "image/jpg" || mime === "image/pjpeg") return "image/jpeg";
  const lower = String(filename || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function openFile(path, options = {}) {
  const res = await api.get(path, { responseType: "blob" });
  const cd = res.headers["content-disposition"] || "";
  const m = cd.match(/filename="([^"]+)"/);
  const filename = m ? m[1] : (path.split("/").pop() || "dokumen");
  const rawMime = res.data?.type || res.headers["content-type"] || "application/octet-stream";
  const mimeType = resolveSafePreviewMime(rawMime, filename);

  // Paksa Blob ke MIME allowlist (PDF/PNG/JPEG); tipe lain jadi octet-stream sehingga
  // tidak pernah dirender sebagai HTML/SVG aktif di origin aplikasi.
  const blob = res.data?.type === mimeType ? res.data : new Blob([res.data], { type: mimeType });

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

  if (mimeType === "application/octet-stream") {
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(url, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return document;
}
