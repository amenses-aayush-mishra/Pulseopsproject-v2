const mongoose = require('mongoose');
const { Schema } = mongoose;

const jiraCommentSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  jiraIssueId: { type: String, required: true },
  commentId: { type: String, required: true },
  
  author: {
    accountId: String,
    displayName: String,
    emailAddress: String,
    avatarUrl: String,
  },
  
  body: { type: String }, // Can be markdown or ADF, we'll store as string
  
  created: { type: Date, required: true },
  updated: { type: Date, required: true },
}, { timestamps: true });

jiraCommentSchema.index({ organizationId: 1, commentId: 1 }, { unique: true });
jiraCommentSchema.index({ organizationId: 1, jiraIssueId: 1, created: 1 });

module.exports = mongoose.model('JiraComment', jiraCommentSchema);
