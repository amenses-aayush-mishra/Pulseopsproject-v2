const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Slack Events API idempotency ledger (slack_events).
 *
 * Slack may retry delivery of the same event (event_id) — especially when our
 * webhook doesn't ack fast enough, or during transient network failures. The
 * unique (organizationId + eventId) index lets the webhook record an event
 * once and treat subsequent retries as no-ops, guaranteeing no duplicate
 * messages land in the database.
 */
const slackEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, default: '' },
    slackTeamId: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['received', 'processing', 'processed', 'error'],
      default: 'received',
    },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

slackEventSchema.index({ organizationId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('SlackEvent', slackEventSchema);