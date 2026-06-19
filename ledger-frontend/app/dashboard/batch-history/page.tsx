'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';
import { RefreshCcw, History, ClipboardList } from 'lucide-react';

export default function BatchHistoryPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ledger/batches');
      setBatches(res.data?.batches || []);
      setSelectedBatch((current) => current ? res.data?.batches?.find((batch: any) => batch._id === current._id) || current : res.data?.batches?.[0] || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load batch history');
    } finally {
      setLoading(false);
    }
  };

  const loadBatch = async (id: string) => {
    try {
      const res = await api.get(`/ledger/batches/${id}`);
      setSelectedBatch(res.data?.batch || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load batch details');
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch History"
        description="Review completed payout batches and inspect the users and references inside each run."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Batches" value={String(batches.length)} sub="Recorded runs" />
        <StatCard label="Selected items" value={String(selectedBatch?.summary?.count || selectedBatch?.items?.length || 0)} sub="Inside the current batch" />
        <StatCard label="Selected total" value={`$${Number(selectedBatch?.summary?.totalUSD || 0).toFixed(2)}`} sub="Batch payout amount" />
      </section>

      <section className="flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <History className="h-4 w-4 text-cyan-300" />
          Recent batches
        </div>
        <button onClick={load} className="ledger-button">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="space-y-3">
            {batches.length ? batches.map((batch) => (
              <button
                key={batch._id}
                onClick={() => loadBatch(batch._id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selectedBatch?._id === batch._id
                    ? 'border-cyan-500/30 bg-cyan-500/10'
                    : 'border-white/8 bg-white/5 hover:border-white/15 hover:bg-white/8'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{batch.batchRef}</div>
                    <div className="mt-1 text-xs text-slate-400">{batch.source || 'manual'} · {new Date(batch.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="text-xs text-cyan-300">${Number(batch.summary?.totalUSD || 0).toFixed(2)}</div>
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No payout batches have been recorded yet.</div>
            )}
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ClipboardList className="h-4 w-4 text-cyan-300" />
            Batch details
          </div>
          {selectedBatch ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Batch ref</div>
                  <div className="mt-1 font-semibold text-white">{selectedBatch.batchRef}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</div>
                  <div className="mt-1 font-semibold text-white">{selectedBatch.status}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Count</div>
                  <div className="mt-1 font-semibold text-white">{selectedBatch.summary?.count || selectedBatch.items?.length || 0}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Total USD</div>
                  <div className="mt-1 font-semibold text-white">${Number(selectedBatch.summary?.totalUSD || 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-2">
                {selectedBatch.items?.map((item: any, index: number) => (
                  <div key={`${item.reference}-${index}`} className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-white">{item.userCode || item.reference || `Item ${index + 1}`}</div>
                      <div className="text-cyan-300">${Number(item.amountUSD || 0).toFixed(2)}</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {item.paymentMethod || 'n/a'} · {item.provider || 'manual'} · {item.status || 'queued'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">Select a batch to inspect its payouts.</div>
          )}
        </div>
      </section>
    </div>
  );
}
