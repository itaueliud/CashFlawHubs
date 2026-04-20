'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  BadgeCheck,
  CalendarDays,
  Copy,
  Gauge,
  Mail,
  MapPin,
  Phone,
  Shield,
  Sparkles,
  Star,
  UserRound,
  Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const LEVELS = ['Beginner', 'Active Worker', 'Power Earner', 'Expert', 'Master Earner', 'Champion', 'Legend', 'Icon'];
const XP_TARGETS = [100, 300, 600, 1000, 1500, 2200, 3000, 5000];
const COUNTRY_LABELS: Record<string, string> = {
  KE: 'Kenya',
  UG: 'Uganda',
  TZ: 'Tanzania',
  ET: 'Ethiopia',
  GH: 'Ghana',
  NG: 'Nigeria',
};

type ProfileForm = {
  name: string;
  bio: string;
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const { register, handleSubmit, reset } = useForm<ProfileForm>({
    defaultValues: {
      name: user?.name || '',
      bio: (user as any)?.bio || '',
    },
  });

  useEffect(() => {
    reset({
      name: user?.name || '',
      bio: (user as any)?.bio || '',
    });
  }, [reset, user]);

  const onSave = async (data: ProfileForm) => {
    try {
      await api.put('/users/profile', data);
      await refreshUser();
      toast.success('Profile updated!');
    } catch {
      toast.error('Update failed');
    }
  };

  const level = user?.level || 1;
  const levelName = LEVELS[level - 1] || 'Beginner';
  const xpForNext = XP_TARGETS[level - 1] || 100;
  const xpProgress = Math.min(((user?.xpPoints || 0) / xpForNext) * 100, 100);
  const initials = user?.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  const stats = [
    { label: 'XP Points', value: user?.xpPoints || 0, icon: Sparkles, tone: 'text-yellow-300' },
    { label: 'Token Balance', value: `${user?.tokenBalance || 0}T`, icon: Wallet, tone: 'text-cyan-300' },
    { label: 'Surveys Done', value: user?.surveysCompleted || 0, icon: BadgeCheck, tone: 'text-blue-300' },
    { label: 'Tasks Done', value: user?.tasksCompleted || 0, icon: Gauge, tone: 'text-orange-300' },
  ];

  const accountDetails = [
    { label: 'Email', value: user?.email || 'Not added', icon: Mail },
    { label: 'Phone', value: user?.phone || 'Not added', icon: Phone },
    { label: 'Country', value: COUNTRY_LABELS[user?.country || ''] || user?.country || 'Unknown', icon: MapPin },
    { label: 'User ID', value: user?.userId || '-', icon: UserRound, mono: true },
    { label: 'Referral Code', value: user?.referralCode || '-', icon: Copy, mono: true, copyable: true },
    { label: 'Level', value: `Level ${level} - ${levelName}`, icon: Star },
  ];

  const statusRows = [
    {
      label: 'Account Status',
      value: user?.activationStatus ? 'Activated' : 'Pending Activation',
      tone: user?.activationStatus ? 'text-green-300' : 'text-yellow-300',
    },
    {
      label: 'Phone Verification',
      value: user?.phoneVerified ? 'Verified' : 'Not Verified',
      tone: user?.phoneVerified ? 'text-green-300' : 'text-red-300',
    },
    {
      label: 'Email Verification',
      value: user?.emailVerified ? 'Verified' : 'Not Verified',
      tone: user?.emailVerified ? 'text-green-300' : 'text-yellow-300',
    },
    {
      label: 'Identity Check',
      value: user?.identityVerificationStatus || 'pending',
      tone: user?.identityVerificationStatus === 'verified' ? 'text-green-300' : 'text-slate-300',
    },
    {
      label: 'Referrals',
      value: String(user?.totalReferrals || 0),
      tone: 'text-slate-200',
    },
    {
      label: 'Daily Streak',
      value: `${user?.streak || 0} days`,
      tone: 'text-orange-300',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="max-w-5xl">
        <h1 className="text-3xl font-black text-white">Profile Hub</h1>
        <p className="mt-1 text-sm text-slate-400">Your identity, progress, verification, and earning profile in one place.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(34,197,94,0.16),rgba(8,15,34,0.92)_42%,rgba(14,165,233,0.12))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-green-400/25 to-cyan-400/20 text-3xl font-black text-green-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                {initials}
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-green-300">
                  <Shield size={12} /> Profile Overview
                </div>
                <h2 className="mt-3 text-2xl font-black text-white">{user?.name || 'Unnamed User'}</h2>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2"><Phone size={14} className="text-slate-500" />{user?.phone || 'No phone'}</span>
                  <span className="inline-flex items-center gap-2"><Mail size={14} className="text-slate-500" />{user?.email || 'No email'}</span>
                  <span className="inline-flex items-center gap-2"><MapPin size={14} className="text-slate-500" />{COUNTRY_LABELS[user?.country || ''] || user?.country}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-green-400/25 bg-green-400/10 px-3 py-1 text-sm font-medium text-green-300">
                    Level {level} - {levelName}
                  </span>
                  <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-sm font-medium text-yellow-300">
                    {user?.xpPoints || 0} XP
                  </span>
                  <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-sm font-medium text-orange-300">
                    {user?.streak || 0} day streak
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300 backdrop-blur">
              <div className="mb-1 inline-flex items-center gap-2 text-slate-400">
                <CalendarDays size={14} /> Progress to next level
              </div>
              <div className="text-right text-xl font-black text-white">{user?.xpPoints || 0}/{xpForNext}</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>XP Progress</span>
              <span>{Math.round(xpProgress)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-800/90">
              <div className="h-full rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-cyan-400 transition-all" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-[22px] border border-white/10 bg-slate-950/40 p-4">
                  <Icon size={18} className={stat.tone} />
                  <div className="mt-3 text-2xl font-black text-white">{stat.value}</div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_70px_rgba(2,6,23,0.4)]">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-white">Account Details</h3>
            <p className="mt-1 text-sm text-slate-400">Everything important for identity, referrals, and verification.</p>
          </div>

          <div className="space-y-3">
            {accountDetails.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-slate-800 p-2 text-slate-300">
                      <Icon size={15} />
                    </div>
                    <span className="text-sm text-slate-400">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm text-right text-slate-100 ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</span>
                    {item.copyable && item.value && item.value !== '-' && (
                      <button
                        type="button"
                        onClick={() => copyText(String(item.value), item.label)}
                        className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-green-400/40 hover:text-green-300"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-white">Edit Profile</h3>
            <p className="mt-1 text-sm text-slate-400">Update the public-facing profile information stored on your account.</p>
          </div>

          <form onSubmit={handleSubmit(onSave)} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Display Name</label>
              <input {...register('name')} className="input" placeholder="Your full display name" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Bio</label>
              <textarea
                {...register('bio')}
                rows={5}
                className="input resize-none"
                placeholder="Tell people what you do, what you like, or how you use CashFlawHubs..."
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
              Editable now: display name and bio.
              Profile phone, email, country, and account identifiers are shown above for reference.
            </div>

            <button type="submit" className="btn-primary px-6">Save Changes</button>
          </form>
        </section>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
              <Star size={18} className="text-yellow-400" /> Badges
            </h3>
            {(user?.badges || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">
                No badges yet. Complete challenges, earn more XP, and stay active to unlock them.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user?.badges.map((badge: string) => (
                  <span key={badge} className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-sm text-yellow-300">
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
              <Shield size={18} className="text-blue-400" /> Verification & Status
            </h3>
            <div className="space-y-3">
              {statusRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span className="text-sm text-slate-400">{row.label}</span>
                  <span className={`text-sm font-medium capitalize ${row.tone}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
