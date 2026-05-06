'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function LedgerProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [profile, setProfile] = useState({ name: '', bio: '', avatar: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

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

  if (user?.role !== 'ledger') return <div className="card text-sm text-slate-400">Ledger access required.</div>;

  return (
    <div className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-white">Ledger Profile</h1>
        <p className="mt-2 text-sm text-slate-400">Update your profile and change your password.</p>
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
    </div>
  );
}
