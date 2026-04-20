const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balanceUSD: { type: Number, default: 0, min: 0 }, // All stored in USD

  // Breakdown by source
  surveyEarnings: { type: Number, default: 0 },
  taskEarnings: { type: Number, default: 0 },
  offerEarnings: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 },
  freelanceEarnings: { type: Number, default: 0 },
  challengeEarnings: { type: Number, default: 0 },

  pendingBalance: { type: Number, default: 0 }, // Awaiting confirmation
  totalWithdrawn: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
}, {
  timestamps: true,
});

walletSchema.methods.credit = async function (amount, source) {
  this.balanceUSD += amount;
  this.totalEarned += amount;
  const sourceMap = {
    survey: 'surveyEarnings',
    task: 'taskEarnings',
    offer: 'offerEarnings',
    referral: 'referralEarnings',
    freelance: 'freelanceEarnings',
    challenge: 'challengeEarnings',
  };
  if (sourceMap[source]) {
    this[sourceMap[source]] += amount;
  }
  return this.save();
};

walletSchema.methods.debit = async function (amount) {
  if (this.balanceUSD < amount) throw new Error('Insufficient balance');
  this.balanceUSD -= amount;
  this.totalWithdrawn += amount;
  return this.save();
};

module.exports = mongoose.model('Wallet', walletSchema);
