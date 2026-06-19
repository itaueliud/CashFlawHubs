'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { ConfirmModal, ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';
import { CheckCircle2, RefreshCcw, ShieldCheck } from 'lucide-react';

export default function ActivationsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ledger/activations/pending');
      setUsers(res.data?.pendingUsers || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load pending activations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activate = async () => {
    if (!action?.user) return;
    setBusy(true);
    try {
      await api.post(`/ledger/activations/${action.user._id}/activate`);
      setAction(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to activate user');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activations"
        description="Review users who still need activation and settle the fee against their wallet when approved."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pending" value={String(users.length)} sub="Awaiting activation" />
        <StatCard label="Wallet-backed" value={String(users.filter((user) => Number(user.balanceUSD || 0) > 0).length)} sub="Users with funds" />
        <StatCard label="Ready to review" value={String(users.filter((user) => !user.isBanned).length)} sub="Eligible accounts" />
      </section>

      <section className="flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <ShieldCheck className="h-4 w-4 text-cyan-300" />
          Pending activation queue
        </div>
        <button onClick={load} className="ledger-button">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </section>

      <section className="space-y-3">
        {users.length ? users.map((user) => (
          <div key={user._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-white">{user.name || 'Unknown user'}</div>
                <div className="mt-1 text-xs text-slate-400">{user.email || 'n/a'} · {user.phone || 'n/a'} · {user.country || 'n/a'}</div>
              </div>
              <button onClick={() => setAction({ user })} className="ledger-button">
                <CheckCircle2 className="h-4 w-4" />
                Activate
              </button>
            </div>
          </div>
        )) : (
          <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No users are currently pending activation.</div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(action)}
        title="Activate user"
        description={`Activate ${action?.user?.name || 'the selected user'} and charge the activation fee from their wallet?`}
        confirmLabel={busy ? 'Activating...' : 'Activate'}
        danger={false}
        onClose={() => !busy && setAction(null)}
        onConfirm={activate}
      />
    </div>
  );
}
