// BSI Pensiun: read-only reconstruction for client validation, NOT a credit approval engine.
// Bank source: Kalkukator Pensiun rev1.xlsx, Akseptasi Pensiun / Pensiun / Rincain keNsb.
// Scope: Reguler (C16=1) and Atribusi Premi (C16=3). C16=4 is equivalent ONLY with penalty=0.
import { SIMAS_PENSIUN_PROFILE as PROFILE } from "../config/bsi-pensiun-simas-20260629.js";

export const MODEL_VERSION = "bsi-pensiun-validation-2026-11-03-v1";
export class PensionInputError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "PensionInputError";
    this.field = field;
  }
}

const INPUT_FIELDS = new Set([
  "birth_date", "process_date", "insurance_start_date", "first_installment_date",
  "pension_salary", "principal", "tenor_months", "base_rate_pct", "retired_type",
  "spouse_status", "ratio_basis", "ratio_pct", "ongoing_installments", "settlement_amount", "flagging"
]);
const FLAGGING_COST = Object.freeze({ TASPEN: 665000, TASPEN_CTP: 765000, ASABRI: 222000, DAPEN: 0 });
const BANK_HASH = "a8f81e36fcad34118c2f19d79a705002f2ca1fa00e382d98d4c99f3b95d9c245";

export function roundExcel(value, decimals = 2) {
  const factor = 10 ** decimals;
  const scaled = Math.abs(value) * factor;
  return Math.sign(value) * Math.floor(scaled + 0.5 + Number.EPSILON * scaled * 2) / factor;
}

function invalid(field, message) { throw new PensionInputError(message, field); }
export function parseCalendarDate(value, field = "date") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid(field, `${field} harus berupa tanggal YYYY-MM-DD.`);
  }
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1900 || y > 2200) invalid(field, `${field} di luar rentang kalender yang didukung.`);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    invalid(field, `${field} bukan tanggal kalender yang sah.`);
  }
  return date;
}
const iso = (date) => date.toISOString().slice(0, 10);
function lastDayOfMonth(year, month) { return new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); }
export function addMonthsClampedUtc(date, months) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(),
    Math.min(date.getUTCDate(), lastDayOfMonth(first.getUTCFullYear(), first.getUTCMonth()))));
}
// DATE(YEAR(C14), MONTH(C14)+n, DAY(C14)), including Excel DATE's overflow convention.
function sourceMaturityDate(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}
export function days360Utc(start, end) {
  let d1 = start.getUTCDate(), d2 = end.getUTCDate();
  const feb1 = start.getUTCMonth() === 1 && d1 === lastDayOfMonth(start.getUTCFullYear(), 1);
  const feb2 = end.getUTCMonth() === 1 && d2 === lastDayOfMonth(end.getUTCFullYear(), 1);
  if (feb1 && feb2) d2 = 30;
  if (feb1) d1 = 30;
  if (d2 === 31 && d1 >= 30) d2 = 30;
  if (d1 === 31) d1 = 30;
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 360
    + (end.getUTCMonth() - start.getUTCMonth()) * 30 + d2 - d1;
}
export function nearestAgeUtc(birth, at) { return Math.floor(days360Utc(birth, at) / 360 + 0.5); }

function numeric(body, field, { min = 0, max = 1e12, integer = false, money = false } = {}) {
  const raw = body[field];
  if (!(["number", "string"].includes(typeof raw)) || String(raw).trim() === "") {
    invalid(field, `${field} wajib berupa angka.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    invalid(field, `${field} di luar rentang yang didukung${integer ? " atau bukan bilangan bulat" : ""}.`);
  }
  if (money && Math.abs(value * 100 - Math.round(value * 100)) > 1e-4) {
    invalid(field, `${field} maksimal dua angka desimal rupiah.`);
  }
  return value;
}
function choice(body, field, allowed) {
  if (!allowed.includes(body[field])) invalid(field, `Pilihan ${field} tidak didukung.`);
  return body[field];
}

function normalizeInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("input", "Input harus berupa objek JSON.");
  for (const key of Object.keys(body)) {
    if (!INPUT_FIELDS.has(key)) invalid(key, `Parameter ${key} tidak didukung. Penalti, EM, diskon dan override aturan belum aktif.`);
  }
  const birth = parseCalendarDate(body.birth_date, "birth_date");
  const process = parseCalendarDate(body.process_date, "process_date");
  const policy = parseCalendarDate(body.insurance_start_date, "insurance_start_date");
  const first = parseCalendarDate(body.first_installment_date, "first_installment_date");
  if (birth >= process || birth >= policy) invalid("birth_date", "Tanggal lahir harus mendahului pencairan dan mulai polis.");
  if (first < process) invalid("first_installment_date", "Angsuran pertama tidak boleh mendahului pencairan pada model validasi ini.");
  const input = {
    birth_date: iso(birth), process_date: iso(process), insurance_start_date: iso(policy), first_installment_date: iso(first),
    pension_salary: numeric(body, "pension_salary", { min: 0.01, money: true }),
    principal: numeric(body, "principal", { min: 1000000, max: PROFILE.max_sum_assured, money: true }),
    tenor_months: numeric(body, "tenor_months", { min: 1, max: 180, integer: true }),
    base_rate_pct: numeric(body, "base_rate_pct", { min: 0.0001, max: 100 }),
    retired_type: choice(body, "retired_type", ["pensiunan", "janda"]),
    spouse_status: choice(body, "spouse_status", ["with_spouse", "single"]),
    ratio_basis: choice(body, "ratio_basis", ["DBR", "DSR"]),
    ratio_pct: numeric(body, "ratio_pct"),
    ongoing_installments: numeric(body, "ongoing_installments", { money: true }),
    settlement_amount: numeric(body, "settlement_amount", { money: true }),
    flagging: choice(body, "flagging", Object.keys(FLAGGING_COST))
  };
  if (![70, 90].includes(input.ratio_pct)) invalid("ratio_pct", "Persentase yang tersedia pada dropdown sumber hanya 70 atau 90.");
  return { input, birth, process, policy, first };
}

export function insuranceTariffPermil(entryAge, months) {
  if (!Number.isInteger(entryAge) || entryAge < PROFILE.min_entry_age || entryAge > PROFILE.max_entry_age) {
    invalid("birth_date", "Usia masuk Simas Pensiun harus 45–74 tahun nearest birthday.");
  }
  if (!Number.isInteger(months) || months < 1 || months > PROFILE.max_policy_months || entryAge * 12 + months > 75 * 12) {
    invalid("tenor_months", "Masa polis harus 1–180 bulan dan usia nearest masuk ditambah masa polis maksimal 75 tahun.");
  }
  const row = PROFILE.tariffs_permil[entryAge];
  let rate;
  if (months < 12) rate = row[0] * PROFILE.month_multipliers[months - 1];
  else {
    const years = Math.floor(months / 12), remainder = months % 12;
    const lower = row[years - 1];
    const upper = remainder ? row[years] : lower;
    if (!(lower > 0) || !(upper > 0)) invalid("tenor_months", "Tarif Simas untuk usia dan masa polis tersebut tidak tersedia.");
    rate = lower + (upper - lower) * remainder / 12;
  }
  if (!(rate > 0) || !Number.isFinite(rate)) invalid("tenor_months", "Tarif asuransi tidak tersedia; tidak boleh diganti nol.");
  return roundExcel(rate, 2);
}

export function medicalStatus(entryAge, sumAssured) {
  if (entryAge < 45 || entryAge > 74 || !Number.isFinite(sumAssured) || sumAssured <= 0 || sumAssured > 350000000) return "UNAVAILABLE";
  if (entryAge >= 71 || (entryAge >= 66 && sumAssured >= 100000001) || (entryAge >= 61 && sumAssured >= 300000001)) return "MCU";
  return "NON_MCU";
}

export function payment(monthlyRate, months, principal) {
  if (monthlyRate === 0) return principal / months;
  return principal * monthlyRate / (-Math.expm1(-months * Math.log1p(monthlyRate)));
}
function solveAnnualRate(months, principal, targetPayment) {
  let low = 0, high = 0.02;
  while (payment(high, months, principal) < targetPayment && high < 1024) high *= 2;
  if (payment(high, months, principal) < targetPayment) throw new Error("RATE tidak dapat direkonstruksi.");
  for (let k = 0; k < 70; k++) {
    const mid = (low + high) / 2;
    if (payment(mid, months, principal) < targetPayment) low = mid;
    else high = mid;
  }
  return roundExcel((low + high) / 2 * 12, 4);
}

function evaluatePrincipal(input, principal, q, attributed) {
  const n = input.tenor_months;
  const premiumExact = attributed ? principal * q / (1 - q) : principal * q;
  const sumAssuredExact = attributed ? principal + premiumExact : principal;
  const basePayment = payment(input.base_rate_pct / 1200, n, principal);
  // Pensiun AI = total base margin, AJ = P + margin + premium; AK rounded BEFORE RATE.
  const candidatePayment = attributed ? roundExcel((basePayment * n + premiumExact) / n, 2) : basePayment;
  const annualRate = attributed ? solveAnnualRate(n, principal, candidatePayment) : input.base_rate_pct / 100;
  return {
    premiumExact, sumAssuredExact, candidatePayment, annualRate,
    installmentExact: payment(annualRate / 12, n, principal)
  };
}
const cents = (value) => Math.round(roundExcel(value, 2) * 100);

function scenario(input, ctx, attributed) {
  const p = input.principal;
  const x = evaluatePrincipal(input, p, ctx.q, attributed);
  const admin = cents(p * 0.01), stamp = 100000;
  const premiumCash = attributed ? 0 : cents(x.premiumExact);
  const blocked = attributed ? cents(2 * x.installmentExact) : 0;
  const settlement = cents(input.settlement_amount);
  const netCents = cents(p) - admin - cents(stamp) - premiumCash - blocked - settlement;
  let indicativeMax = 0;
  // Rp350m here is the INSURANCE upper bound, NOT an assumed official bank loan cap.
  for (let candidate = 1000000; candidate <= PROFILE.max_sum_assured; candidate += 1000000) {
    const test = evaluatePrincipal(input, candidate, ctx.q, attributed);
    if (test.sumAssuredExact <= PROFILE.max_sum_assured && test.installmentExact <= ctx.capacity + 1e-7) indicativeMax = candidate;
  }
  const sourceEndAge = nearestAgeUtc(ctx.birth, ctx.sourceMaturity);
  const labelEndLimit = addMonthsClampedUtc(ctx.birth, 74 * 12 + 6);
  const sourceEndOk = sourceEndAge <= 74.5;
  const labelEndOk = ctx.sourceMaturity <= labelEndLimit;
  const checks = [
    { key: "entry_age", label: `Usia minimum bank menurut DAYS360: ${input.retired_type === "janda" ? 48 : 50} tahun`, ok: Math.floor(days360Utc(ctx.birth, ctx.process) / 360) >= (input.retired_type === "janda" ? 48 : 50) },
    { key: "installment_capacity", label: "Angsuran dalam kapasitas menurut pilihan rasio", ok: ctx.capacity > 0 && x.installmentExact <= ctx.capacity + 1e-7 },
    { key: "sum_assured", label: "Santunan setelah atribusi maksimal Rp350 juta", ok: x.sumAssuredExact <= PROFILE.max_sum_assured },
    { key: "attribution_cap", label: "Atribusi nasabah maksimal 70% plafon", ok: !attributed || x.premiumExact <= p * 0.7 },
    { key: "net_cash", label: "Pencairan bersih positif", ok: netCents > 0 },
    { key: "source_end_age", label: "Peringatan usia akhir menurut rumus template", ok: sourceEndOk },
    { key: "coverage_dates", label: "Polis mencakup pencairan sampai angsuran terakhir", ok: ctx.policy <= ctx.process && ctx.policyEnd >= ctx.lastInstallment }
  ];
  return {
    scheme: attributed ? "atribusi_premi" : "reguler",
    source_coverage_code: attributed ? 3 : 1,
    principal: p, tenor_months: input.tenor_months,
    annual_price_pct: roundExcel(x.annualRate * 100, 4),
    installment: roundExcel(x.installmentExact), installment_exact: x.installmentExact,
    candidate_installment_before_rate_rounding: roundExcel(x.candidatePayment),
    premium: roundExcel(x.premiumExact), sum_assured: roundExcel(x.sumAssuredExact),
    medical_status: medicalStatus(ctx.entryAge, x.sumAssuredExact),
    admin_fee: admin / 100, stamp_fee: stamp, upfront_premium: premiumCash / 100,
    blocked_installments: blocked / 100, settlement_amount: settlement / 100,
    financed_customer_cost: attributed ? roundExcel(x.premiumExact) : 0,
    bank_allocated_cost: roundExcel(p * 0.025 + FLAGGING_COST[input.flagging]),
    net_disbursement: netCents / 100,
    remaining_pension_salary: (cents(input.pension_salary) - cents(input.ongoing_installments) - cents(x.installmentExact)) / 100,
    template_ratio_pct: roundExcel(((input.ratio_basis === "DBR" ? input.ongoing_installments : 0) + x.installmentExact) / input.pension_salary * 100, 4),
    total_installments: roundExcel(x.installmentExact * input.tenor_months),
    indicative_max_principal: indicativeMax,
    source_end_age_nearest: sourceEndAge,
    label_end_age_check: labelEndOk,
    end_age_rule_disagrees: sourceEndOk !== labelEndOk,
    within_template_checks: checks.every((check) => check.ok),
    can_submit: false,
    checks
  };
}

export function comparePensionScenarios(body) {
  const ctx = normalizeInput(body);
  const { input, birth, process, policy, first } = ctx;
  ctx.entryAge = nearestAgeUtc(birth, policy);
  const tariff = insuranceTariffPermil(ctx.entryAge, input.tenor_months);
  ctx.q = tariff / 1000; // EM and discount intentionally absent from this validated subset.
  if (!(ctx.q > 0 && ctx.q < 1)) invalid("tenor_months", "Tarif efektif tidak sah.");
  ctx.capacity = input.pension_salary * (input.spouse_status === "with_spouse" ? 0.98 : 1)
    * input.ratio_pct / 100 - (input.ratio_basis === "DBR" ? input.ongoing_installments : 0);
  ctx.lastInstallment = addMonthsClampedUtc(first, input.tenor_months - 1);
  ctx.policyEnd = addMonthsClampedUtc(policy, input.tenor_months);
  ctx.sourceMaturity = sourceMaturityDate(process, input.tenor_months);
  return {
    product_code: "bsi_pensiun", status: "VALIDATION_ONLY", can_submit: false,
    model_version: MODEL_VERSION, insurance_profile_version: PROFILE.version,
    source_hashes: { bank: BANK_HASH, insurance: PROFILE.source_sha256 },
    input,
    insurance_entry_age_nearest: ctx.entryAge, insurance_tariff_permil: tariff,
    recognized_income: input.pension_salary,
    installment_capacity: roundExcel(ctx.capacity),
    dates: {
      last_installment: iso(ctx.lastInstallment), insurance_end: iso(ctx.policyEnd),
      bank_maturity_source_date: iso(ctx.sourceMaturity),
      bank_maturity_source_month_start: iso(new Date(Date.UTC(process.getUTCFullYear(), process.getUTCMonth() + input.tenor_months, 1)))
    },
    scenarios: {
      reguler: scenario(input, ctx, false),
      atribusi_premi: scenario(input, ctx, true)
    },
    notes: [
      "Hasil rekonstruksi untuk validasi internal; belum persetujuan pembiayaan atau penawaran harga berlaku.",
      "Harga dasar diinput eksplisit. Contoh 10,5% pada sumber berlabel s.d. Juni 2026; perlu konfirmasi harga berlaku.",
      "Maksimum indikatif memakai grid Rp1 juta, kapasitas angsuran akhir dan batas santunan Simas; belum merupakan batas resmi plafon bank.",
      "Model memakai faktor penghasilan diakui 100%. Definisi DBR/DSR dan faktor pasangan mengikuti template, menunggu pengesahan klien.",
      "Atribusi premi = coverage 3; setara angka coverage 4 hanya saat penalti nol. Penalti, EM, diskon, broker dan insurer lain belum didukung.",
      "Blokir dua angsuran untuk atribusi, nihil untuk reguler, admin 1% dan materai Rp100 ribu mengikuti rincian sumber; perlu disahkan.",
      "Batas usia akhir 74 tahun 6 bulan dan perbedaan tanggal sumber belum disahkan. Status MCU membutuhkan proses pemeriksaan tersendiri.",
      "Kesetaraan Microsoft Excel native untuk seluruh variasi belum dibuktikan. Uji anchor bukan sertifikasi keseluruhan formula."
    ]
  };
}
