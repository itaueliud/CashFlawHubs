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
    <div className="dashboard-shell">
      <div className="card">
        <div className="dashboard-toolbar">
          <h1 className="text-2xl font-bold text-white">Ledger Reports</h1>
          <select className="input w-full max-w-[140px]" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="card"><div className="text-xs text-slate-400">Total USD</div><div className="text-2xl font-black text-white">${Number(data?.ledger?.totalUSD || 0).toFixed(2)}</div></div>
        <div className="card"><div className="text-xs text-slate-400">Transactions</div><div className="text-2xl font-black text-white">{Number(data?.ledger?.count || 0)}</div></div>
        <div className="card"><div className="text-xs text-slate-400">Admin Share</div><div className="text-2xl font-black text-white">${Number(data?.ledger?.adminShareUSD || 0).toFixed(2)}</div></div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-white">Totals By Transaction Type</h2>
        <div className="space-y-2">
          {totalsByType.length === 0 && <div className="text-sm text-slate-400">No transactions in this range.</div>}
          {totalsByType.map(([type, amount]) => (
            <div key={type} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3">
              <div className="text-sm text-slate-300">{type}</div>
              <div className="text-sm font-semibold text-white">${Number(amount).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

