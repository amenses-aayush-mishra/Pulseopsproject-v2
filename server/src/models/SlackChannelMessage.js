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
 * { organizationId, channelId, messageId } guarantees repeated deliveries /
 * re-fetches never create duplicate records.
 */
const slackChannelMessageSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  slackTeamId: { type: String, default: null },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },        // from feature (Slack ts)
  messageTs: { type: String, required: true },        // from main (alias for messageId)
  userId: { type: String, default: null },            // from main
  slackUserId: { type: String, default: null },       // from feature (more explicit)
  userName: { type: String, default: null },
  userAvatar: { type: String, default: null },
  text: { type: String, default: '' },
  threadTs: { type: String, default: null, index: true },
  parentMessageId: { type: String, default: null },   // from feature
  isReply: { type: Boolean, default: false },         // from main
  subtype: { type: String, default: null },           // from feature
  messageType: { type: String, enum: ['message', 'file', 'system', 'bot'], default: 'message' }, // from feature
  mentions: { type: [String], default: [] },          // from feature
  reactions: { type: Schema.Types.Mixed, default: [] }, // from main (array format)
  replyCount: { type: Number, default: 0 },
  threadLatestReply: { type: String, default: null }, // from feature
  rawPayload: { type: Schema.Types.Mixed, default: null }, // from feature (AI-ready)
  syncSource: { type: String, enum: ['history', 'realtime'], default: 'history' }, // from feature
  attachments: { type: Schema.Types.Mixed, default: [] },
  files: { type: Schema.Types.Mixed, default: [] },
  eventId: { type: String, default: null },           // from main
  bot: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },           // from feature
  editedAt: { type: Date, default: null },            // from feature
}, { timestamps: true });

// Indexes - combine both
slackChannelMessageSchema.index({ organizationId: 1, channelId: 1, messageId: 1 }, { unique: true });
slackChannelMessageSchema.index({ organizationId: 1, channelId: 1, messageTs: 1 }, { unique: true }); // main's dedup key
slackChannelMessageSchema.index({ organizationId: 1, channelId: 1, threadTs: 1 });
slackChannelMessageSchema.index({ organizationId: 1, channelId: 1, deletedAt: 1 });

module.exports = mongoose.model('SlackChannelMessage', slackChannelMessageSchema);
