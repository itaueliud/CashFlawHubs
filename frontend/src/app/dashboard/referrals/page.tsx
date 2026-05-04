'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Copy, Users, DollarSign, Trophy, MessageCircle, Send } from 'lucide-react';

export default function ReferralsPage() {
  const { data } = useQuery({ queryKey: ['referral-dashboard'], queryFn: () => api.get('/referrals/dashboard').then(r => r.data) });
  const { data: leaderboard } = useQuery({ queryKey: ['leaderboard'], queryFn: () => api.get('/referrals/leaderboard').then(r => r.data.leaderboard) });

  const link = data?.referralLink || '';
  const copy = () => { navigator.clipboard.writeText(link); toast.success('Copied!'); };
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`Join CashFlowHubs and earn from surveys, tasks and remote jobs! ${link}`)}`);
  const telegram = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join CashFlowHubs and earn online!')}`);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-black">Referral Earnings</h1><p className="text-slate-400 text-sm mt-1">Earn 200 KES for every activated referral</p></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Referrals', value: data?.totalReferrals || 0, icon: Users, color: 'text-blue-400' },
          { label: 'Total Earned', value: `$${(data?.totalEarnedUSD || 0).toFixed(2)}`, icon: DollarSign, color: 'text-green-400' },
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
      <div className="card bg-slate-900">
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
    </div>
  );
}

