import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>My Profile | CashFlowHubs</title>
      <meta
        name="description"
        content="Manage your CashFlowHubs account details, preferences, and verification status."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/profile`} />
    </>
  );
}
