'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';
import { Download, FileSpreadsheet, ReceiptText, Wallet } from 'lucide-react';

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;
const localMoney = (value: any) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReportsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [dashboard, setDashboard] = useState<any>(null);
  const [weekly, setWeekly] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (selectedRange = range, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [dashboardRes, weeklyRes] = await Promise.all([
        api.get(`/ledger/dashboard?range=${selectedRange}`),
        api.get('/ledger/payouts/weekly-summary?weekOffset=0'),
      ]);
      setDashboard(dashboardRes.data?.ledger || null);
      setWeekly(weeklyRes.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(range);
    const timer = window.setInterval(() => void load(range, true), 15000);
    return () => window.clearInterval(timer);
  }, [range]);

  const exportCsv = () => {
    const rows = [
      ['Type', 'Amount USD', 'Status', 'User', 'Created At'],
      ...((dashboard?.transactions || []) as any[]).map((tx) => [
        tx.type || '',
        Number(tx.amountUSD || 0).toFixed(2),
        tx.status || '',
        tx.userId?.name || tx.userId?.email || 'Unknown',
        tx.createdAt ? new Date(tx.createdAt).toISOString() : '',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger-reports-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const recentTransactions = useMemo(() => dashboard?.transactions || [], [dashboard]);
  const payoutQueue = useMemo(() => dashboard?.payoutQueue || [], [dashboard]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Ledger reporting for revenue, payouts, and operational queue exports."
      />

      {error && <ErrorBanner message={error} />}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div>
          <div className="text-sm font-semibold text-white">Report range</div>
          <p className="text-xs text-slate-400">Switch between 7, 30, and 90 day windows for reporting.</p>
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
          <button onClick={exportCsv} className="ledger-button">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue USD" value={money(dashboard?.totalUSD)} sub="Successful revenue only" />
        <StatCard label="Local Revenue" value={localMoney(dashboard?.totalLocal)} sub="Aggregated local-value total" />
        <StatCard label="Transactions" value={String(dashboard?.count || 0)} sub="Revenue events in range" />
        <StatCard label="Payout Queue" value={money(dashboard?.payoutQueueTotalUSD)} sub={`${Number(dashboard?.payoutQueueCount || payoutQueue.length || 0)} queued payouts`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ReceiptText className="h-4 w-4 text-cyan-300" />
            Recent revenue transactions
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
                {recentTransactions.length ? recentTransactions.map((tx: any) => (
                  <tr key={tx._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-200">{tx.type || 'n/a'}</td>
                    <td className="px-4 py-3 text-slate-300">{tx.userId?.name || tx.userId?.email || 'Unknown'}</td>
                    <td className="px-4 py-3 font-mono text-slate-200">{money(tx.amountUSD)}</td>
                    <td className="px-4 py-3 text-slate-400">{tx.status || 'n/a'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No transactions available for this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Wallet className="h-4 w-4 text-emerald-300" />
              Payout queue
            </div>
            <div className="mt-4 space-y-3">
              {payoutQueue.length ? payoutQueue.map((tx: any) => (
                <div key={tx._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{tx.userId?.name || tx.userId?.email || 'Unknown user'}</div>
                      <div className="mt-1 text-xs text-slate-500">{tx.type || 'withdrawal'} - {tx.country || 'n/a'}</div>
                    </div>
                    <div className="font-bold text-cyan-300">{money(tx.amountUSD)}</div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No queued payouts in this period.</div>
              )}
            </div>
          </div>

          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileSpreadsheet className="h-4 w-4 text-amber-300" />
              Weekly snapshot
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Week label: {weekly?.weekLabel || 'n/a'}</div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Users paid: {Number(weekly?.summary?.usersPayoutCount || 0)}</div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Manual adjustments: {money(weekly?.summary?.totalManualAdjUSD)}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

