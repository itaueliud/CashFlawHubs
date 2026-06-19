'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';
import { RefreshCcw, Route, ShieldCheck, Globe } from 'lucide-react';

export default function PaymentRailsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ledger/rails');
      setData(res.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load payment rails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner />;

  const providers = Object.entries(data?.rails || {});
  const usage = Array.isArray(data?.usage) ? data.usage : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Rails"
        description="Inspect the active payout stack, country priorities, and provider usage across the ledger."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Rail groups" value={String(providers.length)} sub="Configured layers" />
        <StatCard label="Providers in use" value={String(usage.length)} sub="Observed in transactions" />
        <StatCard label="Countries covered" value={String(Object.keys(data?.countryPriority || {}).length)} sub="Priority routing map" />
      </section>

      <section className="flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Route className="h-4 w-4 text-cyan-300" />
            Stack overview
          </div>
          <p className="mt-1 text-xs text-slate-400">These values come from the backend payment stack configuration.</p>
        </div>
        <button onClick={load} className="ledger-button">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Provider groups
          </div>
          <div className="mt-4 grid gap-3">
            {providers.map(([key, value]: any) => (
              <div key={key} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{key}</div>
                    <div className="mt-1 text-sm text-slate-400">{value?.purpose || 'No description available.'}</div>
                  </div>
                  <div className="text-xs text-cyan-300">{Array.isArray(value?.providers) ? value.providers.length : 0} providers</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  {(value?.providers || []).map((provider: string) => (
                    <span key={provider} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{provider}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Globe className="h-4 w-4 text-cyan-300" />
            Country priorities
          </div>
          <div className="mt-4 space-y-3">
            {Object.entries(data?.countryPriority || {}).map(([country, routes]: any) => (
              <div key={country} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-white">{country}</div>
                  <div className="text-xs text-slate-400">Deposit / withdrawal ordering</div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Deposits</div>
                    <div className="mt-1">{(routes?.deposits || []).join(', ') || 'n/a'}</div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Withdrawals</div>
                    <div className="mt-1">{(routes?.withdrawals || []).join(', ') || 'n/a'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
