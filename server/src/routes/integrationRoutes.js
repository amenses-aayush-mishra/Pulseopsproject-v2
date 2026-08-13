'use strict';
const crypto = require('crypto');
const express = require('express');
const { verifyWebhookSignature } = require('../middleware/verifyGithubWebhook');
const authenticate = require('../middleware/authenticate');
const verifyTenantAccess = require('../middleware/verifyTenantAccess');
const requirePermission = require('../middleware/requirePermission');
const { encrypt, decrypt } = require('../utils/crypto');
const Integration = require('../models/Integration');
const Repository = require('../models/Repository');

const GITHUB_API = 'https://api.github.com';

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: call GitHub API with the org's stored access token
// ---------------------------------------------------------------------------
async function githubRequest(path, integration, options = {}) {
  const token = decrypt(integration.accessToken);
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res;
}

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
