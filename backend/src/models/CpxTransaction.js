const mongoose = require('mongoose');

const cpxTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cpxTransactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    surveyId:  { type: String, default: null },
    subid1:    { type: String, default: null },
    subid2:    { type: String, default: null },
    type:      { type: String, default: 'complete' }, // complete | screenout | bonus
    grossUSD:         { type: Number, required: true },
    userShareUSD:     { type: Number, required: true },
    xpAwarded:        { type: Number, default: 0 },
    platformShareUSD: { type: Number, required: true },
    referralShareUSD: { type: Number, default: 0 },
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'reversed', 'rejected'],
      default: 'pending',
      index: true,
    },
    availableAfter: { type: Date, required: true },
    ipAddress:      { type: String, default: null },
    rawParams:      { type: mongoose.Schema.Types.Mixed, default: {} },
    approvedAt:     { type: Date, default: null },
    paidAt:         { type: Date, default: null },
    reversedAt:     { type: Date, default: null },
  },
  { timestamps: true }
);

cpxTransactionSchema.index({ userId: 1, createdAt: -1 });
cpxTransactionSchema.index({ status: 1, availableAfter: 1 });

module.exports = mongoose.model('CpxTransaction', cpxTransactionSchema);
