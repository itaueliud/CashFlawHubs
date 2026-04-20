'use client';
import { TrendingUp, ExternalLink } from 'lucide-react';

const payoutBands = [
  { range: '151 to 700', payout: 'KSh 500' },
  { range: '701 to 1500+', payout: 'KSh 1,000' },
];

const providers = [
  { name: 'Cash Task Board', desc: 'Higher-value cash tasks routed from internal and partner queues.', url: '/dashboard/tasks' },
  { name: 'Verified Task Queue', desc: 'Premium cash tasks with stronger review and payout bands.', url: '/dashboard/tasks' },
];

export default function CashTasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Cash Tasks</h1>
        <p className="text-slate-400 text-sm mt-1">Higher-value tasks arranged separately from regular microtasks</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((provider) => (
          <div key={provider.name} className="card">
            <TrendingUp className="text-orange-400 mb-3" size={28} />
            <h3 className="font-bold text-lg mb-1">{provider.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{provider.desc}</p>
            <a href={provider.url} className="btn-primary text-sm inline-flex items-center gap-2">
              Browse Cash Tasks <ExternalLink size={14} />
            </a>
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="font-bold mb-3">Cash Task Reward Bands</h2>
        <div className="space-y-2">
          {payoutBands.map((band) => (
            <div key={band.range} className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-sm">
              <span className="text-slate-300">{band.range}</span>
              <span className="font-semibold text-green-400">{band.payout}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
