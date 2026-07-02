const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { recordSuccess, recordFailure } = require('../providerHealthTracker'); // from earlier fix

const getBaseUrl = () =>
  (process.env.PAWAPAY_ENV === 'production'
    ? 'https://api.pawapay.io'
    : 'https://api.sandbox.pawapay.io') + '/v2';

const client = () =>
  axios.create({
    baseURL: getBaseUrl(),
    headers: {
      Authorization: `Bearer ${process.env.PAWAPAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

/**
 * Resolve the correct MMO provider code + sanitized phone number
 * for a given raw phone number. Avoids hardcoding per-country MMO codes.
 */
async function predictProvider(phoneNumber) {
  const { data } = await client().post('/predict-provider', { phoneNumber });
  // { country: 'UGA', provider: 'MTN_MOMO_UGA', phoneNumber: '256...' }
  return data;
}

exports.initiateDeposit = async ({ amountLocal, currency, customer, metadata = {}, clientReferenceId }) => {
  try {
    const prediction = await predictProvider(customer.phone);
    const depositId = uuidv4();

    const { data } = await client().post('/deposits', {
      depositId,
      payer: {
        type: 'MMO',
        accountDetails: {
          phoneNumber: prediction.phoneNumber,
          provider: prediction.provider,
        },
      },
      amount: String(amountLocal),
      currency,
      clientReferenceId: clientReferenceId || depositId,
      customerMessage: (metadata.description || 'CashFlawHubs deposit').slice(0, 22),
      metadata: Object.entries(metadata).map(([fieldName, fieldValue]) => ({ fieldName, fieldValue: String(fieldValue) })),
    });

    await recordSuccess('pawapay');
    return {
      provider: 'pawapay',
      reference: depositId,
      providerTransactionId: depositId,
      status: data.status, // 'ACCEPTED' — final status arrives via callback
      country: prediction.country,
      resolvedProvider: prediction.provider,
      raw: data,
    };
  } catch (error) {
    await recordFailure('pawapay', error);
    throw error;
  }
};

exports.initiateWithdrawal = async ({ amountLocal, currency, user, metadata = {}, clientReferenceId }) => {
  try {
    const prediction = await predictProvider(user.phone);
    const payoutId = uuidv4();

    const { data } = await client().post('/payouts', {
      payoutId,
      amount: String(amountLocal),
      currency,
      recipient: {
        type: 'MMO',
        accountDetails: {
          phoneNumber: prediction.phoneNumber,
          provider: prediction.provider,
        },
      },
      metadata: Object.entries(metadata).map(([fieldName, fieldValue]) => ({ fieldName, fieldValue: String(fieldValue) })),
    });

    await recordSuccess('pawapay');
    return {
      provider: 'pawapay',
      reference: payoutId,
      providerTransactionId: payoutId,
      status: data.status,
      raw: data,
    };
  } catch (error) {
    await recordFailure('pawapay', error);
    throw error;
  }
};

exports.checkDepositStatus = async (depositId) => {
  const { data } = await client().get(`/deposits/${depositId}`);
  return data;
};

exports.checkPayoutStatus = async (payoutId) => {
  const { data } = await client().get(`/payouts/${payoutId}`);
  return data;
};

exports.getActiveConfiguration = async (country) => {
  const { data } = await client().get('/active-conf', { params: country ? { country } : {} });
  return data;
};
