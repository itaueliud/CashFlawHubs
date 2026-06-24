'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type Range = '7d' | '30d' | '90d';

export default function LedgerTransactionsPage() {
  const { user } = useAuthStore();
  const [range, setRange] = useState<Range>('30d');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['ledger-transactions', range],
    queryFn: () => api.get(`/admin/ledger?range=${range}`).then((r) => r.data),
    enabled: user?.role === 'ledger',
  });

  const transactions = data?.ledger?.transactions || [];

  const providers: string[] = Array.from(new Set(transactions.map((tx: any) => String(tx.provider || 'unknown'))));
  const types: string[] = Array.from(new Set(transactions.map((tx: any) => String(tx.type || 'unknown'))));
  const statuses: string[] = Array.from(new Set(transactions.map((tx: any) => String(tx.status || 'unknown'))));

  const term = search.trim().toLowerCase();
  const filtered = transactions.filter((tx: any) => {
    const target = [
      tx._id,
      tx.reference,
      tx.userId?.name,
      tx.userId?.email,
      tx.userId?.phone,
      tx.userId?.userId,
      tx.provider,
      tx.type,
      tx.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (term && !target.includes(term)) return false;
    if (typeFilter !== 'all' && String(tx.type) !== typeFilter) return false;
    if (providerFilter !== 'all' && String(tx.provider) !== providerFilter) return false;
    if (statusFilter !== 'all' && String(tx.status) !== statusFilter) return false;
    return true;
  });

  const highValue = filtered.filter((tx: any) => Number(tx.amountUSD || 0) >= 100).length;
  const failed = filtered.filter((tx: any) => tx.status === 'failed').length;
  const pending = filtered.filter((tx: any) => tx.status === 'pending').length;
  const payoutQueue = data?.ledger?.payoutQueue || [];
  const payoutQueueTotal = Number(data?.ledger?.payoutQueueTotalUSD || 0);

  if (user?.role !== 'ledger') return <div className="card text-sm text-slate-400">Ledger access required.</div>;
  if (isLoading) return <div className="card text-sm text-slate-400">Loading transactions...</div>;

  return (
    <div className="dashboard-shell animate-fade-in">
      <div className="dashboard-hero p-6 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">Ledger Explorer</h1>
            <p className="mt-1 text-sm text-slate-400">Search and audit individual ledger rows.</p>
          </div>
          <select className="ledger-input max-w-[180px]" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input className="ledger-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user, id, reference" />
          <select className="ledger-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {types.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="ledger-input" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
            <option value="all">All providers</option>
            {providers.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="ledger-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="stat-card stat-card-cyan slide-up">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Filtered rows</div>
          <div className="mt-2 text-2xl font-black text-white">{filtered.length}</div>
        </div>
        <div className="stat-card stat-card-amber slide-up" style={{ animationDelay: '50ms' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">High value alerts</div>
          <div className="mt-2 text-2xl font-black text-amber-300">{highValue}</div>
        </div>
        <div className="stat-card stat-card-red slide-up" style={{ animationDelay: '100ms' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Failed</div>
          <div className="mt-2 text-2xl font-black text-red-300">{failed}</div>
        </div>
        <div className="stat-card stat-card-blue slide-up" style={{ animationDelay: '150ms' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Pending</div>
          <div className="mt-2 text-2xl font-black text-blue-300">{pending}</div>
        </div>
      </div>

      <div className="card border border-blue-500/15 bg-blue-500/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-blue-300">Friday payout queue</div>
            <div className="mt-1 text-lg font-bold text-white">
              {payoutQueue.length} qualifying withdrawals and referral payouts
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Queue total</div>
            <div className="text-2xl font-black text-blue-300">${payoutQueueTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="card table-shell p-0">
        <table className="ledger-table min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Reference</th>
              <th className="px-3 py-3">User</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Provider</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx: any) => (
              <tr key={tx._id} className="transition-colors hover:bg-white/[0.03]">
                <td className="px-3 py-3 text-slate-300">{new Date(tx.createdAt).toLocaleString()}</td>
                <td className="px-3 py-3 text-slate-300">{tx.reference || tx._id}</td>
                <td className="px-3 py-3 text-slate-300">{tx.userId?.name || tx.userId?.userId || '-'}</td>
                <td className="px-3 py-3 text-slate-300">{tx.type}</td>
                <td className="px-3 py-3 text-slate-300">{tx.provider}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      tx.status === 'successful'
                        ? 'bg-green-500/10 text-green-300'
                        : tx.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-300'
                          : tx.status === 'failed'
                            ? 'bg-red-500/10 text-red-300'
                            : 'bg-orange-500/10 text-orange-300'
                    }`}
                  >
                    {tx.status}
                  </span>
                  {tx.type === 'withdrawal' && tx.status === 'pending' && (
                    <div className="mt-1 text-[11px] text-blue-300">Friday payout queued</div>
                  )}
                </td>
                <td className="px-3 py-3 font-semibold text-white">${Number(tx.amountUSD || 0).toFixed(2)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">No transactions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
