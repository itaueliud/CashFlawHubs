const mongoose = require('mongoose');

const broadcastCampaignSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  htmlMessage: { type: String, default: '' },
  channel: { type: String, enum: ['in_app', 'email', 'both'], default: 'in_app' },
  target: {
    scope: { type: String, enum: ['all', 'country', 'activated', 'balance', 'manual'], default: 'all' },
    countries: [{ type: String }],
    minBalance: { type: Number, default: null },
    activatedOnly: { type: Boolean, default: false },
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    userSearch: { type: String, default: '' },
  },
  scheduledFor: { type: Date, default: null, index: true },
  status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'], default: 'draft' },
  stats: {
    targeted: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
  },
  lastError: { type: String, default: '' },
  sentAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

broadcastCampaignSchema.index({ status: 1, scheduledFor: 1 });

module.exports = mongoose.model('BroadcastCampaign', broadcastCampaignSchema);
