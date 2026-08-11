const mongoose = require('mongoose');
const { Schema } = mongoose;

const aiSummarySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  type: { type: String, required: true, enum: ['weekly_summary', 'monthly_summary', 'quarterly_summary'] },
  periodStart: { type: Date, required: true },
  prompt: { type: String, required: true },
  summary: { type: String, required: true },
}, { timestamps: true });

aiSummarySchema.index({ organizationId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('AISummary', aiSummarySchema);