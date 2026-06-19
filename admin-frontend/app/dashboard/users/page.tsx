'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { Search, ChevronLeft, ChevronRight, MoreVertical, Ban, CheckCircle, Eye, Download, ToggleLeft, ToggleRight } from 'lucide-react';

interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  role?: string;
  activationStatus?: boolean;
  isBanned?: boolean;
  userId?: string;
  userAccessType?: string;
  createdAt?: string;
  managedBy?: string;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
}

function UserStatusBadge({ user }: { user: User }) {
  if (user.isBanned) {
    return <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300">Banned</span>;
  }
  if (!user.activationStatus) {
    return <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-amber-500/20 text-amber-300">Inactive</span>;
  }
  return <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-300">Active</span>;
}

function AccessTypeBadge({ user }: { user: User }) {
  const isTest = String(user.userAccessType || 'real') === 'test';
  return (
    <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${isTest ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
      {isTest ? 'Test' : 'Real'}
    </span>
  );
}

function UserActionsMenu({
  user,
  onRefresh,
  open,
  onToggle,
}: {
  user: User;
  onRefresh: () => void;
  open: boolean;
  onToggle: (userId: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBan = async () => {
    if (!confirm(`Ban ${user.name}?`)) return;
    setLoading(true);
    try {
      await api.put(`/admin/users/${user._id}/ban`, { reason: 'Banned by admin' });
      onToggle(null);
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to ban user');
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async () => {
    setLoading(true);
    try {
      await api.put(`/admin/users/${user._id}/unban`);
      onToggle(null);
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to unban user');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccessType = async () => {
    const nextType = String(user.userAccessType || 'real') === 'test' ? 'real' : 'test';
    if (!confirm(`Mark ${user.name} as a ${nextType} user?`)) return;
    setLoading(true);
    try {
      await api.put(`/admin/users/${user._id}/access-type`, { userAccessType: nextType });
      onToggle(null);
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update access type');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => onToggle(open ? null : user._id)}
        className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-white/10 bg-slate-900 shadow-lg z-10">
          {error && <div className="border-b border-white/10 px-4 py-2 text-xs text-red-400">{error}</div>}
          <button
            onClick={handleBan}
            disabled={loading || user.isBanned}
            className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-50 flex items-center gap-2"
          >
            <Ban className="h-4 w-4" /> Ban User
          </button>
          <button
            onClick={handleUnban}
            disabled={loading || !user.isBanned}
            className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" /> Unban User
          </button>
          <button
            onClick={handleToggleAccessType}
            disabled={loading}
            className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-50 flex items-center gap-2"
          >
            {String(user.userAccessType || 'real') === 'test' ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            Mark as {String(user.userAccessType || 'real') === 'test' ? 'Real' : 'Test'}
          </button>
          <a
            href={`/dashboard/users/${user._id}`}
            className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2 block"
          >
            <Eye className="h-4 w-4" /> View Profile
          </a>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    banned: 'all',
    verified: 'all',
    role: 'all'
  });

  const loadUsers = async (page = 1, searchTerm = '', filterBanned = 'all', filterVerified = 'all', filterRole = 'all') => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25 };
      if (searchTerm) params.search = searchTerm;
      if (filterBanned !== 'all') params.banned = filterBanned === 'true';
      if (filterVerified !== 'all') params.verified = filterVerified === 'true';
      if (filterRole !== 'all') params.role = filterRole;

      const response = await api.get('/admin/users', { params });
      setUsers(response.data?.users || []);
      setPagination(response.data?.pagination || { total: 0, page: 1, limit: 25 });
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(1, search, filters.banned, filters.verified, filters.role);
  }, []);

  useEffect(() => {
    setActiveMenuUserId(null);
  }, [users]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    loadUsers(1, e.target.value, filters.banned, filters.verified, filters.role);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    loadUsers(1, search, newFilters.banned, newFilters.verified, newFilters.role);
  };

  const handlePageChange = (newPage: number) => {
    loadUsers(newPage, search, filters.banned, filters.verified, filters.role);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Country', 'Status', 'Access Type', 'Created'];
    const rows = users.map(u => [
      u._id,
      u.name,
      u.email || '',
      u.phone || '',
      u.country || '',
      u.isBanned ? 'Banned' : u.activationStatus ? 'Active' : 'Inactive',
      u.userAccessType || 'real',
      new Date(u.createdAt || '').toLocaleDateString()
    ]);
    const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const maxPage = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="card-surface soft-up rounded-[28px] p-6">
        <h1 className="text-4xl font-black text-white">User Management</h1>
        <p className="mt-2 text-slate-400">Browse, search, filter, and manage user accounts.</p>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Search & Filters */}
      <section className="card-surface soft-up rounded-[24px] p-5 space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/5 px-4 py-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or user ID..."
            value={search}
            onChange={handleSearch}
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={filters.banned}
            onChange={(e) => handleFilterChange('banned', e.target.value)}
            className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white outline-none"
          >
            <option value="all">All Status</option>
            <option value="true">Banned Only</option>
            <option value="false">Not Banned</option>
          </select>

          <select
            value={filters.verified}
            onChange={(e) => handleFilterChange('verified', e.target.value)}
            className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white outline-none"
          >
            <option value="all">All Activation</option>
            <option value="true">Activated</option>
            <option value="false">Not Activated</option>
          </select>

          <select
            value={filters.role}
            onChange={(e) => handleFilterChange('role', e.target.value)}
            className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white outline-none"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={users.length === 0}
          className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </section>

      {/* Users Table */}
      <section className="card-surface soft-up rounded-[24px] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse text-slate-500">Loading users...</div>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-slate-500">No users found matching your filters.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/8 bg-white/5">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Access Type</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-semibold text-white">{user.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{user.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{user.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{user.country || '—'}</td>
                    <td className="px-4 py-3">
                      <UserStatusBadge user={user} />
                    </td>
                    <td className="px-4 py-3">
                      <AccessTypeBadge user={user} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(user.createdAt || '').toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <UserActionsMenu
                        user={user}
                        open={activeMenuUserId === user._id}
                        onToggle={setActiveMenuUserId}
                        onRefresh={() => loadUsers(pagination.page, search, filters.banned, filters.verified, filters.role)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pagination */}
      {maxPage > 1 && (
        <section className="flex items-center justify-between rounded-lg border border-white/8 bg-white/5 p-4">
          <div className="text-sm text-slate-400">
            Showing {users.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="rounded-lg border border-white/8 px-3 py-2 disabled:opacity-50 hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, maxPage) }).map((_, i) => {
                const pageNum = i + Math.max(1, pagination.page - 2);
                if (pageNum > maxPage) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`rounded px-2 py-1 text-sm ${
                      pageNum === pagination.page ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === maxPage}
              className="rounded-lg border border-white/8 px-3 py-2 disabled:opacity-50 hover:bg-white/5"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
