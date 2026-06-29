'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { PageHeader, LoadingSpinner, ErrorBanner, StatCard, Skeleton } from '../../components/ui';
import { ArrowRight, Wallet, ClipboardList, ShieldAlert, RefreshCcw, Users, CircleDot } from 'lucide-react';

function SmallCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="card-surface soft-up rounded-2xl p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-400">{sub}</div>}
    </div>
  );
}

function SkeletonCard() {
  return <div className="rounded-2xl border border-white/8 bg-white/5 p-4"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-8 w-32" /><Skeleton className="mt-2 h-4 w-28" /></div>;
}

export default function LedgerOverviewPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [bulkPreview, setBulkPreview] = useState<any>(null);
  const [pendingActivations, setPendingActivations] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [dashRes, previewRes, pendingRes, weeklyRes] = await Promise.all([
        api.get('/ledger/dashboard?range=30d'),
        api.get('/ledger/payouts/bulk-preview'),
        api.get('/ledger/activations/pending'),
        api.get('/ledger/payouts/weekly-summary?weekOffset=0'),
      ]);

      setDashboard(dashRes.data?.ledger || null);
      setBulkPreview(previewRes.data || null);
      setPendingActivations(pendingRes.data?.pendingUsers || []);
      setWeekly(weeklyRes.data || null);
      setLastSyncedAt(new Date());
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load ledger overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const quickLinks = useMemo(
    () => [
      { href: '/dashboard/payout-control', label: 'Payout Control', note: 'Review balances and process payouts' },
      { href: '/dashboard/weekly-report', label: 'Weekly Report', note: 'Inspect this week vs previous weeks' },
      { href: '/dashboard/payment-rails', label: 'Payment Rails', note: 'Review routing and provider coverage' },
      { href: '/dashboard/batch-history', label: 'Batch History', note: 'Inspect previous payout batches' },
      { href: '/dashboard/manual-payout', label: 'Manual Payout', note: 'Record one-off payouts safely' },
      { href: '/dashboard/rules', label: 'Payout Rules', note: 'Tune provider and country priorities' },
      { href: '/dashboard/activations', label: 'Activations', note: 'Clear pending activation queue' },
      { href: '/dashboard/carryover', label: 'Carry-Over', note: 'Apply or write off carry-over balances' },
      { href: '/dashboard/transactions', label: 'Transactions', note: 'Ledger logs and balance changes' },
      { href: '/dashboard/reconciliation', label: 'Reconciliation', note: 'Compare pending vs paid' },
      { href: '/dashboard/profile', label: 'Profile', note: '2FA and operator profile' },
    ],
    []
  );

  const cards = useMemo(
    () => [
      { label: 'Revenue USD', value: `$${Number(dashboard?.totalUSD || 0).toFixed(2)}`, sub: '30-day total', accent: 'emerald' as const },
      { label: 'Transactions', value: String(dashboard?.count || 0), sub: 'Revenue events', accent: 'cyan' as const },
      { label: 'Pending Payouts', value: `$${Number(bulkPreview?.totalUSD || 0).toFixed(2)}`, sub: `${Number(bulkPreview?.userCount || 0)} users await pay`, accent: 'amber' as const },
      { label: 'Pending Activations', value: String(pendingActivations.length), sub: 'Users awaiting activation', accent: 'violet' as const },
    ],
    [dashboard, bulkPreview, pendingActivations]
  );

  if (loading && !dashboard) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Ledger Overview"
          description="A routed dashboard for payouts, carry-over, transactions, reconciliation, and operator profile management."
        />
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </section>
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="card-surface soft-up rounded-[24px] p-5">
            <LoadingSpinner />
          </div>
          <div className="card-surface soft-up rounded-[24px] p-5">
            <LoadingSpinner />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ledger Overview"
        description="A routed dashboard for payouts, carry-over, transactions, reconciliation, and operator profile management."
      />

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} accent={card.accent} sub={card.sub} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                This week
              </div>
              <div className="text-xs text-slate-400">{weekly?.weekLabel || 'Loading weekly summary'}</div>
            </div>
            <div className="flex items-center gap-2">
              {lastSyncedAt && <span className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-500">Synced {lastSyncedAt.toLocaleTimeString()}</span>}
              <button onClick={() => void load()} className="ledger-button">
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SmallCard title="Paid out" value={`$${Number(weekly?.summary?.totalPayoutUSD || 0).toFixed(2)}`} sub="Payouts processed" />
            <SmallCard title="Activation fees" value={`$${Number(weekly?.summary?.totalActivationFeesUSD || 0).toFixed(2)}`} sub="Activation charges" />
            <SmallCard title="Referral commissions" value={`$${Number(weekly?.summary?.totalReferralCommUSD || 0).toFixed(2)}`} sub="Referral rewards" />
            <SmallCard title="Carry-over" value={`$${Number(weekly?.summary?.totalCarryOverUSD || 0).toFixed(2)}`} sub="Balances rolled over" />
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldAlert className="h-4 w-4 text-cyan-300" />
            Operational notes
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Use Payout Control for individual and bulk payout processing.</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Use Reconciliation to compare pending balance totals against paid output.</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Transactions shows the ledger log for manual adjustments and payouts.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Users className="h-4 w-4 text-cyan-300" />
            Quick links
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} className="group rounded-2xl border border-white/8 bg-white/5 p-4 transition hover:border-cyan-400/30 hover:bg-cyan-500/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.note}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Wallet className="h-4 w-4 text-emerald-300" />
            Payout queue preview
          </div>
          <div className="mt-4 text-sm text-slate-300">
            {Number(bulkPreview?.userCount || 0)} users with pending payouts totaling ${Number(bulkPreview?.totalUSD || 0).toFixed(2)}.
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <ClipboardList className="h-4 w-4 text-cyan-300" />
            Weekly payout report and reconciliation are available in their own routes.
          </div>
        </div>
      </section>
    </div>
  );
}

