const mongoose = require('mongoose');
const { Schema } = mongoose;

const activitySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  source: { type: String, required: true, enum: ['github', 'slack', 'jira'] },
  sourceId: { type: String, required: true },
  actor: { type: String, required: true },
  timestamp: { type: Date, required: true },
  type: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

activitySchema.index({ organizationId: 1, source: 1, sourceId: 1 });

module.exports = mongoose.model('Activity', activitySchema);