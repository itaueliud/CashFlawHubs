'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ExternalLink, Lock } from 'lucide-react';

export default function SurveysPage() {
  const { user } = useAuthStore();
  const { data: cpxData } = useQuery({ queryKey: ['cpx-wall'], queryFn: () => api.get('/surveys/cpx').then(r => r.data), enabled: !!user?.activationStatus });
  const { data: bitlabsData } = useQuery({ queryKey: ['bitlabs-wall'], queryFn: () => api.get('/surveys/bitlabs').then(r => r.data), enabled: !!user?.activationStatus });

  if (!user?.activationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Activation Required</h2>
        <p className="text-slate-400 mb-4">Activate your account to access paid surveys</p>
        <a href="/dashboard/activate" className="btn-primary">Activate Now — 500 KES</a>
      </div>
    );
  }

  const providers = [
    { name: 'CPX Research', logo: '🔬', desc: 'High-paying surveys from global brands. Up to $3 per survey.', url: cpxData?.wallUrl, color: 'from-blue-600 to-blue-700' },
    { name: 'BitLabs', logo: '💡', desc: 'Premium survey provider with fast payouts.', url: bitlabsData?.wallUrl, color: 'from-purple-600 to-purple-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Paid Surveys</h1>
        <p className="text-slate-400 text-sm mt-1">Complete surveys and earn up to $3 each</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((p) => (
          <div key={p.name} className="card">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-2xl mb-4`}>{p.logo}</div>
            <h3 className="font-bold text-lg mb-1">{p.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{p.desc}</p>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex items-center gap-2 w-fit">
                Start Surveys <ExternalLink size={14} />
              </a>
            ) : <div className="text-slate-500 text-sm animate-pulse">Loading wall...</div>}
          </div>
        ))}
      </div>
      <div className="card bg-slate-900">
        <h3 className="font-semibold mb-2">Tips for more surveys</h3>
        <ul className="text-sm text-slate-400 space-y-1.5">
          <li>✓ Complete your profile for better survey matching</li>
          <li>✓ Answer honestly — quality checks will screen you out otherwise</li>
          <li>✓ Check back daily — new surveys are added regularly</li>
          <li>✓ Earnings are credited automatically within minutes</li>
        </ul>
      </div>
    </div>
  );
}
