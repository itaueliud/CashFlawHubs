'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Landmark, TrendingUp, Users, AlertCircle, Ban, Unlock } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function AdminLedgerPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [tab, setTab] = useState<'summary' | 'staff'>('summary');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ledger'],
    queryFn: () => api.get('/admin/ledger?range=30d').then((response) => response.data),
  });

  const { data: adminsData } = useQuery({
    queryKey: ['ledger-admins'],
    queryFn: () => api.get('/admin/admins').then((r) => r.data),
    enabled: user?.role === 'ledger',
  });

  const executeMutation = useMutation({
    mutationFn: () => api.post('/admin/ledger/payouts/execute', { range: '30d' }),
    onSuccess: () => {
      setShowConfirm(false);
      toast.success('Payout executed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-ledger'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to execute payout');
    },
  });

  const blockAdmin = async (id: string, isBanned: boolean) => {
    try {
      await api.put(`/admin/admins/${id}/${isBanned ? 'unban' : 'ban'}`, {
        reason: 'Managed from ledger panel',
      });
      toast.success(isBanned ? 'Staff unblocked' : 'Staff blocked');
      queryClient.invalidateQueries({ queryKey: ['ledger-admins'] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update staff');
    }
  };

  if (isLoading) {
    return <div className="card text-sm text-slate-400">Loading ledger...</div>;
  }

  if (user?.role !== 'ledger') {
    return <div className="card text-sm text-slate-400">Ledger dashboard is only available to ledger accounts.</div>;
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
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Ledger & Operations</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Revenue split, payout execution, and governance over admin and superadmin accounts.
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

      <div className="flex gap-2">
        {([
          ['summary', 'Summary'],
          ['staff', 'Admins/Superadmins'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-blue-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <>
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

          {ledger.totalUSD > 0 && user?.role === 'ledger' && (
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
        </>
      )}

      {tab === 'staff' && (
        <div className="card space-y-3">
          <h2 className="text-xl font-bold text-white">Superadmins and Admins</h2>
          {(adminsData?.admins || []).map((admin: any) => (
            <div key={admin._id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{admin.name}</div>
                <div className="text-xs text-slate-500">{admin.email} | {admin.phone}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={admin.role === 'superadmin' ? 'badge-green' : 'badge-blue'}>{admin.role}</span>
                <button
                  onClick={() => blockAdmin(admin._id, admin.isBanned)}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold ${admin.isBanned ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}
                >
                  {admin.isBanned ? <Unlock size={12} /> : <Ban size={12} />} {admin.isBanned ? 'Unblock' : 'Block'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl w-full max-w-md mx-4">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="text-yellow-400" size={24} />
              <h3 className="text-lg font-bold text-white">Confirm Payout Execution</h3>
            </div>
            <p className="text-sm text-slate-300 mb-5">This will distribute ledger funds to superadmin and admins for the selected period.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 font-semibold text-slate-200">Cancel</button>
              <button onClick={() => executeMutation.mutate()} className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 font-semibold text-white">Execute</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
