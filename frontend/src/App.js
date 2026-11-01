import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import InstallGate from "./pages/InstallGate";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import ImportLeads from "./pages/ImportLeads";
import CalculatorPage from "./pages/Calculator";
import Simulations from "./pages/Simulations";
import Progress from "./pages/Progress";
import Claims from "./pages/Claims";
import UsersPage from "./pages/Users";
import AuditLog from "./pages/AuditLog";
import SettingsPage from "./pages/Settings";
import { isAdmin } from "./lib/format";
import { isStandalonePwa } from "./lib/api";
import { Logo } from "./components/brand/Logo";
import FilePreviewModal from "./components/pwa/FilePreviewModal";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white" data-testid="splash-screen">
      <Logo variant="vertical" size="md" className="animate-pulse" />
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
      </BrowserRouter>
      <FilePreviewModal />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

