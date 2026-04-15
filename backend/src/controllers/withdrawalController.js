const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { COUNTRIES } = require('../config/countries');
const { getCurrencyRate } = require('../services/exchangeService');
const paymentOrchestrator = require('../services/paymentOrchestrator');
const { publishToQueue, QUEUES } = require('../services/queueWorker');
const logger = require('../utils/logger');

const getEatDate = () => new Date(Date.now() + (3 * 60 * 60 * 1000));
const isFriday = () => getEatDate().getUTCDay() === 5;

const getWithdrawalCallbackUrl = (strategy) => {
  const base = process.env.BACKEND_URL;
  switch (strategy) {
    case 'jenga_mobile_wallet':
      return `${base}/api/payments/jenga/callback`;
    case 'mtn_momo_transfer':
      return `${base}/api/payments/mtn-momo/callback`;
    case 'telebirr_transfer':
      return `${base}/api/payments/telebirr/callback`;
    case 'tanzania_wallet_b2c':
      return `${base}/api/payments/tanzania-wallet/callback`;
    case 'daraja_b2c':
    default:
      return `${base}/api/payments/mpesa/callback`;
  }
};

// @POST /api/withdrawals/request
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amountUSD, phoneNumber, provider } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Account must be activated to withdraw' });
    }

    if (!isFriday()) {
      return res.status(403).json({ success: false, message: 'Withdrawals are only available on Fridays' });
    }

    const wallet = await Wallet.findOne({ userId: user._id });
    const countryConfig = COUNTRIES[user.country];

    // Convert min withdrawal to USD for comparison
    const rate = await getCurrencyRate(countryConfig.currency);
    const minWithdrawalUSD = countryConfig.minWithdrawal / rate;

    if (amountUSD < minWithdrawalUSD) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is ${countryConfig.minWithdrawal} ${countryConfig.currency}`,
      });
    }

    if (wallet.balanceUSD < amountUSD) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Lock funds immediately
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Wallet.findOneAndUpdate(
        { userId: user._id },
        { $inc: { balanceUSD: -amountUSD, pendingBalance: amountUSD } },
        { session }
      );

      const withdrawalStrategy = provider || countryConfig.paymentRouting?.withdrawals?.[0] || countryConfig.paymentProvider;
      const tx = await Transaction.create([{
        userId: user._id,
        type: 'withdrawal',
        amountLocal: amountUSD * rate,
        amountUSD,
        currency: countryConfig.currency,
        country: user.country,
        provider: countryConfig.paymentProvider === 'daraja' ? 'mpesa' : countryConfig.paymentProvider,
        direction: 'debit',
        status: 'pending',
        metadata: {
          phoneNumber: phoneNumber || user.phone,
          withdrawalStrategy,
          requestedProvider: provider || null,
        },
      }], { session });

      await session.commitTransaction();

      await publishToQueue(QUEUES.WITHDRAWAL_PROCESS, {
        transactionId: tx[0]._id.toString(),
        userId: user._id.toString(),
        amountUSD,
        phoneNumber: phoneNumber || user.phone,
        country: user.country,
        requestedProvider: provider || null,
      });

      res.json({
        success: true,
        message: 'Withdrawal request submitted and routed to the configured payout provider.',
        transactionId: tx[0]._id,
        amountLocal: (amountUSD * rate).toFixed(2),
        currency: countryConfig.currency,
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error(`requestWithdrawal error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Called by queue worker to actually disburse funds
exports.processWithdrawal = async ({ transactionId, userId, amountUSD, phoneNumber, country }) => {
  const countryConfig = COUNTRIES[country];
  const rate = await getCurrencyRate(countryConfig.currency);
  const amountLocal = Math.floor(amountUSD * rate);

  try {
    const user = await User.findById(userId);
    const transaction = await Transaction.findById(transactionId);
    if (!user || !transaction) {
      throw new Error('Withdrawal user or transaction not found');
    }

    const withdrawalReference = transaction.providerTransactionId || `WD-${transactionId}`;
    const requestedProvider = transaction.metadata?.requestedProvider || transaction.metadata?.withdrawalStrategy || null;
    const callbackUrl = getWithdrawalCallbackUrl(requestedProvider || countryConfig.paymentRouting?.withdrawals?.[0]);
    const transferRes = await paymentOrchestrator.initiateWithdrawal({
      country,
      requestedProvider,
      payload: {
        reference: withdrawalReference,
        amountLocal,
        amountUSD,
        currency: countryConfig.currency,
        callbackUrl,
        user: {
          id: user._id.toString(),
          name: user.name,
          phone: phoneNumber || user.phone,
          country: user.country,
          walletName: user.country === 'KE' ? 'Mpesa' : undefined,
        },
      },
    });

    // Mark as successful
    await Transaction.findByIdAndUpdate(transactionId, {
      status: 'successful',
      provider: transferRes?.provider || transaction.provider,
      providerTransactionId: transferRes?.providerTransactionId || withdrawalReference,
      processedAt: new Date(),
      metadata: {
        ...(transaction.metadata || {}),
        routedVia: transferRes?.strategy || requestedProvider || null,
        payoutResponse: transferRes?.raw || null,
      },
    });

    // Release pending balance
    await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { pendingBalance: -amountUSD, totalWithdrawn: amountUSD } }
    );

    logger.info(`Withdrawal processed: $${amountUSD} to ${phoneNumber} (${country})`);
  } catch (error) {
    logger.error(`processWithdrawal failed: ${error.message}`);

    // Reverse: put money back
    await Transaction.findByIdAndUpdate(transactionId, {
      status: 'failed',
      failureReason: error.message,
    });

    await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { balanceUSD: amountUSD, pendingBalance: -amountUSD } }
    );
  }
};

// @GET /api/withdrawals/history
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.user.id,
      type: 'withdrawal',
    }).sort({ createdAt: -1 }).limit(50);

    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
