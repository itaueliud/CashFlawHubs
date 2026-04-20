const axios = require('axios');
const crypto = require('crypto');

const getConfig = () => ({
  baseUrl: process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com',
  targetEnvironment: process.env.MTN_MOMO_TARGET_ENVIRONMENT || 'sandbox',
  subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY,
  apiUser: process.env.MTN_MOMO_API_USER,
  apiKey: process.env.MTN_MOMO_API_KEY,
  currency: process.env.MTN_MOMO_CURRENCY || 'UGX',
});

const getToken = async () => {
  const config = getConfig();
  if (!config.subscriptionKey || !config.apiUser || !config.apiKey) {
    throw new Error('MTN MoMo credentials are not configured');
  }

  const response = await axios.post(
    `${config.baseUrl}/collection/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.apiUser}:${config.apiKey}`).toString('base64')}`,
        'Ocp-Apim-Subscription-Key': config.subscriptionKey,
      },
    }
  );

  return response.data.access_token;
};

const buildHeaders = async (callbackUrl) => {
  const config = getConfig();
  const token = await getToken();
  return {
    Authorization: `Bearer ${token}`,
    'X-Reference-Id': crypto.randomUUID(),
    'X-Target-Environment': config.targetEnvironment,
    'Ocp-Apim-Subscription-Key': config.subscriptionKey,
    'Content-Type': 'application/json',
    ...(callbackUrl ? { 'X-Callback-Url': callbackUrl } : {}),
  };
};

exports.initiateDeposit = async ({ reference, amountLocal, currency, callbackUrl, customer }) => {
  const config = getConfig();
  const response = await axios.post(
    `${config.baseUrl}/collection/v1_0/requesttopay`,
    {
      amount: String(amountLocal),
      currency,
      externalId: reference,
      payer: {
        partyIdType: 'MSISDN',
        partyId: customer.phone.replace('+', ''),
      },
      payerMessage: 'CashFlawHubs token purchase',
      payeeNote: 'Token purchase deposit',
    },
    { headers: await buildHeaders(callbackUrl) }
  );

  return {
    provider: 'mtn_momo',
    reference,
    providerTransactionId: response.headers['x-reference-id'] || reference,
    status: response.status,
  };
};

exports.initiateWithdrawal = async ({ reference, amountLocal, currency, callbackUrl, user }) => {
  const config = getConfig();
  const token = await getToken();
  const response = await axios.post(
    `${config.baseUrl}/disbursement/v1_0/transfer`,
    {
      amount: String(amountLocal),
      currency,
      externalId: reference,
      payee: {
        partyIdType: 'MSISDN',
        partyId: user.phone.replace('+', ''),
      },
      payerMessage: 'CashFlawHubs withdrawal',
      payeeNote: 'Wallet withdrawal',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': crypto.randomUUID(),
        'X-Target-Environment': config.targetEnvironment,
        'Ocp-Apim-Subscription-Key': config.subscriptionKey,
        'Content-Type': 'application/json',
        ...(callbackUrl ? { 'X-Callback-Url': callbackUrl } : {}),
      },
    }
  );

  return {
    provider: 'mtn_momo',
    reference,
    providerTransactionId: response.headers['x-reference-id'] || reference,
    status: response.status,
  };
};
