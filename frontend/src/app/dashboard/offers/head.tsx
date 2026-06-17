import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Offers | CashFlowHubs</title>
      <meta
        name="description"
        content="Complete partner offers on CashFlowHubs and earn rewards through the embedded provider wall."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/offers`} />
    </>
  );
}
