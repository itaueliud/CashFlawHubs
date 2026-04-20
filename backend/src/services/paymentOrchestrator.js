const { COUNTRIES } = require('../config/countries');
const paystack = require('./paymentAdapters/paystackAdapter');
const jenga = require('./paymentAdapters/jengaAdapter');
const mtnMomo = require('./paymentAdapters/mtnMomoAdapter');
const telebirr = require('./paymentAdapters/telebirrAdapter');
const tanzaniaWallet = require('./paymentAdapters/tanzaniaWalletAdapter');
const daraja = require('./paymentAdapters/darajaAdapter');

const adapterMap = {
  paystack: paystack,
  paystack_card: paystack,
  paystack_bank_transfer: paystack,
  paystack_ussd: paystack,
  paystack_mpesa: paystack,
  paystack_mobile_money: paystack,
  jenga: jenga,
  jenga_mobile_wallet: jenga,
  daraja: daraja,
  daraja_b2c: daraja,
  mtn_momo_request_to_pay: mtnMomo,
  mtn_momo_transfer: mtnMomo,
  telebirr_app_approval: telebirr,
  telebirr_transfer: telebirr,
  tanzania_wallet_prompt: tanzaniaWallet,
  tanzania_wallet_b2c: tanzaniaWallet,
};

const pickStrategies = (country, operation, requestedProvider) => {
  const routing = COUNTRIES[country]?.paymentRouting || { deposits: [], withdrawals: [] };
  const providers = operation === 'deposit' ? routing.deposits : routing.withdrawals;
  if (requestedProvider) return [requestedProvider];
  return providers;
};

exports.initiateDeposit = async ({ country, requestedProvider, payload }) => {
  const strategies = pickStrategies(country, 'deposit', requestedProvider);
  const errors = [];

  for (const strategy of strategies) {
    const adapter = adapterMap[strategy];
    if (!adapter?.initiateDeposit) {
      errors.push(`${strategy}: adapter not implemented`);
      continue;
    }

    try {
      const result = await adapter.initiateDeposit(payload);
      return { ...result, strategy };
    } catch (error) {
      errors.push(`${strategy}: ${error.message}`);
    }
  }

  throw new Error(`Deposit routing failed for ${country}. ${errors.join(' | ')}`);
};

exports.initiateWithdrawal = async ({ country, requestedProvider, payload }) => {
  const strategies = pickStrategies(country, 'withdrawal', requestedProvider);
  const errors = [];

  for (const strategy of strategies) {
    const adapter = adapterMap[strategy];
    if (!adapter?.initiateWithdrawal) {
      errors.push(`${strategy}: adapter not implemented`);
      continue;
    }

    try {
      const result = await adapter.initiateWithdrawal(payload);
      return { ...result, strategy };
    } catch (error) {
      errors.push(`${strategy}: ${error.message}`);
    }
  }

  throw new Error(`Withdrawal routing failed for ${country}. ${errors.join(' | ')}`);
};
