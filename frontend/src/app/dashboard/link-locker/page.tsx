import { Link2 } from 'lucide-react';
import ModuleEmbedClient from '@/components/dashboard/ModuleEmbedClient';
import { resolveEmbedSource } from '@/lib/embeds';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const iframeSource = resolveEmbedSource(
  'NEXT_PUBLIC_LINK_LOCKER_IFRAME',
  'NEXT_PUBLIC_LINK_LOCKER_IFRAME_SRC',
  'NEXT_PUBLIC_LINK_LOCKER_URL',
  'NEXT_PUBLIC_LINK_LOCKER_SRC',
  'NEXT_PUBLIC_LINKLOCKER_URL',
  'NEXT_PUBLIC_LINKLOCKER_SRC',
  'VITE_LINK_LOCKER_IFRAME',
  'VITE_LINK_LOCKER_URL'
);

export default function LinkLockerPage() {
  return (
    <ModuleEmbedClient
      title="Link Locker"
      description="Complete link locker steps in the embedded provider wall to unlock rewards."
      badge="Live"
      icon={<Link2 size={28} />}
      iframeSource={iframeSource}
      iframeTitle="Link Locker"
      highlights={[
        { label: 'Unlock partner links', detail: 'Complete the required steps without leaving the dashboard.', tone: 'from-emerald-500/15 to-emerald-500/5' },
        { label: 'Rewards on verify', detail: 'The provider confirms completion before any credit is issued.', tone: 'from-cyan-500/15 to-cyan-500/5' },
        { label: 'Existing tabs stay', detail: 'This is added alongside your current dashboard navigation.', tone: 'from-slate-500/15 to-slate-500/5' },
      ]}
      emptyMessage="Link Locker is not configured yet."
    />
  );
}
