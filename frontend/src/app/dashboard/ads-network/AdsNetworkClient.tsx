'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Radio, Sparkles } from 'lucide-react';
import api from '@/lib/api';

type ScriptStatus = 'missing' | 'loading' | 'ready' | 'error';
type PlacementKey = 'popunder' | 'smartlink' | 'socialBar';
type WatchState = 'idle' | 'tracking' | 'rewarded' | 'error';

type ScriptUrls = Record<PlacementKey, string>;

const PLACEMENT_META: Record<PlacementKey, { title: string; accent: string }> = {
  popunder: { title: 'Popunder', accent: 'from-amber-400/20 to-rose-400/10' },
  smartlink: { title: 'Smartlink', accent: 'from-cyan-400/20 to-sky-400/10' },
  socialBar: { title: 'Social Bar', accent: 'from-emerald-400/20 to-teal-400/10' },
};

const WATCH_START_PATH = '/ads-network/watch/start';
const WATCH_HEARTBEAT_PATH = '/ads-network/watch/heartbeat';
const WATCH_END_PATH = '/ads-network/watch/end';

function isSafeScriptUrl(value: string | undefined): value is string {
  if (!value) return false;
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
      if (mounted) setStatus('ready');
    };

    const handleError = () => {
      if (mounted) setStatus('error');
    };

    setStatus('loading');
    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    document.body.appendChild(script);

    return () => {
      mounted = false;
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
      script.remove();
    };
  }, [id, src]);

  return status;
}

function getApiBaseUrl() {
  return api.defaults.baseURL?.replace(/\/+$/, '') || '';
}

function getAuthToken() {
  if (typeof window === 'undefined') return '';
  try {
    const stored = JSON.parse(localStorage.getItem('earnhub-auth') || '{}');
    return stored?.state?.token || '';
  } catch {
    return '';
  }
}

async function postWatchEvent(path: string, keepalive = false) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return;

  if (!keepalive) {
    await api.post(path);
    return;
  }

  const token = getAuthToken();
  await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    keepalive: true,
    body: '{}',
  });
}

function useAdsWatchSession() {
  const [watchState, setWatchState] = useState<WatchState>('idle');
  const heartbeatRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  const rewardedRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      trackingRef.current = false;
    };

    const beginTracking = async () => {
      if (trackingRef.current || rewardedRef.current) return;
      try {
        await postWatchEvent(WATCH_START_PATH);
        if (!mountedRef.current) return;
        trackingRef.current = true;
        setWatchState((current) => (current === 'rewarded' ? current : 'tracking'));
        heartbeatRef.current = window.setInterval(async () => {
          try {
            const response = await api.post(WATCH_HEARTBEAT_PATH);
            if (response.data?.session?.rewardGrantedAt && mountedRef.current) {
              rewardedRef.current = true;
              setWatchState('rewarded');
              stopHeartbeat();
            }
          } catch {
            if (mountedRef.current) setWatchState('error');
          }
        }, 60_000);
      } catch {
        if (mountedRef.current) setWatchState('error');
      }
    };

    const pauseTracking = () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (trackingRef.current) {
        trackingRef.current = false;
        void postWatchEvent(WATCH_END_PATH, true).catch(() => {});
      }
    };

    const syncWithVisibility = () => {
      if (document.visibilityState === 'visible') {
        void beginTracking();
      } else {
        pauseTracking();
      }
    };

    syncWithVisibility();
    document.addEventListener('visibilitychange', syncWithVisibility);
    window.addEventListener('pagehide', pauseTracking);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', syncWithVisibility);
      window.removeEventListener('pagehide', pauseTracking);
      pauseTracking();
    };
  }, []);

  return watchState;
}

function PlacementCard({ placementKey, scriptUrl }: { placementKey: PlacementKey; scriptUrl: string }) {
  const meta = PLACEMENT_META[placementKey];
  const status = useRouteScopedScript(scriptUrl, `cashflowhubs-ads-${placementKey}`);

  return (
    <article className={`rounded-2xl border border-slate-800 bg-gradient-to-br ${meta.accent} p-5 shadow-lg shadow-slate-950/30`}>
      <div className="flex items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-cyan-300" />
          <h2 className="text-lg font-bold">{meta.title}</h2>
        </div>
        {status === 'ready' ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        ) : status === 'error' ? (
          <AlertTriangle className="h-5 w-5 text-rose-300" />
        ) : null}
      </div>

      <div className="mt-5 rounded-xl border border-slate-700/80 bg-slate-950/70 p-4">
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-8 text-center">
          <div className="text-sm font-semibold text-slate-100">
            {status === 'ready' ? 'Active' : status === 'loading' ? 'Loading' : status === 'error' ? 'Error' : 'Unavailable'}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
          <span>Placement</span>
          <span className="font-semibold text-slate-200">
            {status === 'loading' ? 'Loading' : status === 'ready' ? 'Active' : status === 'error' ? 'Error' : 'Idle'}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function AdsNetworkClient({ scriptUrls }: { scriptUrls: ScriptUrls }) {
  const placementKeys = Object.keys(PLACEMENT_META) as PlacementKey[];
  const watchState = useAdsWatchSession();
  const configuredCount = placementKeys.filter((placementKey) => isSafeScriptUrl(scriptUrls[placementKey])).length;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#08111d] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-2xl shadow-cyan-950/20">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Ads Network
            </div>
            <div className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-200">
              {watchState === 'tracking' ? 'Live' : watchState === 'rewarded' ? 'Complete' : watchState === 'error' ? 'Error' : 'Idle'}
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300 sm:max-w-[380px]">
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
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {placementKeys.map((placementKey) => (
            <PlacementCard key={placementKey} placementKey={placementKey} scriptUrl={scriptUrls[placementKey]} />
          ))}
        </section>
      </div>
    </main>
  );
}
