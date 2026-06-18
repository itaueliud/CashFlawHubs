'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { CheckCircle, XCircle, ChevronDown, Search } from 'lucide-react';
import { ErrorBanner, LoadingSpinner, PageHeader } from '../../../components/ui';

interface ModerationItem {
  _id: string;
  entityType: string;
  entityId?: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
  content?: string;
  userId?: string;
  userName?: string;
  isActive?: boolean;
}

const entityLabels: Record<string, string> = {
  task: 'Task',
  job: 'Job',
  challenge: 'Challenge',
  gig: 'Gig',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: 'bg-green-500/20 text-green-300',
    rejected: 'bg-red-600/20 text-red-400',
    active: 'bg-green-500/20 text-green-300',
    inactive: 'bg-red-600/20 text-red-400',
  };

  return (
    <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${colors[status] || 'bg-slate-500/20 text-slate-300'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ModerationItemRow({ item, onRefresh }: { item: ModerationItem; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const moderate = async (action: 'approved' | 'rejected') => {
    if (action === 'rejected' && !rejectReason.trim()) {
      setShowRejectForm(true);
      return;
    }

    setSaving(true);
    try {
      await api.put(`/admin-advanced/moderation/${item.entityType}/${item._id}`, {
        action,
        reason: action === 'rejected' ? rejectReason.trim() : '',
      });
      setRejectReason('');
      setShowRejectForm(false);
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || `Failed to ${action === 'approved' ? 'approve' : 'reject'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <tr className="border-b border-white/5 hover:bg-white/[0.03]">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded((value) => !value)} className="rounded p-1 hover:bg-white/10">
            <ChevronDown className={`h-4 w-4 transform transition ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </td>
        <td className="px-4 py-3 font-semibold text-white">{item.title || 'Untitled'}</td>
        <td className="px-4 py-3">
          <span className="inline-block rounded bg-blue-500/20 px-2 py-1 text-xs font-semibold text-blue-300">
            {entityLabels[item.entityType] || item.entityType}
          </span>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={item.status || (item.isActive ? 'approved' : 'rejected')} />
        </td>
        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(item.createdAt).toLocaleString()}</td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={() => moderate('approved')}
              disabled={saving}
              className="rounded p-1 text-green-300 hover:bg-green-500/20 disabled:opacity-50"
              title="Approve"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowRejectForm((value) => !value)}
              disabled={saving}
              className="rounded p-1 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
              title="Reject"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-white/5 bg-white/5">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-3">
              {item.description && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Description</div>
                  <div className="mt-1 text-slate-300">{item.description}</div>
                </div>
              )}
              {item.content && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Content</div>
                  <div className="mt-1 max-h-32 overflow-auto rounded bg-white/5 p-2 text-sm text-slate-300">{item.content}</div>
                </div>
              )}
              {showRejectForm && (
                <div className="space-y-2 rounded border border-red-500/20 bg-red-500/10 p-3">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => moderate('rejected')}
                      disabled={saving}
                      className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="rounded px-3 py-1 text-sm text-slate-300 hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const loadItems = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterType !== 'all') params.type = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (search.trim()) params.search = search.trim();
      const response = await api.get('/admin-advanced/moderation/items', { params });
      setItems(response.data?.items || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [filterType, filterStatus]);

  return (
    <div className="space-y-6">
      <PageHeader title="Moderation Queue" description="Review content items and approve or reject them." />

      {error && <ErrorBanner message={error} />}

      <section className="card-surface soft-up grid gap-3 rounded-[24px] p-5 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/5 px-4 py-3 sm:col-span-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={loadItems}
            placeholder="Search moderation items..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white outline-none"
        >
          <option value="all">All Types</option>
          {['task', 'job', 'challenge', 'gig'].map((type) => (
            <option key={type} value={type}>
              {entityLabels[type] || type}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={loadItems} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          Refresh
        </button>
      </section>

      <section className="card-surface soft-up overflow-hidden rounded-[24px]">
        {loading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No items to moderate.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/8 bg-white/5">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <ModerationItemRow key={item._id} item={item} onRefresh={loadItems} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-surface soft-up grid gap-4 rounded-[24px] p-5 sm:grid-cols-3">
        <div className="rounded-lg border border-white/8 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Total Items</div>
          <div className="mt-2 text-2xl font-black text-white">{items.length}</div>
        </div>
        <div className="rounded-lg border border-white/8 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Approved</div>
          <div className="mt-2 text-2xl font-black text-green-300">{items.filter((item) => (item.status || (item.isActive ? 'approved' : 'rejected')) === 'approved').length}</div>
        </div>
        <div className="rounded-lg border border-white/8 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Rejected</div>
          <div className="mt-2 text-2xl font-black text-red-300">{items.filter((item) => (item.status || (item.isActive ? 'approved' : 'rejected')) === 'rejected').length}</div>
        </div>
      </section>
    </div>
  );
}
