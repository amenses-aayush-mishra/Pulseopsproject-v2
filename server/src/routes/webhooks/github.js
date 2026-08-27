const express = require('express');
const Activity = require('../../models/Activity');
const { normalizeGithub } = require('../../services/normalizers/github');
const { verifyGithubWebhook } = require('../../middleware/verifyGithubWebhook');
const Integration = require('../../models/Integration');
const { createNotificationsForActivity } = require('../../services/notificationService');

const router = express.Router();

// Helper to get organization from repository
async function getOrganizationIdFromRepo(repoId) {
  if (!repoId) return null;
  // Find integration that has this repository in its metadata
  const integration = await Integration.findOne({
    'metadata.repositories.id': repoId.toString(),
    provider: 'github',
    status: 'active'
  });

  return integration ? integration.organizationId : null;
}

// Mounted by webhooks/index.js at /github -> full path /api/webhooks/github.
// Signature is verified via middleware over the raw body captured by the
// app-level express.json({ verify }) callback.
router.post('/', verifyGithubWebhook, async (req, res) => {
  try {
    const payload = req.body;

    // Require a valid JSON object payload.
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Get organization from repository (normal flow)
    let orgId = await getOrganizationIdFromRepo(payload.repository?.id);

    // Fallback for testing: allow x-test-org-id header or orgId query param
    // This enables manual testing without pre-configured GitHub Integration
    if (!orgId) {
      const testOrgId = req.headers['x-test-org-id'] || req.query.orgId;
      if (testOrgId) {
        // Validate it's a valid ObjectId format
        if (/^[0-9a-fA-F]{24}$/.test(testOrgId)) {
          orgId = testOrgId;
          console.log(`🧪 Using test organization ID: ${orgId}`);
        } else {
          console.warn(`⚠️ Invalid test orgId format: ${testOrgId}`);
        }
      }
    }

    if (!orgId) {
      return res.status(200).json({
        message: 'Repository not tracked by any organization. Add Integration or use x-test-org-id header for testing.'
      });
    }

    // Normalize payload
    const activity = normalizeGithub(payload, orgId);

    // Store in database
    const saved = await Activity.create(activity);
    // Fire-and-forget notification fan-out (does NOT block the response)
    createNotificationsForActivity(saved).catch(() => {});

    console.log(`✅ GitHub activity stored: ${saved.type} for org ${orgId}`);

    res.status(200).json({
      received: true,
      activityId: saved._id
    });
  } catch (error) {
    console.error('❌ GitHub webhook error:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message
    });
  }
});

module.exports = router;