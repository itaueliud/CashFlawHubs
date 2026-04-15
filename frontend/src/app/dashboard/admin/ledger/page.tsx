'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Landmark, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export default function AdminLedgerPage() {
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ledger'],
    queryFn: () => api.get('/admin/ledger?range=30d').then((response) => response.data),
  });

  const executeMutation = useMutation({
    mutationFn: () => api.post('/admin/ledger/payouts/execute', { range: '30d' }),
    onSuccess: (response) => {
      setShowConfirm(false);
      setToastMessage('Payout executed successfully! Wallets have been credited.');
      queryClient.invalidateQueries({ queryKey: ['admin-ledger'] });
      setTimeout(() => setToastMessage(''), 3000);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to execute payout';
      setToastMessage(`Error: ${message}`);
      setTimeout(() => setToastMessage(''), 3000);
    },
  });

  if (isLoading) {
    return <div className="card text-sm text-slate-400">Loading ledger...</div>;
  }

  if (!data?.success) {
    return <div className="card text-sm text-red-400">Unable to load ledger.</div>;
  }

  const ledger = data.ledger;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
              <Landmark size={12} /> Ledger panel
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Revenue split overview</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Superadmin receives the majority payout share, with the remaining share assigned to admins.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-slate-400">Total earned</div>
              <div className="text-2xl font-black text-blue-300">${Number(ledger.totalUSD || 0).toFixed(2)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-slate-400">Transactions</div>
              <div className="text-2xl font-black text-white">{ledger.count || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <TrendingUp className="mb-2 text-blue-300" />
          <div className="text-xs text-slate-400">Superadmin share</div>
          <div className="text-3xl font-black text-white">{ledger.superadminSharePercent}%</div>
          <div className="mt-2 text-sm text-slate-300">${Number(ledger.superadminShareUSD || 0).toFixed(2)}</div>
        </div>
        <div className="card">
          <Users className="mb-2 text-blue-300" />
          <div className="text-xs text-slate-400">Admin share</div>
          <div className="text-3xl font-black text-white">{ledger.adminSharePercent}%</div>
          <div className="mt-2 text-sm text-slate-300">${Number(ledger.adminShareUSD || 0).toFixed(2)}</div>
        </div>
        <div className="card">
          <Landmark className="mb-2 text-blue-300" />
          <div className="text-xs text-slate-400">Policy</div>
          <div className="text-3xl font-black text-white">{ledger.superadminSharePercent >= 51 ? 'Valid' : 'Adjust'}</div>
          <div className="mt-2 text-sm text-slate-300">Top role keeps more than half of earned revenue.</div>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Recent ledger entries</h2>
          <p className="text-sm text-slate-400">Internal earning transactions included in the split preview.</p>
        </div>

        <div className="space-y-3">
          {(ledger.transactions || []).map((tx: any) => (
            <div key={tx._id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{tx.type.replace('_', ' ')}</div>
                  <div className="text-xs text-slate-500">{tx.userId?.name || 'Platform'} · {new Date(tx.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-right text-sm font-semibold text-green-400">+${Number(tx.amountUSD || 0).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {ledger.totalUSD > 0 && (
        <div className="card">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={executeMutation.isPending || ledger.superadminSharePercent < 51}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white transition hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executeMutation.isPending ? 'Executing payout...' : 'Execute Payout'}
          </button>
        </div>
      )}

      {toastMessage && (
        <div className={`fixed bottom-4 right-4 rounded-lg px-4 py-3 text-sm font-semibold text-white ${
          toastMessage.startsWith('Error') ? 'bg-red-600' : 'bg-green-600'
        }`}>
          {toastMessage}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl w-full max-w-md mx-4">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="text-yellow-400" size={24} />
              <h3 className="text-lg font-bold text-white">Confirm Payout Execution</h3>
            </div>

            <div className="mb-6 space-y-3 text-sm">
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                <div className="text-slate-400">Total to distribute</div>
                <div className="text-2xl font-black text-white">${Number(ledger.totalUSD || 0).toFixed(2)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                  <div className="text-xs text-blue-300">Superadmin ({ledger.superadminSharePercent}%)</div>
                  <div className="text-xl font-bold text-blue-200">${Number(ledger.superadminShareUSD || 0).toFixed(2)}</div>
                </div>
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
                  <div className="text-xs text-purple-300">Admin ({ledger.adminSharePercent}%)</div>
                  <div className="text-xl font-bold text-purple-200">${Number(ledger.adminShareUSD || 0).toFixed(2)}</div>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                This action will credit wallets atomically and cannot be undone for this period.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={executeMutation.isPending}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeMutation.mutate()}
                disabled={executeMutation.isPending}
                className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 font-semibold text-white transition hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
              >
                {executeMutation.isPending ? 'Executing...' : 'Execute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
