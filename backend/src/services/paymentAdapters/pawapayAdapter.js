const axios = require('axios');

const getConfig = () => ({
  baseUrl: String(process.env.PAWAPAY_BASE_URL || '').replace(/\/+$/, ''),
  apiKey: process.env.PAWAPAY_API_KEY,
  merchantId: process.env.PAWAPAY_MERCHANT_ID,
  collectionUrl: process.env.PAWAPAY_COLLECTION_URL || '',
  payoutUrl: process.env.PAWAPAY_PAYOUT_URL || '',
  callbackUrl: process.env.PAWAPAY_CALLBACK_URL || '',
});

const getHeaders = () => {
  const config = getConfig();
  if (!config.apiKey) {
    throw new Error('PawaPay API key is not configured');
  }

  return {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };
};

const resolveUrl = (configuredUrl, fallbackPath) => {
  const config = getConfig();
  if (configuredUrl) return configuredUrl;
  if (!config.baseUrl) {
    throw new Error('PawaPay base URL is not configured');
  }
  return `${config.baseUrl}${fallbackPath}`;
};

exports.initiateDeposit = async ({ reference, amountLocal, currency, callbackUrl, customer, metadata }) => {
  const config = getConfig();
  const response = await axios.post(
    resolveUrl(config.collectionUrl, '/collections'),
    {
      merchantId: config.merchantId,
      reference,
      amount: Number(amountLocal),
      currency,
      callbackUrl: callbackUrl || config.callbackUrl,
      customer: {
        name: customer?.name,
        email: customer?.email,
        phone: customer?.phone,
      },
      metadata,
    },
    { headers: getHeaders() }
  );

  return {
    provider: 'pawapay',
    reference,
    providerTransactionId: response.data?.transactionId || response.data?.reference || reference,
    checkoutUrl: response.data?.checkoutUrl || response.data?.paymentUrl || null,
    raw: response.data,
  };
};

exports.initiateWithdrawal = async ({ reference, amountLocal, currency, callbackUrl, user }) => {
  const config = getConfig();
  const response = await axios.post(
    resolveUrl(config.payoutUrl, '/payouts'),
    {
      merchantId: config.merchantId,
      reference,
      amount: Number(amountLocal),
      currency,
      callbackUrl: callbackUrl || config.callbackUrl,
      customer: {
        name: user?.name,
        email: user?.email,
        phone: user?.phone,
      },
    },
    { headers: getHeaders() }
  );

  return {
    provider: 'pawapay',
    reference,
    providerTransactionId: response.data?.transactionId || response.data?.reference || reference,
    raw: response.data,
  };
};
