'use client';

import React, { useMemo, useState } from 'react';
import api from '../../../lib/api';
import { Download, Search, ChevronRight, TreePine, Users, Wallet, Link as LinkIcon } from 'lucide-react';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';

type UserSummary = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  userId?: string;
  referralCode?: string;
  country?: string;
  activationStatus?: boolean;
  role?: string;
  createdAt?: string;
};

type TreeNode = {
  user: UserSummary;
  level: number;
  branchEarningsUSD: number;
  directCount: number;
  activeDirectCount: number;
  descendantCount: number;
  activeDescendantCount: number;
  children: TreeNode[];
};

function flattenTree(nodes: TreeNode[], rows: Array<Record<string, any>> = [], parentId: string | null = null) {
  for (const node of nodes) {
    rows.push({
      level: node.level,
      userId: node.user.userId || '',
      name: node.user.name,
      email: node.user.email || '',
      phone: node.user.phone || '',
      country: node.user.country || '',
      referralCode: node.user.referralCode || '',
      activationStatus: node.user.activationStatus ? 'activated' : 'pending',
      directCount: node.directCount,
      activeDirectCount: node.activeDirectCount,
      descendantCount: node.descendantCount,
      activeDescendantCount: node.activeDescendantCount,
      branchEarningsUSD: node.branchEarningsUSD.toFixed(2),
      parentId: parentId || '',
    });
    flattenTree(node.children || [], rows, node.user._id);
  }
  return rows;
}

function TreeRow({ node }: { node: TreeNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
              Level {node.level}
            </div>
            <div className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${node.user.activationStatus ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-400/20 bg-amber-500/10 text-amber-300'}`}>
              {node.user.activationStatus ? 'Activated' : 'Pending'}
            </div>
          </div>
          <div className="text-lg font-black text-white">{node.user.name}</div>
          <div className="text-xs text-slate-500">
            {node.user.email || node.user.phone || 'No contact'} · {node.user.country || 'n/a'} · {node.user.userId || 'n/a'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-xs">
          <div className="rounded-xl border border-white/8 bg-slate-950/70 px-3 py-2">
            <div className="text-slate-500">Direct</div>
            <div className="mt-1 text-sm font-bold text-white">{node.directCount}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/70 px-3 py-2">
            <div className="text-slate-500">Branch USD</div>
            <div className="mt-1 text-sm font-bold text-emerald-300">${node.branchEarningsUSD.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {node.children?.length > 0 && (
        <div className="mt-4 space-y-3 border-l border-white/8 pl-4">
          {node.children.map((child) => (
            <TreeRow key={child.user._id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReferralsPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [uplines, setUplines] = useState<UserSummary[]>([]);
  const [wallet, setWallet] = useState<{ referralEarnings: number; pendingBalance: number; totalEarned: number } | null>(null);

  const loadSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/referrals/search', { params: { query: query.trim() } });
      setSearchResults(response.data?.users || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const loadTree = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/admin/referrals/tree/${userId}`);
      setSelectedUser(response.data?.user || null);
      setTree(response.data?.tree || []);
      setUplines(response.data?.uplines || []);
      setWallet(response.data?.wallet || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load referral tree');
    } finally {
      setLoading(false);
    }
  };

  const csvRows = useMemo(() => flattenTree(tree), [tree]);

  const exportCSV = () => {
    if (csvRows.length === 0) return;
    const headers = Object.keys(csvRows[0]);
    const csv = [headers, ...csvRows.map((row) => headers.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`))]
      .map((row) => row.join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referral-tree-${selectedUser?.userId || 'export'}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Referral Tree Viewer" description="Search any user, inspect who they referred, and see branch earnings up to three levels deep." />

      {error && <ErrorBanner message={error} />}

      <section className="card-surface soft-up rounded-[24px] p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/8 bg-white/5 px-4 py-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadSearch(); }}
              placeholder="Search by name, email, phone, userId, or referral code"
              className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
            />
          </div>
          <button onClick={loadSearch} className="rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500">
            Search
          </button>
          <button onClick={exportCSV} disabled={csvRows.length === 0} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            <Download className="mr-2 inline h-4 w-4" />
            Export CSV
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {searchResults.map((user) => (
              <button
                key={user._id}
                onClick={() => loadTree(user._id)}
                className="rounded-2xl border border-white/8 bg-slate-950/70 p-4 text-left transition hover:border-cyan-400/30 hover:bg-cyan-500/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-white">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.email || user.phone || 'No contact'}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                  <span className="rounded-full border border-white/8 px-2 py-1">{user.userId || 'n/a'}</span>
                  <span className="rounded-full border border-white/8 px-2 py-1">{user.country || 'n/a'}</span>
                  <span className="rounded-full border border-white/8 px-2 py-1">{user.activationStatus ? 'active' : 'pending'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {loading ? (
        <div className="card-surface soft-up rounded-[24px] p-8"><LoadingSpinner /></div>
      ) : selectedUser ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label="Referral Code" value={selectedUser.referralCode || '-'} sub={selectedUser.name} />
            <StatCard label="Total Earned" value={`$${Number(wallet?.referralEarnings || 0).toFixed(2)}`} sub="Referral earnings" />
            <StatCard label="Pending" value={`$${Number(wallet?.pendingBalance || 0).toFixed(2)}`} sub="Pending referral balance" />
            <StatCard label="Direct Referrals" value={String(tree[0]?.directCount || 0)} sub="First level only" />
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="card-surface soft-up rounded-[24px] p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <LinkIcon className="h-4 w-4 text-cyan-300" />
                Upline chain
              </div>
              {uplines.length === 0 ? (
                <div className="text-sm text-slate-500">No upline found.</div>
              ) : (
                <div className="space-y-2">
                  {uplines.map((u, index) => (
                    <div key={u._id} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <div className="text-xs text-slate-500">Level {index + 1}</div>
                      <div className="text-sm font-semibold text-white">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email || u.phone || 'No contact'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-surface soft-up rounded-[24px] p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <TreePine className="h-4 w-4 text-emerald-300" />
                3-level tree
              </div>
              <div className="rounded-2xl border border-white/8 bg-slate-950/70 p-4 text-sm text-slate-400">
                Branch earnings are calculated from direct referral rewards beneath each node. Use the tree to spot fake-account clusters and shared branches.
              </div>
              {tree.length === 0 ? (
                <div className="text-sm text-slate-500">No referrals found for this user.</div>
              ) : (
                tree.map((node) => <TreeRow key={node.user._id} node={node} />)
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="card-surface soft-up rounded-[24px] p-8 text-sm text-slate-500">
          Search for a user to inspect their referral network.
        </div>
      )}
    </div>
  );
}
