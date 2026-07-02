const HYBRID_PAYMENT_STACK = {
  pawapayLayer: {
    providers: ['pawapay'],
    verifiedMerchantCountries: ['BJ', 'BF', 'CM', 'CD', 'GH', 'CI', 'KE', 'MW', 'MZ', 'NG', 'RW', 'SN', 'SL', 'TZ', 'UG', 'ZM'],
    purpose: 'Primary mobile-money rail across 16 African markets via a single API',
  },
  panAfricaLayer: {
    providers: ['paystack'],
    verifiedMerchantCountries: ['NG', 'GH', 'KE', 'CI'],
    purpose: 'Card, bank transfer, and USSD rail for markets with strong card/bank penetration',
  },
  specializedWallets: {
    UG: ['mtn_momo'],
    TZ: ['tanzania_wallet'],
    KE: ['daraja'],
    ET: ['telebirr'],
  },
};

const COUNTRY_PAYMENT_PRIORITY = {
  KE: {
    deposits: ['daraja', 'pawapay', 'paystack_mpesa'],
    withdrawals: ['daraja_b2c', 'pawapay', 'paystack_mobile_money'],
  },
  UG: {
    deposits: ['pawapay', 'paystack', 'mtn_momo_request_to_pay'],
    withdrawals: ['pawapay', 'paystack', 'mtn_momo_transfer'],
  },
  TZ: {
    deposits: ['pawapay', 'paystack', 'tanzania_wallet_prompt'],
    withdrawals: ['pawapay', 'paystack', 'tanzania_wallet_b2c'],
  },
  GH: {
    deposits: ['paystack', 'pawapay'],
    withdrawals: ['paystack_mobile_money', 'pawapay'],
  },
  NG: {
    deposits: ['paystack', 'pawapay'],
    withdrawals: ['paystack_bank_transfer', 'pawapay'],
  },
  CI: {
    deposits: ['pawapay', 'paystack'],
    withdrawals: ['pawapay', 'paystack'],
  },
  ET: {
    deposits: ['telebirr_app_approval'],
    withdrawals: ['telebirr_transfer'],
  },
  // BJ, BF, CM, CD, MW, MZ, RW, SN, SL, ZM — PawaPay only
};

const PAWAPAY_ONLY_COUNTRIES = ['BJ', 'BF', 'CM', 'CD', 'MW', 'MZ', 'RW', 'SN', 'SL', 'ZM'];

const PROVIDER_STATUS = {
  daraja: 'verified_public_docs',
  paystack: 'verified_public_docs',
  pawapay: 'verified_public_docs',
  mtn_momo: 'partially_verified_public_docs',
  telebirr: 'commercial_confirmation_needed',
  tanzania_wallet_prompt: 'commercial_confirmation_needed',
  tanzania_wallet_b2c: 'commercial_confirmation_needed',
};

const getPaymentPriorityForCountry = (country) => {
  if (COUNTRY_PAYMENT_PRIORITY[country]) return COUNTRY_PAYMENT_PRIORITY[country];
  if (PAWAPAY_ONLY_COUNTRIES.includes(country)) {
    return { deposits: ['pawapay'], withdrawals: ['pawapay'] };
  }
  // CG, GA, LS fall through here — no provider until you decide what to do with them
  return { deposits: [], withdrawals: [] };
};

module.exports = { HYBRID_PAYMENT_STACK, COUNTRY_PAYMENT_PRIORITY, PROVIDER_STATUS, getPaymentPriorityForCountry };
