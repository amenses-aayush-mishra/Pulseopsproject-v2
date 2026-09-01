const mongoose = require('mongoose');
const { Schema } = mongoose;

const jiraIssueSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  // Core Jira fields
  // NOTE: jiraIssueId is NOT globally unique — Jira IDs (e.g. "10001") are
  // scoped to an Atlassian site. Two PulseOps workspaces connecting the same
  // Atlassian account produce identical jiraIssueId values. The unique
  // constraint must therefore be (organizationId, jiraIssueId), not
  // jiraIssueId alone. See compound index below.
  jiraIssueId: { type: String, required: true },
  issueKey: { type: String, required: true },
  summary: { type: String, required: true },
  description: { type: String },
  // issueType is NOT required — Jira sub-tasks and epics may omit issuetype.name,
  // and a missing field must not abort the entire sync batch.
  issueType: { type: String },
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

// Primary workspace-scoped uniqueness: one document per (workspace, Jira issue).
// This replaces the previous globally-unique jiraIssueId index that caused
// E11000 duplicate key errors when the same Atlassian site is connected to
// multiple PulseOps workspaces.
jiraIssueSchema.index({ organizationId: 1, jiraIssueId: 1 }, { unique: true });

// Performance indexes
jiraIssueSchema.index({ organizationId: 1, projectKey: 1 });
jiraIssueSchema.index({ organizationId: 1, status: 1 });
jiraIssueSchema.index({ organizationId: 1, assignee: 1 });
jiraIssueSchema.index({ organizationId: 1, updated: -1 });

module.exports = mongoose.model('JiraIssue', jiraIssueSchema);
