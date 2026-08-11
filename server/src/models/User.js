const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, trim: true, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  personalEmail: { type: String, lowercase: true, trim: true },
  passwordHash: { type: String, default: null },
  googleId: { type: String, default: null },
  githubId: { type: String, default: null },
  mustChangePassword: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  verificationTokenHash: { type: String, default: null },
  verificationTokenExpires: { type: Date, default: null },
  activeOrganizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
  authProvider: { type: String, enum: ['credentials', 'google', 'github'], default: 'credentials' },
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
}, { timestamps: true });

userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ githubId: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);