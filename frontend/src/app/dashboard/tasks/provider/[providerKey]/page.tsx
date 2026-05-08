'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function TaskProviderPage() {
  const params = useParams<{ providerKey: string }>();
  const providerKey = String(params?.providerKey || '');
  const { user } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['task-provider-launch', providerKey],
    queryFn: () => api.get(`/tasks/providers/${providerKey}/launch`).then((response) => response.data),
    enabled: !!user?.activationStatus && !!providerKey,
  });

  if (!user?.activationStatus) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 px-6 py-16 text-center shadow-2xl shadow-blue-950/20">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
          <ShieldAlert size={30} />
        </div>
        <h2 className="text-3xl font-black tracking-tight">Activation required</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
          Activate your account to access microtask providers inside the dashboard.
        </p>
        <Link href="/dashboard/activate" className="btn-primary mt-6 inline-flex items-center gap-2">
          Activate Now <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[2rem] border border-slate-700 bg-slate-950/80">
        <div className="inline-flex items-center gap-3 text-slate-300">
          <Loader2 size={18} className="animate-spin" /> Loading provider...
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-red-500/20 bg-red-500/5 px-6 py-16 text-center">
        <ShieldAlert size={28} className="text-red-300" />
        <h2 className="mt-4 text-2xl font-black text-white">Provider unavailable</h2>
        <p className="mt-2 text-sm text-slate-300">
          This provider is not configured yet or could not be loaded.
        </p>
        <Link href="/dashboard/tasks" className="btn-primary mt-6 inline-flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Microtasks
        </Link>
      </div>
    );
  }

  const { provider, launchUrl } = data;
  const providerName = provider?.name || providerKey;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
              <ExternalLink size={12} /> In-site provider viewer
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{providerName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              The provider opens inside your dashboard route so the user stays on your site shell.
            </p>
          </div>
          <Link href="/dashboard/tasks" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={14} /> Back to Microtasks
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-700 bg-slate-950/80">
          <div className="border-b border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200">
            Provider content area
          </div>
          <div className="min-h-[70vh] bg-slate-900">
            <iframe
              src={launchUrl}
              title={`${providerName} provider`}
              className="h-[70vh] w-full border-0"
              allow="clipboard-read; clipboard-write; fullscreen; payment; geolocation; microphone; camera"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-slate-500">Provider status</div>
            <div className="mt-2 text-xl font-black text-white">Open inside site</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              If the provider blocks embedding, the frame may not render. In that case, keep this page open and use the fallback launch button below.
            </p>
          </div>

          <div className="card space-y-3">
            <div className="text-sm font-semibold text-white">Provider details</div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{provider.integrationType} / {provider.access.replace(/_/g, ' ')}</div>
            <div className="text-sm text-slate-300">{provider.description}</div>
            <span className="badge-green w-fit">{provider.badge}</span>
          </div>

          <div className="card space-y-3">
            <div className="text-sm font-semibold text-white">Fallback</div>
            <p className="text-sm text-slate-300">
              Some providers block iframes. If that happens, you can still access the provider from this route without leaving the dashboard context.
            </p>
            <a href={launchUrl} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2">
              Open fallback tab <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
