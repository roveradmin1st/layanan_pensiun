import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, AlertCircle, Loader2, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../lib/api";
import { Logo, Copyright } from "../components/brand/Logo";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { CtaButton } from "../components/common";
import InstallAppButton from "../components/pwa/InstallAppButton";

const HERO = "https://images.pexels.com/photos/7424584/pexels-photo-7424584.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1100&w=1100";

export const AuthShell = ({ children }) => (
  <div className="grid min-h-screen bg-slate-50/50 lg:grid-cols-2">
    <div className="flex flex-col justify-between px-4 py-8 sm:px-10 sm:py-12 lg:px-16">
      <div className="mx-auto my-auto w-full max-w-[420px] lp-fade">{children}</div>
      <Copyright className="mt-8 pt-4" />
    </div>
    <div className="relative hidden overflow-hidden bg-slate-900 lg:block">
      <img src={HERO} alt="Layanan Pensiunan" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1b0844] via-[#351080]/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Platform Manajemen Pembiayaan</p>
        <h2 className="font-display text-3xl font-bold leading-tight xl:text-4xl">Amanah, Akurat &amp; Terintegrasi</h2>
        <p className="mt-3.5 max-w-lg text-sm leading-relaxed text-white/80">
          Sistem operasional terpadu pengelolaan leads, kalkulasi multi-mitra perbankan dan koperasi, serta pemantauan siklus kredit pensiun enterprise.
        </p>
      </div>
    </div>
  </div>
);

export default function Login() {
  const { login, quickRole } = useAuth();
  const nav = useNavigate();
  const isDevOrDemo =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      new URLSearchParams(window.location.search).get("demo") === "1");
  const [email, setEmail] = useState(() => (isDevOrDemo ? "superadmin@layananpensiunan.id" : ""));
  const [password, setPassword] = useState(() => (isDevOrDemo ? "Password123!" : ""));
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      nav("/dashboard");
    } catch (err) {
      setError(errMsg(err, "Login gagal. Periksa koneksi atau kredensial Anda."));
    } finally {
      setBusy(false);
    }
  };

  const enterAsRole = async (role) => {
    setError("");
    setBusy(true);
    try {
      await quickRole(role);
      nav("/dashboard");
    } catch (err) {
      setError(errMsg(err, "Gagal mengalihkan peran simulasi."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-6 flex justify-center sm:justify-start">
        <Logo variant="horizontal" size="md" data-testid="login-logo-horizontal" />
      </div>

      <div className="mb-6">
        <p className="lp-eyebrow">Portal Internal</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">Masuk ke Akun</h1>
        <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">Silakan gunakan akun resmi yang telah didaftarkan oleh administrator.</p>
      </div>

      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:text-sm" data-testid="login-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Alamat Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-white"
            data-testid="login-email-input"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Kata Sandi</Label>
            <button
              type="button"
              onClick={() => nav("/lupa-sandi")}
              className="text-xs font-medium text-[#5720B8] hover:underline"
              data-testid="forgot-password-link"
            >
              Lupa kata sandi?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-white pr-11"
              data-testid="login-password-input"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-600"
              aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              data-testid="toggle-password-visibility"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <CtaButton type="submit" disabled={busy} className="h-11 w-full text-sm font-semibold shadow-sm" data-testid="login-submit-button">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk ke Sistem"}
        </CtaButton>
      </form>

      <InstallAppButton variant="login" />

      {/* Panel Pilihan Peran Cepat (Hanya aktif di Localhost atau saat ada parameter ?demo=1) */}
      {isDevOrDemo && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="quick-role-panel">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-600" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Simulasi Akses Peran</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">Pilih salah satu profil untuk menguji batasan hak akses operasional (RBAC):</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => enterAsRole("super_admin")}
              data-testid="quick-login-super-admin"
              className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center transition hover:border-[#351080] hover:bg-white"
            >
              <span className="text-xs font-bold text-[#351080]">1. Super Admin</span>
              <span className="mt-0.5 text-[10px] text-slate-500">Akses Penuh &amp; Konfigurasi</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => enterAsRole("admin_ops")}
              data-testid="quick-login-admin-ops"
              className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center transition hover:border-[#078D67] hover:bg-white"
            >
              <span className="text-xs font-bold text-[#078D67]">2. Admin Operasional</span>
              <span className="mt-0.5 text-[10px] text-slate-500">Operasional Terpusat</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => enterAsRole("admin_branch")}
              data-testid="quick-login-admin-branch"
              className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center transition hover:border-[#d96200] hover:bg-white"
            >
              <span className="text-xs font-bold text-[#d96200]">3. Admin Cabang/Mitra</span>
              <span className="mt-0.5 text-[10px] text-slate-500">Verifikasi &amp; Laporan Cabang</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => enterAsRole("sales_manager")}
              data-testid="quick-login-sales-manager"
              className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center transition hover:border-[#15803d] hover:bg-white"
            >
              <span className="text-xs font-bold text-[#15803d]">4. Sales Manager</span>
              <span className="mt-0.5 text-[10px] text-slate-500">Pimpin &amp; Target Marketing</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => enterAsRole("marketing")}
              data-testid="quick-login-marketing"
              className="col-span-2 flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center transition hover:border-[#F28A19] hover:bg-white sm:col-span-1"
            >
              <span className="text-xs font-bold text-[#b46107]">5. Marketing</span>
              <span className="mt-0.5 text-[10px] text-slate-500">Akuisisi &amp; Input Pengajuan</span>
            </button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Keamanan Enkripsi JWT • Sesi HttpOnly Terproteksi</span>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
