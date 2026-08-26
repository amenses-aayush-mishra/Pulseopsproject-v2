const mongoose = require('mongoose');
const { Schema } = mongoose;

const jiraWebhookEventSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  cloudId: { type: String }, // from webhook payload
  
  eventId: { type: String }, // Some events might not have a reliable ID, but we can generate one or use timestamp
  eventType: { type: String, required: true }, // e.g. jira:issue_updated
  
  payload: { type: Schema.Types.Mixed, required: true },
  
  status: { type: String, enum: ['pending', 'processing', 'completed', 'error'], default: 'pending' },
  
  error: { type: String },
  attempts: { type: Number, default: 0 },
  lastAttemptAt: { type: Date },
}, { timestamps: true });

// Ensure we process events in order
jiraWebhookEventSchema.index({ status: 1, createdAt: 1 });
jiraWebhookEventSchema.index({ organizationId: 1, eventType: 1, createdAt: -1 });

module.exports = mongoose.model('JiraWebhookEvent', jiraWebhookEventSchema);
