const mongoose = require('mongoose');
const { Schema } = mongoose;

const repositorySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true },
  githubRepoId: { type: String, required: true, unique: true },
  webhookId: { type: String },
  defaultBranch: { type: String, default: 'main' },
}, { timestamps: true });

module.exports = mongoose.model('Repository', repositorySchema);
