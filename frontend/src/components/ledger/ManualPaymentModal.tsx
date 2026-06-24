'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import api from '@/lib/api';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'mtn', label: 'MTN MoMo' },
  { value: 'airtel', label: 'Airtel Money' },
  { value: 'vodacom', label: 'Vodacom' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

const CURRENCIES = [
  { value: 'KES', country: 'KE', label: 'KES - Kenya' },
  { value: 'UGX', country: 'UG', label: 'UGX - Uganda' },
  { value: 'TZS', country: 'TZ', label: 'TZS - Tanzania' },
  { value: 'GHS', country: 'GH', label: 'GHS - Ghana' },
  { value: 'NGN', country: 'NG', label: 'NGN - Nigeria' },
  { value: 'RWF', country: 'RW', label: 'RWF - Rwanda' },
  { value: 'ETB', country: 'ET', label: 'ETB - Ethiopia' },
  { value: 'USD', country: '', label: 'USD - Dollar' },
];

export default function ManualPaymentModal({ onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    userIdentifier: '',
    amountUSD: '',
    amountLocal: '',
    currency: 'KES',
    country: 'KE',
    providerReference: '',
    paymentMethod: 'mpesa',
    note: '',
  });
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/admin/ledger/manual-payment', {
        ...form,
        amountUSD: Number(form.amountUSD),
        amountLocal: Number(form.amountLocal) || Number(form.amountUSD),
      }).then((response) => response.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ledger-overview'] });
      onSuccess();
    },
  });

  const handleCurrencyChange = (value: string) => {
    const match = CURRENCIES.find((entry) => entry.value === value);
    setForm((current) => ({
      ...current,
      currency: value,
      country: match?.country || current.country,
    }));
  };

  const isValid =
    form.userIdentifier.trim() &&
    Number(form.amountUSD) > 0 &&
    form.providerReference.trim() &&
    form.paymentMethod &&
    confirmed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-white/8 bg-[#07101e] p-6 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Record Manual Payment</h2>
            <p className="mt-1 text-xs text-slate-400">
              Use this for payments made outside the system. Creates a full audit trail.
            </p>
          </div>
          <button onClick={onClose} className="press rounded-full p-2 text-slate-400 transition hover:bg-white/5 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {mutation.isSuccess && (
          <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
            <div className="flex items-center gap-3 text-green-300">
              <CheckCircle size={20} />
              <div>
                <div className="font-bold">Payment recorded</div>
                <div className="mt-0.5 text-xs text-green-400">{mutation.data?.message}</div>
                <div className="text-xs text-green-400">New balance: ${Number(mutation.data?.transaction?.newBalance || 0).toFixed(2)}</div>
              </div>
            </div>
            <button onClick={onClose} className="ledger-button press mt-4 w-full rounded-xl bg-green-500/20 py-2 text-sm font-semibold text-green-300 hover:bg-green-500/30">
              Close
            </button>
          </div>
        )}

        {mutation.isError && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{(mutation.error as any)?.response?.data?.message || 'Something went wrong'}</span>
          </div>
        )}

        {!mutation.isSuccess && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">User email or User ID</label>
              <input type="text" placeholder="user@email.com or CFH-XXXX" value={form.userIdentifier} onChange={(event) => setForm((current) => ({ ...current, userIdentifier: event.target.value }))} className="ledger-input" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Amount (USD)</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" value={form.amountUSD} onChange={(event) => setForm((current) => ({ ...current, amountUSD: event.target.value }))} className="ledger-input" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Amount (Local)</label>
                <input type="number" placeholder="e.g. 1300" min="0" value={form.amountLocal} onChange={(event) => setForm((current) => ({ ...current, amountLocal: event.target.value }))} className="ledger-input" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Currency</label>
                <select value={form.currency} onChange={(event) => handleCurrencyChange(event.target.value)} className="ledger-input">
                  {CURRENCIES.map((currency) => (
                    <option key={currency.value} value={currency.value}>{currency.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Payment Method</label>
                <select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="ledger-input">
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Payment Reference</label>
              <input type="text" placeholder="e.g. QKA1B2C3D4 (M-Pesa code)" value={form.providerReference} onChange={(event) => setForm((current) => ({ ...current, providerReference: event.target.value.trim() }))} className="ledger-input" />
              <p className="mt-1 text-xs text-slate-500">Must be unique - duplicate references are rejected.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Note (optional)</label>
              <textarea rows={2} placeholder="Reason for manual payment..." value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className="ledger-input min-h-[88px] resize-none" />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/10 p-3">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-amber-400" />
              <span className="text-xs text-amber-300">
                I confirm this payment was received and the reference code is correct.
                This action is logged with my account and cannot be undone.
              </span>
            </label>

            <button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending} className="ledger-button press btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40">
              {mutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Recording payment...
                </span>
              ) : (
                'Record Payment'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
