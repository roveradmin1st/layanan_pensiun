import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api, errMsg } from "../../lib/api";
import { Logo } from "../brand/Logo";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

export default function PasswordChangeGate() {
  const { user, refresh, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (password !== confirm) return setError("Konfirmasi kata sandi belum sama.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: password });
      await refresh();
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
    <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-sm" data-testid="password-change-gate">
      <Logo size="md" />
      <h1 className="mt-7 text-2xl font-bold text-[#17223B]">Buat kata sandi pribadi</h1>
      <p className="mt-2 text-sm text-slate-600">Halo {user.name}. Ganti kata sandi sementara sebelum melanjutkan. Gunakan minimal 12 karakter dan simpan secara pribadi.</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div className="space-y-1"><Label htmlFor="initial-current">Kata sandi sementara / saat ini</Label><Input id="initial-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="initial-new">Kata sandi baru</Label><Input id="initial-new" type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="initial-confirm">Ulangi kata sandi baru</Label><Input id="initial-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full bg-[#351080]">{busy ? "Menyimpan..." : "Simpan dan lanjutkan"}</Button>
      </form>
      <Button variant="ghost" className="mt-3 w-full" onClick={logout}>Keluar dari akun</Button>
    </section>
  </main>;
}
