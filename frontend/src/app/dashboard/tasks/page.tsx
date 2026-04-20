'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Lock, ExternalLink } from 'lucide-react';

export default function TasksPage() {
  const { user } = useAuthStore();
  const { data } = useQuery({
    queryKey: ['category-providers', 'microtasks'],
    queryFn: () => api.get('/catalog/categories/microtasks/providers').then((r) => r.data),
    enabled: !!user,
  });

  if (!user?.activationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Activation Required</h2>
        <a href="/dashboard/activate" className="btn-primary mt-2">Activate Now</a>
      </div>
    );
  }

  const providers = data?.providers || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Microtasks</h1>
        <p className="text-slate-400 text-sm mt-1">Different APIs and external platforms for task-based earning</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((provider: any) => (
          <div key={provider.key} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="text-lg font-semibold text-white">{provider.name}</div>
              <span className={provider.live ? 'badge-blue' : 'badge-blue'}>{provider.badge}</span>
            </div>
            <p className="text-slate-400 text-sm mb-3">{provider.description}</p>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
              {provider.integrationType} / {provider.access.replace(/_/g, ' ')}
            </div>
            {provider.url ? (
              <a href={provider.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex items-center gap-2 w-fit">
                Open Platform <ExternalLink size={14} />
              </a>
            ) : (
              <div className="text-slate-500 text-sm">Reserved API integration slot for this microtask source.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
