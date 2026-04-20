'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Star, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function FreelancePage() {
  const [tab, setTab] = useState<'browse' | 'post'>('browse');
  const { user } = useAuthStore();
  const { data } = useQuery({ queryKey: ['gigs'], queryFn: () => api.get('/freelance/gigs').then((r) => r.data) });
  const gigs = data?.gigs || [];
  const tokenPolicy = data?.tokenPolicy;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Freelance Gigs</h1>
          <p className="text-slate-400 text-sm mt-1">Buy or sell skills with a token-based posting system</p>
        </div>
        <button onClick={() => setTab('post')} className="btn-primary text-sm flex items-center gap-2"><Plus size={16} /> Post Gig</button>
      </div>

      {tokenPolicy && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-xs text-slate-400 mb-1">Your Token Balance</div>
            <div className="text-3xl font-black text-green-400">{user?.tokenBalance || 0}T</div>
            <p className="text-sm text-slate-400 mt-2">Posting a gig currently costs {tokenPolicy.postingCost} tokens.</p>
          </div>
          <div className="card">
            <h3 className="font-bold mb-2">Token Packages</h3>
            <div className="space-y-2">
              {tokenPolicy.tokenPackages.map((pkg: any) => (
                <div key={pkg.tokens} className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-sm">
                  <span className="text-slate-300">{pkg.tokens} tokens</span>
                  <span className="font-semibold text-green-400">KSh {pkg.amountKES}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {(['browse', 'post'] as const).map((tabName) => (
          <button
            key={tabName}
            onClick={() => setTab(tabName)}
            className={`px-4 py-2 rounded-t-xl text-sm font-medium transition-all capitalize ${tab === tabName ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-400 hover:text-white'}`}
          >
            {tabName}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        gigs.length === 0 ? (
          <div className="card text-center py-16 text-slate-400">No gigs posted yet. Be the first!</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gigs.map((gig: any) => (
              <div key={gig._id} className="card hover:border-slate-600 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <span className="badge-blue capitalize">{gig.category}</span>
                  <span className="font-bold text-green-400">${gig.priceUSD}</span>
                </div>
                <h3 className="font-semibold text-sm mb-1">{gig.title}</h3>
                <p className="text-slate-400 text-xs mb-3 line-clamp-2">{gig.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Star size={11} className="text-yellow-400" />{gig.rating || 'New'} · {gig.deliveryDays}d delivery
                  </div>
                  <button className="btn-primary text-xs py-1 px-3">Hire</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'post' && (
        <div className="card max-w-lg">
          <h3 className="font-bold mb-2">Post a Gig</h3>
          <p className="text-slate-400 text-sm mb-4">Posting a gig deducts {tokenPolicy?.postingCost || 50} tokens from your balance.</p>
          <div className="space-y-3">
            {['Title', 'Category', 'Description', 'Price (USD)', 'Delivery Days'].map((field) => (
              <div key={field}>
                <label className="text-sm text-slate-300 mb-1 block">{field}</label>
                <input className="input" placeholder={field} />
              </div>
            ))}
            <button className="btn-primary">Post Gig</button>
          </div>
        </div>
      )}
    </div>
  );
}
