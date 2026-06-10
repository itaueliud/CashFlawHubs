import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Superadmin | CashFlowHubs</title>
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/superadmin`} />
    </>
  );
}
