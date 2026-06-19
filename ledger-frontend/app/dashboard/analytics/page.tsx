'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';
import { BarChart3, TrendingUp, Banknote, ReceiptText, ArrowRightLeft, RefreshCw } from 'lucide-react';

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;

export default function AnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/admin/analytics/revenue?range=${selectedRange}`);
      setData(response.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
  }, [range]);

  const countryRows = useMemo(() => data?.byCountry || [], [data]);
  const sourceRows = useMemo(() => data?.bySource || [], [data]);
  const dailyRows = useMemo(() => data?.daily || [], [data]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Revenue, source mix, and withdrawal ratios for the selected reporting window." />

      {error && <ErrorBanner message={error} />}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div>
          <div className="text-sm font-semibold text-white">Reporting range</div>
          <p className="text-xs text-slate-400">Choose the time span you want to inspect.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['7d', '30d', '90d'] as const).map((item) => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className={`rounded-xl px-3 py-2 text-sm transition ${
                range === item ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/20' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {item}
            </button>
          ))}
          <button onClick={() => load(range)} className="ledger-button">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue USD" value={money(data?.totalRevenue)} sub="Successful revenue" />
        <StatCard label="Transactions" value={String(dailyRows.length)} sub="Daily revenue rows" />
        <StatCard label="Withdrawn USD" value={money(data?.totalWithdrawn)} sub="Successful withdrawals" />
        <StatCard label="Ratio" value={`${Number(data?.ratio || 0)}%`} sub="Withdrawn / revenue" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BarChart3 className="h-4 w-4 text-cyan-300" />
            Revenue source mix
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['Activation', sourceRows.find((item: any) => item._id === 'activation')?.totalUSD || 0],
              ['Job posting', sourceRows.find((item: any) => item._id === 'job_posting')?.totalUSD || 0],
              ['Token purchase', sourceRows.find((item: any) => item._id === 'token_purchase')?.totalUSD || 0],
            ].map(([label, value]) => (
              <div key={label as string} className="ledger-card p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label as string}</div>
                <div className="mt-2 text-2xl font-black text-white">{money(value)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <TrendingUp className="h-4 w-4 text-emerald-300" />
            Weekly note
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Watch whether revenue is being driven by activations, top-ups, or purchase flows.</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Use the withdrawal ratio to judge payout pressure versus intake.</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Country rankings help you spot where the ledger is growing fastest.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Banknote className="h-4 w-4 text-emerald-300" />
            Country revenue
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-[#050b17]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.22em] text-slate-500">
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Total Paid</th>
                  <th className="px-4 py-3">Transactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {countryRows.length ? countryRows.map((row: any) => (
                  <tr key={row._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-200">{row._id || 'n/a'}</td>
                    <td className="px-4 py-3 text-slate-200 tabular-nums">{money(row.totalUSD)}</td>
                    <td className="px-4 py-3 text-slate-400">{row.count || 0}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No country breakdown available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ReceiptText className="h-4 w-4 text-cyan-300" />
              Daily revenue
            </div>
            <div className="mt-4 space-y-3">
              {dailyRows.length ? dailyRows.map((row: any) => (
                <div key={row._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{row._id}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.count || 0} transactions</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-cyan-300">{money(row.totalUSD)}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No daily rows available yet.</div>
              )}
            </div>
          </div>

          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ArrowRightLeft className="h-4 w-4 text-amber-300" />
              Operational note
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              This page is intentionally focused on ledger-safe reporting. It complements payout control and shows where money is coming from and where it is leaving the system.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
