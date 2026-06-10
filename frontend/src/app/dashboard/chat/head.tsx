import { SITE_URL } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>Job Chats | CashFlowHubs</title>
      <meta
        name="description"
        content="Use the CashFlowHubs in-app chat to communicate with employers and clients about remote jobs and freelance opportunities."
      />
      <meta name="robots" content="noindex,nofollow" />
      <link rel="canonical" href={`${SITE_URL}/dashboard/chat`} />
    </>
  );
}
