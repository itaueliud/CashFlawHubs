const axios = require('axios');

const getConfig = () => {
  const env = String(process.env.DARAJA_ENV || process.env.MPESA_ENV || process.env.NODE_ENV || 'sandbox').toLowerCase();
  const isLive = env === 'live' || env === 'production';

  return {
    env,
    baseUrl: isLive ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke',
    consumerKey: process.env.DARAJA_CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET || process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.DARAJA_SHORTCODE || process.env.MPESA_SHORTCODE,
    till: process.env.DARAJA_TILL || process.env.MPESA_TILL,
    passkey: process.env.DARAJA_PASSKEY || process.env.MPESA_PASSKEY,
    callbackUrl: process.env.DARAJA_CALLBACK_URL || process.env.MPESA_CALLBACK_URL,
    transactionType: process.env.DARAJA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    initiatorName: process.env.DARAJA_INITIATOR_NAME || process.env.MPESA_INITIATOR_NAME || 'CashFlawHubs',
    securityCredential: process.env.DARAJA_SECURITY_CREDENTIAL || process.env.MPESA_SECURITY_CREDENTIAL || process.env.DARAJA_PASSKEY || process.env.MPESA_PASSKEY,
    queueTimeoutUrl: process.env.DARAJA_QUEUE_TIMEOUT_URL || `${process.env.BACKEND_URL}/api/payments/mpesa/callback`,
    resultUrl: process.env.DARAJA_RESULT_URL || `${process.env.BACKEND_URL}/api/payments/mpesa/callback`,
  };
};

const normalizePhone = (value = '') => value.replace(/[^\d]/g, '');
const buildTimestamp = () => new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

const getAccessToken = async () => {
  const config = getConfig();
  if (!config.consumerKey || !config.consumerSecret) {
    throw new Error('Daraja consumer credentials are not configured');
  }

  const response = await axios.get(
    `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      auth: {
        username: config.consumerKey,
        password: config.consumerSecret,
      },
    }
  );

  return response.data.access_token;
};

exports.initiateDeposit = async ({ reference, amountLocal, callbackUrl, customer }) => {
  const config = getConfig();
  if (!config.shortcode || !config.passkey) {
    throw new Error('Daraja STK configuration is incomplete');
  }

  const timestamp = buildTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString('base64');
  const token = await getAccessToken();

  const response = await axios.post(
    `${config.baseUrl}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: config.transactionType,
      Amount: Math.round(Number(amountLocal)),
      PartyA: normalizePhone(customer.phone),
      PartyB: config.transactionType === 'CustomerBuyGoodsOnline' ? config.till || config.shortcode : config.shortcode,
      PhoneNumber: normalizePhone(customer.phone),
      CallBackURL: callbackUrl || config.callbackUrl,
      AccountReference: reference,
      TransactionDesc: 'CashFlawHubs token purchase',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return {
    provider: 'mpesa',
    reference,
    providerTransactionId: response.data.CheckoutRequestID || reference,
    raw: response.data,
  };
};

exports.initiateWithdrawal = async ({ reference, amountLocal, currency, callbackUrl, user }) => {
  const config = getConfig();
  if (!config.shortcode || !config.securityCredential) {
    throw new Error('Daraja B2C configuration is incomplete');
  }
  if (currency !== 'KES') {
    throw new Error(`Daraja B2C only supports KES withdrawals, received ${currency}`);
  }

  const token = await getAccessToken();
  const response = await axios.post(
    `${config.baseUrl}/mpesa/b2c/v1/paymentrequest`,
    {
      InitiatorName: config.initiatorName,
      SecurityCredential: config.securityCredential,
      CommandID: 'BusinessPayment',
      Amount: Math.round(Number(amountLocal)),
      PartyA: config.shortcode,
      PartyB: normalizePhone(user.phone),
      Remarks: 'CashFlawHubs withdrawal',
      QueueTimeOutURL: config.queueTimeoutUrl,
      ResultURL: callbackUrl || config.resultUrl,
      Occasion: reference,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return {
    provider: 'mpesa',
    reference,
    providerTransactionId: response.data.ConversationID || response.data.OriginatorConversationID || reference,
    raw: response.data,
  };
};
