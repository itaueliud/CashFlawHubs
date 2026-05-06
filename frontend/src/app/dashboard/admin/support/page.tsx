'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets', status, priority, search],
    queryFn: () => api.get(`/admin-advanced/support/tickets?status=${status}&priority=${priority}&search=${encodeURIComponent(search)}`).then((r) => r.data),
  });

  const tickets = data?.tickets || [];
  const selected = tickets.find((t: any) => t._id === selectedId) || null;

  const updateTicket = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/admin-advanced/support/tickets/${id}`, payload),
    onSuccess: () => {
      toast.success('Ticket updated');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Failed to update ticket'),
  });

  return (
    <div className="space-y-5">
      <div className="card"><h1 className="text-2xl font-bold text-white">Support Tickets</h1><p className="mt-1 text-sm text-slate-400">Triage, assign, and resolve user support issues.</p></div>

      <div className="card grid gap-3 md:grid-cols-4">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All status</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
        <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">All priority</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject/description" />
        <div className="text-sm text-slate-400 self-center">Tickets: {tickets.length}</div>
      </div>

      {isLoading ? <div className="card text-sm text-slate-400">Loading tickets...</div> : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card space-y-3">
            {tickets.map((ticket: any) => (
              <button key={ticket._id} onClick={() => setSelectedId(ticket._id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === ticket._id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-950/60'}`}>
                <div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-white">{ticket.subject}</div><div className="text-xs text-slate-400">{ticket.status}</div></div>
                <div className="mt-1 text-xs text-slate-500">{ticket.requesterId?.name || 'Unknown'} | {ticket.priority}</div>
              </button>
            ))}
            {tickets.length === 0 && <div className="text-sm text-slate-400">No tickets found.</div>}
          </div>

          <div className="card">
            {!selected ? <div className="text-sm text-slate-400">Select a ticket.</div> : (
              <div className="space-y-3">
                <div className="text-lg font-semibold text-white">{selected.subject}</div>
                <div className="text-sm text-slate-300">{selected.description}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select className="input" defaultValue={selected.status} onChange={(e) => updateTicket.mutate({ id: selected._id, payload: { status: e.target.value } })}>
                    <option value="open">open</option><option value="in_progress">in_progress</option><option value="resolved">resolved</option><option value="closed">closed</option>
                  </select>
                  <select className="input" defaultValue={selected.priority} onChange={(e) => updateTicket.mutate({ id: selected._id, payload: { priority: e.target.value } })}>
                    <option value="low">low</option><option value="normal">normal</option><option value="high">high</option><option value="urgent">urgent</option>
                  </select>
                </div>
                <textarea className="input min-h-24" placeholder="Add note" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn-primary" onClick={() => updateTicket.mutate({ id: selected._id, payload: { note } })} disabled={updateTicket.isPending || !note.trim()}>Add note</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
