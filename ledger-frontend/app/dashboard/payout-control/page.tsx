'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ConfirmModal, ErrorBanner, LoadingSpinner, PageHeader, StatCard, StatusBadge } from '../../../components/ui';
import { BadgeDollarSign, RefreshCw, Wallet } from 'lucide-react';

type PendingAction =
  | { type: 'single'; user: any }
  | { type: 'bulk' }
  | null;

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;

export default function PayoutControlPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [bulkPreview, setBulkPreview] = useState<any>(null);
  const [pendingActivations, setPendingActivations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'pending'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [action, setAction] = useState<PendingAction>(null);

  const load = async (currentStatus: 'all' | 'pending' = status) => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, previewRes, pendingRes] = await Promise.all([
        api.get(`/ledger/payouts/users?limit=500&status=${currentStatus}`),
        api.get('/ledger/payouts/bulk-preview'),
        api.get('/ledger/activations/pending'),
      ]);
      setUsers(usersRes.data?.users || []);
      setBulkPreview(previewRes.data || null);
      setPendingActivations(pendingRes.data?.pendingUsers || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load payout control data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(status);
  }, [status]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (status === 'pending' && Number(user.pendingBalance || 0) <= 0) return false;
      if (!term) return true;
      return [user.name, user.email, user.phone, user.userRef, user.country]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term));
    });
  }, [users, search]);

  const totalPending = useMemo(
    () => filteredUsers.reduce((sum, user) => sum + Number(user.pendingBalance || 0), 0),
    [filteredUsers]
  );

  const handlePayOne = async (user: any) => {
    setBusyId(user.userId);
    try {
      await api.post(`/ledger/payouts/users/${user.userId}/pay`, { override: true });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to process payout');
    } finally {
      setBusyId(null);
      setAction(null);
    }
  };

  const handleBulkPay = async () => {
    setBusyId('bulk');
    try {
      await api.post('/ledger/payouts/bulk-pay', { override: true });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to process bulk payout');
    } finally {
      setBusyId(null);
      setAction(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payout Control"
        description="Review users with pending balances and process payouts one by one or in bulk."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Users" value={String(filteredUsers.length)} sub="Users with payout balances" />
        <StatCard label="Pending USD" value={money(totalPending)} sub="Current payout queue" />
        <StatCard label="Bulk Preview" value={money(bulkPreview?.totalUSD || 0)} sub={`${Number(bulkPreview?.userCount || 0)} users`} />
        <StatCard label="Pending Activations" value={String(pendingActivations.length)} sub="Users awaiting activation" />
      </section>

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-white">Payout queue</div>
            <p className="text-sm text-slate-400">Every row below comes from the wallet table and only appears when the user actually has money waiting to be paid.</p>
          </div>
          <button onClick={() => void load(status)} className="ledger-button">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, country, or user ref"
            className="min-w-[280px] flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | 'pending')}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="all">All users</option>
            <option value="pending">Pending payouts only</option>
          </select>
          <button
            onClick={() => setAction({ type: 'bulk' })}
            disabled={busyId === 'bulk' || filteredUsers.length === 0}
            className="ledger-button"
          >
            <BadgeDollarSign className="h-4 w-4" />
            {busyId === 'bulk' ? 'Processing...' : 'Run bulk payout'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[#050b17]">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Wallet className="h-4 w-4 text-cyan-300" />
            Users ready for payout
          </div>
          <div className="text-xs text-slate-400">
            {filteredUsers.length} records shown
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.22em] text-slate-500">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Country</th>
                <th className="px-5 py-3">Pending</th>
                <th className="px-5 py-3">Carry-over</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length ? filteredUsers.map((user) => (
                <tr key={user.userId} className="hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white">{user.name || 'Unknown user'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {user.email || 'No email'} · {user.phone || 'No phone'} · {user.userRef || 'n/a'}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{user.country || 'n/a'}</td>
                  <td className="px-5 py-4 font-mono text-cyan-300">{money(user.pendingBalance)}</td>
                  <td className="px-5 py-4 font-mono text-amber-300">{money(user.carryOver)}</td>
                  <td className="px-5 py-4"><StatusBadge status={user.accountStatus || 'unknown'} /></td>
                  <td className="px-5 py-4">
                    {Number(user.pendingBalance || 0) > 0 ? (
                      <button
                        onClick={() => setAction({ type: 'single', user })}
                        disabled={busyId === user.userId}
                        className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === user.userId ? 'Working...' : 'Pay now'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">No payout due</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">No users match the current filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(action)}
        title={action?.type === 'bulk' ? 'Run bulk payout' : 'Pay user now'}
        description={
          action?.type === 'bulk'
            ? 'This will process every eligible payout balance by calling the ledger bulk payout endpoint with override enabled.'
            : `This will pay ${action?.user?.name || 'the selected user'} immediately and create the matching transaction and audit log.`
        }
        confirmLabel={busyId ? 'Processing...' : 'Confirm'}
        onClose={() => action && !busyId && setAction(null)}
        onConfirm={() => {
          if (action?.type === 'bulk') {
            void handleBulkPay();
          } else if (action?.user) {
            void handlePayOne(action.user);
          }
        }}
      >
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
          The backend updates the wallet balance, marks the payout as successful, writes a ledger log, and notifies the user.
        </div>
      </ConfirmModal>
    </div>
  );
}
