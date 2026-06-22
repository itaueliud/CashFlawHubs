import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Create Hub Coming Soon | CashFlowHubs</title>
      <meta
        name="description"
        content="Create Hub is coming soon on CashFlowHubs."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/ads-network`} />
    </>
  );
}
