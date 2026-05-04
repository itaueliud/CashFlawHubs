const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Referral = require('../models/Referral');
const Transaction = require('../models/Transaction');
const { COUNTRIES } = require('../config/countries');
const { HYBRID_PAYMENT_STACK } = require('../config/paymentStack');
const { TOKEN_PACKAGES, getTokenPackage } = require('../config/monetization');
const { getCurrencyRate } = require('../services/exchangeService');
const paymentOrchestrator = require('../services/paymentOrchestrator');
const { publishToQueue } = require('../services/queueWorker');
const logger = require('../utils/logger');
const { isActivationTestWindowEnabled, isUserActivated } = require('../utils/activationWindow');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_COLLECTION_CURRENCY = {
  KE: 'KES',
  UG: 'USD',
  TZ: 'USD',
  ET: 'USD',
  GH: 'GHS',
  NG: 'NGN',
};

const PAYSTACK_TRANSFER_RECIPIENTS = {
  KE: {
    type: 'mobile_money',
    currency: 'KES',
    bankCodeEnv: 'PAYSTACK_TRANSFER_BANK_CODE_KE',
  },
  GH: {
    type: 'mobile_money',
    currency: 'GHS',
    bankCodeEnv: 'PAYSTACK_TRANSFER_BANK_CODE_GH',
  },
};

const FRONTEND_PAYMENT_PATHS = {
  activation: '/activation/callback',
  token_purchase: '/dashboard/wallet/callback',
  deposit: '/dashboard/wallet/callback',
};

const useDarajaForKenya = () => String(process.env.USE_DARAJA).toLowerCase() === 'true';
const getDarajaEnv = () => String(process.env.DARAJA_ENV || process.env.MPESA_ENV || process.env.NODE_ENV || 'sandbox').toLowerCase();
const isDarajaLive = () => ['live', 'production'].includes(getDarajaEnv());
const getMpesaCallbackUrl = () =>
  process.env.DARAJA_CALLBACK_URL ||
  process.env.MPESA_CALLBACK_URL ||
  `${process.env.BACKEND_URL}/api/payments/mpesa/callback`;

const getPaystackHeaders = () => {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack secret key is not configured');
  }

  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
};

const buildReference = (prefix, seed) => (
  `${prefix}-${seed}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
);

const isSuccessfulChargeStatus = (status) => ['success', 'successful'].includes(String(status).toLowerCase());

const normalizePhoneNumber = (phone = '') => phone.replace(/[^\d]/g, '');

const getCollectionCurrency = (country) => PAYSTACK_COLLECTION_CURRENCY[country] || 'USD';

const getTransferRecipientConfig = (country) => PAYSTACK_TRANSFER_RECIPIENTS[country] || null;

const verifyPaystackSignature = (req) => {
  const signature = req.headers['x-paystack-signature'];
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return signature === expectedSignature;
};

const initializePaystackPayment = async ({ amount, email, currency, reference, metadata }) => {
  const res = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      amount: Math.round(amount * 100),
      email,
      currency,
      reference,
      metadata,
      callback_url: `${process.env.FRONTEND_URL}/activation/callback`,
    },
    { headers: getPaystackHeaders() }
  );

  return res.data.data;
};

const getFrontendReturnUrl = (type, reference) => (
  `${process.env.FRONTEND_URL}${FRONTEND_PAYMENT_PATHS[type]}?reference=${encodeURIComponent(reference)}`
);

const verifyPaystackTransaction = async (reference) => {
  const res = await axios.get(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: getPaystackHeaders() }
  );

  return res.data.data;
};

const createPaystackTransferRecipient = async (user) => {
  const config = getTransferRecipientConfig(user.country);
  if (!config) {
    throw new Error(`Paystack bulk transfer is not configured for ${user.country}`);
  }

  const bankCode = process.env[config.bankCodeEnv];
  if (!bankCode) {
    throw new Error(`Missing ${config.bankCodeEnv} for ${user.country} payouts`);
  }

  const res = await axios.post(
    `${PAYSTACK_BASE_URL}/transferrecipient`,
    {
      type: config.type,
      name: user.name,
      account_number: normalizePhoneNumber(user.phone),
      bank_code: bankCode,
      currency: config.currency,
      metadata: {
        userId: user._id.toString(),
        country: user.country,
        phone: user.phone,
      },
    },
    { headers: getPaystackHeaders() }
  );

  return res.data.data;
};

const initiatePaystackBulkTransfer = async (transfers) => {
  const res = await axios.post(
    `${PAYSTACK_BASE_URL}/transfer/bulk`,
    {
      source: 'balance',
      transfers,
    },
    { headers: getPaystackHeaders() }
  );

  return res.data.data;
};

const localToUSD = async (amount, currency) => {
  if (currency === 'USD') return parseFloat(Number(amount).toFixed(4));
  const rate = await getCurrencyRate(currency);
  return parseFloat((amount / rate).toFixed(4));
};

const usdToLocal = async (amountUSD, currency) => {
  if (currency === 'USD') return parseFloat(Number(amountUSD).toFixed(2));
  const rate = await getCurrencyRate(currency);
  return parseFloat((amountUSD * rate).toFixed(2));
};

const findPendingActivationTransaction = async (userId, providerTxId, session) => {
  const specificMatch = [];

  if (providerTxId) {
    specificMatch.push({ providerTransactionId: providerTxId });
    specificMatch.push({ 'metadata.reference': providerTxId });
  }

  const baseQuery = { userId, type: 'activation', status: 'pending' };
  if (specificMatch.length > 0) {
    return Transaction.findOne({
      ...baseQuery,
      $or: specificMatch,
    }).session(session);
  }

  return Transaction.findOne(baseQuery).sort({ createdAt: -1 }).session(session);
};

const tagPendingPayoutTransactions = async (userId, payoutReference, session) => {
  await Transaction.updateMany(
    {
      userId,
      status: 'pending',
      type: { $in: ['referral_reward', 'withdrawal'] },
    },
    {
      $set: {
        provider: 'paystack',
        'metadata.payoutReference': payoutReference,
      },
    },
    { session }
  );
};

const finalizeFridayPayoutSuccess = async (reference, providerTransactionId = reference) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transactions = await Transaction.find({
      status: 'pending',
      type: { $in: ['referral_reward', 'withdrawal'] },
      'metadata.payoutReference': reference,
    }).session(session);

    if (transactions.length === 0) {
      await session.abortTransaction();
      return;
    }

    const userId = transactions[0].userId;
    const amountUSD = transactions.reduce((sum, tx) => sum + tx.amountUSD, 0);
    const now = new Date();

    await Transaction.updateMany(
      {
        _id: { $in: transactions.map((tx) => tx._id) },
      },
      {
        $set: {
          status: 'successful',
          provider: 'paystack',
          providerTransactionId,
          processedAt: now,
        },
      },
      { session }
    );

    await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { pendingBalance: -amountUSD, totalWithdrawn: amountUSD } },
      { session }
    );

    await Referral.updateMany(
      {
        referrerUserId: userId,
        status: 'pending',
      },
      {
        $set: {
          status: 'paid',
          paidAt: now,
        },
      },
      { session }
    );

    await session.commitTransaction();
    logger.info(`Friday payout finalized for ${userId} with reference ${reference}`);
  } catch (error) {
    await session.abortTransaction();
    logger.error(`finalizeFridayPayoutSuccess failed: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
};

const markFridayPayoutRetryable = async (reference, reason) => {
  await Transaction.updateMany(
    {
      status: 'pending',
      type: { $in: ['referral_reward', 'withdrawal'] },
      'metadata.payoutReference': reference,
    },
    {
      $set: {
        failureReason: reason,
      },
    }
  );
};

const getTokenPurchaseCallbackUrl = (providerKey, reference) => {
  const base = process.env.BACKEND_URL;
  switch (providerKey) {
    case 'jenga':
      return `${base}/api/payments/jenga/callback`;
    case 'mtn_momo_request_to_pay':
    case 'mtn_momo':
      return `${base}/api/payments/mtn-momo/callback`;
    case 'telebirr_app_approval':
    case 'telebirr':
      return `${base}/api/payments/telebirr/callback`;
    case 'tanzania_wallet_prompt':
    case 'tanzania_wallet':
      return `${base}/api/payments/tanzania-wallet/callback`;
    case 'paystack':
    case 'paystack_card':
    case 'paystack_bank_transfer':
    case 'paystack_ussd':
    case 'paystack_mpesa':
    case 'paystack_mobile_money':
    default:
      return `${base}/api/payments/verify/${reference}`;
  }
};

const markTransactionSuccessful = async (reference, provider, providerTransactionId, extraMetadata = {}) => {
  const tx = await Transaction.findOne({
    $or: [{ providerTransactionId: reference }, { 'metadata.reference': reference }],
    status: 'pending',
  });

  if (!tx) {
    return null;
  }

  tx.status = 'successful';
  tx.provider = provider || tx.provider;
  tx.providerTransactionId = providerTransactionId || tx.providerTransactionId || reference;
  tx.processedAt = new Date();
  tx.metadata = { ...(tx.metadata || {}), ...extraMetadata };
  await tx.save();
  return tx;
};

const buildVerificationResponse = async (tx) => {
  const user = await User.findById(tx.userId);
  const wallet = await Wallet.findOne({ userId: tx.userId });
  return {
    success: true,
    verified: tx.status === 'successful',
    status: tx.status,
    type: tx.type,
    activated: tx.type === 'activation' ? isUserActivated(user) : false,
    tokensCredited: tx.type === 'token_purchase' ? tx.status === 'successful' : false,
    depositCredited: tx.type === 'deposit' ? tx.status === 'successful' : false,
    reference: tx.metadata?.reference || tx.providerTransactionId,
    provider: tx.provider,
    transactionId: tx._id,
    tokenBalance: user?.tokenBalance,
    walletBalanceUSD: wallet?.balanceUSD || 0,
  };
};

const fulfillTokenPurchase = async (reference, provider, providerTransactionId) => {
  const tx = await markTransactionSuccessful(reference, provider, providerTransactionId);
  if (!tx) return null;
  if (tx.type !== 'token_purchase') return tx;

  const tokenCount = Number(tx.metadata?.tokens || 0);
  if (!tokenCount) {
    throw new Error(`Token purchase ${reference} missing token count`);
  }

  const user = await User.findById(tx.userId);
  if (!user) {
    throw new Error(`User ${tx.userId} not found for token purchase`);
  }

  user.creditTokens(tokenCount);
  await user.save();

  tx.metadata = {
    ...(tx.metadata || {}),
    fulfilledAt: new Date().toISOString(),
    balanceAfter: user.tokenBalance,
  };
  await tx.save();
  return tx;
};

const fulfillWalletDeposit = async (reference, provider, providerTransactionId) => {
  const tx = await markTransactionSuccessful(reference, provider, providerTransactionId);
  if (!tx) return null;
  if (tx.type !== 'deposit') return tx;

  const wallet = await Wallet.findOne({ userId: tx.userId });
  if (!wallet) {
    throw new Error(`Wallet ${tx.userId} not found for deposit`);
  }

  await wallet.deposit(tx.amountUSD);

  tx.metadata = {
    ...(tx.metadata || {}),
    fulfilledAt: new Date().toISOString(),
    balanceAfter: wallet.balanceUSD,
  };
  await tx.save();
  return tx;
};

const fulfillPendingCollection = async (reference, provider, providerTransactionId) => {
  const transaction = await Transaction.findOne({
    $or: [{ providerTransactionId: reference }, { 'metadata.reference': reference }],
    status: 'pending',
  }).sort({ createdAt: -1 });

  if (!transaction) return null;
  if (transaction.type === 'token_purchase') {
    return fulfillTokenPurchase(reference, provider, providerTransactionId);
  }
  if (transaction.type === 'deposit') {
    return fulfillWalletDeposit(reference, provider, providerTransactionId);
  }
  return transaction;
};

const initiateMpesaSTK = async (user, amount, phoneNumber) => {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(
    `${process.env.DARAJA_SHORTCODE || process.env.MPESA_SHORTCODE}${process.env.DARAJA_PASSKEY || process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');
  const normalizedPhone = normalizePhoneNumber(phoneNumber || user.phone);

  const baseUrl = isDarajaLive()
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  const tokenRes = await axios.get(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      auth: {
        username: process.env.DARAJA_CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY,
        password: process.env.DARAJA_CONSUMER_SECRET || process.env.MPESA_CONSUMER_SECRET,
      },
    }
  );

  return axios.post(
    `${baseUrl}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: process.env.DARAJA_SHORTCODE || process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: process.env.DARAJA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: normalizedPhone,
      PartyB:
        (process.env.DARAJA_TRANSACTION_TYPE || 'CustomerPayBillOnline') === 'CustomerBuyGoodsOnline'
          ? (process.env.DARAJA_TILL || process.env.MPESA_TILL || process.env.DARAJA_SHORTCODE || process.env.MPESA_SHORTCODE)
          : (process.env.DARAJA_SHORTCODE || process.env.MPESA_SHORTCODE),
      PhoneNumber: normalizedPhone,
      CallBackURL: getMpesaCallbackUrl(),
      AccountReference: `CashFlawHubs-${user.userId}`,
      TransactionDesc: 'CashFlawHubs Account Activation',
    },
    {
      headers: {
        Authorization: `Bearer ${tokenRes.data.access_token}`,
      },
    }
  );

};

// @POST /api/payments/initiate-activation
exports.initiateActivation = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const countryConfig = COUNTRIES[user.country];

    if (isUserActivated(user)) {
      return res.status(400).json({ success: false, message: 'Account already activated' });
    }

    if (isActivationTestWindowEnabled()) {
      return res.json({
        success: true,
        paymentLink: null,
        amount: 0,
        currency: countryConfig.currency,
        reference: null,
        paymentRouting: countryConfig.paymentRouting,
        paymentStack: HYBRID_PAYMENT_STACK,
        activationBypass: true,
        message: 'Activation payment is temporarily bypassed for testing.',
      });
    }

    const reference = buildReference('ACT', user.userId);
    const paymentPhone = String(phoneNumber || user.phone || '').trim();

    if (!paymentPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required for activation payment' });
    }

    const normalizedPaymentPhone = normalizePhoneNumber(paymentPhone);
    if (normalizedPaymentPhone.length < 9) {
      return res.status(400).json({ success: false, message: 'Enter a valid payment phone number' });
    }

    if (user.country === 'KE' && useDarajaForKenya()) {
      const stkResponse = await initiateMpesaSTK(user, countryConfig.activationFee, paymentPhone);

      await Transaction.create({
        userId: user._id,
        type: 'activation',
        amountLocal: countryConfig.activationFee,
        amountUSD: await localToUSD(countryConfig.activationFee, countryConfig.currency),
        currency: countryConfig.currency,
        country: user.country,
        provider: 'mpesa',
        providerTransactionId: reference,
        direction: 'debit',
        status: 'pending',
        metadata: {
          reference,
          channel: 'daraja_stk',
          phoneNumber: paymentPhone,
          phoneNumberNormalized: normalizedPaymentPhone,
          checkoutRequestId: stkResponse?.data?.CheckoutRequestID || null,
        },
      });

      return res.json({
        success: true,
        paymentLink: null,
        amount: countryConfig.activationFee,
        currency: countryConfig.currency,
        reference,
        paymentRouting: countryConfig.paymentRouting,
        paymentStack: HYBRID_PAYMENT_STACK,
      });
    }

    const chargeCurrency = getCollectionCurrency(user.country);
    const chargeAmount = chargeCurrency === countryConfig.currency
      ? countryConfig.activationFee
      : await localToUSD(countryConfig.activationFee, countryConfig.currency);

    const paymentData = await initializePaystackPayment({
      amount: chargeAmount,
      email: user.email || `${normalizePhoneNumber(user.phone)}@cashflawhubs.app`,
      currency: chargeCurrency,
      reference,
      metadata: {
        userId: user._id.toString(),
        type: 'activation',
        country: user.country,
        phoneNumber: paymentPhone,
        localAmount: countryConfig.activationFee,
        localCurrency: countryConfig.currency,
      },
    });

    await Transaction.create({
      userId: user._id,
      type: 'activation',
      amountLocal: chargeAmount,
      amountUSD: chargeCurrency === 'USD'
        ? parseFloat(Number(chargeAmount).toFixed(4))
        : await localToUSD(chargeAmount, chargeCurrency),
      currency: chargeCurrency,
      country: user.country,
      provider: 'paystack',
      providerTransactionId: reference,
      direction: 'debit',
      status: 'pending',
      metadata: {
        reference,
        phoneNumber: paymentPhone,
        phoneNumberNormalized: normalizedPaymentPhone,
        localAmount: countryConfig.activationFee,
        localCurrency: countryConfig.currency,
      },
    });

    res.json({
      success: true,
      paymentLink: paymentData.authorization_url,
      amount: chargeAmount,
      currency: chargeCurrency,
      reference,
      paymentRouting: countryConfig.paymentRouting,
      paymentStack: HYBRID_PAYMENT_STACK,
    });
  } catch (error) {
    logger.error(`initiateActivation error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/payments/tokens/purchase
exports.initiateTokenPurchase = async (req, res) => {
  try {
    const { tokens, provider } = req.body;
    const tokenPackage = getTokenPackage(tokens);
    if (!tokenPackage) {
      return res.status(400).json({ success: false, message: 'Invalid token package selected' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const countryConfig = COUNTRIES[user.country];
    const reference = buildReference('TOK', user.userId);
    const depositStrategy = provider || countryConfig.paymentRouting?.deposits?.[0] || countryConfig.paymentProvider || 'paystack';
    const providerCallbackUrl = getTokenPurchaseCallbackUrl(depositStrategy, reference);
    const frontendReturnUrl = getFrontendReturnUrl('token_purchase', reference);

    const transaction = await Transaction.create({
      userId: user._id,
      type: 'token_purchase',
      amountLocal: tokenPackage.amountKES,
      amountUSD: await localToUSD(tokenPackage.amountKES, 'KES'),
      currency: 'KES',
      country: user.country,
      provider: countryConfig.paymentProvider === 'daraja' ? 'mpesa' : (countryConfig.paymentProvider || 'paystack'),
      providerTransactionId: reference,
      direction: 'debit',
      status: 'pending',
      metadata: {
        reference,
        intent: 'token_purchase',
        tokens: tokenPackage.tokens,
        returnUrl: frontendReturnUrl,
      },
    });

    const payment = await paymentOrchestrator.initiateDeposit({
      country: user.country,
      requestedProvider: depositStrategy,
      payload: {
        reference,
        amountLocal: tokenPackage.amountKES,
        currency: 'KES',
        callbackUrl: depositStrategy.startsWith('paystack') ? frontendReturnUrl : providerCallbackUrl,
        customer: {
          name: user.name,
          email: user.email || `${normalizePhoneNumber(user.phone)}@cashflawhubs.app`,
          phone: user.phone,
        },
        metadata: {
          type: 'token_purchase',
          userId: user._id.toString(),
          tokens: tokenPackage.tokens,
        },
      },
    });

    transaction.provider = payment.provider || transaction.provider;
    await transaction.save();

    res.json({
      success: true,
      transactionId: transaction._id,
      reference,
      tokens: tokenPackage.tokens,
      amount: tokenPackage.amountKES,
      currency: 'KES',
      provider: payment.provider,
      strategy: payment.strategy,
      checkoutUrl: payment.checkoutUrl || null,
      returnUrl: frontendReturnUrl,
      verificationMode: payment.checkoutUrl ? 'redirect' : 'poll',
      payment,
    });
  } catch (error) {
    logger.error(`initiateTokenPurchase error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/payments/deposits/initiate
exports.initiateWalletDeposit = async (req, res) => {
  try {
    const { amountLocal, phoneNumber, provider } = req.body;
    const numericAmount = Number(amountLocal);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid deposit amount' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const countryConfig = COUNTRIES[user.country];
    const reference = buildReference('DEP', user.userId);
    const depositStrategy = provider || countryConfig.paymentRouting?.deposits?.[0] || countryConfig.paymentProvider || 'paystack';
    const providerCallbackUrl = getTokenPurchaseCallbackUrl(depositStrategy, reference);
    const frontendReturnUrl = getFrontendReturnUrl('deposit', reference);
    const paymentPhone = String(phoneNumber || user.phone || '').trim();

    if (!paymentPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required for deposit' });
    }

    const transaction = await Transaction.create({
      userId: user._id,
      type: 'deposit',
      amountLocal: numericAmount,
      amountUSD: await localToUSD(numericAmount, countryConfig.currency),
      currency: countryConfig.currency,
      country: user.country,
      provider: countryConfig.paymentProvider === 'daraja' ? 'mpesa' : (countryConfig.paymentProvider || 'paystack'),
      providerTransactionId: reference,
      direction: 'credit',
      status: 'pending',
      metadata: {
        reference,
        intent: 'wallet_deposit',
        phoneNumber: paymentPhone,
        phoneNumberNormalized: normalizePhoneNumber(paymentPhone),
        returnUrl: frontendReturnUrl,
      },
    });

    const payment = await paymentOrchestrator.initiateDeposit({
      country: user.country,
      requestedProvider: depositStrategy,
      payload: {
        reference,
        amountLocal: numericAmount,
        currency: countryConfig.currency,
        callbackUrl: depositStrategy.startsWith('paystack') ? frontendReturnUrl : providerCallbackUrl,
        customer: {
          name: user.name,
          email: user.email || `${normalizePhoneNumber(paymentPhone)}@cashflawhubs.app`,
          phone: paymentPhone,
        },
        metadata: {
          type: 'deposit',
          userId: user._id.toString(),
          country: user.country,
          phoneNumber: paymentPhone,
          localAmount: numericAmount,
          localCurrency: countryConfig.currency,
        },
      },
    });

    transaction.provider = payment.provider || transaction.provider;
    transaction.providerTransactionId = payment.providerTransactionId || transaction.providerTransactionId;
    transaction.metadata = {
      ...(transaction.metadata || {}),
      checkoutRequestId: payment.raw?.CheckoutRequestID || null,
      providerReference: payment.reference || reference,
    };
    await transaction.save();

    res.json({
      success: true,
      transactionId: transaction._id,
      reference,
      amount: numericAmount,
      currency: countryConfig.currency,
      provider: payment.provider,
      strategy: payment.strategy,
      checkoutUrl: payment.checkoutUrl || null,
      returnUrl: frontendReturnUrl,
      verificationMode: payment.checkoutUrl ? 'redirect' : 'poll',
      payment,
    });
  } catch (error) {
    logger.error(`initiateWalletDeposit error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/payments/paystack/webhook
exports.paystackWebhook = async (req, res) => {
  try {
    if (!verifyPaystackSignature(req)) {
      return res.status(401).json({ message: 'Invalid Paystack signature' });
    }

    const event = req.body.event;
    const data = req.body.data || {};

    if (event === 'charge.success') {
      const metadata = data.metadata || {};
      if (metadata.type === 'activation' && metadata.userId) {
        const verified = await verifyPaystackTransaction(data.reference);

        if (isSuccessfulChargeStatus(verified.status)) {
          await publishToQueue('payment.activation', {
            userId: metadata.userId,
            amountLocal: verified.amount / 100,
            currency: verified.currency || data.currency,
            providerTxId: verified.reference || data.reference,
            provider: 'paystack',
          });
        }
      } else if (metadata.type === 'token_purchase' && metadata.userId) {
        const verified = await verifyPaystackTransaction(data.reference);
        if (isSuccessfulChargeStatus(verified.status)) {
          await fulfillTokenPurchase(verified.reference || data.reference, 'paystack', verified.reference || data.reference);
        }
      } else if (metadata.type === 'deposit' && metadata.userId) {
        const verified = await verifyPaystackTransaction(data.reference);
        if (isSuccessfulChargeStatus(verified.status)) {
          await fulfillWalletDeposit(verified.reference || data.reference, 'paystack', verified.reference || data.reference);
        }
      }
    }

    if (event === 'transfer.success') {
      await finalizeFridayPayoutSuccess(data.reference, data.transfer_code || data.reference);
    }

    if (event === 'transfer.failed' || event === 'transfer.reversed') {
      await markFridayPayoutRetryable(data.reference, `${event}: ${data.status || 'failed'}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`paystackWebhook error: ${error.message}`);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};

// @GET /api/payments/verify/:reference
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const existingTransaction = await Transaction.findOne({
      userId: req.user.id,
      $or: [
        { providerTransactionId: reference },
        { 'metadata.reference': reference },
      ],
    }).sort({ createdAt: -1 });

    if (!existingTransaction) {
      return res.status(404).json({ success: false, message: 'Payment reference not found' });
    }

    if (existingTransaction.status === 'successful') {
      return res.json(await buildVerificationResponse(existingTransaction));
    }

    if (existingTransaction.provider !== 'paystack') {
      return res.json(await buildVerificationResponse(existingTransaction));
    }

    const verified = await verifyPaystackTransaction(reference);
    const metadata = verified.metadata || {};

    if (!metadata.userId || metadata.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Payment does not belong to this user' });
    }

    if (!isSuccessfulChargeStatus(verified.status)) {
      return res.json({
        success: true,
        verified: false,
        status: verified.status,
        reference,
      });
    }

    if (metadata.type === 'activation') {
      await publishToQueue('payment.activation', {
        userId: metadata.userId,
        amountLocal: verified.amount / 100,
        currency: verified.currency,
        providerTxId: verified.reference || reference,
        provider: 'paystack',
      });
    } else if (metadata.type === 'token_purchase') {
      await fulfillTokenPurchase(verified.reference || reference, 'paystack', verified.reference || reference);
    } else if (metadata.type === 'deposit') {
      await fulfillWalletDeposit(verified.reference || reference, 'paystack', verified.reference || reference);
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported payment type' });
    }

    const refreshedTransaction = await Transaction.findById(existingTransaction._id);
    res.json(await buildVerificationResponse(refreshedTransaction || existingTransaction));
  } catch (error) {
    logger.error(`verifyPayment error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/payments/mpesa/callback
exports.mpesaCallback = async (req, res) => {
  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) {
      logger.warn('M-Pesa callback received without stkCallback payload');
      return res.status(200).json({ received: true });
    }

    const { ResultCode, CallbackMetadata, CheckoutRequestID, MerchantRequestID, ResultDesc } = stkCallback;
    const callbackCode = Number(ResultCode);
    const checkoutRequestId = CheckoutRequestID || null;

    if (callbackCode !== 0) {
      if (checkoutRequestId) {
        await Transaction.findOneAndUpdate(
          { status: 'pending', 'metadata.checkoutRequestId': checkoutRequestId },
          {
            $set: {
              status: 'failed',
              failureReason: ResultDesc || `M-Pesa ResultCode ${callbackCode}`,
              processedAt: new Date(),
              'metadata.checkoutRequestId': checkoutRequestId,
              'metadata.merchantRequestId': MerchantRequestID || null,
            },
          }
        );
      }
      logger.warn(`M-Pesa payment failed: ResultCode ${callbackCode}, CheckoutRequestID=${checkoutRequestId || 'n/a'}`);
      return res.status(200).json({ received: true });
    }

    const items = CallbackMetadata?.Item || [];
    const amount = items.find((item) => item.Name === 'Amount')?.Value;
    const phone = items.find((item) => item.Name === 'PhoneNumber')?.Value?.toString();
    const txId = items.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;
    const normalizedCallbackPhone = normalizePhoneNumber(phone || '');

    const pendingTx = await Transaction.findOne({
      status: 'pending',
      $or: [
        { 'metadata.checkoutRequestId': checkoutRequestId },
        { 'metadata.phoneNumberNormalized': normalizedCallbackPhone },
        { providerTransactionId: txId },
      ],
    }).sort({ createdAt: -1 });

    if (!pendingTx) {
      const user = await User.findOne({ phone: `+${phone}` });
      if (!user) {
        return res.status(200).json({ received: true });
      }

      const fallbackPendingTx = await Transaction.findOne({ userId: user._id, status: 'pending' }).sort({ createdAt: -1 });
      if (fallbackPendingTx?.type === 'token_purchase') {
        await fulfillTokenPurchase(fallbackPendingTx.providerTransactionId || txId, 'mpesa', txId);
      } else if (fallbackPendingTx?.type === 'deposit') {
        await fulfillWalletDeposit(fallbackPendingTx.providerTransactionId || txId, 'mpesa', txId);
      } else {
        await publishToQueue('payment.activation', {
          userId: user._id.toString(),
          amountLocal: amount,
          currency: 'KES',
          providerTxId: txId,
          provider: 'mpesa',
        });
      }

      return res.status(200).json({ received: true });
    }

    pendingTx.metadata = {
      ...(pendingTx.metadata || {}),
      checkoutRequestId: checkoutRequestId || pendingTx.metadata?.checkoutRequestId || null,
      merchantRequestId: MerchantRequestID || pendingTx.metadata?.merchantRequestId || null,
    };
    await pendingTx.save();

    if (pendingTx?.type === 'token_purchase') {
      await fulfillTokenPurchase(pendingTx.providerTransactionId || txId, 'mpesa', txId);
    } else if (pendingTx?.type === 'deposit') {
      await fulfillWalletDeposit(pendingTx.providerTransactionId || txId, 'mpesa', txId);
    } else {
      await publishToQueue('payment.activation', {
        userId: pendingTx.userId.toString(),
        amountLocal: amount,
        currency: 'KES',
        providerTxId: txId,
        provider: 'mpesa',
      });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`mpesaCallback error: ${error.message}`);
    res.status(200).json({ received: true });
  }
};

exports.jengaCallback = async (req, res) => {
  try {
    const reference = req.body?.reference || req.body?.transactionReference;
    const status = String(req.body?.status || req.body?.message || '').toLowerCase();
    if (reference && (status.includes('success') || status === 'true')) {
      await fulfillPendingCollection(reference, 'jenga', req.body?.transactionId || reference);
    }
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`jengaCallback error: ${error.message}`);
    res.status(200).json({ received: true });
  }
};

exports.mtnMomoCallback = async (req, res) => {
  try {
    const reference = req.body?.externalId || req.body?.reference;
    const status = String(req.body?.status || req.body?.reason || '').toLowerCase();
    if (reference && (status.includes('success') || status.includes('completed'))) {
      await fulfillPendingCollection(reference, 'mtn_momo', req.body?.financialTransactionId || reference);
    }
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`mtnMomoCallback error: ${error.message}`);
    res.status(200).json({ received: true });
  }
};

exports.telebirrCallback = async (req, res) => {
  try {
    const reference = req.body?.outTradeNo || req.body?.reference;
    const status = String(req.body?.tradeStatus || req.body?.status || '').toLowerCase();
    if (reference && (status.includes('success') || status.includes('completed'))) {
      await fulfillPendingCollection(reference, 'telebirr', req.body?.transactionNo || reference);
    }
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`telebirrCallback error: ${error.message}`);
    res.status(200).json({ received: true });
  }
};

exports.tanzaniaWalletCallback = async (req, res) => {
  try {
    const reference = req.body?.reference || req.body?.transactionReference;
    const status = String(req.body?.status || '').toLowerCase();
    if (reference && (status.includes('success') || status.includes('completed'))) {
      await fulfillPendingCollection(reference, 'tanzania_wallet', req.body?.transactionId || reference);
    }
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`tanzaniaWalletCallback error: ${error.message}`);
    res.status(200).json({ received: true });
  }
};

// Core payment split processor (called by queue worker)
exports.processActivationPayment = async ({ userId, amountLocal, currency, providerTxId, provider = 'paystack' }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (user.activationStatus) {
      await session.abortTransaction();
      logger.warn(`User ${userId} already activated`);
      return;
    }

    const countryConfig = COUNTRIES[user.country];
    const amountUSD = await localToUSD(amountLocal, currency);
    const referralShareUSD = await localToUSD(countryConfig.referralReward, countryConfig.currency);
    const platformShareUSD = await localToUSD(countryConfig.platformShare, countryConfig.currency);
    const now = new Date();

    await User.findByIdAndUpdate(
      userId,
      {
        activationStatus: true,
        $inc: { xpPoints: 50 },
      },
      { session }
    );

    const pendingActivation = await findPendingActivationTransaction(user._id, providerTxId, session);

    if (pendingActivation) {
      pendingActivation.amountLocal = amountLocal;
      pendingActivation.amountUSD = amountUSD;
      pendingActivation.currency = currency;
      pendingActivation.provider = provider;
      pendingActivation.providerTransactionId = providerTxId;
      pendingActivation.status = 'successful';
      pendingActivation.processedAt = now;
      pendingActivation.metadata = {
        ...(pendingActivation.metadata || {}),
        referralShareUSD,
        platformShareUSD,
      };
      await pendingActivation.save({ session });
    } else {
      await Transaction.create([{
        userId: user._id,
        type: 'activation',
        amountLocal,
        amountUSD,
        currency,
        country: user.country,
        provider,
        providerTransactionId: providerTxId,
        direction: 'debit',
        status: 'successful',
        processedAt: now,
        metadata: {
          referralShareUSD,
          platformShareUSD,
        },
      }], { session });
    }

    if (user.referredBy) {
      const referrer = await User.findOne({ referralCode: user.referredBy }).session(session);

      if (referrer) {
        await Wallet.findOneAndUpdate(
          { userId: referrer._id },
          {
            $inc: {
              pendingBalance: referralShareUSD,
              referralEarnings: referralShareUSD,
              totalEarned: referralShareUSD,
            },
          },
          { session, upsert: true, setDefaultsOnInsert: true }
        );

        await Referral.create([{
          referrerUserId: referrer._id,
          newUserId: user._id,
          referralCode: user.referredBy,
          rewardAmountUSD: referralShareUSD,
          rewardAmountLocal: countryConfig.referralReward,
          currency: countryConfig.currency,
          status: 'pending',
        }], { session });

        await Transaction.create([{
          userId: referrer._id,
          type: 'referral_reward',
          amountLocal: countryConfig.referralReward,
          amountUSD: referralShareUSD,
          currency: countryConfig.currency,
          country: user.country,
          provider: 'internal',
          direction: 'credit',
          status: 'pending',
          metadata: {
            sourceUserId: user._id.toString(),
            sourceUserCode: user.userId,
            payoutSchedule: 'friday',
          },
        }], { session });

        await User.findByIdAndUpdate(
          referrer._id,
          { $inc: { totalReferrals: 1, xpPoints: 100 } },
          { session }
        );

        logger.info(`Referral reward of $${referralShareUSD} queued for ${referrer.userId}`);
      }
    }

    await session.commitTransaction();
    logger.info(`Activation processed for user ${user.userId}`);

    await publishToQueue('notification.activation', {
      userId: user._id.toString(),
      referredBy: user.referredBy,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error(`processActivationPayment failed: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
};

exports.processFridayBulkPayout = async () => {
  const pendingWallets = await Wallet.find({ pendingBalance: { $gt: 0 } }).lean();

  if (pendingWallets.length === 0) {
    logger.info('Friday payout skipped: no pending balances');
    return { processed: 0, skipped: 0 };
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    logger.warn('Friday payout skipped: Paystack secret key is not configured');
    return { processed: 0, skipped: pendingWallets.length };
  }

  const payoutPlans = [];
  let skipped = 0;

  for (const wallet of pendingWallets) {
    const user = await User.findById(wallet.userId).lean();
    if (!user) {
      skipped += 1;
      continue;
    }

    const pendingTransactions = await Transaction.find({
      userId: wallet.userId,
      status: 'pending',
      type: { $in: ['referral_reward', 'withdrawal'] },
    }).lean();

    if (pendingTransactions.length === 0) {
      skipped += 1;
      continue;
    }

    try {
      const recipient = await createPaystackTransferRecipient(user);
      const config = getTransferRecipientConfig(user.country);
      const payoutReference = buildReference('FRI', user.userId);
      const amountUSD = pendingTransactions.reduce((sum, tx) => sum + tx.amountUSD, 0);
      const amountLocal = await usdToLocal(amountUSD, config.currency);

      payoutPlans.push({
        user,
        currency: config.currency,
        payoutReference,
        amountUSD,
        transfer: {
          amount: Math.round(amountLocal * 100),
          recipient: recipient.recipient_code,
          reference: payoutReference,
      reason: 'CashFlawHubs Friday payout',
        },
      });
    } catch (error) {
      skipped += 1;
      logger.warn(`Friday payout skipped for ${user.userId}: ${error.message}`);
    }
  }

  if (payoutPlans.length === 0) {
    logger.info('Friday payout skipped: no eligible transfer recipients');
    return { processed: 0, skipped };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const plan of payoutPlans) {
      await tagPendingPayoutTransactions(plan.user._id, plan.payoutReference, session);
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }

  session.endSession();

  const plansByCurrency = payoutPlans.reduce((groups, plan) => {
    const group = groups[plan.currency] || [];
    group.push(plan);
    groups[plan.currency] = group;
    return groups;
  }, {});

  for (const plans of Object.values(plansByCurrency)) {
    const transfers = plans.map((plan) => plan.transfer);
    const response = await initiatePaystackBulkTransfer(transfers);
    const transfersResult = Array.isArray(response?.transfers) ? response.transfers : [];

    for (const plan of plans) {
      const matchingTransfer = transfersResult.find((item) => item.reference === plan.payoutReference);
      if (matchingTransfer && matchingTransfer.status === 'success') {
        await finalizeFridayPayoutSuccess(
          plan.payoutReference,
          matchingTransfer.transfer_code || plan.payoutReference
        );
      }
    }
  }

  logger.info(`Friday payout submitted for ${payoutPlans.length} wallet(s)`);
  return {
    processed: payoutPlans.length,
    skipped,
  };
};
