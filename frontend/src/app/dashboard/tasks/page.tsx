'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { ArrowRight, BadgeCheck, BrainCircuit, Clock3, Globe2, Lock, Shield, Sparkles, ExternalLink } from 'lucide-react';

export default function TasksPage() {
  const { user } = useAuthStore();
  const { data } = useQuery({
    queryKey: ['category-providers', 'microtasks'],
    queryFn: () => api.get('/catalog/categories/microtasks/providers').then((r) => r.data),
    enabled: !!user,
  });

  const providers = data?.providers || [];
  const liveProviders = providers.filter((provider: any) => provider.access === 'external_link' || provider.access === 'internal_wall');
  const plannedProviders = providers.filter((provider: any) => provider.access === 'planned');
  const externalProviders = providers.filter((provider: any) => provider.integrationType === 'external');

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

  return (
    <div className="space-y-6">
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
                <div className="text-2xl font-black text-blue-300">{liveProviders.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Planned integrations</div>
                <div className="text-2xl font-black text-white">{plannedProviders.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">External platforms</div>
                <div className="text-2xl font-black text-white">{externalProviders.length}</div>
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
          {providers.map((provider: any) => (
            <div key={provider.key} className="group rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition-all hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-xl hover:shadow-blue-950/20">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="badge-blue">{provider.badge}</span>
                    <span className="badge" style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd' }}>
                      {provider.integrationType}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-white">{provider.name}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300 transition-transform group-hover:scale-105">
                  <Sparkles size={18} />
                </div>
              </div>

              <p className="mb-4 text-sm leading-6 text-slate-300">{provider.description}</p>

              <div className="mb-5 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>{provider.access.replace(/_/g, ' ')}</span>
                <span>{provider.key}</span>
              </div>

              {provider.externalUrl ? (
                <a href={provider.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 transition hover:border-blue-300/50 hover:bg-blue-500/15">
                  Open platform <ExternalLink size={14} />
                </a>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-500">
                  Reserved API integration slot for this microtask source.
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.25em] text-slate-500">Task stream</div>
            <h2 className="text-xl font-bold text-white">Market snapshot</h2>
          </div>

          <div className="space-y-3">
            {providers.slice(0, 4).map((provider: any) => (
              <div key={provider.key} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{provider.name}</div>
                    <div className="text-xs text-slate-500">{provider.integrationType.toUpperCase()} / {provider.access.replace(/_/g, ' ')}</div>
                  </div>
                  <span className="badge-blue">{provider.badge}</span>
                </div>
                <div className="mt-3 text-xs leading-5 text-slate-400">{provider.description}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-blue-500/10 to-slate-950 px-4 py-4">
            <div className="text-sm font-semibold text-white">Freelancer-style cues</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><BadgeCheck size={14} className="text-blue-300" /> Dense marketplace cards</li>
              <li className="flex items-center gap-2"><BadgeCheck size={14} className="text-blue-300" /> Strong blue accent system</li>
              <li className="flex items-center gap-2"><BadgeCheck size={14} className="text-blue-300" /> Clear live/planned badges</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
