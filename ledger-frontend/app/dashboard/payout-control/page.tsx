'use client';

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ConfirmModal, ErrorBanner, LoadingSpinner, PageHeader, Skeleton, StatCard, StatusBadge } from '../../../components/ui';
import { AlertTriangle, BadgeDollarSign, Download, FileText, RefreshCw, ShieldAlert, Wallet } from 'lucide-react';

type PendingAction =
  | { type: 'single'; user: any }
  | { type: 'bulk' }
  | null;

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;

function LoadingBlock() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <LoadingSpinner />
    </div>
  );
}

function groupByCountry(rows: any[]) {
  const grouped = new Map<string, { country: string; totalUSD: number; users: number }>();
  for (const row of rows) {
    const country = row.country || 'Unknown';
    const current = grouped.get(country) || { country, totalUSD: 0, users: 0 };
    current.totalUSD += Number(row.pendingBalance || 0);
    current.users += 1;
    grouped.set(country, current);
  }
  return Array.from(grouped.values()).sort((a, b) => b.totalUSD - a.totalUSD);
}

export default function PayoutControlPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [bulkPreview, setBulkPreview] = useState<any>(null);
  const [pendingActivations, setPendingActivations] = useState<any[]>([]);
  const [failedLogs, setFailedLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'pending'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [action, setAction] = useState<PendingAction>(null);
  const [detailsUser, setDetailsUser] = useState<any | null>(null);
  const [detailsLogs, setDetailsLogs] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const load = async (currentStatus: 'all' | 'pending' = status) => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, previewRes, pendingRes, failedRes] = await Promise.all([
        api.get(`/ledger/payouts/users?limit=500&status=${currentStatus}`),
        api.get('/ledger/payouts/bulk-preview'),
        api.get('/ledger/activations/pending'),
        api.get('/ledger/audit-logs?status=failed&limit=20'),
      ]);
      setUsers(usersRes.data?.users || []);
      setBulkPreview(previewRes.data || null);
      setPendingActivations(pendingRes.data?.pendingUsers || []);
      setFailedLogs(failedRes.data?.logs || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load payout control data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(status);
  }, [status]);

  const filteredUsers = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return users.filter((user) => {
      if (status === 'pending' && Number(user.pendingBalance || 0) <= 0) return false;
      if (!term) return true;
      return [user.name, user.email, user.phone, user.userRef, user.country]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term));
    });
  }, [users, deferredSearch, status]);

  const totalPending = useMemo(
    () => filteredUsers.reduce((sum, user) => sum + Number(user.pendingBalance || 0), 0),
    [filteredUsers]
  );

  const countryBreakdown = useMemo(() => groupByCountry(filteredUsers), [filteredUsers]);

  const selectedPreview = useMemo(() => {
    if (action?.type !== 'single' || !action.user) return null;
    return {
      amount: Number(action.user.pendingBalance || 0),
      phone: action.user.phone || 'No phone',
      name: action.user.name || 'Unknown user',
      country: action.user.country || 'n/a',
    };
  }, [action]);

  const openUserDetails = async (user: any) => {
    setDetailsUser(user);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/ledger/audit-logs?userId=${user.userId}&limit=8`);
      setDetailsLogs(res.data?.logs || []);
    } catch {
      setDetailsLogs([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handlePayOne = async (user: any) => {
    setBusyId(user.userId);
    try {
      await api.post(`/ledger/payouts/users/${user.userId}/pay`, { override: true });
      await load();
      if (detailsUser?.userId === user.userId) {
        await openUserDetails(user);
      }
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

  const exportCsv = () => {
    const rows = [
      ['Name', 'Email', 'Phone', 'Country', 'User Ref', 'Pending USD', 'Carry-over USD', 'Status'],
      ...filteredUsers.map((user) => [
        user.name || '',
        user.email || '',
        user.phone || '',
        user.country || '',
        user.userRef || '',
        Number(user.pendingBalance || 0).toFixed(2),
        Number(user.carryOver || 0).toFixed(2),
        user.accountStatus || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-control-${status}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !users.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payout Control" description="Review users with pending balances and process payouts one by one or in bulk." />
        <LoadingBlock />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:space-y-0">
      <div className="space-y-6">
        <PageHeader
          title="Payout Control"
          description="Review users with pending balances and process payouts one by one or in bulk."
        />

        {error && <ErrorBanner message={error} onRetry={() => void load(status)} />}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard accent="cyan" label="Pending Users" value={String(filteredUsers.length)} sub="Users with payout balances" />
          <StatCard accent="amber" label="Pending USD" value={money(totalPending)} sub="Current payout queue" />
          <StatCard accent="emerald" label="Bulk Preview" value={money(bulkPreview?.totalUSD || 0)} sub={`${Number(bulkPreview?.userCount || 0)} users`} />
          <StatCard accent="violet" label="Pending Activations" value={String(pendingActivations.length)} sub="Users awaiting activation" />
        </section>

        <section className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-white">Payout queue</div>
              <p className="text-sm text-slate-400">Every row below comes from the wallet table and only appears when the user actually has money waiting to be paid.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void load(status)} className="ledger-button">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button onClick={exportCsv} className="ledger-button">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
              <FileText className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, country, or user ref"
                className="w-full bg-transparent outline-none placeholder:text-slate-500"
              />
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | 'pending')}
              className="rounded-2xl border border-white/10 bg-[#09111f] px-4 py-3 text-sm text-white outline-none"
            >
              <option className="bg-[#09111f] text-white" value="all">All users</option>
              <option className="bg-[#09111f] text-white" value="pending">Pending payouts only</option>
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

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {countryBreakdown.map((row) => (
              <div key={row.country} className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{row.country}</div>
                <div className="mt-2 text-lg font-bold text-white">{money(row.totalUSD)}</div>
                <div className="mt-1 text-xs text-slate-500">{row.users} users in current filter</div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[#050b17]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Wallet className="h-4 w-4 text-cyan-300" />
              Users ready for payout
            </div>
            <div className="text-xs text-slate-400">{filteredUsers.length} records shown</div>
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
                  <tr key={user.userId} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => void openUserDetails(user)}>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{user.name || 'Unknown user'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {user.email || 'No email'} · {user.phone || 'No phone'} · {user.userRef || 'n/a'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      <div>{user.country || 'n/a'}</div>
                      {user.fraudRiskLevel && user.fraudRiskLevel !== 'low' && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[0.7rem] font-semibold text-red-300">
                          <ShieldAlert className="h-3 w-3" />
                          {user.fraudRiskLevel} risk
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-cyan-300">{money(user.pendingBalance)}</td>
                    <td className="px-5 py-4 font-mono text-amber-300">{money(user.carryOver)}</td>
                    <td className="px-5 py-4"><StatusBadge status={user.accountStatus || 'unknown'} /></td>
                    <td className="px-5 py-4">
                      {Number(user.pendingBalance || 0) > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAction({ type: 'single', user });
                          }}
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

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-white/8 bg-[#050b17] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <AlertTriangle className="h-4 w-4 text-red-300" />
              Failed payout logs
            </div>
            <div className="mt-4 space-y-3">
              {failedLogs.length ? failedLogs.map((log) => (
                <button
                  key={log._id}
                  type="button"
                  onClick={() => {
                    const userId = log.userId?._id || log.userId;
                    setDetailsUser({
                      userId,
                      name: log.username || log.userId?.name || 'Unknown user',
                      email: log.userId?.email || '',
                      phone: log.userId?.phone || '',
                      country: log.userId?.country || 'Unknown',
                    });
                    void openUserDetails({ userId });
                  }}
                  className="w-full rounded-2xl border border-white/8 bg-white/5 p-4 text-left transition hover:border-red-500/20 hover:bg-red-500/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{log.username || 'Unknown user'}</div>
                      <div className="mt-1 text-xs text-slate-500">{log.transactionType || 'payment'} · {log.failureReason || log.notes || 'No failure reason'}</div>
                    </div>
                    <div className="text-right text-xs text-slate-500">{log.processedAt ? new Date(log.processedAt).toLocaleString() : 'n/a'}</div>
                  </div>
                </button>
              )) : (
                <div className="rounded-2xl border border-white/8 bg-white/5 p-5 text-sm text-slate-500">No failed payout logs found.</div>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-[#050b17] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-cyan-300" />
              Bulk payout dry run
            </div>
            <div className="mt-3 text-sm text-slate-400">
              {bulkPreview?.userCount || 0} users totaling {money(bulkPreview?.totalUSD || 0)}.
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              {countryBreakdown.length ? countryBreakdown.map((row) => (
                <div key={row.country} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <span>{row.country}</span>
                  <span className="font-mono text-cyan-300">{money(row.totalUSD)}</span>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-slate-500">No payable users in the current filter.</div>
              )}
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[24px] border border-white/8 bg-[#050b17] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileText className="h-4 w-4 text-cyan-300" />
            User detail drawer
          </div>
          {detailsUser ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-lg font-bold text-white">{detailsUser.name || 'Unknown user'}</div>
                <div className="mt-1 text-xs text-slate-500">{detailsUser.email || 'No email'} · {detailsUser.phone || 'No phone'}</div>
                <div className="mt-1 text-xs text-slate-500">{detailsUser.country || 'Unknown'} · {detailsUser.userRef || 'n/a'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/8 bg-white/5 p-3"><div className="text-xs text-slate-500">Pending</div><div className="mt-1 font-mono text-cyan-300">{money(detailsUser.pendingBalance)}</div></div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-3"><div className="text-xs text-slate-500">Carry-over</div><div className="mt-1 font-mono text-amber-300">{money(detailsUser.carryOver)}</div></div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-3 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Recent audit</div>
                <div className="mt-3 space-y-3">
                  {detailsLoading ? (
                    <LoadingSpinner />
                  ) : detailsLogs.length ? detailsLogs.map((log) => (
                    <button key={log._id} type="button" onClick={() => setAction(null)} className="block w-full rounded-xl border border-white/8 bg-[#09111f] p-3 text-left hover:border-cyan-400/20">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-white">{log.transactionType || log.sourceLabel || 'Log entry'}</div>
                          <div className="mt-1 text-xs text-slate-500">{log.notes || log.failureReason || 'No notes'}</div>
                        </div>
                        <StatusBadge status={log.status || 'unknown'} />
                      </div>
                      <div className="mt-2 text-[0.72rem] text-slate-500">{log.processedAt ? new Date(log.processedAt).toLocaleString() : 'n/a'}</div>
                    </button>
                  )) : (
                    <div className="text-sm text-slate-500">No recent audit entries for this user.</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setAction({ type: 'single', user: detailsUser })}
                disabled={busyId === detailsUser.userId || Number(detailsUser.pendingBalance || 0) <= 0}
                className="ledger-button w-full"
              >
                <BadgeDollarSign className="h-4 w-4" />
                {busyId === detailsUser.userId ? 'Working...' : 'Pay selected user'}
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-500">Click any payout row to open its raw audit details and recent transaction history.</div>
          )}
        </div>
      </aside>

      <ConfirmModal
        open={Boolean(action)}
        title={action?.type === 'bulk' ? 'Run bulk payout' : 'Pay user now'}
        description={
          action?.type === 'bulk'
            ? 'This will process every eligible payout balance by calling the ledger bulk payout endpoint with override enabled.'
            : `This will pay ${selectedPreview?.name || action?.user?.name || 'the selected user'} immediately and create the matching transaction and audit log.`
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
        {action?.type === 'single' && selectedPreview && (
          <div className="mt-4 space-y-3 rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>Amount to send</span>
              <span className="font-mono text-cyan-300">{money(selectedPreview.amount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Phone</span>
              <span className="font-mono text-slate-100">{selectedPreview.phone}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Country</span>
              <span className="text-slate-100">{selectedPreview.country}</span>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200">
              Confirming this will clear the user&apos;s pending balance and write the payout into the audit trail.
            </div>
          </div>
        )}
        {action?.type === 'bulk' && (
          <div className="mt-4 space-y-3 rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span>Users to process</span>
              <span className="font-mono text-cyan-300">{filteredUsers.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Total amount</span>
              <span className="font-mono text-cyan-300">{money(totalPending)}</span>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200">
              Bulk payouts should only be confirmed after you verify the dry-run breakdown above.
            </div>
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}




