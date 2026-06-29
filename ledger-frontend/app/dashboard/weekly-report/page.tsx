'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';
import { CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react';

const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;

function secsToNextFriday(): number {
  const now = new Date();
  const dow = now.getUTCDay();
  const daysUntil = dow < 5 ? 5 - dow : 7 - dow + 5;
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntil,
  ));
  return Math.floor((next.getTime() - now.getTime()) / 1000);
}

function WeekCountdown() {
  const TOTAL = 7 * 24 * 3600;
  const [remaining, setRemaining] = useState(secsToNextFriday());

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(secsToNextFriday()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pct = Math.max(0, Math.min(100, (1 - remaining / TOTAL) * 100));
  const hrs = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);

  return (
    <div className="px-3 pb-2 pt-1">
      <div className="mb-1 flex items-center justify-between text-[0.65rem] text-slate-500">
        <span>Resets next Friday</span>
        <span className="tabular-nums">{hrs}h {mins}m left</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-400 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function WeeklyReportPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshGuardRef = useRef(false);

  const load = async (offset = weekOffset) => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, withdrawalsRes] = await Promise.all([
        api.get(`/ledger/payouts/weekly-summary?weekOffset=${offset}`),
        api.get('/ledger/payouts/weekly-withdrawals'),
      ]);
      setSummary(summaryRes.data || null);
      setWithdrawals(withdrawalsRes.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load weekly report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(weekOffset);
  }, [weekOffset]);

  useEffect(() => {
    if (weekOffset !== 0) {
      refreshGuardRef.current = false;
      return;
    }

    const tick = () => {
      const remaining = secsToNextFriday();
      if (remaining <= 3 && !refreshGuardRef.current) {
        refreshGuardRef.current = true;
        void load(0);
      }
      if (remaining > 30) {
        refreshGuardRef.current = false;
      }
    };

    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [weekOffset]);

  const countryRows = useMemo(() => summary?.countryBreakdown || [], [summary]);
  const withdrawalRows = useMemo(() => withdrawals?.withdrawals || [], [withdrawals]);

  const exportCsv = () => {
    const rows = [
      ['User', 'Country', 'Amount USD', 'Processed At', 'Phone'],
      ...withdrawalRows.map((row: any) => [
        row.name || 'Unknown',
        row.country || 'Unknown',
        Number(row.amountUSD || 0).toFixed(2),
        row.processedAt ? new Date(row.processedAt).toISOString() : '',
        row.phone || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-offset-${weekOffset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Report"
        description="Review the Friday-to-Thursday ledger week, compare payout categories, and export the withdrawal list."
      />

      {error && <ErrorBanner message={error} />}

      <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">{summary?.weekLabel || 'Week summary'}</div>
            <p className="text-xs text-slate-400">Use the controls to move across weekly snapshots.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((current) => current + 1)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekOffset((current) => Math.max(current - 1, 0))}
              disabled={weekOffset === 0}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={exportCsv} className="ledger-button">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
        <WeekCountdown />
        <div className="mt-2 text-center text-[0.62rem] text-slate-600">Week panel resets every Friday · auto-refresh enabled</div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Payouts USD" value={money(summary?.summary?.totalPayoutUSD)} sub={`${Number(summary?.summary?.usersPayoutCount || 0)} users paid`} />
        <StatCard label="Activation Fees" value={money(summary?.summary?.totalActivationFeesUSD)} sub={`${Number(summary?.summary?.activationsCount || 0)} activations`} />
        <StatCard label="Referral Comm" value={money(summary?.summary?.totalReferralCommUSD)} sub={`${Number(summary?.summary?.referralCommCount || 0)} transactions`} />
        <StatCard label="Carry-over" value={money(summary?.summary?.totalCarryOverUSD)} sub="Rolled forward balance" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarDays className="h-4 w-4 text-cyan-300" />
            Country breakdown
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-[#050b17]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.22em] text-slate-500">
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Total Paid</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {countryRows.length ? countryRows.map((row: any) => (
                  <tr key={row.country || row._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-200">{row.country || row._id || 'Unknown'}</td>
                    <td className="px-4 py-3 font-mono text-slate-200">{money(row.totalPaid)}</td>
                    <td className="px-4 py-3 text-slate-400">{row.userCount || 0}</td>
                    <td className="px-4 py-3 text-slate-400">{row.txCount || 0}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No country data found for this week.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="text-sm font-semibold text-white">Withdrawal list</div>
          <p className="mt-1 text-xs text-slate-400">{withdrawals?.weekLabel || 'Weekly withdrawal snapshot'}</p>
          <div className="mt-4 space-y-3">
            {withdrawalRows.length ? withdrawalRows.map((row: any) => (
              <div key={`${row.userId}-${String(row.processedAt)}`} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{row.name || 'Unknown user'}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.country || 'Unknown'} · {row.phone || 'No phone'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-cyan-300">{money(row.amountUSD)}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.processedAt ? new Date(row.processedAt).toLocaleString() : 'n/a'}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No withdrawals found for the current week.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

