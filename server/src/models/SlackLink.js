const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Persisted link-preview metadata for URLs shared inside Slack messages
 * (slack_links table).
 *
 * Only metadata is stored — never the fetched page bytes. `status` tracks the
 * preview lifecycle: 'pending' (job queued) -> 'ok' (metadata fetched) |
 * 'error' (fetch failed or URL blocked by the SSRF guard, see errorCode).
 */
const slackLinkSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    channelId: { type: String, required: true }, // Slack conversation id
    messageId: { type: String, required: true }, // Slack message ts that referenced the URL
    url: { type: String, required: true },
    normalizedUrl: { type: String, required: true },
    domain: { type: String, default: null }, // hostname only — used by the UI badge
    title: { type: String, default: null },
    description: { type: String, default: null },
    imageUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'ok', 'error'],
      default: 'pending',
    },
    errorCode: { type: String, default: null }, // e.g. 'ssrf_blocked', 'timeout', 'non_html'
    fetchedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

slackLinkSchema.index(
  { organizationId: 1, channelId: 1, messageId: 1, normalizedUrl: 1 },
  { unique: true }
);
slackLinkSchema.index({ organizationId: 1, channelId: 1, messageId: 1 });

module.exports = mongoose.model('SlackLink', slackLinkSchema);