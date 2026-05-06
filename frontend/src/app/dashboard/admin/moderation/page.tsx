'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['moderation-items', type, status, search],
    queryFn: () => api.get(`/admin-advanced/moderation/items?type=${type}&status=${status}&search=${encodeURIComponent(search)}`).then((r) => r.data),
  });

  const actionMutation = useMutation({
    mutationFn: ({ entityType, id, action }: { entityType: string; id: string; action: string }) =>
      api.put(`/admin-advanced/moderation/${entityType}/${id}`, { action }),
    onSuccess: () => {
      toast.success('Moderation updated');
      queryClient.invalidateQueries({ queryKey: ['moderation-items'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Action failed'),
  });

  const items = data?.items || [];

  return (
    <div className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-white">Content Moderation</h1>
        <p className="mt-1 text-sm text-slate-400">Approve/reject tasks, jobs, challenges and gigs.</p>
      </div>

      <div className="card grid gap-3 md:grid-cols-4">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option><option value="task">Task</option><option value="job">Job</option><option value="challenge">Challenge</option><option value="gig">Gig</option>
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All status</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title/description" />
        <div className="text-sm text-slate-400 self-center">Items: {items.length}</div>
      </div>

      {isLoading ? <div className="card text-sm text-slate-400">Loading moderation items...</div> : (
        <div className="grid gap-3">
          {items.map((item: any) => (
            <div key={`${item.entityType}-${item._id}`} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.entityType} | {item.status}</div>
                  <div className="mt-2 text-sm text-slate-300 line-clamp-2">{item.description}</div>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ entityType: item.entityType, id: item._id, action: 'approved' })}>Approve</button>
                  <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ entityType: item.entityType, id: item._id, action: 'rejected' })}>Reject</button>
                  <button className="rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-semibold text-white" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ entityType: item.entityType, id: item._id, action: 'flagged' })}>Flag</button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="card text-sm text-slate-400">No content found.</div>}
        </div>
      )}
    </div>
  );
}
