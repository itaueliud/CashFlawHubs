const mongoose = require('mongoose');

const paymentRailStateSchema = new mongoose.Schema({
  strategyId: { type: String, required: true, unique: true },
  isEnabled: { type: Boolean, default: true },
  disabledReason: { type: String, default: null },
  lastToggledAt: { type: Date, default: Date.now },
  lastToggledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('PaymentRailState', paymentRailStateSchema);
