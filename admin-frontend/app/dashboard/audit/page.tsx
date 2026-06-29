'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../lib/api';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorBanner, LoadingSpinner, PageHeader } from '../../../components/ui';

interface AuditLog {
  _id: string;
  createdAt: string;
  actor?: { name?: string; email?: string; userId?: string };
  actorId?: { name?: string; email?: string; userId?: string };
  action: string;
  module: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
}

const criticalFragments = ['delete', 'ban', 'unban', 'reject', 'approve', 'reset', 'payout', 'withdrawal', 'correct', 'toggle', 'suspend', 'login_failed'];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ module: 'all', action: 'all' });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const requestSeqRef = useRef(0);

  const loadLogs = async (page = 1, searchTerm = search, filterModule = filters.module, filterAction = filters.action) => {
    const requestSeq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (filterModule !== 'all') params.module = filterModule;
      if (filterAction !== 'all') params.action = filterAction;
      const response = await api.get('/admin-advanced/audit/logs', { params });
      if (requestSeq !== requestSeqRef.current) return;
      setLogs(response.data?.logs || []);
      setPagination(response.data?.pagination || { total: 0, page: 1, limit: 50 });
      setError(null);
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
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modules = useMemo(() => Array.from(new Set(logs.map((log) => log.module))).sort(), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))).sort(), [logs]);
  const maxPage = Math.ceil(pagination.total / pagination.limit);

  const getActorName = (log: AuditLog) => {
    const actor = log.actor || log.actorId;
    if (!actor) return log.module === 'auth' ? 'Anonymous' : 'System';
    return actor.name || actor.email || actor.userId || 'Unknown';
  };

  const isCritical = (log: AuditLog) =>
    criticalFragments.some((fragment) => `${log.action} ${log.module}`.toLowerCase().includes(fragment));

  const criticalLogs = logs.filter(isCritical).slice(0, 5);
  const authLogs = logs.filter((log) => log.module === 'auth');
  const failedLogins = authLogs.filter((log) => String(log.action).includes('failed')).length;
  const successfulLogins = authLogs.filter((log) => String(log.action).includes('success')).length;

  const handleSearch = (value: string) => {
    setSearch(value);
    loadLogs(1, value);
  };

  const handleFilterChange = (key: 'module' | 'action', value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    loadLogs(1, search, next.module, next.action);
  };

  const handlePageChange = (page: number) => {
    loadLogs(page, search, filters.module, filters.action);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Review admin actions, login successes, and failed login attempts. Transaction logs are intentionally excluded until the ledger view is added."
      />

      {error && <ErrorBanner message={error} />}

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">Critical events</div>
            <div className="text-xs text-slate-400">Sensitive actions are highlighted first so you can spot risk quickly.</div>
          </div>
          <div className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
            {criticalLogs.length} flagged on this page
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {criticalLogs.length > 0 ? (
            criticalLogs.map((log) => (
              <div key={log._id} className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-red-200">Critical</div>
                <div className="mt-2 text-sm font-bold text-white">{log.action}</div>
                <div className="mt-1 text-xs text-red-100/80">{getActorName(log)}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400">No critical logs on the current page.</div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Auth logs</div>
          <div className="mt-2 text-3xl font-black text-white">{authLogs.length}</div>
          <div className="mt-1 text-sm text-slate-400">Login attempts shown on this page</div>
        </div>
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Successful logins</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">{successfulLogins}</div>
          <div className="mt-1 text-sm text-slate-400">Completed sessions with audit trail</div>
        </div>
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Failed logins</div>
          <div className="mt-2 text-3xl font-black text-red-300">{failedLogins}</div>
          <div className="mt-1 text-sm text-slate-400">Invalid credentials, portal mismatches, and 2FA failures</div>
        </div>
      </section>

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="text-sm font-semibold text-white">Included modules</div>
        <div className="mt-2 text-sm text-slate-400">
          moderation, support, config, reconciliation, fraud, broadcast, KYC, user administration, and auth events are visible here. Transaction activity stays out of this queue for now.
        </div>
      </section>

      <section className="card-surface soft-up space-y-4 rounded-[24px] p-5">
        <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/5 px-4 py-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search audit logs..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={filters.module}
            onChange={(e) => handleFilterChange('module', e.target.value)}
            className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white outline-none"
          >
            <option value="all">All Modules</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>

          <select
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white outline-none"
          >
            <option value="all">All Actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportJSON}
            disabled={logs.length === 0}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export JSON
          </button>
        </div>
      </section>

      <section className="card-surface soft-up overflow-hidden rounded-[24px]">
        {loading ? (
          <LoadingSpinner />
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/8 bg-white/5">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs
                  .slice()
                  .map((log) => {
                    const metadataText = log.metadata ? JSON.stringify(log.metadata) : '';
                    return (
                      <tr
                        key={log._id}
                        className={`cursor-pointer hover:bg-white/[0.03] ${isCritical(log) ? 'bg-red-500/5' : ''}`}
                        onClick={() => setSelectedLog(selectedLog?._id === log._id ? null : log)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-200">{getActorName(log)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                              isCritical(log) ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {log.module}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                              isCritical(log) ? 'bg-red-500/20 text-red-300' : 'bg-purple-500/20 text-purple-300'
                            }`}
                          >
                            {log.action}
                          </span>
                          {log.module === 'auth' && (
                            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {String(log.action).includes('failed') ? 'Failed login' : 'Successful login'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{log.targetType || 'â€”'}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {metadataText ? `${metadataText.slice(0, 80)}${metadataText.length > 80 ? '...' : ''}` : 'No details'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedLog && (
        <section className="card-surface soft-up rounded-[24px] border-l-4 border-blue-500 p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Audit Entry Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Time</div>
              <div className="mt-1 text-white">{new Date(selectedLog.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Actor</div>
              <div className="mt-1 text-white">{getActorName(selectedLog)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Module</div>
              <div className="mt-1 text-white">{selectedLog.module}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Action</div>
              <div className="mt-1 text-white">{selectedLog.action}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Result</div>
              <div className="mt-1 text-white">
                {selectedLog.module === 'auth'
                  ? String(selectedLog.action).includes('failed')
                    ? 'Failed login attempt'
                    : 'Successful login'
                  : 'Administrative event'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Target Type</div>
              <div className="mt-1 text-white">{selectedLog.targetType || 'â€”'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Target ID</div>
              <div className="mt-1 font-mono text-xs text-slate-300">{selectedLog.targetId || 'â€”'}</div>
            </div>
            {selectedLog.metadata && (
              <div className="sm:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Metadata</div>
                <pre className="mt-2 max-h-44 overflow-auto rounded bg-white/5 p-3 text-xs text-slate-300">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </section>
      )}

      {maxPage > 1 && (
        <section className="flex items-center justify-between rounded-lg border border-white/8 bg-white/5 p-4">
          <div className="text-sm text-slate-400">
            Showing {logs.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="rounded-lg border border-white/8 px-3 py-2 hover:bg-white/5 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === maxPage}
              className="rounded-lg border border-white/8 px-3 py-2 hover:bg-white/5 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

