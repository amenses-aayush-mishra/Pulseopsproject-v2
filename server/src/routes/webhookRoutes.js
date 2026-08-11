const express = require('express');
const { verifyWebhookSignature } = require('./verifyGithubWebhook');
const webhookRateLimiter = require('./rateLimiter')(15 * 60 * 1000, 240);

const router = express.Router();

router.post('/github', webhookRateLimiter, express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = req.body;

  if (!verifyWebhookSignature(process.env.GITHUB_WEBHOOK_SECRET, payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process event (e.g., 'push', 'pull_request')
  console.log('Verified GitHub event:', req.headers['x-github-event']);
  res.status(200).json({ status: 'accepted' });
});

module.exports = router;