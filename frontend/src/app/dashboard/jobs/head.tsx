import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Remote Jobs in Africa | CashFlowHubs</title>
      <meta
        name="description"
        content="Browse legitimate remote job listings across Africa on CashFlowHubs. Filter by category, type, and location."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/jobs`} />
    </>
  );
}
