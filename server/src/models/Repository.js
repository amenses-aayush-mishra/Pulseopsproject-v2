const mongoose = require('mongoose');
const { Schema } = mongoose;

const repositorySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true },
  githubRepoId: { type: String, required: true },
  webhookId: { type: String },
  defaultBranch: { type: String, default: 'main' },
  // TASK-108 — latest webhook delivery + commit observed on this repository.
  lastWebhookEvent: { type: String, default: null },
  lastWebhookAt: { type: Date, default: null },
  lastCommitSha: { type: String, default: null },
}, { timestamps: true });

repositorySchema.index({ organizationId: 1, githubRepoId: 1 }, { unique: true });

module.exports = mongoose.model('Repository', repositorySchema);