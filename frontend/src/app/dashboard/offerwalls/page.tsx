'use client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ExternalLink, History, Lock, Radio, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNonce } from '@/components/security/NonceProvider';

type OfferwallSnippetConfig = {
  label: string;
  scriptSrc: string;
  blockedUrl: string;
  javascriptUrl: string;
};

const OFFERWALL_SNIPPETS: Record<string, OfferwallSnippetConfig> = {
  ayetstudios: {
    label: 'Trianglerockers',
    scriptSrc: 'https://trianglerockers.com/script_include.php?id=1896723',
    blockedUrl: 'https://trianglerockers.com/help/ablk.php?lkt=4',
    javascriptUrl: 'https://trianglerockers.com/help/enable_javascript.php?lkt=4',
  },
  adgate: {
    label: 'PlayableDownload',
    scriptSrc: 'https://playabledownload.com/script_include.php?id=1896727',
    blockedUrl: 'https://playabledownload.com/help/ablk.php?lkt=4',
    javascriptUrl: 'https://playabledownload.com/help/enable_javascript.php?lkt=4',
  },
};

function OfferwallScriptHost({ providerKey, providerName }: { providerKey: string | null; providerName: string }) {
  const scriptMountRef = useRef<HTMLDivElement | null>(null);
  const nonce = useNonce();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    const host = scriptMountRef.current;
    if (!host) return;

    host.replaceChildren();

    if (!providerKey) {
      setStatus('idle');
      return;
    }

    const snippet = OFFERWALL_SNIPPETS[providerKey];
    if (!snippet) {
      setStatus('error');
      return;
    }

    setStatus('loading');
    const scriptNonce = nonce || undefined;

    const addInlineScript = (code: string) => {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      if (scriptNonce) script.setAttribute('nonce', scriptNonce);
      script.text = code;
      host.appendChild(script);
      return script;
    };

    addInlineScript('var lck = false;');

    const loader = document.createElement('script');
    loader.type = 'text/javascript';
    loader.src = snippet.scriptSrc;
    loader.async = false;
    loader.onload = () => setStatus('ready');
    loader.onerror = () => setStatus('error');
    host.appendChild(loader);

    addInlineScript(`if(!lck){top.location = '${snippet.blockedUrl}'; }`);

    const noScript = document.createElement('noscript');
    noScript.innerHTML = `Please enable JavaScript to access this page.<meta http-equiv="refresh" content="0;url=${snippet.javascriptUrl}" />`;
    host.appendChild(noScript);

    return () => {
      host.replaceChildren();
    };
  }, [nonce, providerKey]);

  return (
    <div className="min-h-[65vh] rounded-3xl border border-slate-700 bg-slate-950/95 p-4 shadow-inner shadow-black/30">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Provider script host</div>
          <div className="mt-1 text-sm font-semibold text-white">{providerName}</div>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
          {status === 'ready' ? 'Loaded' : status === 'loading' ? 'Loading' : status === 'error' ? 'Error' : 'Idle'}
        </span>
      </div>

      <div className="relative min-h-[60vh] overflow-hidden rounded-2xl bg-slate-900">
        <div ref={scriptMountRef} className="absolute inset-0 z-0" />
        {status === 'idle' ? (
          <div className="relative z-10 flex min-h-[60vh] items-center justify-center px-6 text-center text-sm text-slate-400">
            Select a live provider to load its monetization script.
          </div>
        ) : status === 'loading' ? (
          <div className="relative z-10 flex min-h-[60vh] items-center justify-center px-6 text-center text-sm text-slate-300">
            Loading provider script...
          </div>
        ) : status === 'error' ? (
          <div className="relative z-10 flex min-h-[60vh] items-center justify-center px-6 text-center text-sm text-slate-300">
            The provider script failed to load. Check the browser console and ad-block settings.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function OfferwallsPage() {
  const { user } = useAuthStore();
  const [activeProviderKey, setActiveProviderKey] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['category-providers', 'offerwalls'],
    queryFn: () => api.get('/catalog/categories/offerwalls/providers').then((r) => r.data),
    enabled: !!user,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['offerwalls-history'],
    queryFn: () => api.get('/offerwalls/history?limit=8').then((r) => r.data),
    enabled: !!user?.activationStatus,
  });

  const { data: launchData } = useQuery({
    queryKey: ['offerwall-launch', activeProviderKey],
    queryFn: () => api.get(`/offerwalls/launch/${activeProviderKey}`).then((r) => r.data),
    enabled: !!user?.activationStatus && !!activeProviderKey,
  });

  if (!user?.activationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Activation Required</h2>
        <a href="/dashboard/activate" className="btn-primary mt-2">Activate Now</a>
      </div>
    );
  }

  const providers = data?.providers || [];
  const liveProviders = providers.filter((provider: any) => provider.live);
  const plannedProviders = providers.filter((provider: any) => !provider.live);
  const history = historyData?.transactions || [];
  const activeProvider = useMemo(() => providers.find((provider: any) => provider.key === activeProviderKey) || null, [providers, activeProviderKey]);
  const activeSnippet = activeProviderKey ? OFFERWALL_SNIPPETS[activeProviderKey] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-emerald-950/20 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              <Sparkles size={12} /> Rewarded offerwall hub
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Offerwalls</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Launch verified offerwall sessions in-app, keep reward callbacks tied to your backend, and review earnings in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Live providers</div>
                <div className="text-2xl font-black text-emerald-300">{liveProviders.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Planned providers</div>
                <div className="text-2xl font-black text-white">{plannedProviders.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Recent earnings</div>
                <div className="text-2xl font-black text-white">{history.length}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { label: 'Signed launch', value: 'Every wall opens from a backend session', icon: Radio },
              { label: 'Wallet-safe', value: 'Callbacks credit the internal wallet only after validation', icon: Sparkles },
              { label: 'Risk tracked', value: 'Invalid signatures and duplicates are monitored', icon: History },
              { label: 'In-app flow', value: 'Keep users inside the dashboard shell', icon: ExternalLink },
            ].map((item) => {
              const Icon = item.icon as any;
              return (
                <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{item.label}</div>
                    <div className="text-xs leading-5 text-slate-400">{item.value}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="grid gap-4 xl:grid-cols-2">
          {providers.map((provider: any) => (
            <div key={provider.key} className="group rounded-[1.5rem] border border-emerald-500/10 bg-slate-900/90 p-5 transition-all hover:-translate-y-1 hover:border-emerald-400/30 hover:shadow-xl hover:shadow-emerald-950/20">
              <div className="relative">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className={provider.live ? 'badge-green' : 'badge-blue'}>{provider.badge}</span>
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}>
                        {provider.integrationType}
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white">{provider.name}</div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300 transition-transform group-hover:scale-105">
                    <Radio size={18} />
                  </div>
                </div>

                <p className="mb-4 text-sm leading-6 text-slate-300">{provider.description}</p>

                <div className="mb-5 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                  <span>{provider.access.replace(/_/g, ' ')}</span>
                  <span>{provider.url ? 'Ready' : 'Awaiting keys'}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!provider.live) {
                      toast.error('This provider is not configured yet');
                      return;
                    }
                    setActiveProviderKey(provider.key);
                  }}
                  disabled={!provider.live}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Open offerwall <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-emerald-500/10 bg-slate-900/90 p-5">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.25em] text-slate-500">Offerwall history</div>
            <h2 className="text-xl font-bold text-white">Recent rewards</h2>
          </div>

          <div className="space-y-3">
            {history.length > 0 ? history.slice(0, 4).map((tx: any) => (
              <div key={tx._id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{tx.metadata?.provider || 'offerwall reward'}</div>
                    <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                  <span className="badge-green">+${Number(tx.amountUSD || 0).toFixed(2)}</span>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-400">
                No offerwall earnings yet. Open a live wall to start tracking rewards.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-emerald-500/10 to-slate-950 px-4 py-4">
            <div className="text-sm font-semibold text-white">Production checklist</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><Sparkles size={14} className="text-emerald-300" /> Use signed callback validation for each provider</li>
              <li className="flex items-center gap-2"><Sparkles size={14} className="text-emerald-300" /> Keep wallet credits idempotent with Redis dedupe</li>
              <li className="flex items-center gap-2"><Sparkles size={14} className="text-emerald-300" /> Monitor duplicate, invalid, and failed callback counts</li>
            </ul>
          </div>
        </div>
      </div>

      {activeProviderKey ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/75 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-6xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-4 border-b border-slate-700 px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Offerwall drawer</div>
                <div className="mt-1 text-lg font-black text-white">{activeProvider?.name || activeProviderKey}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveProviderKey(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white"
                aria-label="Close offerwall drawer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[1.25fr_0.75fr]">
              <div className="min-h-0 overflow-hidden border-r border-slate-800 bg-slate-950/90">
                <OfferwallScriptHost providerKey={activeProviderKey} providerName={activeProvider?.name || activeProviderKey || 'Offerwall'} />
              </div>

              <div className="space-y-4 overflow-y-auto p-5">
                <div className="card">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Provider status</div>
                  <div className="mt-2 text-xl font-black text-white">Open inside site</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    This drawer loads the provider script directly in the dashboard shell and keeps the backend session tied to the selection.
                  </p>
                </div>

                {activeProvider ? (
                  <div className="card space-y-3">
                    <div className="text-sm font-semibold text-white">Provider details</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {activeProvider.integrationType} / {activeProvider.access.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm text-slate-300">{activeProvider.description}</div>
                    <span className={activeProvider.live ? 'badge-green w-fit' : 'badge-blue w-fit'}>{activeProvider.badge}</span>
                    {activeSnippet ? (
                      <div className="text-xs text-slate-500">{activeSnippet.label} script will load for this provider.</div>
                    ) : null}
                  </div>
                ) : null}

                <div className="card space-y-3">
                  <div className="text-sm font-semibold text-white">In-site only</div>
                  <p className="text-sm text-slate-300">
                    Offerwalls stay inside your dashboard shell. If a provider blocks the script, reopen the drawer, disable ad-blocking, or try the direct wall link.
                  </p>
                  <button
                    type="button"
                    disabled={!launchData?.wallUrl}
                    onClick={() => {
                      if (!launchData?.wallUrl) return;
                      window.open(launchData.wallUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Open direct wall <ExternalLink size={14} />
                  </button>
                </div>

                <div className="card space-y-3">
                  <div className="text-sm font-semibold text-white">Recent rewards</div>
                  {history.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {history.slice(0, 3).map((tx: any) => (
                        <div key={tx._id} className="flex items-center justify-between rounded-xl border border-slate-700 px-3 py-2">
                          <div>
                            <div className="font-semibold text-slate-200">{tx.metadata?.provider || 'offerwall'}</div>
                            <div className="text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                          </div>
                          <div className="font-semibold text-green-300">+${Number(tx.amountUSD || 0).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">No rewards yet for this account.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
