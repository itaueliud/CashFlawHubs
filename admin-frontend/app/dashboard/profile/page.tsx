'use client';

import React, { useEffect, useState } from 'react';
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

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your session details and security settings." />

      {message && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/5 p-6">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Identity</div>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            <div><span className="font-semibold">Name:</span> {user?.name || '—'}</div>
            <div><span className="font-semibold">Email:</span> {user?.email || '—'}</div>
            <div><span className="font-semibold">Phone:</span> {user?.phone || '—'}</div>
            <div><span className="font-semibold">Role:</span> {user?.role || '—'}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/5 p-6">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Stats</div>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            <div><span className="font-semibold">Token balance:</span> {user?.tokenBalance ?? 0}</div>
            <div><span className="font-semibold">USD balance:</span> ${(user?.balanceUSD ?? 0).toFixed(2)}</div>
            <div><span className="font-semibold">XP:</span> {user?.xpPoints ?? 0}</div>
            <div><span className="font-semibold">2FA enabled:</span> {twoFAStatus?.enabled ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/8 bg-white/5 p-6">
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

        <div className="rounded-2xl border border-white/8 bg-white/5 p-6">
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
