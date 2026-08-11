'use strict';

/**
 * TASK-112 — In-memory sliding-window rate limiter.
 *
 * Drop-in stand-in for the `express-rate-limit` package, which cannot be
 * installed on this machine (the npm registry is unreachable on the corporate
 * network — documented in SPRINT1_TRACKER.md). The TASK-112 spec explicitly
 * permits "express-rate-limit (or sliding window memory store)".
 *
 * Tracks request timestamps per IP inside a sliding window:
 *   - windowMs: window length in ms (default 15 minutes)
 *   - max:      maximum requests allowed per IP within the window (default 20)
 *
 * Over-limit requests receive:
 *   429 { message: "Too many authentication attempts. Please try again later.",
 *         code: "RATE_LIMIT_EXCEEDED" }
 *
 * NOTE: single-process only (in-memory Map). Multi-instance deployments should
 * swap this for a shared store (e.g. Redis) — out of scope for this sprint.
 */
const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 20 } = {}) => {
  // ip -> array of request timestamps (ms) within the current window
  const hits = new Map();

  const cleanup = (now) => {
    for (const [key, timestamps] of hits) {
      const fresh = timestamps.filter((t) => now - t < windowMs);
      if (fresh.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, fresh);
      }
    }
  };

  return (req, res, next) => {
    const now = Date.now();
    cleanup(now);

    const ip =
      req.ip ||
      (req.socket && req.socket.remoteAddress) ||
      String(req.headers['x-forwarded-for'] || 'unknown');

    const windowHits = hits.get(ip) || [];

    if (windowHits.length >= max) {
      return res.status(429).json({
        message: 'Too many authentication attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    windowHits.push(now);
    hits.set(ip, windowHits);
    return next();
  };
};

module.exports = createRateLimiter;
