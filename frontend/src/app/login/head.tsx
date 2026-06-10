import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Log In to Your Account | CashFlowHubs</title>
      <meta
        name="description"
        content="Sign in to CashFlowHubs to access your earnings dashboard, surveys, tasks, and wallet."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/login`} />
    </>
  );
}
