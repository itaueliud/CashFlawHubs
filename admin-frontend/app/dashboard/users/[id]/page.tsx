'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '../../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader } from '../../../../components/ui';
import { ArrowLeft, ShieldCheck, Wallet, ReceiptText } from 'lucide-react';

export default function AdminUserProfilePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get(`/admin/users/${params.id}/ledger`);
        if (!mounted) return;
        setData(res.data);
      } catch (err: any) {
        if (!mounted) return;
        setError(String(err?.response?.data?.message || err.message || 'Failed to load profile'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [params.id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  const user = data?.user;
  const wallet = data?.wallet;
  const transactions = data?.transactions || [];

  if (!user) {
    return <ErrorBanner message="User not found." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="User Profile" description="Review an individual user account and ledger activity." />

      <Link href="/dashboard/users" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Name</div>
          <div className="mt-2 text-xl font-black text-white">{user.name || '-'}</div>
          <div className="mt-1 text-sm text-slate-400">{user.email || '-'}</div>
        </div>
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Phone</div>
          <div className="mt-2 text-xl font-black text-white">{user.phone || '-'}</div>
          <div className="mt-1 text-sm text-slate-400">{user.country || '-'}</div>
        </div>
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Access</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            {user.userAccessType || 'real'}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-slate-400"><Wallet className="h-4 w-4" /> Wallet USD</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">${Number(wallet?.balanceUSD || 0).toFixed(2)}</div>
        </div>
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-slate-400"><ReceiptText className="h-4 w-4" /> Total earned</div>
          <div className="mt-2 text-3xl font-black text-white">${Number(wallet?.totalEarned || 0).toFixed(2)}</div>
        </div>
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</div>
          <div className="mt-2 text-xl font-black text-white">{user.isBanned ? 'Banned' : 'Active'}</div>
        </div>
      </section>

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="mb-4 text-lg font-black text-white">Recent transactions</div>
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.22em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((tx: any) => (
                <tr key={tx._id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-200">{tx.type}</td>
                  <td className="px-4 py-3 text-slate-400">{tx.provider || '-'}</td>
                  <td className="px-4 py-3 text-slate-200">{tx.status}</td>
                  <td className="px-4 py-3 font-semibold text-white">${Number(tx.amountUSD || 0).toFixed(2)}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No transactions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
