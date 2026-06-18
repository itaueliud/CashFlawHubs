'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../lib/api';
import { Bell, Send, CalendarClock, Sparkles, Users, Search, Download, Eye, FileText } from 'lucide-react';
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from '../../../components/ui';

type UserOption = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  userId?: string;
  country?: string;
  balanceUSD?: number;
  activationStatus?: boolean;
};

type BroadcastCampaign = {
  _id: string;
  title: string;
  message: string;
  channel: 'in_app' | 'email' | 'both';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduledFor?: string | null;
  sentAt?: string | null;
  createdAt?: string;
  stats?: { targeted?: number; sent?: number; failed?: number; read?: number };
  readCount?: number;
  openRate?: number;
  lastError?: string;
  createdBy?: { name?: string; email?: string };
  target?: {
    scope?: string;
    countries?: string[];
    minBalance?: number | null;
    activatedOnly?: boolean;
    userIds?: string[];
  };
};

const channelLabel: Record<string, string> = {
  in_app: 'In-app',
  email: 'Email',
  both: 'Both',
};

function RichEditor({
  html,
  setHtml,
}: {
  html: string;
  setHtml: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
    }
  }, [html]);

  const applyFormat = (command: 'bold' | 'italic' | 'insertUnorderedList') => {
    ref.current?.focus();
    document.execCommand(command, false);
    setHtml(ref.current?.innerHTML || '');
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => applyFormat('bold')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">Bold</button>
        <button type="button" onClick={() => applyFormat('italic')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">Italic</button>
        <button type="button" onClick={() => applyFormat('insertUnorderedList')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">Bullets</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => setHtml(ref.current?.innerHTML || '')}
        className="min-h-40 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
      />
      <div className="mt-2 text-xs text-slate-500">Use this as the broadcast body. HTML is preserved for email delivery and rendered in-app as plain content.</div>
    </div>
  );
}

export default function NotificationsPage() {
  const [mode, setMode] = useState<'broadcast' | 'targeted'>('broadcast');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [history, setHistory] = useState<BroadcastCampaign[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [htmlMessage, setHtmlMessage] = useState('<p>Hello team,</p><p>We have an update for you.</p>');
  const [channel, setChannel] = useState<'in_app' | 'email' | 'both'>('both');
  const [segment, setSegment] = useState<'all' | 'country' | 'activated' | 'balance' | 'manual'>('all');
  const [countries, setCountries] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [activatedOnly, setActivatedOnly] = useState(false);
  const [sendAt, setSendAt] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [targetSearchResults, setTargetSearchResults] = useState<UserOption[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<UserOption[]>([]);
  const [targetMessage, setTargetMessage] = useState('');

  const loadHistory = async () => {
    try {
      const res = await api.get('/admin/notifications/broadcasts/history');
      setHistory(res.data?.campaigns || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load broadcast history');
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const previewAudience = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/notifications/broadcast/preview', {
        params: {
          segment,
          countries: countries.trim(),
          country: countries.trim().split(',')[0] || '',
          minBalance,
          activatedOnly,
          userIds: selectedRecipients.map((u) => u._id).join(','),
          userSearch: targetQuery.trim(),
        },
      });
      setPreviewCount(response.data?.count ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to preview audience');
    } finally {
      setLoading(false);
    }
  };

  const sendBroadcast = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.post('/admin/notifications/broadcast', {
        title,
        message,
        htmlMessage,
        channel,
        segment,
        countries: countries.split(',').map((item) => item.trim()).filter(Boolean),
        minBalance: minBalance ? Number(minBalance) : null,
        activatedOnly,
        userIds: selectedRecipients.map((u) => u._id),
        userSearch: targetQuery,
        sendAt: sendAt ? new Date(sendAt).toISOString() : null,
        metadata: { source: 'admin-broadcast-center' },
      });
      setSuccess(response.data?.message || 'Broadcast saved');
      setTitle('');
      setMessage('');
      setHtmlMessage('<p>Hello team,</p><p>We have an update for you.</p>');
      setCountries('');
      setMinBalance('');
      setActivatedOnly(false);
      setSendAt('');
      setPreviewCount(null);
      await loadHistory();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  };

  const searchTargets = async () => {
    if (!targetQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/users', { params: { search: targetQuery.trim(), page: 1, limit: 10 } });
      setTargetSearchResults(response.data?.users || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = (user: UserOption) => {
    setSelectedRecipients((current) => current.some((item) => item._id === user._id) ? current : [...current, user]);
  };

  const removeRecipient = (userId: string) => {
    setSelectedRecipients((current) => current.filter((item) => item._id !== userId));
  };

  const canSendBroadcast = title.trim() && message.trim();
  const canSendTargeted = title.trim() && targetMessage.trim() && selectedRecipients.length > 0;

  const historySorted = useMemo(() => history.slice().sort((a, b) => Number(new Date(b.createdAt || b.sentAt || 0)) - Number(new Date(a.createdAt || a.sentAt || 0))), [history]);

  const sendTargeted = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.post('/admin/notifications/targeted', {
        recipients: selectedRecipients.map((u) => u._id),
        title,
        message: targetMessage,
        notificationType: 'system',
        channel,
        metadata: { source: 'admin-targeted-center' },
      });
      setSuccess(response.data?.message || 'Notification sent');
      setTitle('');
      setTargetMessage('');
      setSelectedRecipients([]);
      setTargetQuery('');
      setTargetSearchResults([]);
      await loadHistory();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send targeted notification');
    } finally {
      setLoading(false);
    }
  };

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(historySorted, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `broadcast-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Broadcast & Announcements" description="Compose rich broadcasts, target users by rules, schedule sends, and review campaign history with open rates." />

      {error && <ErrorBanner message={error} />}
      {success && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</div>}

      <section className="flex flex-wrap gap-2">
        {(['broadcast', 'targeted'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setMode(item)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize transition ${mode === item ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300' : 'border-white/10 bg-white/5 text-slate-300'}`}
          >
            {item}
          </button>
        ))}
      </section>

      {mode === 'broadcast' ? (
        <section className="card-surface soft-up space-y-5 rounded-[24px] p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Broadcast title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Platform update" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
                  <option value="in_app">In-app only</option>
                  <option value="email">Email only</option>
                  <option value="both">In-app + Email</option>
                </select>
                <select value={segment} onChange={(e) => setSegment(e.target.value as any)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
                  <option value="all">All users</option>
                  <option value="country">Specific country</option>
                  <option value="activated">Activated only</option>
                  <option value="balance">Balance above X</option>
                  <option value="manual">Selected users</option>
                </select>
              </div>

              {segment === 'country' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Countries</label>
                  <input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="KE, UG, TZ" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                </div>
              )}

              {segment === 'balance' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Minimum balance</label>
                  <input value={minBalance} onChange={(e) => setMinBalance(e.target.value)} type="number" min={0} step="0.01" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  <input type="checkbox" checked={activatedOnly} onChange={(e) => setActivatedOnly(e.target.checked)} />
                  Activated only
                </label>
                <input value={sendAt} onChange={(e) => setSendAt(e.target.value)} type="datetime-local" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              </div>
            </div>

            <RichEditor html={htmlMessage} setHtml={setHtmlMessage} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Preview audience: <span className="font-semibold text-white">{previewCount ?? 'click preview'}</span>
            </div>
            <button onClick={previewAudience} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">
              <Eye className="mr-2 inline h-4 w-4" />
              Preview
            </button>
            <button
              onClick={sendBroadcast}
              disabled={loading || !canSendBroadcast}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sendAt ? 'Schedule broadcast' : 'Send broadcast'}
            </button>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Message preview</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Plain text fallback for in-app and SMS-like previews"
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
            />
          </div>
        </section>
      ) : (
        <section className="card-surface soft-up space-y-5 rounded-[24px] p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Recipient search</label>
                <div className="flex gap-2">
                  <input value={targetQuery} onChange={(e) => setTargetQuery(e.target.value)} placeholder="Search by name, email, phone, or userId" className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                  <button onClick={searchTargets} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">
                    <Search className="mr-2 inline h-4 w-4" />
                    Search
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Selected users</div>
                <div className="flex flex-wrap gap-2">
                  {selectedRecipients.length === 0 ? (
                    <div className="text-sm text-slate-500">No users selected yet.</div>
                  ) : selectedRecipients.map((user) => (
                    <button
                      key={user._id}
                      onClick={() => removeRecipient(user._id)}
                      className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                    >
                      {user.name} ×
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {targetSearchResults.length > 0 ? targetSearchResults.map((user) => (
                  <button
                    key={user._id}
                    onClick={() => addRecipient(user)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left transition hover:border-cyan-400/30 hover:bg-cyan-500/10"
                  >
                    <div>
                      <div className="font-semibold text-white">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email || user.phone || 'No contact'} · {user.userId || 'n/a'}</div>
                    </div>
                    <div className="text-xs text-slate-500">{user.country || 'n/a'}</div>
                  </button>
                )) : (
                  <div className="text-sm text-slate-500">Search results will appear here.</div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Account update" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Message</label>
                <textarea value={targetMessage} onChange={(e) => setTargetMessage(e.target.value)} placeholder="Please review..." rows={9} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
                  <option value="in_app">In-app</option>
                  <option value="email">Email</option>
                  <option value="both">Both</option>
                </select>
                <button
                  onClick={sendTargeted}
                  disabled={loading || !canSendTargeted}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Send targeted
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card-surface soft-up space-y-4 rounded-[24px] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileText className="h-4 w-4 text-emerald-300" />
              Broadcast history
            </div>
            <p className="text-sm text-slate-400">Open rate is calculated from delivered in-app notifications that have been marked read.</p>
          </div>
          <button onClick={exportHistory} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            <Download className="h-4 w-4" /> Export history
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {historySorted.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/5 p-8 text-center text-slate-500">No broadcast campaigns yet.</div>
          ) : historySorted.map((campaign) => (
            <div key={campaign._id} className="rounded-2xl border border-white/8 bg-slate-950/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-white">{campaign.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {campaign.createdBy?.name || 'Unknown'} · {campaign.createdAt ? new Date(campaign.createdAt).toLocaleString() : 'n/a'}
                  </div>
                </div>
                <StatusBadge status={campaign.status} />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-4 text-xs">
                <div className="rounded-xl border border-white/8 bg-white/5 p-2"><div className="text-slate-500">Targeted</div><div className="mt-1 font-semibold text-white">{campaign.stats?.targeted ?? 0}</div></div>
                <div className="rounded-xl border border-white/8 bg-white/5 p-2"><div className="text-slate-500">Sent</div><div className="mt-1 font-semibold text-white">{campaign.stats?.sent ?? 0}</div></div>
                <div className="rounded-xl border border-white/8 bg-white/5 p-2"><div className="text-slate-500">Open rate</div><div className="mt-1 font-semibold text-emerald-300">{campaign.openRate ?? 0}%</div></div>
                <div className="rounded-xl border border-white/8 bg-white/5 p-2"><div className="text-slate-500">Channel</div><div className="mt-1 font-semibold text-white">{channelLabel[campaign.channel] || campaign.channel}</div></div>
              </div>

              <div className="mt-3 rounded-xl border border-white/8 bg-white/5 p-3 text-sm text-slate-300">
                {campaign.message}
              </div>

              {campaign.lastError && (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {campaign.lastError}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
