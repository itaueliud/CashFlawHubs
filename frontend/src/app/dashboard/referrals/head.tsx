import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Referral Earnings | CashFlowHubs</title>
      <meta
        name="description"
        content="Earn referral rewards on CashFlowHubs by inviting friends and helping them get started."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/referrals`} />
    </>
  );
}
