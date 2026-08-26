'use strict';
const crypto = require('crypto');
const express = require('express');
const { verifyWebhookSignature } = require('../middleware/verifyGithubWebhook');
const verifySlackWebhook = require('../middleware/verifySlackWebhook');
const authenticate = require('../middleware/authenticate');
const verifyTenantAccess = require('../middleware/verifyTenantAccess');
const requirePermission = require('../middleware/requirePermission');
const { encrypt } = require('../utils/crypto');
const { githubRequest } = require('../services/githubClient');
const Integration = require('../models/Integration');
const Repository = require('../models/Repository');
const SlackChannelMessage = require('../models/SlackChannelMessage');
const {
  slackWebhookRequest,
  buildTestMessagePayload,
  postMessage,
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
// Slack Events API persistence
// ---------------------------------------------------------------------------

/**
 * Map an incoming Slack `message` event to a PulseOps workspace + connected
 * channel, then persist it (deduplicated). Runner for the Events API webhook.
 * The GET /api/communication/messages route backfills user names/avatars from
 * users.list, so the webhook only stores what the event already carries.
 */
async function persistSlackEvent({ body, event }) {
  // The same Slack app can be connected to multiple PulseOps workspaces in the
  // same Slack team (one per channel). Because multiple active integrations can
  // share `slackTeamId`, resolve the correct one by matching the event's channel
  // first — otherwise a team_id-only findOne can return a different workspace's
  // integration and drop the message as "unrelated".
  const matches = await Integration.find({
    provider: 'slack',
    slackTeamId: body.team_id,
    status: 'active',
  });
  const integration = matches.find((i) => i.slackChannelId === event.channel) || matches[0] || null;
  if (!integration) {
    console.warn(`[webhook/slack] No active Slack integration for team ${body.team_id}`);
    return;
  }

  // Workspace isolation: only persist messages from THIS workspace's connected
  // channel — other channels in the same Slack team are ignored.
  if (event.channel !== integration.slackChannelId) {
    console.log(
      `[webhook/slack] Ignoring message in channel ${event.channel} (connected=${integration.slackChannelId})`
    );
    return;
  }

  // MVP: the timeline is history-driven, so edits/deletes are ignored rather
  // than applied incrementally.
  if (['message_deleted', 'message_changed'].includes(event.subtype)) {
    return;
  }

  const messageTs = event.ts;
  if (!messageTs) return;

  const userId = event.user || null;
  const bot = Boolean(event.bot_id);
  const threadTs = event.thread_ts || null;

  const doc = {
    organizationId: integration.organizationId,
    slackTeamId: integration.slackTeamId || null,
    channelId: event.channel,
    messageTs,
    userId,
    userName: bot
      ? event.username || event.bot_profile?.name || 'Slack bot'
      : userId || 'Unknown',
    // userAvatar is backfilled by GET /api/communication/messages (users.list).
    userAvatar: null,
    text: typeof event.text === 'string' ? event.text : '',
    threadTs,
    isReply: Boolean(threadTs && threadTs !== messageTs),
    replyCount: typeof event.reply_count === 'number' ? event.reply_count : 0,
    reactions: Array.isArray(event.reactions)
      ? event.reactions.map((r) => ({ name: r.name, count: r.count, users: r.users }))
      : [],
    attachments: Array.isArray(event.attachments) ? event.attachments : [],
    files: Array.isArray(event.files) ? event.files : [],
    bot,
    eventId: body.event_id || null,
  };

  try {
    await SlackChannelMessage.updateOne(
      { organizationId: integration.organizationId, channelId: event.channel, messageTs },
      { $set: doc },
      { upsert: true }
    );
  } catch (err) {
    // 11000 = duplicate key on a concurrent/redelivered event — already stored.
    if (err?.code !== 11000) console.error('[webhook/slack] persist error:', err.message);
  }
}

/** Shared Slack Events API handler (URL verification + event_callback). */
async function handleSlackWebhook(req, res) {
  try {
    const body = req.body || {};

    // URL Verification challenge (Slack sends this when registering the endpoint).
    if (body.type === 'url_verification') {
      console.log('[webhook/slack] URL verification challenge received.');
      return res.json({ challenge: body.challenge });
    }

    if (body.type === 'event_callback') {
      const event = body.event || {};
      const eventType = event.type || 'unknown';
      console.log(
        `[webhook/slack] event_callback type=${eventType} team=${body.team_id} channel=${event.channel}`
      );

      if (eventType === 'message' && event.channel && event.ts) {
        await persistSlackEvent({ body, event });
      } else if (eventType === 'app_mention') {
        console.log('[webhook/slack] Bot was mentioned:', event.text);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('[webhook/slack] handler error:', err.message);
    // Always ack Slack; persistence failures are logged, never surfaced to Slack.
    res.status(200).send('OK');
  }
}


// ---------------------------------------------------------------------------
// POST /api/webhooks/slack  (Slack events + URL verification)
// Incoming Slack Events API requests are cryptographically verified with the
// Slack Signing Secret before any event is processed (see verifySlackWebhook).
// ---------------------------------------------------------------------------
router.post('/slack', verifySlackWebhook, handleSlackWebhook);

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
// ---------------------------------------------------------------------------
// GET /api/integrations/slack/authorize
// Returns a Slack OAuth URL for the requesting organisation.
// Mirrors /github/connect: authenticate -> verifyTenantAccess ->
// requirePermission('manage_integrations'), random state stored on the
// org's Slack Integration document before redirecting.
//
// Scopes: the original MVP only needed `incoming-webhook` (posting AI
// summaries). The Communication module ALSO reads real channel history and
// user profile data, so the bot scopes below are requested — Slack returns an
// `access_token` (the bot token; stored encrypted as Integration.slackBotToken)
// alongside the incoming-webhook URL. This extends the SAME Slack connection; it
// does not create a second integration.
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
    // incoming-webhook keeps the existing "Send Test Message" live; the
    // channel/user read scopes enable the Communication message history.
    authUrl.searchParams.append(
      'scope',
      'incoming-webhook channels:history channels:read channels:join groups:history im:history mpim:history users:read files:read'
    );
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
  // New: bot token (encrypted) enables reading real channel history for the
  // Communication module + team id lets the Events API webhook map a Slack
  // team back to this PulseOps workspace. Existing (webhook-only) connections
  // simply leave these null until the workspace reconnects Slack.
  //
  // oauth.v2.access returns the bot token in the top-level `access_token`
  // field (token_type "bot") — there is NO `bot_token` field in the response.
  // Reading `access_token` is what actually populates slackBotToken so the
  // Communication page can fetch channel history.
  integration.slackBotToken = tokenData.access_token ? encrypt(tokenData.access_token) : null;
  integration.slackTeamId = tokenData.team?.id || null;
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
      // Prefer sending with the bot token to the integration's own channel. The
      // stored incoming webhook can be bound to a DIFFERENT channel than the
      // one PulseOps displays (webhooks ignore a `channel` override and always
      // post to their own bound channel), so chat.postMessage to slackChannelId
      // is the reliable path once the bot is a member (requires chat:write).
      let delivered = false;
      if (integration.slackBotToken && integration.slackChannelId) {
        try {
          const pm = await postMessage(integration, integration.slackChannelId, {
            text: payload.text,
            blocks: payload.blocks,
          });
          if (pm.ok) {
            delivered = true;
          } else {
            console.error(`[slack/test] chat.postMessage not ok:`, pm.error);
          }
        } catch (pmErr) {
          console.error('[slack/test] chat.postMessage error:', pmErr.message);
        }
      }

      // Fallback: legacy incoming-webhook path (webhook-only connections that
      // have no bot token). Slack Incoming Webhooks return HTTP 200 with a
      // plain-text body of `ok` on success but can return 2xx with a NON-"ok"
      // body on delivery failure — so verify the body too, not just res.ok.
      if (!delivered) {
        const slackRes = await slackWebhookRequest(integration, payload);
        const body = await slackRes.text();
        delivered = slackRes.ok && body.trim().toLowerCase() === 'ok';
        if (!delivered) {
          console.error(
            `[slack/test] Slack webhook rejected the request: status=${slackRes.status} body=${body}`
          );
        }
      }

      if (!delivered) {
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
router.post('/slack', verifySlackWebhook, handleSlackWebhook);
 
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