'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

export default function ChatPage() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [includeAi, setIncludeAi] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [streamingAi, setStreamingAi] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const jobId = params?.get('jobId') || '';
  const applicantId = params?.get('applicantId') || '';

  const sessionsQuery = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => (await api.get('/chat/sessions')).data.sessions || [],
    refetchInterval: 6000,
  });

  const initiateMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error('Missing job id');
      const response = await api.post(`/chat/jobs/${jobId}/initiate`, applicantId ? { applicantId } : {});
      return response.data.session;
    },
    onSuccess: (session) => {
      setActiveSessionId(session._id);
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      toast.success('Chat ready');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to initiate chat'),
  });

  useEffect(() => {
    if (!activeSessionId && sessionsQuery.data?.length) {
      setActiveSessionId(sessionsQuery.data[0]._id);
    }
  }, [activeSessionId, sessionsQuery.data]);

  const historyQuery = useQuery({
    queryKey: ['chat-history', activeSessionId],
    enabled: Boolean(activeSessionId),
    queryFn: async () => (await api.get(`/chat/sessions/${activeSessionId}/history`)).data.messages || [],
    refetchInterval: 2500,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) throw new Error('Select a session');
      const response = await api.post(`/chat/sessions/${activeSessionId}/messages`, { content: message, includeAi });
      return response.data;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to send message'),
  });

  const activeSession = useMemo(
    () => sessionsQuery.data?.find((session: any) => session._id === activeSessionId),
    [sessionsQuery.data, activeSessionId]
  );

  useEffect(() => {
    const token = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('earnhub-auth') || '{}')?.state?.token : null;
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || window.location.origin;
    const socket: Socket = io(base, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (activeSessionId) socket.emit('chat:join', { sessionId: activeSessionId });
    });
    socket.on('chat:typing', (payload) => {
      if (payload?.sessionId !== activeSessionId) return;
      setTypingUsers((prev) => ({ ...prev, [payload.userId]: Boolean(payload.isTyping) }));
    });
    socket.on('ai-delta', (payload) => {
      if (payload?.sessionId !== activeSessionId) return;
      setStreamingAi((prev) => `${prev}${payload.delta || ''}`);
    });
    socket.on('ai-done', (payload) => {
      if (payload?.sessionId !== activeSessionId) return;
      setStreamingAi('');
      queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] });
    });
    socket.on('chat:message', (payload) => {
      if (payload?.sessionId !== activeSessionId) return;
      queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] });
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [activeSessionId, queryClient]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">Chats</h1>
          {jobId && (
            <button className="btn-primary text-xs px-3 py-1.5" onClick={() => initiateMutation.mutate()} disabled={initiateMutation.isPending}>
              {initiateMutation.isPending ? 'Opening...' : 'Open Job Chat'}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {(sessionsQuery.data || []).map((session: any) => (
            <button
              key={session._id}
              className={`w-full text-left rounded-xl p-3 border ${activeSessionId === session._id ? 'border-green-500 bg-green-500/10' : 'border-slate-800 bg-slate-900/60'}`}
              onClick={() => setActiveSessionId(session._id)}
            >
              <div className="font-semibold text-sm">{session.title || 'Job Chat'}</div>
              <div className="text-xs text-slate-400 mt-1">{session.jobId?.company || 'Company'} - {session.status}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card flex flex-col min-h-[70vh]">
        <div className="border-b border-slate-800 pb-3 mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{activeSession?.jobId?.title || 'Select a chat'}</h2>
            <p className="text-xs text-slate-400">{activeSession?.jobId?.company || ''}</p>
          </div>
          <label className="text-xs text-slate-300 flex items-center gap-2">
            <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} /> AI assist
          </label>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {(historyQuery.data || []).map((msg: any) => (
            <div key={msg._id} className={`rounded-xl px-3 py-2 text-sm ${msg.role === 'assistant' ? 'bg-cyan-500/10 border border-cyan-500/20' : msg.role === 'poster' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-900 border border-slate-800'}`}>
              <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">{msg.role}</div>
              <div className="text-slate-100 whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))}
          {!activeSessionId && <div className="text-slate-400 text-sm">Select or open a session to start chatting.</div>}
        </div>

        <div className="mt-3 flex gap-2">
          <textarea
            className="input min-h-[52px]"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (!activeSessionId || !socketRef.current) return;
              socketRef.current.emit('chat:typing', { sessionId: activeSessionId, isTyping: e.target.value.length > 0 });
            }}
          />
          <button
            className="btn-primary px-5"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !message.trim() || !activeSessionId}
          >
            {sendMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
        {!!Object.values(typingUsers).some(Boolean) && <div className="mt-2 text-xs text-slate-400">Someone is typing...</div>}
        {!!streamingAi && <div className="mt-2 text-xs text-cyan-300 whitespace-pre-wrap">{streamingAi}</div>}
      </div>
    </div>
  );
}
