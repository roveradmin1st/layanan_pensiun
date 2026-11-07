export class LoginLimiter {
  constructor({ accountLimit = 10, ipLimit = 100, windowMs = 15 * 60 * 1000, maxEntries = 10000, clock = Date.now } = {}) {
    Object.assign(this, { accountLimit, ipLimit, windowMs, maxEntries, clock });
    this.accounts = new Map(); this.ips = new Map();
  }
  reserve(ip, email) {
    const now = this.clock();
    for (const map of [this.accounts, this.ips]) {
      for (const [key, value] of map) if (value.until <= now) map.delete(key);
    }
    const account = `${ip}\0${String(email || "").trim().toLowerCase().slice(0, 254)}`;
    const pair = [[this.ips, ip, this.ipLimit], [this.accounts, account, this.accountLimit]];
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
