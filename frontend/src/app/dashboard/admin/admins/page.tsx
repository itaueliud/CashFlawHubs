'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ShieldCheck, Plus } from 'lucide-react';
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
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-admins'],
    queryFn: () => api.get('/admin/admins').then((response) => response.data),
    enabled: user?.role === 'superadmin',
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

  if (user?.role !== 'superadmin') {
    return <div className="card text-sm text-slate-400">Only the superadmin can create and manage admins.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-blue-950/20">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          <ShieldCheck size={12} /> Superadmin controls
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Admins</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Create admin accounts and assign operational control under the superadmin ledger.</p>
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
                <option value="superadmin">superadmin</option>
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
                      <div className="text-xs text-slate-500">{admin.email} · {admin.phone}</div>
                    </div>
                    <span className={admin.role === 'superadmin' ? 'badge-green' : 'badge-blue'}>{admin.role}</span>
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
