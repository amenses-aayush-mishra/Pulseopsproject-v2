const mongoose = require('mongoose');
const { Schema } = mongoose;

const organizationSchema = new Schema({
name: { type: String, required: true, trim: true },
slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
teamSize: { type: String, required: true, enum: ['1-10', '11-50', '51-200', '200+'] },
primaryFocus: { type: String, required: true },
ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  themeSettings: {
    primaryColor: { type: String, default: '#4F46E5' },
    accentColor: { type: String, default: '#10B981' },
    sidebarBg: { type: String, default: '#1E293B' },
    darkMode: { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);