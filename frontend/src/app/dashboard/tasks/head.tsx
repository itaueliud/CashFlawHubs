import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Microtasks | CashFlowHubs</title>
      <meta
        name="description"
        content="Earn money by completing microtasks like image tagging, data labeling, app testing, and other quick jobs."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/tasks`} />
    </>
  );
}
