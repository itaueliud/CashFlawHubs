'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ConfirmModal, ErrorBanner, LoadingSpinner, PageHeader, StatCard, StatusBadge } from '../../../components/ui';
import { RefreshCw, Layers3, BadgeCheck, Trash2 } from 'lucide-react';

type CarryAction =
  | { type: 'apply'; item: any }
  | { type: 'writeoff'; item: any; reason: string }
  | { type: 'bulk' }
  | null;

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;

export default function CarryoverPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [action, setAction] = useState<CarryAction>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ledger/payouts/carryover');
      setRows(res.data?.carryOvers || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load carry-over balances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const user = row.user || {};
      if (!term) return true;
      return [user.name, user.email, user.phone, user.userId, user.country]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [rows, search]);

  const totalCarryOver = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.carryOver || 0), 0),
    [filteredRows]
  );

  const applyOne = async (userId: string) => {
    setBusyId(userId);
    try {
      await api.post(`/ledger/payouts/carryover/${userId}/apply`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to apply carry-over');
    } finally {
      setBusyId(null);
      setAction(null);
    }
  };

  const writeOff = async (userId: string, reason: string) => {
    setBusyId(userId);
    try {
      await api.post(`/ledger/payouts/carryover/${userId}/write-off`, { reason });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to write off carry-over');
    } finally {
      setBusyId(null);
      setAction(null);
    }
  };

  const bulkApply = async () => {
    setBusyId('bulk');
    try {
      await api.post('/ledger/payouts/carryover/bulk-apply');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to bulk apply carry-over');
    } finally {
      setBusyId(null);
      setAction(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carry-Over"
        description="Review balances that were deferred, apply them back to pending balance, or write them off with a reason."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Users" value={String(filteredRows.length)} sub="Carry-over records visible" />
        <StatCard label="Total Carry-Over" value={money(totalCarryOver)} sub="Filtered carry-over value" />
        <StatCard label="Bulk Ready" value={String(filteredRows.filter((row) => Number(row.carryOver || 0) > 0).length)} sub="Eligible for bulk apply" />
      </section>

      <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-white">Carry-over queue</div>
            <p className="text-sm text-slate-400">These balances can be reinstated into pending payouts or written off for audit reasons.</p>
          </div>
          <button onClick={load} className="ledger-button">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search carry-over records"
            className="min-w-[280px] flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <button
            onClick={() => setAction({ type: 'bulk' })}
            disabled={busyId === 'bulk' || filteredRows.length === 0}
            className="ledger-button"
          >
            <Layers3 className="h-4 w-4" />
            {busyId === 'bulk' ? 'Applying...' : 'Bulk apply'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[#050b17]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.22em] text-slate-500">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Balance</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRows.length ? filteredRows.map((row: any) => {
                const user = row.user || {};
                return (
                  <tr key={user._id || user.userId || user.email} className="hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{user.name || 'Unknown user'}</div>
                      <div className="mt-1 text-xs text-slate-500">{user.email || 'No email'} · {user.phone || 'No phone'} · {user.country || 'n/a'}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-cyan-300">{money(row.carryOver)}</td>
                    <td className="px-5 py-4"><StatusBadge status={user.isBanned ? 'banned' : user.isActive ? 'active' : 'pending'} /></td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setAction({ type: 'apply', item: row })}
                          disabled={busyId === (user._id || user.userId)}
                          className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => setAction({ type: 'writeoff', item: row, reason: '' })}
                          disabled={busyId === (user._id || user.userId)}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
                        >
                          Write off
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-500">No carry-over records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(action)}
        title={action?.type === 'bulk' ? 'Bulk apply carry-over' : action?.type === 'apply' ? 'Apply carry-over' : 'Write off carry-over'}
        description={
          action?.type === 'bulk'
            ? 'This will move every eligible carry-over amount back into pending balances.'
            : action?.type === 'apply'
              ? `This will apply ${money(action?.item?.carryOver)} to the selected user's pending balance.`
              : `This will permanently write off ${money(action?.item?.carryOver)} from the selected user.`
        }
        confirmLabel={busyId ? 'Working...' : 'Confirm'}
        danger={action?.type === 'writeoff'}
        onClose={() => action && !busyId && setAction(null)}
        onConfirm={() => {
          if (action?.type === 'bulk') {
            void bulkApply();
          } else if (action?.type === 'apply') {
            void applyOne(String(action.item.user?._id || action.item.user?.userId || action.item.userId || ''));
          } else if (action?.type === 'writeoff') {
            void writeOff(String(action.item.user?._id || action.item.user?.userId || action.item.userId || ''), action.reason || 'Carry-over reviewed and written off');
          }
        }}
      >
        {action?.type === 'writeoff' && (
          <div className="mt-4">
            <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Reason</label>
            <textarea
              autoFocus
              value={action.reason}
              onChange={(e) =>
                setAction((current) => (current && current.type === 'writeoff' ? { ...current, reason: e.target.value } : current))
              }
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              placeholder="Enter the reason for the write-off"
            />
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
