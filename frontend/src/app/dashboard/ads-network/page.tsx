'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, History, Lock, Radio, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function AdsNetworkPage() {
  const { user } = useAuthStore();
  const { data } = useQuery({
    queryKey: ['ads-network-providers'],
    queryFn: () => api.get('/ads-network/providers').then((r) => r.data),
    enabled: !!user?.activationStatus,
  });

  const { data: historyData } = useQuery({
    queryKey: ['ads-network-history'],
    queryFn: () => api.get('/ads-network/history?limit=8').then((r) => r.data),
    enabled: !!user?.activationStatus,
  });

  const launchMutation = useMutation({
    mutationFn: async (providerKey: string) => {
      const response = await api.get(`/ads-network/launch/${providerKey}`);
      return response.data;
    },
    onSuccess: (payload) => {
      if (payload?.wallUrl && typeof window !== 'undefined') {
        window.open(payload.wallUrl, '_blank', 'noopener,noreferrer');
        toast.success('Ad network opened');
      } else {
        toast.error('Provider URL is unavailable');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Unable to open ad network');
    },
  });

  if (!user?.activationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Activation Required</h2>
        <p className="text-slate-400 mb-4">Activate your account to access live ad-network offers and rewarded campaigns.</p>
        <a href="/dashboard/activate" className="btn-primary mt-2">Activate Now</a>
      </div>
    );
  }

  const liveProviders = data?.liveProviders || [];
  const plannedProviders = data?.plannedProviders || [];
  const history = historyData?.transactions || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black">Ads / Ad Network</h1>
          <p className="text-slate-400 text-sm mt-1">Live rewarded ad partners first, with future SDK and network slots kept separate.</p>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Operational Now</div>
          <div className="text-2xl font-black text-green-400">{data?.activeProviders || 0}</div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-green-400" />
          <h2 className="text-lg font-bold">Live Ad Networks</h2>
        </div>

        {liveProviders.length === 0 ? (
          <div className="card text-sm text-slate-400">No ad-network providers are configured yet. Add provider credentials to enable live traffic.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {liveProviders.map((provider: any) => (
              <div key={provider.key} className="card border-green-500/20 bg-green-500/[0.03]">
                <div className="flex items-start justify-between mb-3">
                  <Radio className="text-cyan-400" size={28} />
                  <span className="badge-green">Live</span>
                </div>
                <h3 className="font-bold text-lg mb-1">{provider.name}</h3>
                <p className="text-slate-400 text-sm mb-3">{provider.description}</p>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
                  {provider.integrationType} / {provider.access.replace(/_/g, ' ')}
                </div>
                <button
                  onClick={() => launchMutation.mutate(provider.key)}
                  disabled={launchMutation.isPending}
                  className="btn-primary text-sm inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Open Ad Offers <ExternalLink size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Coming Soon</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {plannedProviders.map((provider: any) => (
            <div key={provider.key} className="card opacity-90">
              <div className="flex items-start justify-between mb-3">
                <Radio className="text-slate-500" size={28} />
                <span className="badge-blue">{provider.badge}</span>
              </div>
              <h3 className="font-bold text-lg mb-1">{provider.name}</h3>
              <p className="text-slate-400 text-sm mb-3">{provider.description}</p>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {provider.integrationType} / {provider.access.replace(/_/g, ' ')}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-cyan-300" />
          <h2 className="text-lg font-bold">Recent Ad Earnings</h2>
        </div>

        {history.length === 0 ? (
          <div className="card text-sm text-slate-400">No ad-network earnings yet. Open a live ad provider to start earning.</div>
        ) : (
          <div className="card space-y-3">
            {history.map((tx: any) => (
              <div key={tx._id} className="flex items-center justify-between border-b border-slate-700 pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm font-semibold text-white">{tx.metadata?.providerName || tx.metadata?.provider || 'Ad reward'}</div>
                  <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-sm font-semibold text-green-400">+${Number(tx.amountUSD || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
