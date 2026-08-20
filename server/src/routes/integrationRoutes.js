'use strict';
const crypto = require('crypto');
const express = require('express');
const { verifyWebhookSignature } = require('../middleware/verifyGithubWebhook');
const authenticate = require('../middleware/authenticate');
const verifyTenantAccess = require('../middleware/verifyTenantAccess');
const requirePermission = require('../middleware/requirePermission');
const { encrypt } = require('../utils/crypto');
const { githubRequest } = require('../services/githubClient');
const Integration = require('../models/Integration');
const Repository = require('../models/Repository');
const {
  slackWebhookRequest,
  buildTestMessagePayload,
} = require('../services/slackClient');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/integrations/github/connect
// Returns a GitHub OAuth URL for the requesting organisation.
// ---------------------------------------------------------------------------
router.get(
  '/github/connect',
  authenticate,
  verifyTenantAccess,
  requirePermission('manage_integrations'),
  async (req, res) => {
    const clientId = process.env.GITHUB_INTEGRATION_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: 'GitHub OAuth is not configured on this server.' });
    }
    const state = crypto.randomBytes(20).toString('hex');
    await Integration.findOneAndUpdate(
      { organizationId: req.organizationId, provider: 'github' },
      {
        $setOnInsert: { organizationId: req.organizationId, provider: 'github' },
        $set: { state, status: 'pending' },
      },
      { upsert: true, new: true }
    );
    console.log("SAVED STATE:", state);
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.append('client_id', clientId);

    authUrl.searchParams.append(
      'redirect_uri',
       process.env.GITHUB_CALLBACK_URL
    );
    authUrl.searchParams.append('scope', 'repo repo:hook read:org');
    authUrl.searchParams.append('state', state);
    res.json({ url: authUrl.toString() });
  }
);

// Legacy path: /api/integrations/connect (no provider segment)
router.get('/connect', authenticate, verifyTenantAccess, requirePermission('manage_integrations'), (req, res) => {
  // Redirect internally to the named route.
  req.url = '/github/connect';
  router.handle(req, res, () => {});
});

// ---------------------------------------------------------------------------
// GET /api/integrations/github/callback  (OAuth redirect from GitHub)
// ---------------------------------------------------------------------------
router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state parameter.' });
  }
  
  
  console.log("RECEIVED STATE:", state);

  const integration = await Integration.findOne({ provider: 'github', state });
  console.log("FOUND DOC:", integration);
  if (!integration) return res.status(400).json({ error: 'Invalid or expired OAuth state.' });

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_INTEGRATION_CLIENT_ID,
      client_secret: process.env.GITHUB_INTEGRATION_CLIENT_SECRET,
      code: String(code),
      redirect_uri: process.env.GITHUB_CALLBACK_URL,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return res.status(400).json({ error: 'Failed to exchange GitHub code for token.' });
  }

  integration.accessToken = encrypt(tokenData.access_token);
  integration.status = 'active';
  integration.state = undefined; // consumed
  await integration.save();

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(
    `${frontendUrl}/workspace/${integration.organizationId}/integrations?connected=github`
  );
});

// ---------------------------------------------------------------------------
// GET /api/integrations/github/status
// Returns the connection status of GitHub for the workspace.
// ---------------------------------------------------------------------------
router.get(
  '/github/status',
  authenticate,
  verifyTenantAccess,
  async (req, res) => {
    try {
      const integration = await Integration.findOne({
        organizationId: req.organizationId,
        provider: 'github',
        status: 'active'
      });
      if (integration) {
        return res.status(200).json({ connected: true, accountName: integration.accountName });
      }
      return res.status(200).json({ connected: false });
    } catch (err) {
      console.error('[github/status] error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/integrations/github/repositories
// Fetches repositories for the authenticated GitHub user/org.
// ---------------------------------------------------------------------------
router.get(
  '/github/repositories',
  authenticate,
  verifyTenantAccess,
  async (req, res) => {
    const integration = await Integration.findOne({
      organizationId: req.organizationId,
      provider: 'github',
      status: 'active',
    });
    if (!integration?.accessToken) {
      return res.status(404).json({ error: 'GitHub not connected for this workspace.' });
    }

    try {
      const ghRes = await githubRequest('/user/repos?sort=updated&per_page=50', integration);
      if (!ghRes.ok) {
        return res.status(ghRes.status).json({ error: 'GitHub API error.' });
      }
      const repos = await ghRes.json();
      return res.json(
        repos.map((r) => ({
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          private: r.private,
          html_url: r.html_url,
          updated_at: r.updated_at,
          default_branch: r.default_branch,
        }))
      );
    } catch (err) {
      console.error('[github/repos] error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/integrations/track-repositories
// Save selected repos and register GitHub webhooks.
// ---------------------------------------------------------------------------
router.post(
  '/track-repositories',
  authenticate,
  verifyTenantAccess,
  requirePermission('manage_integrations'),
  async (req, res) => {
    const integration = await Integration.findOne({
      organizationId: req.organizationId,
      provider: 'github',
      status: 'active',
    });
    if (!integration?.accessToken) {
      return res.status(404).json({ error: 'GitHub not connected' });
    }

    const repositoryIds = Array.isArray(req.body?.repositoryIds) ? req.body.repositoryIds : [];
    if (repositoryIds.length === 0) {
      return res.status(400).json({ error: 'No repositories selected.' });
    }

    try {
      // Fetch repo details from GitHub to get the full_name needed for webhooks.
      const ghRes = await githubRequest('/user/repos?per_page=100', integration);
      const allRepos = ghRes.ok ? await ghRes.json() : [];

      const results = [];
      for (const repoId of repositoryIds) {
        const repoMeta = allRepos.find((r) => r.id === Number(repoId));
        const fullName = repoMeta?.full_name;

        await Repository.findOneAndUpdate(
          // Unique index on { organizationId, githubRepoId } + upsert prevents
          // duplicate imports for the same workspace.
          { organizationId: req.organizationId, githubRepoId: String(repoId) },
          {
            $set: {
              name: repoMeta?.name || String(repoId),
              fullName: fullName || String(repoId),
              private: !!repoMeta?.private,
              htmlUrl: repoMeta?.html_url || null,
              defaultBranch: repoMeta?.default_branch || 'main',
            },
          },
          { upsert: true }
        );

        if (fullName && process.env.BACKEND_API_URL) {
          try {
            await githubRequest(`/repos/${fullName}/hooks`, integration, {
              method: 'POST',
              body: JSON.stringify({
                name: 'web',
                active: true,
                events: ['push', 'pull_request'],
                config: {
                  url: `${process.env.BACKEND_API_URL}/api/webhooks/github`,
                  content_type: 'json',
                  secret: process.env.GITHUB_WEBHOOK_SECRET || '',
                },
              }),
            });
            results.push({ repoId, status: 'webhook_registered' });
          } catch (hookErr) {
            results.push({ repoId, status: 'webhook_failed', error: hookErr.message });
          }
        } else {
          results.push({ repoId, status: 'tracked_no_webhook' });
        }
      }

      return res.json({ success: true, results });
    } catch (err) {
      console.error('[track-repos] error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/webhooks/github  (also served via /api/integrations/github via server.js)
// Receives GitHub push and pull_request events.
// ---------------------------------------------------------------------------
router.post('/github', verifyWebhookSignature, (req, res) => {
  const event = req.headers['x-github-event'] || 'unknown';
  const payload = req.body;
  console.log(`[webhook/github] event=${event} repo=${payload?.repository?.full_name}`);

  if (event === 'push') {
    console.log(
      `[webhook/github] push ref=${payload.ref} commits=${(payload.commits || []).length}`
    );
  } else if (event === 'pull_request') {
    console.log(
      `[webhook/github] PR #${payload.pull_request?.number} action=${payload.action}`
    );
  } else if (event === 'ping') {
    return res.json({ ok: true, message: 'pong' });
  }

  res.status(200).json({ received: true, event });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/slack  (Slack events + URL verification)
// ---------------------------------------------------------------------------
router.post('/slack', (req, res) => {
  const body = req.body || {};

  // URL Verification challenge (Slack sends this when you first register the endpoint).
  if (body.type === 'url_verification') {
    console.log('[webhook/slack] URL verification challenge received.');
    return res.json({ challenge: body.challenge });
  }

  if (body.type === 'event_callback') {
    const eventType = body.event?.type || 'unknown';
    console.log(`[webhook/slack] event_callback type=${eventType}`);

    // Placeholder: route specific event types here.
    if (eventType === 'app_mention') {
      console.log('[webhook/slack] Bot was mentioned:', body.event?.text);
    } else if (eventType === 'message') {
      console.log('[webhook/slack] Message received in channel:', body.event?.channel);
    }
  }

  res.status(200).send('OK');
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/jira  (Jira issue webhooks)
// ---------------------------------------------------------------------------
router.post('/jira', (req, res) => {
  const body = req.body || {};
  const webhookEvent = body.webhookEvent || 'unknown';
  const issueKey = body.issue?.key || 'N/A';

  console.log(`[webhook/jira] event=${webhookEvent} issue=${issueKey}`);

  if (webhookEvent === 'jira:issue_created') {
    console.log('[webhook/jira] New issue created:', issueKey, body.issue?.fields?.summary);
  } else if (webhookEvent === 'jira:issue_updated') {
    console.log('[webhook/jira] Issue updated:', issueKey, body.issue?.fields?.status?.name);
  }

  res.status(200).json({ received: true, event: webhookEvent, issue: issueKey });
});

// Slack legacy path /api/integrations/slack
router.post('/slack-events', (req, res) => {
  req.url = '/slack';
  router.handle(req, res, () => {});
});

module.exports = router;

// slack part 
router.get(
  '/slack/authorize',
  authenticate,
  verifyTenantAccess,
  requirePermission('manage_integrations'),
  async (req, res) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: 'Slack OAuth is not configured on this server.' });
    }
    const state = crypto.randomBytes(20).toString('hex');
    await Integration.findOneAndUpdate(
      { organizationId: req.organizationId, provider: 'slack' },
      {
        $setOnInsert: { organizationId: req.organizationId, provider: 'slack' },
        $set: { state, status: 'pending' },
      },
      { upsert: true, new: true }
    );
 
    const authUrl = new URL('https://slack.com/oauth/v2/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', process.env.SLACK_CALLBACK_URL);
    // 'incoming-webhook' is the only bot scope needed for the MVP: posting
    // AI summaries into a single channel the admin picks during the Slack
    // OAuth consent screen. No chat:write / channels:read requested here.
    authUrl.searchParams.append('scope', 'incoming-webhook');
    authUrl.searchParams.append('state', state);
    res.json({ url: authUrl.toString() });
  }
);

// GET /api/integrations/slack/authorize
// Returns a Slack OAuth URL for the requesting organisation (Incoming Webhook).
// Mirrors /github/connect: authenticate -> verifyTenantAccess ->
// requirePermission('manage_integrations'), random state stored on the
// org's Slack Integration document before redirecting.
// ---------------------------------------------------------------------------
router.get(
  '/slack/authorize',
  authenticate,
  verifyTenantAccess,
  requirePermission('manage_integrations'),
  async (req, res) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: 'Slack OAuth is not configured on this server.' });
    }
    const state = crypto.randomBytes(20).toString('hex');
    await Integration.findOneAndUpdate(
      { organizationId: req.organizationId, provider: 'slack' },
      {
        $setOnInsert: { organizationId: req.organizationId, provider: 'slack' },
        $set: { state, status: 'pending' },
      },
      { upsert: true, new: true }
    );
 
    const authUrl = new URL('https://slack.com/oauth/v2/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', process.env.SLACK_CALLBACK_URL);
    // 'incoming-webhook' is the only bot scope needed for the MVP: posting
    // AI summaries into a single channel the admin picks during the Slack
    // OAuth consent screen. No chat:write / channels:read requested here.
    authUrl.searchParams.append('scope', 'incoming-webhook');
    authUrl.searchParams.append('state', state);
    res.json({ url: authUrl.toString() });
  }
);
 
// ---------------------------------------------------------------------------
// GET /api/integrations/slack/callback  (OAuth redirect from Slack)
// No authenticate/verifyTenantAccess here — mirrors /github/callback, since
// the browser is arriving fresh from Slack, not carrying an app session.
// The organisation is recovered from the Integration doc matched by `state`,
// never trusted from the request itself.
// ---------------------------------------------------------------------------
router.get('/slack/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state parameter.' });
  }
 
  const integration = await Integration.findOne({ provider: 'slack', state });
  if (!integration) return res.status(400).json({ error: 'Invalid or expired OAuth state.' });
 
  // Slack's oauth.v2.access endpoint expects application/x-www-form-urlencoded,
  // unlike GitHub's JSON body — this is a required deviation for Slack's API
  // to actually accept the exchange request, not a stylistic choice.
  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code: String(code),
      redirect_uri: process.env.SLACK_CALLBACK_URL,
    }),
  });
  const tokenData = await tokenRes.json();
 
  if (!tokenData.ok || !tokenData.incoming_webhook?.url) {
    console.error('[slack/callback] Slack OAuth error:', tokenData.error || 'unknown');
    return res.status(400).json({ error: 'Failed to exchange Slack code for a webhook.' });
  }
 
  const webhook = tokenData.incoming_webhook;
 
  // Reuses the same generic accessToken field GitHub stores its encrypted
  // token in — the Slack Incoming Webhook URL is the equivalent bearer
  // credential for this provider, so no new encryptedWebhookUrl field.
  integration.accessToken = encrypt(webhook.url);
  integration.slackChannelId = webhook.channel_id || null;
  integration.slackChannelName = webhook.channel || null;
  integration.slackTeamName = tokenData.team?.name || null;
  integration.status = 'active';
  integration.state = undefined; // consumed — prevents replay of this callback
  await integration.save();
 
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(
    `${frontendUrl}/workspace/${integration.organizationId}/integrations?connected=slack`
  );
});

router.get(
  '/slack/status',
  authenticate,
  verifyTenantAccess,
  async (req, res) => {
    try {
      const integration = await Integration.findOne({
        organizationId: req.organizationId,
        provider: 'slack',
        status: 'active',
      });
      if (integration) {
        return res.status(200).json({
          connected: true,
          teamName: integration.slackTeamName || null,
          channelName: integration.slackChannelName || null,
          channelId: integration.slackChannelId || null,
        });
      }
      return res.status(200).json({ connected: false });
    } catch (err) {
      console.error('[slack/status] error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);
router.post(
  '/slack/test',
  authenticate,
  verifyTenantAccess,
  requirePermission('manage_integrations'),
  async (req, res) => {
    const integration = await Integration.findOne({
      organizationId: req.organizationId,
      provider: 'slack',
      status: 'active',
    });
    if (!integration?.accessToken) {
      return res.status(404).json({ error: 'Slack not connected for this workspace.' });
    }
 
    try {
      const payload = buildTestMessagePayload();
      const slackRes = await slackWebhookRequest(integration, payload);
 
      if (!slackRes.ok) {
        console.error(`[slack/test] Slack webhook rejected the request: status=${slackRes.status}`);
        return res.status(502).json({ error: 'Slack rejected the test message. Please reconnect Slack.' });
      }
 
      return res.status(200).json({ success: true, message: 'Test message sent to Slack.' });
    } catch (err) {
      console.error('[slack/test] error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);
 
// ---------------------------------------------------------------------------
// POST /api/integrations/:provider/disable
// Shared generic deactivation for GitHub / Slack / Jira. Reuses the existing
// Integration.status field — flipping an active integration to `revoked` makes
// its matching /status endpoint return connected:false, so the connected UI
// turns off. This does NOT add or alter any OAuth wiring.
// ---------------------------------------------------------------------------
router.post(
  '/:provider/disable',
  authenticate,
  verifyTenantAccess,
  requirePermission('manage_integrations'),
  async (req, res) => {
    const provider = req.params.provider;
    if (!['github', 'slack', 'jira'].includes(provider)) {
      return res.status(400).json({ message: 'Provider not supported.' });
    }
    try {
      const integration = await Integration.findOne({
        organizationId: req.organizationId,
        provider,
        status: 'active',
      });
      if (!integration) {
        return res.status(200).json({
          disabled: false,
          message: 'No active connection to disable.',
        });
      }
      integration.status = 'revoked';
      await integration.save();
      return res.status(200).json({ disabled: true, provider });
    } catch (err) {
      console.error(`[${provider}/disable] error:`, err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);
 
// ---------------------------------------------------------------------------
// POST /api/webhooks/github  (also served via /api/integrations/github via server.js)
// Receives GitHub push and pull_request events.
// ---------------------------------------------------------------------------
router.post('/github', verifyWebhookSignature, (req, res) => {
  const event = req.headers['x-github-event'] || 'unknown';
  const payload = req.body;
  console.log(`[webhook/github] event=${event} repo=${payload?.repository?.full_name}`);
 
  if (event === 'push') {
    console.log(
      `[webhook/github] push ref=${payload.ref} commits=${(payload.commits || []).length}`
    );
  } else if (event === 'pull_request') {
    console.log(
      `[webhook/github] PR #${payload.pull_request?.number} action=${payload.action}`
    );
  } else if (event === 'ping') {
    return res.json({ ok: true, message: 'pong' });
  }
 
  res.status(200).json({ received: true, event });
});
 
// ---------------------------------------------------------------------------
// POST /api/webhooks/slack  (Slack events + URL verification)
// ---------------------------------------------------------------------------
router.post('/slack', (req, res) => {
  const body = req.body || {};
 
  // URL Verification challenge (Slack sends this when you first register the endpoint).
  if (body.type === 'url_verification') {
    console.log('[webhook/slack] URL verification challenge received.');
    return res.json({ challenge: body.challenge });
  }
 
  if (body.type === 'event_callback') {
    const eventType = body.event?.type || 'unknown';
    console.log(`[webhook/slack] event_callback type=${eventType}`);
 
    // Placeholder: route specific event types here.
    if (eventType === 'app_mention') {
      console.log('[webhook/slack] Bot was mentioned:', body.event?.text);
    } else if (eventType === 'message') {
      console.log('[webhook/slack] Message received in channel:', body.event?.channel);
    }
  }
 
  res.status(200).send('OK');
});
 
// ---------------------------------------------------------------------------
// POST /api/webhooks/jira  (Jira issue webhooks)
// ---------------------------------------------------------------------------
router.post('/jira', (req, res) => {
  const body = req.body || {};
  const webhookEvent = body.webhookEvent || 'unknown';
  const issueKey = body.issue?.key || 'N/A';
 
  console.log(`[webhook/jira] event=${webhookEvent} issue=${issueKey}`);
 
  if (webhookEvent === 'jira:issue_created') {
    console.log('[webhook/jira] New issue created:', issueKey, body.issue?.fields?.summary);
  } else if (webhookEvent === 'jira:issue_updated') {
    console.log('[webhook/jira] Issue updated:', issueKey, body.issue?.fields?.status?.name);
  }
 
  res.status(200).json({ received: true, event: webhookEvent, issue: issueKey });
});
 
// Slack legacy path /api/integrations/slack
router.post('/slack-events', (req, res) => {
  req.url = '/slack';
  router.handle(req, res, () => {});
});
 
module.exports = router;