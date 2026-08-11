const mongoose = require('mongoose');
const { Schema } = mongoose;

const invitationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['owner', 'admin', 'techlead', 'developer'], default: 'developer' },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'expired'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);