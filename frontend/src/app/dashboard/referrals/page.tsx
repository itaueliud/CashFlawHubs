'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Copy, Users, DollarSign, Trophy, MessageCircle, Send } from 'lucide-react';

export default function ReferralsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['referral-dashboard'],
    queryFn: () => api.get('/referrals/dashboard').then(r => r.data),
    staleTime: 0,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
  const { data: leaderboard } = useQuery({ queryKey: ['leaderboard'], queryFn: () => api.get('/referrals/leaderboard').then(r => r.data.leaderboard) });
  const invited = data?.invited || [];
  const referred = data?.referred || [];

  const link = data?.referralLink || '';
  const shareText = `Join CashFlowHubs and start earning from paid surveys, microtasks, remote jobs, and referral bonuses. Sign up free here: ${link}`;
  const copy = () => { navigator.clipboard.writeText(link); toast.success('Copied!'); };
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
  const telegram = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-emerald-950/20">
        <h1 className="text-2xl font-black">Refer and Earn</h1>
        <p className="text-slate-300 text-sm mt-1">Earn 200 KES for every activated referral</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Invited', value: isLoading && !data ? '…' : (data?.invitedCount ?? data?.totalInvited ?? invited.length ?? 0), icon: Users, color: 'text-emerald-400' },
          { label: 'Referred', value: isLoading && !data ? '…' : (data?.activatedCount ?? data?.totalReferred ?? referred.length ?? 0), icon: Trophy, color: 'text-yellow-400' },
          { label: 'Earned', value: `${(data?.totalEarnedUSD || 0).toFixed(2)} USD`, icon: DollarSign, color: 'text-green-400' },
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
        <div className="bg-slate-900 rounded-xl px-4 py-3 font-mono text-sm text-slate-300 mb-3 break-all">{link || 'Loading...'}</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copy} className="btn-secondary text-sm flex items-center gap-2"><Copy size={14} /> Copy Link</button>
          <button onClick={whatsapp} className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-xl transition-all inline-flex items-center gap-2"><MessageCircle size={14} /> WhatsApp</button>
          <button onClick={telegram} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl transition-all inline-flex items-center gap-2"><Send size={14} /> Telegram</button>
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
              <div key={u._id} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i===0?'bg-yellow-400 text-black':i===1?'bg-slate-400 text-black':i===2?'bg-orange-400 text-black':'bg-slate-700 text-slate-300'}`}>{i+1}</div>
                <div className="flex-1 text-sm font-medium">{u.name}</div>
                <div className="text-xs text-green-400">{u.totalReferrals} refs</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-bold">Recent Invited Users</h3>
          {invited.length === 0 ? (
            <p className="text-sm text-slate-400">No invited users yet.</p>
          ) : (
            <div className="space-y-2">
              {invited.map((u: any, idx: number) => (
                <div key={`invited-${idx}`} className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm">
                  <div className="font-medium text-white">{u.name || 'Unknown'}</div>
                  <div className="text-xs text-slate-400">{u.country} · {new Date(u.joinedAt || u.date || Date.now()).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="mb-3 font-bold">Recent Activated Referrals</h3>
          {referred.length === 0 ? (
            <p className="text-sm text-slate-400">No activated referrals yet.</p>
          ) : (
            <div className="space-y-2">
              {referred.map((u: any, idx: number) => (
                <div key={`referred-${idx}`} className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm">
                  <div className="font-medium text-white">{u.name || 'Unknown'}</div>
                  <div className="text-xs text-slate-400">{u.country} · {new Date(u.joinedAt || u.date || Date.now()).toLocaleDateString()}</div>
                  <div className="mt-1 text-xs text-slate-400">{u.rewardLocal ? `${u.rewardLocal} ${u.currency || ''}`.trim() : 'Pending reward'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

