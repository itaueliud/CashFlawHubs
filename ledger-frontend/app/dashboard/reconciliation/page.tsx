'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';
import { Scale, RefreshCw, ShieldAlert, UploadCloud, ListChecks } from 'lucide-react';

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;

const parseCsv = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
};

export default function ReconciliationPage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [csvText, setCsvText] = useState('');
  const [source, setSource] = useState('csv-import');
  const [loading, setLoading] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [activeTab, setActiveTab] = useState<'snapshot' | 'import' | 'batches'>('snapshot');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ledger/payouts/reconciliation/snapshot');
      setSnapshot(res.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async () => {
    setLoadingBatches(true);
    try {
      const res = await api.get('/admin-advanced/reconciliation/batches');
      const nextBatches = res.data?.batches || [];
      setBatches(nextBatches);
      setSelectedBatch((current) => current ? nextBatches.find((batch: any) => batch._id === current._id) || current : nextBatches[0] || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load reconciliation batches');
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    load();
    loadBatches();
  }, []);

  const parsedRows = useMemo(() => parseCsv(csvText), [csvText]);

  const runImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const entries = parsedRows.map((row) => ({
        reference: row.reference || row.Reference || row.transaction_id || row.transactionId || '',
        provider: row.provider || row.Provider || '',
        amountUSD: Number(row.amountUSD || row.amount || row.AmountUSD || 0),
        status: row.status || row.Status || '',
      })).filter((entry) => entry.reference);

      const res = await api.post('/admin-advanced/reconciliation/import', {
        source,
        entries,
      });
      setImportResult(res.data?.batch || null);
      setCsvText('');
      await loadBatches();
      await load();
      setActiveTab('batches');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to import reconciliation CSV');
    } finally {
      setBusy(false);
    }
  };

  const selectBatch = async (id: string) => {
    try {
      const res = await api.get(`/admin-advanced/reconciliation/batches/${id}`);
      setSelectedBatch(res.data?.batch || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load batch details');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Compare payout totals, import CSV settlement files, and inspect imported batches in one place."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Total" value={money(snapshot?.pendingTotal)} sub="All pending balances" />
        <StatCard label="Carry-over Total" value={money(snapshot?.carryOverTotal)} sub="Deferred to next cycle" />
        <StatCard label="Paid This Cycle" value={money(snapshot?.paidThisCycle)} sub="Successful payouts" />
        <StatCard label="Variance" value={money(snapshot?.variance)} sub="Pending minus paid" />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div>
          <div className="text-sm font-semibold text-white">Snapshot refresh</div>
          <p className="text-xs text-slate-400">This is a live backend summary of what should balance against payout activity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['snapshot', 'import', 'batches'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl border px-4 py-2 text-sm transition ${
                activeTab === tab
                  ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {tab === 'snapshot' ? 'Snapshot' : tab === 'import' ? 'CSV Import' : 'Batch History'}
            </button>
          ))}
          <button onClick={load} className="ledger-button">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      {activeTab === 'snapshot' && (
        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Scale className="h-4 w-4 text-cyan-300" />
              Reconciliation guidance
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">If variance is high, compare the payout queue against the transaction log and recent carry-over actions.</div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Use the weekly report to verify whether the current week is posting paid balances as expected.</div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">This page is the first stop before investigating missing or duplicate payout movements.</div>
            </div>
          </div>

          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-amber-300" />
              Live counters
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="ledger-card p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Active users</div>
                <div className="mt-2 text-3xl font-black text-white">{Number(snapshot?.activeUserCount || 0)}</div>
              </div>
              <div className="ledger-card p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Variance</div>
                <div className="mt-2 text-3xl font-black text-cyan-300">{money(snapshot?.variance)}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'import' && (
        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <UploadCloud className="h-4 w-4 text-cyan-300" />
              CSV import
            </div>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">Source label</div>
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">CSV content</div>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={12}
                  placeholder="reference,provider,amountUSD,status"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
              </label>
              <button
                onClick={runImport}
                disabled={busy || parsedRows.length === 0}
                className="ledger-button"
              >
                {busy ? 'Importing...' : 'Import reconciliation CSV'}
              </button>
            </div>
          </div>

          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ListChecks className="h-4 w-4 text-emerald-300" />
              Parsed rows
            </div>
            <div className="mt-4 space-y-3">
              {parsedRows.length ? parsedRows.slice(0, 10).map((row, index) => (
                <div key={`${row.reference || index}`} className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
                  <div className="font-semibold text-white">{row.reference || `Row ${index + 1}`}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {row.provider || 'n/a'} · {row.amountUSD || row.amount || '0'} · {row.status || 'unknown'}
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">Paste CSV rows to preview them here.</div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'batches' && (
        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ListChecks className="h-4 w-4 text-cyan-300" />
                Imported batches
              </div>
              <button onClick={loadBatches} className="ledger-button" disabled={loadingBatches}>
                Refresh
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {batches.length ? batches.map((batch) => (
                <button
                  key={batch._id}
                  onClick={() => selectBatch(batch._id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selectedBatch?._id === batch._id
                      ? 'border-cyan-500/25 bg-cyan-500/10'
                      : 'border-white/8 bg-white/5 hover:border-white/15 hover:bg-white/8'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{batch.source || 'manual'}</div>
                      <div className="mt-1 text-xs text-slate-400">{new Date(batch.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-cyan-300">{batch.summary?.matched || 0}/{batch.summary?.total || 0}</div>
                  </div>
                </button>
              )) : (
                <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No reconciliation batches available.</div>
              )}
            </div>
          </div>

          <div className="card-surface soft-up rounded-[24px] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-amber-300" />
              Batch details
            </div>
            {selectedBatch ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Total rows</div>
                    <div className="mt-2 text-2xl font-black text-white">{selectedBatch.summary?.total || 0}</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Matched rows</div>
                    <div className="mt-2 text-2xl font-black text-emerald-300">{selectedBatch.summary?.matched || 0}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {(selectedBatch.entries || []).map((entry: any, index: number) => (
                    <div key={`${entry.reference}-${index}`} className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-white">{entry.reference}</div>
                        <div className="text-cyan-300">{money(entry.amountUSD)}</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {entry.provider || 'n/a'} · {entry.status || 'unknown'} · {entry.matched ? 'matched' : 'unmatched'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">Select a batch to see its entries.</div>
            )}
          </div>
        </section>
      )}

      {importResult && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Import complete. {importResult.summary?.matched || 0} rows matched, {importResult.summary?.unmatched || 0} unmatched.
        </div>
      )}
    </div>
  );
}
