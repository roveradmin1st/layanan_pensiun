import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthCtx = createContext(null);

// Sesi disimpan sepenuhnya di cookie HttpOnly `lp_token`; tidak ada token di Web Storage.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data?.user || data);
    } catch {
      try {
        const { data } = await api.post("/auth/refresh");
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
    window.addEventListener("auth:password-required", refresh);
    return () => {
      window.removeEventListener("auth:logout", onLogout);
      window.removeEventListener("auth:password-required", refresh);
    };
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    const u = data?.user || data;
    setUser(u);
    return u;
  };

  const quickRole = async (role) => {
    const { data } = await api.post("/auth/quick-role", { role });
    const u = data?.user || data;
    setUser(u);
    return u;
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    window.dispatchEvent(new Event("auth:logout"));
    setUser(false);
  };

  return <AuthCtx.Provider value={{ user, login, quickRole, logout, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
