import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Freelance Gigs | CashFlowHubs</title>
      <meta
        name="description"
        content="Offer your skills on CashFlowHubs Freelance and connect with clients across Africa and globally."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/freelance`} />
    </>
  );
}
