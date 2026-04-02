'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ExternalLink, Lock } from 'lucide-react';

export default function OfferwallsPage() {
  const { user } = useAuthStore();
  const { data: ayetData } = useQuery({ queryKey: ['ayet-wall'], queryFn: () => api.get('/offerwalls/ayetstudios').then(r => r.data), enabled: !!user?.activationStatus });
  const { data: adgateData } = useQuery({ queryKey: ['adgate-wall'], queryFn: () => api.get('/offerwalls/adgate').then(r => r.data), enabled: !!user?.activationStatus });

  if (!user?.activationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Activation Required</h2>
        <a href="/dashboard/activate" className="btn-primary mt-2">Activate Now</a>
      </div>
    );
  }

  const providers = [
    { name: 'Ayет Studios', logo: '🎮', desc: 'Install games, complete offers, earn big rewards. Best paying offerwall.', url: ayetData?.wallUrl, badge: 'Best Paying' },
    { name: 'AdGate Rewards', logo: '🎯', desc: 'App installs, signups, and promotional tasks.', url: adgateData?.wallUrl, badge: 'Popular' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Offerwalls</h1>
        <p className="text-slate-400 text-sm mt-1">Install apps, complete offers, earn instant rewards</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((p) => (
          <div key={p.name} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="text-3xl">{p.logo}</div>
              <span className="badge-green">{p.badge}</span>
            </div>
            <h3 className="font-bold text-lg mb-1">{p.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{p.desc}</p>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex items-center gap-2 w-fit">
                Open Wall <ExternalLink size={14} />
              </a>
            ) : <div className="text-slate-500 text-sm animate-pulse">Loading...</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
