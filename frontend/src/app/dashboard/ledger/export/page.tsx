'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

type Range = '7d' | '30d' | '90d';

const toCsv = (rows: any[]) => {
  const headers = ['id', 'createdAt', 'type', 'status', 'provider', 'amountUSD', 'userId', 'userName', 'userEmail'];
  const body = rows.map((tx) => [
    tx._id,
    tx.createdAt,
    tx.type,
    tx.status,
    tx.provider,
    tx.amountUSD,
    tx.userId?.userId || '',
    tx.userId?.name || '',
    tx.userId?.email || '',
  ]);
  return [headers, ...body]
    .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
};

export default function LedgerExportPage() {
  const { user } = useAuthStore();
  const [range, setRange] = useState<Range>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['ledger-export', range],
    queryFn: () => api.get(`/admin/ledger?range=${range}`).then((r) => r.data),
    enabled: user?.role === 'ledger',
  });

  const onExport = () => {
    const rows = data?.ledger?.transactions || [];
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  if (user?.role !== 'ledger') return <div className="card text-sm text-slate-400">Ledger access required.</div>;
  if (isLoading) return <div className="card text-sm text-slate-400">Preparing export data...</div>;

  return (
    <div className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-white">Export Ledger Data</h1>
        <p className="mt-2 text-sm text-slate-400">Download transaction records for reporting and audits.</p>
      </div>
      <div className="card space-y-4">
        <label className="block text-sm text-slate-300">Range</label>
        <select className="input max-w-[180px]" value={range} onChange={(e) => setRange(e.target.value as Range)}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        <div className="text-sm text-slate-400">Records: {Number(data?.ledger?.transactions?.length || 0)}</div>
        <button onClick={onExport} className="btn-primary">Export CSV</button>
      </div>
    </div>
  );
}
