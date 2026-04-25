const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

const spendTokens = async ({ userId, tokenAmount, action, metadata = {} }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    const error = new Error('Wallet not found');
    error.status = 404;
    throw error;
  }

  if (wallet.tokenBalance < tokenAmount) {
    const error = new Error('Insufficient tokens');
    error.status = 400;
    throw error;
  }

  wallet.tokenBalance -= tokenAmount;
  await wallet.save();

  await Transaction.create({
    userId,
    type: 'token_spend',
    amountLocal: tokenAmount,
    amountUSD: 0,
    currency: 'TOKEN',
    country: user.country,
    provider: 'internal',
    direction: 'debit',
    status: 'successful',
    processedAt: new Date(),
    metadata: {
      action,
      tokenAmount,
      ...metadata,
    },
  });

  return wallet;
};

module.exports = { spendTokens };
