'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ExternalLink, Lock } from 'lucide-react';

export default function SurveysPage() {
  const { user } = useAuthStore();
  const { data } = useQuery({
    queryKey: ['category-providers', 'surveys'],
    queryFn: () => api.get('/catalog/categories/surveys/providers').then((r) => r.data),
    enabled: !!user,
  });

  if (!user?.activationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Activation Required</h2>
        <p className="text-slate-400 mb-4">Activate your account to access paid surveys</p>
        <a href="/dashboard/activate" className="btn-primary">Activate Now - 500 KES</a>
      </div>
    );
  }

  const providers = data?.providers || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Paid Surveys</h1>
        <p className="text-slate-400 text-sm mt-1">Different survey APIs arranged under one category</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((provider: any) => (
          <div key={provider.key} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="text-lg font-semibold text-white">{provider.name}</div>
              <span className={provider.live ? 'badge-green' : 'badge-blue'}>{provider.badge}</span>
            </div>
            <p className="text-slate-400 text-sm mb-3">{provider.description}</p>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
              {provider.integrationType} / {provider.access.replace(/_/g, ' ')}
            </div>
            {provider.url ? (
              <a href={provider.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex items-center gap-2 w-fit">
                Open Provider <ExternalLink size={14} />
              </a>
            ) : (
              <div className="text-slate-500 text-sm">API slot reserved. Configure credentials to activate this provider.</div>
            )}
          </div>
        ))}
      </div>
      <div className="card bg-slate-900">
        <h3 className="font-semibold mb-2">Tips for more surveys</h3>
        <ul className="text-sm text-slate-400 space-y-1.5">
          <li>Complete your profile for better survey matching.</li>
          <li>Use the live providers first; planned providers can be enabled later without redesigning the page.</li>
          <li>Earnings are credited automatically for callback-enabled providers.</li>
        </ul>
      </div>
    </div>
  );
}
