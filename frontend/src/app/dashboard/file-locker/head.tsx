import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>File Locker | CashFlowHubs</title>
      <meta
        name="description"
        content="Complete file locker tasks on CashFlowHubs and earn rewards through the embedded provider wall."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/file-locker`} />
    </>
  );
}
