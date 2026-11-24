export const COLLECTIONS = ["users", "leads", "lead_requests", "applications", "simulations", "claims", "imports", "audit_logs", "parameter_proposals"];
export const ROLES = ["super_admin", "admin_ops", "admin_branch", "sales_manager", "marketing"];

export function validateState(state, { production = false } = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("State aplikasi tidak valid.");
  for (const key of COLLECTIONS) {
    if (!Array.isArray(state[key])) throw new Error(`Koleksi ${key} tidak valid.`);
    const ids = state[key].map((row) => row?.id);
    if (ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) throw new Error(`ID koleksi ${key} kosong atau duplikat.`);
  }
  if (!state.meta || typeof state.meta !== "object" || Array.isArray(state.meta) || !state.partner_parameters || typeof state.partner_parameters !== "object" || Array.isArray(state.partner_parameters)) throw new Error("Konfigurasi aplikasi tidak valid.");
  const emails = state.users.map((user) => String(user.email || "").trim().toLowerCase());
  if (emails.some((email) => !email || !email.includes("@")) || new Set(emails).size !== emails.length) throw new Error("Email akun kosong atau duplikat.");
  if (state.users.some((user) => !ROLES.includes(user.role) || typeof user.password_hash !== "string" ||
    (user.auth_version !== undefined && (!Number.isSafeInteger(user.auth_version) || user.auth_version < 0)) ||
    (user.must_change_password !== undefined && typeof user.must_change_password !== "boolean"))) throw new Error("Role atau kredensial akun tidak valid.");
  if (production) {
    if (!state.users.some((user) => user.role === "super_admin" && user.active !== false)) throw new Error("Produksi memerlukan Super Admin aktif.");
    const bsi = state.partner_parameters.bsi_prapen;
    if (bsi?.schemaVersion !== 2 || !["PP3", "PP10", "PENSIUN"].every((key) => bsi.products?.[key])) throw new Error("Produksi memerlukan parameter BSI schemaVersion 2 yang telah dimigrasikan.");
  }
  return state;
}
