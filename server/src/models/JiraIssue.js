const mongoose = require('mongoose');
const { Schema } = mongoose;

const jiraIssueSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  // Core Jira fields
  jiraIssueId: { type: String, required: true, unique: true },
  issueKey: { type: String, required: true },
  summary: { type: String, required: true },
  description: { type: String },
  issueType: { type: String, required: true },
  status: { type: String, required: true },
  priority: { type: String },

  // Project info
  projectKey: { type: String, required: true },
  projectName: { type: String },

  // Users
  assignee: {
    accountId: String,
    displayName: String,
    emailAddress: String,
    avatarUrl: String,
  },
  reporter: {
    accountId: String,
    displayName: String,
    emailAddress: String,
  },

  // Timestamps
  created: { type: Date, required: true },
  updated: { type: Date, required: true },
  resolved: { type: Date },

  // Metadata
  labels: [{ type: String }],
  components: [{ type: String }],
  commentCount: { type: Number, default: 0 },
  timeEstimate: { type: Number },
  timeSpent: { type: Number },

  // Webhook tracking
  webhookEvent: { type: String },
  webhookTimestamp: { type: Date },

  // Sync metadata
  lastSyncAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes for performance
jiraIssueSchema.index({ organizationId: 1, projectKey: 1 });
jiraIssueSchema.index({ organizationId: 1, status: 1 });
jiraIssueSchema.index({ organizationId: 1, assignee: 1 });
jiraIssueSchema.index({ organizationId: 1, updated: -1 });

module.exports = mongoose.model('JiraIssue', jiraIssueSchema);
