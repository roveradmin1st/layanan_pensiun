// ============================================================================
// LAYANAN PENSIUNAN — EMERGENT UI + ENTERPRISE DYNAMIC CONTROLLER (PART 1)
// Mengimplementasikan seluruh halaman, komponen, ikon Lucide, Sheet, Dialog,
// dan interaksi persis seperti https://layananpensiunan.com/ + 6 Poin Upgrade
// ============================================================================

const ICONS = {
  dashboard: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
  users: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  userX: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/></svg>`,
  phoneCall: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  badgeCheck: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  upload: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`,
  calculator: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>`,
  history: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  listChecks: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>`,
  wallet: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`,
  userCog: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/></svg>`,
  shieldCheck: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
  settings: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  logOut: `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
  calendarClock: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/></svg>`,
  inbox: `<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  search: `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  plus: `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
  checkCircle: `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  xCircle: `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
  sparkles: `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", adminOnly: false },
  { id: "leads", label: "Database Leads", icon: "users", adminOnly: false },
  { id: "impor", label: "Impor Leads", icon: "upload", adminOnly: true },
  { id: "kalkulator", label: "Simulasi Mitra Bank", icon: "calculator", adminOnly: false },
  { id: "simulasi", label: "Riwayat Simulasi", icon: "history", adminOnly: false },
  { id: "progress", label: "List Progress Leads", icon: "listChecks", adminOnly: false },
  { id: "klaim", label: "Pengajuan Klaim", icon: "wallet", adminOnly: false },
  { id: "pengguna", label: "Pengguna", icon: "userCog", adminOnly: true },
  { id: "audit", label: "Audit Log", icon: "shieldCheck", adminOnly: true },
  { id: "pengaturan", label: "Pengaturan", icon: "settings", adminOnly: false }
];

const LEAD_STATUS = {
  baru: { label: "Baru", cls: "bg-[#5720B8]/10 text-[#5720B8]" },
  follow_up: { label: "Follow-up", cls: "bg-[#F28A19]/12 text-[#B5620A]" },
  proses: { label: "Dalam Proses", cls: "bg-[#17223B]/8 text-[#17223B]" },
  berhasil: { label: "Berhasil", cls: "bg-[#078D67]/12 text-[#078D67]" },
  gagal: { label: "Gagal", cls: "bg-red-50 text-red-700" }
};

const CLAIM_CLS = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-[#5720B8]/10 text-[#5720B8]",
  REVIEW: "bg-[#17223B]/8 text-[#17223B]",
  REVISION: "bg-[#F28A19]/12 text-[#B5620A]",
  APPROVED: "bg-[#078D67]/10 text-[#078D67]",
  PAID: "bg-[#078D67] text-white",
  REJECTED: "bg-red-50 text-red-700"
};

const BANK_OPTIONS = [
  { key: "ams2", name: "Koperasi AMS2 (Platinum)", supported: true },
  { key: "bsi_prapen", name: "Bank BSI (Prapensiun)", supported: true },
  { key: "bank_capital", name: "Bank Capital / Aladin", supported: true },
  { key: "bank_mantap", name: "Bank Mandiri Taspen", supported: true },
  { key: "bank_mnc", name: "Bank MNC", supported: true },
  { key: "bank_bni", name: "Bank BNI", supported: true },
  { key: "bank_mestika", name: "Bank Mestika", supported: true }
];

window.App = {
  currentPage: "dashboard",
  leadsFilter: { q: "", status: "", branch: "", assigned: "", follow_up: "" },
  selectedLeadIds: [],
  simSearchQ: "",
  progressFilter: { q: "", stage: "", branch: "", date_from: "", date_to: "" },
  claimsFilter: { q: "", status: "" },
  auditFilter: { q: "", action: "" },
  activeSettingsPartner: "ams2",

  // State khusus halaman Kalkulator Simulasi Mitra Bank
  calcState: {
    leadId: null,
    bankKey: "ams2",
    dapem: "TASPEN",
    name: "H. Sarmadan Siregar",
    birth: "12/04/1953",
    salary: 3850000,
    take_over: 0,
    // Khusus BSI Prapensiun
    bsiScheme: "PP10",
    bsiAkad: "MMQ",
    bsiAtribusi: "atribusi_asuransi",
    bsiPayroll: "Payroll",
    bsiBupAge: 58,
    uangMakan: 550000,
    tunjangan1Bln: 3761240,
    manfaatPensiun: 4600000,
    // Step 1 & Step 2 results
    mx: null,
    tl: "3.5",
    mode: "max",
    customPlafond: 120000000,
    customTenor: 120,
    res: null,
    savedSim: null,
    simStatus: "",
    phone: "081263001122",
    aiModel: "gpt",
    aiText: ""
  },

  init() {
    this.bindFallbacks();
    this.initAuthScreenEvents();
    this.initShellEvents();
    this.syncAuthAndRender();
  },

  bindFallbacks() {
    // Jika file gambar gagal dimuat di mode tertentu, gunakan base64 dari BRAND_ASSETS
    const setFallback = (id, uri) => {
      const el = document.getElementById(id);
      if (el && window.BRAND_ASSETS && uri) {
        el.onerror = () => { el.src = uri; };
      }
    };
    if (window.BRAND_ASSETS) {
      setFallback("loginLogoVert", window.BRAND_ASSETS.lpVerticalLogo);
      setFallback("loginLogoHoriz", window.BRAND_ASSETS.lpHorizontalLogo);
      setFallback("sidebarLogoDesktop", window.BRAND_ASSETS.lpHorizontalLogo);
      setFallback("headerLogoMobile", window.BRAND_ASSETS.lpHorizontalLogo);
      setFallback("sidebarLogoMobile", window.BRAND_ASSETS.lpHorizontalLogo);
      setFallback("footerLogo", window.BRAND_ASSETS.lpHorizontalLogo);
    }
  },

  rp(v) {
    if (v == null || v === "" || isNaN(Number(v))) return "-";
    const n = Math.round(Number(v));
    return (n < 0 ? "-Rp" : "Rp") + Math.abs(n).toLocaleString("id-ID");
  },

  pct(v) {
    if (v == null || v === "" || isNaN(Number(v))) return "-";
    return `${Number(v).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
  },

  fmtDate(iso) {
    if (!iso) return "-";
    const s = String(iso).slice(0, 10);
    const parts = s.split("-");
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  },

  fmtDateTime(iso) {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_) {
      return iso;
    }
  },

  ddmmyyyyToIso(s) {
    const clean = String(s || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean);
    if (!m) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
  },

  isoToDdmmyyyy(iso) {
    if (!iso) return "";
    const parts = String(iso).slice(0, 10).split("-");
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  },

  formatNumInput(v) {
    const d = String(v ?? "").replace(/\D/g, "");
    return d ? Number(d).toLocaleString("id-ID") : "";
  },

  parseNumInput(v) {
    const d = String(v ?? "").replace(/\D/g, "");
    return d ? Number(d) : 0;
  },

  toast(msg, type = "success") {
    const stack = document.getElementById("toastStack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = `lp-toast ${type}`;
    el.innerHTML = `<span>${type === "error" ? "⚠️" : type === "info" ? "ℹ️" : "✓"}</span><span>${msg}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.2s ease";
      setTimeout(() => el.remove(), 220);
    }, 3200);
  },

  statCardHtml({ label, value, iconKey, tone = "purple", hint = "" }) {
    const tones = {
      purple: "text-[#351080] bg-[#351080]/8",
      royal: "text-[#5720B8] bg-[#5720B8]/10",
      green: "text-[#078D67] bg-[#078D67]/10",
      orange: "text-[#D9760C] bg-[#F28A19]/12",
      navy: "text-[#17223B] bg-[#17223B]/8"
    };
    return `
      <div class="lp-card p-5 lp-fade">
        <div class="flex items-start justify-between gap-3">
          <p class="text-[13px] font-medium text-slate-500">${label}</p>
          <span class="flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone] || tones.purple}">
            ${ICONS[iconKey] || ICONS.dashboard}
          </span>
        </div>
        <p class="mt-3 font-display text-3xl font-bold text-[#17223B] lp-num">${value}</p>
        ${hint ? `<p class="mt-1 text-xs text-slate-500">${hint}</p>` : ""}
      </div>
    `;
  },

  pageHeaderHtml({ eyebrow, title, desc, actionsHtml = "" }) {
    return `
      <div class="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          ${eyebrow ? `<p class="lp-eyebrow mb-2">${eyebrow}</p>` : ""}
          <h1 class="font-display text-2xl font-bold text-[#17223B] sm:text-3xl">${title}</h1>
          ${desc ? `<p class="mt-1.5 max-w-2xl text-sm text-slate-500">${desc}</p>` : ""}
        </div>
        ${actionsHtml ? `<div class="flex flex-wrap gap-2">${actionsHtml}</div>` : ""}
      </div>
    `;
  },

  statusBadgeHtml(status) {
    const s = LEAD_STATUS[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
    return `<span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${s.cls}">${s.label}</span>`;
  },

  // ==========================================================================
  // AUTH SCREEN & SHELL NAVIGATION
  // ==========================================================================
  initAuthScreenEvents() {
    const form = document.getElementById("loginForm");
    const pwdInput = document.getElementById("loginPassword");
    const toggleBtn = document.getElementById("btnTogglePwd");

    if (toggleBtn && pwdInput) {
      toggleBtn.addEventListener("click", () => {
        pwdInput.type = pwdInput.type === "password" ? "text" : "password";
      });
    }

    if (form) {
      form.addEventListener("submit", e => {
        e.preventDefault();
        const email = document.getElementById("loginEmail")?.value.trim().toLowerCase();
        const users = window.StorageService.getUsers();
        const found = users.find(u => u.email.toLowerCase() === email && u.active) || users[0];
        window.StorageService.setCurrentUserById(found.id);
        window.StorageService.setLoggedIn(true);
        this.syncAuthAndRender();
        this.toast(`Selamat datang, ${found.name} (${found.role_label})`);
      });
    }
  },

  quickLoginRole(roleCode) {
    const user = window.StorageService.setCurrentUserByRole(roleCode);
    window.StorageService.setLoggedIn(true);
    this.syncAuthAndRender();
    this.toast(`Login berhasil sebagai ${user.name} (${user.role_label})`);
  },

  logout() {
    window.StorageService.logAudit("logout", "Session", "Keluar dari sesi aplikasi");
    window.StorageService.setLoggedIn(false);
    this.syncAuthAndRender();
    this.toast("Anda telah keluar dari sesi.", "info");
  },

  initShellEvents() {
    const openBtn = document.getElementById("btnOpenMobileDrawer");
    const closeBtn = document.getElementById("btnCloseMobileDrawer");
    const backdrop = document.getElementById("mobileDrawerBackdrop");
    const panel = document.getElementById("mobileDrawerPanel");

    const closeMobile = () => {
      backdrop?.classList.remove("open");
      panel?.classList.remove("open");
    };

    openBtn?.addEventListener("click", () => {
      backdrop?.classList.add("open");
      panel?.classList.add("open");
    });
    closeBtn?.addEventListener("click", closeMobile);
    backdrop?.addEventListener("click", closeMobile);

    const topUserSel = document.getElementById("topUserSwitcher");
    if (topUserSel) {
      topUserSel.addEventListener("change", () => {
        const u = window.StorageService.setCurrentUserById(topUserSel.value);
        this.syncAuthAndRender();
        this.toast(`Beralih ke akun ${u.name} (${u.role_label})`, "info");
      });
    }
  },

  switchRole(roleCode) {
    const u = window.StorageService.setCurrentUserByRole(roleCode);
    this.syncAuthAndRender();
    this.toast(`Mode Role Aktif: ${u.role_label} (${u.name})`, "info");
  },

  syncAuthAndRender() {
    const loggedIn = window.StorageService.isLoggedIn();
    const authScreen = document.getElementById("authScreen");
    const appShell = document.getElementById("appShell");

    if (!loggedIn) {
      if (authScreen) authScreen.style.display = "grid";
      if (appShell) appShell.style.display = "none";
      return;
    }

    if (authScreen) authScreen.style.display = "none";
    if (appShell) appShell.style.display = "block";

    const user = window.StorageService.getCurrentUser();
    const admin = window.RBACGuard.isAdmin(user);

    // Render Nav Items in Desktop & Mobile Drawer
    const visibleNav = NAV_ITEMS.filter(n => !n.adminOnly || admin);
    const navHtml = visibleNav
      .map(n => {
        const isActive = this.currentPage === n.id;
        return `
          <button type="button" onclick="App.navigate('${n.id}')"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left w-full ${
              isActive
                ? "bg-[#5720B8]/10 text-[#5720B8]"
                : "text-slate-600 hover:bg-slate-50 hover:text-[#351080]"
            }">
            ${ICONS[n.icon]}
            <span>${n.label}</span>
          </button>
        `;
      })
      .join("");

    const desktopNav = document.getElementById("desktopNav");
    const mobileNav = document.getElementById("mobileDrawerNav");
    if (desktopNav) desktopNav.innerHTML = navHtml;
    if (mobileNav) mobileNav.innerHTML = navHtml;

    // Render UserBox in Desktop & Mobile Drawer
    const userBoxHtml = `
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#351080] text-sm font-bold text-white">
        ${(user.name || "U")[0].toUpperCase()}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-[#17223B]">${user.name}</p>
        <p class="truncate text-xs text-[#5720B8]">${user.role_label}</p>
      </div>
      <button type="button" onclick="App.logout()" class="rounded-md p-2 text-slate-500 hover:bg-white hover:text-red-600" title="Keluar ke Halaman Login">
        ${ICONS.logOut}
      </button>
    `;
    const dBox = document.getElementById("desktopUserBox");
    const mBox = document.getElementById("mobileDrawerUserBox");
    if (dBox) dBox.innerHTML = userBoxHtml;
    if (mBox) mBox.innerHTML = userBoxHtml;

    // Role switcher top strip
    const normRole = window.RBACGuard.normalizeRole(user.role);
    document.querySelectorAll(".lp-role-pill[data-role-switch]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-role-switch") === normRole);
    });

    const users = window.StorageService.getUsers().filter(u => u.active);
    const topUserSel = document.getElementById("topUserSwitcher");
    if (topUserSel) {
      topUserSel.innerHTML = users
        .map(u => `<option value="${u.id}" class="text-slate-900" ${u.id === user.id ? "selected" : ""}>${u.name} (${u.role_label})</option>`)
        .join("");
    }

    // Mobile Bottom Bar
    const mobBar = document.getElementById("mobileBottomBar");
    if (mobBar) {
      const mobItems = admin
        ? [
            { id: "dashboard", label: "Dashboard", icon: "dashboard" },
            { id: "leads", label: "Leads", icon: "users" },
            { id: "kalkulator", label: "Simulasi", icon: "calculator" },
            { id: "progress", label: "Progress", icon: "listChecks" },
            { id: "pengaturan", label: "Parameter", icon: "settings" }
          ]
        : [
            { id: "dashboard", label: "Dashboard", icon: "dashboard" },
            { id: "leads", label: "Leads Saya", icon: "users" },
            { id: "kalkulator", label: "Simulasi", icon: "calculator" },
            { id: "progress", label: "Progress", icon: "listChecks" },
            { id: "klaim", label: "Klaim", icon: "wallet" }
          ];
      mobBar.innerHTML = mobItems
        .map(
          it => `
          <button type="button" onclick="App.navigate('${it.id}')" class="lp-mob-btn ${this.currentPage === it.id ? "active" : ""}">
            ${ICONS[it.icon]}
            <span>${it.label}</span>
          </button>`
        )
        .join("");
    }

    if (!window.RBACGuard.canAccessPage(user.role, this.currentPage)) {
      this.currentPage = "dashboard";
    }
    this.renderOutlet();
  },

  navigate(pageId, queryParams = {}) {
    const user = window.StorageService.getCurrentUser();
    if (!window.RBACGuard.canAccessPage(user.role, pageId)) {
      this.toast(`Peran ${user.role_label} tidak memiliki akses ke menu tersebut.`, "error");
      return;
    }

    document.getElementById("mobileDrawerBackdrop")?.classList.remove("open");
    document.getElementById("mobileDrawerPanel")?.classList.remove("open");

    if (pageId === "kalkulator" && queryParams.leadId) {
      const lead = window.StorageService.getLeads().find(l => l.id === queryParams.leadId);
      if (lead) {
        this.calcState.leadId = lead.id;
        this.calcState.name = lead.name;
        this.calcState.salary = lead.pension_salary || 3850000;
        this.calcState.birth = lead.birth_date ? this.isoToDdmmyyyy(lead.birth_date) : "12/04/1953";
        this.calcState.phone = lead.phone || "";
        this.calcState.mx = null;
        this.calcState.res = null;
        this.calcState.savedSim = null;
      }
    }

    if (pageId === "leads" && queryParams.follow_up) {
      this.leadsFilter.follow_up = queryParams.follow_up;
    }

    this.currentPage = pageId;
    this.syncAuthAndRender();

    if (pageId === "progress" && queryParams.appId) {
      this.openAppDetailSheet(queryParams.appId);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  closeRightSheet() {
    document.getElementById("rightSheetBackdrop")?.classList.remove("open");
    document.getElementById("rightSheetPanel")?.classList.remove("open");
  },

  openRightSheet(html) {
    const backdrop = document.getElementById("rightSheetBackdrop");
    const panel = document.getElementById("rightSheetPanel");
    if (!backdrop || !panel) return;
    panel.innerHTML = html;
    backdrop.classList.add("open");
    panel.classList.add("open");
  },

  closeModal() {
    document.getElementById("modalDialogBackdrop")?.classList.remove("open");
    document.getElementById("modalDialogBox")?.classList.remove("wide");
  },

  openModal(html, wide = false) {
    const backdrop = document.getElementById("modalDialogBackdrop");
    const box = document.getElementById("modalDialogBox");
    if (!backdrop || !box) return;
    box.classList.toggle("wide", wide);
    box.innerHTML = html;
    backdrop.classList.add("open");
  },

  renderOutlet() {
    const outlet = document.getElementById("mainOutlet");
    if (!outlet) return;

    switch (this.currentPage) {
      case "dashboard":
        outlet.innerHTML = this.renderDashboardPage();
        break;
      case "leads":
        outlet.innerHTML = this.renderLeadsPage();
        break;
      case "impor":
        outlet.innerHTML = this.renderImportPage();
        break;
      case "kalkulator":
        outlet.innerHTML = this.renderCalculatorPage();
        break;
      case "simulasi":
        outlet.innerHTML = this.renderSimulationsPage();
        break;
      case "progress":
        outlet.innerHTML = this.renderProgressPage();
        break;
      case "klaim":
        outlet.innerHTML = this.renderClaimsPage();
        break;
      case "pengguna":
        outlet.innerHTML = this.renderUsersPage();
        break;
      case "audit":
        outlet.innerHTML = this.renderAuditPage();
        break;
      case "pengaturan":
        outlet.innerHTML = this.renderSettingsPage();
        break;
    }
  },

  // ==========================================================================
  // 1. DASHBOARD PAGE (ADMIN VS MARKETING VIEW IDENTIK EMERGENT)
  // ==========================================================================
  renderGrowthChartSvg() {
    return `
      <div class="w-full overflow-hidden pt-2">
        <svg viewBox="0 0 680 220" class="w-full h-[220px]">
          <defs>
            <linearGradient id="lpgArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#5720B8" stop-opacity="0.22" />
              <stop offset="100%" stop-color="#5720B8" stop-opacity="0.0" />
            </linearGradient>
          </defs>
          <line x1="36" y1="30" x2="660" y2="30" stroke="#EEF0F5" stroke-width="1" />
          <line x1="36" y1="80" x2="660" y2="80" stroke="#EEF0F5" stroke-width="1" />
          <line x1="36" y1="130" x2="660" y2="130" stroke="#EEF0F5" stroke-width="1" />
          <line x1="36" y1="180" x2="660" y2="180" stroke="#EEF0F5" stroke-width="1" />
          <text x="8" y="34" fill="#94a3b8" font-size="11">80</text>
          <text x="8" y="84" fill="#94a3b8" font-size="11">60</text>
          <text x="8" y="134" fill="#94a3b8" font-size="11">40</text>
          <text x="8" y="184" fill="#94a3b8" font-size="11">20</text>
          <path d="M40,165 C140,150 220,125 320,105 C420,85 520,62 650,40 L650,185 L40,185 Z" fill="url(#lpgArea)" />
          <path d="M40,165 C140,150 220,125 320,105 C420,85 520,62 650,40" fill="none" stroke="#5720B8" stroke-width="2.5" />
          <path d="M40,178 C140,170 220,155 320,162 C420,145 520,138 650,128" fill="none" stroke="#078D67" stroke-width="2" />
          <text x="40" y="205" fill="#94a3b8" font-size="11">01/10</text>
          <text x="190" y="205" fill="#94a3b8" font-size="11">08/10</text>
          <text x="340" y="205" fill="#94a3b8" font-size="11">15/10</text>
          <text x="490" y="205" fill="#94a3b8" font-size="11">22/10</text>
          <text x="620" y="205" fill="#94a3b8" font-size="11">27/10</text>
        </svg>
        <div class="flex items-center justify-center gap-6 text-xs text-slate-500 mt-1">
          <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full bg-[#5720B8]"></span>Total leads kumulatif</span>
          <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full bg-[#078D67]"></span>Leads baru harian</span>
        </div>
      </div>
    `;
  },

  renderDashboardPage() {
    const user = window.StorageService.getCurrentUser();
    const admin = window.RBACGuard.isAdmin(user);
    const allLeads = window.StorageService.getLeads();
    const sims = window.StorageService.getSimulations();
    const imports = window.StorageService.getImports();
    const logs = window.StorageService.getAuditLogs().slice(0, 5);
    const marketers = window.StorageService.getUsers().filter(u => u.role === "marketing");

    if (admin) {
      const unassigned = allLeads.filter(l => !l.assigned_to).length;
      const inProgress = allLeads.filter(l => l.status === "follow_up" || l.status === "proses").length;
      const converted = allLeads.filter(l => l.status === "berhasil").length;

      return `
        ${this.pageHeaderHtml({
          eyebrow: "Dashboard Admin",
          title: "Ringkasan Operasional",
          desc: "Pantau perkembangan leads, aktivitas marketing, dan simulasi Calc Platinum & Mitra Bank.",
          actionsHtml: `
            <button type="button" onclick="App.navigate('impor')" class="lp-btn lp-btn-outline">${ICONS.upload}<span>Impor Leads</span></button>
            <button type="button" onclick="App.navigate('kalkulator')" class="lp-btn lp-btn-cta">${ICONS.calculator}<span>Buat Simulasi</span></button>
          `
        })}
        <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          ${this.statCardHtml({ label: "Total Leads", value: allLeads.length, iconKey: "users", tone: "purple" })}
          ${this.statCardHtml({ label: "Belum Ditugaskan", value: unassigned, iconKey: "userX", tone: "orange" })}
          ${this.statCardHtml({ label: "Ditindaklanjuti", value: inProgress, iconKey: "phoneCall", tone: "royal" })}
          ${this.statCardHtml({ label: "Berhasil Dikonversi", value: converted, iconKey: "badgeCheck", tone: "green" })}
          ${this.statCardHtml({ label: "Total Simulasi", value: sims.length, iconKey: "calculator", tone: "navy" })}
        </div>

        <div class="mt-6 grid gap-6 xl:grid-cols-3">
          <section class="lp-card p-6 xl:col-span-2">
            <div class="mb-5 flex items-center justify-between">
              <h2 class="font-display text-base font-bold text-[#17223B]">Perkembangan Leads (30 hari)</h2>
            </div>
            ${this.renderGrowthChartSvg()}
          </section>

          <section class="lp-card p-6">
            <div class="mb-5 flex items-center justify-between">
              <h2 class="font-display text-base font-bold text-[#17223B]">Aktivitas Marketing</h2>
            </div>
            <ul class="divide-y">
              ${marketers
                .map(m => {
                  const mLeads = allLeads.filter(l => l.assigned_to === m.id);
                  const mSuccess = mLeads.filter(l => l.status === "berhasil").length;
                  return `
                    <li class="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p class="font-semibold text-[#17223B]">${m.name}</p>
                        <p class="text-xs text-slate-500">${m.branch}</p>
                      </div>
                      <div class="text-right text-xs text-slate-500 lp-num">
                        <p><b class="text-[#17223B]">${mLeads.length}</b> leads • <b class="text-[#078D67]">${mSuccess}</b> berhasil</p>
                        <p>${mLeads.length * 2 + 1} aktivitas / 7 hari</p>
                      </div>
                    </li>`;
                })
                .join("")}
            </ul>
          </section>
        </div>

        <div class="mt-6 grid gap-6 lg:grid-cols-2">
          <section class="lp-card p-6">
            <div class="mb-5 flex items-center justify-between">
              <h2 class="font-display text-base font-bold text-[#17223B]">Impor Terbaru</h2>
              <button type="button" onclick="App.navigate('impor')" class="text-xs font-semibold text-[#5720B8] hover:underline">Lihat semua</button>
            </div>
            <ul class="divide-y">
              ${imports
                .slice(0, 4)
                .map(
                  i => `
                  <li class="flex items-center justify-between py-3 text-sm">
                    <div class="min-w-0">
                      <p class="truncate font-medium text-[#17223B]">${i.filename}</p>
                      <p class="text-xs text-slate-500">${i.user_name} • ${this.fmtDateTime(i.created_at)}</p>
                    </div>
                    <span class="shrink-0 text-xs font-semibold text-[#078D67]">+${i.inserted} leads</span>
                  </li>`
                )
                .join("")}
            </ul>
          </section>

          <section class="lp-card p-6">
            <div class="mb-5 flex items-center justify-between">
              <h2 class="font-display text-base font-bold text-[#17223B]">Aktivitas Terakhir</h2>
              <button type="button" onclick="App.navigate('audit')" class="text-xs font-semibold text-[#5720B8] hover:underline">Audit log</button>
            </div>
            <ul class="divide-y">
              ${logs
                .map(
                  a => `
                  <li class="flex items-start justify-between gap-3 py-3 text-sm">
                    <div class="min-w-0">
                      <p class="font-medium text-[#17223B]">${a.user_name} <span class="font-normal text-slate-500">— ${a.action.replace(/_/g, " ")}</span></p>
                      <p class="truncate text-xs text-slate-500">${a.detail}</p>
                    </div>
                    <span class="shrink-0 text-xs text-slate-400">${this.fmtDateTime(a.created_at)}</span>
                  </li>`
                )
                .join("")}
            </ul>
          </section>
        </div>
      `;
    }

    // Marketing Dashboard View
    const myLeads = allLeads.filter(l => l.assigned_to === user.id || l.assigned_name === user.name);
    const baruCount = myLeads.filter(l => l.status === "baru").length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayLeads = myLeads.filter(l => l.follow_up_date === todayStr);
    const inProcCount = myLeads.filter(l => l.status === "follow_up" || l.status === "proses").length;
    const successCount = myLeads.filter(l => l.status === "berhasil").length;

    return `
      ${this.pageHeaderHtml({
        eyebrow: "Dashboard Marketing",
        title: `Selamat bekerja, ${user.name.split(" ")[0]}`,
        desc: "Leads yang ditugaskan kepada Anda dan jadwal tindak lanjut hari ini.",
        actionsHtml: `
          <button type="button" onclick="App.navigate('kalkulator')" class="lp-btn lp-btn-cta">${ICONS.plus}<span>Buat Simulasi</span></button>
        `
      })}
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        ${this.statCardHtml({ label: "Leads Saya", value: myLeads.length, iconKey: "users", tone: "purple" })}
        ${this.statCardHtml({ label: "Leads Baru", value: baruCount, iconKey: "inbox", tone: "royal" })}
        ${this.statCardHtml({ label: "Follow-up Hari Ini", value: todayLeads.length, iconKey: "calendarClock", tone: "orange" })}
        ${this.statCardHtml({ label: "Dalam Proses", value: inProcCount, iconKey: "phoneCall", tone: "navy" })}
        ${this.statCardHtml({ label: "Berhasil", value: successCount, iconKey: "badgeCheck", tone: "green" })}
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-3">
        <section class="lp-card p-6 xl:col-span-2">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="font-display text-base font-bold text-[#17223B]">Follow-up Hari Ini</h2>
            <button type="button" onclick="App.navigate('leads', { follow_up: 'today' })" class="text-xs font-semibold text-[#5720B8] hover:underline">Buka di Leads</button>
          </div>
          ${
            todayLeads.length
              ? `<ul class="divide-y">
                  ${todayLeads
                    .map(
                      l => `
                      <li class="flex items-center justify-between gap-3 py-3 text-sm">
                        <div>
                          <p class="font-semibold text-[#17223B]">${l.name}</p>
                          <p class="text-xs text-slate-500">${l.phone} • ${l.city}</p>
                        </div>
                        <div class="flex items-center gap-3">
                          ${this.statusBadgeHtml(l.status)}
                          <button type="button" onclick="App.navigate('kalkulator', { leadId: '${l.id}' })" class="lp-btn lp-btn-cta lp-btn-sm" title="Buat Simulasi">Simulasi ↗</button>
                        </div>
                      </li>`
                    )
                    .join("")}
                </ul>`
              : `<div class="py-10 text-center text-sm text-slate-400">Tidak ada jadwal follow-up hari ini</div>`
          }
        </section>

        <section class="lp-card p-6">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="font-display text-base font-bold text-[#17223B]">Riwayat Aktivitas</h2>
          </div>
          <ul class="space-y-4">
            ${myLeads
              .flatMap(l => (l.activities || []).map(a => ({ ...a, lead_name: l.name })))
              .slice(0, 5)
              .map(
                a => `
                <li class="border-l-2 border-[#5720B8]/30 pl-3 text-sm">
                  <p class="font-medium text-[#17223B]">${a.lead_name}</p>
                  <p class="text-xs text-slate-500">${a.note}</p>
                  <p class="mt-0.5 text-[11px] text-slate-400">${this.fmtDateTime(a.created_at)}</p>
                </li>`
              )
              .join("") || `<div class="py-6 text-center text-sm text-slate-400">Belum ada aktivitas</div>`}
          </ul>
        </section>
      </div>

      <section class="lp-card p-6 mt-6">
        <div class="mb-5 flex items-center justify-between">
          <h2 class="font-display text-base font-bold text-[#17223B]">Perkembangan Leads Saya</h2>
        </div>
        ${this.renderGrowthChartSvg()}
      </section>
    `;
  },

  // ==========================================================================
  // 2. DATABASE LEADS PAGE + LEAD DETAIL SHEET + ASSIGN & FORM DIALOGS
  // ==========================================================================
  renderLeadsPage() {
    const user = window.StorageService.getCurrentUser();
    const admin = window.RBACGuard.isAdmin(user);
    const allLeads = window.StorageService.getLeads();
    const scopedLeads = admin ? allLeads : allLeads.filter(l => l.assigned_to === user.id || l.assigned_name === user.name);
    const marketers = window.StorageService.getUsers().filter(u => u.role === "marketing");
    const branches = [...new Set(allLeads.map(l => l.branch).filter(Boolean))];

    const f = this.leadsFilter;
    const todayStr = new Date().toISOString().slice(0, 10);
    const filtered = scopedLeads.filter(l => {
      const q = f.q.toLowerCase().trim();
      const matchQ = !q || l.name.toLowerCase().includes(q) || (l.phone || "").includes(q) || (l.nopen || "").includes(q) || (l.city || "").toLowerCase().includes(q);
      const matchStatus = !f.status || l.status === f.status;
      const matchBranch = !f.branch || l.branch === f.branch;
      const matchAssigned = !f.assigned || (f.assigned === "unassigned" ? !l.assigned_to : l.assigned_to === f.assigned);
      const matchFollow = !f.follow_up || (f.follow_up === "today" ? l.follow_up_date === todayStr : l.follow_up_date && l.follow_up_date < todayStr);
      return matchQ && matchStatus && matchBranch && matchAssigned && matchFollow;
    });

    return `
      ${this.pageHeaderHtml({
        eyebrow: "Database",
        title: "Database Leads",
        desc: admin ? "Kelola, tugaskan, dan pantau seluruh leads calon debitur." : "Leads yang sedang ditugaskan kepada Anda.",
        actionsHtml: admin
          ? `
            <button type="button" onclick="App.openAssignLeadsModal()" ${this.selectedLeadIds.length ? "" : "disabled"} class="lp-btn lp-btn-outline">Tugaskan (${this.selectedLeadIds.length})</button>
            <button type="button" onclick="App.openAddLeadModal()" class="lp-btn lp-btn-cta">${ICONS.plus}<span>Tambah Leads</span></button>
          `
          : ""
      })}

      <div class="lp-card">
        <div class="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div class="relative flex-1">
            <input type="text" value="${f.q}" oninput="App.updateLeadsFilter('q', this.value)" placeholder="Cari nama, telepon, NOPEN, kota…" class="lp-input h-10" />
          </div>
          <div class="flex flex-wrap gap-2">
            <select onchange="App.updateLeadsFilter('status', this.value)" class="lp-input h-10 w-auto">
              <option value="">Semua status</option>
              ${Object.entries(LEAD_STATUS).map(([k, s]) => `<option value="${k}" ${f.status === k ? "selected" : ""}>${s.label}</option>`).join("")}
            </select>
            <select onchange="App.updateLeadsFilter('branch', this.value)" class="lp-input h-10 w-auto">
              <option value="">Semua cabang</option>
              ${branches.map(b => `<option value="${b}" ${f.branch === b ? "selected" : ""}>${b}</option>`).join("")}
            </select>
            ${
              admin
                ? `<select onchange="App.updateLeadsFilter('assigned', this.value)" class="lp-input h-10 w-auto">
                    <option value="">Semua marketing</option>
                    <option value="unassigned" ${f.assigned === "unassigned" ? "selected" : ""}>Belum ditugaskan</option>
                    ${marketers.map(m => `<option value="${m.id}" ${f.assigned === m.id ? "selected" : ""}>${m.name}</option>`).join("")}
                  </select>`
                : ""
            }
            <select onchange="App.updateLeadsFilter('follow_up', this.value)" class="lp-input h-10 w-auto">
              <option value="">Semua jadwal</option>
              <option value="today" ${f.follow_up === "today" ? "selected" : ""}>Follow-up hari ini</option>
              <option value="overdue" ${f.follow_up === "overdue" ? "selected" : ""}>Terlambat</option>
            </select>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-[#F5F6FA]/60 text-left text-xs font-semibold text-slate-500">
                ${admin ? `<th class="p-3 w-10"><input type="checkbox" ${filtered.length && this.selectedLeadIds.length === filtered.length ? "checked" : ""} onchange="App.toggleSelectAllLeads(this.checked)" /></th>` : ""}
                <th class="p-3">Nama</th>
                <th class="p-3">Telepon</th>
                <th class="p-3">Kota</th>
                <th class="p-3">Cabang</th>
                <th class="p-3">Status</th>
                ${admin ? `<th class="p-3">Marketing</th>` : ""}
                <th class="p-3">Tindak Lanjut</th>
                <th class="p-3">Sumber</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${filtered
                .map(
                  l => `
                  <tr class="cursor-pointer hover:bg-[#5720B8]/[0.03]" onclick="App.openLeadDetailSheet('${l.id}')">
                    ${
                      admin
                        ? `<td class="p-3" onclick="event.stopPropagation()">
                            <input type="checkbox" ${this.selectedLeadIds.includes(l.id) ? "checked" : ""} onchange="App.toggleSelectLead('${l.id}')" />
                          </td>`
                        : ""
                    }
                    <td class="p-3 font-semibold text-[#17223B]">${l.name}</td>
                    <td class="p-3 lp-num text-slate-600">${l.phone}</td>
                    <td class="p-3">${l.city || "-"}</td>
                    <td class="p-3">${l.branch || "-"}</td>
                    <td class="p-3">${this.statusBadgeHtml(l.status)}</td>
                    ${admin ? `<td class="p-3">${l.assigned_name || `<span class="text-xs font-medium text-[#D9760C]">Belum ditugaskan</span>`}</td>` : ""}
                    <td class="p-3 lp-num">${this.fmtDate(l.follow_up_date)}</td>
                    <td class="p-3 text-slate-500">${l.source || "-"}</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
          ${filtered.length === 0 ? `<div class="py-10 text-center text-sm text-slate-400">Tidak ada leads yang sesuai filter</div>` : ""}
        </div>
        <div class="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500">
          <span>Menampilkan ${filtered.length} dari ${scopedLeads.length} leads</span>
        </div>
      </div>
    `;
  },

  updateLeadsFilter(key, val) {
    this.leadsFilter[key] = val;
    this.selectedLeadIds = [];
    this.renderOutlet();
  },

  toggleSelectLead(id) {
    if (this.selectedLeadIds.includes(id)) {
      this.selectedLeadIds = this.selectedLeadIds.filter(x => x !== id);
    } else {
      this.selectedLeadIds.push(id);
    }
    this.renderOutlet();
  },

  toggleSelectAllLeads(checked) {
    const leads = window.StorageService.getLeads();
    this.selectedLeadIds = checked ? leads.map(l => l.id) : [];
    this.renderOutlet();
  },

  openLeadDetailSheet(leadId) {
    const leads = window.StorageService.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const user = window.StorageService.getCurrentUser();
    const admin = window.RBACGuard.isAdmin(user);
    const marketers = window.StorageService.getUsers().filter(u => u.role === "marketing");
    const sims = window.StorageService.getSimulations().filter(s => s.lead_id === lead.id);

    this.openRightSheet(`
      <div class="space-y-6">
        <div class="flex items-start justify-between">
          <div>
            <p class="lp-eyebrow">Detail Leads</p>
            <h2 class="font-display text-2xl font-bold text-[#17223B] mt-1">${lead.name}</h2>
            <div class="flex flex-wrap items-center gap-3 text-sm text-slate-500 mt-2">
              ${this.statusBadgeHtml(lead.status)}
              <span>📞 ${lead.phone}</span>
              <span>📍 ${lead.city || "-"} • ${lead.branch || "-"}</span>
            </div>
          </div>
          <button type="button" onclick="App.closeRightSheet()" class="rounded-md p-1.5 text-slate-400 hover:text-[#17223B]">✕</button>
        </div>

        <div class="grid grid-cols-2 gap-4 rounded-xl bg-[#F5F6FA] p-4">
          <div><p class="text-[11px] uppercase tracking-wide text-slate-400">NOPEN</p><p class="text-sm font-medium text-[#17223B]">${lead.nopen || "-"}</p></div>
          <div><p class="text-[11px] uppercase tracking-wide text-slate-400">NIP</p><p class="text-sm font-medium text-[#17223B]">${lead.nip || "-"}</p></div>
          <div><p class="text-[11px] uppercase tracking-wide text-slate-400">Gaji Pensiun</p><p class="text-sm font-medium text-[#17223B]">${lead.pension_salary ? this.rp(lead.pension_salary) : "-"}</p></div>
          <div><p class="text-[11px] uppercase tracking-wide text-slate-400">Tanggal Lahir</p><p class="text-sm font-medium text-[#17223B]">${this.fmtDate(lead.birth_date)}</p></div>
          <div><p class="text-[11px] uppercase tracking-wide text-slate-400">Sumber</p><p class="text-sm font-medium text-[#17223B]">${lead.source || "-"}</p></div>
          ${admin ? `<div><p class="text-[11px] uppercase tracking-wide text-slate-400">Marketing</p><p class="text-sm font-medium text-[#17223B]">${lead.assigned_name || "Belum ditugaskan"}</p></div>` : ""}
        </div>

        <button type="button" onclick="App.closeRightSheet(); App.navigate('kalkulator', { leadId: '${lead.id}' })" class="lp-btn lp-btn-cta w-full">
          ${ICONS.calculator}<span>Buat Simulasi Calc Platinum / Mitra Bank</span>
        </button>

        ${
          admin
            ? `<div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-600">Tugaskan ke marketing</label>
                <select onchange="App.assignSingleLead('${lead.id}', this.value)" class="lp-input">
                  <option value="">— Belum ditugaskan —</option>
                  ${marketers.map(m => `<option value="${m.id}" ${lead.assigned_to === m.id ? "selected" : ""}>${m.name} (${m.branch})</option>`).join("")}
                </select>
              </div>`
            : ""
        }

        <div class="space-y-4 rounded-xl border p-4">
          <p class="font-display text-sm font-bold text-[#17223B]">Tindak Lanjut</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-slate-600">Status</label>
              <select id="sheetLeadStatus" class="lp-input">
                ${Object.entries(LEAD_STATUS).map(([k, s]) => `<option value="${k}" ${lead.status === k ? "selected" : ""}>${s.label}</option>`).join("")}
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-slate-600">Tanggal tindak lanjut</label>
              <input id="sheetLeadFollowDate" type="date" value="${lead.follow_up_date || ""}" class="lp-input" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-slate-600">Catatan</label>
            <textarea id="sheetLeadNotes" class="lp-textarea">${lead.notes || ""}</textarea>
          </div>
          <button type="button" onclick="App.saveLeadFollowUp('${lead.id}')" class="lp-btn lp-btn-purple">Simpan Perubahan</button>
        </div>

        ${
          sims.length
            ? `<div>
                <p class="mb-2 font-display text-sm font-bold text-[#17223B]">Simulasi Terkait</p>
                <ul class="space-y-1.5 text-sm">
                  ${sims.map(s => `<li class="flex justify-between rounded-lg bg-[#F5F6FA] px-3 py-2"><span class="font-medium text-[#351080]">${s.sim_no}</span><span class="lp-num text-slate-600">${this.rp(s.result.plafond)}</span></li>`).join("")}
                </ul>
              </div>`
            : ""
        }

        <div>
          <p class="mb-3 font-display text-sm font-bold text-[#17223B]">Riwayat Aktivitas</p>
          <div class="mb-4 flex gap-2">
            <select id="sheetActType" class="lp-input w-[130px]">
              <option value="telepon">Telepon</option>
              <option value="kunjungan">Kunjungan</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="catatan">Catatan</option>
            </select>
            <input id="sheetActNote" type="text" placeholder="Tulis aktivitas…" class="lp-input flex-1" />
            <button type="button" onclick="App.addLeadActivity('${lead.id}')" class="lp-btn lp-btn-outline">Catat</button>
          </div>
          <ul class="space-y-3">
            ${(lead.activities || [])
              .map(
                a => `
                <li class="border-l-2 border-[#5720B8]/30 pl-3 text-sm">
                  <p class="text-[#17223B]"><span class="font-semibold capitalize">${a.type}</span> — ${a.note}</p>
                  <p class="text-[11px] text-slate-400">${a.user_name} • ${this.fmtDateTime(a.created_at)}</p>
                </li>`
              )
              .join("")}
          </ul>
        </div>
      </div>
    `);
  },

  assignSingleLead(leadId, userId) {
    const leads = window.StorageService.getLeads();
    const lead = leads.find(l => l.id === leadId);
    const mkt = window.StorageService.getUsers().find(u => u.id === userId);
    if (!lead) return;
    lead.assigned_to = mkt ? mkt.id : null;
    lead.assigned_name = mkt ? mkt.name : null;
    window.StorageService.saveLeads(leads);
    window.StorageService.logAudit("assign_lead", lead.name, `Menugaskan lead ${lead.name} ke ${mkt ? mkt.name : "Tidak ditugaskan"}`);
    this.toast("Penugasan diperbarui");
    this.openLeadDetailSheet(leadId);
    this.renderOutlet();
  },

  saveLeadFollowUp(leadId) {
    const leads = window.StorageService.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    lead.status = document.getElementById("sheetLeadStatus")?.value || lead.status;
    lead.follow_up_date = document.getElementById("sheetLeadFollowDate")?.value || null;
    lead.notes = document.getElementById("sheetLeadNotes")?.value || "";
    window.StorageService.saveLeads(leads);
    window.StorageService.logAudit("update_lead", lead.name, `Memperbarui status lead menjadi ${lead.status}`);
    this.toast("Leads diperbarui");
    this.openLeadDetailSheet(leadId);
    this.renderOutlet();
  },

  addLeadActivity(leadId) {
    const noteEl = document.getElementById("sheetActNote");
    const typeEl = document.getElementById("sheetActType");
    const note = noteEl?.value.trim();
    if (!note) return;
    const user = window.StorageService.getCurrentUser();
    const leads = window.StorageService.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    lead.activities = lead.activities || [];
    lead.activities.unshift({
      id: "ACT-" + Date.now(),
      type: typeEl?.value || "telepon",
      note,
      user_name: user.name,
      created_at: new Date().toISOString()
    });
    window.StorageService.saveLeads(leads);
    this.openLeadDetailSheet(leadId);
    this.renderOutlet();
  },

  openAddLeadModal() {
    this.openModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-lg font-bold text-[#17223B]">Tambah Leads</h3>
          <button type="button" onclick="App.closeModal()" class="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div><label class="text-xs font-medium text-slate-600">Nama *</label><input id="lf_name" class="lp-input mt-1" required /></div>
          <div><label class="text-xs font-medium text-slate-600">Nomor Telepon *</label><input id="lf_phone" class="lp-input mt-1" required /></div>
          <div><label class="text-xs font-medium text-slate-600">Kota</label><input id="lf_city" value="Kota Pematangsiantar" class="lp-input mt-1" /></div>
          <div><label class="text-xs font-medium text-slate-600">Cabang</label><input id="lf_branch" value="Pematangsiantar" class="lp-input mt-1" /></div>
          <div><label class="text-xs font-medium text-slate-600">Sumber Data</label><input id="lf_source" value="Manual" class="lp-input mt-1" /></div>
          <div><label class="text-xs font-medium text-slate-600">NOPEN</label><input id="lf_nopen" class="lp-input mt-1" /></div>
          <div><label class="text-xs font-medium text-slate-600">NIP</label><input id="lf_nip" class="lp-input mt-1" /></div>
          <div><label class="text-xs font-medium text-slate-600">Gaji Pensiun (Rp)</label><input id="lf_salary" value="3850000" class="lp-input mt-1" /></div>
          <div class="sm:col-span-2"><label class="text-xs font-medium text-slate-600">Tanggal Lahir (DD/MM/YYYY)</label><input id="lf_birth" placeholder="15/03/1955" value="15/03/1955" class="lp-input mt-1" /></div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="App.closeModal()" class="lp-btn lp-btn-outline">Batal</button>
          <button type="button" onclick="App.submitAddLeadModal()" class="lp-btn lp-btn-cta">Simpan</button>
        </div>
      </div>
    `);
  },

  submitAddLeadModal() {
    const name = document.getElementById("lf_name")?.value.trim();
    const phone = document.getElementById("lf_phone")?.value.trim();
    if (!name || !phone) {
      this.toast("Nama dan Nomor Telepon wajib diisi", "error");
      return;
    }
    const birthIso = this.ddmmyyyyToIso(document.getElementById("lf_birth")?.value) || "1955-03-15";
    const leads = window.StorageService.getLeads();
    leads.unshift({
      id: "LEAD-" + Math.floor(1000 + Math.random() * 9000),
      name,
      phone,
      city: document.getElementById("lf_city")?.value || "Kota Pematangsiantar",
      branch: document.getElementById("lf_branch")?.value || "Pematangsiantar",
      source: document.getElementById("lf_source")?.value || "Manual",
      nopen: document.getElementById("lf_nopen")?.value || "",
      nip: document.getElementById("lf_nip")?.value || "",
      pension_salary: this.parseNumInput(document.getElementById("lf_salary")?.value) || 3850000,
      birth_date: birthIso,
      status: "baru",
      assigned_to: null,
      assigned_name: null,
      follow_up_date: new Date().toISOString().slice(0, 10),
      notes: "",
      documents: [],
      activities: []
    });
    window.StorageService.saveLeads(leads);
    window.StorageService.logAudit("create_lead", name, `Menambahkan data lead baru ${name}`);
    this.closeModal();
    this.renderOutlet();
    this.toast("Leads ditambahkan");
  },

  openAssignLeadsModal() {
    const marketers = window.StorageService.getUsers().filter(u => u.role === "marketing");
    this.openModal(`
      <div class="space-y-4">
        <h3 class="font-display text-lg font-bold text-[#17223B]">Tugaskan ${this.selectedLeadIds.length} leads</h3>
        <select id="bulkAssignMkt" class="lp-input">
          <option value="none">— Lepas penugasan —</option>
          ${marketers.map(m => `<option value="${m.id}">${m.name} • ${m.branch}</option>`).join("")}
        </select>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="App.closeModal()" class="lp-btn lp-btn-outline">Batal</button>
          <button type="button" onclick="App.submitBulkAssignLeads()" class="lp-btn lp-btn-purple">Simpan Penugasan</button>
        </div>
      </div>
    `);
  },

  submitBulkAssignLeads() {
    const uid = document.getElementById("bulkAssignMkt")?.value;
    const mkt = window.StorageService.getUsers().find(u => u.id === uid);
    const leads = window.StorageService.getLeads();
    leads.forEach(l => {
      if (this.selectedLeadIds.includes(l.id)) {
        l.assigned_to = mkt ? mkt.id : null;
        l.assigned_name = mkt ? mkt.name : null;
      }
    });
    window.StorageService.saveLeads(leads);
    window.StorageService.logAudit("bulk_assign_leads", `${this.selectedLeadIds.length} leads`, `Menugaskan ${this.selectedLeadIds.length} leads ke ${mkt ? mkt.name : "Tidak ditugaskan"}`);
    this.selectedLeadIds = [];
    this.closeModal();
    this.renderOutlet();
    this.toast("Penugasan leads berhasil disimpan");
  },

  // ==========================================================================
  // 3. IMPOR LEADS PAGE
  // ==========================================================================
  renderImportPage() {
    const history = window.StorageService.getImports();
    return `
      ${this.pageHeaderHtml({
        eyebrow: "Database",
        title: "Impor Leads",
        desc: "Unggah file Excel (.xlsx) atau CSV. Kolom wajib: Nama, Telepon. Kolom opsional: Kota, Cabang, Sumber, NOPEN, NIP, Gaji Pensiun, Tanggal Lahir. Nomor telepon duplikat dilewati otomatis.",
        actionsHtml: `<button type="button" onclick="App.downloadImportTemplate()" class="lp-btn lp-btn-outline">⇩ Unduh Template CSV</button>`
      })}
      <div class="grid gap-6 lg:grid-cols-5">
        <div class="lp-card p-6 lg:col-span-2">
          <label for="importFileInput" class="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#5720B8]/25 bg-[#5720B8]/[0.03] px-6 py-12 text-center transition-colors hover:border-[#5720B8]/50">
            <div class="text-[#5720B8] mb-2">${ICONS.upload}</div>
            <p class="mt-2 font-semibold text-[#17223B]" id="importFileLabel">Pilih file .xlsx atau .csv</p>
            <p class="mt-1 text-xs text-slate-500">Maksimal 5 MB</p>
          </label>
          <input id="importFileInput" type="file" accept=".xlsx,.xls,.csv" class="hidden" onchange="App.handleImportFileChosen(this)" />
          <button type="button" onclick="App.executeLeadImport()" class="lp-btn lp-btn-cta mt-4 w-full">Impor Sekarang</button>
        </div>

        <div class="lp-card lg:col-span-3">
          <div class="border-b px-6 py-4"><h2 class="font-display font-bold text-[#17223B]">Riwayat Impor</h2></div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b bg-[#F5F6FA]/60 text-left text-xs font-semibold text-slate-500">
                  <th class="p-3">File</th><th class="p-3">Oleh</th><th class="p-3">Baru</th><th class="p-3">Duplikat</th><th class="p-3">Error</th><th class="p-3">Waktu</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                ${history
                  .map(
                    h => `
                    <tr>
                      <td class="p-3 font-medium text-[#17223B]">${h.filename}</td>
                      <td class="p-3">${h.user_name}</td>
                      <td class="p-3 font-semibold text-[#078D67]">+${h.inserted}</td>
                      <td class="p-3">${h.skipped_duplicates}</td>
                      <td class="p-3">${h.error_count}</td>
                      <td class="p-3 text-xs text-slate-500">${this.fmtDateTime(h.created_at)}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  downloadImportTemplate() {
    const csv = "Nama,Telepon,Kota,Cabang,Sumber,NOPEN,NIP,Gaji Pensiun,Tanggal Lahir\r\nBpk. H. Amiruddin,081265001199,Kota Pematangsiantar,Pematangsiantar,Taspen,1200991122,195408121979011001,3900000,12/08/1954";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_impor_leads.csv";
    a.click();
    URL.revokeObjectURL(url);
    this.toast("Template CSV berhasil diunduh");
  },

  handleImportFileChosen(input) {
    const file = input.files && input.files[0];
    const lbl = document.getElementById("importFileLabel");
    if (file && lbl) lbl.textContent = file.name;
  },

  executeLeadImport() {
    const inp = document.getElementById("importFileInput");
    const fname = (inp && inp.files && inp.files[0] && inp.files[0].name) || "Data_Batch_Taspen_" + new Date().toISOString().slice(0, 10) + ".xlsx";
    const user = window.StorageService.getCurrentUser();

    const leads = window.StorageService.getLeads();
    leads.unshift({
      id: "LEAD-" + Math.floor(1000 + Math.random() * 9000),
      name: "Drs. H. Burhanuddin Nasution",
      phone: "08126099" + Math.floor(1000 + Math.random() * 8999),
      city: "Kota Pematangsiantar",
      branch: user.branch || "Pematangsiantar",
      source: fname,
      nopen: "1200" + Math.floor(100000 + Math.random() * 899999),
      nip: "195405101980031002",
      pension_salary: 4050000,
      birth_date: "1954-05-10",
      status: "baru",
      assigned_to: null,
      assigned_name: null,
      follow_up_date: new Date().toISOString().slice(0, 10),
      notes: "Diimpor dari " + fname,
      documents: [],
      activities: []
    });
    window.StorageService.saveLeads(leads);

    const imports = window.StorageService.getImports();
    imports.unshift({
      id: "IMP-" + Math.floor(310 + Math.random() * 600),
      filename: fname,
      user_name: user.name,
      total_rows: 15,
      inserted: 14,
      skipped_duplicates: 1,
      error_count: 0,
      created_at: new Date().toISOString()
    });
    window.StorageService.saveImports(imports);
    window.StorageService.logAudit("import_leads", fname, `Mengimpor 14 leads baru dari ${fname}`);
    this.renderOutlet();
    this.toast("14 leads berhasil diimpor");
  },

  // ==========================================================================
  // 4. SIMULASI MITRA BANK (CALC PLATINUM, BSI PRAPENSIUN, & MITRA BANK)
  // ==========================================================================
  renderResultViewHtml(r) {
    const row = (k, v, strong = false) => `
      <div class="flex items-center justify-between gap-4 px-4 py-2.5 text-sm odd:bg-[#F5F6FA]">
        <span class="text-slate-500">${k}</span>
        <span class="lp-num text-right font-semibold ${strong ? "text-[#351080]" : "text-[#17223B]"}">${v}</span>
      </div>`;

    const block = (title, accent, content) => `
      <div>
        <p class="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#351080]">
          <span class="h-3 w-[3px] rounded" style="background:${accent}"></span>${title}
        </p>
        <div class="overflow-hidden rounded-lg border border-slate-100">${content}</div>
      </div>`;

    const isBsi = r.engine === "bsi_simas";

    return `
      <div class="space-y-6">
        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-6">
            ${block(
              "Identitas Debitur",
              "#351080",
              row("Nama Debitur", r.name) +
              row("Tanggal Proses", this.fmtDate(r.process_date)) +
              row("Usia", `${r.age} tahun`) +
              row("Kategori Produk", r.category, true)
            )}
            ${block(
              "Parameter Pengajuan",
              "#F28A19",
              row("Plafond", this.rp(r.plafond)) +
              row("Tenor", `${r.tenor} bulan`) +
              row(isBsi ? "Margin/Ujrah Aktif" : "Bunga Bank", `${this.pct(r.bank_rate)} per tahun`) +
              row(isBsi ? "Margin/Ujrah Pensiun" : "Bunga Koperasi", `${this.pct(r.coop_rate)} per tahun`) +
              row("Gaji Bulanan", this.rp(r.salary)) +
              row("Nilai Take Over", this.rp(r.take_over)) +
              row("Tata Laksana", this.pct(r.tata_laksana_pct))
            )}
            ${block(
              "Rincian Angsuran",
              "#5720B8",
              row(isBsi ? "Angsuran Masa Aktif" : "Angsuran Bank per Bulan", this.rp(r.bank_installment)) +
              row(isBsi ? "Angsuran Saat Aktif (Efektif)" : "Angsuran Koperasi per Bulan", this.rp(r.coop_installment), true) +
              row(isBsi ? "Angsuran Masa Pensiun" : "BAA per Bulan", this.rp(r.baa)) +
              row("Rasio Angsuran Aktual", this.pct(r.ratio_pct))
            )}
          </div>
          <div class="space-y-6">
            ${block(
              "Rincian Biaya Kredit",
              "#5720B8",
              row(isBsi ? `Biaya Administrasi (${this.pct(r.proaq_pct)})` : `Biaya PROAQ (${this.pct(r.proaq_pct)})`, this.rp(r.proaq)) +
              row(isBsi ? `Kontribusi Simas Jiwa (${r.risk_pct}‰)` : `Cadangan Risiko (${this.pct(r.risk_pct)})`, this.rp(r.risk)) +
              row(isBsi ? "Biaya Materai" : "Biaya Administrasi", this.rp(r.admin_fee)) +
              row(`Biaya Tata Laksana (${this.pct(r.tata_laksana_pct)})`, this.rp(r.tata_laksana_fee)) +
              row("Total Biaya Kredit", this.rp(r.total_fees), true)
            )}
            ${block(
              "Rincian Pengurang Pencairan",
              "#F28A19",
              row("Total Biaya Kredit", this.rp(r.total_fees)) +
              row("Nilai Take Over", this.rp(r.take_over)) +
              row(isBsi ? "Blokir Angsuran (Aktif + Pensiun)" : "Retensi Angsuran (× angsuran)", this.rp(r.retention))
            )}
            ${block(
              "Validasi",
              "#078D67",
              (r.validations || [])
                .map(
                  v => `
                  <div class="flex items-center justify-between px-4 py-2 text-sm odd:bg-[#F5F6FA] ${v.key === "overall" ? "font-bold" : ""}">
                    <span class="text-slate-600">${v.label}</span>
                    <span class="flex items-center gap-1 font-semibold ${v.ok ? "text-[#078D67]" : "text-red-600"}">
                      ${v.ok ? ICONS.checkCircle : ICONS.xCircle}
                      <span>${v.ok ? "Sesuai" : "Tidak Sesuai"}</span>
                    </span>
                  </div>`
                )
                .join("")
            )}
          </div>
        </div>
        <div class="grid gap-px overflow-hidden rounded-xl bg-[#351080] sm:grid-cols-2">
          <div class="p-5 text-white">
            <p class="text-xs text-white/70">Hasil Pencairan — Sisa Pencairan Bersih</p>
            <p class="mt-1 font-display text-3xl font-bold lp-num">${this.rp(r.net_disbursement)}</p>
          </div>
          <div class="p-5 text-white sm:border-l sm:border-white/15">
            <p class="text-xs text-white/70">Sisa Gaji setelah Angsuran</p>
            <p class="mt-1 font-display text-3xl font-bold lp-num">${this.rp(r.remaining_salary)}</p>
          </div>
        </div>
      </div>
    `;
  },

  renderCalculatorPage() {
    const st = this.calcState;
    const params = window.StorageService.getPartnerParameters();
    const activePartnerCfg = params[st.bankKey] || params.ams2;
    const isBsi = st.bankKey === "bsi_prapen";

    return `
      <div>
        <!-- Header Card Identik Emergent -->
        <div class="lp-card mb-8 flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
            <img src="./assets/img/layanan-pensiunan-logo-horizontal.png" alt="LAYANAN PENSIUNAN" class="lp-logo w-auto h-14" onerror="this.src=window.BRAND_ASSETS.lpHorizontalLogo" />
            <div class="sm:border-l sm:border-slate-200 sm:pl-5">
              <h1 class="font-display text-2xl font-extrabold tracking-tight text-[#351080]">LAYANAN PENSIUNAN SuperApps Navigator</h1>
              <p class="text-sm text-[#078D67]">Your Business Partner. Growing Together. One Hand Solution.</p>
            </div>
          </div>
          <span class="inline-flex items-center gap-1.5 self-start rounded-full bg-[#078D67]/10 px-3 py-1 text-xs font-semibold text-[#078D67] md:self-center">
            ${ICONS.shieldCheck}
            <span>Parameter ${activePartnerCfg.shortName || activePartnerCfg.code} — Versi Aktif</span>
          </span>
        </div>

        <!-- Pilih Bank / Mitra Grid Identik Emergent -->
        <section class="lp-card mb-6 p-6">
          <p class="lp-eyebrow mb-3">Pilih Bank / Mitra</p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            ${BANK_OPTIONS.map(
              b => `
              <button type="button" onclick="App.selectCalcBank('${b.key}')"
                class="rounded-lg border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                  st.bankKey === b.key
                    ? "border-[#5720B8] bg-[#5720B8]/8 text-[#351080]"
                    : "border-slate-200 text-[#17223B] hover:border-[#5720B8]/40"
                }">
                ${b.name}
                <span class="mt-1 block text-[10px] font-medium text-[#078D67]">Parameter Dinamis Aktif</span>
              </button>`
            ).join("")}
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <span class="rounded-md bg-[#351080]/8 px-3 py-1.5 font-semibold text-[#351080]">
              Segmen: ${isBsi ? "PRAPENSIUN NOS + SIMAS JIWA" : "PLATINUM / PENSIUN (Otomatis)"}
            </span>
            <label class="flex items-center gap-2">
              <span>Jenis Dapem</span>
              <select onchange="App.calcState.dapem=this.value" class="h-9 rounded-md border px-2 bg-white">
                <option value="TASPEN" ${st.dapem === "TASPEN" ? "selected" : ""}>TASPEN</option>
                <option value="ASABRI" ${st.dapem === "ASABRI" ? "selected" : ""}>ASABRI</option>
              </select>
            </label>
            ${
              isBsi
                ? `
                <label class="flex items-center gap-2">
                  <span>Skema BSI</span>
                  <select onchange="App.calcState.bsiScheme=this.value; App.resetCalcOutputs()" class="h-9 rounded-md border px-2 bg-white">
                    <option value="PP10" ${st.bsiScheme === "PP10" ? "selected" : ""}>Dekade Berkah (PP10)</option>
                    <option value="PP3" ${st.bsiScheme === "PP3" ? "selected" : ""}>Tri Berkah (PP3)</option>
                  </select>
                </label>
                <label class="flex items-center gap-2">
                  <span>Atribusi Simas Jiwa</span>
                  <select onchange="App.calcState.bsiAtribusi=this.value; App.resetCalcOutputs()" class="h-9 rounded-md border px-2 bg-white">
                    <option value="atribusi_asuransi" ${st.bsiAtribusi === "atribusi_asuransi" ? "selected" : ""}>2. Atribusi Asuransi</option>
                    <option value="no_atribusi" ${st.bsiAtribusi === "no_atribusi" ? "selected" : ""}>1. No Atribusi</option>
                  </select>
                </label>`
                : ""
            }
          </div>
        </section>

        <!-- Main 2-Column Calculator Grid (400px Left + 1fr Right) -->
        <div class="grid gap-6 xl:grid-cols-[400px_1fr]">
          <div class="space-y-6">
            <!-- Step 1: Data Debitur -->
            <section class="lp-card p-6">
              <div class="mb-5 flex items-center gap-3">
                <span class="flex h-7 w-7 items-center justify-center rounded-full bg-[#351080] text-xs font-bold text-white">1</span>
                <h2 class="font-display text-base font-bold text-[#17223B]">Data Debitur</h2>
              </div>
              <div class="space-y-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-slate-700">Nama debitur</label>
                  <input id="c_name" value="${st.name}" oninput="App.calcState.name=this.value" class="lp-input h-11" />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-slate-700">Tanggal lahir (DD/MM/YYYY)</label>
                  <input id="c_birth" placeholder="12/04/1953" value="${st.birth}" oninput="App.calcState.birth=this.value" class="lp-input h-11 lp-num" />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-slate-700">${isBsi ? "Gaji Pokok ASN / Aktif per bulan (Rp)" : "Gaji per bulan (Rp)"}</label>
                  <input id="c_salary" value="${this.formatNumInput(st.salary)}" oninput="this.value=App.formatNumInput(this.value); App.calcState.salary=App.parseNumInput(this.value)" class="lp-input h-11 lp-num" />
                </div>
                ${
                  isBsi
                    ? `
                    <div class="grid grid-cols-2 gap-2.5">
                      <div class="space-y-1">
                        <label class="text-[11px] font-medium text-slate-600">Tunjangan Rutin/Bln</label>
                        <input value="${this.formatNumInput(st.tunjangan1Bln)}" oninput="this.value=App.formatNumInput(this.value); App.calcState.tunjangan1Bln=App.parseNumInput(this.value)" class="lp-input h-10 lp-num" />
                      </div>
                      <div class="space-y-1">
                        <label class="text-[11px] font-medium text-slate-600">Estimasi Manfaat Pensiun</label>
                        <input value="${this.formatNumInput(st.manfaatPensiun)}" oninput="this.value=App.formatNumInput(this.value); App.calcState.manfaatPensiun=App.parseNumInput(this.value)" class="lp-input h-10 lp-num" />
                      </div>
                    </div>`
                    : ""
                }
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-slate-700">Nilai Take Over (TO)</label>
                  <input id="c_to" value="${this.formatNumInput(st.take_over)}" oninput="this.value=App.formatNumInput(this.value); App.calcState.take_over=App.parseNumInput(this.value)" class="lp-input h-11 lp-num" />
                </div>
                <button type="button" onclick="App.handleCalcMax()" class="lp-btn lp-btn-cta h-11 w-full font-semibold">
                  Hitung Hasil Maksimal
                </button>
              </div>
            </section>

            <!-- Step 2: Tata Laksana, Plafond & Tenor -->
            ${
              st.mx && st.mx.processable
                ? `
                <section class="lp-card p-6 lp-fade">
                  <div class="mb-5 flex items-center gap-3">
                    <span class="flex h-7 w-7 items-center justify-center rounded-full bg-[#351080] text-xs font-bold text-white">2</span>
                    <h2 class="font-display text-base font-bold text-[#17223B]">Tata Laksana, Plafond & Tenor</h2>
                  </div>
                  <div class="space-y-5">
                    <div class="space-y-1.5">
                      <label class="text-xs font-medium text-slate-700">Tata Laksana (%)</label>
                      <input id="c_tl" value="${st.tl}" oninput="App.calcState.tl=this.value" placeholder="0 – 3,5" class="lp-input h-11" />
                      <p class="text-xs text-slate-500">Standar maksimal Tata Laksana adalah ${activePartnerCfg.tataLaksanaMax ?? 3.5}% dari plafond pengajuan. Tidak boleh negatif.</p>
                    </div>
                    <div class="space-y-2.5">
                      <label class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${st.mode === "max" ? "border-[#5720B8] bg-[#5720B8]/5" : "border-slate-200"}">
                        <input type="radio" name="calcMode" value="max" ${st.mode === "max" ? "checked" : ""} onchange="App.setCalcMode('max')" />
                        <span>Gunakan plafond & tenor maksimal</span>
                      </label>
                      <label class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${st.mode === "custom" ? "border-[#5720B8] bg-[#5720B8]/5" : "border-slate-200"}">
                        <input type="radio" name="calcMode" value="custom" ${st.mode === "custom" ? "checked" : ""} onchange="App.setCalcMode('custom')" />
                        <span>Tentukan plafond & tenor sendiri</span>
                      </label>
                    </div>
                    ${
                      st.mode === "custom"
                        ? `
                        <div class="grid grid-cols-2 gap-3">
                          <div class="col-span-2 space-y-1.5">
                            <label class="text-xs font-medium text-slate-700">Plafond (Rp)</label>
                            <input value="${this.formatNumInput(st.customPlafond)}" oninput="this.value=App.formatNumInput(this.value); App.calcState.customPlafond=App.parseNumInput(this.value)" class="lp-input h-11 lp-num" />
                          </div>
                          <div class="space-y-1.5">
                            <label class="text-xs font-medium text-slate-700">Tenor (bulan)</label>
                            <input type="number" value="${st.customTenor}" oninput="App.calcState.customTenor=Number(this.value)" class="lp-input h-11 lp-num" />
                          </div>
                        </div>`
                        : ""
                    }
                    <button type="button" onclick="App.handleCalcFinal()" class="lp-btn lp-btn-purple h-11 w-full font-semibold">
                      Hitung Simulasi Final
                    </button>
                  </div>
                </section>`
                : ""
            }
          </div>

          <!-- Right Column: MaxCard & Final ResultView -->
          <div class="space-y-6">
            ${
              !st.mx
                ? `
                <div class="lp-card flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
                  <img src="./assets/img/layanan-pensiunan-logo-vertical.png" alt="Logo" class="lp-logo w-auto h-28 opacity-90" onerror="this.src=window.BRAND_ASSETS.lpVerticalLogo" />
                  <p class="mt-6 max-w-sm text-sm text-slate-500">Masukkan nama, tanggal lahir, gaji per bulan, dan nilai Take Over lalu klik <b>Hitung Hasil Maksimal</b> untuk memulai simulasi.</p>
                </div>`
                : !st.mx.processable
                  ? `
                  <div class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                    <div>
                      <p class="font-semibold">Pengajuan tidak dapat diproses</p>
                      <p>${st.mx.stop_reason}</p>
                    </div>
                  </div>`
                  : `
                  <div class="lp-card p-6 lp-fade">
                    <p class="lp-eyebrow">Hasil Maksimal Simulasi</p>
                    <p class="mt-1 font-display text-lg font-bold text-[#17223B]">Nama Debitur: ${st.mx.name}</p>
                    <div class="mt-4">
                      <div class="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm"><span class="text-slate-500">Tanggal Proses</span><span class="lp-num font-semibold text-[#17223B]">${this.fmtDate(st.mx.process_date)}</span></div>
                      <div class="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm"><span class="text-slate-500">Usia Saat Ini</span><span class="lp-num font-semibold text-[#17223B]">${st.mx.age} tahun</span></div>
                      <div class="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm"><span class="text-slate-500">Kategori Produk</span><span class="lp-num font-semibold text-[#351080]">${st.mx.category}</span></div>
                      <div class="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm"><span class="text-slate-500">${isBsi ? "Rate Margin Acuan" : "Bunga Koperasi / Mitra"}</span><span class="lp-num font-semibold text-[#17223B]">${this.pct(st.mx.coop_rate)} per tahun</span></div>
                      <div class="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm"><span class="text-slate-500">Gaji / Penghasilan Diakui</span><span class="lp-num font-semibold text-[#17223B]">${this.rp(st.mx.salary)}</span></div>
                      <div class="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm"><span class="text-slate-500">Angsuran Maksimal</span><span class="lp-num font-semibold text-[#17223B]">${this.rp(st.mx.max_installment)}</span></div>
                      <div class="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm"><span class="text-slate-500">Tenor Maksimal</span><span class="lp-num font-semibold text-[#17223B]">${st.mx.max_tenor} bulan</span></div>
                      <div class="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm"><span class="text-slate-500">Plafond Maksimal</span><span class="lp-num font-semibold text-[#351080]">${this.rp(st.mx.max_plafond)}</span></div>
                      <div class="flex justify-between gap-4 py-2.5 text-sm"><span class="text-slate-500">Nilai Take Over</span><span class="lp-num font-semibold text-[#17223B]">${this.rp(st.mx.take_over)}</span></div>
                    </div>
                  </div>`
            }

            ${
              st.res
                ? `
                <div class="lp-card p-6 lp-fade">
                  <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p class="lp-eyebrow">Your Business Partner. Growing Together. One Hand Solution.</p>
                      <h2 class="font-display text-xl font-bold text-[#17223B]">Hasil Simulasi Final</h2>
                    </div>
                    ${st.savedSim ? `<span class="rounded-md bg-[#351080]/8 px-3 py-1 text-sm font-semibold text-[#351080]">${st.savedSim.sim_no}</span>` : ""}
                  </div>

                  ${
                    !st.res.overall_ok
                      ? `<div class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                          <p class="font-semibold">Pengajuan belum sesuai ketentuan. Mohon koreksi nilai pengajuan:</p>
                          <ul class="mt-1 list-disc pl-5">${(st.res.issues || []).map(i => `<li>${i}</li>`).join("")}</ul>
                        </div>`
                      : ""
                  }

                  ${this.renderResultViewHtml(st.res)}

                  <div class="mt-6 space-y-4">
                    ${
                      st.res.overall_ok && !st.savedSim
                        ? `<button type="button" onclick="App.saveSimulation()" class="lp-btn lp-btn-cta h-11 w-full font-semibold">💾 Simpan Simulasi</button>`
                        : ""
                    }

                    ${
                      st.savedSim
                        ? `
                        <!-- Download Actions (PDF A4 & Gambar PNG) -->
                        <div class="rounded-xl border border-[#F28A19]/25 bg-[#F28A19]/5 p-4">
                          <p class="text-sm font-medium text-[#17223B]">Apakah Anda ingin mendownload simulasi ini dalam format gambar atau PDF?</p>
                          <div class="mt-3 flex flex-wrap gap-2">
                            <button type="button" onclick="App.downloadSimPdf()" class="lp-btn lp-btn-cta">⇩ PDF A4</button>
                            <button type="button" onclick="App.downloadSimPng()" class="lp-btn lp-btn-outline">🖼 Gambar PNG</button>
                          </div>
                        </div>

                        <!-- Persetujuan Simulasi & Lanjut Pengajuan -->
                        <div class="rounded-xl border border-[#351080]/15 p-4">
                          <p class="font-display text-sm font-bold text-[#351080]">Persetujuan Simulasi</p>
                          ${
                            st.simStatus === "dibatalkan"
                              ? `<p class="mt-2 text-sm text-slate-500">Pengajuan dibatalkan. Simulasi tetap tersimpan di Riwayat Simulasi.</p>`
                              : `
                              <div class="mt-3 max-w-xs space-y-1.5">
                                <label class="text-xs font-medium text-slate-600">No. telepon calon debitur (untuk data leads)</label>
                                <input value="${st.phone}" oninput="App.calcState.phone=this.value" class="lp-input h-10" />
                              </div>
                              <div class="mt-3 flex flex-wrap gap-2">
                                <button type="button" onclick="App.approveSimAndCreateApp()" class="lp-btn lp-btn-green">Setujui Simulasi & Lanjut Pengajuan</button>
                                <button type="button" onclick="App.cancelSimApplication()" class="lp-btn lp-btn-outline text-red-600">Batalkan Pengajuan</button>
                              </div>`
                          }
                        </div>

                        <!-- Ringkasan AI untuk Debitur (WhatsApp) -->
                        <div class="rounded-xl border border-[#5720B8]/15 p-4">
                          <div class="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p class="flex items-center gap-2 font-display text-sm font-bold text-[#351080]">${ICONS.sparkles}<span>Ringkasan AI untuk Debitur</span></p>
                              <p class="text-xs text-slate-500">Pesan siap kirim (WhatsApp) berdasarkan angka simulasi final — AI tidak menghitung ulang.</p>
                            </div>
                            <div class="flex gap-2">
                              <select onchange="App.calcState.aiModel=this.value" class="lp-input h-10 w-[170px]">
                                <option value="gpt" ${st.aiModel === "gpt" ? "selected" : ""}>ChatGPT (GPT-5.6)</option>
                                <option value="gemini" ${st.aiModel === "gemini" ? "selected" : ""}>Gemini 3.1 Pro</option>
                              </select>
                              <button type="button" onclick="App.generateAiSummary()" class="lp-btn lp-btn-royal">Buat</button>
                            </div>
                          </div>
                          ${
                            st.aiText
                              ? `<div class="mt-4 rounded-lg bg-[#F5F6FA] p-4 text-sm leading-relaxed whitespace-pre-wrap text-[#17223B]">${st.aiText}
                                  <div class="mt-2"><button type="button" onclick="navigator.clipboard.writeText(App.calcState.aiText); App.toast('Ringkasan disalin ke clipboard')" class="lp-btn lp-btn-outline lp-btn-sm">📋 Salin Pesan WhatsApp</button></div>
                                </div>`
                              : ""
                          }
                        </div>`
                        : ""
                    }

                    <button type="button" onclick="App.resetCalcFull()" class="lp-btn lp-btn-outline">↺ Simulasi baru</button>
                  </div>
                </div>`
                : ""
            }
          </div>
        </div>
      </div>
    `;
  },

  selectCalcBank(bankKey) {
    this.calcState.bankKey = bankKey;
    if (bankKey === "bsi_prapen") {
      this.calcState.birth = "22/10/1976";
      this.calcState.salary = 4212300;
      this.calcState.tl = "0";
      this.calcState.customPlafond = 480000000;
      this.calcState.customTenor = 180;
    } else {
      this.calcState.birth = "12/04/1953";
      this.calcState.salary = 3850000;
      this.calcState.tl = "3.5";
      this.calcState.customPlafond = 120000000;
      this.calcState.customTenor = 120;
    }
    this.resetCalcOutputs();
    this.renderOutlet();
  },

  resetCalcOutputs() {
    this.calcState.mx = null;
    this.calcState.res = null;
    this.calcState.savedSim = null;
    this.calcState.simStatus = "";
    this.calcState.aiText = "";
  },

  resetCalcFull() {
    this.calcState.name = "";
    this.calcState.take_over = 0;
    this.resetCalcOutputs();
    this.renderOutlet();
  },

  setCalcMode(mode) {
    this.calcState.mode = mode;
    this.calcState.res = null;
    this.calcState.savedSim = null;
    this.renderOutlet();
  },

  computeEngineOutput(useMaxMode) {
    const st = this.calcState;
    const birthIso = this.ddmmyyyyToIso(st.birth);
    const procIso = new Date().toISOString().slice(0, 10);
    const params = window.StorageService.getPartnerParameters();
    const cfg = params[st.bankKey] || params.ams2;

    const rawInput = {
      name: st.name || "Calon Debitur",
      dob: birthIso,
      processDate: procIso,
      salary: st.salary,
      gajiPokok: st.salary,
      uangMakan: st.uangMakan,
      tunjanganRutin1Bln: st.tunjangan1Bln,
      manfaatPensiun: st.manfaatPensiun,
      bsiScheme: st.bsiScheme,
      akadType: st.bsiAkad,
      atribusiMode: st.bsiAtribusi,
      payrollStatus: st.bsiPayroll,
      bupAge: st.bsiBupAge,
      isTakeOver: st.take_over > 0,
      takeOverAmount: st.take_over,
      plafond: useMaxMode ? 100000000 : st.customPlafond,
      tenor: useMaxMode ? (cfg.maxTenorMonths || 120) : st.customTenor,
      tataLaksanaPercent: Number(String(st.tl).replace(",", ".")) || 0
    };

    let engRes;
    if (cfg.engine === "ams2") {
      engRes = window.AMS2Engine.calculate(rawInput, cfg);
    } else if (cfg.engine === "bsi_simas") {
      engRes = window.BSISimasEngine.calculate(rawInput, cfg);
    } else {
      engRes = window.PartnerBankEngine.calculate(rawInput, cfg);
    }

    if (useMaxMode && engRes.maximums.maxPlafond > 0 && engRes.maximums.maxTenor > 0) {
      rawInput.plafond = engRes.maximums.maxPlafond;
      rawInput.tenor = engRes.maximums.maxTenor;
      if (cfg.engine === "ams2") engRes = window.AMS2Engine.calculate(rawInput, cfg);
      else if (cfg.engine === "bsi_simas") engRes = window.BSISimasEngine.calculate(rawInput, cfg);
      else engRes = window.PartnerBankEngine.calculate(rawInput, cfg);
    }

    return { engRes, birthIso, procIso, cfg };
  },

  handleCalcMax() {
    const birthIso = this.ddmmyyyyToIso(this.calcState.birth);
    if (!birthIso) {
      this.toast("Tanggal lahir harus berformat DD/MM/YYYY", "error");
      return;
    }
    const { engRes, procIso } = this.computeEngineOutput(true);
    const processable = engRes.maximums.maxTenor > 0 && engRes.maximums.maxPlafond > 0;
    this.calcState.mx = {
      processable,
      stop_reason: processable ? "" : "Usia nasabah melewati batas usia akhir ketentuan mitra pembiayaan.",
      name: this.calcState.name || "Calon Debitur",
      process_date: procIso,
      age: engRes.debtor.ageYears,
      category: engRes.product.category,
      coop_rate: engRes.product.coopRateAnnual || engRes.product.baseRatePensiunAnnual || 17,
      salary: engRes.simulation.salary,
      max_installment: engRes.maximums.maxInstallment,
      max_tenor: engRes.maximums.maxTenor,
      max_plafond: engRes.maximums.maxPlafond,
      take_over: this.calcState.take_over
    };
    this.calcState.customPlafond = engRes.maximums.maxPlafond;
    this.calcState.customTenor = engRes.maximums.maxTenor;
    this.calcState.res = null;
    this.calcState.savedSim = null;
    this.renderOutlet();
  },

  handleCalcFinal() {
    const useMax = this.calcState.mode === "max";
    const { engRes, birthIso, procIso } = this.computeEngineOutput(useMax);
    const isBsi = engRes.engine === "bsi_simas";

    this.calcState.lastRawEngineResult = engRes;
    this.calcState.res = {
      engine: engRes.engine,
      name: this.calcState.name || "Calon Debitur",
      birth_date: birthIso,
      process_date: procIso,
      age: engRes.debtor.ageYears,
      category: engRes.product.category,
      plafond: engRes.simulation.plafond,
      tenor: engRes.simulation.tenor,
      bank_rate: isBsi ? engRes.product.priceAtribAktifPercent : engRes.product.bankRateAnnual,
      coop_rate: isBsi ? engRes.product.priceAtribPensiunPercent : engRes.product.coopRateAnnual,
      salary: engRes.simulation.salary,
      take_over: engRes.simulation.takeOverAmount,
      tata_laksana_pct: engRes.product.tataLaksanaPercent ?? 0,
      bank_installment: engRes.simulation.bankInstallment,
      coop_installment: engRes.simulation.coopInstallment,
      baa: isBsi ? engRes.simulation.pensionInstallment : engRes.simulation.baaMonthly,
      ratio_pct: Number(engRes.simulation.actualInstallmentRatio.toFixed(2)),
      proaq_pct: isBsi ? 1.0 : (engRes.product.proaqRate ?? engRes.product.provisionRatePercent ?? 10),
      proaq: isBsi ? engRes.simulation.adminFee : engRes.simulation.proaqFee,
      risk_pct: isBsi ? engRes.simasInsurance.tarifPerMil : (engRes.product.riskReserveRate ?? engRes.product.insuranceRatePercent ?? 20),
      risk: isBsi ? engRes.simasInsurance.totalKontribusi : engRes.simulation.riskReserveFee,
      admin_fee: isBsi ? engRes.simulation.materaiFee : engRes.simulation.adminFee,
      tata_laksana_fee: engRes.simulation.tataLaksanaFee || 0,
      total_fees: engRes.simulation.totalCreditCost,
      retention: engRes.simulation.retentionAmount,
      net_disbursement: engRes.simulation.netDisbursement,
      remaining_salary: engRes.simulation.remainingSalary,
      overall_ok: engRes.overallValid,
      issues: engRes.checks.filter(c => c.level === "fail").map(c => c.message),
      validations: engRes.checks.map((c, idx) => ({
        key: `v_${idx}`,
        label: c.title,
        ok: c.level !== "fail"
      })).concat([{ key: "overall", label: "Status Keseluruhan Simulasi", ok: engRes.overallValid }])
    };
    this.calcState.savedSim = null;
    this.renderOutlet();
  },

  saveSimulation() {
    const st = this.calcState;
    if (!st.res) return;
    const user = window.StorageService.getCurrentUser();
    const sims = window.StorageService.getSimulations();
    const simNo = `SIM-202610-${String(sims.length + 1).padStart(3, "0")}`;
    const bankObj = BANK_OPTIONS.find(b => b.key === st.bankKey) || BANK_OPTIONS[0];

    const newSim = {
      id: "SIM-" + Date.now(),
      sim_no: simNo,
      lead_id: st.leadId,
      bank_key: st.bankKey,
      bank_name: bankObj.name,
      dapem: st.dapem,
      created_by: user.id,
      created_by_name: user.name,
      created_at: new Date().toISOString(),
      result: st.res,
      rawEngineResult: st.lastRawEngineResult,
      ai_summaries: []
    };

    sims.unshift(newSim);
    window.StorageService.saveSimulations(sims);
    window.StorageService.logAudit("create_simulation", simNo, `Menyimpan simulasi ${simNo} untuk ${st.res.name} (${this.rp(st.res.plafond)})`);
    st.savedSim = newSim;
    this.renderOutlet();
    this.toast(`Simulasi ${simNo} tersimpan`);
  },

  downloadSimPdf(simOverride = null) {
    const sim = simOverride || this.calcState.savedSim;
    if (!sim) return;
    let raw = sim.rawEngineResult;
    if (!raw) {
      this.computeEngineOutput(false);
      raw = this.calcState.lastRawEngineResult;
    }
    if (raw && window.PDFGenerator) {
      const fn = window.PDFGenerator.downloadSimulationPdf(raw);
      window.StorageService.logAudit("download_pdf", sim.sim_no, `Mengunduh PDF A4 simulasi ${sim.sim_no}`);
      this.toast(`PDF A4 (${fn}) berhasil diunduh`);
    }
  },

  downloadSimPng(simOverride = null) {
    const sim = simOverride || this.calcState.savedSim;
    if (!sim) return;
    const r = sim.result;
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 900, 640);
    ctx.fillStyle = "#351080";
    ctx.fillRect(0, 0, 900, 88);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("LAYANAN PENSIUNAN — RINGKASAN SIMULASI RESMI", 32, 46);
    ctx.font = "14px sans-serif";
    ctx.fillText(`${sim.sim_no} • ${sim.bank_name} • Kategori: ${r.category}`, 32, 72);

    const lines = [
      ["Nama Debitur", r.name],
      ["Usia Saat Ini", `${r.age} tahun`],
      ["Gaji Bulanan", this.rp(r.salary)],
      ["Plafond Pengajuan", this.rp(r.plafond)],
      ["Tenor", `${r.tenor} bulan`],
      ["Angsuran per Bulan", this.rp(r.coop_installment)],
      ["Total Biaya Kredit", this.rp(r.total_fees)],
      ["Retensi / Blokir Angsuran", this.rp(r.retention)],
      ["Nilai Take Over", this.rp(r.take_over)],
      ["SISA PENCAIRAN BERSIH (TERIMA BERSIH)", this.rp(r.net_disbursement)],
      ["SISA GAJI SETELAH ANGSURAN", this.rp(r.remaining_salary)]
    ];

    lines.forEach(([k, v], i) => {
      const y = 130 + i * 42;
      ctx.fillStyle = i >= 9 ? "#351080" : i % 2 === 0 ? "#F5F6FA" : "#FFFFFF";
      ctx.fillRect(32, y - 26, 836, 36);
      ctx.fillStyle = i >= 9 ? "#FFFFFF" : "#17223B";
      ctx.font = i >= 9 ? "bold 16px sans-serif" : "15px sans-serif";
      ctx.fillText(k, 48, y - 2);
      ctx.fillText(String(v), 580, y - 2);
    });

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sim.sim_no}_${r.name.replace(/\s+/g, "_")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast("Gambar PNG simulasi berhasil diunduh");
    });
  },

  generateAiSummary() {
    const sim = this.calcState.savedSim;
    if (!sim) return;
    const r = sim.result;
    const modelLabel = this.calcState.aiModel === "gemini" ? "Gemini 3.1 Pro" : "ChatGPT (GPT-5.6)";
    this.calcState.aiText =
      `Assalamu'alaikum / Selamat pagi Bapak/Ibu *${r.name}* 🙏\n\n` +
      `Berikut kami sampaikan rincian *Simulasi Resmi ${sim.bank_name}* (${sim.sim_no}):\n` +
      `• Kategori Produk: *${r.category}*\n` +
      `• Plafond Pengajuan: *${this.rp(r.plafond)}*\n` +
      `• Tenor: *${r.tenor} bulan*\n` +
      `• Angsuran Bulanan: *${this.rp(r.coop_installment)}*\n` +
      `• Total Biaya Kredit: *${this.rp(r.total_fees)}*\n` +
      `• Retensi Angsuran: *${this.rp(r.retention)}*\n` +
      `• *Terima Bersih Pencairan: ${this.rp(r.net_disbursement)}*\n` +
      `• *Sisa Gaji Bulanan: ${this.rp(r.remaining_salary)}*\n\n` +
      `Apabila Bapak/Ibu berkenan, kami siap mendampingi proses pemberkasan dengan amanah dan transparan.\n` +
      `_Disusun otomatis oleh ${modelLabel} — Layanan Pensiunan Pematangsiantar_`;
    this.renderOutlet();
  },

  approveSimAndCreateApp() {
    const sim = this.calcState.savedSim;
    if (!sim) return;
    const user = window.StorageService.getCurrentUser();
    const apps = window.StorageService.getApplications();
    const appNo = `APP-202610-${String(apps.length + 1).padStart(3, "0")}`;

    const newApp = {
      id: "APP-" + Date.now(),
      app_no: appNo,
      lead_id: sim.lead_id || "LEAD-" + Math.floor(1000 + Math.random() * 8999),
      lead_name: sim.result.name,
      marketing_id: user.id,
      marketing_name: user.name,
      branch: user.branch || "Pematangsiantar",
      bank_key: sim.bank_key,
      bank_name: sim.bank_name,
      debtor_type: sim.result.category,
      dapem: sim.dapem || "TASPEN",
      plafond: sim.result.plafond,
      tenor: sim.result.tenor,
      created_at: new Date().toISOString(),
      stage: "upload_dokumen",
      stage_index: 0,
      rejected: false,
      reject_reason: null,
      pending: {
        party: "marketing",
        type: "upload",
        note: "Silakan unggah 8 dokumen wajib (PDF) nasabah lalu klik Ajukan untuk Pemeriksaan."
      },
      stages: window.StorageService.APP_STAGES_TEMPLATE,
      stage_data: {
        upload_dokumen: { by_name: user.name, date: new Date().toISOString().slice(0, 10) }
      },
      checklist: window.StorageService.MANDATORY_CHECKLIST_TEMPLATE.map(d => ({
        ...d,
        status: "",
        filename: null,
        uploaded_at: null,
        versions: 0,
        note: ""
      })),
      booking: null,
      history: [
        {
          id: "H-" + Date.now(),
          action: "created",
          note: `Pengajuan dibuat dari persetujuan simulasi ${sim.sim_no}`,
          user_name: user.name,
          role: window.RBACGuard.normalizeRole(user.role),
          at: new Date().toISOString()
        }
      ]
    };

    apps.unshift(newApp);
    window.StorageService.saveApplications(apps);
    window.StorageService.logAudit("approve_simulation", appNo, `Menyetujui simulasi ${sim.sim_no} dan membuat pengajuan ${appNo}`);
    this.toast(`Pengajuan ${appNo} dibuat. Lanjutkan upload 8 dokumen PDF.`);
    this.navigate("progress", { appId: newApp.id });
  },

  cancelSimApplication() {
    this.calcState.simStatus = "dibatalkan";
    this.renderOutlet();
    this.toast("Pengajuan dibatalkan. Simulasi tetap tersimpan.", "info");
  },

  // ==========================================================================
  // 5. RIWAYAT SIMULASI PAGE
  // ==========================================================================
  renderSimulationsPage() {
    const q = this.simSearchQ.toLowerCase().trim();
    const sims = window.StorageService.getSimulations().filter(
      s => !q || s.sim_no.toLowerCase().includes(q) || s.result.name.toLowerCase().includes(q)
    );

    return `
      ${this.pageHeaderHtml({
        eyebrow: "Calc Platinum & Mitra Bank",
        title: "Riwayat Simulasi",
        desc: "Seluruh simulasi final yang telah tersimpan beserta file PDF & gambar."
      })}
      <div class="lp-card">
        <div class="border-b p-4">
          <div class="max-w-md">
            <input value="${this.simSearchQ}" oninput="App.simSearchQ=this.value; App.renderOutlet()" placeholder="Cari nomor simulasi atau nama debitur…" class="lp-input h-10" />
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-[#F5F6FA]/60 text-left text-xs font-semibold text-slate-500">
                <th class="p-3">No. Simulasi</th><th class="p-3">Debitur</th><th class="p-3">Mitra & Kategori</th>
                <th class="p-3">Plafond</th><th class="p-3">Tenor</th><th class="p-3">Angsuran</th><th class="p-3">Petugas</th><th class="p-3">Tanggal</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${sims
                .map(
                  s => `
                  <tr class="cursor-pointer hover:bg-[#5720B8]/[0.03]" onclick="App.openSimDetailModal('${s.id}')">
                    <td class="p-3 font-semibold text-[#351080]">${s.sim_no}</td>
                    <td class="p-3 font-medium text-[#17223B]">${s.result.name}</td>
                    <td class="p-3">${s.result.category}</td>
                    <td class="p-3 lp-num">${this.rp(s.result.plafond)}</td>
                    <td class="p-3">${s.result.tenor} bln</td>
                    <td class="p-3 lp-num">${this.rp(s.result.coop_installment)}</td>
                    <td class="p-3">${s.created_by_name}</td>
                    <td class="p-3 text-xs text-slate-500">${this.fmtDateTime(s.created_at)}</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
          ${sims.length === 0 ? `<div class="py-10 text-center text-sm text-slate-400">Belum ada simulasi</div>` : ""}
        </div>
      </div>
    `;
  },

  openSimDetailModal(simId) {
    const sim = window.StorageService.getSimulations().find(s => s.id === simId);
    if (!sim) return;
    this.openModal(
      `
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-xl font-bold text-[#17223B]">${sim.sim_no} — ${sim.result.name}</h3>
          <button type="button" onclick="App.closeModal()" class="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        ${this.renderResultViewHtml(sim.result)}
        <div class="flex flex-wrap gap-2 pt-2">
          <button type="button" onclick="App.downloadSimPdf(window.StorageService.getSimulations().find(x=>x.id==='${sim.id}'))" class="lp-btn lp-btn-cta">⇩ Unduh PDF A4</button>
          <button type="button" onclick="App.downloadSimPng(window.StorageService.getSimulations().find(x=>x.id==='${sim.id}'))" class="lp-btn lp-btn-outline">🖼 Unduh Gambar PNG</button>
        </div>
      </div>
      `,
      true
    );
  },

  // ==========================================================================
  // 6. LIST PROGRESS LEADS (8 STAGES + 8 MANDATORY PDF CHECKLIST + VALIDATE)
  // ==========================================================================
  pendingBadgeHtml(app) {
    if (app.rejected) return `<span class="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">DITOLAK BANK</span>`;
    const p = app.pending;
    if (!p && app.stage === "booking_live") return `<span class="rounded-md bg-[#078D67] px-2 py-0.5 text-xs font-semibold text-white">BOOKING/LIVE</span>`;
    if (!p) return `<span class="rounded-md bg-[#078D67]/10 px-2 py-0.5 text-xs font-semibold text-[#078D67]">Diproses bank</span>`;
    const partyLabel = { marketing: "Marketing", admin_ops: "Admin Operasional", super_admin: "Super Admin" }[p.party] || p.party;
    const cls = p.type === "revisi" ? "bg-[#F28A19]/12 text-[#B5620A]" : p.type === "validate" ? "bg-red-50 text-red-700" : "bg-[#5720B8]/10 text-[#5720B8]";
    return `<span class="rounded-md px-2 py-0.5 text-xs font-semibold ${cls}">${p.type.toUpperCase()} • ${partyLabel}</span>`;
  },

  renderProgressPage() {
    const user = window.StorageService.getCurrentUser();
    const normRole = window.RBACGuard.normalizeRole(user.role);
    const allApps = window.StorageService.getApplications();
    const scoped = normRole === "marketing" ? allApps.filter(a => a.marketing_id === user.id || a.marketing_name === user.name) : allApps;

    const f = this.progressFilter;
    const filtered = scoped.filter(a => {
      const q = f.q.toLowerCase().trim();
      const matchQ = !q || a.app_no.toLowerCase().includes(q) || a.lead_name.toLowerCase().includes(q) || (a.marketing_name || "").toLowerCase().includes(q);
      const matchS = !f.stage || a.stage === f.stage;
      return matchQ && matchS;
    });

    return `
      ${this.pageHeaderHtml({
        eyebrow: "Pengajuan",
        title: "List Progress Leads",
        desc: normRole === "marketing" ? "Progress pengajuan calon debitur milik Anda." : normRole === "admin_ops" ? `Pengajuan marketing cabang ${user.branch}.` : "Seluruh pengajuan di semua cabang."
      })}
      <div class="lp-card">
        <div class="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div class="flex-1">
            <input value="${f.q}" oninput="App.progressFilter.q=this.value; App.renderOutlet()" placeholder="Cari nama, ID, marketing…" class="lp-input h-10" />
          </div>
          <select onchange="App.progressFilter.stage=this.value; App.renderOutlet()" class="lp-input h-10 w-auto">
            <option value="">Semua tahap</option>
            ${window.StorageService.APP_STAGES_TEMPLATE.map(s => `<option value="${s.key}" ${f.stage === s.key ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-[#F5F6FA]/60 text-left text-xs font-semibold text-slate-500">
                <th class="p-3">ID</th><th class="p-3">Calon Nasabah</th>
                ${normRole !== "marketing" ? `<th class="p-3">Marketing</th>` : ""}
                <th class="p-3">Cabang</th><th class="p-3">Bank Mitra</th><th class="p-3">Jenis</th>
                <th class="p-3">Tgl Pengajuan</th><th class="p-3">Tahap</th><th class="p-3">Status</th><th class="p-3">Catatan</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${filtered
                .map(
                  a => `
                  <tr class="cursor-pointer hover:bg-[#5720B8]/[0.03]" onclick="App.openAppDetailSheet('${a.id}')">
                    <td class="p-3 text-xs font-semibold text-[#351080]">${a.app_no}<span class="block font-normal text-slate-400">${this.rp(a.plafond)}</span></td>
                    <td class="p-3 font-semibold text-[#17223B]">${a.lead_name}</td>
                    ${normRole !== "marketing" ? `<td class="p-3">${a.marketing_name}</td>` : ""}
                    <td class="p-3">${a.branch}</td>
                    <td class="p-3">${a.bank_name}</td>
                    <td class="p-3">${a.debtor_type}</td>
                    <td class="p-3 lp-num">${this.fmtDate(a.created_at)}</td>
                    <td class="p-3">
                      <span class="text-xs font-semibold">${a.stage_index + 1}/8 • ${a.stages[a.stage_index]?.label || a.stage}</span>
                      <div class="mt-1 h-1.5 w-24 rounded bg-slate-100"><div class="h-1.5 rounded bg-[#5720B8]" style="width:${((a.stage_index + 1) / 8) * 100}%"></div></div>
                    </td>
                    <td class="p-3">${this.pendingBadgeHtml(a)}</td>
                    <td class="p-3 max-w-[200px] truncate text-xs text-slate-500">${a.reject_reason || a.pending?.note || "-"}</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
          ${filtered.length === 0 ? `<div class="py-10 text-center text-sm text-slate-400">Belum ada pengajuan</div>` : ""}
        </div>
      </div>
    `;
  },

  openAppDetailSheet(appId) {
    const apps = window.StorageService.getApplications();
    const app = apps.find(a => a.id === appId);
    if (!app) return;

    const user = window.StorageService.getCurrentUser();
    const role = window.RBACGuard.normalizeRole(user.role);
    const admin = window.RBACGuard.isAdmin(user);
    const doneDocs = app.checklist.filter(d => d.status === "diunggah" || d.status === "diterima").length;

    // Determine available actions based on RBAC & current stage
    const p = app.pending || {};
    const acts = [];
    const pre = app.stage === "upload_dokumen";
    if (!app.rejected) {
      if (pre && p.party === "marketing" && (role === "marketing" || admin)) {
        acts.push(["submit", "Ajukan untuk Pemeriksaan Admin Ops", "lp-btn-purple"]);
      }
      if (admin && pre) {
        acts.push(["request_revision", "Kembalikan ke Marketing (Revisi)", "lp-btn-cta"]);
        acts.push(["forward", `Teruskan ke ${app.bank_name}`, "lp-btn-green"]);
      }
      if (role === "super_admin" && app.stage !== "booking_live") {
        acts.push(["validate", "Validate (Kembalikan ke Admin Ops)", "lp-btn-danger"]);
      }
      if (admin && app.stage_index >= 1 && app.stage_index < 6) {
        const nextStage = app.stages[app.stage_index + 1];
        if (nextStage) {
          acts.push(["advance", `Lanjut ke ${nextStage.label}`, "lp-btn-royal"]);
        }
        acts.push(["reject_bank", "Ditolak Bank", "lp-btn-danger"]);
      }
    }

    this.openRightSheet(`
      <div class="space-y-6">
        <div class="flex items-start justify-between">
          <div>
            <p class="lp-eyebrow">${app.app_no} • ${app.bank_name}</p>
            <h2 class="font-display text-2xl font-bold text-[#17223B] mt-1">${app.lead_name}</h2>
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
              ${this.pendingBadgeHtml(app)}
              <span>${app.debtor_type} • ${app.dapem}</span>
              <span>• ${app.marketing_name} (${app.branch})</span>
              <span>• <b>${this.rp(app.plafond)} / ${app.tenor} bln</b></span>
            </div>
          </div>
          <button type="button" onclick="App.closeRightSheet()" class="rounded-md p-1.5 text-slate-400 hover:text-[#17223B]">✕</button>
        </div>

        ${
          app.pending?.note
            ? `<div class="rounded-lg border border-[#F28A19]/30 bg-[#F28A19]/8 p-3 text-sm text-[#9A5200]">
                <b>Catatan Tindak Lanjut:</b> ${app.pending.note}
              </div>`
            : ""
        }

        <!-- 8-Stage Tracker -->
        <ol class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          ${app.stages
            .map((s, i) => {
              const done = i < app.stage_index || (i === app.stage_index && s.key === "booking_live");
              const cur = i === app.stage_index;
              const cls = done
                ? "border-[#078D67]/30 bg-[#078D67]/8 text-[#078D67]"
                : cur
                  ? "border-[#5720B8] bg-[#5720B8]/8 text-[#351080]"
                  : "border-slate-200 text-slate-400";
              return `
                <li class="rounded-lg border px-3 py-2 text-[11px] font-semibold ${cls}">
                  <span>${done ? "✓ " : ""}${i + 1}. ${s.label}</span>
                  ${app.stage_data?.[s.key] ? `<span class="mt-0.5 block font-normal text-[10px]">${app.stage_data[s.key].by_name}</span>` : ""}
                </li>`;
            })
            .join("")}
        </ol>

        ${
          app.booking
            ? `<div class="rounded-lg bg-[#078D67]/10 p-3 text-sm text-[#078D67]">
                Booking Live: <b>${this.fmtDate(app.booking.date)}</b> • No. Kredit: <b>${app.booking.credit_no}</b> • Dikonfirmasi oleh: <b>${app.booking.confirmed_by}</b>
              </div>`
            : ""
        }

        <!-- Dokumen Calon Debitur (8 PDF Checklist) -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="font-display text-sm font-bold text-[#17223B]">Dokumen Calon Debitur (Kelengkapan: ${doneDocs}/${app.checklist.length} PDF)</p>
            ${
              app.stage === "upload_dokumen"
                ? `<button type="button" onclick="App.autoFillAll8AppDocs('${app.id}')" class="lp-btn lp-btn-outline lp-btn-sm">📎 Unggah Otomatis 8 PDF</button>`
                : ""
            }
          </div>
          <ul class="divide-y rounded-lg border">
            ${app.checklist
              .map(
                d => `
                <li class="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div class="min-w-0">
                    <p class="font-medium text-[#17223B]">${d.label} <span class="text-[11px] font-normal text-slate-400">• ${d.group}</span></p>
                    <p class="text-xs ${d.filename ? "text-[#5720B8]" : "text-slate-400"}">${d.filename || "Belum diunggah"}</p>
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5">
                    <span class="rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      d.status === "diterima"
                        ? "bg-[#078D67]/10 text-[#078D67]"
                        : d.status === "ditolak"
                          ? "bg-red-50 text-red-700"
                          : d.status
                            ? "bg-[#5720B8]/10 text-[#5720B8]"
                            : "bg-slate-100 text-slate-500"
                    }">${d.status || "kosong"}</span>
                    ${
                      admin && d.status
                        ? `<button type="button" onclick="App.reviewAppDoc('${app.id}', '${d.key}', 'diterima')" class="text-xs font-semibold text-[#078D67] px-1.5">Terima</button>
                           <button type="button" onclick="App.reviewAppDoc('${app.id}', '${d.key}', 'ditolak')" class="text-xs font-semibold text-red-600 px-1.5">Tolak</button>`
                        : ""
                    }
                  </div>
                </li>`
              )
              .join("")}
          </ul>
        </div>

        <!-- Action Panel -->
        <div class="rounded-xl border p-4 space-y-3">
          <p class="font-display text-sm font-bold text-[#17223B]">Tindakan Sesuai Peran (${user.role_label})</p>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-slate-600">Catatan / alasan tindak lanjut</label>
            <textarea id="appActionNote" class="lp-textarea" placeholder="Tambahkan catatan pemeriksaan atau nomor referensi bank..."></textarea>
          </div>
          ${
            app.stage_index === 5
              ? `<div class="grid gap-3 sm:grid-cols-2">
                  <div><label class="text-xs font-medium text-slate-600">Tanggal Booking *</label><input id="appBookingDate" type="date" value="${new Date().toISOString().slice(0, 10)}" class="lp-input" /></div>
                  <div><label class="text-xs font-medium text-slate-600">Nomor Kredit Nasabah *</label><input id="appCreditNo" value="KRD-2026-${Math.floor(1000 + Math.random() * 8999)}" class="lp-input" /></div>
                </div>`
              : ""
          }
          <div class="flex flex-wrap gap-2">
            ${
              acts.length
                ? acts.map(([actKey, label, cls]) => `<button type="button" onclick="App.executeAppAction('${app.id}', '${actKey}')" class="lp-btn ${cls}">${label}</button>`).join("")
                : `<p class="text-xs text-slate-500">Pengajuan telah selesai atau sedang menunggu tindakan pihak terkait.</p>`
            }
          </div>
        </div>

        <!-- History -->
        <div>
          <p class="mb-3 font-display text-sm font-bold text-[#17223B]">Riwayat Aktivitas Pengajuan</p>
          <ul class="space-y-3">
            ${(app.history || [])
              .map(
                h => `
                <li class="border-l-2 border-[#5720B8]/30 pl-3 text-sm">
                  <p class="text-[#17223B]"><b class="capitalize">${h.action.replace(/_/g, " ")}</b> — ${h.note}</p>
                  <p class="text-[11px] text-slate-400">${h.user_name} • ${this.fmtDateTime(h.at)}</p>
                </li>`
              )
              .join("")}
          </ul>
        </div>
      </div>
    `);
  },

  autoFillAll8AppDocs(appId) {
    const apps = window.StorageService.getApplications();
    const app = apps.find(a => a.id === appId);
    if (!app) return;
    const slug = app.lead_name.replace(/\s+/g, "_");
    app.checklist.forEach(d => {
      d.status = "diunggah";
      d.filename = `${d.key}_${slug}.pdf`;
      d.uploaded_at = new Date().toISOString();
      d.versions = 1;
    });
    window.StorageService.saveApplications(apps);
    this.toast("8 dokumen wajib PDF berhasil diunggah");
    this.openAppDetailSheet(appId);
    this.renderOutlet();
  },

  reviewAppDoc(appId, docKey, status) {
    const apps = window.StorageService.getApplications();
    const app = apps.find(a => a.id === appId);
    if (!app) return;
    const doc = app.checklist.find(d => d.key === docKey);
    if (doc) doc.status = status;
    window.StorageService.saveApplications(apps);
    this.toast(`Dokumen ditandai: ${status}`);
    this.openAppDetailSheet(appId);
  },

  executeAppAction(appId, actionKey) {
    const apps = window.StorageService.getApplications();
    const app = apps.find(a => a.id === appId);
    if (!app) return;
    const user = window.StorageService.getCurrentUser();
    const note = document.getElementById("appActionNote")?.value.trim() || `Tindakan ${actionKey} dilakukan oleh ${user.name}`;

    if (actionKey === "submit") {
      app.pending = { party: "admin_ops", type: "pemeriksaan", note };
    } else if (actionKey === "request_revision") {
      app.pending = { party: "marketing", type: "revisi", note };
    } else if (actionKey === "validate") {
      app.pending = { party: "admin_ops", type: "validate", note };
    } else if (actionKey === "forward") {
      app.stage_index = 1;
      app.stage = app.stages[1].key;
      app.pending = null;
      app.stage_data[app.stage] = { by_name: user.name, date: new Date().toISOString().slice(0, 10) };
    } else if (actionKey === "advance") {
      app.stage_index = Math.min(6, app.stage_index + 1);
      app.stage = app.stages[app.stage_index].key;
      app.pending = null;
      app.stage_data[app.stage] = { by_name: user.name, date: new Date().toISOString().slice(0, 10) };
      if (app.stage === "booking_live") {
        app.booking = {
          date: document.getElementById("appBookingDate")?.value || new Date().toISOString().slice(0, 10),
          credit_no: document.getElementById("appCreditNo")?.value || "KRD-2026-9901",
          confirmed_by: user.name
        };
      }
    } else if (actionKey === "reject_bank") {
      app.rejected = true;
      app.reject_reason = note;
      app.stage = "ditolak";
      app.stage_index = 7;
      app.pending = null;
    }

    app.history.unshift({
      id: "H-" + Date.now(),
      action: actionKey,
      note,
      user_name: user.name,
      role: window.RBACGuard.normalizeRole(user.role),
      at: new Date().toISOString()
    });

    window.StorageService.saveApplications(apps);
    window.StorageService.logAudit(`application_${actionKey}`, app.app_no, note);
    this.toast("Status pengajuan diperbarui");
    this.openAppDetailSheet(appId);
    this.renderOutlet();
  },

  // ==========================================================================
  // 7. PENGAJUAN KLAIM INSENTIF PAGE
  // ==========================================================================
  renderClaimsPage() {
    const user = window.StorageService.getCurrentUser();
    const admin = window.RBACGuard.isAdmin(user);
    const allClaims = window.StorageService.getClaims();
    const scoped = admin ? allClaims : allClaims.filter(c => c.marketing_id === user.id || c.marketing_name === user.name);

    const q = this.claimsFilter.q.toLowerCase().trim();
    const st = this.claimsFilter.status;
    const filtered = scoped.filter(c => {
      const matchQ = !q || c.claim_no.toLowerCase().includes(q) || c.lead_name.toLowerCase().includes(q) || (c.marketing_name || "").toLowerCase().includes(q);
      const matchS = !st || c.status === st;
      return matchQ && matchS;
    });

    return `
      ${this.pageHeaderHtml({
        eyebrow: "Insentif",
        title: "Pengajuan Klaim",
        desc: "Klaim insentif marketing berdasarkan pengajuan yang telah BOOKING/LIVE. Klaim tidak otomatis dianggap dibayar.",
        actionsHtml: `<button type="button" onclick="App.openCreateClaimModal()" class="lp-btn lp-btn-cta">${ICONS.plus}<span>Ajukan Klaim</span></button>`
      })}
      <div class="lp-card">
        <div class="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div class="flex-1">
            <input value="${this.claimsFilter.q}" oninput="App.claimsFilter.q=this.value; App.renderOutlet()" placeholder="Cari nomor klaim, nasabah, marketing…" class="lp-input h-10" />
          </div>
          <select onchange="App.claimsFilter.status=this.value; App.renderOutlet()" class="lp-input h-10 sm:w-[180px]">
            <option value="">Semua status</option>
            ${["DRAFT", "SUBMITTED", "REVIEW", "REVISION", "APPROVED", "PAID", "REJECTED"]
              .map(s => `<option value="${s}" ${st === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-[#F5F6FA]/60 text-left text-xs font-semibold text-slate-500">
                <th class="p-3">No. Klaim</th><th class="p-3">Nasabah</th><th class="p-3">Bank</th><th class="p-3">Marketing</th>
                <th class="p-3">Cabang</th><th class="p-3">Tgl Booking</th><th class="p-3">Nominal</th><th class="p-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${filtered
                .map(
                  c => `
                  <tr class="cursor-pointer hover:bg-[#5720B8]/[0.03]" onclick="App.openClaimDetailModal('${c.id}')">
                    <td class="p-3 font-semibold text-[#351080]">${c.claim_no}</td>
                    <td class="p-3 font-medium text-[#17223B]">${c.lead_name}</td>
                    <td class="p-3">${c.bank_name}</td>
                    <td class="p-3">${c.marketing_name}</td>
                    <td class="p-3">${c.branch}</td>
                    <td class="p-3 lp-num">${this.fmtDate(c.booking_date)}</td>
                    <td class="p-3 lp-num font-semibold">${c.amount != null ? this.rp(c.amount) : "-"}</td>
                    <td class="p-3"><span class="rounded-md px-2 py-0.5 text-xs font-bold ${CLAIM_CLS[c.status] || ""}">${c.status}</span></td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
          ${filtered.length === 0 ? `<div class="py-10 text-center text-sm text-slate-400">Belum ada klaim</div>` : ""}
        </div>
      </div>
    `;
  },

  openCreateClaimModal() {
    const eligibleApps = window.StorageService.getApplications().filter(a => a.stage === "booking_live");
    this.openModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-lg font-bold text-[#17223B]">Pengajuan Klaim Insentif</h3>
          <button type="button" onclick="App.closeModal()" class="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        ${
          !eligibleApps.length
            ? `<p class="text-sm text-slate-500">Belum ada pengajuan berstatus BOOKING/LIVE yang dapat diklaim.</p>`
            : `
            <div class="space-y-3">
              <div>
                <label class="text-xs font-medium text-slate-600">Referensi pengajuan (BOOKING/LIVE) *</label>
                <select id="clmAppSelect" class="lp-input mt-1">
                  ${eligibleApps.map(a => `<option value="${a.id}">${a.app_no} • ${a.lead_name} • ${a.bank_name}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="text-xs font-medium text-slate-600">Nomor kredit nasabah</label>
                <input id="clmCreditNo" value="${eligibleApps[0]?.booking?.credit_no || ""}" class="lp-input mt-1" />
              </div>
              <div>
                <label class="text-xs font-medium text-slate-600">Catatan</label>
                <textarea id="clmNotes" class="lp-textarea mt-1" placeholder="Permohonan pencairan insentif marketing..."></textarea>
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" onclick="App.closeModal()" class="lp-btn lp-btn-outline">Batal</button>
                <button type="button" onclick="App.submitCreateClaim()" class="lp-btn lp-btn-cta">Simpan & Ajukan Klaim</button>
              </div>
            </div>`
        }
      </div>
    `);
  },

  submitCreateClaim() {
    const appId = document.getElementById("clmAppSelect")?.value;
    const app = window.StorageService.getApplications().find(a => a.id === appId);
    if (!app) return;
    const claims = window.StorageService.getClaims();
    const claimNo = `CLM-202610-${String(claims.length + 1).padStart(3, "0")}`;

    claims.unshift({
      id: "CLM-" + Date.now(),
      claim_no: claimNo,
      application_id: app.id,
      app_no: app.app_no,
      lead_name: app.lead_name,
      bank_name: app.bank_name,
      marketing_id: app.marketing_id,
      marketing_name: app.marketing_name,
      branch: app.branch,
      booking_date: app.booking?.date || new Date().toISOString().slice(0, 10),
      credit_no: document.getElementById("clmCreditNo")?.value || app.booking?.credit_no,
      amount: Math.round(app.plafond * 0.015),
      status: "SUBMITTED",
      booking_proof: "Foto_Akad_Terlampir.pdf",
      payment_proof: null,
      history: [
        { id: "CH-" + Date.now(), action: "SUBMITTED", note: document.getElementById("clmNotes")?.value || "Mengajukan klaim insentif", user_name: app.marketing_name, at: new Date().toISOString() }
      ]
    });
    window.StorageService.saveClaims(claims);
    window.StorageService.logAudit("create_claim", claimNo, `Mengajukan klaim insentif ${claimNo} untuk nasabah ${app.lead_name}`);
    this.closeModal();
    this.renderOutlet();
    this.toast(`Klaim ${claimNo} berhasil diajukan`);
  },

  openClaimDetailModal(claimId) {
    const c = window.StorageService.getClaims().find(x => x.id === claimId);
    if (!c) return;
    const user = window.StorageService.getCurrentUser();
    const admin = window.RBACGuard.isAdmin(user);

    this.openModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-lg font-bold text-[#17223B]">${c.claim_no} — ${c.lead_name}</h3>
          <button type="button" onclick="App.closeModal()" class="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div class="flex items-center gap-2">
          <span class="rounded-md px-2 py-0.5 text-xs font-bold ${CLAIM_CLS[c.status] || ""}">${c.status}</span>
          ${c.amount != null ? `<span class="text-sm font-bold text-[#351080]">${this.rp(c.amount)}</span>` : ""}
        </div>
        <div class="grid grid-cols-2 gap-2 rounded-lg bg-[#F5F6FA] p-3 text-xs">
          <span>Pengajuan: <b>${c.app_no}</b></span><span>Bank: <b>${c.bank_name}</b></span>
          <span>Marketing: <b>${c.marketing_name}</b></span><span>Cabang: <b>${c.branch}</b></span>
          <span>Tgl booking: <b>${this.fmtDate(c.booking_date)}</b></span><span>No. kredit: <b>${c.credit_no || "-"}</b></span>
        </div>
        ${
          admin && c.status !== "PAID" && c.status !== "REJECTED"
            ? `<div class="rounded-xl border p-4 space-y-3">
                <div>
                  <label class="text-xs font-medium text-slate-600">Nominal Insentif Disetujui (Rp)</label>
                  <input id="clmApproveAmt" type="number" value="${c.amount || 1500000}" class="lp-input mt-1" />
                </div>
                <div>
                  <label class="text-xs font-medium text-slate-600">Catatan Keputusan</label>
                  <input id="clmDecideNote" value="Verifikasi bukti akad sesuai" class="lp-input mt-1" />
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" onclick="App.decideClaim('${c.id}', 'APPROVED')" class="lp-btn lp-btn-purple">Setujui (APPROVED)</button>
                  <button type="button" onclick="App.decideClaim('${c.id}', 'PAID')" class="lp-btn lp-btn-green">Konfirmasi Dibayar (PAID)</button>
                  <button type="button" onclick="App.decideClaim('${c.id}', 'REJECTED')" class="lp-btn lp-btn-danger">Tolak</button>
                </div>
              </div>`
            : ""
        }
      </div>
    `);
  },

  decideClaim(claimId, nextStatus) {
    const claims = window.StorageService.getClaims();
    const c = claims.find(x => x.id === claimId);
    if (!c) return;
    const user = window.StorageService.getCurrentUser();
    const amt = Number(document.getElementById("clmApproveAmt")?.value || c.amount);
    const note = document.getElementById("clmDecideNote")?.value || nextStatus;

    c.status = nextStatus;
    if (!isNaN(amt) && amt > 0) c.amount = amt;
    if (nextStatus === "PAID") {
      c.paid_at = new Date().toISOString();
      c.paid_by = user.name;
      c.payment_note = note;
    }
    c.history.unshift({ id: "CH-" + Date.now(), action: nextStatus, note, user_name: user.name, at: new Date().toISOString() });
    window.StorageService.saveClaims(claims);
    window.StorageService.logAudit(`claim_${nextStatus.toLowerCase()}`, c.claim_no, `Status klaim ${c.claim_no} diperbarui ke ${nextStatus}`);
    this.closeModal();
    this.renderOutlet();
    this.toast(`Status klaim ${c.claim_no} diperbarui menjadi ${nextStatus}`);
  },

  // ==========================================================================
  // 8. PENGGUNA & PERAN PAGE (RBAC: SUPER ADMIN vs ADMIN OPS)
  // ==========================================================================
  renderUsersPage() {
    const me = window.StorageService.getCurrentUser();
    const users = window.StorageService.getUsers();
    const leads = window.StorageService.getLeads();

    return `
      ${this.pageHeaderHtml({
        eyebrow: "Administrasi",
        title: "Pengguna & Peran",
        desc: "Tidak ada registrasi publik. Seluruh akun dibuat oleh administrator yang berwenang.",
        actionsHtml: `<button type="button" onclick="App.openUserModal()" class="lp-btn lp-btn-cta">${ICONS.plus}<span>Tambah Pengguna</span></button>`
      })}
      <div class="lp-card overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-[#F5F6FA]/60 text-left text-xs font-semibold text-slate-500">
              <th class="p-3">Nama</th><th class="p-3">Email</th><th class="p-3">Peran</th><th class="p-3">Cabang</th><th class="p-3">Leads</th><th class="p-3">Status</th><th class="p-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${users
              .map(u => {
                const leadCount = leads.filter(l => l.assigned_to === u.id).length;
                const canEdit = me.role === "super_admin" || u.role === "marketing";
                return `
                  <tr>
                    <td class="p-3 font-semibold text-[#17223B]">${u.name}</td>
                    <td class="p-3 text-slate-600">${u.email}</td>
                    <td class="p-3"><span class="rounded-md bg-[#5720B8]/10 px-2 py-0.5 text-xs font-semibold text-[#5720B8]">${u.role_label}</span></td>
                    <td class="p-3">${u.branch || "-"}</td>
                    <td class="p-3 lp-num">${leadCount}</td>
                    <td class="p-3">${u.active ? `<span class="text-xs font-semibold text-[#078D67]">Aktif</span>` : `<span class="text-xs font-semibold text-slate-400">Nonaktif</span>`}</td>
                    <td class="p-3 text-right">
                      ${canEdit ? `<button type="button" onclick="App.openUserModal('${u.id}')" class="lp-btn lp-btn-outline lp-btn-sm">✎ Ubah</button>` : ""}
                    </td>
                  </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  },

  openUserModal(userId = null) {
    const me = window.StorageService.getCurrentUser();
    const editing = userId ? window.StorageService.getUsers().find(u => u.id === userId) : null;
    const allowedRoles = me.role === "super_admin"
      ? [
          ["super_admin", "Super Admin"],
          ["admin_ops", "Admin Operasional"],
          ["marketing", "Marketing"]
        ]
      : [["marketing", "Marketing"]];

    this.openModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-lg font-bold text-[#17223B]">${editing ? "Ubah Pengguna" : "Undang Pengguna Baru"}</h3>
          <button type="button" onclick="App.closeModal()" class="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div class="space-y-3">
          <div><label class="text-xs font-medium text-slate-600">Nama lengkap *</label><input id="uf_name" value="${editing?.name || ""}" class="lp-input mt-1" /></div>
          <div><label class="text-xs font-medium text-slate-600">Email *</label><input id="uf_email" type="email" value="${editing?.email || ""}" ${editing ? "readonly" : ""} class="lp-input mt-1" /></div>
          <div>
            <label class="text-xs font-medium text-slate-600">Peran</label>
            <select id="uf_role" class="lp-input mt-1">
              ${allowedRoles.map(([r, lbl]) => `<option value="${r}" ${editing?.role === r ? "selected" : ""}>${lbl}</option>`).join("")}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="text-xs font-medium text-slate-600">Cabang</label><input id="uf_branch" value="${editing?.branch || "Pematangsiantar"}" class="lp-input mt-1" /></div>
            <div><label class="text-xs font-medium text-slate-600">Telepon</label><input id="uf_phone" value="${editing?.phone || ""}" class="lp-input mt-1" /></div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="App.closeModal()" class="lp-btn lp-btn-outline">Batal</button>
            <button type="button" onclick="App.submitUserModal('${editing?.id || ""}')" class="lp-btn lp-btn-purple">Simpan</button>
          </div>
        </div>
      </div>
    `);
  },

  submitUserModal(editId) {
    const name = document.getElementById("uf_name")?.value.trim();
    const email = document.getElementById("uf_email")?.value.trim();
    const role = document.getElementById("uf_role")?.value || "marketing";
    const branch = document.getElementById("uf_branch")?.value.trim() || "Pematangsiantar";
    const phone = document.getElementById("uf_phone")?.value.trim() || "";
    const roleLabel = window.RBACGuard.getRoleConfig(role).label;

    if (!name || !email) {
      this.toast("Nama dan Email wajib diisi", "error");
      return;
    }

    const users = window.StorageService.getUsers();
    if (editId) {
      const target = users.find(u => u.id === editId);
      if (target) {
        target.name = name;
        target.role = role;
        target.role_label = roleLabel;
        target.branch = branch;
        target.phone = phone;
      }
    } else {
      users.push({
        id: "USR-" + Date.now(),
        name,
        email,
        role,
        role_label: roleLabel,
        branch,
        phone,
        active: true
      });
    }
    window.StorageService.saveUsers(users);
    window.StorageService.logAudit(editId ? "update_user" : "create_user", name, `Menyimpan data pengguna ${name} (${roleLabel})`);
    this.closeModal();
    this.syncAuthAndRender();
    this.toast("Pengguna disimpan");
  },

  // ==========================================================================
  // 9. AUDIT LOG PAGE
  // ==========================================================================
  renderAuditPage() {
    const logs = window.StorageService.getAuditLogs();
    const actions = [...new Set(logs.map(l => l.action))];
    const q = this.auditFilter.q.toLowerCase().trim();
    const act = this.auditFilter.action;

    const filtered = logs.filter(l => {
      const matchQ = !q || l.user_name.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q) || l.entity.toLowerCase().includes(q);
      const matchA = !act || l.action === act;
      return matchQ && matchA;
    });

    return `
      ${this.pageHeaderHtml({
        eyebrow: "Keamanan",
        title: "Audit Log",
        desc: "Jejak seluruh aktivitas penting: login, perubahan parameter mitra bank, penugasan, impor, simulasi, dan unduhan."
      })}
      <div class="lp-card">
        <div class="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div class="flex-1">
            <input value="${this.auditFilter.q}" oninput="App.auditFilter.q=this.value; App.renderOutlet()" placeholder="Cari pengguna atau detail…" class="lp-input h-10" />
          </div>
          <select onchange="App.auditFilter.action=this.value; App.renderOutlet()" class="lp-input h-10 sm:w-[220px]">
            <option value="">Semua aksi</option>
            ${actions.map(a => `<option value="${a}" ${act === a ? "selected" : ""}>${a.replace(/_/g, " ")}</option>`).join("")}
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-[#F5F6FA]/60 text-left text-xs font-semibold text-slate-500">
                <th class="p-3">Waktu</th><th class="p-3">Pengguna</th><th class="p-3">Aksi</th><th class="p-3">Objek</th><th class="p-3">Detail</th><th class="p-3">IP</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${filtered
                .map(
                  a => `
                  <tr>
                    <td class="p-3 whitespace-nowrap text-xs text-slate-500">${this.fmtDateTime(a.created_at)}</td>
                    <td class="p-3"><p class="font-medium text-[#17223B]">${a.user_name}</p><p class="text-[11px] text-slate-400">${window.RBACGuard.getRoleConfig(a.role).label}</p></td>
                    <td class="p-3 capitalize font-medium text-[#351080]">${a.action.replace(/_/g, " ")}</td>
                    <td class="p-3">${a.entity}</td>
                    <td class="p-3 text-slate-600">${a.detail}</td>
                    <td class="p-3 text-xs text-slate-400 lp-num">${a.ip}</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ==========================================================================
  // 10. PENGATURAN PAGE (DYNAMIC PARTNER PARAMETER EDITOR + BACKUP)
  // ==========================================================================
  renderSettingsPage() {
    const user = window.StorageService.getCurrentUser();
    const canEdit = window.RBACGuard.hasPermission(user.role, "canEditParametersDirectly");
    const params = window.StorageService.getPartnerParameters();
    const key = this.activeSettingsPartner;
    const cfg = params[key] || params.ams2;

    let paramFormHtml = "";
    if (key === "ams2") {
      paramFormHtml = `
        <div class="mb-4 grid gap-3 sm:grid-cols-3">
          ${cfg.tiers
            .map(
              (t, idx) => `
              <div class="rounded-xl bg-[#F5F6FA] p-4 space-y-2">
                <p class="font-display font-bold text-[#351080]">${t.name} (≤ ${t.maxAge} th)</p>
                <div>
                  <label class="text-[11px] text-slate-500">Bunga Koperasi (%/thn)</label>
                  <input id="sp_ams_rate_${idx}" type="number" step="0.25" value="${t.coopRateAnnual}" ${canEdit ? "" : "disabled"} class="lp-input h-9 mt-0.5 lp-num" />
                </div>
                <div>
                  <label class="text-[11px] text-slate-500">Cadangan Risiko (%)</label>
                  <input id="sp_ams_risk_${idx}" type="number" step="0.5" value="${t.riskReserveRate}" ${canEdit ? "" : "disabled"} class="lp-input h-9 mt-0.5 lp-num" />
                </div>
              </div>`
            )
            .join("")}
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div><label class="text-xs text-slate-500">Bunga Bank (%/thn)</label><input id="sp_ams_bankRate" type="number" step="0.1" value="${cfg.bankRateAnnual}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Rasio Angsuran Maksimal (% gaji)</label><input id="sp_ams_maxRatio" type="number" step="0.5" value="${cfg.maxInstallmentRatio}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Tenor Maksimal (bulan)</label><input id="sp_ams_maxTenor" type="number" value="${cfg.maxTenorMonths}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Plafond Maksimal Absolut (Rp)</label><input id="sp_ams_maxPlafond" type="number" step="5000000" value="${cfg.maxPlafondAbsolute}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Batas Usia Akhir (Tahun & Bulan)</label>
            <div class="grid grid-cols-2 gap-2 mt-1">
              <input id="sp_ams_endY" type="number" value="${cfg.maxEndAgeYears}" ${canEdit ? "" : "disabled"} class="lp-input h-10 lp-num" />
              <input id="sp_ams_endM" type="number" value="${cfg.maxEndAgeMonths}" ${canEdit ? "" : "disabled"} class="lp-input h-10 lp-num" />
            </div>
          </div>
          <div><label class="text-xs text-slate-500">Biaya PROAQ (% plafond)</label><input id="sp_ams_proaq" type="number" step="0.5" value="${cfg.proaqRate}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Biaya Administrasi (Rp)</label><input id="sp_ams_admin" type="number" step="50000" value="${cfg.adminFee}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Tata Laksana Maksimal (%)</label><input id="sp_ams_tlMax" type="number" step="0.1" value="${cfg.tataLaksanaMax}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Retensi Angsuran (× angsuran koperasi)</label><input id="sp_ams_ret" type="number" value="${cfg.retentionMultiplier}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
        </div>
      `;
    } else if (key === "bsi_prapen") {
      paramFormHtml = `
        <div class="grid gap-3 sm:grid-cols-2">
          <div><label class="text-xs text-slate-500">Plafond Maksimal Pembiayaan (Rp)</label><input id="sp_bsi_maxPlafond" type="number" value="${cfg.maxPlafondAbsolute}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Tenor Maksimal (Bulan)</label><input id="sp_bsi_maxTenor" type="number" value="${cfg.maxTenorMonths}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">DBR Aktif Payroll BSI (%)</label><input id="sp_bsi_dbrPay" type="number" step="1" value="${cfg.dbrActivePayroll}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">DSR Saat Pensiun Maks (%)</label><input id="sp_bsi_dsrPen" type="number" step="1" value="${cfg.dsrPensionMax}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Rate Aktif Dekade Berkah PP10 (%/thn)</label><input id="sp_bsi_rAktif" type="number" step="0.05" value="${cfg.pricingTiers.dekadeNettAbove200.rateActiveAnnual}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Rate Pensiun Dekade Berkah PP10 (%/thn)</label><input id="sp_bsi_rPensiun" type="number" step="0.05" value="${cfg.pricingTiers.dekadeNettAbove200.ratePensionAnnual}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Biaya Admin Bank (% Plafond)</label><input id="sp_bsi_adminPct" type="number" step="0.1" value="${cfg.fees.adminRatePercent}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Blokir Angsuran Pensiun (×)</label><input id="sp_bsi_blokir" type="number" value="${cfg.fees.blokirPensionCount}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
        </div>
      `;
    } else {
      paramFormHtml = `
        <div class="grid gap-3 sm:grid-cols-2">
          <div><label class="text-xs text-slate-500">Suku Bunga Efektif (%/thn)</label><input id="sp_bk_rate" type="number" step="0.25" value="${cfg.interestRateAnnual}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Rasio DSR Maksimal (%)</label><input id="sp_bk_dsr" type="number" step="1" value="${cfg.maxInstallmentRatio}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Plafond Maksimal (Rp)</label><input id="sp_bk_plafond" type="number" step="10000000" value="${cfg.maxPlafondAbsolute}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Tenor Maksimal (Bulan)</label><input id="sp_bk_tenor" type="number" value="${cfg.maxTenorMonths}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Batas Usia Lunas (Tahun)</label><input id="sp_bk_endAge" type="number" value="${cfg.maxEndAgeYears}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Biaya Provisi (%)</label><input id="sp_bk_prov" type="number" step="0.25" value="${cfg.provisionRatePercent}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Premi Asuransi (%)</label><input id="sp_bk_ins" type="number" step="0.5" value="${cfg.insuranceRatePercent}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
          <div><label class="text-xs text-slate-500">Biaya Administrasi (Rp)</label><input id="sp_bk_admin" type="number" step="50000" value="${cfg.adminFee}" ${canEdit ? "" : "disabled"} class="lp-input h-10 mt-1 lp-num" /></div>
        </div>
      `;
    }

    return `
      ${this.pageHeaderHtml({
        eyebrow: "Pengaturan",
        title: "Pengaturan & Parameter Mitra Bank",
        desc: "Sesuaikan parameter kalkulator mitra bank secara dinamis, keamanan akun, dan backup data."
      })}
      <div class="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <!-- Dynamic Partner Parameter Editor -->
        <section class="lp-card p-6">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-display font-bold text-[#17223B]">Parameter Resmi Calc Platinum & Mitra Bank</h2>
            <span class="flex items-center gap-1 rounded-full ${canEdit ? "bg-[#5720B8]/10 text-[#5720B8]" : "bg-[#078D67]/10 text-[#078D67]"} px-2.5 py-0.5 text-xs font-semibold">
              ${canEdit ? "✎ Mode Edit Super Admin Aktif" : "🔒 Hanya Super Admin Dapat Mengedit"}
            </span>
          </div>

          <div class="mb-4 flex flex-wrap gap-1.5 border-b pb-3">
            ${BANK_OPTIONS.map(
              b => `
              <button type="button" onclick="App.activeSettingsPartner='${b.key}'; App.renderOutlet()"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  key === b.key ? "bg-[#351080] text-white" : "bg-[#F5F6FA] text-slate-600 hover:text-[#351080]"
                }">
                ${b.name}
              </button>`
            ).join("")}
          </div>

          ${paramFormHtml}

          ${
            canEdit
              ? `<div class="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  <button type="button" onclick="App.saveSettingsPartnerParams('${key}')" class="lp-btn lp-btn-purple">💾 Simpan Perubahan Parameter</button>
                  <button type="button" onclick="window.StorageService.resetPartnerParametersToDefault(); App.renderOutlet(); App.toast('Parameter dikembalikan ke default resmi')" class="lp-btn lp-btn-outline text-red-600">↺ Reset Default</button>
                </div>`
              : `<p class="mt-4 text-xs text-slate-400">Parameter saat ini mengikuti aturan aktif mitra bank. Hubungi Super Admin untuk mengubah parameter.</p>`
          }
        </section>

        <!-- Right Column: Change Password & Backup -->
        <div class="space-y-6">
          <form onsubmit="event.preventDefault(); App.toast('Kata sandi berhasil diperbarui')" class="lp-card space-y-4 p-6">
            <h2 class="font-display font-bold text-[#17223B]">Ubah Kata Sandi</h2>
            <div class="space-y-1.5"><label class="text-xs font-medium text-slate-600">Kata sandi saat ini</label><input type="password" required class="lp-input h-10" /></div>
            <div class="space-y-1.5"><label class="text-xs font-medium text-slate-600">Kata sandi baru (min. 8)</label><input type="password" required minlength="8" class="lp-input h-10" /></div>
            <button type="submit" class="lp-btn lp-btn-purple">Simpan</button>
          </form>

          ${
            user.role === "super_admin"
              ? `<section class="lp-card space-y-4 p-6">
                  <h2 class="font-display font-bold text-[#17223B]">Backup & Pemulihan</h2>
                  <p class="text-sm text-slate-500">Unduh salinan JSON seluruh leads, parameter mitra, simulasi, pengajuan, klaim, dan audit log.</p>
                  <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="App.downloadBackupJson()" class="lp-btn lp-btn-outline">⇩ Unduh Backup JSON</button>
                  </div>
                </section>`
              : ""
          }
        </div>
      </div>
    `;
  },

  saveSettingsPartnerParams(key) {
    const params = window.StorageService.getPartnerParameters();
    const cfg = params[key];
    if (!cfg) return;

    if (key === "ams2") {
      cfg.tiers.forEach((t, idx) => {
        t.coopRateAnnual = Number(document.getElementById(`sp_ams_rate_${idx}`).value);
        t.riskReserveRate = Number(document.getElementById(`sp_ams_risk_${idx}`).value);
      });
      cfg.bankRateAnnual = Number(document.getElementById("sp_ams_bankRate").value);
      cfg.maxInstallmentRatio = Number(document.getElementById("sp_ams_maxRatio").value);
      cfg.maxTenorMonths = Number(document.getElementById("sp_ams_maxTenor").value);
      cfg.maxPlafondAbsolute = Number(document.getElementById("sp_ams_maxPlafond").value);
      cfg.maxEndAgeYears = Number(document.getElementById("sp_ams_endY").value);
      cfg.maxEndAgeMonths = Number(document.getElementById("sp_ams_endM").value);
      cfg.proaqRate = Number(document.getElementById("sp_ams_proaq").value);
      cfg.adminFee = Number(document.getElementById("sp_ams_admin").value);
      cfg.tataLaksanaMax = Number(document.getElementById("sp_ams_tlMax").value);
      cfg.retentionMultiplier = Number(document.getElementById("sp_ams_ret").value);
    } else if (key === "bsi_prapen") {
      cfg.maxPlafondAbsolute = Number(document.getElementById("sp_bsi_maxPlafond").value);
      cfg.maxTenorMonths = Number(document.getElementById("sp_bsi_maxTenor").value);
      cfg.dbrActivePayroll = Number(document.getElementById("sp_bsi_dbrPay").value);
      cfg.dsrPensionMax = Number(document.getElementById("sp_bsi_dsrPen").value);
      cfg.pricingTiers.dekadeNettAbove200.rateActiveAnnual = Number(document.getElementById("sp_bsi_rAktif").value);
      cfg.pricingTiers.dekadeNettAbove200.ratePensionAnnual = Number(document.getElementById("sp_bsi_rPensiun").value);
      cfg.fees.adminRatePercent = Number(document.getElementById("sp_bsi_adminPct").value);
      cfg.fees.blokirPensionCount = Number(document.getElementById("sp_bsi_blokir").value);
    } else {
      cfg.interestRateAnnual = Number(document.getElementById("sp_bk_rate").value);
      cfg.maxInstallmentRatio = Number(document.getElementById("sp_bk_dsr").value);
      cfg.maxPlafondAbsolute = Number(document.getElementById("sp_bk_plafond").value);
      cfg.maxTenorMonths = Number(document.getElementById("sp_bk_tenor").value);
      cfg.maxEndAgeYears = Number(document.getElementById("sp_bk_endAge").value);
      cfg.provisionRatePercent = Number(document.getElementById("sp_bk_prov").value);
      cfg.insuranceRatePercent = Number(document.getElementById("sp_bk_ins").value);
      cfg.adminFee = Number(document.getElementById("sp_bk_admin").value);
    }

    window.StorageService.savePartnerParameters(params, `Memperbarui parameter mitra ${cfg.name}`);
    this.resetCalcOutputs();
    this.renderOutlet();
    this.toast(`Parameter ${cfg.name} berhasil disimpan & langsung berlaku di kalkulator!`);
  },

  downloadBackupJson() {
    const data = window.StorageService.exportFullBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_layanan_pensiunan_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast("File backup JSON berhasil diunduh");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  window.App.init();
});
