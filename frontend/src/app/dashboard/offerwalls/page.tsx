'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { resolveEmbedSource } from '@/lib/embeds';
import { Loader2, Lock, Gift, RefreshCw, ExternalLink, Clock, CheckCircle2, XCircle, ListFilter, LayoutGrid } from 'lucide-react';

type RewardTx = {
  _id: string;
  amountUSD: number;
  status?: string;
  createdAt: string;
};

type OfferTab = 'wall' | 'offers' | 'timewall';

function StatusBadge({ status }: { status?: string }) {
  const normalized = String(status || '').toLowerCase();
  const map: Record<string, { label: string; cls: string; icon: JSX.Element }> = {
    pending: { label: 'Pending', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: <Clock size={11} /> },
    successful: { label: 'Successful', cls: 'bg-green-500/15 text-green-400 border-green-500/30', icon: <CheckCircle2 size={11} /> },
    reversed: { label: 'Reversed', cls: 'bg-red-500/15 text-red-400 border-red-500/30', icon: <XCircle size={11} /> },
    failed: { label: 'Failed', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30', icon: <XCircle size={11} /> },
  };
  const item = map[normalized] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${item.cls}`}>
      {item.icon} {item.label}
    </span>
  );
}

export default function OfferwallsPage() {
  const { user, hasHydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<OfferTab>('wall');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [frameVersion, setFrameVersion] = useState(0);
  const isOfferwallsUnlocked = Boolean(user?.activationStatus);

  const PLACEHOLDER_EMBED_SOURCES = new Set([
    'https://www.cdnflair.com/wall/dJ6T',
    'https://timewall.io/o/440de2b21c4ecb1c',
  ]);

  const normalizeEnvEmbed = (...keys: string[]) => {
    const rawValue = resolveEmbedSource(...keys);
    return rawValue && !PLACEHOLDER_EMBED_SOURCES.has(rawValue) ? rawValue : '';
  };

  const envOfferwallSrc = normalizeEnvEmbed('NEXT_PUBLIC_CPALEAD_OFFERWALL_URL', 'VITE_CPALEAD_OFFERWALL_URL');
  const envBrowseOffersSrc = normalizeEnvEmbed(
    'NEXT_PUBLIC_CPALEAD_NATIVE_OFFERS_URL',
    'NEXT_PUBLIC_CPALEAD_OFFERS_URL',
    'VITE_CPALEAD_NATIVE_OFFERS_URL',
    'VITE_CPALEAD_OFFERS_URL',
    'NEXT_PUBLIC_CPALEAD_OFFERWALL_URL',
    'VITE_CPALEAD_OFFERWALL_URL'
  );
  const timewallSrc = resolveEmbedSource('NEXT_PUBLIC_TIMEWALL_OFFERWALLS_URL', 'VITE_TIMEWALL_OFFERWALLS_URL') || 'https://timewall.io/o/440de2b21c4ecb1c';

  const offerwallSrc = envOfferwallSrc || 'https://www.cdnflair.com/wall/dJ6T';
  const browseOffersSrc = envBrowseOffersSrc || offerwallSrc;
  const currentSrc = activeTab === 'wall' ? offerwallSrc : activeTab === 'offers' ? browseOffersSrc : timewallSrc;
  const currentTitle = activeTab === 'wall' ? 'CPAlead Offerwall' : activeTab === 'offers' ? 'Browse Offers' : 'Timewall Offerwall';
  const currentDescription =
    activeTab === 'wall'
      ? 'Main CPAlead wall for rewarded tasks and conversions.'
      : activeTab === 'offers'
        ? browseOffersSrc === offerwallSrc
          ? 'Browse Offers uses the same provider feed until a dedicated native-offers URL is set.'
          : 'Native partner offers feed shown inside the same dashboard module.'
        : 'Timewall rewarded offers shown in the same dashboard space.';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIframeLoaded(false);
    setIframeError(false);
  }, [currentSrc, activeTab]);

  const { data: rewardsData, isLoading: rewardsLoading } = useQuery({
    queryKey: ['timewall-offer-rewards', user?.id],
    queryFn: () => api.get<{ transactions: RewardTx[] }>('/wallet/transactions?type=offer&limit=10').then((response) => response.data),
    enabled: hasHydrated && !!user?.id && isOfferwallsUnlocked,
    refetchInterval: 60_000,
  });

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-400">
        <Loader2 className="animate-spin text-emerald-400" size={24} />
        Loading offerwalls...
      </div>
    );
  }

  if (!isOfferwallsUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-[2rem] border border-slate-700 bg-slate-900/60 px-6 py-12 text-center">
        <Lock size={48} className="text-slate-600" />
        <h2 className="text-2xl font-black">Activation Required</h2>
        <p className="max-w-lg text-sm text-slate-400">
          Activate your account to access offerwalls and start earning real USD rewards.
        </p>
        <Link href="/dashboard/activate" className="btn-primary inline-flex items-center gap-2">
          Activate Now <ExternalLink size={14} />
        </Link>
      </div>
    );
  }

  const rewards: RewardTx[] = rewardsData?.transactions || [];

  const renderTab = (tab: OfferTab, icon: JSX.Element, label: string, description: string) => (
    <button
      type="button"
      onClick={() => {
        setActiveTab(tab);
        setFrameVersion(0);
      }}
      className={`flex min-w-[170px] flex-col rounded-2xl border px-4 py-3 text-left transition ${
        activeTab === tab
          ? 'border-emerald-500/40 bg-emerald-500/15 text-white'
          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-white'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </span>
      <span className="mt-1 text-xs text-slate-400">{description}</span>
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900">
        <div className="absolute right-4 top-4">
          <span className="badge-green">Live</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-400">
            <Gift size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Offerwalls</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Complete offers and tasks to earn real USD rewards directly to your wallet.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Complete offers -> Earn USD', detail: 'Turn partner tasks into spendable balance', tone: 'from-emerald-500/15 to-emerald-500/5' },
          { label: 'Instant wallet credit', detail: 'Rewards land in your wallet after verification', tone: 'from-cyan-500/15 to-cyan-500/5' },
          { label: 'Verified & secure', detail: 'Protected postbacks and duplicate checks', tone: 'from-slate-500/15 to-slate-500/5' },
        ].map((item) => (
          <div key={item.label} className={`card bg-gradient-to-br ${item.tone}`}>
            <div className="text-sm font-semibold text-white">{item.label}</div>
            <div className="mt-2 text-xs text-slate-400">{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden border-emerald-500/20 bg-slate-950/70 p-0">
        <div className="flex flex-col gap-4 border-b border-slate-800 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-200">{currentTitle}</div>
            <div className="text-xs text-slate-500">{currentDescription}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {renderTab('wall', <LayoutGrid size={14} />, 'CPAlead Offerwall', 'Main rewarded offerwall content')}
            {renderTab('offers', <ListFilter size={14} />, 'Browse Offers', 'Native CPAlead offers feed')}
            {renderTab('timewall', <Gift size={14} />, 'Timewall', 'Timewall rewards feed')}
            <button
              onClick={() => {
                setIframeLoaded(false);
                setIframeError(false);
                setFrameVersion((value) => value + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        <div className="relative min-h-[700px] w-full">
          {!currentSrc ? (
            <div className="flex h-[700px] items-center justify-center text-sm text-slate-400">
              {activeTab === 'wall'
                ? 'Offerwalls are unavailable right now.'
                : activeTab === 'offers'
                  ? 'Browse Offers is unavailable right now.'
                  : 'Timewall is unavailable right now.'}
            </div>
          ) : iframeError ? (
            <div className="flex h-[700px] flex-col items-center justify-center gap-3 px-6 text-center">
              <XCircle size={34} className="text-red-400" />
              <div className="text-sm text-slate-300">Failed to load the module.</div>
              <button onClick={() => window.location.reload()} className="btn-secondary inline-flex items-center gap-2 text-sm">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : (
            <>
              {!iframeLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80">
                  <Loader2 size={24} className="animate-spin text-emerald-400" />
                </div>
              )}
              <iframe
                src={currentSrc}
                key={`${currentSrc}-${frameVersion}`}
                width="100%"
                height="700px"
                frameBorder="0"
                title={currentTitle}
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
                className="block h-[700px] w-full"
                sandbox="allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
              />
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold">Recent Rewards</h2>
            <p className="text-sm text-slate-400">Your latest offerwall credits.</p>
          </div>
        </div>

        {rewardsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : rewards.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No offerwall rewards yet. Complete an offer above to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Amount USD</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rewards.map((reward) => (
                  <tr key={reward._id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-3 text-slate-300">{new Date(reward.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-400">${Number(reward.amountUSD || 0).toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={reward.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
