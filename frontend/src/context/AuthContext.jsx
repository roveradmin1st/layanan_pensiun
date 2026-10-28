import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data?.user || data);
    } catch {
      try {
        const { data } = await api.post("/auth/refresh");
        if (data?.access_token) sessionStorage.setItem("lp_access_token", data.access_token);
        setUser(data?.user || data);
      } catch {
        setUser(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const onLogout = () => setUser(false);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data?.access_token) sessionStorage.setItem("lp_access_token", data.access_token);
    const u = data?.user || data;
    setUser(u);
    return u;
  };

  const quickRole = async (role) => {
    const { data } = await api.post("/auth/quick-role", { role });
    if (data?.access_token) sessionStorage.setItem("lp_access_token", data.access_token);
    const u = data?.user || data;
    setUser(u);
    return u;
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    sessionStorage.removeItem("lp_access_token");
    setUser(false);
  };

  return <AuthCtx.Provider value={{ user, login, quickRole, logout, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
