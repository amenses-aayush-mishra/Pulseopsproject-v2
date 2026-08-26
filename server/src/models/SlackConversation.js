const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Persisted Slack conversation metadata (slack_conversations).
 *
 * `conversationId` is Slack's authoritative channel/conversation identifier
 * (C… for channels/groups, D… for DMs, G… for group DMs) and is the primary
 * identity used everywhere in the pipeline — never the human-readable name.
 *
 * `syncStatus` tracks the real synchronization lifecycle:
 *   NOT_SYNCED -> SYNCING -> SYNCED | SYNC_ERROR
 * These are surfaced in the PulseOps integrations UI so "Connected" is never
 * shown as proof that message sync is working.
 */
const conversationType = Object.freeze({
  PUBLIC_CHANNEL: 'PUBLIC_CHANNEL',
  PRIVATE_CHANNEL: 'PRIVATE_CHANNEL',
  DIRECT_MESSAGE: 'DIRECT_MESSAGE',
  GROUP_DM: 'GROUP_DM',
});

const syncStatus = Object.freeze({
  NOT_SYNCED: 'NOT_SYNCED',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  SYNC_ERROR: 'SYNC_ERROR',
});

const slackConversationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    conversationId: { type: String, required: true },
    slackTeamId: { type: String, default: null },
    name: { type: String, default: '' },
    conversationType: {
      type: String,
      enum: Object.values(conversationType),
      default: conversationType.PUBLIC_CHANNEL,
    },
    isPrivate: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    isMember: { type: Boolean, default: true },
    isMpim: { type: Boolean, default: false },
    topic: { type: String, default: '' },
    purpose: { type: String, default: '' },
    memberCount: { type: Number, default: 0 },
    syncStatus: {
      type: String,
      enum: Object.values(syncStatus),
      default: syncStatus.NOT_SYNCED,
      index: true,
    },
    syncError: { type: String, default: null },
    syncErrorCode: { type: String, default: null }, // Slack API error code (not_in_channel, missing_scope, ...)
    messageCount: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: null },
    createdBy: { type: String, default: null }, // Slack creator id
  },
  { timestamps: true }
);

// Slack conversation ids are unique per workspace. This is the guard against
// duplicate discovery across repeated OAuth / sync runs.
slackConversationSchema.index(
  { organizationId: 1, conversationId: 1 },
  { unique: true }
);
slackConversationSchema.index({ organizationId: 1, syncStatus: 1 });

module.exports = mongoose.model('SlackConversation', slackConversationSchema);
module.exports.CONVERSATION_TYPE = conversationType;
module.exports.SYNC_STATUS = syncStatus;