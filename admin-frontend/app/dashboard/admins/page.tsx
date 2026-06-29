'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge, ConfirmModal } from '../../../components/ui';
import { RefreshCw, Plus, Shield, Check, X, Settings2, Trash2, Lock, UserPlus } from 'lucide-react';

type AdminRole = 'admin' | 'superadmin';

type AdminRow = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  role: AdminRole;
  isBanned?: boolean;
  isActive?: boolean;
  userId?: string;
  adminAllowedPages?: string[];
  createdAt?: string;
};

type AdminForm = {
  name: string;
  email: string;
  phone: string;
  country: string;
  password: string;
  role: AdminRole;
};

const pageOptions = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Users', href: '/dashboard/users' },
  { label: 'Referrals', href: '/dashboard/referrals' },
  { label: 'Fraud Center', href: '/dashboard/fraud' },
  { label: 'KYC Queue', href: '/dashboard/kyc' },
  { label: 'Challenges', href: '/dashboard/challenges' },
  { label: 'Moderation', href: '/dashboard/moderation' },
  { label: 'Support', href: '/dashboard/support' },
  { label: 'Broadcasts', href: '/dashboard/notifications' },
  { label: 'Provider Health', href: '/dashboard/provider-health' },
  { label: 'Config', href: '/dashboard/config' },
  { label: 'Audit Logs', href: '/dashboard/audit' },
  { label: 'Profile', href: '/dashboard/profile' },
];

const defaultForm: AdminForm = {
  name: '',
  email: '',
  phone: '',
  country: '',
  password: '',
  role: 'admin',
};

const normalizePages = (pages: string[]) => Array.from(new Set(pages.filter(Boolean)));

export default function AdminsPage() {
  const { user, refreshUser, setUser } = useAuthStore();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<AdminForm>(defaultForm);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<AdminRow | null>(null);
  const [editPages, setEditPages] = useState<string[]>([]);
  const [editBusy, setEditBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  const currentUserId = String((user as any)?.id || (user as any)?._id || (user as any)?.userId || '');
  const canCreateSuperadmin = Boolean((user as any)?.role === 'ledger');

  const isCurrentAdmin = (candidate?: AdminRow | null) => {
    if (!candidate || !user) return false;
    const candidateIds = [candidate._id, candidate.userId, candidate.email, candidate.phone]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    const currentIds = [currentUserId, (user as any)?.email, (user as any)?.phone]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    return candidateIds.some((value) => currentIds.includes(value));
  };

  const loadAdmins = async () => {
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
    void loadAdmins();
  }, []);

  useEffect(() => {
    if (!editTarget) return;
    setEditPages(normalizePages(editTarget.adminAllowedPages || []));
  }, [editTarget]);

  const allowedRoleOptions = useMemo(() => (canCreateSuperadmin ? ['admin', 'superadmin'] : ['admin']), [canCreateSuperadmin]);

  const toggleSelectedPage = (href: string) => {
    setSelectedPages((current) => current.includes(href) ? current.filter((page) => page !== href) : [...current, href]);
  };

  const toggleEditPage = (href: string) => {
    setEditPages((current) => current.includes(href) ? current.filter((page) => page !== href) : [...current, href]);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/admins', {
        ...form,
        adminAllowedPages: normalizePages(selectedPages),
      });
      setForm(defaultForm);
      setSelectedPages([]);
      await loadAdmins();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create admin');
    } finally {
      setBusy(false);
    }
  };

  const savePermissions = async () => {
    if (!editTarget) return;
    setEditBusy(true);
    setError(null);
    try {
      const res = await api.put(`/admin/admins/${editTarget._id}/pages`, {
        adminAllowedPages: normalizePages(editPages),
      });
      const updatedAdmin = res.data?.admin || null;
      await loadAdmins();
      if (isCurrentAdmin(updatedAdmin || editTarget)) {
        setUser({
          ...(user as any),
          ...(updatedAdmin || {}),
          adminAllowedPages: normalizePages((updatedAdmin?.adminAllowedPages || editPages) as string[]),
        } as any);
        await refreshUser();
      }
      setEditTarget(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update permissions');
    } finally {
      setEditBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (resetPassword.trim().length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setResetBusy(true);
    setError(null);
    try {
      await api.put(`/admin/admins/${resetTarget._id}/reset-password`, { newPassword: resetPassword.trim() });
      setResetTarget(null);
      setResetPassword('');
      await loadAdmins();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await api.delete(`/admin/admins/${deleteTarget._id}`);
      setDeleteTarget(null);
      await loadAdmins();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete admin');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading && !admins.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Admin Management" description="Create and manage admin accounts and allowed dashboard pages." />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Management"
        description="Create admin accounts, assign dashboard pages, and revoke access by toggling individual sections."
      />

      {error && <ErrorBanner message={error} onRetry={() => void loadAdmins()} />}

      <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <form onSubmit={submitCreate} className="card-surface soft-up rounded-[24px] p-5 lg:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <UserPlus className="h-4 w-4 text-cyan-300" />
            Create admin
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm((cur) => ({ ...cur, name: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" placeholder="Full name" />
            <input value={form.email} onChange={(e) => setForm((cur) => ({ ...cur, email: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" placeholder="Email" />
            <input value={form.phone} onChange={(e) => setForm((cur) => ({ ...cur, phone: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" placeholder="Phone" />
            <input value={form.country} onChange={(e) => setForm((cur) => ({ ...cur, country: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" placeholder="Country" />
            <input type="password" value={form.password} onChange={(e) => setForm((cur) => ({ ...cur, password: e.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" placeholder="Temporary password" />
            <select value={form.role} onChange={(e) => setForm((cur) => ({ ...cur, role: e.target.value as AdminRole }))} className="rounded-xl border border-white/10 bg-[#09111f] px-4 py-3 text-sm text-white outline-none">
              {allowedRoleOptions.map((role) => (
                <option key={role} value={role} className="bg-[#09111f] text-white">{role}</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Allowed pages</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {pageOptions.map((page) => {
                const active = selectedPages.includes(page.href);
                return (
                  <button
                    key={page.href}
                    type="button"
                    onClick={() => toggleSelectedPage(page.href)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${active ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200' : 'border-white/10 bg-[#09111f] text-slate-300 hover:bg-white/5'}`}
                  >
                    <span>{page.label}</span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] ${active ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-white/15 text-transparent'}`}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Deselecting a page removes it from the admin dashboard immediately after save.
            </div>
          </div>

          <button disabled={busy || !form.name || !form.email || !form.phone || !form.country || !form.password} className="ledger-button w-full">
            <Plus className="h-4 w-4" />
            {busy ? 'Creating...' : 'Create admin'}
          </button>
        </form>

        <div className="card-surface soft-up rounded-[24px] p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Existing admins</div>
              <p className="text-xs text-slate-400">Edit pages, reset passwords, or remove access as needed.</p>
            </div>
            <button onClick={() => void loadAdmins()} className="ledger-button">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {admins.length ? admins.map((admin) => {
              const pages = normalizePages(admin.adminAllowedPages || []);
              return (
                <div key={admin._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{admin.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{admin.email} · {admin.phone || 'n/a'} · {admin.country || 'n/a'}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge status={admin.isBanned ? 'banned' : admin.isActive ? 'active' : 'pending'} />
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{admin.role}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setEditTarget(admin); setEditPages(pages); }} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15">
                        <Settings2 className="h-4 w-4" />
                        Permissions
                      </button>
                      <button onClick={() => { setResetTarget(admin); setResetPassword(''); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10">
                        <Lock className="h-4 w-4" />
                        Reset password
                      </button>
                      <button onClick={() => setDeleteTarget(admin)} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/15">
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {pages.length ? pages.map((page) => (
                      <span key={page} className="rounded-full border border-white/10 bg-[#09111f] px-3 py-1 text-xs text-slate-300">{pageOptions.find((item) => item.href === page)?.label || page}</span>
                    )) : (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">No pages assigned</span>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-500">No admins found.</div>
            )}
          </div>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(editTarget)}
        title={`Edit permissions${editTarget ? ` · ${editTarget.name}` : ''}`}
        description="Toggle dashboard pages on or off for this admin account."
        confirmLabel={editBusy ? 'Saving...' : 'Save permissions'}
        onClose={() => !editBusy && setEditTarget(null)}
        onConfirm={savePermissions}
      >
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {pageOptions.map((page) => {
              const active = editPages.includes(page.href);
              return (
                <button
                  key={page.href}
                  type="button"
                  onClick={() => toggleEditPage(page.href)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${active ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200' : 'border-white/10 bg-[#09111f] text-slate-300 hover:bg-white/5'}`}
                >
                  <span>{page.label}</span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] ${active ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-white/15 text-transparent'}`}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            If you remove every page, the admin dashboard will show the no-pages-assigned state after refresh.
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(resetTarget)}
        title={`Reset password${resetTarget ? ` · ${resetTarget.name}` : ''}`}
        description="Set a new temporary password for this admin account."
        confirmLabel={resetBusy ? 'Updating...' : 'Reset password'}
        onClose={() => !resetBusy && setResetTarget(null)}
        onConfirm={handleResetPassword}
      >
        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <div className="text-xs text-slate-500">Passwords must be at least 8 characters.</div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Delete admin${deleteTarget ? ` · ${deleteTarget.name}` : ''}`}
        description="This permanently removes the admin account."
        confirmLabel={deleteBusy ? 'Deleting...' : 'Delete admin'}
        danger
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          Make sure this admin is not needed before deleting. Their dashboard access will disappear immediately.
        </div>
      </ConfirmModal>
    </div>
  );
}

