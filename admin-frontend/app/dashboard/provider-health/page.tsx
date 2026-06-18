'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { PageHeader, LoadingSpinner, ErrorBanner } from '../../../components/ui';

export default function ProviderHealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/admin/provider-health')
      .then((res) => {
        if (!mounted) return;
        setHealth(res.data || null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(String(err?.response?.data?.message || err.message || 'Failed to load provider health'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Provider Health" description="View provider readiness and transaction health." />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Stack</div>
          <pre className="mt-3 overflow-auto rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-200">{JSON.stringify(health?.stack || {}, null, 2)}</pre>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Summary</div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div>Generated: {new Date(health?.generatedAt || Date.now()).toLocaleString()}</div>
            <div>Status: {health?.providers?.length ? 'Loaded' : 'Unavailable'}</div>
            <div>Origin: {health?.adsMetrics?.source || 'unknown'}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/5 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.22em] text-slate-500">
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Missing</th>
              <th className="px-4 py-3">Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {(health?.providers || []).map((provider: any) => (
              <tr key={provider.key} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-slate-200">{provider.label || provider.key}</td>
                <td className="px-4 py-3 text-slate-400">{provider.status}</td>
                <td className="px-4 py-3 text-slate-400">{(provider.missingRequired || []).join(', ') || 'None'}</td>
                <td className="px-4 py-3 text-slate-400">{provider.documentationStatus || 'internal'}</td>
              </tr>
            ))}
            {!(health?.providers || []).length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No provider health records available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
