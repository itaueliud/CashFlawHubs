'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard, StatusBadge } from '../../../components/ui';
import { ShieldCheck, ShieldOff, RefreshCw, Copy } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';

export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/auth/me');
      setProfile(res.data?.user || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/ledger/auth/2fa/setup');
      setSetupData(res.data || null);
      setVerifyCode('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to start 2FA setup');
    } finally {
      setBusy(false);
    }
  };

  const verifySetup = async () => {
    if (!setupData?.tempToken) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/ledger/auth/2fa/verify-setup', { token: verifyCode, tempToken: setupData.tempToken });
      setSetupData(null);
      setVerifyCode('');
      await refreshUser();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to verify 2FA setup');
    } finally {
      setBusy(false);
    }
  };

  const disable2FA = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/ledger/auth/2fa/disable');
      await refreshUser();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Ledger operator profile, session state, and 2FA controls."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Name" value={profile?.name || user?.name || 'Ledger Operator'} sub="Current account name" />
        <StatCard label="Role" value={profile?.role || user?.role || 'ledger'} sub="Permission level" />
        <StatCard label="2FA" value={profile?.twoFactorEnabled || user?.twoFactorEnabled ? 'Enabled' : 'Disabled'} sub="Authenticator protection" />
        <StatCard label="Email" value={profile?.email || user?.email || 'n/a'} sub="Login identifier" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="text-sm font-semibold text-white">Account details</div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Phone: {profile?.phone || user?.phone || 'n/a'}</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Ledger balance: ${Number(profile?.balanceUSD || user?.balanceUSD || 0).toFixed(2)}</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Token balance: {Number(profile?.tokenBalance || user?.tokenBalance || 0)}</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <StatusBadge status={profile?.twoFactorEnabled || user?.twoFactorEnabled ? 'verified' : 'pending'} />
            </div>
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Two-factor authentication</div>
              <p className="text-xs text-slate-400">Generate a fresh QR code, verify the token, or disable the current setup.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={startSetup} disabled={busy} className="ledger-button">
                <ShieldCheck className="h-4 w-4" />
                {busy ? 'Working...' : 'Setup 2FA'}
              </button>
              <button onClick={disable2FA} disabled={busy} className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-500/15 disabled:opacity-50">
                <ShieldOff className="h-4 w-4" />
                Disable
              </button>
            </div>
          </div>

          {setupData && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">QR code</div>
                {setupData.qrImage ? (
                  <img src={setupData.qrImage} alt="2FA QR code" className="mt-3 w-full rounded-xl bg-white p-2" />
                ) : (
                  <div className="mt-3 rounded-xl border border-white/8 bg-[#050b17] p-4 text-sm text-slate-500">No QR image returned.</div>
                )}
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Manual key</div>
                      <div className="mt-1 font-mono text-sm text-white">{setupData.manualKey || 'n/a'}</div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(setupData.manualKey || '')}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <label className="block">
                  <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">Verification code</div>
                  <input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="Enter the 6-digit code from your authenticator"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </label>
                <button
                  onClick={verifySetup}
                  disabled={busy || verifyCode.trim().length < 6}
                  className="ledger-button"
                >
                  Verify setup
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/8 bg-white/5 p-5 text-sm text-slate-300">
        Need a session refresh? Click refresh on the operator store state after changing login settings, or use the setup flow above to re-enroll your authenticator.
      </section>
    </div>
  );
}
