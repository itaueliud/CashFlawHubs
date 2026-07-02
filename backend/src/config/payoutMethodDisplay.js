const PAYOUT_METHOD_DISPLAY = {
  daraja_b2c:            { id: 'mpesa',           label: 'M-Pesa',            icon: '📱', category: 'mobile_money' },
  pawapay:                { id: 'pawapay',         label: 'Mobile Money',      icon: '💳', category: 'mobile_money' },
  paystack:               { id: 'paystack',        label: 'Paystack',         icon: '💳', category: 'card_bank' },
  paystack_mobile_money:  { id: 'paystack_mm',     label: 'Mobile Money (Paystack)', icon: '💳', category: 'mobile_money' },
  paystack_bank_transfer: { id: 'paystack_bank',   label: 'Bank Transfer',    icon: '🏦', category: 'bank' },
  mtn_momo_transfer:      { id: 'mtn_momo',        label: 'MTN MoMo',         icon: '📲', category: 'mobile_money' },
  tanzania_wallet_b2c:    { id: 'tanzania_wallet',  label: 'Mobile Wallet',    icon: '💳', category: 'mobile_money' },
  telebirr_transfer:      { id: 'telebirr',        label: 'Telebirr',         icon: '📱', category: 'mobile_money' },
};

module.exports = { PAYOUT_METHOD_DISPLAY };
