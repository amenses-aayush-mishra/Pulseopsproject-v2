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

module.exports = { slackWebhookRequest,buildTestMessagePayload };