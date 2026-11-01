import { Suspense, lazy, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import InstallGate from "./pages/InstallGate";
import { isAdmin } from "./lib/format";
import { isStandalonePwa } from "./lib/api";
import { Logo } from "./components/brand/Logo";
import FilePreviewModal from "./components/pwa/FilePreviewModal";

const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const ImportLeads = lazy(() => import("./pages/ImportLeads"));
const CalculatorPage = lazy(() => import("./pages/Calculator"));
const Simulations = lazy(() => import("./pages/Simulations"));
const Progress = lazy(() => import("./pages/Progress"));
const Claims = lazy(() => import("./pages/Claims"));
const UsersPage = lazy(() => import("./pages/Users"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const SettingsPage = lazy(() => import("./pages/Settings"));

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white" data-testid="splash-screen">
      <Logo variant="vertical" size="md" className="animate-pulse" />
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="space-y-4 py-4 lp-fade" aria-label="Memuat halaman">
      <div className="h-6 w-48 lp-skeleton" />
      <div className="h-4 w-72 max-w-full lp-skeleton" />
      <div className="lp-card p-6 space-y-4 mt-4">
        <div className="h-5 w-40 lp-skeleton" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-10 rounded-lg lp-skeleton" />
          <div className="h-10 rounded-lg lp-skeleton" />
        </div>
        <div className="h-32 rounded-xl lp-skeleton" />
      </div>
    </div>
  );
}

function Protected({ admin, children }) {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin(user)) return <Navigate to="/dashboard" replace />;
  return children;
}

function LoginWithInstallGate() {
  const { user } = useAuth();
  const [bypassed, setBypassed] = useState(() => {
    return typeof window !== "undefined" && sessionStorage.getItem("lp_bypass_pwa") === "1";
  });

  if (user === null) return <Splash />;
  if (user) return <Navigate to="/dashboard" replace />;

  const isStandalone = isStandalonePwa();

  // Jika dibuka melalui aplikasi PWA Standalone (dari homescreen HP) ATAU bypass web aktif:
  if (isStandalone || bypassed) {
    return <Login />;
  }

  // Jika dibuka di browser biasa (address bar tampak):
  return (
    <InstallGate
      onBypass={() => {
        sessionStorage.setItem("lp_bypass_pwa", "1");
        setBypassed(true);
      }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginWithInstallGate />} />
            <Route path="/install" element={<InstallGate onBypass={() => {
              sessionStorage.setItem("lp_bypass_pwa", "1");
              window.location.href = "/login";
            }} />} />
            <Route path="/lupa-sandi" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<Protected><AppLayout /></Protected>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/impor" element={<Protected admin><ImportLeads /></Protected>} />
              <Route path="/kalkulator" element={<CalculatorPage />} />
              <Route path="/simulasi" element={<Simulations />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/klaim" element={<Claims />} />
              <Route path="/pengguna" element={<Protected admin><UsersPage /></Protected>} />
              <Route path="/audit" element={<Protected admin><AuditLog /></Protected>} />
              <Route path="/pengaturan" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <FilePreviewModal />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

