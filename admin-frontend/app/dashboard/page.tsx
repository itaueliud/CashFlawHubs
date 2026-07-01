'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api';
import { ArrowRight, Shield, UsersRound, Activity, ScrollText, Flag, WandSparkles } from 'lucide-react';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />;
}

function MetricCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="card-surface soft-up rounded-2xl p-5 transition-all duration-200" style={{ borderTopColor: accent }}>
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-black tabular-nums" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, subtitle, children, id }: { title: string; subtitle: string; children: React.ReactNode; id: string }) {
  return (
    <section id={id} className="card-surface soft-up rounded-[24px] p-5 lg:p-6">
      <div className="mb-4 pb-4">
        <h2 className="text-lg font-black text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function KeyValueTable({ title, rows }: { title: string; rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="rounded-2xl bg-[#050b17] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody className="">
            {rows.map(([label, value]) => (
              <tr key={label} className="hover:bg-white/[0.03]">
                <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</th>
                <td className="px-4 py-3 text-slate-200">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [providerHealth, setProviderHealth] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([api.get('/admin/stats'), api.get('/admin/provider-health')]).then(([statsRes, healthRes]) => {
      if (!mounted) return;
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data?.stats || statsRes.value.data || null);
      if (healthRes.status === 'fulfilled') setProviderHealth(healthRes.value.data?.providerHealth || healthRes.value.data?.health || healthRes.value.data || null);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      { label: 'Users', value: String(stats?.usersCount ?? stats?.totalUsers ?? stats?.users ?? 0), accent: '#06b6d4', sub: 'Registered accounts' },
      { label: 'Active', value: String(stats?.activeUsers ?? stats?.active ?? 0), accent: '#10b981', sub: 'Currently active' },
      { label: 'Pending KYC', value: String(stats?.pendingKyc ?? stats?.kycPending ?? 0), accent: '#f59e0b', sub: 'Awaiting review' },
      { label: 'Transactions', value: String(stats?.totalTransactions ?? stats?.transactions ?? stats?.transactionCount ?? 0), accent: '#8b5cf6', sub: 'Ledger events' },
    ],
    [stats]
  );

  const providerRows = useMemo(
    () =>
      Object.entries(providerHealth || {}).slice(0, 8).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : String(value)] as [string, React.ReactNode]),
    [providerHealth]
  );

  const snapshotRows = useMemo(
    () =>
      Object.entries({
        totalUsers: stats?.totalUsers ?? stats?.usersCount ?? 0,
        activeUsers: stats?.activeUsers ?? stats?.active ?? 0,
        pendingKyc: stats?.pendingKyc ?? stats?.kycPending ?? 0,
        totalTransactions: stats?.totalTransactions ?? stats?.transactionCount ?? 0,
      }).map(([key, value]) => [key, String(value)] as [string, React.ReactNode]),
    [stats]
  );

  const loading = !stats && !providerHealth;

  return (
    <div className="space-y-6">
      <section id="overview" className="card-surface soft-up rounded-[28px] bg-gradient-to-br from-[#0f1730] via-[#07101e] to-[#050b17] p-6 lg:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-300">
          <WandSparkles className="h-3.5 w-3.5" />
          Staff Controls
        </div>
        <h1 className="mt-4 text-4xl font-black text-white sm:text-5xl">Admin Management</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Create and manage admin accounts, review users, inspect platform health, and keep moderation and support flows in one place.
        </p>
      </section>

      {loading ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card-surface rounded-2xl p-5">
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="mt-3 h-3 w-28" />
            </div>
          ))}
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <MetricCard key={card.label} label={card.label} value={card.value} accent={card.accent} sub={card.sub} />
          ))}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard id="users" title="Live Snapshot" subtitle="Real counts coming straight from the backend.">
          <KeyValueTable title="Admin stats summary" rows={snapshotRows} />
        </SectionCard>

        <SectionCard id="admins" title="Quick Actions" subtitle="Surface the controls operators reach for most often.">
          <div className="grid gap-3">
          {[
              { label: 'Create admin account', href: '/dashboard/admins', icon: Shield },
              { label: 'Review users', href: '/dashboard/users', icon: UsersRound },
              { label: 'Referral tree', href: '/dashboard/referrals', icon: UsersRound },
              { label: 'Fraud center', href: '/dashboard/fraud', icon: Flag },
              { label: 'Broadcasts', href: '/dashboard/notifications', icon: Activity },
              { label: 'Audit logs', href: '/dashboard/audit', icon: ScrollText },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-500/10 hover:text-white"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-cyan-300 transition group-hover:bg-cyan-500/15">
                      <Icon className="h-4 w-4" />
                    </span>
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
                </Link>
              );
            })}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SectionCard id="moderation" title="Moderation & Support" subtitle="Keep the operational queues visible, even if they are empty in local dev.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Moderation', 'Tasks, jobs, challenges, and gigs review'],
              ['Support', 'Tickets, priorities, assignments, and internal notes'],
              ['Audit', 'Sensitive admin actions only'],
              ['Config', 'Feature flags and system toggles'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl bg-white/5 p-4">
                <div className="text-sm font-bold text-white">{title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard id="provider-health" title="Provider Health" subtitle="A compact view of provider readiness and backend health.">
          <div className="overflow-hidden rounded-2xl bg-[#050b17]">
            {providerRows.length ? (
              <KeyValueTable title="Provider payload" rows={providerRows} />
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">No provider payload returned yet.</div>
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <SectionCard id="support" title="Operational Checklist" subtitle="The local portal should still feel ready for the live workload.">
          <div className="space-y-3">
            {[
              'Admin account creation and password resets',
              'User review, KYC, referral, and fraud controls',
              'Broadcasts, support flows, and notification targeting',
              'Audit and provider health entry points',
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard id="audit" title="Audit Surface" subtitle="Preview the fields that should be present when the audit route is wired up.">
          <KeyValueTable
            title="Expected audit dimensions"
            rows={[
              ['module', 'moderation | support | config | reconciliation | fraud'],
              ['actor', 'admin email or id'],
              ['action', 'approve | reject | update | create | delete'],
              ['timestamp', 'ISO date string'],
            ]}
          />
        </SectionCard>
      </section>

      <section id="config" className="card-surface soft-up rounded-[24px] p-5 lg:p-6">
        <div className="mb-4 pb-4">
          <h2 className="text-lg font-black text-white">Configuration</h2>
          <p className="mt-1 text-sm text-slate-400">Feature flags and platform toggles should live here once connected to the backend view.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {['KYC enforcement', 'Payout queue', 'Offerwall health', 'Provider monitoring'].map((item) => (
            <div key={item} className="rounded-2xl bg-white/5 p-4">
              <div className="text-sm font-bold text-white">{item}</div>
              <div className="mt-1 text-xs text-slate-400">Visible in the live admin portal.</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}



