const mongoose = require('mongoose');
const { Schema } = mongoose;

const organizationMemberSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
  status: { type: String, enum: ['active', 'pending', 'removed'], default: 'pending' },
  invitedEmail: { type: String, lowercase: true, trim: true },
  emailNotificationsEnabled: { type: Boolean, default: true },
}, { timestamps: true });

organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('OrganizationMember', organizationMemberSchema);
