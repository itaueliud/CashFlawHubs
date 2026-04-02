'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Star, Plus } from 'lucide-react';

export default function FreelancePage() {
  const [tab, setTab] = useState<'browse'|'post'>('browse');
  const { data } = useQuery({ queryKey: ['gigs'], queryFn: () => api.get('/freelance/gigs').then(r => r.data) });
  const gigs = data?.gigs || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-black">Freelance Gigs</h1><p className="text-slate-400 text-sm mt-1">Buy or sell skills — 10% platform fee on orders</p></div>
        <button onClick={() => setTab('post')} className="btn-primary text-sm flex items-center gap-2"><Plus size={16}/> Post Gig</button>
      </div>
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {(['browse','post'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-t-xl text-sm font-medium transition-all capitalize ${tab===t?'text-green-400 border-b-2 border-green-400':' text-slate-400 hover:text-white'}`}>{t}</button>
        ))}
      </div>
      {tab==='browse' && (
        gigs.length===0
          ? <div className="card text-center py-16 text-slate-400">No gigs posted yet. Be the first!</div>
          : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gigs.map((g: any) => (
                <div key={g._id} className="card hover:border-slate-600 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <span className="badge-blue capitalize">{g.category}</span>
                    <span className="font-bold text-green-400">${g.priceUSD}</span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{g.title}</h3>
                  <p className="text-slate-400 text-xs mb-3 line-clamp-2">{g.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Star size={11} className="text-yellow-400"/>{g.rating||'New'} · {g.deliveryDays}d delivery
                    </div>
                    <button className="btn-primary text-xs py-1 px-3">Hire</button>
                  </div>
                </div>
              ))}
            </div>
      )}
      {tab==='post' && (
        <div className="card max-w-lg">
          <h3 className="font-bold mb-2">Post a Gig</h3>
          <p className="text-slate-400 text-sm mb-4">Gig creation form — connect to POST /api/freelance/gigs</p>
          <div className="space-y-3">
            {['Title','Category','Description','Price (USD)','Delivery Days'].map(f => (
              <div key={f}><label className="text-sm text-slate-300 mb-1 block">{f}</label><input className="input" placeholder={f}/></div>
            ))}
            <button className="btn-primary">Post Gig</button>
          </div>
        </div>
      )}
    </div>
  );
}
