import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Daily Challenges | CashFlowHubs</title>
      <meta
        name="description"
        content="Complete daily challenges on CashFlowHubs to earn bonus rewards and climb the leaderboard."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/challenges`} />
    </>
  );
}
