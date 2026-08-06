const mongoose = require('mongoose');
const { Schema } = mongoose;

const slackMessageSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  channelId: { type: String, required: true },
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  periodStart: { type: Date, required: true },
  messageCount: { type: Number, default: 0 },
}, { timestamps: true });

slackMessageSchema.index({ organizationId: 1, channelId: 1, userEmail: 1, periodStart: 1 }, { unique: true });

module.exports = mongoose.model('SlackMessage', slackMessageSchema);
