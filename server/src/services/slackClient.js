'use strict';
const { decrypt } = require('../utils/crypto');

/**
 * Shared Slack Incoming Webhook client.
 *
 * Mirrors the shape of services/githubClient.js: the caller passes the
 * organization's (provider: 'slack') Integration doc, this module decrypts
 * the stored webhook URL and performs the HTTP POST. There is exactly one
 * Slack-outbound implementation in the codebase.
 *
 * This module intentionally does NOT include queue/worker/retry logic —
 * that is out of scope for the current phase (see PulseOps Slack
 * Integration Guide, Phase 4+). It only wraps the raw HTTP call so the
 * OAuth-connect flow and any future caller (e.g. a test-message route,
 * or eventually a worker) share one place that knows how to decrypt and
 * POST to a Slack Incoming Webhook.
 *
 * @param {object} integration - Integration doc (provider 'slack') with
 *                               accessToken (encrypted at rest) holding the
 *                               Slack Incoming Webhook URL.
 * @param {object} payload     - Slack message payload. Must include a
 *                               `text` fallback field per Slack's
 *                               accessibility/notification requirements.
 * @returns {Promise<Response>}
 */
async function slackWebhookRequest(integration, payload) {
  const webhookUrl = decrypt(integration.accessToken);
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res;
}

// **
//  * Builds the Block Kit payload for the "Send Test Message" button
//  * (POST /api/integrations/slack/test). Includes the mandatory `text`
//  * fallback alongside `blocks`, per Slack's accessibility/notification
//  * requirements. Kept here (not inline in the route) so any future caller
//  * of a Slack message reuses the same payload-shaping convention.
//  *
//  * @returns {object} Slack Incoming Webhook payload.
//  */
function buildTestMessagePayload() {
  return {
    text: 'PulseOps is connected to this Slack channel. This is a test message.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: *PulseOps is connected!*\nThis is a test message confirming your Slack integration is working.chiithti ayi h',
        },
      },
      {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "This is a section block with a button."
      },
      "accessory": {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "Click Me",
          "emoji": true
        },
        "value": "click_me_123",
        "action_id": "button-action"
      }
    }
    ],
  };
}

// ---------------------------------------------------------------------------
// Slack Web API client (bot token based).
//
// The existing Slack connection stores an Incoming Webhook URL in
// `integration.accessToken`. To READ channel history / replies / users for the
// Communication module we additionally call the Slack Web API using the bot
// token captured during OAuth. The bot token is stored encrypted at rest on
// `integration.slackBotToken` and decrypted ONLY server-side — it is never
// sent to the browser.
// ---------------------------------------------------------------------------

const SLACK_API = 'https://slack.com/api';

/**
 * Perform an authenticated request against the Slack Web API using the bot
 * token stored on the (provider: 'slack') Integration doc.
 *
 * @param {string}     path - e.g. '/conversations.history'
 * @param {object}     integration - Integration doc with encrypted slackBotToken.
 * @param {object}     [options] - { method, body }
 * @returns {Promise<Response>}
 */
async function slackApiRequest(path, integration, options = {}) {
  const botToken = decrypt(integration.slackBotToken);
  if (!botToken) {
    throw new Error('No Slack bot token available for this integration.');
  }

  const method = options.method || 'GET';
  const headers = { Authorization: `Bearer ${botToken}` };

  // Some Slack Web API methods (e.g. conversations.join) require parameters in a
  // `application/x-www-form-urlencoded` POST body — they do NOT read them from the
  // query string and return `invalid_arguments` / "missing required field" if the
  // body is empty JSON. `options.form: true` encodes `options.body` as an
  // urlencoded body instead of JSON.
  let body;
  if (options.body != null) {
    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(options.body).toString();
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
  }

  return fetch(`${SLACK_API}${path}`, { method, headers, body });
}

/**
 * Fetch a Slack channel's message history.
 * https://api.slack.com/methods/conversations.history
 *
 * @returns {Promise<object>} parsed Slack response ({ ok, messages, response_metadata })
 */
async function fetchConversationHistory(integration, channelId, { limit = 60, cursor } = {}) {
  const params = new URLSearchParams({ channel: channelId, limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  const res = await slackApiRequest(`/conversations.history?${params.toString()}`, integration);
  if (!res.ok) {
    throw new Error(`Slack conversations.history failed: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch replies for a thread.
 * https://api.slack.com/methods/conversations.replies
 *
 * @returns {Promise<object>} parsed Slack response ({ ok, messages })
 */
async function fetchConversationReplies(integration, channelId, threadTs, { limit = 100 } = {}) {
  const params = new URLSearchParams({ channel: channelId, ts: threadTs, limit: String(limit) });
  const res = await slackApiRequest(`/conversations.replies?${params.toString()}`, integration);
  if (!res.ok) {
    throw new Error(`Slack conversations.replies failed: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch the workspace user directory (names + avatars) for enrichment.
 * https://api.slack.com/methods/users.list
 *
 * @returns {Promise<object>} parsed Slack response ({ ok, members })
 */
async function fetchUsersList(integration) {
  const res = await slackApiRequest('/users.list?limit=200', integration);
  if (!res.ok) {
    throw new Error(`Slack users.list failed: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Join the bot to a (public) Slack channel.
 * https://api.slack.com/methods/conversations.join
 *
 * The PulseOps bot must be a MEMBER of the connected channel before
 * conversations.history / chat.postMessage will succeed (otherwise Slack
 * returns `not_in_channel`). Joining best-effort at read/send time self-heals
 * membership for public channels without requiring a manual "add app" step.
 * Requires the `channels:join` bot scope.
 *
 * @returns {Promise<object>} parsed Slack response ({ ok, error?, channel? })
 */
async function conversationsJoin(integration, channelId) {
  if (!channelId) {
    return { ok: false, error: 'missing_channel_id' };
  }
  // conversations.join requires `channel` in the form-encoded POST body. Sending it
  // as a query string with an empty JSON body makes Slack return
  // `invalid_arguments` / "[ERROR] missing required field: channel".
  const res = await slackApiRequest(
    '/conversations.join',
    integration,
    { method: 'POST', body: { channel: channelId }, form: true }
  );
  if (!res.ok) {
    throw new Error(`Slack conversations.join failed: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Post a message to a Slack channel with the bot token.
 * https://api.slack.com/methods/chat.postMessage
 *
 * The incoming-webhook URL stored for the integration can be bound to a
 * different channel than the one PulseOps displays (webhooks ignore a `channel`
 * override and always post to their own bound channel). Posting with the bot
 * token to the integration's slackChannelId is reliable once the bot is a
 * member of the channel. Requires `chat:write` scope.
 *
 * @param {object} integration - Integration doc with encrypted slackBotToken.
 * @param {string} channelId   - The Slack channel id to post to.
 * @param {object} payload     - { text, blocks? } Slack message payload.
 * @returns {Promise<object>} parsed Slack response ({ ok, error?, ts? })
 */
async function postMessage(integration, channelId, payload = {}) {
  if (!channelId) {
    return { ok: false, error: 'missing_channel_id' };
  }
  const res = await slackApiRequest(
    '/chat.postMessage',
    integration,
    {
      method: 'POST',
      body: { channel: channelId, text: payload.text || '', blocks: payload.blocks },
    }
  );
  if (!res.ok) {
    throw new Error(`Slack chat.postMessage failed: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch a Slack-uploaded file (bytes + metadata) server-side using the bot token
 * and the file's Slack id via files.info (requires the `files:read` bot scope).
 *
 * Used by the Communication file proxy (GET /api/communication/files/:fileId).
 * The browser never talks to Slack's private URLs directly: the backend resolves
 * the file by id, downloads the actual bytes, and streams them to the caller.
 * File bytes are streamed and never stored.
 *
 * @param {object} integration - Integration doc with encrypted slackBotToken.
 * @param {string} fileId      - The Slack file id (e.g. "F0123ABC").
 * @returns {Promise<object>} Slack file metadata (name, mimetype, filetype) with
 *          a `response` property = the byte-streaming fetch Response.
 */
async function fetchSlackFile(integration, fileId) {
  if (!fileId) {
    throw new Error('Missing Slack file id.');
  }
  const infoRes = await slackApiRequest(`/files.info?file=${encodeURIComponent(fileId)}`, integration);
  const info = await infoRes.json();
  if (!info.ok || !info.file?.url_private) {
    throw new Error(`Slack files.info failed: ${info.error || 'no url_private available'}`);
  }

  const botToken = decrypt(integration.slackBotToken);
  if (!botToken) {
    throw new Error('No Slack bot token available for file access.');
  }
  const fileRes = await fetch(info.file.url_private, {
    headers: { Authorization: `Bearer ${botToken}` },
    redirect: 'follow',
  });
  if (!fileRes.ok) {
    throw new Error(`Slack file download failed: HTTP ${fileRes.status}`);
  }

  return { ...info.file, response: fileRes };
}

module.exports = {
  slackWebhookRequest,
  buildTestMessagePayload,
  slackApiRequest,
  fetchConversationHistory,
  fetchConversationReplies,
  fetchUsersList,
  conversationsJoin,
  postMessage,
  fetchSlackFile,
};