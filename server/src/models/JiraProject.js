const mongoose = require('mongoose');
const { Schema } = mongoose;

const jiraProjectSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  jiraCloudId: { type: String, required: true },
  projectId: { type: String, required: true }, // The Jira internal ID
  key: { type: String, required: true }, // e.g. KAN
  name: { type: String, required: true },
  projectTypeKey: { type: String },
  simplified: { type: Boolean },
  avatarUrl: { type: String },
  
  // Track sync state for this project
  lastSyncStartedAt: { type: Date },
  lastSyncCompletedAt: { type: Date },
  lastSyncError: { type: String },
  syncStatus: { type: String, enum: ['pending', 'syncing', 'synced', 'error'], default: 'pending' },
}, { timestamps: true });

jiraProjectSchema.index({ organizationId: 1, jiraCloudId: 1, projectId: 1 }, { unique: true });
jiraProjectSchema.index({ organizationId: 1, key: 1 });

module.exports = mongoose.model('JiraProject', jiraProjectSchema);
