// ============================================================================
// CENTRALIZED WIB (Asia/Jakarta, UTC+07:00) BUSINESS DATE HELPER
// Prevents 7-hour UTC drift (00:00:00–06:59:59 WIB returning D-1) across
// actuarial calculators, daily lead-request quotas, and follow-up dates.
// ============================================================================

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Mengembalikan tanggal kalender WIB (Asia/Jakarta, UTC+7) dalam format YYYY-MM-DD.
 * @param {Date | number} [now=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export function todayWibIso(now = new Date()) {
  const epochMs = now instanceof Date ? now.getTime() : Number(now);
  const safeMs = Number.isFinite(epochMs) ? epochMs : Date.now();
  return new Date(safeMs + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Mengembalikan kode tahun-bulan WIB dalam format YYYYMM (contoh: "202611").
 * @param {Date | number} [now=new Date()]
 * @returns {string} YYYYMM
 */
export function yearMonthWibCompact(now = new Date()) {
  return todayWibIso(now).slice(0, 7).replace("-", "");
}

/**
 * Mengonversi string ISO timestamp (UTC atau ber-offset) menjadi tanggal kalender WIB (YYYY-MM-DD).
 * Jika string sudah berupa YYYY-MM-DD, dikembalikan apa adanya.
 * @param {string | null | undefined} isoValue
 * @returns {string}
 */
export function isoTimestampToWibDate(isoValue) {
  if (!isoValue || typeof isoValue !== "string") return "";
  const trimmed = isoValue.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) return trimmed.slice(0, 10);
  return todayWibIso(parsedMs);
}
