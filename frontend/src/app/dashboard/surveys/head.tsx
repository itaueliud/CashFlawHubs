import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Paid Surveys | CashFlowHubs</title>
      <meta
        name="description"
        content="Complete paid surveys on CashFlowHubs and earn real money per submission. New surveys are added regularly."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/surveys`} />
    </>
  );
}
