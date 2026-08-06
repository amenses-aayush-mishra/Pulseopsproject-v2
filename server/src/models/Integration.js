const mongoose = require('mongoose');
const { Schema } = mongoose;

const integrationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  provider: { type: String, required: true, enum: ['github', 'slack', 'jira'] },
  status: { type: String, enum: ['active', 'revoked', 'pending'], default: 'pending' },
  accessToken: { type: String },
  refreshToken: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

integrationSchema.index({ organizationId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('Integration', integrationSchema);
