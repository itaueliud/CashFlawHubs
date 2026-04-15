'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ExternalLink, History, Lock, TimerReset, Wallet } from 'lucide-react';

const providerLabel = (provider: any) => provider?.badge || provider?.integrationType || 'Survey wall';

export default function SurveysPage() {
  const { user } = useAuthStore();
  const { data: feedData } = useQuery({
    queryKey: ['surveys-feed'],
    queryFn: () => api.get('/surveys/feed').then((r) => r.data),
    enabled: !!user?.activationStatus,
  });

  const { data: historyData } = useQuery({
    queryKey: ['survey-history'],
    queryFn: () => api.get('/surveys/history?limit=8').then((r) => r.data),
    enabled: !!user,
  });

  if (!user?.activationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Activation Required</h2>
        <p className="text-slate-400 mb-4">Activate your account to access paid surveys</p>
        <a href="/dashboard/activate" className="btn-primary">Activate Now - 500 KES</a>
      </div>
    );
  }

  const surveys = feedData?.surveys || [];
  const providers = feedData?.providers || [];
  const history = historyData?.transactions || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
              <Wallet size={12} /> Paid surveys
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Survey Wall</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Open live survey providers, complete eligible surveys, and track reward history from one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-slate-400">Live providers</div>
              <div className="text-2xl font-black text-blue-300">{providers.filter((provider: any) => provider.live).length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-slate-400">Survey options</div>
              <div className="text-2xl font-black text-white">{surveys.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {surveys.map((survey: any) => (
          <div key={survey.id} className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 shadow-lg shadow-blue-950/10 transition hover:-translate-y-1 hover:border-blue-400/30">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="badge-blue">${survey.rewardUSD.toFixed(2)}</span>
                  <span className="badge" style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd' }}>
                    {survey.estimatedMinutes} min
                  </span>
                </div>
                <div className="text-xl font-bold text-white">{survey.title}</div>
              </div>
              <TimerReset size={18} className="mt-2 text-blue-300" />
            </div>

            <p className="mb-4 text-sm leading-6 text-slate-300">{survey.description}</p>

            <div className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-500">
              {survey.countryNote}
            </div>

            <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              Provider: <span className="font-semibold text-white">{survey.provider?.name || 'Survey wall'}</span> · {providerLabel(survey.provider)}
            </div>

            {survey.provider?.url ? (
              <a href={survey.provider.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 transition hover:border-blue-300/50 hover:bg-blue-500/15">
                Open survey wall <ExternalLink size={14} />
              </a>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-500">
                This provider is not configured yet.
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Provider feed</div>
              <h2 className="text-xl font-bold text-white">Available walls</h2>
            </div>
            <History size={18} className="text-blue-300" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {providers.map((provider: any) => (
              <div key={provider.key} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{provider.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{provider.integrationType.toUpperCase()} / {provider.access.replace(/_/g, ' ')}</div>
                  </div>
                  <span className={provider.live ? 'badge-green' : 'badge-blue'}>{provider.badge}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{provider.description}</p>
                <div className="mt-3 text-xs text-slate-500">{provider.url ? 'Live and ready to open' : 'Credential setup pending'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Recent history</div>
            <h2 className="text-xl font-bold text-white">Survey earnings</h2>
          </div>

          <div className="space-y-3">
            {history.length > 0 ? history.map((tx: any) => (
              <div key={tx._id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{tx.metadata?.provider || 'Survey reward'}</div>
                    <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                  <span className="text-sm font-semibold text-green-400">+${Number(tx.amountUSD || 0).toFixed(2)}</span>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                No survey earnings yet. Open a wall to start earning.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
