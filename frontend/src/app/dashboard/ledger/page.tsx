'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ArrowRight, Clock3, Download, FileBarChart2, PlusCircle, Receipt, ShieldCheck } from 'lucide-react';
import ManualPaymentModal from '@/components/ledger/ManualPaymentModal';

export default function LedgerStandalonePage() {
  const { user } = useAuthStore();
  const [showManualPayment, setShowManualPayment] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['ledger-overview'],
    queryFn: () => api.get('/admin/ledger?range=30d').then((response) => response.data),
    enabled: user?.role === 'ledger',
  });

  if (user?.role !== 'ledger') {
    return <div className="card text-sm text-slate-400">Ledger access required.</div>;
  }

  const ledger = data?.ledger || {};
  const pendingPayouts = ledger.payoutQueue || [];
  const pendingPayoutTotal = Number(ledger.payoutQueueTotalUSD || 0);

  return (
    <div className="dashboard-shell animate-fade-in">
      <div className="dashboard-hero p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300">
              <ShieldCheck size={12} /> Ledger control
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Ledger Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Own payouts, financial reports, exports, and admin governance.
            </p>
          </div>
          <button
            onClick={() => setShowManualPayment(true)}
            className="ledger-button press inline-flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:brightness-105"
          >
            <PlusCircle size={16} />
            Record Manual Payment
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm md:max-w-2xl">
          <div className="stat-card stat-card-cyan slide-up">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">30d total USD</div>
            <div className="mt-2 text-2xl font-black text-white">{isLoading ? '...' : `$${Number(ledger.totalUSD || 0).toFixed(2)}`}</div>
            <div className="mt-1 text-xs text-slate-500">Revenue collected in the last 30 days</div>
          </div>
          <div className="stat-card stat-card-green slide-up" style={{ animationDelay: '60ms' }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">30d transactions</div>
            <div className="mt-2 text-2xl font-black text-white">{isLoading ? '...' : Number(ledger.count || 0)}</div>
            <div className="mt-1 text-xs text-slate-500">Ledger entries in scope</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/dashboard/admin/ledger" className="quick-link hover-lift press">
          <ShieldCheck className="text-cyan-300" />
          <div className="mt-4 text-xl font-bold text-white">Payout Control</div>
          <p className="mt-2 text-sm text-slate-400">Execute payouts and manage staff bans.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">Open <ArrowRight size={14} /></div>
        </Link>
        <Link href="/dashboard/ledger/reports" className="quick-link hover-lift press">
          <FileBarChart2 className="text-cyan-300" />
          <div className="mt-4 text-xl font-bold text-white">Reports</div>
          <p className="mt-2 text-sm text-slate-400">View rollups by type and period.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">Open <ArrowRight size={14} /></div>
        </Link>
        <Link href="/dashboard/ledger/transactions" className="quick-link hover-lift press">
          <Receipt className="text-cyan-300" />
          <div className="mt-4 text-xl font-bold text-white">Transactions</div>
          <p className="mt-2 text-sm text-slate-400">Audit individual ledger entries.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">Open <ArrowRight size={14} /></div>
        </Link>
        <Link href="/dashboard/ledger/export" className="quick-link hover-lift press">
          <Download className="text-cyan-300" />
          <div className="mt-4 text-xl font-bold text-white">Export</div>
          <p className="mt-2 text-sm text-slate-400">Download CSV for accounting workflows.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">Open <ArrowRight size={14} /></div>
        </Link>
      </div>

      <div className="card border border-amber-500/15 bg-gradient-to-br from-amber-500/10 to-slate-900/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-amber-300">
              <Clock3 size={14} />
              <span className="text-xs uppercase tracking-[0.18em]">Pending payout queue</span>
            </div>
            <div className="mt-2 text-lg font-bold text-white">
              {pendingPayouts.length} withdrawal and referral payouts waiting for Friday
            </div>
            <p className="mt-1 text-sm text-slate-400">Review the queue before the batch executes.</p>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-right">
            <div className="text-xs text-slate-400">Total USD</div>
            <div className="text-2xl font-black text-amber-300">${pendingPayoutTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {showManualPayment && (
        <ManualPaymentModal
          onClose={() => setShowManualPayment(false)}
          onSuccess={() => {
            setShowManualPayment(false);
          }}
        />
      )}
    </div>
  );
}
