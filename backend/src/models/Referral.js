const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  newUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referralCode: { type: String, required: true },
  rewardAmountUSD: { type: Number, required: true },
  rewardAmountLocal: { type: Number },
  currency: { type: String },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  paidAt: { type: Date, default: null },
}, {
  timestamps: true,
});

referralSchema.index({ referrerUserId: 1 });
referralSchema.index({ newUserId: 1 });
referralSchema.index({ status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
