import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Coming Soon | CashFlowHubs</title>
      <meta
        name="description"
        content="This Cash Tasks section is coming soon on CashFlowHubs."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/cash-tasks`} />
    </>
  );
}