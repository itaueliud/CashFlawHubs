import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Admin Console | CashFlowHubs</title>
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/admin`} />
    </>
  );
}
