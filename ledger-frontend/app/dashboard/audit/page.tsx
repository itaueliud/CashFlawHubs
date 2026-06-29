'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from '../../../components/ui';
import { RefreshCw, ClipboardList, Dot } from 'lucide-react';

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ page: 1, limit: 50, total: 0 });
  const [filters, setFilters] = useState({
    transactionType: '',
    status: '',
    processedBy: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (page = pagination.page, activeFilters = filters, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pagination.limit));
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const res = await api.get(`/ledger/audit-logs?${params.toString()}`);
      setLogs(res.data?.logs || []);
      setPagination(res.data?.pagination || { page, limit: pagination.limit, total: 0 });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1, filters);
    const timer = window.setInterval(() => void load(1, filters, true), 10000);
    return () => window.clearInterval(timer);
  }, [filters]);

  const pages = useMemo(() => Math.max(1, Math.ceil((pagination.total || 0) / (pagination.limit || 50))), [pagination]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Live transaction and ledger events for withdrawals, deposits, token spends, job posts, payouts, and adjustments."
      />

      {error && <ErrorBanner message={error} />}

      <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Filters</div>
            <p className="text-xs text-slate-400">Filter by type, status, date, user, or processor.</p>
          </div>
          <button onClick={() => load(pagination.page)} className="ledger-button">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['transactionType', 'Transaction type', 'withdrawal / deposit / job_posting / token_spend / payout'],
            ['status', 'Status', 'success / failed / pending / reversed'],
            ['processedBy', 'Processed by', 'operator user id'],
            ['userId', 'User ID', 'target user id'],
            ['dateFrom', 'From date', 'YYYY-MM-DD'],
            ['dateTo', 'To date', 'YYYY-MM-DD'],
          ].map(([key, label, placeholder]) => (
            <label key={key} className="block">
              <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
              <input
                value={(filters as any)[key]}
                onChange={(e) => setFilters((current) => ({ ...current, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => load(1)} className="ledger-button">
            <ClipboardList className="h-4 w-4" />
            Apply filters
          </button>
          <button
            onClick={() => {
              const emptyFilters = { transactionType: '', status: '', processedBy: '', userId: '', dateFrom: '', dateTo: '' };
              setFilters(emptyFilters);
              void load(1, emptyFilters);
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[#050b17]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.22em] text-slate-500">
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Processed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.length ? logs.map((log: any) => (
                <tr key={log._id} className="hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Dot className="h-4 w-4 text-cyan-300" />
                      {log.sourceLabel || log.source || 'n/a'}
                    </div>
                    {log.notes && <div className="mt-1 text-xs text-slate-500">{log.notes}</div>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white">{log.userId?.name || log.username || 'Unknown user'}</div>
                    <div className="mt-1 text-xs text-slate-500">{log.userId?.email || log.userId?.phone || log.userId?.userId || 'n/a'}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{log.transactionType || 'n/a'}</td>
                  <td className="px-5 py-4 font-mono text-cyan-300">{money(log.amount)}</td>
                  <td className="px-5 py-4"><StatusBadge status={log.status || 'unknown'} /></td>
                  <td className="px-5 py-4 text-slate-400">{log.processedAt ? new Date(log.processedAt).toLocaleString() : 'n/a'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <div>
          Page {pagination.page || 1} of {pages}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(Math.max(1, (pagination.page || 1) - 1))}
            disabled={(pagination.page || 1) <= 1}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => load(Math.min(pages, (pagination.page || 1) + 1))}
            disabled={(pagination.page || 1) >= pages}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}



