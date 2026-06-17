import { Briefcase } from 'lucide-react';
import ModuleEmbedClient from '@/components/dashboard/ModuleEmbedClient';
import { resolveEmbedSource } from '@/lib/embeds';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const iframeSource = resolveEmbedSource(
  'NEXT_PUBLIC_OFFERS_IFRAME',
  'NEXT_PUBLIC_OFFERS_IFRAME_SRC',
  'NEXT_PUBLIC_OFFERS_URL',
  'NEXT_PUBLIC_OFFERS_SRC',
  'NEXT_PUBLIC_OFFERS_LINK',
  'NEXT_PUBLIC_OFFERS_EMBED',
  'VITE_OFFERS_IFRAME',
  'VITE_OFFERS_URL'
);

export default function OffersPage() {
  return (
    <ModuleEmbedClient
      title="Offers"
      description="Browse partner offers inside the embedded wall and complete the ones that fit your time."
      badge="Live"
      icon={<Briefcase size={28} />}
      iframeSource={iframeSource}
      iframeTitle="Offers"
      highlights={[
        { label: 'Partner offers', detail: 'Install, sign up, or complete the campaign requirements to qualify.', tone: 'from-emerald-500/15 to-emerald-500/5' },
        { label: 'Extra earning layer', detail: 'This sits alongside your existing earning tabs and modules.', tone: 'from-cyan-500/15 to-cyan-500/5' },
        { label: 'No DB changes', detail: 'This is purely frontend integration with your provided embed source.', tone: 'from-slate-500/15 to-slate-500/5' },
      ]}
      emptyMessage="Offers is not configured yet."
    />
  );
}
