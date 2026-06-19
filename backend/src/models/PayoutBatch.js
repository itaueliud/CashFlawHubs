const mongoose = require('mongoose');

const payoutBatchItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userCode: { type: String, default: '' },
  reference: { type: String, default: '' },
  amountUSD: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  paymentMethod: { type: String, default: '' },
  provider: { type: String, default: '' },
  status: { type: String, default: 'queued' },
  note: { type: String, default: '' },
}, { _id: false });

const payoutBatchSchema = new mongoose.Schema({
  batchRef: { type: String, required: true, unique: true, index: true },
  source: { type: String, default: 'manual' },
  status: { type: String, enum: ['queued', 'processing', 'complete', 'failed'], default: 'complete' },
  items: { type: [payoutBatchItemSchema], default: [] },
  summary: {
    totalUSD: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    successful: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  executedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });

payoutBatchSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PayoutBatch', payoutBatchSchema);
