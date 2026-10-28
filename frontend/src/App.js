import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
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
import { Logo } from "./components/brand/Logo";

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

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
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
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

