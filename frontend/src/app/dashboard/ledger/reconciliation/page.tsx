'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const SAMPLE = `[
  { "reference": "TXN-1001", "provider": "paystack", "amountUSD": 12.5, "status": "successful" },
  { "reference": "TXN-1002", "provider": "daraja", "amountUSD": 7.0, "status": "successful" }
]`;

export default function ReconciliationPage() {
  const queryClient = useQueryClient();
  const [source, setSource] = useState('provider_file');
  const [payload, setPayload] = useState(SAMPLE);

  const { data, isLoading } = useQuery({
    queryKey: ['reconciliation-batches'],
    queryFn: () => api.get('/admin-advanced/reconciliation/batches').then((r) => r.data),
  });

  const importMutation = useMutation({
    mutationFn: (entries: any[]) => api.post('/admin-advanced/reconciliation/import', { source, entries }),
    onSuccess: () => {
      toast.success('Reconciliation imported');
      queryClient.invalidateQueries({ queryKey: ['reconciliation-batches'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Import failed'),
  });

  const batches = data?.batches || [];

  const latest = useMemo(() => batches[0], [batches]);

  const onImport = () => {
    try {
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed)) throw new Error('Payload must be an array');
      importMutation.mutate(parsed);
    } catch (error: any) {
      toast.error(error?.message || 'Invalid JSON');
    }
  };

  return (
    <div className="space-y-5">
      <div className="card"><h1 className="text-2xl font-bold text-white">Reconciliation Import</h1><p className="mt-1 text-sm text-slate-400">Import settlement rows and auto-match with ledger transactions.</p></div>

      <div className="card space-y-3">
        <input className="input max-w-[260px]" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source" />
        <textarea className="input min-h-44" value={payload} onChange={(e) => setPayload(e.target.value)} />
        <button className="btn-primary" disabled={importMutation.isPending} onClick={onImport}>{importMutation.isPending ? 'Importing...' : 'Import Batch'}</button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card"><div className="text-xs text-slate-400">Total batches</div><div className="text-2xl font-black text-white">{batches.length}</div></div>
        <div className="card"><div className="text-xs text-slate-400">Latest total</div><div className="text-2xl font-black text-white">{latest?.summary?.total || 0}</div></div>
        <div className="card"><div className="text-xs text-slate-400">Latest matched</div><div className="text-2xl font-black text-emerald-300">{latest?.summary?.matched || 0}</div></div>
        <div className="card"><div className="text-xs text-slate-400">Latest unmatched</div><div className="text-2xl font-black text-yellow-300">{latest?.summary?.unmatched || 0}</div></div>
      </div>

      {isLoading ? <div className="card text-sm text-slate-400">Loading batches...</div> : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-slate-700 text-left text-slate-400"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Imported By</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Matched</th><th className="px-3 py-2">Unmatched</th></tr></thead>
            <tbody>
              {batches.map((batch: any) => (
                <tr key={batch._id} className="border-b border-slate-800">
                  <td className="px-3 py-2 text-slate-300">{new Date(batch.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-300">{batch.source}</td>
                  <td className="px-3 py-2 text-slate-300">{batch.importedBy?.name || '-'}</td>
                  <td className="px-3 py-2 text-slate-300">{batch.summary?.total || 0}</td>
                  <td className="px-3 py-2 text-emerald-300">{batch.summary?.matched || 0}</td>
                  <td className="px-3 py-2 text-yellow-300">{batch.summary?.unmatched || 0}</td>
                </tr>
              ))}
              {batches.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No reconciliation batches yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
