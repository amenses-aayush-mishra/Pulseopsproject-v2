const mongoose = require('mongoose');
const { Schema } = mongoose;

const aiSummarySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  type: { type: String, required: true, enum: ['weekly_summary', 'monthly_summary', 'quarterly_summary'] },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  summary: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
  key_metrics: {
    prs_merged: { type: Number, required: true, default: 0 },
    prs_opened: { type: Number, required: true, default: 0 },
    active_developers: { type: Number, required: true, default: 0 },
    jira_issues_completed: { type: Number, required: true, default: 0 },
    jira_issues_created: { type: Number, required: true, default: 0 },
    slack_messages: { type: Number, required: true, default: 0 }
  },
  top_contributors: [{ type: String }],
  risks: [{ type: String }],
  recommendations: [{ type: String }]
}, { timestamps: true });

// Indexes optimized for the supported query patterns:
// 1. "Latest summary" + paginated list — always filtered by organizationId and
//    sorted by generatedAt descending (most recent first).
aiSummarySchema.index({ organizationId: 1, generatedAt: -1 });
// 2. Historical filtering by org + summary type (when the list is type-filtered).
aiSummarySchema.index({ organizationId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('AISummary', aiSummarySchema);
