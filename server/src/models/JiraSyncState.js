const mongoose = require('mongoose');
const { Schema } = mongoose;

const jiraSyncStateSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  jiraCloudId: { type: String, required: true },
  projectKey: { type: String, required: true },
  
  // High level status
  status: { type: String, enum: ['pending', 'syncing', 'synced', 'error'], default: 'pending' },
  
  // Last successful full sync completion
  lastSyncCompletedAt: { type: Date },
  
  // For paginated sync
  nextPageToken: { type: String },
  
  // Counters for visibility
  issuesSynced: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },   // issues that failed to upsert in this run
  commentsSynced: { type: Number, default: 0 },
  worklogsSynced: { type: Number, default: 0 },
  attachmentsSynced: { type: Number, default: 0 },
  
  lastError: { type: String },
  lastErrorAt: { type: Date },
}, { timestamps: true });

jiraSyncStateSchema.index({ organizationId: 1, jiraCloudId: 1, projectKey: 1 }, { unique: true });

module.exports = mongoose.model('JiraSyncState', jiraSyncStateSchema);
