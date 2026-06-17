'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { ExternalLink, Loader2, Lock, RefreshCw } from 'lucide-react';

type Highlight = {
  label: string;
  detail: string;
  tone: string;
};

type ModuleEmbedClientProps = {
  title: string;
  description: string;
  badge: string;
  icon: ReactNode;
  iframeSource: string;
  iframeTitle: string;
  highlights: Highlight[];
  ctaHref?: string;
  ctaLabel?: string;
  emptyMessage?: string;
  iframeHeight?: number;
};

export default function ModuleEmbedClient({
  title,
  description,
  badge,
  icon,
  iframeSource,
  iframeTitle,
  highlights,
  ctaHref = '/dashboard/activate',
  ctaLabel = 'Activate Now',
  emptyMessage = 'This module is unavailable right now.',
  iframeHeight = 700,
}: ModuleEmbedClientProps) {
  const { user, hasHydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [frameVersion, setFrameVersion] = useState(0);
  const isUnlocked = Boolean(user?.activationStatus);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIframeLoaded(false);
    setIframeError(false);
  }, [iframeSource]);

  const iframeReady = useMemo(() => Boolean(iframeSource), [iframeSource]);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-400">
        <Loader2 className="animate-spin text-emerald-400" size={24} />
        Loading {title.toLowerCase()}...
      </div>
    );
  }

  if (!hasHydrated || !isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-[2rem] border border-slate-700 bg-slate-900/60 px-6 py-12 text-center">
        <Lock size={48} className="text-slate-600" />
        <h2 className="text-2xl font-black">Activation Required</h2>
        <p className="max-w-lg text-sm text-slate-400">
          Activate your account to access {title.toLowerCase()} and start earning real USD rewards.
        </p>
        <Link href={ctaHref} className="btn-primary inline-flex items-center gap-2">
          {ctaLabel} <ExternalLink size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900">
        <div className="absolute right-4 top-4">
          <span className="badge-green">{badge}</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-400">
            {icon}
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">{description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <div key={item.label} className={`card bg-gradient-to-br ${item.tone}`}>
            <div className="text-sm font-semibold text-white">{item.label}</div>
            <div className="mt-2 text-xs text-slate-400">{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden border-emerald-500/20 bg-slate-950/70 p-0">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-200">{title}</div>
            <div className="text-xs text-slate-500">{description}</div>
          </div>
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

        <div className="relative min-h-[700px] w-full">
          {!iframeReady ? (
            <div className="flex h-[700px] items-center justify-center text-sm text-slate-400">
              {emptyMessage}
            </div>
          ) : iframeError ? (
            <div className="flex h-[700px] flex-col items-center justify-center gap-3 px-6 text-center">
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
                src={iframeSource}
                key={`${iframeSource}-${frameVersion}`}
                width="100%"
                height={`${iframeHeight}px`}
                frameBorder="0"
                title={iframeTitle}
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
                className="block w-full"
                sandbox="allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
