const mongoose = require('mongoose');

const fraudAlertSchema = new mongoose.Schema({
  alertType: {
    type: String,
    enum: ['shared_ip', 'shared_device', 'brute_force', 'referral_fraud', 'fast_earn', 'chat_fraud'],
    required: true,
  },
  severity:        { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  relatedUserIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  relatedIPs:      [{ type: String }],
  description:     { type: String, required: true },
  status:          { type: String, enum: ['open', 'reviewed', 'dismissed', 'actioned'], default: 'open' },
  reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:      { type: Date, default: null },
  resolution:      { type: String, default: null },
  metadata:        { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

fraudAlertSchema.index({ status: 1, severity: -1 });

module.exports = mongoose.model('FraudAlert', fraudAlertSchema);
