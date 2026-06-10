import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Create a Free Account - CashFlowHubs</title>
      <meta
        name="description"
        content="Sign up for CashFlowHubs in minutes. Join thousands of Africans earning online through surveys, microtasks, and remote jobs with instant mobile-money withdrawals."
      />
      <link rel="canonical" href={`${SITE_URL}/register`} />
      <meta property="og:title" content="Join CashFlowHubs - Earn Online Across Africa" />
      <meta property="og:description" content="Surveys, microtasks, remote jobs, instant mobile-money payouts." />
      <meta property="og:image" content={`${SITE_URL}/og-register.svg`} />
      <meta name="twitter:card" content="summary_large_image" />
    </>
  );
}
