const axios = require('axios');
const crypto = require('crypto');

const getConfig = () => ({
  baseUrl: process.env.TELEBIRR_BASE_URL,
  appId: process.env.TELEBIRR_APP_ID,
  appKey: process.env.TELEBIRR_APP_KEY,
  merchantId: process.env.TELEBIRR_MERCHANT_ID,
  notifyUrl: process.env.TELEBIRR_NOTIFY_URL,
});

const signPayload = (payload) => {
  const { appKey } = getConfig();
  return crypto.createHmac('sha256', appKey).update(JSON.stringify(payload)).digest('hex');
};

exports.initiateDeposit = async ({ reference, amountLocal, currency, callbackUrl, customer }) => {
  const config = getConfig();
  if (!config.baseUrl || !config.appId || !config.appKey || !config.merchantId) {
    throw new Error('Telebirr credentials are not configured');
  }

  const payload = {
    appId: config.appId,
    merchantId: config.merchantId,
    outTradeNo: reference,
    subject: 'CashFlawHubs token purchase',
    totalAmount: Number(amountLocal).toFixed(2),
    currency,
    notifyUrl: callbackUrl || config.notifyUrl,
    customerInfo: {
      name: customer.name,
      mobile: customer.phone,
      email: customer.email,
    },
  };

  const response = await axios.post(
    `${config.baseUrl}/merchant/applyOrder`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signPayload(payload),
      },
    }
  );

  return {
    provider: 'telebirr',
    reference,
    checkoutUrl: response.data.toPayUrl || response.data.payUrl || null,
    raw: response.data,
  };
};

exports.initiateWithdrawal = async ({ reference, amountLocal, currency, callbackUrl, user }) => {
  const config = getConfig();
  if (!config.baseUrl || !config.appId || !config.appKey || !config.merchantId) {
    throw new Error('Telebirr credentials are not configured');
  }

  const payload = {
    appId: config.appId,
    merchantId: config.merchantId,
    outTradeNo: reference,
    amount: Number(amountLocal).toFixed(2),
    currency,
    receiverAccount: user.phone,
    receiverName: user.name,
    notifyUrl: callbackUrl || config.notifyUrl,
    remark: 'CashFlawHubs withdrawal',
  };

  const response = await axios.post(
    `${config.baseUrl}/merchant/transfer`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signPayload(payload),
      },
    }
  );

  return {
    provider: 'telebirr',
    reference,
    providerTransactionId: response.data.transactionNo || reference,
    raw: response.data,
  };
};
