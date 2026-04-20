const axios = require('axios');

const getConfig = () => ({
  depositUrl: process.env.TANZANIA_WALLET_DEPOSIT_URL,
  withdrawalUrl: process.env.TANZANIA_WALLET_WITHDRAWAL_URL,
  apiKey: process.env.TANZANIA_WALLET_API_KEY,
  secret: process.env.TANZANIA_WALLET_API_SECRET,
  provider: process.env.TANZANIA_WALLET_PROVIDER || 'tanzania_wallet',
});

const getHeaders = () => {
  const config = getConfig();
  if (!config.apiKey || !config.secret) {
    throw new Error('Tanzania wallet credentials are not configured');
  }
  return {
    Authorization: `Bearer ${config.apiKey}`,
    'X-API-SECRET': config.secret,
    'Content-Type': 'application/json',
  };
};

exports.initiateDeposit = async ({ reference, amountLocal, currency, callbackUrl, customer }) => {
  const config = getConfig();
  if (!config.depositUrl) {
    throw new Error('Tanzania wallet deposit URL is not configured');
  }

  const response = await axios.post(
    config.depositUrl,
    {
      reference,
      amount: amountLocal,
      currency,
      msisdn: customer.phone,
      callbackUrl,
    },
    { headers: getHeaders() }
  );

  return {
    provider: config.provider,
    reference,
    checkoutUrl: response.data.checkoutUrl || response.data.ussdUrl || null,
    raw: response.data,
  };
};

exports.initiateWithdrawal = async ({ reference, amountLocal, currency, callbackUrl, user }) => {
  const config = getConfig();
  if (!config.withdrawalUrl) {
    throw new Error('Tanzania wallet withdrawal URL is not configured');
  }

  const response = await axios.post(
    config.withdrawalUrl,
    {
      reference,
      amount: amountLocal,
      currency,
      msisdn: user.phone,
      callbackUrl,
      accountName: user.name,
    },
    { headers: getHeaders() }
  );

  return {
    provider: config.provider,
    reference,
    providerTransactionId: response.data.transactionId || reference,
    raw: response.data,
  };
};
