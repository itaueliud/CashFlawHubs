import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Wallet | CashFlowHubs</title>
      <meta
        name="description"
        content="View your CashFlowHubs balance and withdraw to M-Pesa, MTN MoMo, Flutterwave, Telebirr, and other supported mobile wallets."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/wallet`} />
    </>
  );
}
