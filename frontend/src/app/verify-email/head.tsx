import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Verify Your Email | CashFlowHubs</title>
      <meta name="description" content="Confirm your CashFlowHubs email address to finish setting up your account." />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/verify-email`} />
    </>
  );
}
