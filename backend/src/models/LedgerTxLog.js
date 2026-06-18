const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ledgerTxLogSchema = new mongoose.Schema({
  logId: {
    type: String,
    unique: true,
    default: () => `CFH-TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
  },
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username:        { type: String },
  transactionType: {
    type: String,
    enum: ['payout', 'activation_fee', 'referral_credit', 'manual_adjustment', 'carry_over'],
    required: true,
  },
  amount:          { type: Number, required: true },
  currency:        { type: String, enum: ['USD', 'KES'], default: 'USD' },
  status:          { type: String, enum: ['success', 'failed', 'pending', 'reversed'], default: 'success' },
  processedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  processedAt:     { type: Date, default: Date.now },
  sourceModule:    { type: String, default: null },
  notes:           { type: String, default: null },
  ipAddress:       { type: String, default: null },
  beforeBalance:   { type: Number, default: null },
  afterBalance:    { type: Number, default: null },
  relatedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
}, { timestamps: true });

ledgerTxLogSchema.index({ userId: 1, processedAt: -1 });
ledgerTxLogSchema.index({ transactionType: 1 });
ledgerTxLogSchema.index({ processedBy: 1 });

module.exports = mongoose.model('LedgerTxLog', ledgerTxLogSchema);
