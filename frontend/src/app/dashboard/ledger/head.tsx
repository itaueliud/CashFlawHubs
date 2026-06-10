import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Ledger | CashFlowHubs</title>
      <meta
        name="description"
        content="View your full earnings history, export reports, and reconcile your CashFlowHubs account."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/ledger`} />
    </>
  );
}
