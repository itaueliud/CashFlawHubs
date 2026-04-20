const axios = require('axios');
const crypto = require('crypto');

const getConfig = () => ({
  collectionUrl: process.env.JENGA_COLLECTION_URL,
  mobileWithdrawalUrl: process.env.JENGA_MOBILE_WITHDRAWAL_URL || 'https://api.finserve.africa/v3-apis/transaction-api/v3.0/remittance/sendmobile',
  apiKey: process.env.JENGA_API_KEY,
  apiSecret: process.env.JENGA_API_SECRET,
  merchantCode: process.env.JENGA_MERCHANT_CODE,
  accountNumber: process.env.JENGA_SOURCE_ACCOUNT_NUMBER,
  accountName: process.env.JENGA_SOURCE_ACCOUNT_NAME || 'CashFlawHubs',
});

const getAccessToken = async () => {
  const { apiKey, apiSecret } = getConfig();
  if (!apiKey || !apiSecret) {
    throw new Error('Jenga credentials are not configured');
  }

  const response = await axios.post(
    process.env.JENGA_TOKEN_URL || 'https://api.finserve.africa/identity/v2/token',
    {},
    {
      auth: { username: apiKey, password: apiSecret },
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return response.data.access_token || response.data.token;
};

const buildSignature = ({ amount, currencyCode, reference, sourceAccountNumber }) => {
  const { apiSecret } = getConfig();
  return crypto
    .createHmac('sha256', apiSecret)
    .update(`${amount}${currencyCode}${reference}${sourceAccountNumber}`)
    .digest('hex');
};

exports.initiateDeposit = async ({ reference, amountLocal, currency, callbackUrl, customer }) => {
  const { collectionUrl, merchantCode } = getConfig();
  if (!collectionUrl || !merchantCode) {
    throw new Error('Jenga collection configuration is incomplete');
  }

  const token = await getAccessToken();
  const response = await axios.post(
    collectionUrl,
    {
      merchantCode,
      reference,
      amount: amountLocal,
      currencyCode: currency,
      customer: {
        name: customer.name,
        email: customer.email,
        phoneNumber: customer.phone,
      },
      callbackUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    provider: 'jenga',
    reference,
    checkoutUrl: response.data.checkoutUrl || response.data.redirectUrl || null,
    raw: response.data,
  };
};

exports.initiateWithdrawal = async ({ reference, amountLocal, currency, callbackUrl, user }) => {
  const config = getConfig();
  if (!config.accountNumber || !config.accountName) {
    throw new Error('Jenga withdrawal source account is not configured');
  }

  const token = await getAccessToken();
  const payload = {
    source: {
      countryCode: user.country,
      name: config.accountName,
      accountNumber: config.accountNumber,
    },
    destination: {
      type: 'mobile',
      countryCode: user.country,
      name: user.name,
      mobileNumber: user.phone.replace('+', ''),
      walletName: user.walletName || 'Mpesa',
    },
    transfer: {
      type: 'MobileWallet',
      amount: String(amountLocal),
      currencyCode: currency,
      reference,
      date: new Date().toISOString().slice(0, 10),
      description: 'CashFlawHubs withdrawal',
      callbackUrl,
    },
  };

  const signature = buildSignature({
    amount: payload.transfer.amount,
    currencyCode: payload.transfer.currencyCode,
    reference,
    sourceAccountNumber: config.accountNumber,
  });

  const response = await axios.post(config.mobileWithdrawalUrl, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      signature,
    },
  });

  return {
    provider: 'jenga',
    reference,
    providerTransactionId: response.data.transactionId || reference,
    raw: response.data,
  };
};
