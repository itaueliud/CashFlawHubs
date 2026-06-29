'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from '../../../components/ui';
import { ClipboardList, Dot, RefreshCw, X } from 'lucide-react';

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;

const formatJson = (value: any) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? '');
  }
};

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
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const requestSeqRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (page = pagination.page, activeFilters = filters, silent = false) => {
    const requestSeq = ++requestSeqRef.current;
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
      if (requestSeq !== requestSeqRef.current) return;
      setLogs(res.data?.logs || []);
      setPagination(res.data?.pagination || { page, limit: pagination.limit, total: 0 });
    } catch (err: any) {
      if (requestSeq === requestSeqRef.current) {
        setError(err?.response?.data?.message || 'Failed to load audit logs');
      }
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void load(1, filters);
    const timer = window.setInterval(() => void load(1, filters, true), 10000);
    return () => window.clearInterval(timer);
  }, [filters]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedLog(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const pages = useMemo(() => Math.max(1, Math.ceil((pagination.total || 0) / (pagination.limit || 50))), [pagination]);

  if (loading) return <LoadingSpinner />;

  return (
    <>
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
            <button onClick={() => load(pagination.page, filters)} className="ledger-button">
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
            <button onClick={() => load(1, filters)} className="ledger-button">
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
                  <tr
                    key={log._id}
                    onClick={() => setSelectedLog(log)}
                    className={`cursor-pointer transition hover:bg-white/[0.03] ${selectedLog?._id === log._id ? 'bg-cyan-400/10' : ''}`}
                  >
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
              onClick={() => load(Math.max(1, (pagination.page || 1) - 1), filters)}
              disabled={(pagination.page || 1) <= 1}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => load(Math.min(pages, (pagination.page || 1) + 1), filters)}
              disabled={(pagination.page || 1) >= pages}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </section>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close audit drawer"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
          />
          <aside className="relative ml-auto flex h-full w-full max-w-[44rem] flex-col border-l border-white/10 bg-[#050b17] shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">Log details</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedLog.sourceLabel || selectedLog.source || 'Audit entry'}</h2>
                <p className="mt-1 text-sm text-slate-400">{selectedLog.transactionType || 'n/a'} · {selectedLog.status || 'unknown'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">User</div>
                  <div className="mt-2 font-semibold text-white">{selectedLog.userId?.name || selectedLog.username || 'Unknown user'}</div>
                  <div className="mt-1 text-sm text-slate-400">{selectedLog.userId?.email || selectedLog.userId?.phone || selectedLog.userId?.userId || 'n/a'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Amount</div>
                  <div className="mt-2 font-mono text-xl font-semibold text-cyan-300">{money(selectedLog.amount)}</div>
                  <div className="mt-1 text-sm text-slate-400">Processed at {selectedLog.processedAt ? new Date(selectedLog.processedAt).toLocaleString() : 'n/a'}</div>
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Failure reason</div>
                  <div className="mt-2 text-sm text-slate-200">{selectedLog.failureReason || 'No failure reason recorded.'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Processed by</div>
                  <div className="mt-2 text-sm text-slate-200">{selectedLog.processedByName || selectedLog.processedBy?.name || selectedLog.processedBy?.email || 'n/a'}</div>
                  <div className="mt-1 text-xs text-slate-500">{selectedLog.relatedTransactionId || 'No linked transaction'}</div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Notes</div>
                <div className="mt-2 text-sm text-slate-200">{selectedLog.notes || 'No notes recorded.'}</div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#02060f] p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Raw payload</div>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-300">
                  {formatJson(selectedLog.rawPayload || selectedLog)}
                </pre>
              </section>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}





