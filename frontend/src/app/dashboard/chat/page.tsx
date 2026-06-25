'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { Bot, Briefcase, Check, CheckCheck, ChevronDown, Flag, Loader2, Lock, MoreVertical, Paperclip, Send, ShieldAlert, Video, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type Attachment = { name: string; mimeType: string; size: number; url: string };
type Session = {
  _id: string;
  sessionType?: 'job' | 'creator_hub';
  title: string;
  status: string;
  moderationStatus: string;
  isFrozen: boolean;
  aiEnabled: boolean;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  jobId?: { _id: string; title: string; company?: string };
  uploadId?: { _id: string; title: string };
  posterId?: { _id: string; name: string };
  applicantId?: { _id: string; name: string };
};
type Message = {
  _id: string;
  sessionId: string;
  jobId?: string | null;
  senderId?: { _id: string; name: string } | string;
  role: string;
  messageType: 'text' | 'offer' | 'admin_notice';
  content: string;
  attachments?: Attachment[];
  isFlagged?: boolean;
  readBy?: { userId: string }[];
  metadata?: { offer?: { amount?: string; currency?: string; terms?: string; state?: string } };
  createdAt: string;
};

const avatarColor = (name: string) => ['bg-violet-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600', 'bg-pink-600'][Math.abs(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 7];
const initials = (name: string) => name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
const relativeTime = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? new Date(iso).toLocaleDateString('en', { weekday: 'short' }) : new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short' });
};
const messageTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const isDifferentDay = (a: string, b: string) => new Date(a).toDateString() !== new Date(b).toDateString();
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });
const senderIdString = (sender?: Message['senderId']) => (typeof sender === 'string' ? sender : sender?._id) || '';
const senderName = (msg: Message) => (msg.messageType === 'admin_notice' ? 'Admin' : (typeof msg.senderId === 'object' ? msg.senderId?.name : '') || msg.role || 'User');

export default function ChatPage() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuthStore();
  const isAdmin = ['admin', 'superadmin'].includes(String(user?.role || ''));
  const currentUserId = String(user?.id || user?.userId || '');

  const [activeSessionId, setActiveSessionId] = useState('');
  const [message, setMessage] = useState('');
  const [includeAi, setIncludeAi] = useState(true);
  const [search, setSearch] = useState('');
  const [showOfferPanel, setShowOfferPanel] = useState(false);
  const [offerTerms, setOfferTerms] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  const jobId = params?.get('jobId') || '';
  const applicantId = params?.get('applicantId') || '';
  const sessionIdParam = params?.get('sessionId') || '';
  const canInitiateJobChat = Boolean(jobId && applicantId);

  const sessionsQuery = useQuery<Session[]>({ queryKey: ['chat-sessions'], queryFn: async () => (await api.get('/chat/sessions')).data.sessions || [], refetchInterval: 5000 });
  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sessionsQuery.data || []).filter((s) => !q || `${s.title} ${s.jobId?.title || ''} ${s.uploadId?.title || ''} ${s.posterId?.name || ''} ${s.applicantId?.name || ''}`.toLowerCase().includes(q));
  }, [search, sessionsQuery.data]);
  const activeSession = useMemo(() => (sessionsQuery.data || []).find((s) => s._id === activeSessionId) || null, [sessionsQuery.data, activeSessionId]);
  const isJobSession = !activeSession?.sessionType || activeSession.sessionType === 'job';
  const isCreatorSession = activeSession?.sessionType === 'creator_hub';
  const isFrozen = Boolean(activeSession?.isFrozen);
  const currentUserIsPoster = String(activeSession?.posterId?._id || '') === currentUserId;
  const canManageSession = Boolean(isAdmin || currentUserIsPoster);

  const historyQuery = useQuery<Message[]>({ queryKey: ['chat-history', activeSessionId], enabled: Boolean(activeSessionId), queryFn: async () => (await api.get(`/chat/sessions/${activeSessionId}/history`)).data.messages || [], refetchInterval: 2500 });

  useEffect(() => { if (sessionIdParam) return setActiveSessionId(sessionIdParam); if (!activeSessionId && sessionsQuery.data?.length) setActiveSessionId(sessionsQuery.data[0]._id); }, [sessionIdParam, activeSessionId, sessionsQuery.data]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [historyQuery.data]);
  useEffect(() => {
    const token = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('earnhub-auth') || '{}')?.state?.token : null;
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || window.location.origin;
    const socket: Socket = io(base, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => activeSessionId && socket.emit('chat:join', { sessionId: activeSessionId }));
    socket.on('chat:message', (payload) => { if (payload?.sessionId === activeSessionId) queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] }); queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }); });
    socket.on('chat:session-updated', () => queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }));
    return () => { socketRef.current = null; socket.disconnect(); };
  }, [activeSessionId, queryClient]);
  useEffect(() => { if (socketRef.current && activeSessionId) socketRef.current.emit('chat:join', { sessionId: activeSessionId }); }, [activeSessionId]);
  useEffect(() => { if (isCreatorSession) setShowOfferPanel(false); }, [isCreatorSession]);

  const initiateMutation = useMutation({
    mutationFn: async () => { if (!jobId) throw new Error('Missing job id'); return (await api.post(`/chat/jobs/${jobId}/initiate`, applicantId ? { applicantId } : {})).data.session; },
    onSuccess: (session) => { setActiveSessionId(session._id); queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }); toast.success('Chat ready'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to initiate chat'),
  });
  const sendMutation = useMutation({
    mutationFn: async () => { if (!activeSessionId || !message.trim()) throw new Error('Type a message'); return api.post(`/chat/sessions/${activeSessionId}/messages`, { content: message.trim(), includeAi: isJobSession && includeAi, attachments }); },
    onSuccess: () => { setMessage(''); setAttachments([]); queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] }); queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to send message'),
  });
  const setStatusMutation = useMutation({ mutationFn: async (status: 'open' | 'in_progress' | 'closed') => api.patch(`/chat/sessions/${activeSessionId}/status`, { status }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }) });
  const flagMutation = useMutation({ mutationFn: async ({ messageId, reason }: { messageId: string; reason: string }) => api.patch(`/chat/sessions/${activeSessionId}/messages/${messageId}/flag`, { reason }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] }); queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }); toast.success('Message flagged for review'); } });
  const offerMutation = useMutation({ mutationFn: async () => api.post(`/chat/sessions/${activeSessionId}/offers`, { terms: offerTerms, amount: offerAmount, currency: 'USD' }), onSuccess: () => { setOfferTerms(''); setOfferAmount(''); setShowOfferPanel(false); queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] }); queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }); } });
  const respondOfferMutation = useMutation({ mutationFn: async ({ messageId, action }: { messageId: string; action: 'accept' | 'counter' | 'reject' }) => api.patch(`/chat/sessions/${activeSessionId}/offers/${messageId}/respond`, { action }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] }) });
  const moderateMutation = useMutation({ mutationFn: async (action: string) => api.patch(`/chat/sessions/${activeSessionId}/moderate`, { action }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] }); queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }); setShowHeaderMenu(false); } });
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => { const form = new FormData(); form.append('file', file); return (await api.post(`/chat/sessions/${activeSessionId}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.attachment as Attachment; },
    onSuccess: (attachment) => { setAttachments((prev) => [...prev, attachment]); toast.success('Attachment added'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to upload attachment'),
  });

  const handleKeyDown = (e: any) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (message.trim() && !sendMutation.isPending) sendMutation.mutate(); } };
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || '';
  const getOtherName = (session: Session) => String(session.posterId?._id || '') === currentUserId ? session.applicantId?.name || 'User' : session.posterId?.name || session.applicantId?.name || 'User';
  const renderMessage = (msg: Message, idx: number) => {
    const messages = historyQuery.data || [];
    const prev = messages[idx - 1];
    const own = senderIdString(msg.senderId) === currentUserId;
    const sameSender = prev && senderIdString(prev.senderId) === senderIdString(msg.senderId);
    const showDayDivider = !prev || isDifferentDay(prev.createdAt, msg.createdAt);
    const firstInGroup = !sameSender;
    const bubbleWidth = msg.content.length < 60 ? 'max-w-fit' : 'max-w-[72%]';
    const name = senderName(msg);
    if (msg.messageType === 'admin_notice') return <div key={msg._id}>{showDayDivider && <div className="my-4 flex items-center gap-3"><div className="flex-1 border-t border-slate-800" /><span className="text-[10px] text-slate-600">{dayLabel(msg.createdAt)}</span><div className="flex-1 border-t border-slate-800" /></div>}<div className="mx-auto my-2 max-w-sm rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-center text-xs text-blue-300"><span className="font-semibold">Admin: </span>{msg.content}</div></div>;
    if (msg.messageType === 'offer') {
      const state = msg.metadata?.offer?.state || 'pending';
      const color = state === 'accept' ? 'border-emerald-500/40 bg-emerald-500/10' : state === 'reject' ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/40 bg-amber-500/10';
      return <div key={msg._id}>{showDayDivider && <div className="my-4 flex items-center gap-3"><div className="flex-1 border-t border-slate-800" /><span className="text-[10px] text-slate-600">{dayLabel(msg.createdAt)}</span><div className="flex-1 border-t border-slate-800" /></div>}<div className={`my-3 ${own ? 'ml-auto' : 'mr-auto'} w-full ${bubbleWidth} rounded-2xl border p-4 ${color}`}><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-400"><Briefcase size={12} /> Offer from {name}</div><p className="text-sm font-medium text-white">{msg.metadata?.offer?.terms || msg.content}</p><div className="mt-1 text-xs text-slate-400">Amount: {msg.metadata?.offer?.amount || '—'} {msg.metadata?.offer?.currency || ''}</div><div className={`mt-2 text-xs font-semibold ${state === 'accept' ? 'text-emerald-400' : state === 'reject' ? 'text-red-400' : 'text-amber-400'}`}>● {state.charAt(0).toUpperCase() + state.slice(1)}</div>{state === 'pending' && !own && isJobSession && <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => respondOfferMutation.mutate({ messageId: msg._id, action: 'accept' })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500">Accept</button><button onClick={() => respondOfferMutation.mutate({ messageId: msg._id, action: 'counter' })} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-600">Counter</button><button onClick={() => respondOfferMutation.mutate({ messageId: msg._id, action: 'reject' })} className="rounded-lg bg-red-900/60 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-900">Reject</button></div>}</div></div>;
    }
    return <div key={msg._id}>{showDayDivider && <div className="my-4 flex items-center gap-3"><div className="flex-1 border-t border-slate-800" /><span className="text-[10px] text-slate-600">{dayLabel(msg.createdAt)}</span><div className="flex-1 border-t border-slate-800" /></div>}<div className={`group flex items-end gap-2 ${own ? 'flex-row-reverse' : 'flex-row'} ${firstInGroup ? 'mt-3' : 'mt-0.5'}`} onMouseEnter={() => setHoveredMessageId(msg._id)} onMouseLeave={() => setHoveredMessageId(null)}><div className="w-8 shrink-0">{!own && firstInGroup && <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(name)}`}>{initials(name)}</div>}</div><div className={`flex flex-col gap-0.5 ${own ? 'items-end' : 'items-start'}`} style={{ maxWidth: '72%' }}>{!own && firstInGroup && <span className="ml-1 text-[11px] font-semibold text-slate-400">{name}</span>}<div className={`relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${bubbleWidth} ${msg.isFlagged ? 'border border-orange-500/30 bg-orange-500/10 text-orange-200' : own ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-white'} ${own ? 'rounded-br-sm' : 'rounded-bl-sm'}`}><p className="whitespace-pre-wrap break-words">{msg.content}</p>{!!msg.attachments?.length && <div className="mt-2 space-y-1">{msg.attachments.map((a, i) => <a key={`${a.url}-${i}`} href={`${apiBase}${a.url}`} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 text-xs underline ${own ? 'text-slate-800' : 'text-emerald-300'}`}><Paperclip size={10} /> {a.name}</a>)}</div>}</div><div className={`flex items-center gap-1.5 px-1 transition-opacity ${hoveredMessageId === msg._id ? 'opacity-100' : 'opacity-0'}`}><span className="text-[10px] text-slate-600">{messageTime(msg.createdAt)}</span>{own && (msg.readBy && msg.readBy.length > 1 ? <CheckCheck size={12} className="text-emerald-400" /> : <Check size={12} className="text-slate-600" />)}</div></div>{!own && hoveredMessageId === msg._id && !msg.isFlagged && <button onClick={() => flagMutation.mutate({ messageId: msg._id, reason: 'Suspicious request' })} className="mb-2 rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-800 hover:text-orange-400" title="Flag message"><Flag size={13} /></button>}</div></div>;
  };
  return (
    <div className="grid h-[calc(100vh-120px)] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="card flex min-h-0 flex-col gap-3 overflow-hidden">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Messages</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input py-2 text-sm" placeholder="Search conversations..." />
        </div>

        {jobId && (
          <button className="btn-primary w-full py-2 text-sm" onClick={() => initiateMutation.mutate()} disabled={initiateMutation.isPending || !canInitiateJobChat}>
            {initiateMutation.isPending ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Opening...</span> : canInitiateJobChat ? 'Open Job Chat' : 'Select applicant first'}
          </button>
        )}

        <div className="flex-1 space-y-1 overflow-y-auto pr-1">
          {sessionsQuery.isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl p-3"><div className="h-9 w-9 shrink-0 rounded-full bg-slate-800" /><div className="flex-1 space-y-2"><div className="h-3 w-3/4 rounded bg-slate-800" /><div className="h-2.5 w-1/2 rounded bg-slate-800" /></div></div>) : filteredSessions.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 text-slate-400"><Video size={18} /></div><p className="text-sm text-slate-500">No conversations yet</p>{canInitiateJobChat && <button className="btn-primary px-4 py-2 text-sm" onClick={() => initiateMutation.mutate()}>{initiateMutation.isPending ? 'Opening...' : 'Start job chat'}</button>}</div> : filteredSessions.map((session) => {
            const otherName = getOtherName(session);
            const isCreator = session.sessionType === 'creator_hub';
            return (
              <button key={session._id} onClick={() => setActiveSessionId(session._id)} className={`group relative w-full rounded-xl border p-3 text-left transition-all ${session._id === activeSessionId ? 'border-amber-500/50 bg-amber-500/10' : 'border-transparent hover:border-slate-700 hover:bg-slate-800/60'}`}>
                <div className={`absolute inset-y-2 left-0 w-1 rounded-full ${session._id === activeSessionId ? 'bg-amber-500' : 'bg-transparent'}`} />
                <div className="flex items-start gap-3 pl-1">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(otherName)}`}>{initials(otherName)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold text-white">{otherName}</span>{session.lastMessageAt && <span className="shrink-0 text-[10px] text-slate-500">{relativeTime(session.lastMessageAt)}</span>}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">{isCreator ? <Video size={10} className="shrink-0 text-amber-500" /> : <Briefcase size={10} className="shrink-0 text-slate-500" />}<span className="truncate text-[11px] text-slate-500">{session.uploadId?.title || session.jobId?.title || session.title}</span></div>
                    {session.lastMessagePreview && <p className="mt-1 truncate text-[11px] text-slate-400">{session.lastMessagePreview}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">{!!session.unreadCount && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-black">{session.unreadCount}</span>}{isCreator && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Creator</span>}</div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="card relative flex min-h-0 flex-col overflow-hidden">
        <header className="relative border-b border-slate-800 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(getOtherName(activeSession || { posterId: {}, applicantId: {}, title: '' } as Session))}`}>{initials(getOtherName(activeSession || { posterId: {}, applicantId: {}, title: '' } as Session))}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-bold">{activeSession ? getOtherName(activeSession) : (sessionsQuery.isLoading ? 'Loading chats...' : 'Select a conversation')}</h2>{activeSession?.sessionType === 'creator_hub' && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300"><Video size={10} /> Creator</span>}{isFrozen && <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300"><Lock size={10} /> Frozen</span>}</div>
                  <div className="truncate text-sm text-slate-400">{activeSession?.uploadId?.title || activeSession?.jobId?.title || ''}{activeSession?.jobId?.company ? ` - ${activeSession.jobId.company}` : ''}</div>
                </div>
              </div>
            </div>

            <div className="relative shrink-0">
              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={() => setShowHeaderMenu((v) => !v)} disabled={!activeSessionId}><MoreVertical size={14} /> Actions <ChevronDown size={12} /></button>
              {showHeaderMenu && activeSessionId && <><button className="fixed inset-0 z-30" aria-label="Close menu" onClick={() => setShowHeaderMenu(false)} /><div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-72 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40"><div className="border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Conversation</div><div className="p-2">{canManageSession && <div className="mb-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2"><div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Status</div><div className="grid grid-cols-3 gap-2"><button className="btn-secondary px-2 py-2 text-xs" onClick={() => setStatusMutation.mutate('open')}>Open</button><button className="btn-secondary px-2 py-2 text-xs" onClick={() => setStatusMutation.mutate('in_progress')}>Active</button><button className="btn-secondary px-2 py-2 text-xs" onClick={() => setStatusMutation.mutate('closed')}>Closed</button></div></div>}{isJobSession && <button className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900" onClick={() => { setIncludeAi((v) => !v); setShowHeaderMenu(false); }}><span className="flex items-center gap-2"><Bot size={14} /> AI assist</span><span className={`text-xs ${includeAi ? 'text-emerald-400' : 'text-slate-500'}`}>{includeAi ? 'On' : 'Off'}</span></button>}{isAdmin && <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500"><ShieldAlert size={12} /> Admin</div><div className="grid grid-cols-2 gap-2"><button className="btn-secondary px-2 py-2 text-xs" onClick={() => moderateMutation.mutate('join')}>Join</button><button className="btn-secondary px-2 py-2 text-xs" onClick={() => moderateMutation.mutate('freeze')}>Freeze</button><button className="btn-secondary px-2 py-2 text-xs" onClick={() => moderateMutation.mutate('unfreeze')}>Unfreeze</button><button className="btn-secondary px-2 py-2 text-xs" onClick={() => moderateMutation.mutate('resolve')}>Resolve</button></div></div>}</div></div></>}
            </div>
          </div>
          {activeSession && (activeSession.moderationStatus === 'flagged' || activeSession.moderationStatus === 'under_review') && <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">This chat has an active fraud report. Admin review is in progress.</div>}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {!activeSession ? <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800/80 text-slate-400"><Video size={22} /></div><h3 className="text-lg font-semibold text-white">Select a conversation</h3><p className="mt-2 max-w-sm text-sm text-slate-400">Pick a chat from the list to start messaging. Creator hub conversations are marked with an amber badge.</p></div> : <div className="space-y-2">{(historyQuery.data || []).map((msg, idx) => renderMessage(msg, idx))}<div ref={messagesEndRef} /></div>}
        </div>

        <div className="border-t border-slate-800 px-4 py-4 sm:px-5">
          {isFrozen ? <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-800/60 py-4 text-sm text-slate-400"><Lock size={15} /> This conversation has been frozen by admin</div> : <>{isJobSession && showOfferPanel && <div className="mb-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Send an offer</span><button onClick={() => setShowOfferPanel(false)} className="text-slate-500 hover:text-slate-300"><X size={14} /></button></div><textarea className="input mb-2 min-h-[80px] py-2 text-sm" placeholder="Describe the terms..." value={offerTerms} onChange={(e) => setOfferTerms(e.target.value)} /><div className="flex gap-2"><input className="input py-2 text-sm" placeholder="Amount (USD)" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} /><button onClick={() => offerMutation.mutate()} disabled={!offerTerms.trim() || offerMutation.isPending} className="btn-primary shrink-0 py-2 text-sm">{offerMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Send'}</button></div></div>}{!!attachments.length && <div className="mb-2 flex flex-wrap gap-2">{attachments.map((a, i) => <span key={`${a.url}-${i}`} className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300"><Paperclip size={10} /> {a.name}<button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="ml-1 text-slate-500 hover:text-red-400"><X size={10} /></button></span>)}</div>}<div className="flex items-end gap-2"><div className="flex shrink-0 items-center gap-1 pb-1"><button onClick={() => fileInputRef.current?.click()} disabled={!activeSessionId || uploadMutation.isPending} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300 disabled:opacity-40" title="Attach file">{uploadMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}</button>{isJobSession && <button onClick={() => setShowOfferPanel((v) => !v)} className={`rounded-lg p-2 transition hover:bg-slate-800 ${showOfferPanel ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Send offer"><Briefcase size={18} /></button>}{isJobSession && <button onClick={() => setIncludeAi((v) => !v)} className={`rounded-lg p-2 transition hover:bg-slate-800 ${includeAi ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title={includeAi ? 'AI assist on' : 'AI assist off'}><Bot size={18} /></button>}</div><div className="relative flex-1"><textarea className="input min-h-[44px] max-h-[160px] resize-none py-2.5 pr-4 text-sm leading-relaxed" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type a message..." rows={1} style={{ height: 'auto' }} onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 160)}px`; }} />{message.length > 500 && <span className={`absolute bottom-2 right-2 text-[10px] ${message.length > 900 ? 'text-red-400' : 'text-slate-500'}`}>{message.length}/1000</span>}</div><button onClick={() => sendMutation.mutate()} disabled={!activeSessionId || !message.trim() || sendMutation.isPending} className="btn-primary mb-0.5 shrink-0 rounded-xl p-2.5 disabled:opacity-40">{sendMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button></div><p className="mt-1.5 text-[10px] text-slate-500">Enter to send, Shift+Enter for a new line</p></>}
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file && activeSessionId) uploadMutation.mutate(file); if (e.target) e.target.value = ''; }} />
        </div>
      </section>
    </div>
  );
}
