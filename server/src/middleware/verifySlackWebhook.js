'use strict';
const crypto = require('crypto');

const SLACK_VERSION = 'v0';
const MAX_AGE_SECONDS = 60 * 5; // Slack events must arrive within 5 minutes.

/**
 * Verify an incoming Slack Events API request using the Slack Signing Secret.
 *
 * Slack signs the EXACT raw request body with HMAC-SHA256 using the format:
 *   v0:<x-slack-request-timestamp>:<rawBody>
 * and sends the digest in the `X-Slack-Signature` header. We recompute it over
 * `req.rawBody` (captured by the express.json verify callback in server.js) so
 * the byte-for-byte body is verified — exactly mirroring verifyGithubWebhook.
 *
 * The signing secret is read from SLACK_SIGNING_SECRET and is NEVER exposed to
 * the browser (it is only consumed server-side).
 */
function verifySlackWebhook(req, res, next) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  // Secure-by-default: if the secret isn't configured we must NOT trust any
  // incoming POST, otherwise a public webhook could be spoofed.
  if (!signingSecret) {
    return res.status(503).json({ message: 'SLACK_SIGNING_SECRET is not configured on this server.' });
  }

  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];
  if (!signature || !timestamp) {
    return res.status(401).json({ message: 'Missing Slack signature headers.' });
  }

  // Reject stale requests (>5 min) to prevent replay attacks.
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - Number(timestamp)) > MAX_AGE_SECONDS) {
    return res.status(401).json({ message: 'Request timestamp is too old.' });
  }

  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const base = `${SLACK_VERSION}:${timestamp}:${rawBody}`;
  const expected = `${SLACK_VERSION}=${crypto
    .createHmac('sha256', signingSecret)
    .update(base)
    .digest('hex')}`;

  const expectedBuf = Buffer.from(expected, 'utf8');
  const signatureBuf = Buffer.from(signature, 'utf8');
  const valid =
    expectedBuf.length === signatureBuf.length &&
    crypto.timingSafeEqual(expectedBuf, signatureBuf);

  if (!valid) {
    return res.status(401).json({ message: 'Invalid Slack signature.' });
  }

  next();
}

module.exports = verifySlackWebhook;
