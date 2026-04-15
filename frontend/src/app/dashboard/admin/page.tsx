'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Shield, ShieldCheck, Users, Landmark, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function AdminWorkspacePage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((response) => response.data),
    enabled: !!user,
  });

  const role = user?.role || 'admin';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
              <Shield size={12} /> Admin workspace
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">{role === 'superadmin' ? 'Superadmin Ledger' : 'Admin Console'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Manage users, review the ledger, and keep operational control over the platform.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-slate-400">Total users</div>
              <div className="text-2xl font-black text-blue-300">{isLoading ? '…' : data?.stats?.totalUsers ?? '—'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-slate-400">Active users</div>
              <div className="text-2xl font-black text-white">{isLoading ? '…' : data?.stats?.activeUsers ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/admin/ledger" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <Landmark className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Ledger</div>
          <p className="mt-2 text-sm text-slate-400">Review revenue, share splits, and payout previews.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>

        <Link href="/dashboard/admin/users" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <Users className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Users</div>
          <p className="mt-2 text-sm text-slate-400">Manage user accounts and assign accounts to admins.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>

        <Link href="/dashboard/admin/admins" className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5 transition hover:-translate-y-1 hover:border-blue-400/30">
          <ShieldCheck className="text-blue-300" />
          <div className="mt-4 text-xl font-bold text-white">Admins</div>
          <p className="mt-2 text-sm text-slate-400">Create admin accounts and manage the superadmin hierarchy.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-300">Open <ArrowRight size={14} /></div>
        </Link>
      </div>
    </div>
  );
}
