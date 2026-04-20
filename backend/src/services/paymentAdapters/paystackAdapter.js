const axios = require('axios');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const getHeaders = () => {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack secret key is not configured');
  }
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
};

exports.initiateDeposit = async ({ reference, amountLocal, currency, callbackUrl, customer, metadata }) => {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      reference,
      amount: Math.round(Number(amountLocal) * 100),
      currency,
      email: customer.email,
      metadata,
      callback_url: callbackUrl,
      channels: ['card', 'bank', 'ussd', 'mobile_money'],
    },
    { headers: getHeaders() }
  );

  return {
    provider: 'paystack',
    reference,
    checkoutUrl: response.data.data.authorization_url,
    raw: response.data.data,
  };
};

exports.initiateWithdrawal = async ({ reference, amountLocal, currency, user }) => {
  const recipientResponse = await axios.post(
    `${PAYSTACK_BASE_URL}/transferrecipient`,
    {
      type: currency === 'GHS' || currency === 'KES' ? 'mobile_money' : 'nuban',
      name: user.name,
      account_number: user.phone.replace(/[^\d]/g, ''),
      bank_code: process.env.PAYSTACK_WITHDRAWAL_BANK_CODE || 'MTN',
      currency,
    },
    { headers: getHeaders() }
  );

  const transferResponse = await axios.post(
    `${PAYSTACK_BASE_URL}/transfer`,
    {
      source: 'balance',
      amount: Math.round(Number(amountLocal) * 100),
      recipient: recipientResponse.data.data.recipient_code,
      reference,
      reason: 'CashFlawHubs withdrawal',
      currency,
    },
    { headers: getHeaders() }
  );

  return {
    provider: 'paystack',
    reference,
    providerTransactionId: transferResponse.data.data.transfer_code || reference,
    raw: transferResponse.data.data,
  };
};
