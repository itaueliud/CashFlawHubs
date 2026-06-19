'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { Shield } from 'lucide-react';

export default function LedgerProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const PENDING_2FA_SECRET_KEY = 'ledger-pending-2fa-secret';
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [profile, setProfile] = useState({ name: '', bio: '', avatar: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  
  // 2FA state
  const [twoFAStatus, setTwoFAStatus] = useState<any>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [twoFAToken, setTwoFAToken] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableToken, setDisableToken] = useState('');

  useQuery({
    queryKey: ['ledger-profile'],
    queryFn: async () => {
      const response = await api.get('/users/profile');
      const u = response.data?.user;
      setProfile({
        name: u?.name || '',
        bio: u?.bio || '',
        avatar: u?.avatar || '',
      });
      return response.data;
    },
    enabled: user?.role === 'ledger',
  });

  // Load 2FA status
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get('/2fa/status');
        if (mounted) setTwoFAStatus(data);
      } catch (e) {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/users/profile', profile);
      await refreshUser();
      toast.success('Profile updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setUpdatingPassword(true);
    try {
      await api.put('/users/profile/password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      toast.success('Password updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // 2FA Functions
  const startSetup = async () => {
    try {
      setTwoFALoading(true);
      const { data } = await api.post('/2fa/setup');
      setSetupData(data);
      if (data?.secret && typeof window !== 'undefined') {
        window.localStorage.setItem(PENDING_2FA_SECRET_KEY, String(data.secret));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to start setup');
    } finally {
      setTwoFALoading(false);
    }
  };

  const verifySetup = async () => {
    try {
      setTwoFALoading(true);
      const pendingSecret = typeof window !== 'undefined' ? window.localStorage.getItem(PENDING_2FA_SECRET_KEY) : null;
      await api.post('/2fa/verify-setup', { token: twoFAToken, secret: pendingSecret || setupData?.secret });
      toast.success('2FA enabled');
      setSetupData(null);
      setTwoFAToken('');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(PENDING_2FA_SECRET_KEY);
      }
      // Reload 2FA status
      const { data } = await api.get('/2fa/status');
      setTwoFAStatus(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Verification failed');
    } finally {
      setTwoFALoading(false);
    }
  };

  const disable2FA = async () => {
    try {
      setTwoFALoading(true);
      await api.post('/2fa/disable', { token: disableToken, password: disablePassword });
      toast.success('2FA disabled');
      setDisableToken('');
      setDisablePassword('');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(PENDING_2FA_SECRET_KEY);
      }
      // Reload 2FA status
      const { data } = await api.get('/2fa/status');
      setTwoFAStatus(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Disable failed');
    } finally {
      setTwoFALoading(false);
    }
  };

  if (user?.role !== 'ledger') return <div className="card text-sm text-slate-400">Ledger access required.</div>;

  return (
    <div className="dashboard-shell">
      <div className="card">
        <h1 className="text-2xl font-bold text-white">Ledger Profile</h1>
        <p className="mt-2 text-sm text-slate-400">Update your profile, password, and security settings.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="text-lg font-bold text-white">Profile Details</h2>
          <input className="input" placeholder="Name" value={profile.name} onChange={(e) => setProfile((c) => ({ ...c, name: e.target.value }))} />
          <input className="input" placeholder="Avatar URL" value={profile.avatar} onChange={(e) => setProfile((c) => ({ ...c, avatar: e.target.value }))} />
          <textarea className="input min-h-[120px]" placeholder="Bio" value={profile.bio} onChange={(e) => setProfile((c) => ({ ...c, bio: e.target.value }))} />
          <button onClick={saveProfile} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save profile'}</button>
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-bold text-white">Update Password</h2>
          <input
            className="input"
            type="password"
            placeholder="Current password"
            value={passwords.currentPassword}
            onChange={(e) => setPasswords((c) => ({ ...c, currentPassword: e.target.value }))}
          />
          <input
            className="input"
            type="password"
            placeholder="New password (8+ chars)"
            value={passwords.newPassword}
            onChange={(e) => setPasswords((c) => ({ ...c, newPassword: e.target.value }))}
          />
          <button onClick={changePassword} disabled={updatingPassword} className="btn-primary">
            {updatingPassword ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </div>

      {/* 2FA Section */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">Two-Factor Authentication</h2>
        </div>

        {twoFAStatus?.enabled && !setupData && (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
            âœ“ 2FA is currently enabled. Backup codes remaining: {twoFAStatus.backupCodesCount ?? 0}
          </div>
        )}

        {setupData ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Scan this QR code with an authenticator app (Google Authenticator, Authy, Microsoft Authenticator):</p>
            <img src={setupData.qrCodeUrl} alt="QR code" className="h-40 w-40" />
            <div>
              <p className="text-xs text-slate-400 mb-1">Manual entry key (if QR doesn't work):</p>
              <div className="font-mono text-sm bg-slate-900/60 p-2 rounded">{setupData.secret}</div>
            </div>
            <div>
              <p className="text-xs font-bold text-white mb-2">Backup codes (copy these now - save them safely):</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(setupData.backupCodes || []).map((c: string) => (
                  <div key={c} className="rounded bg-slate-900/60 p-2 font-mono text-xs">{c}</div>
                ))}
              </div>
            </div>
            <div>
              <input
                value={twoFAToken}
                onChange={(e) => setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code from app"
                maxLength={6}
                className="input"
              />
            </div>
            <button onClick={verifySetup} disabled={twoFALoading || twoFAToken.length !== 6} className="btn-primary w-full">
              {twoFALoading ? 'Verifying...' : 'Verify & Enable 2FA'}
            </button>
          </div>
        ) : twoFAStatus?.enabled ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">To disable 2FA, enter your authenticator code and password:</p>
            <input
              value={disableToken}
              onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              className="input"
            />
            <input
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              type="password"
              placeholder="Your password"
              className="input"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={startSetup} disabled={twoFALoading} className="btn-secondary flex-1">
                {twoFALoading ? 'Loading...' : 'Reconfigure'}
              </button>
              <button
                onClick={disable2FA}
                disabled={twoFALoading || disableToken.length !== 6 || !disablePassword}
                className="btn-primary flex-1"
              >
                {twoFALoading ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">2FA is not enabled. Add an extra layer of security:</span>
            <button onClick={startSetup} disabled={twoFALoading} className="btn-primary">
              {twoFALoading ? 'Starting...' : 'Enable 2FA'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

