const mongoose = require('mongoose');

const payoutRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  country: { type: String, default: 'ALL', trim: true },
  provider: { type: String, required: true, trim: true },
  minAmountUSD: { type: Number, default: 0 },
  maxAmountUSD: { type: Number, default: null },
  priority: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

payoutRuleSchema.index({ country: 1, provider: 1, active: 1 });
payoutRuleSchema.index({ priority: -1, createdAt: -1 });

module.exports = mongoose.model('PayoutRule', payoutRuleSchema);
