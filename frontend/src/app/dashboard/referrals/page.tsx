'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Copy, Users, DollarSign, Trophy, MessageCircle, Send, Loader2, Lock, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { resolveEmbedSource } from '@/lib/embeds';

export default function ReferralsPage() {
  const { user, hasHydrated } = useAuthStore();
  const [showFileLocker, setShowFileLocker] = useState(false);
  const [fileLockerLoaded, setFileLockerLoaded] = useState(false);
  const userId = user?.id || user?._id || user?.userId || null;
  const { data, isLoading } = useQuery({
    queryKey: ['referral-dashboard', userId],
    queryFn: () => api.get('/referrals/dashboard').then(r => r.data),
    enabled: hasHydrated && !!user,
    staleTime: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/referrals/leaderboard').then(r => r.data.leaderboard),
  });
  const fileLockerSrc = resolveEmbedSource('NEXT_PUBLIC_CPALEAD_FILE_LOCKER_URL', 'VITE_CPALEAD_FILE_LOCKER_URL');
  const invited = data?.invited || data?.recentInvited || [];
  const referred = data?.referred || data?.recentReferred || [];
  const totalInvited = data?.invitedCount ?? data?.totalInvited ?? 0;
  const totalReferred = data?.activatedCount ?? data?.totalReferred ?? 0;
  const pendingUSD = data?.pendingUSD ?? 0;
  const totalEarnedUSD = data?.totalEarnedUSD ?? 0;
  const referralBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.cashflowhubs.com';

  const link = useMemo(
    () => data?.referralLink || (user?.referralCode ? `${referralBaseUrl}/register?ref=${user.referralCode}` : ''),
    [data?.referralLink, referralBaseUrl, user?.referralCode]
  );

  const shareText = `Join CashFlowHubs and start earning from paid surveys, microtasks, remote jobs, and referral bonuses. Sign up free here: ${link}`;
  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success('Copied!');
  };
  const whatsapp = () => {
    if (!link) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
  };
  const telegram = () => {
    if (!link) return;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-emerald-950/20">
        <h1 className="text-2xl font-black">Refer and Earn</h1>
        <p className="text-slate-300 text-sm mt-1">Earn 200 KES for every activated referral</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Invited', value: isLoading && !data ? '…' : totalInvited, icon: Users, color: 'text-emerald-400' },
          { label: 'Referred', value: isLoading && !data ? '…' : totalReferred, icon: Trophy, color: 'text-yellow-400' },
          { label: 'Earned', value: `${Number(totalEarnedUSD).toFixed(2)} USD`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Per Referral', value: '200 KES', icon: Trophy, color: 'text-yellow-400' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <s.icon size={24} className={`${s.color} mx-auto mb-2`} />
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 className="font-bold mb-3">Your Referral Link</h3>
        <div className="bg-slate-900 rounded-xl px-4 py-3 font-mono text-sm text-slate-300 mb-3 break-all">
          {link || (isLoading ? 'Loading...' : 'Referral link unavailable')}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copy} disabled={!link} className="btn-secondary text-sm flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"><Copy size={14} /> Copy Link</button>
          <button onClick={whatsapp} disabled={!link} className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-xl transition-all inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"><MessageCircle size={14} /> WhatsApp</button>
          <button onClick={telegram} disabled={!link} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl transition-all inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"><Send size={14} /> Telegram</button>
        </div>
      </div>
      <div className="card bg-slate-900 border-emerald-500/20">
        <h3 className="font-semibold mb-3">How It Works</h3>
        <div className="space-y-2">
          {['Share your link with friends', 'They register using your link', 'They pay 500 KES activation fee', 'You instantly receive 200 KES!'].map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-slate-400">
              <div className="w-6 h-6 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</div>{s}
            </div>
          ))}
        </div>
      </div>
      {(leaderboard || []).length > 0 && (
        <div className="card">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Trophy size={16} className="text-yellow-400" /> Top Referrers</h3>
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((u: any, i: number) => (
              <div key={`${u.name || 'referrer'}-${u.country || 'xx'}-${u.level || '0'}-${i}`} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i===0?'bg-yellow-400 text-black':i===1?'bg-slate-400 text-black':i===2?'bg-orange-400 text-black':'bg-slate-700 text-slate-300'}`}>{i+1}</div>
                <div className="flex-1 text-sm font-medium">{u.name}</div>
                <div className="text-xs text-green-400">{u.totalReferrals} refs</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Unlock Free Guide</h2>
            <p className="mt-1 text-sm text-slate-400">
              Open the File Locker below for an optional bonus unlock step that sits under the referral flow.
            </p>
          </div>
          <span className="badge-blue">Bonus</span>
        </div>
        <button
          onClick={() => setShowFileLocker(true)}
          className="btn-primary mt-4 w-full inline-flex items-center justify-center gap-2"
        >
          <Lock size={14} /> Unlock Free Guide
        </button>
      </div>

      {showFileLocker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#111827] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-4 py-3">
              <div>
                <h3 className="text-lg font-bold">File Locker</h3>
                <p className="mt-1 text-xs text-slate-400">Complete the unlock step to access the bonus guide.</p>
              </div>
              <button
                onClick={() => {
                  setShowFileLocker(false);
                  setFileLockerLoaded(false);
                }}
                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:text-white"
                aria-label="Close file locker"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative min-h-[550px] bg-slate-950">
              {!fileLockerSrc ? (
                <div className="flex h-[550px] items-center justify-center px-6 text-center text-sm text-slate-400">
                  File Locker is unavailable right now.
                </div>
              ) : (
                <>
                  {!fileLockerLoaded && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80">
                      <Loader2 size={24} className="animate-spin text-violet-400" />
                    </div>
                  )}
                  <iframe
                    src={fileLockerSrc}
                    width="100%"
                    height="550px"
                    frameBorder="0"
                    title="File Locker"
                    onLoad={() => setFileLockerLoaded(true)}
                    className="block h-[550px] w-full"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation"
                    referrerPolicy="no-referrer"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
