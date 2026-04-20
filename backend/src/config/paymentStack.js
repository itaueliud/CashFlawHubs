const HYBRID_PAYMENT_STACK = {
  eastAfricaLayer: {
    providers: ['jenga', 'daraja'],
    verifiedCoverage: ['KE', 'UG', 'TZ', 'RW', 'SS', 'ET', 'DRC'],
    purpose: 'East/Central Africa bank rails, mobile wallet disbursement, and M-Pesa collection',
  },
  panAfricaLayer: {
    providers: ['paystack'],
    verifiedMerchantCountries: ['NG', 'GH', 'ZA', 'KE'],
    purpose: 'Pan-African scale engine for cards, bank transfers, selected mobile money, and settlement',
  },
  specializedWallets: {
    UG: ['mtn_momo'],
    GH: ['mtn_momo'],
    CM: ['mtn_momo'],
    ZM: ['mtn_momo'],
    ET: ['telebirr'],
  },
};

const COUNTRY_PAYMENT_PRIORITY = {
  KE: {
    deposits: ['daraja', 'jenga', 'paystack_mpesa'],
    withdrawals: ['daraja_b2c', 'jenga_mobile_wallet', 'paystack_mobile_money'],
  },
  UG: {
    deposits: ['mtn_momo_request_to_pay', 'jenga'],
    withdrawals: ['mtn_momo_transfer', 'jenga_mobile_wallet', 'paystack'],
  },
  TZ: {
    deposits: ['tanzania_wallet_prompt', 'jenga'],
    withdrawals: ['tanzania_wallet_b2c', 'jenga_mobile_wallet'],
  },
  GH: {
    deposits: ['mtn_momo_request_to_pay', 'paystack'],
    withdrawals: ['mtn_momo_transfer', 'paystack_mobile_money'],
  },
  ET: {
    deposits: ['telebirr_app_approval'],
    withdrawals: ['telebirr_transfer'],
  },
  NG: {
    deposits: ['paystack_card', 'paystack_bank_transfer', 'paystack_ussd'],
    withdrawals: ['paystack_bank_transfer'],
  },
  ZA: {
    deposits: ['paystack_card', 'paystack_qr', 'paystack_capitec_pay'],
    withdrawals: ['paystack_bank_transfer'],
  },
};

const PROVIDER_STATUS = {
  jenga: 'verified_public_docs',
  daraja: 'verified_public_docs',
  paystack: 'verified_public_docs',
  mtn_momo: 'partially_verified_public_docs',
  telebirr: 'commercial_confirmation_needed',
  tanzania_wallet_prompt: 'commercial_confirmation_needed',
  tanzania_wallet_b2c: 'commercial_confirmation_needed',
};

const getPaymentPriorityForCountry = (country) => COUNTRY_PAYMENT_PRIORITY[country] || {
  deposits: ['paystack'],
  withdrawals: ['paystack'],
};

module.exports = {
  HYBRID_PAYMENT_STACK,
  COUNTRY_PAYMENT_PRIORITY,
  PROVIDER_STATUS,
  getPaymentPriorityForCountry,
};
