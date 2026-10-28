import axios from "axios";

const BASE = (import.meta.env?.VITE_BACKEND_URL || "").replace(/\/$/, "");
export const API = `${BASE}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });

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
  (r) => r,
  async (err) => {
    const cfg = err.config || {};
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function openFile(path) {
  const res = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  window.open(url, "_blank", "noopener");
}
