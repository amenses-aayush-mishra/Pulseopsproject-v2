const express = require('express');
const Activity = require('../../models/Activity');
const { normalizeSlack } = require('../../services/normalizers/slack');
const { verifySlackSignature } = require('../../middleware/verifySlackSignature');
const Integration = require('../../models/Integration');
const { createNotificationsForActivity } = require('../../services/notificationService');

const router = express.Router();

async function getOrganizationIdFromSlackTeam(teamId) {
  const integration = await Integration.findOne({
    slackTeamId: teamId,
    provider: 'slack',
    status: 'active'
  });
  return integration ? integration.organizationId : null;
}

async function slackHandler(req, res) {
  try {
    const body = req.body || {};

    // URL verification (Slack sends this when you first register the URL).
    if (body.type === 'url_verification') {
      // We still want to normalize and store this verification event
      const orgId = req.body.organizationId || req.query.orgId;
      if (!orgId) {
        // For URL verification, we might not have orgId yet, but we can still respond with challenge
        // However, for consistency, we'll try to get orgId from team_id if available
        const teamId = body.team_id;
        let resolvedOrgId = null;
        if (teamId) {
          resolvedOrgId = await getOrganizationIdFromSlackTeam(teamId);
        }
        if (!resolvedOrgId) {
          // If we still don't have orgId, we can't normalize, but we must still return challenge for Slack
          return res.json({ challenge: body.challenge });
        }
        // Normalize and store with resolved orgId
        const activity = normalizeSlack(req.body, resolvedOrgId);
        await Activity.create(activity);
        console.log(`✅ Slack URL verification stored: ${activity.type} for org ${resolvedOrgId}`);
        return res.json({ challenge: body.challenge });
      }

      // Normalize and store the URL verification event
      const activity = normalizeSlack(req.body, orgId);
      await Activity.create(activity);
      console.log(`✅ Slack URL verification stored: ${activity.type} for org ${orgId}`);
      return res.json({ challenge: body.challenge });
    }

    if (body.type !== 'event_callback') {
      // For non-event callbacks, we still respond OK but don't process
      return res.status(200).send('OK');
    }

    // Verify signature for event_callback
    if (!verifySlackSignature(req)) {
      console.warn('[slackWebhook] Signature verification failed.');
      return res.status(401).json({ error: 'Invalid Slack signature.' });
    }

    // Get organization from team_id in payload
    const teamId = body.team_id;
    if (!teamId) {
      return res.status(400).json({ error: 'Missing team_id in payload' });
    }

    const orgId = await getOrganizationIdFromSlackTeam(teamId);
    if (!orgId) {
      return res.status(400).json({ error: 'Slack workspace not tracked by any organization' });
    }

    // Normalize payload
    const activity = normalizeSlack(req.body, orgId);

    // Store in database
    const savedActivity = await Activity.create(activity);
    // Fire-and-forget notification fan-out
    createNotificationsForActivity(savedActivity).catch(() => {});

    console.log(`✅ Slack activity stored: ${savedActivity.type} for org ${orgId}`);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Slack webhook error:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message
    });
  }
}

// Handle both root and /events paths for compatibility
router.post('/', slackHandler);
router.post('/events', slackHandler);

module.exports = router;