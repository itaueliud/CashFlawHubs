'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Radio, ShieldAlert, Sparkles } from 'lucide-react';

type ScriptStatus = 'missing' | 'loading' | 'ready' | 'error';

type PlacementKey = 'popunder' | 'smartlink' | 'socialBar';

const PLACEMENT_META: Record<PlacementKey, { title: string; description: string; accent: string }> = {
  popunder: {
    title: 'Popunder',
    description: 'Runs only here and can trigger a provider popunder when enabled.',
    accent: 'from-amber-400/20 to-rose-400/10',
  },
  smartlink: {
    title: 'Smartlink',
    description: 'Shows a single-click ad destination on this page only.',
    accent: 'from-cyan-400/20 to-sky-400/10',
  },
  socialBar: {
    title: 'Social Bar',
    description: 'Displays the provider social bar on this route only.',
    accent: 'from-emerald-400/20 to-teal-400/10',
  },
};

const ADS_SCRIPT_URLS: Record<PlacementKey, string> = {
  popunder: process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_URL?.trim() || '',
  smartlink: process.env.NEXT_PUBLIC_ADSTERRA_SMARTLINK_URL?.trim() || '',
  socialBar: process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_URL?.trim() || '',
};

function isSafeScriptUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function useRouteScopedScript(src: string | undefined, id: string): ScriptStatus {
  const [status, setStatus] = useState<ScriptStatus>(() => (isSafeScriptUrl(src) ? 'loading' : 'missing'));

  useEffect(() => {
    let mounted = true;

    if (!isSafeScriptUrl(src)) {
      setStatus('missing');
      return;
    }

    const existing = document.getElementById(id) as HTMLScriptElement | null;

    if (existing) {
      setStatus('ready');
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.defer = true;
    script.src = src;
    script.referrerPolicy = 'strict-origin-when-cross-origin';

    const handleLoad = () => {
      if (mounted) {
        setStatus('ready');
      }
    };
    const handleError = () => {
      if (mounted) {
        setStatus('error');
      }
    };

    setStatus('loading');
    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    document.body.appendChild(script);

    return () => {
      mounted = false;
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [id, src]);

  return status;
}

function PlacementCard({
  placementKey,
}: {
  placementKey: PlacementKey;
}) {
  const meta = PLACEMENT_META[placementKey];
  const value = ADS_SCRIPT_URLS[placementKey];
  const status = useRouteScopedScript(value, `cashflowhubs-ads-${placementKey}`);

  return (
    <article
      className={`rounded-2xl border border-slate-800 bg-gradient-to-br ${meta.accent} p-5 shadow-lg shadow-slate-950/30`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <Radio className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-bold">{meta.title}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{meta.description}</p>
        </div>
        {status === 'ready' && <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
        {status === 'error' && <AlertTriangle className="h-5 w-5 text-rose-300" />}
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-slate-700/80 bg-slate-950/70 p-4">
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-6 text-center">
          <div className="text-sm font-semibold text-slate-100">Live ad slot</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {status === 'ready'
              ? 'Ad provider script loaded for this placement.'
              : status === 'loading'
                ? 'Loading this placement...'
                : status === 'error'
                  ? 'This placement could not load right now.'
                  : 'No provider script configured for this placement.'}
          </p>
          {placementKey === 'smartlink' && status === 'ready' && value ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300"
            >
              Open sponsored offer
            </a>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
          <span>Route-scoped only</span>
          <span className="font-semibold text-slate-200">
            {status === 'loading' ? 'Loading' : status === 'ready' ? 'Active' : status === 'error' ? 'Error' : 'Idle'}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function AdsNetworkPage() {
  const placementKeys = Object.keys(PLACEMENT_META) as PlacementKey[];
  const configuredCount = placementKeys.filter((placementKey) => isSafeScriptUrl(ADS_SCRIPT_URLS[placementKey])).length;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#08111d] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-2xl shadow-cyan-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Ads module only
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Popunder, smartlink, and social bar placements
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                This page is the only place where the ads provider scripts are mounted. If you leave this route, the
                scripts are removed, so no other part of the app receives these placements.
              </p>
            </div>
            <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300 sm:min-w-[240px]">
              <div className="flex items-center justify-between gap-3">
                <span>Active placements</span>
                <span className="font-bold text-white">{configuredCount}/3</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 transition-all"
                  style={{ width: `${(configuredCount / 3) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldAlert className="h-4 w-4 text-amber-300" />
                Ads stay on this page only and do not write to the database.
              </div>
            </div>
          </div>
        </section>

        {placementKeys.every((placementKey) => !isSafeScriptUrl(ADS_SCRIPT_URLS[placementKey])) && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold">Ads env vars are not configured yet.</p>
                <p className="text-amber-50/90">
                  Set the three Render env vars on the frontend service, then redeploy the frontend.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-3">
          {placementKeys.map((placementKey) => (
            <PlacementCard key={placementKey} placementKey={placementKey} />
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <h2 className="text-lg font-bold text-white">How this module works</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <li>1. The page loads the ads placements only when this route renders.</li>
              <li>2. Each script is inserted into the DOM on mount and removed on unmount.</li>
              <li>3. No other dashboard page imports or mounts these scripts.</li>
              <li>4. No database operations are performed from this page.</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <h2 className="text-lg font-bold text-white">Quick links</h2>
            <div className="mt-4 grid gap-3">
              <Link
                href="/dashboard"
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-cyan-500/50 hover:bg-slate-800"
              >
                Back to dashboard
              </Link>
              <Link
                href="/dashboard/admin/support"
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-cyan-500/50 hover:bg-slate-800"
              >
                Admin support
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
