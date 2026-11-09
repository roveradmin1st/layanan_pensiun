import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const COST = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const PREFIX = "scrypt$131072$8$1$";
const DEFAULTS = new Set(["password123!", "admin123", "password", "changeme", "12345678", "123456789012"]);
let running = 0;
const queue = [];

export class PasswordServiceBusy extends Error {}

async function bounded(work) {
  if (running >= 2) {
    if (queue.length >= 24) throw new PasswordServiceBusy("Layanan masuk sedang sibuk. Silakan coba kembali.");
    await new Promise((resolve) => queue.push(resolve));
  } else {
    running += 1;
  }
  try { return await work(); }
  finally {
    const next = queue.shift();
    if (next) next(); else running -= 1;
  }
}

export const isDefaultPassword = (password) => DEFAULTS.has(String(password).trim().toLowerCase());
export const legacyPasswordHash = (plain) => createHash("sha256").update(`lp_salt_2026_${plain}`).digest("hex");
export const isStrongPasswordHash = (value) => /^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(value || "");

export function passwordProblem(value, production = true) {
  if (typeof value !== "string" || value.length < 12) return "Kata sandi minimal 12 karakter.";
  if (Buffer.byteLength(value, "utf8") > 256) return "Kata sandi terlalu panjang (maksimal 256 byte).";
  if (production && isDefaultPassword(value)) return "Gunakan kata sandi pribadi yang tidak sama dengan kata sandi contoh.";
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await bounded(() => derive(password, salt, 64, COST));
  return PREFIX + salt.toString("hex") + "$" + key.toString("hex");
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 256 || typeof encoded !== "string") return { valid: false, needsRehash: false };
  if (/^[0-9a-f]{64}$/.test(encoded)) {
    return { valid: timingSafeEqual(Buffer.from(legacyPasswordHash(password), "hex"), Buffer.from(encoded, "hex")), needsRehash: true };
  }
  if (!isStrongPasswordHash(encoded)) return { valid: false, needsRehash: false };
  const parts = encoded.split("$");
  const key = await bounded(() => derive(password, Buffer.from(parts[4], "hex"), 64, COST));
  return { valid: timingSafeEqual(key, Buffer.from(parts[5], "hex")), needsRehash: false };
}
