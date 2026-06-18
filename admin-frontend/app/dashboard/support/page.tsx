'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ChevronDown, MessageSquare, User, Clock, Search, UserPlus, RotateCcw } from 'lucide-react';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';

interface Ticket {
  _id: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  requesterId?: { name?: string; email?: string; phone?: string; _id?: string } | string;
  assignedTo?: { name?: string; email?: string; role?: string; _id?: string } | null;
  createdAt: string;
  updatedAt?: string;
  notes?: Array<{ body: string; by?: { name?: string; email?: string } | string; role?: string; at?: string }>;
}

interface StaffOption {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    urgent: 'border-red-400/20 bg-red-500/20 text-red-300',
    high: 'border-orange-400/20 bg-orange-500/20 text-orange-300',
    normal: 'border-amber-400/20 bg-amber-500/20 text-amber-200',
    low: 'border-blue-400/20 bg-blue-500/20 text-blue-200',
  };
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${colors[priority] || 'border-slate-500/20 bg-slate-500/20 text-slate-200'}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'border-blue-400/20 bg-blue-500/20 text-blue-300',
    in_progress: 'border-amber-400/20 bg-amber-500/20 text-amber-300',
    resolved: 'border-emerald-400/20 bg-emerald-500/20 text-emerald-300',
    closed: 'border-slate-500/20 bg-slate-500/20 text-slate-300',
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${colors[status] || 'border-slate-500/20 bg-slate-500/20 text-slate-200'}`}>{label}</span>;
}

function TicketRow({ ticket, onRefresh }: { ticket: Ticket; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [assignmentQuery, setAssignmentQuery] = useState('');
  const [assignmentResults, setAssignmentResults] = useState<StaffOption[]>([]);
  const [findingAssignee, setFindingAssignee] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const getRequesterName = () => {
    if (typeof ticket.requesterId === 'string') return ticket.requesterId;
    if (!ticket.requesterId) return 'Unknown';
    return ticket.requesterId.name || ticket.requesterId.email || 'Unknown';
  };

  const getAssignedName = () => {
    if (!ticket.assignedTo) return 'Unassigned';
    return ticket.assignedTo.name || ticket.assignedTo.email || ticket.assignedTo.role || 'Assigned';
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await api.put(`/admin-advanced/support/tickets/${ticket._id}`, { status: newStatus });
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update ticket');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await api.put(`/admin-advanced/support/tickets/${ticket._id}`, { note: newNote.trim() });
      setNewNote('');
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleSearchAssignee = async () => {
    if (!assignmentQuery.trim()) return;
    setFindingAssignee(true);
    try {
      const res = await api.get('/admin/users', { params: { search: assignmentQuery.trim(), page: 1, limit: 10 } });
      const users = (res.data?.users || []) as StaffOption[];
      setAssignmentResults(users.filter((user) => user.role && user.role !== 'user'));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to search staff');
    } finally {
      setFindingAssignee(false);
    }
  };

  const handleAssign = async (userId: string) => {
    setAssigning(true);
    try {
      await api.put(`/admin-advanced/support/tickets/${ticket._id}`, { assignedTo: userId, status: ticket.status === 'open' ? 'in_progress' : ticket.status });
      setAssignmentResults([]);
      setAssignmentQuery('');
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to assign ticket');
    } finally {
      setAssigning(false);
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
        <td className="px-4 py-3">
          <div className="font-semibold text-white">{ticket.subject}</div>
          <div className="mt-1 text-xs text-slate-500">{ticket.description?.slice(0, 80) || 'No description available'}</div>
        </td>
        <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
        <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
        <td className="px-4 py-3 text-sm text-slate-400">
          <div>{getRequesterName()}</div>
          <div className="mt-1 text-xs text-slate-500">Assigned: {getAssignedName()}</div>
        </td>
        <td className="px-4 py-3 text-xs text-slate-400">{new Date(ticket.createdAt).toLocaleDateString()}</td>
      </tr>

      {expanded && (
        <tr className="border-b border-white/5 bg-white/5">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-4">
              {ticket.description && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Description</div>
                  <div className="mt-2 whitespace-pre-wrap text-slate-300">{ticket.description}</div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <User className="h-3 w-3" /> Requester
                  </div>
                  <div className="mt-1 text-white">{getRequesterName()}</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <Clock className="h-3 w-3" /> Created
                  </div>
                  <div className="mt-1 text-sm text-white">{new Date(ticket.createdAt).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Change Status</div>
                <div className="flex flex-wrap gap-2">
                  {['open', 'in_progress', 'resolved', 'closed'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={updatingStatus || ticket.status === status}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                        ticket.status === status
                          ? 'border-white/10 bg-white/10 text-slate-300'
                          : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      } disabled:opacity-50`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <UserPlus className="h-3 w-3" /> Assign ticket
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <input
                    value={assignmentQuery}
                    onChange={(e) => setAssignmentQuery(e.target.value)}
                    placeholder="Search admin or staff member"
                    className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    onClick={handleSearchAssignee}
                    disabled={findingAssignee}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Search
                  </button>
                </div>
                {assignmentResults.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {assignmentResults.map((user) => (
                      <button
                        key={user._id}
                        onClick={() => handleAssign(user._id)}
                        disabled={assigning}
                        className="flex items-center justify-between rounded-xl border border-white/8 bg-slate-950/70 px-4 py-3 text-left text-sm text-white hover:border-cyan-400/30 hover:bg-cyan-500/10 disabled:opacity-50"
                      >
                        <span>
                          <span className="font-semibold">{user.name || user.email || user._id}</span>
                          <span className="ml-2 text-xs text-slate-500">{user.role || 'staff'}</span>
                        </span>
                        <span className="text-xs text-slate-500">Assign</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {ticket.notes?.length ? (
                <div className="rounded border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <MessageSquare className="h-3 w-3" /> Notes
                  </div>
                  <div className="space-y-3">
                    {ticket.notes.map((note, index) => (
                      <div key={`${note.at || index}`} className="rounded-lg border border-white/8 bg-black/20 p-3 text-sm text-slate-300">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-white">
                            {typeof note.by === 'string' ? note.by : note.by?.name || note.by?.email || 'Staff'}
                          </div>
                          <div className="text-xs text-slate-500">{note.at ? new Date(note.at).toLocaleString() : ''}</div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap">{note.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 rounded border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Add Note</div>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add internal note..."
                  className="w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none"
                  rows={3}
                />
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  className="rounded bg-cyan-600 px-3 py-1 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {addingNote ? 'Adding...' : 'Add Note'}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterPriority, setFilterPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');

  const loadTickets = async (overrides?: { status?: string; priority?: string; search?: string }) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      const status = overrides?.status ?? filterStatus;
      const priority = overrides?.priority ?? filterPriority;
      const nextSearch = overrides?.search ?? search;
      if (status !== 'all') params.status = status;
      if (priority !== 'all') params.priority = priority;
      if (nextSearch.trim()) params.search = nextSearch.trim();
      const response = await api.get('/admin-advanced/support/tickets', { params });
      setTickets(response.data?.tickets || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterPriority]);

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    progress: tickets.filter((ticket) => ticket.status === 'in_progress').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved').length,
  }), [tickets]);

  return (
    <div className="space-y-6">
      <PageHeader title="Support Tickets" description="Manage user support requests, triage, assignment, and internal notes." />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={String(stats.total)} sub="Loaded tickets" />
        <StatCard label="Open" value={String(stats.open)} sub="Awaiting triage" />
        <StatCard label="In Progress" value={String(stats.progress)} sub="Assigned or being handled" />
        <StatCard label="Resolved" value={String(stats.resolved)} sub="Closed loop items" />
      </section>

      <section className="card-surface soft-up grid gap-3 rounded-[24px] p-5 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/5 px-4 py-3 sm:col-span-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchDraft);
                loadTickets({ search: searchDraft });
              }
            }}
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white outline-none"
        >
          <option value="all">All Statuses</option>
          {['open', 'in_progress', 'resolved', 'closed'].map((status) => (
            <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white outline-none"
        >
          <option value="all">All Priorities</option>
          {['urgent', 'high', 'normal', 'low'].map((priority) => (
            <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
          ))}
        </select>
        <button
          onClick={() => {
            setSearch(searchDraft);
            loadTickets({ search: searchDraft });
          }}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Refresh
        </button>
      </section>

      <section className="card-surface soft-up overflow-hidden rounded-[24px]">
        {loading ? (
          <LoadingSpinner />
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No support tickets found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/8 bg-white/5">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <TicketRow key={ticket._id} ticket={ticket} onRefresh={() => loadTickets()} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <RotateCcw className="h-4 w-4 text-cyan-300" />
          Flow guidance
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">Open first, then assign to a staff member for in-progress handling.</div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">Use notes for internal context so the requester never sees private triage details.</div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">Resolved tickets should stay searchable for follow-up and SLA tracking.</div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">Search by subject or description to find duplicates before opening a new case.</div>
        </div>
      </section>
    </div>
  );
}
