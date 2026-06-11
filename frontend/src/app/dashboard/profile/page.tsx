"use client";
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
  Bell,
  Globe,
  Lock,
  CheckCircle as CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import LanguageSelect from '@/components/LanguageSelect';

const formatPhone = (phone?: string) => {
  if (!phone) return '';
  return phone.replace(/^(\+\d{1,3})0+/, '$1');
};

const LEVELS = ['Beginner','Active Worker','Power Earner','Expert','Master Earner','Champion','Legend','Icon'];
const XP_TARGETS = [100, 300, 600, 1000, 1500, 2200, 3000, 5000];
const COUNTRY_LABELS: Record<string, string> = {
  KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', ET: 'Ethiopia', GH: 'Ghana', NG: 'Nigeria',
};

type ProfileForm = { name: string; bio: string; userLanguage: string; phone: string };

const getAchievements = (user: any) => [
  { id: 'first_task', label: 'First Task', emoji: '🎯', unlocked: (user?.tasksCompleted || 0) >= 1 },
  { id: 'verified', label: 'Verified', emoji: '🔑', unlocked: !!(user?.emailVerified || user?.phoneVerified) },
  { id: 'first_10', label: 'First $10', emoji: '💰', unlocked: (user?.totalEarned || 0) >= 10 },
  { id: '5_referrals', label: '5 Referrals', emoji: '👥', unlocked: (user?.totalReferrals || 0) >= 5 },
  { id: '7_day_streak', label: '7-Day Streak', emoji: '🔥', unlocked: (user?.streak || 0) >= 7 },
  { id: 'level_5', label: 'Level 5', emoji: '🏆', unlocked: (user?.level || 1) >= 5 },
  { id: 'top_earner', label: 'Top Earner', emoji: '⭐', unlocked: false },
  { id: 'premium', label: 'Premium', emoji: '💎', unlocked: user?.plan === 'premium' },
];

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuthStore();
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const [emailDraft, setEmailDraft] = useState('');
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [editingPersonal, setEditingPersonal] = useState(false);

  const { register, handleSubmit, reset, getValues, watch } = useForm<ProfileForm>({
    defaultValues: { name: user?.name || '', bio: (user as any)?.bio || '', userLanguage: (user as any)?.userLanguage || '', phone: formatPhone(user?.phone) || '' },
  });

  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (!user?.id || hasRefreshed.current) return;
    hasRefreshed.current = true;
    void refreshUser();
  }, [refreshUser, user?.id]);

  useEffect(() => {
    reset({ name: user?.name || '', bio: (user as any)?.bio || '', userLanguage: (user as any)?.userLanguage || '', phone: formatPhone(user?.phone) || '' });
  }, [reset, user]);

  useEffect(() => { setEmailDraft(String(user?.pending_email || user?.email || '')); }, [user?.email, user?.pending_email]);

  useEffect(() => {
    if (verificationCooldown <= 0) return;
    const timer = window.setInterval(() => { setVerificationCooldown((c) => { if (c <= 1) { window.clearInterval(timer); return 0; } return c - 1; }); }, 1000);
    return () => window.clearInterval(timer);
  }, [verificationCooldown]);

  const level = user?.level || 1;
  const levelName = LEVELS[level - 1] || 'Beginner';
  const xpForNext = XP_TARGETS[level - 1] || 100;
  const xpProgress = Math.min(((user?.xpPoints || 0) / xpForNext) * 100, 100);
  const initials = user?.name?.split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('') || 'U';
  const achievements = getAchievements(user);
  const phoneDraft = watch('phone') || '';

  const copyText = async (value: string, label: string) => { try { await navigator.clipboard.writeText(value); toast.success(`${label} copied`); } catch { toast.error(`Could not copy ${label.toLowerCase()}`); } };

  const saveProfile = async (data: ProfileForm) => {
    try {
      await api.put('/users/profile', { ...data, browserLanguage: typeof navigator !== 'undefined' ? navigator.language.split('-')[0].toLowerCase() : '', timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '' });
      if (data.userLanguage) { localStorage.setItem('cfh-user-language', data.userLanguage); localStorage.setItem('cfh_language', data.userLanguage); document.documentElement.lang = data.userLanguage; }
      await refreshUser(); toast.success('Profile updated'); setEditingPersonal(false); return true;
    } catch { toast.error('Update failed'); return false; }
  };

  const requestEmailVerification = async () => {
    const trimmedEmail = emailDraft.trim().toLowerCase(); if (!trimmedEmail) { toast.error('Add an email first'); return; }
    try { setIsSendingVerification(true); if (user?.email && trimmedEmail === user.email.toLowerCase()) { if (user.emailVerified) { toast.success('Email already verified'); return; } await api.post('/auth/resend-verification-email'); } else { await api.post('/users/me/email', { newEmail: trimmedEmail }); } setVerificationCooldown(60); await refreshUser(); toast.success('Verification link sent'); } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to send verification'); } finally { setIsSendingVerification(false); }
  };

  const requestPhoneOtp = async () => {
    const vals = getValues(); const trimmedPhone = String(vals.phone || '').trim(); if (!trimmedPhone) { toast.error('Add a phone number first'); return; } const saved = await saveProfile({ ...vals, phone: trimmedPhone }); if (!saved) return; try { setIsSendingPhoneOtp(true); await api.post('/auth/send-otp', { phone: trimmedPhone, country: user?.country }); await refreshUser(); toast.success('OTP sent'); } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to send OTP'); } finally { setIsSendingPhoneOtp(false); }
  };

  const verifyPhoneOtp = async () => {
    const vals = getValues(); const trimmedPhone = String(vals.phone || '').trim(); const trimmedOtp = phoneOtp.trim(); if (!trimmedPhone) { toast.error('Add a phone number first'); return; } if (!trimmedOtp) { toast.error('Enter the OTP'); return; } const saved = await saveProfile({ ...vals, phone: trimmedPhone }); if (!saved) return; try { setIsVerifyingPhoneOtp(true); await api.post('/auth/verify-phone-otp', { phone: trimmedPhone, otp: trimmedOtp }); await refreshUser(); setPhoneOtp(''); toast.success('Phone verified'); } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to verify OTP'); } finally { setIsVerifyingPhoneOtp(false); }
  };

  const stats = [
    { label: 'EARNED',   value: `$${((user as any)?.totalEarned || 0).toFixed(2)}`, color: 'text-green-300' },
    { label: 'TOKENS',   value: String(user?.tokenBalance || 0),                   color: 'text-cyan-300'  },
    { label: 'REFERRALS',value: String(user?.totalReferrals || 0),                 color: 'text-yellow-300'},
  ];

  return (
    <div className="space-y-4 pb-8">
      <section className="rounded-[24px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-5 sm:p-6 shadow-[0_20px_60px_rgba(2,6,23,0.5)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-cyan-500 text-2xl font-black text-white shadow-[0_0_20px_rgba(74,222,128,0.3)]">{initials}</div>
              <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-slate-900 bg-green-400" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-white sm:text-2xl">{user?.name || 'Unnamed User'}</h2>
              <p className="mt-0.5 text-sm text-slate-400">@{(user as any)?.username || user?.userId || 'user'} · Member since {(user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Jan 2024'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-400/15 px-2.5 py-0.5 text-[11px] font-medium text-green-300">✓ Active</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/30 bg-yellow-400/15 px-2.5 py-0.5 text-[11px] font-medium text-yellow-300">⚡ Level {level}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-400/15 px-2.5 py-0.5 text-[11px] font-medium text-blue-300">🌱 {(user as any)?.plan || 'Starter'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm sm:text-right sm:flex-shrink-0">
            <div className="flex items-center gap-1.5 text-slate-400 sm:justify-end"><CalendarDays size={13} /> Progress to Level {level + 1}</div>
            <div className="mt-1 text-xl font-black text-white">{user?.xpPoints || 0}<span className="text-sm font-medium text-slate-400">/{xpForNext} XP</span></div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-slate-400"><span>XP Progress → Level {level + 1}</span><span className="text-green-300">{Math.round(xpProgress)}%</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-cyan-400 transition-all duration-700" style={{ width: `${xpProgress}%` }} /></div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center sm:p-5">
            <div className={`text-xl font-black sm:text-2xl ${s.color}`}>{s.value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500 sm:text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-widest text-green-400">Personal Information</h3><button type="button" onClick={() => setEditingPersonal(v => !v)} className="text-xs font-medium text-green-400 hover:underline">{editingPersonal ? 'Cancel' : 'Edit →'}</button></div>
          {editingPersonal ? (
            <form onSubmit={handleSubmit((data) => void saveProfile(data))} className="space-y-4">
              <div><label className="mb-1.5 block text-xs font-medium text-slate-400">Full Name</label><input {...register('name')} className="input" placeholder="Your full name" /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-slate-400">Bio</label><textarea {...register('bio')} rows={3} className="input resize-none" placeholder="A short bio..." /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-slate-400">Phone Number</label><input {...register('phone')} className="input" placeholder="+254..." /></div>
              <div><LanguageSelect label="Language" value={watch('userLanguage') || ''} showAuto onSave={(lang) => { setTimeout(() => { reset({ ...getValues(), userLanguage: lang }); }, 0); }} /></div>
              <button type="submit" className="btn-primary w-full sm:w-auto">Save Changes</button>
            </form>
          ) : (
            <div className="space-y-1">
              {[{ icon: UserRound, label: 'Full Name', sublabel: 'Legal name on account', value: user?.name || '—', action: null }, { icon: Mail, label: 'Email Address', sublabel: user?.email || 'Not added', value: user?.emailVerified ? 'Verified' : 'Verify', valueClass: user?.emailVerified ? 'text-green-400' : 'text-orange-400' }, { icon: Phone, label: 'Phone Number', sublabel: 'Not added', value: formatPhone(user?.phone) || 'Add Now', valueClass: user?.phone ? 'text-slate-200' : 'text-orange-400' }, { icon: MapPin, label: 'Country', sublabel: 'Used for eligible offers', value: COUNTRY_LABELS[user?.country || ''] || user?.country || '—', flag: user?.country }].map((row) => {
                const Icon = row.icon as any; return (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-transparent px-2 py-3 hover:border-slate-800 hover:bg-slate-950/40 transition-colors">
                    <div className="flex min-w-0 items-center gap-3"><div className="flex-shrink-0 rounded-xl bg-slate-800/70 p-2 text-slate-400"><Icon size={15} /></div><div className="min-w-0"><div className="text-sm font-medium text-white">{row.label}</div><div className="truncate text-xs text-slate-500">{row.sublabel}</div></div></div>
                    <div className="flex flex-shrink-0 items-center gap-1 text-sm font-medium"><span className={row.valueClass || 'text-slate-200'}>{row.flag ? `${row.value} ` : row.value}{row.flag && <span className="ml-1 text-xs">{row.flag}</span>}</span><ChevronRight size={14} className="text-slate-600" /></div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-green-400">Verification & Trust</h3>
          <div className="space-y-1">
            {[{ label: 'Identity Verification (KYC)', sublabel: 'Required to withdraw above $50', status: (user as any)?.identityVerificationStatus === 'verified' ? 'Verified' : 'Start →', statusClass: (user as any)?.identityVerificationStatus === 'verified' ? 'text-green-400' : 'text-orange-400', icon: Shield }, { label: 'Two-Factor Authentication', sublabel: 'Protects your earnings', status: (user as any)?.twoFactorEnabled ? 'Enabled' : 'Enable ›', statusClass: (user as any)?.twoFactorEnabled ? 'text-green-400' : 'text-orange-400', icon: CheckCircle2 }, { label: 'Email Verified', sublabel: user?.email || 'Not added', status: user?.emailVerified ? '✓ Done' : 'Verify', statusClass: user?.emailVerified ? 'text-green-400' : 'text-yellow-400', icon: Mail }].map((item) => { const Icon = item.icon as any; return (<div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-transparent px-2 py-3 hover:border-slate-800 hover:bg-slate-950/40 transition-colors"><div className="flex min-w-0 items-center gap-3"><div className="flex-shrink-0 rounded-xl bg-slate-800/70 p-2 text-slate-400"><Icon size={15} /></div><div className="min-w-0"><div className="text-sm font-medium text-white">{item.label}</div><div className="truncate text-xs text-slate-500">{item.sublabel}</div></div></div><span className={`flex-shrink-0 text-sm font-semibold ${item.statusClass}`}>{item.status}</span></div>); })}
          </div>

          {!user?.emailVerified && (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
              <p className="text-sm font-semibold text-amber-200">Verify your email</p>
              <input className="input mt-2 text-sm" type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="you@example.com" />
              <button type="button" onClick={requestEmailVerification} disabled={isSendingVerification || verificationCooldown > 0} className="btn-primary mt-2 w-full text-sm">{isSendingVerification ? 'Sending…' : verificationCooldown > 0 ? `Resend in ${verificationCooldown}s` : 'Send Verification'}</button>
            </div>
          )}

          {!user?.phoneVerified && (
            <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <p className="text-sm font-semibold text-cyan-200">Verify your phone</p>
              <input className="input mt-2 text-sm" type="text" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} placeholder="Enter OTP" />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={requestPhoneOtp} disabled={isSendingPhoneOtp || !phoneDraft.trim()} className="btn-primary flex-1 text-sm">{isSendingPhoneOtp ? 'Sending…' : 'Send OTP'}</button>
                <button type="button" onClick={verifyPhoneOtp} disabled={isVerifyingPhoneOtp || !phoneOtp.trim()} className="btn-secondary flex-1 text-sm">{isVerifyingPhoneOtp ? 'Verifying…' : 'Verify'}</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-green-400">Payout Methods</h3>
        {user?.phone ? (<div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3.5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-lg">📱</div><div><div className="text-sm font-semibold text-white">M-Pesa</div><div className="text-xs text-slate-500">{formatPhone(user.phone)} · Primary</div></div></div><ChevronRight size={16} className="text-slate-500" /></div>) : null}
        <button className="mt-3 w-full rounded-2xl border border-dashed border-slate-700 py-3 text-sm text-slate-400 transition-colors hover:border-green-400/40 hover:text-green-300">+ Add Payout Method</button>
      </section>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-widest text-green-400">Achievements</h3><button type="button" className="text-xs font-medium text-green-400 hover:underline">View All →</button></div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">{achievements.map((a) => (<div key={a.id} title={a.label} className={`flex flex-col items-center rounded-2xl border p-2 text-center transition-opacity sm:p-3 ${a.unlocked ? 'border-yellow-400/30 bg-yellow-400/10' : 'border-slate-800 bg-slate-900/50 opacity-40 grayscale'}`}><span className="text-2xl sm:text-3xl">{a.emoji}</span><span className="mt-1 text-[9px] leading-tight text-slate-400 sm:text-[10px]">{a.label}</span></div>))}</div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-green-400">Refer & Earn</h3>
          <div className="mb-3 flex items-center justify-between"><span className="text-sm text-slate-400">Your Referral Code</span><span className="text-sm font-medium text-green-400">{user?.totalReferrals || 0} friends invited</span></div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-green-400/25 bg-green-400/10 px-4 py-4"><span className="min-w-0 truncate font-mono text-base font-black tracking-[0.2em] text-green-300 sm:text-lg">{user?.referralCode || '—'}</span><button type="button" onClick={() => copyText(user?.referralCode || '', 'Referral code')} className="flex-shrink-0 rounded-xl bg-green-400 px-4 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-green-300 active:scale-95">Copy</button></div>
          <p className="mt-3 text-xs text-slate-500">Share your code and earn rewards for every verified friend who joins.</p>
        </section>
      </div>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-green-400">Account Settings</h3>
        <div className="space-y-1">{[{ icon: Bell, label: 'Notifications', sublabel: 'Earnings, tasks, updates', href: '#notifications' }, { icon: Globe, label: 'Language & Region', sublabel: 'English · EAT (UTC+3)', href: '#language' }, { icon: Lock, label: 'Change Password', sublabel: 'Last changed: Never', href: '#password' }].map((item) => { const Icon = item.icon as any; return (<button key={item.label} type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-2 py-3 text-left transition-colors hover:border-slate-800 hover:bg-slate-950/40"><div className="flex min-w-0 items-center gap-3"><div className="flex-shrink-0 rounded-xl bg-slate-800/70 p-2 text-slate-400"><Icon size={15} /></div><div className="min-w-0"><div className="text-sm font-medium text-white">{item.label}</div><div className="text-xs text-slate-500">{item.sublabel}</div></div></div><ChevronRight size={16} className="flex-shrink-0 text-slate-600" /></button>); })}</div>
      </section>
    </div>
  );
}

