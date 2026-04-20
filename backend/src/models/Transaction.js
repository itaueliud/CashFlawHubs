const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['activation', 'withdrawal', 'referral_reward', 'survey', 'task', 'offer', 'challenge', 'freelance', 'token_purchase', 'job_posting', 'deposit'],
    required: true,
  },
  amountLocal: { type: Number, required: true },
  amountUSD: { type: Number, required: true },
  currency: { type: String, required: true },
  country: { type: String, required: true },
  provider: {
    type: String,
    enum: ['mpesa', 'mtn', 'vodacom', 'telebirr', 'flutterwave', 'paystack', 'internal', 'jenga', 'mtn_momo', 'tanzania_wallet', 'daraja'],
    required: true,
  },
  providerTransactionId: { type: String, default: null },
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed', 'reversed'],
    default: 'pending',
  },
  direction: { type: String, enum: ['credit', 'debit'], required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  failureReason: { type: String, default: null },
  processedAt: { type: Date, default: null },
}, {
  timestamps: true,
});

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ providerTransactionId: 1 });
transactionSchema.index({ 'metadata.payoutReference': 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
