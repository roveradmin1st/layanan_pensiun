import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { AuthShell } from "./Login";
import { Logo } from "../components/brand/Logo";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { CtaButton } from "../components/common";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setError("Kata sandi minimal 8 karakter");
    if (pw !== pw2) return setError("Konfirmasi kata sandi tidak sama");
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token: params.get("token") || "", password: pw });
      setDone(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <Logo size="md" className="mb-10" />
      <h1 className="font-display text-3xl font-bold text-[#17223B]">Atur kata sandi baru</h1>
      {done ? (
        <div className="mt-6 space-y-4" data-testid="reset-success">
          <div className="flex gap-3 rounded-xl border border-[#078D67]/20 bg-[#078D67]/5 p-4 text-sm">
            <CheckCircle2 className="h-5 w-5 text-[#078D67]" /> Kata sandi berhasil diperbarui.
          </div>
          <Link to="/login" className="font-semibold text-[#5720B8] hover:underline">Masuk sekarang</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-5">
          {error && <p role="alert" className="text-sm text-red-600" data-testid="reset-error">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="pw">Kata sandi baru</Label>
            <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" data-testid="reset-password-input" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">Ulangi kata sandi</Label>
            <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-11" data-testid="reset-password-confirm-input" />
          </div>
          <CtaButton type="submit" disabled={busy} className="h-11 w-full font-semibold" data-testid="reset-submit-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Kata Sandi"}
          </CtaButton>
        </form>
      )}
    </AuthShell>
  );
}

