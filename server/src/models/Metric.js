const mongoose = require('mongoose');
const { Schema } = mongoose;

const metricSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  metricType: { type: String, required: true, enum: ['prs_opened', 'prs_merged', 'active_developers', 'jira_issue_count', 'slack_activity'] },
  value: { type: Number, required: true },
  scopeType: { type: String, required: true, enum: ['organization', 'repository', 'member'], default: 'organization' },
  scopeId: { type: String, default: null },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  computedAt: { type: Date, default: Date.now },
}, { timestamps: true });

metricSchema.index(
  { organizationId: 1, metricType: 1, scopeType: 1, scopeId: 1, periodStart: 1 },
  { unique: true }
);

module.exports = mongoose.model('Metric', metricSchema);