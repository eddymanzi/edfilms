function createRateLimiter({ windowMs = 60 * 1000, max = 100, keyPrefix = 'rl' } = {}) {
  const hits = new Map();

  function prune(now) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    prune(now);

    const key = `${keyPrefix}:${req.ip}`;
    const entry = hits.get(key) || { count: 0, resetAt: now + windowMs };
    entry.count += 1;
    hits.set(key, entry);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' }
      });
    }

    next();
  };
}

module.exports = { createRateLimiter };