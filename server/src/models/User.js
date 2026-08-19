const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, trim: true, default: '' },
  // Required for email/password signups (enforced in the register route);
  // not schema-required so OAuth-created accounts remain valid.
  username: { type: String, trim: true },
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
// Usernames are unique among accounts that have one (OAuth users are excluded
// via sparse — they store no username). Enforced in-app + by this index.
userSchema.index({ username: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);