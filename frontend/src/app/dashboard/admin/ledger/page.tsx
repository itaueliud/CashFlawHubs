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
  const [tab, setTab] = useState<'summary' | 'staff' | 'b2c' | 'rails'>('summary');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ledger'],
    queryFn: () => api.get('/admin/ledger?range=30d').then((response) => response.data),
  });

  const { data: adminsData } = useQuery({
    queryKey: ['ledger-admins'],
    queryFn: () => api.get('/admin/admins').then((r) => r.data),
    enabled: user?.role === 'ledger' || user?.role === 'superadmin',
  });

  const { data: b2cData } = useQuery({
    queryKey: ['b2c-health'],
    queryFn: () => api.get('/admin/ledger/b2c-health').then((r) => r.data),
    enabled: tab === 'b2c',
  });

  const { data: railsData } = useQuery({
    queryKey: ['ledger-rails'],
    queryFn: () => api.get('/ledger/rails').then((r) => r.data),
    enabled: tab === 'rails',
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

  const toggleRailMutation = useMutation({
    mutationFn: ({ strategyId, isEnabled, reason }: any) => api.post('/ledger/rails/toggle', { strategyId, isEnabled, reason }),
    onSuccess: () => {
      toast.success('Rail status updated');
      queryClient.invalidateQueries({ queryKey: ['ledger-rails'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update rail');
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

  if (!['ledger', 'superadmin'].includes(user?.role || '')) {
    return <div className="card text-sm text-slate-400">Ledger dashboard is only available to ledger or superadmin accounts.</div>;
  }

  if (!data?.success) {
    return <div className="card text-sm text-red-400">Unable to load ledger.</div>;
  }

  const ledger = data.ledger;

  return (
    <div className="dashboard-shell animate-fade-in">
      <div className="dashboard-hero p-6 sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              <Landmark size={12} /> Ledger panel
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Ledger & Operations</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Revenue split, payout execution, and governance over admin and superadmin accounts.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="stat-card stat-card-cyan">
              <div className="text-xs text-slate-400">Total earned</div>
              <div className="mt-2 text-2xl font-black text-white">${Number(ledger.totalUSD || 0).toFixed(2)}</div>
            </div>
            <div className="stat-card stat-card-green">
              <div className="text-xs text-slate-400">Transactions</div>
              <div className="mt-2 text-2xl font-black text-white">{ledger.count || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-tablist">
        {([
          ['summary', 'Summary'],
          ['staff', 'Admins/Superadmins'],
          ['b2c', 'B2C Monitoring'],
          ['rails', 'Payment Rails'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`tab-pill press ${tab === id ? 'tab-pill-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <>
          {ledger.totalUSD > 0 && ['ledger', 'superadmin'].includes(user?.role || '') && (
            <div className="card p-5">
              <button
                onClick={() => setShowConfirm(true)}
                disabled={executeMutation.isPending}
                className="ledger-button press w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {executeMutation.isPending ? 'Executing payout...' : 'Execute Payout'}
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'staff' && (
        <div className="card space-y-3 p-5">
          <h2 className="text-xl font-bold text-white">Superadmins and Admins</h2>
          {(adminsData?.admins || []).map((admin: any) => (
            <div key={admin._id} className="inner-item flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{admin.name}</div>
                <div className="text-xs text-slate-500">{admin.email} | {admin.phone}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={admin.role === 'superadmin' ? 'badge-green' : 'badge-blue'}>{admin.role}</span>
                <button
                  onClick={() => blockAdmin(admin._id, admin.isBanned)}
                  className={`ledger-button press inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold ${admin.isBanned ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}
                >
                  {admin.isBanned ? <Unlock size={12} /> : <Ban size={12} />} {admin.isBanned ? 'Unblock' : 'Block'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'b2c' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="stat-card stat-card-green">
              <div className="text-xs text-slate-400">Today Successful</div>
              <div className="mt-2 text-2xl font-black text-emerald-400">{b2cData?.b2c?.todaySuccessful || 0}</div>
            </div>
            <div className="stat-card stat-card-red">
              <div className="text-xs text-slate-400">Today Failed</div>
              <div className="mt-2 text-2xl font-black text-red-400">{b2cData?.b2c?.todayFailed || 0}</div>
            </div>
            <div className="stat-card stat-card-blue">
              <div className="text-xs text-slate-400">Pending Right Now</div>
              <div className="mt-2 text-2xl font-black text-blue-400">{b2cData?.b2c?.pendingCount || 0}</div>
            </div>
            <div className="stat-card stat-card-amber">
              <div className="text-xs text-slate-400">Stuck (&gt;30m)</div>
              <div className="mt-2 text-2xl font-black text-orange-400">{b2cData?.b2c?.stuckWithdrawals?.length || 0}</div>
            </div>
          </div>

          {b2cData?.b2c?.stuckWithdrawals?.length > 0 && (
            <div className="card border border-orange-500/20 bg-orange-500/10 p-5">
              <div className="mb-2 font-bold text-orange-400">Stuck Withdrawals (Manual Check Required)</div>
              <div className="space-y-2">
                {b2cData.b2c.stuckWithdrawals.map((w: any) => (
                  <div key={w._id} className="inner-item flex justify-between px-4 py-3 text-sm">
                    <span className="text-slate-300">User: {w.userId}</span>
                    <span className="text-orange-300">${w.amountUSD}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'rails' && (
        <div className="card space-y-3 p-5">
          <h2 className="text-xl font-bold text-white">Payment Rails</h2>
          <div className="text-sm text-slate-400 mb-4">Enable or disable specific payment rails across the platform.</div>
          {(railsData?.states || []).map((state: any) => (
            <div key={state.strategyId} className="inner-item flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{state.strategyId}</div>
                {state.disabledReason && <div className="text-xs text-red-400">Disabled: {state.disabledReason}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const reason = state.isEnabled ? prompt('Reason for disabling:') : null;
                    if (state.isEnabled && !reason) return; // cancelled prompt
                    toggleRailMutation.mutate({ strategyId: state.strategyId, isEnabled: !state.isEnabled, reason });
                  }}
                  className={`ledger-button press inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold ${state.isEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}
                >
                  {state.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          ))}
          {(!railsData?.states || railsData.states.length === 0) && (
            <div className="text-sm text-slate-400">No rail states configured yet.</div>
          )}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/8 bg-[#07101e] p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="text-yellow-400" size={24} />
              <h3 className="text-lg font-bold text-white">Confirm Payout Execution</h3>
            </div>
            <p className="mb-5 text-sm text-slate-300">This will distribute ledger funds to superadmin and admins for the selected period.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setShowConfirm(false)} className="ledger-button press flex-1 rounded-xl border border-white/8 bg-white/5 px-4 py-2 font-semibold text-slate-200">Cancel</button>
              <button onClick={() => executeMutation.mutate()} className="ledger-button press flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 font-semibold text-slate-950">Execute</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
