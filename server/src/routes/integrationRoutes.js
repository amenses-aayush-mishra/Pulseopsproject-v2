'use strict';
const crypto = require('crypto');
const express = require('express');
const { verifyWebhookSignature } = require('../middleware/verifyGithubWebhook');
const authenticate = require('../middleware/authenticate');
const verifyTenantAccess = require('../middleware/verifyTenantAccess');
const requirePermission = require('../middleware/requirePermission');
const { encrypt } = require('../utils/crypto');
const { githubRequest } = require('../services/githubClient');
const { jiraRequest } = require('../services/jiraClient');
const Integration = require('../models/Integration');
const Repository = require('../models/Repository');
const JiraIssue = require('../models/JiraIssue');
const createRateLimiter = require('../middleware/rateLimiter');

const router = express.Router();
const jiraWebhookLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 100 });

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
// GET /api/integrations/jira/connect
// Returns a Jira Cloud 3LO OAuth URL for the requesting organisation.
// ---------------------------------------------------------------------------
router.get(
  '/jira/connect',
  authenticate,
  verifyTenantAccess,
  requirePermission('manage_integrations'),
  async (req, res) => {
    const clientId = process.env.JIRA_INTEGRATION_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: 'Jira OAuth is not configured on this server.' });
    }
    const state = crypto.randomBytes(20).toString('hex');
    await Integration.findOneAndUpdate(
      { organizationId: req.organizationId, provider: 'jira' },
      {
        $setOnInsert: { organizationId: req.organizationId, provider: 'jira' },
        $set: { state, status: 'pending' },
      },
      { upsert: true, new: true }
    );
    const callbackUrl =
      process.env.JIRA_CALLBACK_URL || 'http://localhost:5000/api/integrations/jira/callback';
    const authUrl = new URL('https://auth.atlassian.com/authorize');
    authUrl.searchParams.append('audience', 'api.atlassian.com');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('scope', 'read:jira-work write:jira-work offline_access');
    authUrl.searchParams.append('redirect_uri', callbackUrl);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('prompt', 'consent');
    res.json({ url: authUrl.toString() });
  }
);

// ---------------------------------------------------------------------------
// GET /api/integrations/jira/callback  (OAuth redirect from Atlassian)
// ---------------------------------------------------------------------------
router.get('/jira/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state parameter.' });
  }

  const integration = await Integration.findOne({ provider: 'jira', state });
  if (!integration) {
    return res.status(400).json({ error: 'Invalid or expired OAuth state.' });
  }

  const callbackUrl =
    process.env.JIRA_CALLBACK_URL || 'http://localhost:5000/api/integrations/jira/callback';

  const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.JIRA_INTEGRATION_CLIENT_ID,
      client_secret: process.env.JIRA_INTEGRATION_CLIENT_SECRET,
      code: String(code),
      redirect_uri: callbackUrl,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error('[jira/callback] Token exchange failed with status:', tokenRes.status);
    return res.status(400).json({ error: 'Failed to exchange Jira authorization code for tokens.' });
  }

  // Retrieve accessible Jira Cloud sites
  const resResources = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/json',
    },
  });

  const resources = await resResources.json();
  if (!resResources.ok || !Array.isArray(resources) || resources.length === 0) {
    return res.status(400).json({ error: 'No accessible Jira Cloud sites found for this authorization.' });
  }

  const site = resources[0];
  const webhookToken = integration.metadata?.webhookToken || crypto.randomBytes(32).toString('hex');

  integration.accessToken = encrypt(tokenData.access_token);
  if (tokenData.refresh_token) {
    integration.refreshToken = encrypt(tokenData.refresh_token);
  }

  integration.metadata = {
    ...(integration.metadata || {}),
    cloudId: site.id,
    siteUrl: site.url,
    siteName: site.name,
    webhookToken,
    expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
  };
  integration.status = 'active';
  integration.state = undefined; // clear consumed state
  await integration.save();

  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  res.redirect(
    `${frontendUrl}/workspace/${integration.organizationId}/integrations?connected=jira`
  );
});

// ---------------------------------------------------------------------------
// GET /api/integrations/jira/status
// Returns the connection status of Jira for the workspace.
// ---------------------------------------------------------------------------
router.get(
  '/jira/status',
  authenticate,
  verifyTenantAccess,
  async (req, res) => {
    try {
      const integration = await Integration.findOne({
        organizationId: req.organizationId,
        provider: 'jira',
        status: 'active',
      });
      if (integration) {
        const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:5000';
        const webhookToken = integration.metadata?.webhookToken;
        const webhookUrl = webhookToken
          ? `${backendUrl}/api/webhooks/jira/${integration._id}/${webhookToken}`
          : `${backendUrl}/api/webhooks/jira`;

        return res.status(200).json({
          connected: true,
          siteName: integration.metadata?.siteName || 'Jira Cloud',
          siteUrl: integration.metadata?.siteUrl || null,
          integrationId: integration._id,
          webhookUrl,
        });
      }
      return res.status(200).json({ connected: false });
    } catch (err) {
      console.error('[jira/status] error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/integrations/jira/projects
// Fetches projects for the connected Jira Cloud site.
// ---------------------------------------------------------------------------
router.get(
  '/jira/projects',
  authenticate,
  verifyTenantAccess,
  requirePermission('manage_integrations'),
  async (req, res) => {
    const integration = await Integration.findOne({
      organizationId: req.organizationId,
      provider: 'jira',
      status: 'active',
    });
    if (!integration?.accessToken) {
      return res.status(404).json({ error: 'Jira not connected for this workspace.' });
    }

    try {
      const jiraRes = await jiraRequest('/rest/api/3/project/search', integration);
      if (!jiraRes.ok) {
        const errText = await jiraRes.text();
        console.error('[jira/projects] Jira API error:', jiraRes.status, errText);
        return res.status(jiraRes.status).json({ error: 'Failed to fetch Jira projects.' });
      }
      const data = await jiraRes.json();
      const projects = (data.values || data || []).map((p) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        projectTypeKey: p.projectTypeKey,
        avatarUrl: p.avatarUrls?.['48x48'] || null,
      }));
      return res.json(projects);
    } catch (err) {
      console.error('[jira/projects] error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/integrations/jira/sync
// Sync issues from selected Jira projects into PulseOps JiraIssue collection.
// ---------------------------------------------------------------------------
router.post(
  '/jira/sync',
  authenticate,
  verifyTenantAccess,
  requirePermission('manage_integrations'),
  async (req, res) => {
    const integration = await Integration.findOne({
      organizationId: req.organizationId,
      provider: 'jira',
      status: 'active',
    });
    if (!integration?.accessToken) {
      return res.status(404).json({ error: 'Jira not connected for this workspace.' });
    }

    const projectKeys = Array.isArray(req.body?.projectKeys) ? req.body.projectKeys : [];
    if (projectKeys.length === 0) {
      return res.status(400).json({ error: 'No Jira projects selected for sync.' });
    }

    try {
      const escapedKeys = projectKeys.map((k) => `"${k.replace(/"/g, '\\"')}"`).join(', ');
      const jql = `project IN (${escapedKeys}) ORDER BY updated DESC`;
      const jiraRes = await jiraRequest(
        `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100`,
        integration
      );

      if (!jiraRes.ok) {
        const errData = await jiraRes.text();
        console.error('[jira/sync] Jira search API error:', jiraRes.status, errData);
        return res.status(jiraRes.status).json({ error: 'Failed to search Jira issues.' });
      }

      const searchData = await jiraRes.json();
      const issues = searchData.issues || [];

      const syncedResults = [];
      for (const issue of issues) {
        const issueId = String(issue.id);
        const jiraKey = issue.key;
        const summary = issue.fields?.summary || '';
        const status = issue.fields?.status?.name || 'Unknown';
        const issueType = issue.fields?.issuetype?.name || null;
        const priority = issue.fields?.priority?.name || null;
        const assignee = issue.fields?.assignee?.displayName || null;
        const projectKey = issue.fields?.project?.key || null;
        const siteUrl = integration.metadata?.siteUrl;
        const issueUrl = siteUrl && jiraKey ? `${siteUrl}/browse/${jiraKey}` : null;
        const createdAt = issue.fields?.created ? new Date(issue.fields.created) : new Date();

        await JiraIssue.findOneAndUpdate(
          { organizationId: req.organizationId, jiraIssueId: issueId },
          {
            $set: {
              jiraKey,
              projectKey,
              summary,
              status,
              issueType,
              priority,
              assignee,
              url: issueUrl,
              createdAt,
            },
          },
          { upsert: true }
        );
        syncedResults.push({ issueId, jiraKey });
      }

      return res.json({ success: true, syncedCount: syncedResults.length });
    } catch (err) {
      console.error('[jira/sync] error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/webhooks/jira/:integrationId/:webhookToken (Secure Webhook Path)
// ---------------------------------------------------------------------------
router.post('/jira/:integrationId/:webhookToken', jiraWebhookLimiter, async (req, res) => {
  const { integrationId, webhookToken } = req.params;
  const body = req.body || {};
  const webhookEvent = body.webhookEvent || 'unknown';

  try {
    const integration = await Integration.findById(integrationId);
    if (
      !integration ||
      integration.provider !== 'jira' ||
      !integration.metadata?.webhookToken ||
      integration.metadata.webhookToken !== webhookToken
    ) {
      return res.status(401).json({ error: 'Invalid or unauthorized webhook token.' });
    }

    const orgId = integration.organizationId;
    const issue = body.issue;
    const issueKey = issue?.key || 'N/A';

    integration.lastWebhookEvent = webhookEvent;
    integration.lastWebhookAt = new Date();
    integration.lastWebhookId = issue?.id ? String(issue.id) : null;
    await integration.save();

    if (issue?.id) {
      const siteUrl = integration.metadata?.siteUrl;
      await JiraIssue.findOneAndUpdate(
        { organizationId: orgId, jiraIssueId: String(issue.id) },
        {
          $set: {
            jiraKey: issue.key,
            projectKey: issue.fields?.project?.key,
            summary: issue.fields?.summary || '',
            status: issue.fields?.status?.name || 'Unknown',
            issueType: issue.fields?.issuetype?.name || null,
            priority: issue.fields?.priority?.name || null,
            assignee: issue.fields?.assignee?.displayName || null,
            url: siteUrl && issue.key ? `${siteUrl}/browse/${issue.key}` : null,
            createdAt: issue.fields?.created ? new Date(issue.fields.created) : new Date(),
          },
        },
        { upsert: true }
      );
    }

    console.log(`[webhook/jira] org=${orgId} event=${webhookEvent} issue=${issueKey}`);
    return res.status(200).json({ received: true, event: webhookEvent, issue: issueKey });
  } catch (err) {
    console.error('[webhook/jira] Error processing webhook:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/jira  (Legacy Jira issue webhooks)
// ---------------------------------------------------------------------------
router.post('/jira', jiraWebhookLimiter, (req, res) => {
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
