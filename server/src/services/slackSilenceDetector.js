'use strict';

const Activity = require('../models/Activity');
const mongoose = require('mongoose');

/**
 * Checks Slack channel activity for an organization and creates a `channel_silence`
 * Activity record if silence threshold (e.g. 3 days) is met.
 *
 * @param {string} organizationId
 * @param {number} [silenceDays=3]
 * @returns {Promise<Object|null>} Activity doc created or null
 */
async function checkSlackChannelSilence(organizationId, silenceDays = 3) {
  try {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
    const cutoff = new Date(Date.now() - silenceDays * 24 * 60 * 60 * 1000);

    const recentActivity = await Activity.findOne({
      organizationId: orgObjectId,
      source: 'slack',
      timestamp: { $gte: cutoff },
    });

    if (!recentActivity) {
      // Create a channel silence activity signal
      const silenceActivity = await Activity.create({
        organizationId: orgObjectId,
        source: 'slack',
        sourceId: `silence_${organizationId}_${Date.now()}`,
        actor: 'system_monitor',
        timestamp: new Date(),
        type: 'channel_silence',
        metadata: {
          silenceDays,
          message: `No Slack activity detected in the last ${silenceDays} days.`,
        },
      });

      console.log(`[slackSilenceDetector] Logged channel_silence activity for org ${organizationId}`);
      return silenceActivity;
    }

    return null;
  } catch (err) {
    console.error('[slackSilenceDetector] Error checking silence:', err.message);
    return null;
  }
}

module.exports = { checkSlackChannelSilence };
