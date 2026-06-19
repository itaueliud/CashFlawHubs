'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { ConfirmModal, ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';
import { RefreshCcw, SlidersHorizontal, Plus, Trash2 } from 'lucide-react';

const emptyRule = {
  name: '',
  country: 'ALL',
  provider: '',
  minAmountUSD: '',
  maxAmountUSD: '',
  priority: '0',
  active: true,
  notes: '',
};

export default function RulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyRule);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ledger/rules');
      setRules(res.data?.rules || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load payout rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        minAmountUSD: form.minAmountUSD === '' ? 0 : Number(form.minAmountUSD),
        maxAmountUSD: form.maxAmountUSD === '' ? null : Number(form.maxAmountUSD),
        priority: Number(form.priority || 0),
        active: Boolean(form.active),
      };
      if (editingId) {
        await api.put(`/ledger/rules/${editingId}`, payload);
      } else {
        await api.post('/ledger/rules', payload);
      }
      setForm(emptyRule);
      setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save rule');
    } finally {
      setBusy(false);
    }
  };

  const editRule = (rule: any) => {
    setEditingId(rule._id);
    setForm({
      name: rule.name || '',
      country: rule.country || 'ALL',
      provider: rule.provider || '',
      minAmountUSD: String(rule.minAmountUSD ?? ''),
      maxAmountUSD: rule.maxAmountUSD === null || rule.maxAmountUSD === undefined ? '' : String(rule.maxAmountUSD),
      priority: String(rule.priority ?? 0),
      active: Boolean(rule.active),
      notes: rule.notes || '',
    });
  };

  const removeRule = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/ledger/rules/${deleting._id}`);
      setDeleting(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete rule');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payout Rules"
        description="Define how the ledger prioritizes providers, countries, and payout thresholds."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Rules" value={String(rules.length)} sub="Configured routing rules" />
        <StatCard label="Active" value={String(rules.filter((rule) => rule.active).length)} sub="Enabled rules" />
        <StatCard label="Countries" value={String(new Set(rules.map((rule) => rule.country || 'ALL')).size)} sub="Country coverage" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4 text-cyan-300" />
            {editingId ? 'Edit rule' : 'Create rule'}
          </div>
          <div className="mt-4 grid gap-3">
            {[
              ['name', 'Rule name'],
              ['country', 'Country'],
              ['provider', 'Provider'],
              ['minAmountUSD', 'Min USD'],
              ['maxAmountUSD', 'Max USD'],
              ['priority', 'Priority'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
                <input
                  value={(form as any)[key]}
                  onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
              </label>
            ))}
            <label className="block">
              <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">Notes</div>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((current) => ({ ...current, active: e.target.checked }))}
              />
              Rule active
            </label>
            <div className="flex gap-2">
              <button onClick={save} disabled={busy || !form.name || !form.provider} className="ledger-button">
                <SlidersHorizontal className="h-4 w-4" />
                {busy ? 'Saving...' : editingId ? 'Update rule' : 'Save rule'}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyRule);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <RefreshCcw className="h-4 w-4 text-cyan-300" />
              Rule list
            </div>
            <button onClick={load} className="ledger-button">
              Refresh
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {rules.length ? rules.map((rule) => (
              <div key={rule._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{rule.name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {rule.country || 'ALL'} · {rule.provider}
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      Priority {rule.priority || 0} · ${Number(rule.minAmountUSD || 0).toFixed(2)} - {rule.maxAmountUSD == null ? '∞' : `$${Number(rule.maxAmountUSD).toFixed(2)}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editRule(rule)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                      Edit
                    </button>
                    <button onClick={() => setDeleting(rule)} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      <Trash2 className="inline h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No payout rules yet.</div>
            )}
          </div>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(deleting)}
        title="Delete rule"
        description={`Delete ${deleting?.name || 'the selected payout rule'}?`}
        confirmLabel={busy ? 'Deleting...' : 'Delete'}
        danger
        onClose={() => !busy && setDeleting(null)}
        onConfirm={removeRule}
      />
    </div>
  );
}
