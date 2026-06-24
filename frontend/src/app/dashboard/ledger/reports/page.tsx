'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type Range = '7d' | '30d' | '90d';

export default function LedgerReportsPage() {
  const { user } = useAuthStore();
  const [range, setRange] = useState<Range>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['ledger-reports', range],
    queryFn: () => api.get(`/admin/ledger?range=${range}`).then((r) => r.data),
    enabled: user?.role === 'ledger',
  });

  const totalsByType = useMemo(() => {
    const map: Record<string, number> = {};
    (data?.ledger?.transactions || []).forEach((tx: any) => {
      const key = String(tx.type || 'unknown');
      map[key] = (map[key] || 0) + Number(tx.amountUSD || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (user?.role !== 'ledger') return <div className="card text-sm text-slate-400">Ledger access required.</div>;
  if (isLoading) return <div className="card text-sm text-slate-400">Loading reports...</div>;

  return (
    <div className="dashboard-shell animate-fade-in">
      <div className="dashboard-hero p-6 sm:p-7">
        <div className="dashboard-toolbar">
          <div>
            <h1 className="text-2xl font-black text-white">Ledger Reports</h1>
            <p className="mt-1 text-sm text-slate-400">Analyze revenue by transaction type and time range.</p>
          </div>
          <select className="ledger-input w-full max-w-[180px]" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="stat-card stat-card-cyan slide-up">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Total USD</div>
          <div className="mt-2 text-2xl font-black text-white">${Number(data?.ledger?.totalUSD || 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-500">Gross revenue in selected range</div>
        </div>
        <div className="stat-card stat-card-green slide-up" style={{ animationDelay: '50ms' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Transactions</div>
          <div className="mt-2 text-2xl font-black text-white">{Number(data?.ledger?.count || 0)}</div>
          <div className="mt-1 text-xs text-slate-500">All transaction rows in scope</div>
        </div>
        <div className="stat-card stat-card-violet slide-up" style={{ animationDelay: '100ms' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Admin Share</div>
          <div className="mt-2 text-2xl font-black text-white">${Number(data?.ledger?.adminShareUSD || 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-500">Reserved for admin payouts</div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-lg font-bold text-white">Totals By Transaction Type</h2>
        <div className="space-y-2">
          {totalsByType.length === 0 && <div className="text-sm text-slate-400">No transactions in this range.</div>}
          {totalsByType.map(([type, amount]) => (
            <div key={type} className="inner-item flex items-center justify-between px-4 py-3">
              <div className="text-sm text-slate-300">{type}</div>
              <div className="text-sm font-semibold text-white">${Number(amount).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
