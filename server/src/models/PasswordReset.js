const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Dedicated storage for a password-reset in progress. Kept entirely separate
 * from signup verification (PendingRegistration) so password reset can never
 * interfere with email verification.
 *
 * Stores only hashes + expiries — never the plaintext OTP, reset token, or
 * password. One record per email (unique). After a successful reset the record
 * is deleted; a resend replaces the OTP (invalidating the previous one).
 */
const passwordResetSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    otpHash: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
