const mongoose = require('mongoose');
const { Schema } = mongoose;

const aiSummarySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  periodStart: { type: Date, required: true },
  prompt: { type: String, required: true },
  summary: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('AISummary', aiSummarySchema);
