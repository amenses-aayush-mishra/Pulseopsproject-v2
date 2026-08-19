const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Temporary storage for an email/password signup in progress. No real User is
 * created until the email OTP is verified. Holds only the bcrypt passwordHash
 * (never the plaintext password) plus the OTP's SHA-256 hash + expiry (never
 * the plaintext OTP). One record per email; removed after successful
 * verification or superseded by a re-signup / resend.
 */
const pendingRegistrationSchema = new Schema(
  {
    name: { type: String, trim: true, default: '' },
    username: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    verificationTokenHash: { type: String, default: null },
    verificationTokenExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
