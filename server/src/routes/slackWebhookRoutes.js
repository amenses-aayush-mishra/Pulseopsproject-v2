'use strict';
const express = require('express');
const { verifySlackSignature } = require('../middleware/verifySlackSignature');
const { slackQueue } = require('../services/slackQueue');

const router = express.Router();

/**
 * POST /api/webhooks/slack  (+ /events legacy alias)
 *
 * Slack Events API endpoint. Contract:
 *   - URL verification: return the challenge verbatim (Slack sends this when
 *     you register the endpoint or change scopes).
 *   - event_callback: verify the X-Slack-Signature, enqueue the RAW payload
 *     for async processing, and acknowledge with a 200 immediately.
 *
 * The webhook is NOT the worker. It only: receives → verifies → dedupes
 * (via the ledger in the worker) → enqueues → responds. File downloads, Slack
 * enrichment and DB transactions all happen off the request in the queue
 * worker. Slack retries until it sees a 2xx within ~3s, so we must stay fast.
 */
router.post('/events', webhookHandler);
router.post('/', webhookHandler);

async function webhookHandler(req, res) {
  try {
    const body = req.body || {};

    // URL verification (Slack sends this when you first register the URL).
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    if (body.type !== 'event_callback') {
      return res.status(200).send('OK');
    }

    // Reject unauthenticated requests before enqueueing.
    if (!verifySlackSignature(req)) {
      console.warn('[slackWebhook] Signature verification failed.');
      return res.status(401).json({ error: 'Invalid Slack signature.' });
    }

    // Enqueue the raw event for the background worker. Never block here on
    // file downloads or DB writes — Slack waits for a fast 200.
    // Bounded attempts: transient retry; permanent failures recorded as
    // integration/conversation status instead of endless queue churn.
    await slackQueue.add('slack_event_callback', { body }, {
      attempts: 3,
      backoffMs: 1500,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[slackWebhook] Handler error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = router;
module.exports.webhookHandler = webhookHandler;