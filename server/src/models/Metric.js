const mongoose = require('mongoose');
const { Schema } = mongoose;

const metricSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true },
  value: { type: Number, required: true },
  periodStart: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Metric', metricSchema);
