import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Upload, Calculator, History, UserCog, ShieldCheck, Settings, LogOut, Menu, ListChecks, Wallet,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Logo, Copyright } from "../brand/Logo";
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet";
import { isAdmin, ROLE_LABEL } from "../../lib/format";
import InstallAppButton from "../pwa/InstallAppButton";

const NAV = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { to: "/leads", label: "Database Leads", shortLabel: "Leads", icon: Users },
  { to: "/impor", label: "Impor Leads", shortLabel: "Impor", icon: Upload, admin: true },
  { to: "/kalkulator", label: "Simulasi Mitra Bank", shortLabel: "Simulasi", icon: Calculator },
  { to: "/simulasi", label: "Riwayat Simulasi", shortLabel: "Riwayat", icon: History },
  { to: "/progress", label: "List Progress Leads", shortLabel: "Progress", icon: ListChecks },
  { to: "/klaim", label: "Pengajuan Klaim", shortLabel: "Klaim", icon: Wallet },
  { to: "/pengguna", label: "Pengguna", shortLabel: "User", icon: UserCog, admin: true },
  { to: "/audit", label: "Audit Log", shortLabel: "Audit", icon: ShieldCheck, admin: true },
  { to: "/pengaturan", label: "Pengaturan", shortLabel: "Setting", icon: Settings },
];

const MOBILE_BOTTOM_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/kalkulator", label: "Kalkulator", icon: Calculator },
  { to: "/progress", label: "Progress", icon: ListChecks },
  { to: "/pengaturan", label: "Parameter", icon: Settings },
];

function NavItems({ user, onNavigate }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Navigasi utama">
      {NAV.filter((n) => !n.admin || isAdmin(user)).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          data-testid={`nav-${to.slice(1)}`}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "bg-[#5720B8]/10 text-[#5720B8]" : "text-slate-600 hover:bg-slate-50 hover:text-[#351080]"
            }`
          }
        >
          <Icon className="h-[18px] w-[18px]" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function RoleSwitcher({ user, onSwitch }) {
  const isLocalOrDemo =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      new URLSearchParams(window.location.search).get("demo") === "1");

  // Sembunyikan panel pindah role cepat jika diakses melalui Tunneling (Ngrok/Cloudflare) atau Domain Publik
  if (!isLocalOrDemo) return null;

  const roles = [
    ["super_admin", "1. Super Admin"],
    ["admin_ops", "2. Admin Ops"],
    ["admin_branch", "3. Admin Cabang"],
    ["sales_manager", "4. Sales Mgr"],
    ["marketing", "5. Marketing"],
  ];
  return (
    <div className="mb-3 rounded-xl border border-slate-200/80 bg-white p-2" data-testid="role-switcher">
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Uji Batasan 5 Role (RBAC)</p>
      <div className="grid grid-cols-2 gap-1">
        {roles.map(([r, label], idx) => (
          <button
            key={r}
            type="button"
            onClick={() => onSwitch(r)}
            data-testid={`switch-role-${r}`}
            className={`rounded-md px-1.5 py-1.5 text-[11px] font-bold transition ${
              idx === 4 ? "col-span-2" : ""
            } ${
              user.role === r
                ? "bg-[#351080] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBox({ user, onLogout }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-[#F5F6FA] p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#351080] text-sm font-bold text-white">
          {user.name?.[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#17223B]" data-testid="current-user-name">{user.name}</p>
          <p className="truncate text-xs text-[#5720B8]" data-testid="current-user-role">
            {ROLE_LABEL[user.role]} • {user.branch || "PUSAT"}
          </p>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white py-2 text-xs font-bold text-red-600 shadow-2xs transition hover:bg-red-50 hover:text-red-700 active:scale-[0.98]"
        aria-label="Keluar dari Akun"
        data-testid="logout-button"
      >
        <LogOut className="h-4 w-4" />
        <span>Keluar dari Akun</span>
      </button>
    </div>
  );
}

export default function AppLayout() {
  const { user, quickRole, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = async () => {
    await logout();
    nav("/login");
  };

  const handleRoleSwitch = async (role) => {
    if (role === user.role) return;
    try {
      const u = await quickRole(role);
      toast.success(`Beralih ke peran ${ROLE_LABEL[u.role]} (${u.name})`);
      setOpen(false);
    } catch {
      toast.error("Gagal mengganti peran");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] lp-mobile-safe-bottom">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-slate-200/70 bg-white lg:flex">
        <div className="px-6 pb-5 pt-6">
          <Logo size="sm" data-testid="sidebar-logo" />
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <NavItems user={user} />
        </div>
        <div className="p-4">
          <InstallAppButton variant="sidebar" />
          <RoleSwitcher user={user} onSwitch={handleRoleSwitch} />
          <UserBox user={user} onLogout={doLogout} />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <Logo size="xs" data-testid="header-logo-mobile" />
        <div className="flex items-center gap-1.5">
          <InstallAppButton variant="header" />
          <span className="hidden sm:inline-block rounded-full bg-[#351080]/10 px-2 py-0.5 text-[11px] font-bold text-[#351080]">
            {ROLE_LABEL[user.role]}
          </span>
          <button
            onClick={doLogout}
            className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 shadow-2xs transition active:scale-95 hover:bg-red-100"
            aria-label="Keluar dari akun"
            title="Keluar dari akun"
            data-testid="header-logout-mobile"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Keluar</span>
          </button>
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-[#351080] hover:bg-slate-100" aria-label="Buka menu" data-testid="mobile-menu-button">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-[288px] flex-col bg-white p-5">
          <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
          <Logo size="sm" className="mb-5" />
          <div className="flex-1 overflow-y-auto">
            <NavItems user={user} onNavigate={() => setOpen(false)} />
          </div>
          <div className="pt-3">
            <InstallAppButton variant="sidebar" />
            <RoleSwitcher user={user} onSwitch={handleRoleSwitch} />
            <UserBox user={user} onLogout={doLogout} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="lg:pl-[264px]">
        <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
        <footer className="mx-auto flex max-w-[1360px] flex-col items-center gap-3 border-t border-slate-200/70 px-4 py-8 sm:px-6 lg:px-10">
          <Logo size="xs" data-testid="footer-logo" />
          <Copyright />
        </footer>
      </div>

      {/* Mobile-First Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200/90 bg-white/95 px-1 py-1.5 backdrop-blur lg:hidden lp-safe-bottom"
        data-testid="mobile-bottom-nav"
      >
        {MOBILE_BOTTOM_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[11px] font-semibold transition ${
                isActive ? "text-[#351080] font-bold bg-[#351080]/5" : "text-slate-500 hover:text-slate-900"
              }`
            }
          >
            <Icon className="h-4 w-4" />
            <span className="truncate max-w-[56px] text-center">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
