'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Lock, Wallet, Clock, CheckCircle, XCircle,
  Loader2, RefreshCw, AlertCircle, History,
} from 'lucide-react';

interface CpxTx {
  cpxTransactionId: string;
  surveyId:        string | null;
  type:            string;
  grossUSD:        number;
  userShareUSD:    number;
  xpAwarded:       number;
  status:          'pending' | 'approved' | 'paid' | 'reversed' | 'rejected';
  createdAt:       string;
  availableAfter:  string;
}

function StatusBadge({ status }: { status: CpxTx['status'] }) {
  const map = {
    pending:  { label: 'Pending (hold)', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: <Clock size={11}/> },
    approved: { label: 'Approved',       cls: 'bg-green-500/15  text-green-400  border-green-500/30',  icon: <CheckCircle size={11}/> },
    paid:     { label: 'Paid',           cls: 'bg-blue-500/15   text-blue-400   border-blue-500/30',   icon: <CheckCircle size={11}/> },
    reversed: { label: 'Reversed',       cls: 'bg-red-500/15    text-red-400    border-red-500/30',    icon: <XCircle size={11}/> },
    rejected: { label: 'Rejected',       cls: 'bg-slate-500/15  text-slate-400  border-slate-500/30', icon: <XCircle size={11}/> },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

function Countdown({ availableAfter }: { availableAfter: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = new Date(availableAfter).getTime() - Date.now();
      if (diff <= 0) return setLabel('Ready');
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(`${h}h ${m}m left`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [availableAfter]);
  return <span className="text-xs text-slate-500">{label}</span>;
}

export default function SurveysPage() {
  const { user } = useAuthStore();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    data: iframeData,
    isLoading: iframeLoading,
    isError: iframeError,
    refetch: refetchIframe,
  } = useQuery({
    queryKey: ['cpx-iframe-params'],
    queryFn:  () => api.get('/cpx/iframe-params').then(r => r.data),
    enabled:  !!user?.activationStatus,
    staleTime: 30 * 60 * 1000,
  });

  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['cpx-history'],
    queryFn:  () => api.get('/cpx/history?limit=20').then(r => r.data),
    enabled:  !!user,
    refetchInterval: 60_000,
  });

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-slate-400 text-sm">
        <Loader2 className="animate-spin text-emerald-400" size={24} />
        Loading surveys...
      </div>
    );
  }

  if (!user?.activationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
        <Lock size={48} className="text-slate-600" />
        <h2 className="text-xl font-bold">Activation Required</h2>
        <p className="text-slate-400 text-sm">Activate your account to access paid surveys</p>
        <a href="/dashboard/activate" className="px-6 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors">
          Activate Now — 500 KES
        </a>
      </div>
    );
  }

  const transactions: CpxTx[] = historyData?.transactions || [];
  const pendingTotal  = transactions.filter(t => t.status === 'pending').reduce((s, t) => s + (t.xpAwarded || 0), 0);
  const approvedTotal = transactions.filter(t => ['approved','paid'].includes(t.status)).reduce((s, t) => s + (t.xpAwarded || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              <Wallet size={12} /> CPX Research Surveys
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Survey Wall</h1>
            <p className="mt-2 text-sm text-slate-400">
              Complete surveys to earn. Rewards are held briefly for verification then credited to your wallet automatically.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
              <div className="text-xs text-yellow-400/70 flex items-center gap-1"><Clock size={10}/> Pending</div>
              <div className="text-xl font-black text-yellow-300">{pendingTotal.toLocaleString()} XP</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <div className="text-xs text-emerald-400/70 flex items-center gap-1"><CheckCircle size={10}/> Approved</div>
              <div className="text-xl font-black text-emerald-300">{approvedTotal.toLocaleString()} XP</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-300">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>Survey rewards are held for verification, then added to your XP as XP points. XP isn't withdrawable directly — redeem it into cash from your Wallet page.</span>
      </div>

      {/* Iframe */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
          <span className="text-sm font-semibold text-slate-300">Available Surveys</span>
          <button
            onClick={() => { setIframeLoaded(false); refetchIframe(); }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {iframeLoading && (
          <div className="flex items-center justify-center h-48 gap-2 text-slate-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> Loading surveys…
          </div>
        )}

        {iframeError && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <XCircle size={32} className="text-red-400" />
            <p className="text-sm text-slate-400">Failed to load survey wall.</p>
            <button onClick={() => refetchIframe()} className="text-xs text-emerald-400 underline">Try again</button>
          </div>
        )}

        {iframeData?.iframeUrl && (
          <div className="relative h-[650px] w-full">
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                <Loader2 size={24} className="animate-spin text-emerald-400" />
              </div>
            )}
            <iframe
              src={iframeData.iframeUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              title="CPX Research Survey Wall"
              onLoad={() => setIframeLoaded(true)}
              className="block w-full h-full"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation"
            />
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50">
        <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <History size={14} /> Reward History
          </span>
          <button onClick={() => refetchHistory()} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Refresh
          </button>
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No survey rewards yet. Complete a survey above to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {transactions.map(tx => (
              <div key={tx.cpxTransactionId} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors">
                <div className="flex flex-col gap-1">
                  <StatusBadge status={tx.status} />
                  <span className="text-[11px] text-slate-500">
                    {tx.type} · {new Date(tx.createdAt).toLocaleString()}
                    {tx.status === 'pending' && <> · <Countdown availableAfter={tx.availableAfter} /></>}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white">+{Number(tx.xpAwarded || 0).toLocaleString()} XP</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
