'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ExternalLink, Radio } from 'lucide-react';

export default function AdsNetworkPage() {
  const { data } = useQuery({
    queryKey: ['category-providers', 'ads_network'],
    queryFn: () => api.get('/catalog/categories/ads_network/providers').then((r) => r.data),
  });

  const providers = data?.providers || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Ads / Ad Network</h1>
        <p className="text-slate-400 text-sm mt-1">SDKs, rewarded ads, and ad network providers by category</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((provider: any) => (
          <div key={provider.key} className="card">
            <div className="flex items-start justify-between mb-3">
              <Radio className="text-cyan-400" size={28} />
              <span className={provider.live ? 'badge-green' : 'badge-blue'}>{provider.badge}</span>
            </div>
            <h3 className="font-bold text-lg mb-1">{provider.name}</h3>
            <p className="text-slate-400 text-sm mb-3">{provider.description}</p>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
              {provider.integrationType} / {provider.access.replace(/_/g, ' ')}
            </div>
            {provider.url ? (
              <a href={provider.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm inline-flex items-center gap-2">
                Open Ad Offers <ExternalLink size={14} />
              </a>
            ) : (
              <div className="text-slate-500 text-sm">This ad network entry is cataloged for future SDK or API rollout.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
