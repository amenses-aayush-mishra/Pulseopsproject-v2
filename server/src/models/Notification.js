'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Notification — one bell entry per user per relevant activity event.
 *
 * Fields:
 *   organizationId  – workspace the notification belongs to
 *   userId          – the recipient (OrganizationMember.userId)
 *   title           – short heading (e.g. "PR opened by priya")
 *   body            – optional detail text
 *   link            – client-side deep-link (e.g. "/workspace/:id/repositories")
 *   source          – 'github' | 'jira' | 'slack' | 'analytics'
 *   activityType    – the normalized Activity.type (e.g. 'pr_opened')
 *   read            – whether the user has dismissed this notification
 */
const notificationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:          { type: String, required: true },
    body:           { type: String, default: '' },
    link:           { type: String, default: '' },
    source:         { type: String, enum: ['github', 'jira', 'slack', 'analytics'], required: true },
    activityType:   { type: String, default: '' },
    read:           { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound index for fast unread-count queries
notificationSchema.index({ organizationId: 1, userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
