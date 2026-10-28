// ============================================================================
// RBAC GUARD & ENTERPRISE PERMISSION MATRIX
// Mendukung 3 Role Resmi sesuai command.md & https://layananpensiunan.com/:
// 1. super_admin       — Super Admin (Kewenangan penuh, edit parameter mitra, Validate, kelola semua user & backup)
// 2. admin_ops         — Admin Operasional (Kelola & impor leads, verifikasi 8 dokumen PDF, proses klaim, kelola marketing)
// 3. marketing         — Marketing (Leads milik sendiri, simulasi kredit, upload 8 dokumen PDF, ajukan klaim insentif)
// ============================================================================

window.RBAC_ROLES = {
  super_admin: {
    code: "super_admin",
    label: "Super Admin",
    badgeClass: "bg-[#5720B8]/10 text-[#5720B8]",
    scope: "all_branches",
    description: "Akses penuh seluruh cabang, edit parameter resmi mitra bank, Validate pengajuan, manajemen seluruh peran pengguna, audit log, & backup.",
    allowedPages: [
      "dashboard",
      "leads",
      "impor",
      "kalkulator",
      "simulasi",
      "progress",
      "klaim",
      "pengguna",
      "audit",
      "pengaturan"
    ],
    permissions: {
      isAdmin: true,
      canEditParametersDirectly: true,
      canProposeParameterChange: true,
      canResetDefaultParameters: true,
      canManageAllRoles: true,
      canBackupRestore: true,
      canValidateApplication: true
    }
  },

  admin_ops: {
    code: "admin_ops",
    label: "Admin Operasional",
    badgeClass: "bg-[#078D67]/12 text-[#078D67]",
    scope: "branch",
    description: "Kelola & impor database leads, tugaskan marketing, pemeriksaan 8 dokumen wajib PDF, teruskan pengajuan ke bank mitra, dan review klaim insentif.",
    allowedPages: [
      "dashboard",
      "leads",
      "impor",
      "kalkulator",
      "simulasi",
      "progress",
      "klaim",
      "pengguna",
      "audit",
      "pengaturan"
    ],
    permissions: {
      isAdmin: true,
      canEditParametersDirectly: false,
      canProposeParameterChange: true,
      canResetDefaultParameters: false,
      canManageAllRoles: false, // Hanya dapat membuat/mengubah akun Marketing
      canBackupRestore: false,
      canValidateApplication: false
    }
  },

  marketing: {
    code: "marketing",
    label: "Marketing",
    badgeClass: "bg-[#F28A19]/15 text-[#B5620A]",
    scope: "own",
    description: "Tindak lanjut leads yang ditugaskan, buat simulasi kredit mitra bank, unduh PDF/PNG & ringkasan AI WhatsApp, unggah 8 dokumen PDF, dan ajukan klaim insentif.",
    allowedPages: [
      "dashboard",
      "leads",
      "kalkulator",
      "simulasi",
      "progress",
      "klaim",
      "pengaturan"
    ],
    permissions: {
      isAdmin: false,
      canEditParametersDirectly: false,
      canProposeParameterChange: false,
      canResetDefaultParameters: false,
      canManageAllRoles: false,
      canBackupRestore: false,
      canValidateApplication: false
    }
  }
};

// Alias admin_operasional -> admin_ops
window.RBAC_ROLES.admin_operasional = window.RBAC_ROLES.admin_ops;

window.RBACGuard = {
  normalizeRole(roleCode) {
    if (roleCode === "admin_operasional") return "admin_ops";
    return window.RBAC_ROLES[roleCode] ? roleCode : "marketing";
  },

  getRoleConfig(roleCode) {
    const norm = this.normalizeRole(roleCode);
    return window.RBAC_ROLES[norm] || window.RBAC_ROLES.marketing;
  },

  isAdmin(userOrRole) {
    const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
    const norm = this.normalizeRole(role);
    return norm === "super_admin" || norm === "admin_ops";
  },

  canAccessPage(roleCode, pageId) {
    const role = this.getRoleConfig(roleCode);
    return role.allowedPages.includes(pageId);
  },

  hasPermission(roleCode, permKey) {
    const role = this.getRoleConfig(roleCode);
    return Boolean(role.permissions && role.permissions[permKey]);
  }
};
