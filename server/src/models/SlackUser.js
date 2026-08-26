const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Cached Slack user profile (slack_users).
 *
 * Resolving a user via users.info on every message would hammer Slack's API.
 * Instead the sync pipeline upserts into this cache once per Slack user id and
 * reuses the row for every subsequent message in the same workspace. `email`
 * is intentionally nullable (Slack only exposes it with `users:read.email`).
 */
const slackUserSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: String, required: true }, // Slack user id (U…)
    slackTeamId: { type: String, default: null },
    displayName: { type: String, default: '' },
    realName: { type: String, default: '' },
    avatarUrl: { type: String, default: null },
    email: { type: String, default: null }, // null unless users:read.email granted
    isBot: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    refreshedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

slackUserSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('SlackUser', slackUserSchema);