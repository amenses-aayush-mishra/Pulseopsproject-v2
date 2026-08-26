const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Mirrors a real Slack message (slack_messages table in the target schema).
 *
 * `messageId` is the Slack message timestamp (ts) — uniquely identifies a
 * message within a channel. `threadTs` is set when the message is a reply
 * inside a thread; replies are stored as their own documents so the channel
 * UI can render threads without denormalizing parent bodies.
 *
 * Soft-delete semantics: deleted messages keep their row (for analytics and
 * audit) but get `deletedAt` set so the UI can reflect the deletion. Edited
 * messages update in place with `editedAt` — never a second message.
 */
const slackChannelMessageSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    channelId: { type: String, required: true }, // Slack conversation id
    messageId: { type: String, required: true }, // Slack ts
    slackUserId: { type: String, default: null }, // may be null for bot/system messages
    userName: { type: String, default: null },
    userAvatar: { type: String, default: null },
    text: { type: String, default: '' },
    threadTs: { type: String, default: null, index: true },
    parentMessageId: { type: String, default: null }, // set for thread replies
    subtype: { type: String, default: null },
    messageType: {
      type: String,
      enum: ['message', 'file', 'system', 'bot'],
      default: 'message',
    },
    mentions: { type: [String], default: [] }, // Slack user ids mentioned
    reactions: { type: Schema.Types.Mixed, default: {} }, // name -> [{user, ts}]
    replyCount: { type: Number, default: 0 },
    threadLatestReply: { type: String, default: null },
    rawPayload: { type: Schema.Types.Mixed, default: null }, // AI-ready normalized payload
    syncSource: {
      type: String,
      enum: ['history', 'realtime'],
      default: 'history',
    },
    deletedAt: { type: Date, default: null },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique constraint that prevents duplicate records across repeated syncs and
// realtime events for the same logical Slack message.
slackChannelMessageSchema.index(
  { organizationId: 1, channelId: 1, messageId: 1 },
  { unique: true }
);
slackChannelMessageSchema.index({ organizationId: 1, channelId: 1, threadTs: 1 });
slackChannelMessageSchema.index({ organizationId: 1, channelId: 1, deletedAt: 1 });

module.exports = mongoose.model('SlackChannelMessage', slackChannelMessageSchema);