'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';

const statusStyles: Record<string, string> = {
  healthy: 'border-green-500/30 bg-green-500/10 text-green-300',
  partial: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  missing_config: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const callbackRiskStyles: Record<string, string> = {
  clean: 'border-green-500/30 bg-green-500/10 text-green-300',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
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
  const adsMetrics = data.adsMetrics || {};
  const offerwallPerformance = Array.isArray(adsMetrics.offerwallPerformance) ? adsMetrics.offerwallPerformance : [];
  const adRewardSummary = Array.isArray(adsMetrics.adRewardSummary) ? adsMetrics.adRewardSummary : [];
  const thresholds = adsMetrics.thresholds || {};
  const criticalProviders = offerwallPerformance.filter((item: any) => item.riskLevel === 'critical').length;
  const warningProviders = offerwallPerformance.filter((item: any) => item.riskLevel === 'warning').length;
  const cleanProviders = offerwallPerformance.filter((item: any) => item.riskLevel === 'clean').length;

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

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">Ads Callback Metrics</h2>
            <p className="mt-1 text-sm text-slate-400">
              Daily callback quality telemetry for ad providers (duplicates, invalid signatures, invalid amounts).
            </p>
          </div>
          <div className="text-xs text-slate-500">Source: {adsMetrics.source || 'mongodb'}</div>
        </div>

        <div className="card text-xs text-slate-400">
          <div className="mb-2 font-semibold uppercase tracking-wide text-slate-500">Daily Alert Thresholds</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div>Invalid signatures: <span className="font-semibold text-slate-200">{thresholds.invalidSignaturePerDay ?? 'n/a'}</span></div>
            <div>Duplicates: <span className="font-semibold text-slate-200">{thresholds.duplicatePerDay ?? 'n/a'}</span></div>
            <div>Invalid amounts: <span className="font-semibold text-slate-200">{thresholds.invalidAmountPerDay ?? 'n/a'}</span></div>
            <div>Failures: <span className="font-semibold text-slate-200">{thresholds.failedPerDay ?? 'n/a'}</span></div>
            <div>Suspicious total: <span className="font-semibold text-slate-200">{thresholds.suspiciousEventsPerDay ?? 'n/a'}</span></div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card border-red-500/20 bg-red-500/5">
            <div className="text-xs uppercase tracking-wide text-red-200">Critical Providers</div>
            <div className="mt-2 text-3xl font-black text-red-300">{criticalProviders}</div>
          </div>
          <div className="card border-yellow-500/20 bg-yellow-500/5">
            <div className="text-xs uppercase tracking-wide text-yellow-200">Warning Providers</div>
            <div className="mt-2 text-3xl font-black text-yellow-300">{warningProviders}</div>
          </div>
          <div className="card border-green-500/20 bg-green-500/5">
            <div className="text-xs uppercase tracking-wide text-green-200">Clean Providers</div>
            <div className="mt-2 text-3xl font-black text-green-300">{cleanProviders}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {offerwallPerformance.length === 0 ? (
            <div className="card text-sm text-slate-400">No callback metrics captured yet for today.</div>
          ) : (
            offerwallPerformance.map((item: any) => (
              <div key={item.provider} className="card">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-black capitalize">{item.provider}</div>
                    <div className="text-xs text-slate-500">{item.day}</div>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${callbackRiskStyles[item.riskLevel] || callbackRiskStyles.warning}`}>
                    {item.riskLevel === 'critical' ? 'critical' : item.riskLevel === 'warning' ? 'warning' : 'clean'}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl border border-slate-700 p-2"><div className="text-slate-500">Processed</div><div className="mt-1 text-sm font-semibold text-slate-200">{item.processed}</div></div>
                  <div className="rounded-xl border border-slate-700 p-2"><div className="text-slate-500">Credited</div><div className="mt-1 text-sm font-semibold text-green-300">{item.credited}</div></div>
                  <div className="rounded-xl border border-slate-700 p-2"><div className="text-slate-500">Failed</div><div className="mt-1 text-sm font-semibold text-red-300">{item.failed}</div></div>
                  <div className="rounded-xl border border-slate-700 p-2"><div className="text-slate-500">Duplicates</div><div className="mt-1 text-sm font-semibold text-yellow-300">{item.duplicate}</div></div>
                  <div className="rounded-xl border border-slate-700 p-2"><div className="text-slate-500">Bad Signatures</div><div className="mt-1 text-sm font-semibold text-yellow-300">{item.invalidSignature}</div></div>
                  <div className="rounded-xl border border-slate-700 p-2"><div className="text-slate-500">Bad Amounts</div><div className="mt-1 text-sm font-semibold text-yellow-300">{item.invalidAmount}</div></div>
                </div>
                {Array.isArray(item.triggerReasons) && item.triggerReasons.length > 0 && (
                  <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
                    Triggered: {item.triggerReasons.join(', ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="mb-3 text-sm font-semibold text-slate-200">Ad Reward Summary</div>
          {adRewardSummary.length === 0 ? (
            <div className="text-sm text-slate-400">No ad rewards recorded yet.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {adRewardSummary.map((row: any) => (
                <div key={row._id} className="flex items-center justify-between rounded-xl border border-slate-700 px-3 py-2">
                  <div>
                    <div className="font-semibold text-slate-200">{row._id}</div>
                    <div className="text-xs text-slate-500">Last reward {row.latestRewardAt ? new Date(row.latestRewardAt).toLocaleString() : 'n/a'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-300">${Number(row.totalRewardsUSD || 0).toFixed(2)}</div>
                    <div className="text-xs text-slate-500">{row.count} rewards</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
