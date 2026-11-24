export function normalizeClientIp(ip) {
  const raw = String(ip || "unknown").trim().toLowerCase().slice(0, 128);
  if (!raw) return "unknown";
  const v4Mapped = raw.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4Mapped) return v4Mapped[1];
  if (!raw.includes(":")) return raw;

  const noZone = raw.split("%")[0];
  if (noZone === "::1") return "::1";

  const doubleColonParts = noZone.split("::");
  if (doubleColonParts.length > 2) return raw;

  const parseSide = (side) => {
    if (!side) return [];
    const tokens = side.split(":");
    const hextets = [];
    for (const tok of tokens) {
      if (tok.includes(".")) {
        const octets = tok.split(".").map((n) => Number(n));
        if (octets.length === 4 && octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
          hextets.push(((octets[0] << 8) | octets[1]).toString(16));
          hextets.push(((octets[2] << 8) | octets[3]).toString(16));
          continue;
        }
      }
      hextets.push(tok);
    }
    return hextets;
  };

  let groups;
  if (doubleColonParts.length === 2) {
    const left = parseSide(doubleColonParts[0]);
    const right = parseSide(doubleColonParts[1]);
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return raw;
    groups = [...left, ...Array(missing).fill("0"), ...right];
  } else {
    groups = parseSide(noZone);
  }

  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) {
    return raw;
  }
  const prefix64 = groups.slice(0, 4).map((g) => g.replace(/^0+/, "") || "0").join(":");
  return `${prefix64}::/64`;
}

export class LoginLimiter {
  constructor({ accountLimit = 10, ipLimit = 100, windowMs = 15 * 60 * 1000, maxEntries = 10000, clock = Date.now } = {}) {
    Object.assign(this, { accountLimit, ipLimit, windowMs, maxEntries, clock });
    this.accounts = new Map(); this.ips = new Map();
  }
  normalizeIp(ip) {
    return normalizeClientIp(ip);
  }
  reserve(ip, email) {
    const now = this.clock();
    const normIp = this.normalizeIp(ip);
    for (const map of [this.accounts, this.ips]) {
      for (const [key, value] of map) if (value.until <= now) map.delete(key);
    }
    const account = `${normIp}\0${String(email || "").trim().toLowerCase().slice(0, 254)}`;
    const pair = [[this.ips, normIp, this.ipLimit], [this.accounts, account, this.accountLimit]];
    let retryAfter = 0;
    for (const [map, key, limit] of pair) {
      const value = map.get(key);
      if (value && value.count >= limit) retryAfter = Math.max(retryAfter, Math.ceil((value.until - now) / 1000));
      if (!value && map.size >= this.maxEntries) retryAfter = Math.max(retryAfter, 60);
    }
    if (retryAfter) return { allowed: false, retryAfter };
    for (const [map, key] of pair) {
      const value = map.get(key) || { count: 0, until: now + this.windowMs };
      value.count += 1; map.set(key, value);
    }
    return { allowed: true, retryAfter: 0 };
  }
}
