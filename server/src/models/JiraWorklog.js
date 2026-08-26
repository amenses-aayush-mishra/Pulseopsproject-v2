const mongoose = require('mongoose');
const { Schema } = mongoose;

const jiraWorklogSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  jiraIssueId: { type: String, required: true },
  worklogId: { type: String, required: true },
  
  author: {
    accountId: String,
    displayName: String,
    emailAddress: String,
    avatarUrl: String,
  },
  
  timeSpentSeconds: { type: Number, required: true },
  comment: { type: String }, // Optional description
  
  started: { type: Date, required: true },
  created: { type: Date, required: true },
  updated: { type: Date, required: true },
}, { timestamps: true });

jiraWorklogSchema.index({ organizationId: 1, worklogId: 1 }, { unique: true });
jiraWorklogSchema.index({ organizationId: 1, jiraIssueId: 1, started: -1 });

module.exports = mongoose.model('JiraWorklog', jiraWorklogSchema);
