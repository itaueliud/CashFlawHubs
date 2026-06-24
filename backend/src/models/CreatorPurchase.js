const mongoose = require('mongoose');

const creatorPurchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorUpload', required: true },
  tokenAmount: { type: Number, default: 0 },
  amountUSD: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  country: { type: String, required: true },
  unlockedAt: { type: Date, default: Date.now },
}, { timestamps: true });

creatorPurchaseSchema.index({ userId: 1, uploadId: 1 }, { unique: true });

module.exports = mongoose.model('CreatorPurchase', creatorPurchaseSchema);
