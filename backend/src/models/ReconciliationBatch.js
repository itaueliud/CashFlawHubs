const mongoose = require('mongoose');

const reconciliationEntrySchema = new mongoose.Schema({
  reference: { type: String, required: true },
  provider: { type: String, default: '' },
  amountUSD: { type: Number, default: 0 },
  status: { type: String, default: '' },
  matched: { type: Boolean, default: false },
  matchedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  notes: { type: String, default: '' },
}, { _id: false });

const reconciliationBatchSchema = new mongoose.Schema({
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  source: { type: String, default: 'manual' },
  entries: { type: [reconciliationEntrySchema], default: [] },
  summary: {
    total: { type: Number, default: 0 },
    matched: { type: Number, default: 0 },
    unmatched: { type: Number, default: 0 },
    mismatchedAmount: { type: Number, default: 0 },
  },
}, { timestamps: true });

reconciliationBatchSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ReconciliationBatch', reconciliationBatchSchema);
