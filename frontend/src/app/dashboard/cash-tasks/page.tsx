'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { TrendingUp, ExternalLink } from 'lucide-react';

export default function CashTasksPage() {
  const { data } = useQuery({
    queryKey: ['category-providers', 'cash_tasks'],
    queryFn: () => api.get('/catalog/categories/cash_tasks/providers').then((r) => r.data),
  });

  const providers = data?.providers || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Cash Tasks</h1>
        <p className="text-slate-400 text-sm mt-1">Higher-value task APIs and premium queues</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((provider: any) => (
          <div key={provider.key} className="card">
            <TrendingUp className="text-orange-400 mb-3" size={28} />
            <h3 className="font-bold text-lg mb-1">{provider.name}</h3>
            <p className="text-slate-400 text-sm mb-3">{provider.description}</p>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
              {provider.integrationType} / {provider.access.replace(/_/g, ' ')}
            </div>
            {provider.url ? (
              <a href={provider.url} className="btn-primary text-sm inline-flex items-center gap-2">
                Browse Cash Tasks <ExternalLink size={14} />
              </a>
            ) : (
              <div className="text-slate-500 text-sm">Premium partner queue placeholder ready for API hookup.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
