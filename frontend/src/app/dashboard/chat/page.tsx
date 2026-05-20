'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type Attachment = { name: string; mimeType: string; size: number; url: string };

export default function ChatPage() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuthStore();
  const isAdmin = ['admin', 'superadmin'].includes(String(user?.role || ''));

  const [activeSessionId, setActiveSessionId] = useState('');
  const [message, setMessage] = useState('');
  const [includeAi, setIncludeAi] = useState(true);
  const [search, setSearch] = useState('');
  const [offerTerms, setOfferTerms] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const jobId = params?.get('jobId') || '';
  const applicantId = params?.get('applicantId') || '';

  const sessionsQuery = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => (await api.get('/chat/sessions')).data.sessions || [],
    refetchInterval: 5000,
  });

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessionsQuery.data || [];
    return (sessionsQuery.data || []).filter((s: any) => {
      const text = `${s?.title || ''} ${s?.jobId?.title || ''} ${s?.posterId?.name || ''} ${s?.applicantId?.name || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [search, sessionsQuery.data]);

  const activeSession = useMemo(
    () => (sessionsQuery.data || []).find((s: any) => s._id === activeSessionId),
    [sessionsQuery.data, activeSessionId]
  );

  useEffect(() => {
    if (!activeSessionId && sessionsQuery.data?.length) setActiveSessionId(sessionsQuery.data[0]._id);
  }, [activeSessionId, sessionsQuery.data]);

  const historyQuery = useQuery({
    queryKey: ['chat-history', activeSessionId],
    enabled: Boolean(activeSessionId),
    queryFn: async () => (await api.get(`/chat/sessions/${activeSessionId}/history`)).data.messages || [],
    refetchInterval: 2500,
  });

  const initiateMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error('Missing job id');
      const body = applicantId ? { applicantId } : {};
      return (await api.post(`/chat/jobs/${jobId}/initiate`, body)).data.session;
    },
    onSuccess: (session) => {
      setActiveSessionId(session._id);
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      toast.success('Chat ready');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to initiate chat'),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId || !message.trim()) throw new Error('Type a message');
      return api.post(`/chat/sessions/${activeSessionId}/messages`, {
        content: message.trim(),
        includeAi,
        attachments,
      });
    },
    onSuccess: () => {
      setMessage('');
      setAttachments([]);
      queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to send message'),
  });

  const setStatusMutation = useMutation({
    mutationFn: async (status: 'open' | 'in_progress' | 'closed') => api.patch(`/chat/sessions/${activeSessionId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }),
  });

  const flagMutation = useMutation({
    mutationFn: async ({ messageId, reason }: { messageId: string; reason: string }) =>
      api.patch(`/chat/sessions/${activeSessionId}/messages/${messageId}/flag`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      toast.success('Message flagged for review');
    },
  });

  const offerMutation = useMutation({
    mutationFn: async () => api.post(`/chat/sessions/${activeSessionId}/offers`, { terms: offerTerms, amount: offerAmount, currency: 'USD' }),
    onSuccess: () => {
      setOfferTerms('');
      setOfferAmount('');
      queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });

  const respondOfferMutation = useMutation({
    mutationFn: async ({ messageId, action }: { messageId: string; action: 'accept' | 'counter' | 'reject' }) =>
      api.patch(`/chat/sessions/${activeSessionId}/offers/${messageId}/respond`, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] }),
  });

  const moderateMutation = useMutation({
    mutationFn: async (action: string) => api.patch(`/chat/sessions/${activeSessionId}/moderate`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return (await api.post(`/chat/sessions/${activeSessionId}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.attachment as Attachment;
    },
    onSuccess: (attachment) => {
      setAttachments((prev) => [...prev, attachment]);
      toast.success('Attachment added');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to upload attachment'),
  });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('earnhub-auth') || '{}')?.state?.token : null;
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || window.location.origin;
    const socket: Socket = io(base, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => activeSessionId && socket.emit('chat:join', { sessionId: activeSessionId }));
    socket.on('chat:message', (payload) => {
      if (payload?.sessionId === activeSessionId) queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    });
    socket.on('chat:session-updated', () => queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }));

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [activeSessionId, queryClient]);

  const moderationClass = (status: string) =>
    status === 'flagged' ? 'text-orange-300 bg-orange-500/10 border-orange-500/30'
      : status === 'under_review' ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
      : status === 'resolved' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
      : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="card">
        <div className="mb-3">
          <div className="text-xs uppercase tracking-wider text-slate-400">Messages</div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input mt-2" placeholder="Search chats..." />
        </div>
        {jobId && (
          <button className="btn-primary mb-3 w-full text-sm" onClick={() => initiateMutation.mutate()} disabled={initiateMutation.isPending}>
            {initiateMutation.isPending ? 'Opening...' : 'Open Job Chat'}
          </button>
        )}
        <div className="space-y-2">
          {filteredSessions.map((session: any) => (
            <button
              key={session._id}
              className={`w-full rounded-xl border p-3 text-left ${session._id === activeSessionId ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/60'}`}
              onClick={() => setActiveSessionId(session._id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm truncate">{session.applicantId?.name || session.posterId?.name || 'Chat'}</div>
                {!!session.unreadCount && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs">{session.unreadCount}</span>}
              </div>
              <div className="mt-1 text-xs text-slate-400 truncate">{session.jobId?.title || session.title}</div>
              <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase ${moderationClass(session.moderationStatus || 'active')}`}>
                {session.moderationStatus || 'active'}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="card flex min-h-[72vh] flex-col">
        <header className="mb-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{activeSession?.applicantId?.name || activeSession?.posterId?.name || 'Select a chat'}</h2>
              <div className="text-sm text-slate-400">
                {activeSession?.jobId?.title || ''} {activeSession?.jobId?.company ? `- ${activeSession.jobId.company}` : ''}
              </div>
              <div className="mt-1 text-xs text-slate-500">Job status: {activeSession?.status || 'open'}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary text-xs" onClick={() => setStatusMutation.mutate('open')} disabled={!activeSessionId}>Open</button>
              <button className="btn-secondary text-xs" onClick={() => setStatusMutation.mutate('in_progress')} disabled={!activeSessionId}>In Progress</button>
              <button className="btn-secondary text-xs" onClick={() => setStatusMutation.mutate('closed')} disabled={!activeSessionId}>Closed</button>
              {isAdmin && <button className="btn-secondary text-xs" onClick={() => moderateMutation.mutate('join')} disabled={!activeSessionId}>Join as mediator</button>}
              {isAdmin && <button className="btn-secondary text-xs" onClick={() => moderateMutation.mutate('freeze')} disabled={!activeSessionId}>Freeze</button>}
              <label className="inline-flex items-center gap-1 text-xs text-slate-300"><input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} />AI assist</label>
            </div>
          </div>
          {activeSession?.moderationStatus === 'flagged' || activeSession?.moderationStatus === 'under_review' ? (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              This chat has an active fraud report. Admin review in progress. All messages may be monitored.
            </div>
          ) : null}
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {(historyQuery.data || []).map((msg: any) => {
            const own = String(msg?.senderId?._id || msg?.senderId || '') === String(user?.id || user?._id || '');
            const bubbleClass = msg.messageType === 'admin_notice'
              ? 'mx-auto max-w-2xl border-blue-500/40 bg-blue-500/10 text-blue-100'
              : msg.isFlagged
                ? 'border-orange-500/40 bg-orange-500/10'
                : own
                  ? 'ml-auto border-emerald-500/30 bg-emerald-500/15'
                  : 'mr-auto border-slate-700 bg-slate-900';
            return (
              <div key={msg._id} className={`max-w-2xl rounded-xl border px-3 py-2 ${bubbleClass}`}>
                <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                  <span>{msg.messageType === 'admin_notice' ? 'Admin mediator' : msg.senderId?.name || msg.role}</span>
                  <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                {msg.messageType === 'offer' && (
                  <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-xs">
                    <div>Amount: {msg.metadata?.offer?.amount || '-'} {msg.metadata?.offer?.currency || ''}</div>
                    <div>Status: {msg.metadata?.offer?.state || 'pending'}</div>
                    <div className="mt-2 flex gap-2">
                      <button className="btn-secondary text-xs" onClick={() => respondOfferMutation.mutate({ messageId: msg._id, action: 'accept' })}>Accept</button>
                      <button className="btn-secondary text-xs" onClick={() => respondOfferMutation.mutate({ messageId: msg._id, action: 'counter' })}>Counter</button>
                    </div>
                  </div>
                )}
                {!!msg.attachments?.length && (
                  <div className="mt-2 space-y-1 text-xs">
                    {msg.attachments.map((a: Attachment, idx: number) => (
                      <a key={`${a.url}-${idx}`} href={`${process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || ''}${a.url}`} target="_blank" rel="noreferrer" className="block text-emerald-300 underline">
                        {a.name}
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{msg.readBy?.length > 1 ? 'Read' : 'Sent'}</span>
                  <button className="text-orange-300" onClick={() => flagMutation.mutate({ messageId: msg._id, reason: 'Suspicious request' })}>Flag suspicious</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 border-t border-slate-800 pt-3">
          {!!attachments.length && (
            <div className="mb-2 flex flex-wrap gap-2 text-xs">
              {attachments.map((a, idx) => <span key={`${a.url}-${idx}`} className="rounded bg-slate-800 px-2 py-1">{a.name}</span>)}
            </div>
          )}
          <textarea className="input min-h-[80px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className="btn-secondary text-sm" onClick={() => fileInputRef.current?.click()} disabled={!activeSessionId || uploadMutation.isPending}>Attach</button>
            <button className="btn-secondary text-sm" onClick={() => offerMutation.mutate()} disabled={!activeSessionId || !offerTerms.trim()}>Send offer</button>
            <input className="input max-w-[220px] text-xs" placeholder="Offer terms" value={offerTerms} onChange={(e) => setOfferTerms(e.target.value)} />
            <input className="input max-w-[120px] text-xs" placeholder="Amount" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} />
            <button className="btn-primary ml-auto" onClick={() => sendMutation.mutate()} disabled={!activeSessionId || !message.trim() || sendMutation.isPending}>
              {sendMutation.isPending ? 'Sending...' : 'Send'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && activeSessionId) uploadMutation.mutate(file);
              if (e.target) e.target.value = '';
            }}
          />
        </div>
      </section>
    </div>
  );
}
