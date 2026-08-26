const mongoose = require('mongoose');
const { Schema } = mongoose;

const jiraAttachmentSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  jiraIssueId: { type: String, required: true },
  attachmentId: { type: String, required: true },
  
  author: {
    accountId: String,
    displayName: String,
    emailAddress: String,
    avatarUrl: String,
  },
  
  filename: { type: String, required: true },
  mimeType: { type: String },
  sizeBytes: { type: Number },
  contentUrl: { type: String }, // Jira download URL
  
  created: { type: Date, required: true },
}, { timestamps: true });

jiraAttachmentSchema.index({ organizationId: 1, attachmentId: 1 }, { unique: true });
jiraAttachmentSchema.index({ organizationId: 1, jiraIssueId: 1, created: 1 });

module.exports = mongoose.model('JiraAttachment', jiraAttachmentSchema);
