'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ArrowRight, Download, FileBarChart2, Receipt, ShieldCheck, Clock3 } from 'lucide-react';

export default function LedgerStandalonePage() {
  const { user } = useAuthStore();
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
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Ledger Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Own payouts, financial reports, exports, and admin governance.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:max-w-lg">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-400">30d total USD</div>
            <div className="text-2xl font-black text-blue-300">{isLoading ? '...' : `$${Number(ledger.totalUSD || 0).toFixed(2)}`}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-400">30d transactions</div>
            <div className="text-2xl font-black text-white">{isLoading ? '...' : Number(ledger.count || 0)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/dashboard/admin/ledger" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <ShieldCheck className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Payout Control</div>
          <p className="mt-2 text-sm text-slate-400">Execute payouts and manage staff bans.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>
        <Link href="/dashboard/ledger/reports" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <FileBarChart2 className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Reports</div>
          <p className="mt-2 text-sm text-slate-400">View rollups by type and period.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>
        <Link href="/dashboard/ledger/transactions" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <Receipt className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Transactions</div>
          <p className="mt-2 text-sm text-slate-400">Audit individual ledger entries.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>
        <Link href="/dashboard/ledger/export" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <Download className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Export</div>
          <p className="mt-2 text-sm text-slate-400">Download CSV for accounting workflows.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>
      </div>

      <div className="card border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-amber-300">
              <Clock3 size={14} />
              <span className="text-xs uppercase tracking-[0.18em]">Pending payout queue</span>
            </div>
            <div className="mt-2 text-lg font-bold text-white">
              {pendingPayouts.length} withdrawal and referral payouts waiting for Friday
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Total USD</div>
            <div className="text-2xl font-black text-amber-300">${pendingPayoutTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
