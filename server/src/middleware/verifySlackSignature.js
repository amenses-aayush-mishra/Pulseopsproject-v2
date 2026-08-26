'use strict';
const crypto = require('crypto');

/**
 * Verify a Slack Events API request signature.
 *
 * Slack signs each request with `X-Slack-Signature: v0=<hex HMAC-SHA256>`.
 * The signature is computed over `v0:<timestamp>:<raw body>` using
 * `SLACK_SIGNING_SECRET`. The raw (un-parsed) body bytes are required because
 * the parsed JSON body is not guaranteed byte-for-byte identical.
 *
 * FAIL-CLOSED: when SLACK_SIGNING_SECRET is not configured the request is
 * rejected. A missing signing secret is a misconfiguration, not a reason to
 * accept unverified payloads.
 *
 * @param {object}   req  - Express request (uses req.rawBody + headers).
 * @param {string}   [secret] - Override for testing; falls back to env.
 * @returns {boolean} true when the request is authentic.
 */
function verifySlackSignature(req, secret) {
  const signingSecret = secret || process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('[verifySlackSignature] SLACK_SIGNING_SECRET is not configured — rejecting request.');
    return false;
  }

  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

  if (!signature || !timestamp) return false;

  // Prevent replay attacks: Slack timestamps are Unix seconds.
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - Number(timestamp)) > 300) return false;

  const base = `v0:${timestamp}:`;
  const payload = Buffer.concat([
    Buffer.from(base, 'utf8'),
    Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8'),
  ]);
  const digest = crypto
    .createHmac('sha256', signingSecret)
    .update(payload)
    .digest('hex');

  const expected = `v0=${digest}`;
  if (expected.length !== signature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}

module.exports = { verifySlackSignature };