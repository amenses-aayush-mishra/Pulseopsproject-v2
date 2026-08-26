const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Mirrors a Slack shared file/attachment (slack_attachments table).
 *
 * `fileCategory` drives the PulseOps channel renderer: image -> lightbox,
 * audio -> HTML5 player, video -> inline player, document -> download card.
 * `storageUrl` is the mirrored copy (local uploads dir by default; S3 when
 * the AWS SDK + S3_BUCKET env are configured). `slackPrivateUrl` is kept for
 * audit/backfill only and is never exposed to the frontend.
 */
const slackAttachmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    channelId: { type: String, required: true, index: true },
    messageId: { type: String, required: true }, // Slack message ts
    fileId: { type: String, required: true },
    fileName: { type: String, default: null },
    fileType: { type: String, default: null }, // mimetype
    fileCategory: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'other'],
      default: 'other',
    },
    fileSizeBytes: { type: Number, default: 0 },
    slackPrivateUrl: { type: String, default: null },
    storageUrl: { type: String, default: null },
  },
  { timestamps: true }
);

slackAttachmentSchema.index(
  { organizationId: 1, channelId: 1, fileId: 1 },
  { unique: true }
);
slackAttachmentSchema.index({ organizationId: 1, messageId: 1 });

module.exports = mongoose.model('SlackAttachment', slackAttachmentSchema);