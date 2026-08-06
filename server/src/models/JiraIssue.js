const mongoose = require('mongoose');
const { Schema } = mongoose;

const jiraIssueSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  jiraIssueId: { type: String, required: true },
  summary: { type: String },
  status: { type: String },
  createdAt: { type: Date },
}, { timestamps: true });

jiraIssueSchema.index({ organizationId: 1, jiraIssueId: 1 }, { unique: true });

module.exports = mongoose.model('JiraIssue', jiraIssueSchema);
