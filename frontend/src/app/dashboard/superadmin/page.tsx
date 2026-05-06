'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Activity, ArrowRight, Landmark, ShieldCheck, UsersRound } from 'lucide-react';

export default function SuperadminStandalonePage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: () => api.get('/admin/stats').then((response) => response.data),
    enabled: user?.role === 'superadmin',
  });

  if (user?.role !== 'superadmin') {
    return <div className="card text-sm text-slate-400">Superadmin access required.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Superadmin Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Full governance over operations, staff hierarchy, and ledger visibility.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:max-w-lg">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-400">Total users</div>
            <div className="text-2xl font-black text-blue-300">{isLoading ? '...' : data?.stats?.totalUsers ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-400">Active users</div>
            <div className="text-2xl font-black text-white">{isLoading ? '...' : data?.stats?.activeUsers ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/dashboard/admin/ledger" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <Landmark className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Ledger</div>
          <p className="mt-2 text-sm text-slate-400">Review revenue and payout policy.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>
        <Link href="/dashboard/admin/admins" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <ShieldCheck className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Admins</div>
          <p className="mt-2 text-sm text-slate-400">Create and govern admin accounts.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>
        <Link href="/dashboard/admin/provider-health" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <Activity className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Provider Health</div>
          <p className="mt-2 text-sm text-slate-400">Track payment provider readiness.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>
        <div className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5">
          <UsersRound className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Control Scope</div>
          <p className="mt-2 text-sm text-slate-400">Superadmin can manage admins and monitor all platform operations.</p>
        </div>
      </div>
    </div>
  );
}
