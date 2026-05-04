'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { ArrowRight, BadgeCheck, BrainCircuit, Clock3, Globe2, Lock, Shield, Sparkles, ExternalLink, CheckCircle2, Coins } from 'lucide-react';

export default function TasksPage() {
  const { user } = useAuthStore();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const { data, refetch } = useQuery({
    queryKey: ['tasks-feed'],
    queryFn: () => api.get('/tasks').then((r) => r.data),
    enabled: !!user && !!user.activationStatus,
  });

  const tasks = data?.tasks || [];
  const summary = useMemo(() => ({
    live: tasks.filter((task: any) => task.isActive).length,
    premium: tasks.filter((task: any) => task.isPremium).length,
    unlocked: tasks.filter((task: any) => task.unlocked).length,
  }), [tasks]);

  if (!user?.activationStatus) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 px-6 py-16 text-center shadow-2xl shadow-blue-950/20">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
          <Lock size={30} />
        </div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          <Shield size={12} /> Access locked
        </div>
        <h2 className="text-3xl font-black tracking-tight">Activate to unlock microtasks</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
          This workspace stays closed until activation is complete. Once enabled, you’ll see live task sources, partner APIs, and reserved integrations in one feed.
        </p>
        <a href="/dashboard/activate" className="btn-primary mt-6 inline-flex items-center gap-2">
          Activate Now <ArrowRight size={14} />
        </a>
      </div>
    );
  }

  const handleUnlock = async (taskId: string) => {
    setBusyTaskId(taskId);
    try {
      await api.post(`/tasks/${taskId}/unlock`);
      await refetch();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleComplete = async (taskId: string) => {
    setBusyTaskId(taskId);
    try {
      await api.post(`/tasks/${taskId}/complete`);
      await refetch();
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="overflow-hidden rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">
              <Sparkles size={12} /> Freelancer-style task hub
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Microtasks</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Browse task sources, partner APIs, and reserved integrations in a feed that feels like a freelance marketplace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Live sources</div>
                <div className="text-2xl font-black text-blue-300">{summary.live}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Planned integrations</div>
                <div className="text-2xl font-black text-white">{summary.premium}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Unlocked tasks</div>
                <div className="text-2xl font-black text-white">{summary.unlocked}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { label: 'Crowd work', value: 'Data labeling, testing, moderation', icon: BrainCircuit },
              { label: 'Fast access', value: 'Open sources and partner links', icon: Globe2 },
              { label: 'Quality flow', value: 'Clear badges for live vs planned', icon: BadgeCheck },
              { label: 'Marketplace feel', value: 'Blue, dense, proposal-style cards', icon: Clock3 },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
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

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="grid gap-4 xl:grid-cols-2">
          {tasks.map((task: any) => (
            <div key={task._id} className="group rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition-all hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-xl hover:shadow-blue-950/20">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="badge-blue">${Number(task.rewardUSD).toFixed(2)}</span>
                    <span className="badge" style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd' }}>
                      {task.category}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-white">{task.title}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300 transition-transform group-hover:scale-105">
                  <Sparkles size={18} />
                </div>
              </div>

              <p className="mb-4 text-sm leading-6 text-slate-300">{task.description}</p>

              <div className="mb-5 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>{task.source}</span>
                <span>{task.estimatedMinutes} min</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {task.isPremium && !task.unlocked ? (
                  <button
                    onClick={() => handleUnlock(task._id)}
                    disabled={busyTaskId === task._id}
                    className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-semibold text-yellow-200 transition hover:border-yellow-300/50 hover:bg-yellow-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Coins size={14} /> Unlock for {task.tokenCost} tokens
                  </button>
                ) : (
                  <button
                    onClick={() => handleComplete(task._id)}
                    disabled={busyTaskId === task._id}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 transition hover:border-blue-300/50 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 size={14} /> Complete task
                  </button>
                )}

                {task.externalUrl ? (
                  <a href={task.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500/50 hover:bg-slate-900/80">
                    Open source <ExternalLink size={14} />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.25em] text-slate-500">Task stream</div>
            <h2 className="text-xl font-bold text-white">Market snapshot</h2>
          </div>

          <div className="space-y-3">
            {tasks.slice(0, 4).map((task: any) => (
              <div key={task._id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{task.title}</div>
                    <div className="text-xs text-slate-500">{task.category.toUpperCase()} / {task.source}</div>
                  </div>
                  <span className={task.unlocked ? 'badge-green' : 'badge-blue'}>{task.unlocked ? 'Unlocked' : task.isPremium ? 'Premium' : 'Live'}</span>
                </div>
                <div className="mt-3 text-xs leading-5 text-slate-400">{task.description}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-blue-500/10 to-slate-950 px-4 py-4">
            <div className="text-sm font-semibold text-white">Freelancer-style cues</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><BadgeCheck size={14} className="text-blue-300" /> Premium tasks require token unlock</li>
              <li className="flex items-center gap-2"><BadgeCheck size={14} className="text-blue-300" /> Completion credits the wallet instantly</li>
              <li className="flex items-center gap-2"><BadgeCheck size={14} className="text-blue-300" /> External sources open in a new tab</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
