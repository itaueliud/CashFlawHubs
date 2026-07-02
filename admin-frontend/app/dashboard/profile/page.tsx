'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { PageHeader, LoadingSpinner, ErrorBanner } from '../../../components/ui';
import api from '../../../lib/api';

type TwoFAStatus = {
  success?: boolean;
  enabled: boolean;
  enabledAt?: string | null;
  backupCodesCount?: number;
};

type TwoFASetup = {
  qrCodeUrl?: string;
  backupCodes?: string[];
  secret?: string;
};

type ProfileForm = {
  name: string;
  phone: string;
  bio: string;
  avatar: string;
  userLanguage: string;
  timezone: string;
};

const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};

const isAdminOrSuperadminRole = (role?: string) => ['admin', 'superadmin'].includes(String(role || '').toLowerCase());

export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFAStatus | null>(null);
  const [setupData, setSetupData] = useState<TwoFASetup | null>(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
    name: '',
    phone: '',
    bio: '',
    avatar: '',
    userLanguage: 'en',
    timezone: '',
  });

  const loadStatus = async () => {
    const res = await api.get('/2fa/status');
    setTwoFAStatus(res.data || null);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        if (!user) {
          await refreshUser();
        }
        await loadStatus();
      } catch (err: any) {
        if (!mounted) return;
        setError(String(err?.response?.data?.message || err?.message || 'Failed to load profile'));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [refreshUser, user]);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      bio: (user as any).bio || '',
      avatar: (user as any).avatar || '',
      userLanguage: (user as any).userLanguage || 'en',
      timezone: (user as any).timezone || getBrowserTimezone(),
    });
    setEmailDraft(user.email || '');
  }, [user]);

  const begin2FASetup = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.post('/2fa/setup');
      setSetupData(res.data || null);
      setMessage('Scan the QR code or enter the secret into your authenticator app, then verify the code.');
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || 'Failed to start 2FA setup'));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!canManageAdminProfile) {
      setError('Only admins and superadmins can update this profile.');
      return;
    }

    setSavingProfile(true);
    setError(null);
    setMessage(null);
    try {
      await api.put('/users/profile', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        avatar: form.avatar.trim(),
        userLanguage: form.userLanguage.trim(),
        timezone: form.timezone.trim(),
        browserLanguage: navigator.language || 'en',
      }, {
        headers: { 'x-profile-scope': 'admin' },
      });
      await refreshUser();
      await loadStatus();
      setMessage('Profile details saved successfully.');
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || 'Failed to save profile'));
    } finally {
      setSavingProfile(false);
    }
  };

  const requestEmailChange = async () => {
    if (!canManageAdminProfile) {
      setError('Only admins and superadmins can update this profile.');
      return;
    }

    const nextEmail = emailDraft.trim();
    if (!nextEmail || nextEmail === user?.email) {
      setError('Enter a new email address before requesting a change.');
      return;
    }

    setEmailBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.post('/users/me/email', { newEmail: nextEmail }, {
        headers: { 'x-profile-scope': 'admin' },
      });
      setMessage(res.data?.message || 'Verification link sent to the new email address.');
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || 'Failed to request email change'));
    } finally {
      setEmailBusy(false);
    }
  };

  const verify2FASetup = async () => {
    if (verificationToken.length < 6) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.post('/2fa/verify-setup', { token: verificationToken });
      setVerificationToken('');
      setSetupData(null);
      await loadStatus();
      await refreshUser();
      setMessage('Two-factor authentication is now enabled.');
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || 'Failed to verify 2FA setup'));
    } finally {
      setBusy(false);
    }
  };

  const disable2FA = async () => {
    if (disableToken.length < 6 || !disablePassword.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.post('/2fa/disable', { token: disableToken, password: disablePassword });
      setDisableToken('');
      setDisablePassword('');
      await loadStatus();
      await refreshUser();
      setMessage('Two-factor authentication has been disabled.');
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err?.message || 'Failed to disable 2FA'));
    } finally {
      setBusy(false);
    }
  };

  const phoneHint = useMemo(() => (form.phone.trim() ? 'Phone number is saved on your account.' : 'Add a phone number for account recovery and notifications.'), [form.phone]);
  const canManageAdminProfile = useMemo(() => isAdminOrSuperadminRole(user?.role), [user?.role]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!canManageAdminProfile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" description="Your session details and security settings." />
        <div className="card-surface rounded-2xl p-6">
          <div className="text-lg font-black text-white">Access restricted</div>
          <p className="mt-2 text-sm text-slate-300">Only admin and superadmin accounts can use this profile editor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your session details and security settings." />

      {message && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card-surface rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Identity</div>
              <div className="mt-2 text-lg font-black text-white">Edit profile details</div>
            </div>
            <div className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">Admin editable</div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                placeholder="Your full name"
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Email</span>
              <input
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                placeholder="name@example.com"
                type="email"
              />
              <p className="text-xs text-slate-500">Email changes use verification and won�t take effect until confirmed.</p>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                placeholder="+2547..."
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Language</span>
              <select
                value={form.userLanguage}
                onChange={(e) => setForm((current) => ({ ...current, userLanguage: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
              >
                <option value="en">English</option>
                <option value="sw">Swahili</option>
                <option value="fr">French</option>
              </select>
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Timezone</span>
              <input
                value={form.timezone}
                onChange={(e) => setForm((current) => ({ ...current, timezone: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                placeholder={getBrowserTimezone() || 'Africa/Nairobi'}
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Avatar URL</span>
              <input
                value={form.avatar}
                onChange={(e) => setForm((current) => ({ ...current, avatar: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                placeholder="https://..."
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Bio</span>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((current) => ({ ...current, bio: e.target.value }))}
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                placeholder="Short profile bio"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">{phoneHint}</div>
            <button
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
              className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-surface rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Role & stats</div>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div><span className="font-semibold">Role:</span> {user?.role || '�'}</div>
              <div><span className="font-semibold">Token balance:</span> {user?.tokenBalance ?? 0}</div>
              <div><span className="font-semibold">USD balance:</span> ${(user?.balanceUSD ?? 0).toFixed(2)}</div>
              <div><span className="font-semibold">XP:</span> {user?.xpPoints ?? 0}</div>
              <div><span className="font-semibold">2FA enabled:</span> {twoFAStatus?.enabled ? 'Yes' : 'No'}</div>
            </div>
          </div>

          <div className="card-surface rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Email change</div>
            <div className="mt-3 text-sm text-slate-300">Request a verified email change without losing your session.</div>
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={requestEmailChange}
                disabled={emailBusy || !emailDraft.trim() || emailDraft.trim() === user?.email}
                className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {emailBusy ? 'Sending...' : 'Send verification link'}
              </button>
              <p className="text-xs text-slate-500">Current email stays active until the new address is confirmed.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card-surface rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">2FA Setup</div>
          <div className="mt-3 text-sm text-slate-300">
            {twoFAStatus?.enabled ? 'Two-factor authentication is active on this account.' : 'Set up authenticator-based 2FA for safer admin access.'}
          </div>

          {!twoFAStatus?.enabled && !setupData && (
            <button
              onClick={begin2FASetup}
              disabled={busy}
              className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {busy ? 'Starting...' : 'Begin 2FA Setup'}
            </button>
          )}

          {setupData && (
            <div className="mt-5 space-y-4">
              {setupData.qrCodeUrl && (
                <img src={setupData.qrCodeUrl} alt="2FA QR code" className="w-52 rounded-2xl border border-white/10 bg-white p-3" />
              )}
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-slate-300">
                <div className="font-semibold text-white">Secret</div>
                <div className="mt-2 break-all font-mono">{setupData.secret}</div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Verify Code</label>
                <div className="flex gap-2">
                  <input
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-white outline-none"
                  />
                  <button
                    onClick={verify2FASetup}
                    disabled={busy || verificationToken.length < 6}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    Verify
                  </button>
                </div>
              </div>
              {setupData.backupCodes?.length ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Backup Codes</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {setupData.backupCodes.map((code) => (
                      <code key={code} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200">{code}</code>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="card-surface rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Disable 2FA</div>
          <div className="mt-3 text-sm text-slate-300">Use this only if you are rotating devices or rebuilding your authenticator app.</div>
          <div className="mt-4 space-y-3">
            <input
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              type="password"
              placeholder="Current password"
              className="w-full rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-white outline-none"
            />
            <input
              value={disableToken}
              onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ''))}
              placeholder="Authenticator code"
              maxLength={6}
              className="w-full rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-white outline-none"
            />
            <button
              onClick={disable2FA}
              disabled={busy || !disablePassword.trim() || disableToken.length < 6 || !twoFAStatus?.enabled}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Disable 2FA
            </button>
          </div>
          <div className="mt-4 text-xs text-slate-500">Backup codes remaining: {twoFAStatus?.backupCodesCount ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
