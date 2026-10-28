import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { AuthShell } from "./Login";
import { Logo } from "../components/brand/Logo";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { CtaButton } from "../components/common";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <Logo size="md" className="mb-10" />
      <h1 className="font-display text-3xl font-bold text-[#17223B]">Reset kata sandi</h1>
      {sent ? (
        <div className="mt-6 flex gap-3 rounded-xl border border-[#078D67]/20 bg-[#078D67]/5 p-4 text-sm text-[#17223B]" data-testid="forgot-success">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#078D67]" />
          Jika email terdaftar, tautan reset telah dikirim. Tautan berlaku selama 1 jam.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-5">
          <p className="text-sm text-slate-500">Masukkan email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.</p>
          {error && <p className="text-sm text-red-600" data-testid="forgot-error">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="fp-email">Email</Label>
            <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" data-testid="forgot-email-input" />
          </div>
          <CtaButton type="submit" disabled={busy} className="h-11 w-full font-semibold" data-testid="forgot-submit-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Tautan Reset"}
          </CtaButton>
        </form>
      )}
      <Link to="/login" className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5720B8] hover:underline" data-testid="back-to-login-link">
        <ArrowLeft className="h-4 w-4" /> Kembali ke halaman masuk
      </Link>
    </AuthShell>
  );
}

