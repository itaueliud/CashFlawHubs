const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'job_application',
        'job_reminder',
        'job_status',
        'new_application',
        'system',
        'withdrawal_success',
        'manual_payment',
        'activation_success',
        'account_suspended',
        'account_reactivated',
      ],
      default: 'system',
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    channel: { type: String, enum: ['in_app', 'email', 'sms'], default: 'in_app' },
    scheduledFor: { type: Date, default: null, index: true },
    sentAt: { type: Date, default: Date.now },
    readAt: { type: Date, default: null, index: true },
    dedupeKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
