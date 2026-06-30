'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ConfirmModal, ErrorBanner, LoadingSpinner, PageHeader, StatusBadge, StatCard } from '../../../components/ui';
import { RefreshCw, UserPlus, ShieldAlert, ShieldCheck } from 'lucide-react';

type AdminAction =
  | { type: 'ban'; admin: any }
  | { type: 'unban'; admin: any }
  | { type: 'reset'; admin: any; newPassword: string }
  | { type: 'pages'; admin: any; pages: string[] }
  | { type: 'delete'; admin: any }
  | null;

const availablePages = [
  { key: '/dashboard', label: 'Overview' },
  { key: '/dashboard/admins', label: 'Admins' },
  { key: '/dashboard/users', label: 'Users' },
  { key: '/dashboard/kyc', label: 'KYC' },
  { key: '/dashboard/moderation', label: 'Moderation' },
  { key: '/dashboard/fraud', label: 'Fraud' },
  { key: '/dashboard/notifications', label: 'Notifications' },
  { key: '/dashboard/config', label: 'Config' },
  { key: '/dashboard/challenges', label: 'Challenges' },
  { key: '/dashboard/referrals', label: 'Referrals' },
  { key: '/dashboard/provider-health', label: 'Provider Health' },
  { key: '/dashboard/support', label: 'Support' },
  { key: '/dashboard/profile', label: 'Profile' },
];

const adminCountries = [
  { value: 'KE', label: 'Kenya' },
  { value: 'UG', label: 'Uganda' },
  { value: 'TZ', label: 'Tanzania' },
  { value: 'ET', label: 'Ethiopia' },
  { value: 'GH', label: 'Ghana' },
  { value: 'NG', label: 'Nigeria' },
] as const;

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  country: '',
  password: '',
  role: 'admin',
  adminAllowedPages: [] as string[],
};

export default function AdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [action, setAction] = useState<AdminAction>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/admins');
      setAdmins(res.data?.admins || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredAdmins = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return admins;
    return admins.filter((admin) =>
      [admin.name, admin.email, admin.phone, admin.country, admin.role, admin.userId]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [admins, search]);

  const createAdmin = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/admins', form);
      setForm(emptyForm);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create admin');
    } finally {
      setBusy(false);
    }
  };

  const banAdmin = async (admin: any) => {
    setBusy(true);
    try {
      await api.put(`/admin/admins/${admin._id}/ban`, { reason: 'Blocked from ledger admin console' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to ban admin');
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  const unbanAdmin = async (admin: any) => {
    setBusy(true);
    try {
      await api.put(`/admin/admins/${admin._id}/unban`, {});
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to unban admin');
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  const resetPassword = async (admin: any, newPassword: string) => {
    setBusy(true);
    try {
      await api.put(`/admin/admins/${admin._id}/reset-password`, { newPassword });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update admin password');
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  const updatePermissions = async (admin: any, pages: string[]) => {
    setBusy(true);
    try {
      await api.put(`/admin/admins/${admin._id}/pages`, { adminAllowedPages: pages });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update admin permissions');
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  const deleteAdmin = async (admin: any) => {
    setBusy(true);
    try {
      await api.delete(`/admin/admins/${admin._id}`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete admin');
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins"
        description="Create, ban, unban, reset passwords, and manage dashboard access for ledger-visible admin accounts."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Admins" value={String(admins.filter((admin) => admin.role === 'admin').length)} sub="Admin accounts" />
        <StatCard label="Superadmins" value={String(admins.filter((admin) => admin.role === 'superadmin').length)} sub="Visible to ledger" />
        <StatCard label="Banned" value={String(admins.filter((admin) => admin.isBanned).length)} sub="Blocked accounts" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <UserPlus className="h-4 w-4 text-cyan-300" />
            Create admin
          </div>
          <div className="mt-4 grid gap-3">
            {[
              ['name', 'Full name'],
              ['email', 'Email address'],
              ['phone', 'Phone number'],
              ['password', 'Password'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
                <input
                  type={key === 'password' ? 'password' : 'text'}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
              </label>
            ))}
            <label className="block">
              <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">Country</div>
              <select
                value={form.country}
                onChange={(e) => setForm((current) => ({ ...current, country: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Select country</option>
                {adminCountries.map((country) => (
                  <option key={country.value} value={country.value} className="bg-[#09111f] text-white">
                    {country.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">Role</div>
              <select
                value={form.role}
                onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="admin">admin</option>
                <option value="superadmin">superadmin</option>
              </select>
            </label>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Allowed pages</div>
              <div className="mt-3 grid gap-2">
                {availablePages.map((page) => {
                  const checked = form.adminAllowedPages.includes(page.key);
                  return (
                    <label key={page.key} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${checked ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200' : 'border-white/8 bg-white/5 text-slate-300'}`}>
                      <span>{page.label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm((current) => {
                            const pages = new Set(current.adminAllowedPages);
                            if (pages.has(page.key)) pages.delete(page.key);
                            else pages.add(page.key);
                            return { ...current, adminAllowedPages: Array.from(pages) };
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </div>
            <button
              onClick={createAdmin}
              disabled={busy || !form.name || !form.email || !form.phone || !form.country || !form.password}
              className="ledger-button"
            >
              <ShieldCheck className="h-4 w-4" />
              Create admin
            </button>
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-cyan-300" />
              Admin list
            </div>
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search admins"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <button onClick={load} className="ledger-button">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {filteredAdmins.length ? filteredAdmins.map((admin) => (
              <div key={admin._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{admin.name || 'Unknown admin'}</div>
                    <div className="mt-1 text-xs text-slate-500">{admin.email || 'n/a'} · {admin.phone || 'n/a'} · {admin.country || 'n/a'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(admin.adminAllowedPages || []).map((page: string) => (
                        <span key={page} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                          {availablePages.find((entry) => entry.key === page)?.label || page}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={admin.role || 'admin'} />
                      <StatusBadge status={admin.isBanned ? 'banned' : 'active'} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {admin.isBanned ? (
                      <button
                        onClick={() => setAction({ type: 'unban', admin })}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
                      >
                        Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => setAction({ type: 'ban', admin })}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/15"
                      >
                        Ban
                      </button>
                    )}
                    <button
                      onClick={() => setAction({ type: 'reset', admin, newPassword: '' })}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={() => setAction({ type: 'pages', admin, pages: [...(admin.adminAllowedPages || [])] })}
                      className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15"
                    >
                      Permissions
                    </button>
                    <button
                      onClick={() => setAction({ type: 'delete', admin })}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/15"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No admins match the search filter.</div>
            )}
          </div>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(action)}
        title={
          action?.type === 'ban'
            ? 'Ban admin'
            : action?.type === 'unban'
              ? 'Unban admin'
              : action?.type === 'pages'
                ? 'Admin permissions'
                : action?.type === 'delete'
                  ? 'Delete admin'
                  : 'Reset password'
        }
        description={
          action?.type === 'ban'
            ? `This will ban ${action.admin?.name || 'the selected admin'}.`
            : action?.type === 'unban'
              ? `This will restore access for ${action.admin?.name || 'the selected admin'}.`
              : action?.type === 'pages'
                ? `Update allowed pages for ${action.admin?.name || 'the selected admin'}.`
                : action?.type === 'delete'
                  ? `Delete ${action.admin?.name || 'the selected admin'} from the admin list? This cannot be undone.`
                : `Set a new password for ${action?.admin?.name || 'the selected admin'}.`
        }
        confirmLabel={busy ? 'Working...' : action?.type === 'delete' ? 'Delete' : 'Confirm'}
        danger={action?.type === 'ban' || action?.type === 'delete'}
        onClose={() => action && !busy && setAction(null)}
        onConfirm={() => {
          if (action?.type === 'ban') {
            void banAdmin(action.admin);
          } else if (action?.type === 'unban') {
            void unbanAdmin(action.admin);
          } else if (action?.type === 'reset') {
            void resetPassword(action.admin, action.newPassword || 'ChangeMe123!');
          } else if (action?.type === 'pages') {
            void updatePermissions(action.admin, action.pages || []);
          } else if (action?.type === 'delete') {
            void deleteAdmin(action.admin);
          }
        }}
      >
        {action?.type === 'reset' && (
          <div className="mt-4">
            <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">New password</label>
            <input
              autoFocus
              type="password"
              value={action.newPassword}
              onChange={(e) =>
                setAction((current) => (current && current.type === 'reset' ? { ...current, newPassword: e.target.value } : current))
              }
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>
        )}
        {action?.type === 'pages' && (
          <div className="mt-4 grid gap-2">
            {availablePages.map((page) => {
              const checked = action.pages.includes(page.key);
              return (
                <label key={page.key} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${checked ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200' : 'border-white/8 bg-white/5 text-slate-300'}`}>
                  <span>{page.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setAction((current) =>
                        current && current.type === 'pages'
                          ? {
                              ...current,
                              pages: checked
                                ? current.pages.filter((item) => item !== page.key)
                                : [...current.pages, page.key],
                            }
                          : current
                      )
                    }
                  />
                </label>
              );
            })}
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
