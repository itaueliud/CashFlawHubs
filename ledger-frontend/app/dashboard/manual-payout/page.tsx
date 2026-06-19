'use client';

import React, { useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, PageHeader } from '../../../components/ui';
import { Banknote, Send, Sparkles } from 'lucide-react';

const emptyForm = {
  userIdentifier: '',
  amountUSD: '',
  amountLocal: '',
  currency: 'USD',
  country: 'KE',
  providerReference: '',
  paymentMethod: 'manual_adjustment',
  note: '',
};

export default function ManualPayoutPage() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post('/ledger/batches/manual-payout', {
        ...form,
        amountUSD: Number(form.amountUSD),
        amountLocal: form.amountLocal ? Number(form.amountLocal) : undefined,
      });
      setSuccess(res.data);
      setForm(emptyForm);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to record manual payout');
    } finally {
      setLoading(false);
    }
  };

  const fields: Array<[keyof typeof form, string, string]> = [
    ['userIdentifier', 'User identifier', 'Email or user code'],
    ['amountUSD', 'Amount USD', '10.00'],
    ['amountLocal', 'Amount local', 'Optional local amount'],
    ['currency', 'Currency', 'USD'],
    ['country', 'Country', 'KE'],
    ['providerReference', 'Provider reference', 'Unique reference'],
    ['paymentMethod', 'Payment method', 'manual_adjustment'],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manual Payout"
        description="Record a one-off manual payout, create the payout batch entry, and write the ledger activity."
      />

      {error && <ErrorBanner message={error} />}

      {success && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Manual payout recorded for {success?.transaction?.user?.name || success?.transaction?.user?.email || 'the selected user'}.
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Send className="h-4 w-4 text-cyan-300" />
            Payout form
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {fields.map(([key, label, placeholder]) => (
              <label key={key} className="block md:col-span-1">
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
                <input
                  value={form[key]}
                  onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
              </label>
            ))}
            <label className="block md:col-span-2">
              <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">Note</div>
              <textarea
                value={form.note}
                onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))}
                rows={4}
                placeholder="Add a short note"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </label>
            <button
              onClick={submit}
              disabled={loading || !form.userIdentifier || !form.amountUSD || !form.providerReference || !form.paymentMethod}
              className="ledger-button md:col-span-2"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? 'Recording...' : 'Record manual payout'}
            </button>
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Banknote className="h-4 w-4 text-emerald-300" />
            What happens
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">The user wallet is credited with the amount you enter.</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">A successful transaction and ledger log are written immediately.</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">A payout batch is created so the payment appears in batch history.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
