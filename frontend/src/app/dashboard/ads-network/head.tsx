import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Ads Network | CashFlowHubs</title>
      <meta
        name="description"
        content="Earn rewards through the CashFlowHubs Ads Network by viewing and interacting with partner promotions."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/ads-network`} />
    </>
  );
}
