'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';
import { RefreshCw, ReceiptText, Wallet } from 'lucide-react';

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;
const localMoney = (value: any) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TransactionsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (selectedRange = range, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/ledger/dashboard?range=${selectedRange}`);
      setDashboard(res.data?.ledger || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(range);
    const timer = window.setInterval(() => void load(range, true), 15000);
    return () => window.clearInterval(timer);
  }, [range]);

  const transactions = useMemo(() => dashboard?.transactions || [], [dashboard]);
  const queue = useMemo(() => dashboard?.payoutQueue || [], [dashboard]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="A ledger-safe view of revenue transactions and queued payouts."
      />

      {error && <ErrorBanner message={error} />}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div>
          <div className="text-sm font-semibold text-white">Range selector</div>
          <p className="text-xs text-slate-400">Refresh this page to switch between short and long transaction windows.</p>
        </div>
        <div className="flex items-center gap-2">
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue USD" value={money(dashboard?.totalUSD)} sub="Successful revenue" />
        <StatCard label="Local Currency" value={localMoney(dashboard?.totalLocal)} sub="Reported local equivalent" />
        <StatCard label="Transactions" value={String(transactions.length)} sub="Revenue entries" />
        <StatCard label="Payout Queue" value={money(dashboard?.payoutQueueTotalUSD)} sub={`${Number(dashboard?.payoutQueueCount || queue.length || 0)} queued items`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ReceiptText className="h-4 w-4 text-cyan-300" />
            Recent transactions
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-[#050b17]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.22em] text-slate-500">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length ? transactions.map((tx: any) => (
                  <tr key={tx._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-200">{tx.type || 'n/a'}</td>
                    <td className="px-4 py-3 text-slate-300">{tx.userId?.name || tx.userId?.email || 'Unknown'}</td>
                    <td className="px-4 py-3 font-mono text-slate-200">{money(tx.amountUSD)}</td>
                    <td className="px-4 py-3 text-slate-400">{tx.status || 'n/a'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Wallet className="h-4 w-4 text-emerald-300" />
            Payout queue
          </div>
          <div className="mt-4 space-y-3">
            {queue.length ? queue.map((tx: any) => (
              <div key={tx._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{tx.userId?.name || tx.userId?.email || 'Unknown user'}</div>
                    <div className="mt-1 text-xs text-slate-500">{tx.country || 'n/a'} - {tx.type || 'withdrawal'}</div>
                  </div>
                  <div className="font-bold text-cyan-300">{money(tx.amountUSD)}</div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No payout queue items.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

