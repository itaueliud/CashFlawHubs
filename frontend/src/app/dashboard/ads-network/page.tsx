'use client';
import { Radio, ExternalLink } from 'lucide-react';

const providers = [
  { name: 'AdGate Rewards', desc: 'Ad-driven campaigns, installs, and signup traffic offers.', url: '/dashboard/offerwalls', badge: 'Traffic Offers' },
  { name: 'Ayet Studios', desc: 'Performance ad network with rewarded installs and conversion offers.', url: '/dashboard/offerwalls', badge: 'Rewarded Ads' },
];

export default function AdsNetworkPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Ads / Ad Network</h1>
        <p className="text-slate-400 text-sm mt-1">Campaign-based ads and ad-network tasks arranged separately from offerwalls</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((provider) => (
          <div key={provider.name} className="card">
            <div className="flex items-start justify-between mb-3">
              <Radio className="text-cyan-400" size={28} />
              <span className="badge-blue">{provider.badge}</span>
            </div>
            <h3 className="font-bold text-lg mb-1">{provider.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{provider.desc}</p>
            <a href={provider.url} className="btn-primary text-sm inline-flex items-center gap-2">
              Open Ad Offers <ExternalLink size={14} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
