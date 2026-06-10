import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Cash Tasks | CashFlowHubs</title>
      <meta
        name="description"
        content="Pick up cash tasks on CashFlowHubs and earn immediately. Tasks range from simple actions to short projects."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/cash-tasks`} />
    </>
  );
}
