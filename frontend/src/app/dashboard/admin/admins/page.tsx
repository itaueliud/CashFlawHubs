'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ShieldCheck, Plus, Ban, Unlock, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  country: 'KE',
  password: '',
  role: 'admin',
};

export default function AdminsPage() {
  const { user } = useAuthStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [passwordMap, setPasswordMap] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-admins'],
    queryFn: () => api.get('/admin/admins').then((response) => response.data),
    enabled: user?.role === 'superadmin' || user?.role === 'ledger',
  });

  const onChange = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const createAdmin = async () => {
    setSaving(true);
    try {
      await api.post('/admin/admins', form);
      toast.success('Admin created successfully');
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['admin-admins'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  };

  const toggleAdminBlock = async (adminId: string, isBanned: boolean) => {
    try {
      await api.put(`/admin/admins/${adminId}/${isBanned ? 'unban' : 'ban'}`, {
        reason: 'Managed from staff dashboard',
      });
      toast.success(isBanned ? 'Admin unblocked' : 'Admin blocked');
      queryClient.invalidateQueries({ queryKey: ['admin-admins'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update admin status');
    }
  };

  const resetAdminPassword = async (adminId: string) => {
    const newPassword = passwordMap[adminId];
    if (!newPassword || newPassword.length < 8) {
      toast.error('Enter a temporary password (8+ chars)');
      return;
    }
    try {
      await api.put(`/admin/admins/${adminId}/reset-password`, { newPassword });
      toast.success('Admin password updated');
      setPasswordMap((current) => ({ ...current, [adminId]: '' }));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update admin password');
    }
  };

  if (!['superadmin', 'ledger'].includes(user?.role || '')) {
    return <div className="card text-sm text-slate-400">Only superadmin or ledger can manage admin accounts.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          <ShieldCheck size={12} /> Staff controls
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Admin Management</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          {user?.role === 'ledger'
            ? 'Create and manage admin and superadmin accounts.'
            : 'Create and manage admin accounts.'}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="card space-y-4">
          <h2 className="text-xl font-bold text-white">Create admin</h2>
          {(['name', 'email', 'phone', 'password'] as const).map((field) => (
            <div key={field}>
              <label className="mb-1 block text-sm text-slate-300 capitalize">{field}</label>
              <input
                className="input"
                type={field === 'password' ? 'password' : 'text'}
                value={form[field]}
                onChange={(e) => onChange(field, e.target.value)}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Country</label>
              <select className="input" value={form.country} onChange={(e) => onChange('country', e.target.value)}>
                {['KE', 'UG', 'TZ', 'ET', 'GH', 'NG'].map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Role</label>
              <select className="input" value={form.role} onChange={(e) => onChange('role', e.target.value)}>
                <option value="admin">admin</option>
                {user?.role === 'ledger' && <option value="superadmin">superadmin</option>}
              </select>
            </div>
          </div>
          <button onClick={createAdmin} disabled={saving} className="btn-primary inline-flex items-center gap-2">
            <Plus size={14} /> {saving ? 'Saving...' : 'Create admin'}
          </button>
        </div>

        <div className="card space-y-3">
          <h2 className="text-xl font-bold text-white">Current admins</h2>
          {isLoading ? (
            <div className="text-sm text-slate-400">Loading admins...</div>
          ) : (
            <div className="space-y-3">
              {(data?.admins || []).map((admin: any) => (
                <div key={admin._id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{admin.name}</div>
                      <div className="text-xs text-slate-500">{admin.email} | {admin.phone}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={admin.role === 'superadmin' ? 'badge-green' : 'badge-blue'}>{admin.role}</span>
                      <span className={admin.isBanned ? 'badge-red' : 'badge-blue'}>{admin.isBanned ? 'blocked' : 'active'}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleAdminBlock(admin._id, admin.isBanned)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        admin.isBanned
                          ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-500/15'
                          : 'border border-red-400/30 bg-red-500/10 text-red-200 hover:border-red-300/50 hover:bg-red-500/15'
                      }`}
                    >
                      {admin.isBanned ? <Unlock size={14} /> : <Ban size={14} />}
                      {admin.isBanned ? 'Unblock' : 'Block'}
                    </button>
                    <input
                      className="input max-w-[220px]"
                      type="password"
                      placeholder="Temporary password"
                      value={passwordMap[admin._id] || ''}
                      onChange={(e) => setPasswordMap((current) => ({ ...current, [admin._id]: e.target.value }))}
                    />
                    <button
                      onClick={() => resetAdminPassword(admin._id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-200 transition hover:border-yellow-300/50 hover:bg-yellow-500/15"
                    >
                      <KeyRound size={14} /> Set password
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
