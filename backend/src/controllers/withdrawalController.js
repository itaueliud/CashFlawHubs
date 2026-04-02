const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { COUNTRIES } = require('../config/countries');
const { getCurrencyRate } = require('../services/exchangeService');
const logger = require('../utils/logger');

const Flutterwave = require('flutterwave-node-v3');
const getFlutterwaveClient = () => {
  if (!process.env.FLUTTERWAVE_PUBLIC_KEY || !process.env.FLUTTERWAVE_SECRET_KEY) {
    throw new Error('Flutterwave credentials are not configured');
  }

  return new Flutterwave(
    process.env.FLUTTERWAVE_PUBLIC_KEY,
    process.env.FLUTTERWAVE_SECRET_KEY
  );
};

// @POST /api/withdrawals/request
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amountUSD, phoneNumber } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Account must be activated to withdraw' });
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

      const tx = await Transaction.create([{
        userId: user._id,
        type: 'withdrawal',
        amountLocal: amountUSD * rate,
        amountUSD,
        currency: countryConfig.currency,
        country: user.country,
        provider: countryConfig.paymentProvider,
        direction: 'debit',
        status: 'pending',
        metadata: { phoneNumber: phoneNumber || user.phone },
      }], { session });

      await session.commitTransaction();

      res.json({
        success: true,
        message: 'Withdrawal request submitted. It will be included in the next Friday payout batch.',
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
    let transferRes;

    if (country === 'KE') {
      // M-Pesa B2C via Daraja
      transferRes = await mpesaB2C(phoneNumber, amountLocal, transactionId);
    } else {
      // Flutterwave transfer for all others
      const flw = getFlutterwaveClient();
      const networkMap = {
        UG: 'MTN', TZ: 'VODACOM', ET: 'TELEBIRR', GH: 'MTN', NG: 'MTN',
      };
      transferRes = await flw.Transfer.initiate({
        account_bank: networkMap[country] || 'MTN',
        account_number: phoneNumber.replace('+', ''),
        amount: amountLocal,
        currency: countryConfig.currency,
        reference: `WD-${transactionId}`,
        callback_url: `${process.env.BACKEND_URL}/api/withdrawals/flutterwave/callback`,
        debit_currency: countryConfig.currency,
      });
    }

    // Mark as successful
    await Transaction.findByIdAndUpdate(transactionId, {
      status: 'successful',
      providerTransactionId: transferRes?.data?.id || 'processed',
      processedAt: new Date(),
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

// M-Pesa B2C helper
const mpesaB2C = async (phone, amount, ref) => {
  const axios = require('axios');
  const tokenRes = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      auth: {
        username: process.env.MPESA_CONSUMER_KEY,
        password: process.env.MPESA_CONSUMER_SECRET,
      },
    }
  );

  return axios.post(
    'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
    {
      InitiatorName: 'CashflowConnect',
      SecurityCredential: process.env.MPESA_PASSKEY,
      CommandID: 'BusinessPayment',
      Amount: amount,
      PartyA: process.env.MPESA_SHORTCODE,
      PartyB: phone.replace('+', ''),
      Remarks: 'CashflowConnect Withdrawal',
      QueueTimeOutURL: `${process.env.BACKEND_URL}/api/payments/mpesa/timeout`,
      ResultURL: `${process.env.BACKEND_URL}/api/withdrawals/mpesa/callback`,
      Occasion: ref,
    },
    { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } }
  );
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
