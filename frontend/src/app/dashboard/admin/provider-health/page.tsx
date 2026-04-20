'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';

const statusStyles: Record<string, string> = {
  healthy: 'border-green-500/30 bg-green-500/10 text-green-300',
  partial: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  missing_config: 'border-red-500/30 bg-red-500/10 text-red-300',
};

export default function ProviderHealthPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-provider-health'],
    queryFn: () => api.get('/admin/provider-health').then((response) => response.data),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div className="card text-sm text-slate-400">Loading provider health...</div>;
  }

  if (error || !data?.success) {
    return <div className="card text-sm text-red-400">Unable to load provider health right now.</div>;
  }

  const transactionCounts = Array.isArray(data.transactionCounts) ? data.transactionCounts : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Provider Health</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configuration and routing visibility for the hybrid Africa payment stack.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-700 px-4 py-3 text-right text-xs text-slate-400">
          <div>Generated</div>
          <div className="mt-1 font-semibold text-slate-200">
            {new Date(data.generatedAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {transactionCounts.map((item: any) => (
          <div key={item._id} className="card">
            <div className="text-xs uppercase tracking-wide text-slate-500">{item._id}</div>
            <div className="mt-2 text-3xl font-black">{item.total}</div>
            <div className="mt-3 flex gap-3 text-xs text-slate-400">
              <span className="text-green-400">Success {item.successful}</span>
              <span className="text-yellow-400">Pending {item.pending}</span>
              <span className="text-red-400">Failed {item.failed}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.providers.map((provider: any) => (
          <div key={provider.key} className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black">{provider.label}</h2>
                <div className="mt-1 text-xs text-slate-500">
                  {provider.key} · env {provider.environment} · docs {provider.documentationStatus}
                </div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[provider.status] || statusStyles.partial}`}>
                {provider.status.replace('_', ' ')}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Required</div>
                <div className="space-y-2 text-sm">
                  {provider.required.map((item: any) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <span>{item.name}</span>
                      {item.configured ? (
                        <CheckCircle2 size={15} className="text-green-400" />
                      ) : (
                        <ShieldAlert size={15} className="text-red-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended</div>
                <div className="space-y-2 text-sm">
                  {provider.recommended.length === 0 && <div className="text-slate-500">No extra recommended fields</div>}
                  {provider.recommended.map((item: any) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <span>{item.name}</span>
                      {item.configured ? (
                        <CheckCircle2 size={15} className="text-green-400" />
                      ) : (
                        <Clock3 size={15} className="text-yellow-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deposit Coverage</div>
                <div className="mt-2 text-sm text-slate-300">
                  {provider.usage.depositCountries.length > 0 ? provider.usage.depositCountries.join(', ') : 'None'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Withdrawal Coverage</div>
                <div className="mt-2 text-sm text-slate-300">
                  {provider.usage.withdrawalCountries.length > 0 ? provider.usage.withdrawalCountries.join(', ') : 'None'}
                </div>
              </div>
            </div>

            {(provider.missingRequired.length > 0 || provider.missingRecommended.length > 0) && (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-slate-300">
                <div className="mb-2 inline-flex items-center gap-2 font-semibold text-yellow-300">
                  <AlertTriangle size={15} />
                  Follow-up needed
                </div>
                {provider.missingRequired.length > 0 && (
                  <div>Missing required: {provider.missingRequired.join(', ')}</div>
                )}
                {provider.missingRecommended.length > 0 && (
                  <div>Missing recommended: {provider.missingRecommended.join(', ')}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
