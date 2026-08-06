const mongoose = require('mongoose');
const { Schema } = mongoose;

const pullRequestSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
  githubPrId: { type: Number, required: true },
  title: { type: String },
  state: { type: String, default: 'open' },
  mergedAt: { type: Date },
  createdAt: { type: Date },
}, { timestamps: true });

pullRequestSchema.index({ organizationId: 1, repositoryId: 1, githubPrId: 1 }, { unique: true });

module.exports = mongoose.model('PullRequest', pullRequestSchema);
