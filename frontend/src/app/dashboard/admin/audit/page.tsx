'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function AuditPage() {
  const [moduleFilter, setModuleFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', moduleFilter],
    queryFn: () => api.get(`/admin-advanced/audit/logs?module=${moduleFilter}&limit=200`).then((r) => r.data),
  });

  const logs = data?.logs || [];

  return (
    <div className="space-y-5">
      <div className="card dashboard-toolbar">
        <div><h1 className="text-2xl font-bold text-white">Audit Center</h1><p className="mt-1 text-sm text-slate-400">Immutable staff activity trail across modules.</p></div>
        <select className="input w-full max-w-[220px]" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          <option value="all">All modules</option><option value="moderation">Moderation</option><option value="support">Support</option><option value="config">Config</option><option value="reconciliation">Reconciliation</option>
        </select>
      </div>

      {isLoading ? <div className="card text-sm text-slate-400">Loading audit logs...</div> : (
        <div className="card table-shell">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-slate-700 text-left text-slate-400"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Module</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Target</th></tr></thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log._id} className="border-b border-slate-800">
                  <td className="px-3 py-2 text-slate-300">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-300">{log.actorId?.name || log.actorId?.email || '-'}</td>
                  <td className="px-3 py-2 text-slate-300">{log.actorRole}</td>
                  <td className="px-3 py-2 text-slate-300">{log.module}</td>
                  <td className="px-3 py-2 text-slate-300">{log.action}</td>
                  <td className="px-3 py-2 text-slate-300">{log.targetType || '-'} {log.targetId || ''}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No logs available.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

