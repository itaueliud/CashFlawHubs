'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Shield, Ban, Unlock, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [resetPasswordMap, setResetPasswordMap] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((response) => response.data),
    enabled: user?.role === 'admin',
  });

  const users = data?.users || [];

  const banUser = async (userId: string) => {
    try {
      await api.put(`/admin/users/${userId}/ban`, { reason: 'Banned by admin panel' });
      toast.success('User banned');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to ban user');
    }
  };

  const unbanUser = async (userId: string) => {
    try {
      await api.put(`/admin/users/${userId}/unban`);
      toast.success('User unblocked');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to unblock user');
    }
  };

  const resetUserPassword = async (userId: string) => {
    const newPassword = resetPasswordMap[userId];
    if (!newPassword || newPassword.length < 8) {
      toast.error('Enter a temporary password (8+ chars)');
      return;
    }
    try {
      await api.put(`/admin/users/${userId}/reset-password`, { newPassword });
      toast.success('Password updated');
      setResetPasswordMap((current) => ({ ...current, [userId]: '' }));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update password');
    }
  };

  if (user?.role !== 'admin') {
    return <div className="card text-sm text-slate-400">Only admins can manage users.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          <Shield size={12} /> User management
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Manage users</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Admins can manage users assigned to their workspace.
        </p>
      </div>

      {isLoading ? (
        <div className="card text-sm text-slate-400">Loading users...</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {users.map((item: any) => (
            <div key={item._id} className="rounded-[1.5rem] border border-blue-500/10 bg-slate-900/90 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-white">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.email} · {item.phone}</div>
                  <div className="mt-2 text-xs text-slate-500">Country {item.country} · Role {item.role} · Activated {item.activationStatus ? 'yes' : 'no'}</div>
                </div>
                <span className={item.isBanned ? 'badge-red' : 'badge-blue'}>{item.isBanned ? 'banned' : 'active'}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-400">
                  Managed by your admin workspace
                </div>
                <button
                  onClick={() => (item.isBanned ? unbanUser(item._id) : banUser(item._id))}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    item.isBanned
                      ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-500/15'
                      : 'border border-red-400/30 bg-red-500/10 text-red-200 hover:border-red-300/50 hover:bg-red-500/15'
                  }`}
                >
                  {item.isBanned ? <Unlock size={14} /> : <Ban size={14} />}
                  {item.isBanned ? 'Unblock user' : 'Block user'}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  className="input max-w-[260px]"
                  type="password"
                  placeholder="Temporary password"
                  value={resetPasswordMap[item._id] || ''}
                  onChange={(e) => setResetPasswordMap((current) => ({ ...current, [item._id]: e.target.value }))}
                />
                <button
                  onClick={() => resetUserPassword(item._id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-semibold text-yellow-200 transition hover:border-yellow-300/50 hover:bg-yellow-500/15"
                >
                  <KeyRound size={14} /> Set password
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
