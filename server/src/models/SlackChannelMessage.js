'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * SlackChannelMessage — REAL Slack message persistence for the PulseOps
 * Communication module.
 *
 * This is intentionally a separate model from the existing `SlackMessage`
 * (which stores aggregated message COUNTS per period for AI summaries). This
 * model persists individual Slack messages so the Communication UI can render
 * the actual channel timeline.
 *
 * Critical relationship: every message is scoped to a PulseOps workspace via
 * `organizationId`, so messages never leak across workspaces.
 *
 * Deduplication: Slack may redeliver the same event more than once, and a
 * channel message or thread reply has a unique `ts`. The unique index on
 * { organizationId, channelId, messageTs } guarantees repeated deliveries /
 * re-fetches never create duplicate records.
 */
const slackChannelMessageSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    slackTeamId: { type: String, default: null },
    channelId: { type: String, required: true },
    // Slack's message identifier: a float string like "1620000000.000100".
    messageTs: { type: String, required: true },
    userId: { type: String, default: null },
    userName: { type: String, default: null },
    userAvatar: { type: String, default: null },
    text: { type: String, default: '' },
    // Set on thread replies (equals the parent message's ts, different from messageTs).
    threadTs: { type: String, default: null },
    isReply: { type: Boolean, default: false },
    replyCount: { type: Number, default: 0 },
    reactions: { type: Schema.Types.Mixed, default: [] },
    attachments: { type: Schema.Types.Mixed, default: [] },
    files: { type: Schema.Types.Mixed, default: [] },
    // Slack event_id from the Events API — stored for traceability/audit.
    eventId: { type: String, default: null },
    bot: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Dedup key — prevents duplicate records from re-delivered events / re-fetches.
slackChannelMessageSchema.index(
  { organizationId: 1, channelId: 1, messageTs: 1 },
  { unique: true }
);
// Efficient thread lookups (top-level messages of a thread + replies to it).
slackChannelMessageSchema.index({ organizationId: 1, channelId: 1, threadTs: 1 });

module.exports = mongoose.model('SlackChannelMessage', slackChannelMessageSchema);
