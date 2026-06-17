import { Lock } from 'lucide-react';
import ModuleEmbedClient from '@/components/dashboard/ModuleEmbedClient';
import { resolveEmbedSource } from '@/lib/embeds';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const iframeSource = resolveEmbedSource(
  'NEXT_PUBLIC_FILE_LOCKER_IFRAME',
  'NEXT_PUBLIC_FILE_LOCKER_IFRAME_SRC',
  'NEXT_PUBLIC_FILE_LOCKER_URL',
  'NEXT_PUBLIC_FILE_LOCKER_SRC',
  'NEXT_PUBLIC_FILELOCKER_URL',
  'NEXT_PUBLIC_FILELOCKER_SRC',
  'VITE_FILE_LOCKER_IFRAME',
  'VITE_FILE_LOCKER_URL'
);

export default function FileLockerPage() {
  return (
    <ModuleEmbedClient
      title="File Locker"
      description="Complete file-lock tasks to unlock rewards and continue through the earning flow."
      badge="Live"
      icon={<Lock size={28} />}
      iframeSource={iframeSource}
      iframeTitle="File Locker"
      highlights={[
        { label: 'Unlock file tasks', detail: 'Finish the gated steps inside the embedded wall.', tone: 'from-emerald-500/15 to-emerald-500/5' },
        { label: 'Track completions', detail: 'Rewards are confirmed by the provider and credited after verification.', tone: 'from-cyan-500/15 to-cyan-500/5' },
        { label: 'Safe & contained', detail: 'The module stays inside the dashboard without replacing your sidebar tabs.', tone: 'from-slate-500/15 to-slate-500/5' },
      ]}
      emptyMessage="File Locker is not configured yet."
    />
  );
}
