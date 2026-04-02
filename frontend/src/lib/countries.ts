export const COUNTRIES_CONFIG: Record<string, { name: string; currency: string; symbol: string; flag: string; fee: string; payment: string }> = {
  KE: { name: 'Kenya',    currency: 'KES', symbol: 'KSh', flag: '🇰🇪', fee: '500 KES',    payment: 'M-Pesa' },
  UG: { name: 'Uganda',   currency: 'UGX', symbol: 'USh', flag: '🇺🇬', fee: '16,650 UGX', payment: 'MTN MoMo' },
  TZ: { name: 'Tanzania', currency: 'TZS', symbol: 'TSh', flag: '🇹🇿', fee: '11,500 TZS', payment: 'Vodacom' },
  ET: { name: 'Ethiopia', currency: 'ETB', symbol: 'Br',  flag: '🇪🇹', fee: '2,250 ETB',  payment: 'Telebirr' },
  GH: { name: 'Ghana',    currency: 'GHS', symbol: 'GH₵', flag: '🇬🇭', fee: 'GH₵18',     payment: 'Flutterwave' },
  NG: { name: 'Nigeria',  currency: 'NGN', symbol: '₦',   flag: '🇳🇬', fee: '₦6,500',    payment: 'Flutterwave' },
};

export const formatCurrency = (amountUSD: number, country: string): string => {
  const config = COUNTRIES_CONFIG[country];
  if (!config) return `$${amountUSD.toFixed(2)}`;
  return `${config.symbol}${(amountUSD).toFixed(2)}`;
};
