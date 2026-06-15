export const COUNTRIES_CONFIG: Record<string, { name: string; currency: string; symbol: string; flag: string; fee: string; payment: string; dialCode: string }> = {
  BJ: { name: 'Benin',              currency: 'XOF', symbol: 'Fr',  flag: '🇧🇯', fee: '3,000 Fr',     payment: 'Flutterwave', dialCode: '+229' },
  BF: { name: 'Burkina Faso',       currency: 'XOF', symbol: 'Fr',  flag: '🇧🇫', fee: '3,000 Fr',     payment: 'Flutterwave', dialCode: '+226' },
  CM: { name: 'Cameroon',           currency: 'XAF', symbol: 'Fr',  flag: '🇨🇲', fee: '3,200 Fr',     payment: 'Flutterwave', dialCode: '+237' },
  CG: { name: 'Congo-Brazzaville',  currency: 'XAF', symbol: 'Fr',  flag: '🇨🇬', fee: '3,200 Fr',     payment: 'Flutterwave', dialCode: '+242' },
  CD: { name: 'DRC (Dem. Rep. Congo)', currency: 'CDF', symbol: 'Fr', flag: '🇨🇩', fee: '2,500 Fr',     payment: 'Flutterwave', dialCode: '+243' },
  ET: { name: 'Ethiopia',           currency: 'ETB', symbol: 'Br',  flag: '🇪🇹', fee: '2,250 ETB',    payment: 'Telebirr', dialCode: '+251' },
  GA: { name: 'Gabon',              currency: 'XAF', symbol: 'Fr',  flag: '🇬🇦', fee: '3,200 Fr',     payment: 'Flutterwave', dialCode: '+241' },
  GH: { name: 'Ghana',              currency: 'GHS', symbol: 'GH₵', flag: '🇬🇭', fee: 'GH₵18',       payment: 'Flutterwave', dialCode: '+233' },
  CI: { name: 'Ivory Coast (Côte d\'Ivoire)', currency: 'XOF', symbol: 'Fr',  flag: '🇨🇮', fee: '3,000 Fr', payment: 'Flutterwave', dialCode: '+225' },
  KE: { name: 'Kenya',              currency: 'KES', symbol: 'KSh', flag: '🇰🇪', fee: '500 KES',      payment: 'M-Pesa', dialCode: '+254' },
  LS: { name: 'Lesotho',            currency: 'LSL', symbol: 'L',   flag: '🇱🇸', fee: '80 LSL',       payment: 'Flutterwave', dialCode: '+266' },
  MW: { name: 'Malawi',             currency: 'MWK', symbol: 'MK',  flag: '🇲🇼', fee: '850 MWK',      payment: 'Flutterwave', dialCode: '+265' },
  MZ: { name: 'Mozambique',         currency: 'MZN', symbol: 'MT',  flag: '🇲🇿', fee: '3,200 MT',     payment: 'Flutterwave', dialCode: '+258' },
  NG: { name: 'Nigeria',            currency: 'NGN', symbol: '₦',   flag: '🇳🇬', fee: '₦6,500',      payment: 'Flutterwave', dialCode: '+234' },
  RW: { name: 'Rwanda',             currency: 'RWF', symbol: 'Fr',  flag: '🇷🇼', fee: '6,500 Fr',     payment: 'Flutterwave', dialCode: '+250' },
  SN: { name: 'Senegal',            currency: 'XOF', symbol: 'Fr',  flag: '🇸🇳', fee: '3,000 Fr',     payment: 'Flutterwave', dialCode: '+221' },
  SL: { name: 'Sierra Leone',       currency: 'SLL', symbol: 'Le',  flag: '🇸🇱', fee: '13,000 Le',    payment: 'Flutterwave', dialCode: '+232' },
  TZ: { name: 'Tanzania',           currency: 'TZS', symbol: 'TSh', flag: '🇹🇿', fee: '11,500 TZS',   payment: 'Vodacom', dialCode: '+255' },
  UG: { name: 'Uganda',             currency: 'UGX', symbol: 'USh', flag: '🇺🇬', fee: '16,650 UGX',   payment: 'MTN MoMo', dialCode: '+256' },
  ZM: { name: 'Zambia',             currency: 'ZMW', symbol: 'ZK',  flag: '🇿🇲', fee: '20 ZMW',       payment: 'Flutterwave', dialCode: '+260' },
};

export const formatCurrency = (amountUSD: number, country: string): string => {
  const config = COUNTRIES_CONFIG[country];
  if (!config) return `$${amountUSD.toFixed(2)}`;
  return `${config.symbol}${(amountUSD).toFixed(2)}`;
};
