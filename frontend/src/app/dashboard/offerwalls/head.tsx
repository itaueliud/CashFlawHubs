import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Offerwalls | CashFlowHubs</title>
      <meta
        name="description"
        content="Complete offerwalls on CashFlowHubs: install apps, sign up for services, and complete partner campaigns for cash rewards."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/offerwalls`} />
    </>
  );
}
