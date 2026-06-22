import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Creator HUB Coming Soon | CashFlowHubs</title>
      <meta
        name="description"
        content="Creator HUB is coming soon on CashFlowHubs."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/ads-network`} />
    </>
  );
}