'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Briefcase, CheckCircle2, Coins, ExternalLink, History, Lock, Radio, Sparkles, X } from 'lucide-react';

export default function CashTasksPage() {
  const { user } = useAuthStore();
  const [activeProviderKey, setActiveProviderKey] = useState<string | null>(null);

  const { data: providersData } = useQuery({
    queryKey: ['cash-tasks-providers'],
    queryFn: () => api.get('/cash-tasks/providers').then((response) => response.data),
    enabled: !!user?.activationStatus,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['cash-tasks-feed'],
    queryFn: () => api.get('/tasks').then((response) => response.data),
    enabled: !!user?.activationStatus,
  });

  const { data: historyData } = useQuery({
    queryKey: ['cash-tasks-history'],
    queryFn: () => api.get('/cash-tasks/history?limit=8').then((response) => response.data),
    enabled: !!user?.activationStatus,
  });

  const { data: launchData, isLoading: isLaunchLoading, error: launchError } = useQuery({
    queryKey: ['cash-tasks-launch', activeProviderKey],
    queryFn: () => api.get(`/cash-tasks/launch/${activeProviderKey}`).then((response) => response.data),
    enabled: !!user?.activationStatus && !!activeProviderKey,
  });

  if (!user?.activationStatus) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-orange-500/20 bg-gradient-to-br from-orange-950 via-slate-950 to-slate-900 px-6 py-16 text-center shadow-2xl shadow-orange-950/20">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-300">
          <Lock size={30} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-white">Activation required</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
          Activate your account to browse cash-task providers and the internal task board.
        </p>
        <Link href="/dashboard/activate" className="btn-primary mt-6 inline-flex items-center gap-2">
          Activate Now <ArrowLeft size={14} className="rotate-180" />
        </Link>
      </div>
    );
  }

  const providers = providersData?.liveProviders || [];
  const plannedProviders = providersData?.plannedProviders || [];
  const tasks = tasksData?.tasks || [];
  const cashTasks = tasks.filter((task: any) => task.rewardUSD >= 0.5 || task.isPremium);
  const history = historyData?.transactions || [];
  const activeProvider = useMemo(
    () => providers.find((provider: any) => provider.key === activeProviderKey) || null,
    [providers, activeProviderKey]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="overflow-hidden rounded-[2rem] border border-orange-500/20 bg-gradient-to-br from-orange-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-orange-950/20 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
              <Sparkles size={12} /> Cash task hub
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Cash Tasks</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Browse verified cash-task providers, view your higher-value task queue, and keep the full flow inside your dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Live providers</div>
                <div className="text-2xl font-black text-orange-300">{providers.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Planned providers</div>
                <div className="text-2xl font-black text-white">{plannedProviders.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Cash task queue</div>
                <div className="text-2xl font-black text-white">{cashTasks.length}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { label: 'Verified workflow', value: 'Internal task board, not a dead-end redirect', icon: CheckCircle2 },
              { label: 'Wallet-safe', value: 'Reward history is tracked from the task system', icon: Coins },
              { label: 'In-site launch', value: 'Provider cards open inside the dashboard shell', icon: Radio },
              { label: 'Production ready', value: 'Launch sessions, history, and activation guardrails', icon: History },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
                  <item.icon size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="text-xs leading-5 text-slate-400">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr]">
        <div className="grid gap-4 xl:grid-cols-2">
          {providers.map((provider: any) => (
            <div key={provider.key} className="group rounded-[1.5rem] border border-orange-500/10 bg-slate-900/90 p-5 transition-all hover:-translate-y-1 hover:border-orange-400/30 hover:shadow-xl hover:shadow-orange-950/20">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="badge-green">Live board</span>
                    <span className="badge" style={{ background: 'rgba(251,146,60,0.12)', color: '#fdba74' }}>
                      {provider.integrationType}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-white">{provider.name}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-300 transition-transform group-hover:scale-105">
                  <Briefcase size={18} />
                </div>
              </div>

              <p className="mb-4 text-sm leading-6 text-slate-300">{provider.description}</p>

              <div className="mb-5 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>{provider.access.replace(/_/g, ' ')}</span>
                <span>{provider.badge}</span>
              </div>

              <button
                type="button"
                onClick={() => setActiveProviderKey(provider.key)}
                className="inline-flex items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-200 transition hover:border-orange-300/50 hover:bg-orange-500/15"
              >
                Open board <ExternalLink size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-orange-500/10 bg-slate-900/90 p-5">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.25em] text-slate-500">Cash task queue</div>
            <h2 className="text-xl font-bold text-white">Top opportunities</h2>
          </div>

          <div className="space-y-3">
            {cashTasks.length > 0 ? (
              cashTasks.slice(0, 4).map((task: any) => (
                <div key={task._id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{task.title}</div>
                      <div className="text-xs text-slate-500">{task.category.toUpperCase()} / {task.source}</div>
                    </div>
                    <span className={task.unlocked ? 'badge-green' : 'badge-blue'}>
                      ${Number(task.rewardUSD || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-3 text-xs leading-5 text-slate-400">{task.description}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-400">
                No higher-value tasks are active yet.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-orange-500/10 to-slate-950 px-4 py-4">
            <div className="text-sm font-semibold text-white">Production checklist</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-orange-300" /> Keep the board inside the dashboard shell</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-orange-300" /> Track history with the same wallet-safe transaction log</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-orange-300" /> Add provider accounts when live APIs are ready</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
            <div className="mb-2 text-sm font-semibold text-white">Recent earnings</div>
            {history.length > 0 ? (
              <div className="space-y-2 text-xs">
                {history.slice(0, 3).map((tx: any) => (
                  <div key={tx._id} className="flex items-center justify-between rounded-xl border border-slate-700 px-3 py-2">
                    <div>
                      <div className="font-semibold text-slate-200">{tx.metadata?.source || 'internal'}</div>
                      <div className="text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="font-semibold text-green-300">+${Number(tx.amountUSD || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No cash-task earnings yet.</div>
            )}
          </div>
        </div>
      </div>

      {activeProviderKey ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/75 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-6xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-4 border-b border-slate-700 px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Cash task drawer</div>
                <div className="mt-1 text-lg font-black text-white">{activeProvider?.name || activeProviderKey}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveProviderKey(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white"
                aria-label="Close cash task drawer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[1.25fr_0.75fr]">
              <div className="min-h-0 overflow-hidden border-r border-slate-800 bg-slate-950/90">
                <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-200">Task board preview</div>
                <div className="min-h-[65vh] bg-slate-900">
                  {launchError ? (
                    <div className="flex min-h-[65vh] items-center justify-center px-6 text-center text-slate-300">
                      Cash task board could not be loaded.
                    </div>
                  ) : isLaunchLoading || !launchData?.launchUrl ? (
                    <div className="flex min-h-[65vh] items-center justify-center px-6 text-slate-300">
                      Loading board...
                    </div>
                  ) : (
                    <iframe
                      src={launchData.launchUrl}
                      title={`${activeProvider?.name || activeProviderKey} cash task board`}
                      className="h-[65vh] w-full border-0"
                      allow="clipboard-read; clipboard-write; fullscreen; payment; geolocation; microphone; camera"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-4 overflow-y-auto p-5">
                <div className="card">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Provider status</div>
                  <div className="mt-2 text-xl font-black text-white">Open inside site</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Cash-task providers stay inside your dashboard shell and point to the internal task board.
                  </p>
                </div>

                {activeProvider ? (
                  <div className="card space-y-3">
                    <div className="text-sm font-semibold text-white">Provider details</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {activeProvider.integrationType} / {activeProvider.access.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm text-slate-300">{activeProvider.description}</div>
                    <span className="badge-green w-fit">{activeProvider.badge}</span>
                  </div>
                ) : null}

                <div className="card space-y-3">
                  <div className="text-sm font-semibold text-white">Board note</div>
                  <p className="text-sm text-slate-300">
                    This launch route stays on your site and is ready for live provider accounts when you add them.
                  </p>
                  <Link href="/dashboard/tasks" className="btn-primary inline-flex items-center gap-2">
                    Open full task board <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
