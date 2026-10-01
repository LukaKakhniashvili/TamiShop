const httpError = require('../utils/httpError');

/*
 * მარტივი in-memory rate limiter (fixed window) — ავტორიზაციის მგრძნობიარე endpoint-ებისთვის.
 * ერთი სერვერის პროცესისთვის საკმარისია; რამდენიმე ინსტანციის შემთხვევაში საჭიროა საერთო საცავი (მაგ. Redis).
 */
const rateLimit = ({ windowMs, max, key = (req) => req.ip, message = 'ძალიან ბევრი მცდელობა. სცადეთ მოგვიანებით.' }) => {
  const hits = new Map(); // key -> { count, resetAt }

  // ძველი ჩანაწერების პერიოდული გასუფთავება
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.min(windowMs, 60_000)).unref();

  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return next(
        Object.assign(httpError(429, message, { code: 'RATE_LIMITED', retryAfterSeconds: retryAfter }), {
          headers: { 'Retry-After': String(retryAfter) },
        })
      );
    }
    next();
  };
};

module.exports = rateLimit;
