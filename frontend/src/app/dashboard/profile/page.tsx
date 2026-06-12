"use client";
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
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

// --- Modals ---
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-slate-950/90 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function NotificationsModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved?: () => void }) {
  const [prefs, setPrefs] = useState(() => ({
    earnings:     !!user?.notificationPrefs?.earnings,
    tasks:        !!user?.notificationPrefs?.tasks,
    updates:      !!user?.notificationPrefs?.updates,
    referrals:    !!user?.notificationPrefs?.referrals,
    weeklyReport: !!user?.notificationPrefs?.weeklyReport,
  }));
  const [saving, setSaving] = useState(false);

  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    try {
      setSaving(true);
      await api.put('/users/profile/notifications', prefs);
      toast.success('Notification preferences saved');
      onSaved && onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save preferences');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Notification Preferences" onClose={onClose}>
      <div className="space-y-3">
        {([
          ['earnings','Earnings','When you receive money or tokens'],
          ['tasks','Tasks & Jobs','New tasks and job matches'],
          ['updates','App Updates','Feature releases and announcements'],
          ['referrals','Referrals','When someone joins using your code'],
          ['weeklyReport','Weekly Report','Your weekly earnings summary'],
        ] as [keyof typeof prefs, string, string][]).map(([key,label,desc]) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">{label}</div>
              <div className="text-xs text-slate-400">{desc}</div>
            </div>
            <button onClick={() => toggle(key)} className={`h-6 w-11 rounded-full transition-colors ${prefs[key] ? 'bg-green-500' : 'bg-slate-700'}`} aria-pressed={prefs[key]}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${prefs[key] ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}

        <div className="mt-4 flex justify-end">
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Preferences'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function LanguageModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved?: () => void }) {
  const [lang, setLang] = useState((user as any)?.userLanguage || 'en');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    try {
      setSaving(true);
      await api.put('/users/profile', { userLanguage: lang });
      localStorage.setItem('cfh-user-language', lang);
      localStorage.setItem('cfh_language', lang);
      document.documentElement.lang = lang;
      toast.success('Language updated');
      onSaved && onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Language & Region" onClose={onClose}>
      <div className="space-y-4">
        <LanguageSelect label="Display Language" value={lang} showAuto onSave={(v) => setLang(v)} />
        <div className="text-sm text-slate-400">Timezone: {typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Unknown'}</div>
        <div className="mt-4 flex justify-end"><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Language'}</button></div>
      </div>
    </ModalShell>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>({ mode: 'onChange' });
  const [saving, setSaving] = useState(false);
  const newPasswordValue = watch('newPassword', '');
  const confirmPasswordValue = watch('confirmPassword', '');

  const getStrengthLevel = (pw: string) => {
    if (!pw) return 0;
    if (pw.length < 8) return 1;
    if (pw.length < 10) return 2;
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) return 4;
    return 3;
  };

  const strengthLevel = getStrengthLevel(newPasswordValue);
  const strengthLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-slate-600', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400'];

  const onSubmit = async (data: any) => {
    try {
      setSaving(true);
      await api.put('/users/profile/password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed successfully');
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Change Password" onClose={() => { reset(); onClose(); }}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-xs text-slate-400">Current Password</label>
          <input
            {...register('currentPassword', { required: 'Current password is required' })}
            type="password"
            autoComplete="current-password"
            className="input"
          />
          {errors.currentPassword && <p className="mt-1 text-xs text-red-400">{errors.currentPassword.message}</p>}
        </div>

        <div>
          <label className="text-xs text-slate-400">New Password</label>
          <input
            {...register('newPassword', {
              required: 'New password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
            })}
            type="password"
            autoComplete="new-password"
            className="input"
          />
          {errors.newPassword && <p className="mt-1 text-xs text-red-400">{errors.newPassword.message}</p>}
          {newPasswordValue && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Password strength:</span>
                <span className={`font-semibold ${strengthLevel < 3 ? 'text-red-300' : 'text-emerald-300'}`}>{strengthLabels[strengthLevel]}</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-800">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-full flex-1 ${step <= strengthLevel ? strengthColors[strengthLevel] : 'bg-slate-700'}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-slate-400">Confirm New Password</label>
          <input
            {...register('confirmPassword', {
              required: 'Please confirm your new password',
              validate: (value) => value === newPasswordValue || 'Passwords do not match',
            })}
            type="password"
            autoComplete="new-password"
            className="input"
          />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>}
          {confirmPasswordValue && newPasswordValue && confirmPasswordValue !== newPasswordValue && (
            <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
          )}
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving || !isValid} className="btn-primary">
            {saving ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AchievementsModal({ user, onClose }: { user: any; onClose: () => void }) {
  const items = getAchievements(user);
  const unlocked = items.filter((i) => i.unlocked).length;
  return (
    <ModalShell title={`Achievements (${unlocked}/${items.length})`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">{items.map((it) => (<div key={it.id} className={`flex items-center gap-3 rounded-lg border p-3 ${it.unlocked ? 'border-yellow-400/30 bg-yellow-400/10' : 'border-slate-800 bg-slate-900/50 opacity-60'}`}><div className="text-2xl">{it.emoji}</div><div><div className="font-medium text-white">{it.label}</div><div className="text-xs text-slate-400">{it.unlocked ? 'Unlocked' : 'Locked'}</div></div></div>))}</div>
    </ModalShell>
  );
}

function TwoFactorModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved?: () => void }) {
  const [status, setStatus] = useState<{ enabled: boolean; enabledAt?: string; backupCodesCount?: number } | null>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { let mounted = true; (async () => { try { const { data } = await api.get('/2fa/status'); if (mounted) setStatus(data); } catch (e) { /* ignore */ } })(); return () => { mounted = false; }; }, []);

  const startSetup = async () => {
    try {
      setLoading(true);
      const { data } = await api.post('/2fa/setup');
      setSetupData(data);
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to start setup'); }
    finally { setLoading(false); }
  };

  const verifySetup = async () => {
    try {
      setLoading(true);
      await api.post('/2fa/verify-setup', { token });
      toast.success('2FA enabled');
      onSaved && onSaved();
      onClose();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Verification failed'); }
    finally { setLoading(false); }
  };

  const disable = async (password: string, t: string) => {
    try {
      setLoading(true);
      await api.post('/2fa/disable', { token: t, password });
      toast.success('2FA disabled');
      onSaved && onSaved();
      onClose();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Disable failed'); }
    finally { setLoading(false); }
  };

  return (
    <ModalShell title="Two-Factor Authentication" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-slate-400">Protect your account with an authenticator app (Google Authenticator, Authy).</div>
        {setupData ? (
          <div>
            <img src={setupData.qrCodeUrl} alt="QR code" className="h-40 w-40" />
            <div className="text-xs text-slate-400 mt-2">Secret: {setupData.secret}</div>
            <div className="mt-2 text-sm">Backup codes (copy now):</div>
            <div className="grid grid-cols-2 gap-2 text-xs mt-1">{(setupData.backupCodes||[]).map((c:any)=> (<div key={c} className="rounded bg-slate-900/60 p-2 font-mono">{c}</div>))}</div>
            <div className="mt-3"><input value={token} onChange={(e)=>setToken(e.target.value)} placeholder="Enter 6-digit code" className="input" /></div>
            <div className="mt-3 flex justify-end"><button onClick={verifySetup} disabled={loading} className="btn-primary">Verify & Activate</button></div>
          </div>
        ) : (
          <div className="flex justify-between"><button onClick={startSetup} className="btn-primary" disabled={loading}>{loading? 'Starting…' : 'Set up 2FA'}</button>{status?.enabled && <span className="text-sm text-green-400">Enabled</span>}</div>
        )}
      </div>
    </ModalShell>
  );
}

function KycModal({ user, onClose, onSubmitted }: { user: any; onClose: () => void; onSubmitted?: () => void }) {
  const [idNumber, setIdNumber] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      setSubmitting(true);
      const fd = new FormData();
      if (idNumber) fd.append('idNumber', idNumber);
      if (idFile) fd.append('idDocumentImage', idFile);
      if (selfieFile) fd.append('faceVerificationImage', selfieFile);
      await api.post('/users/kyc/submit', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('KYC submitted');
      onSubmitted && onSubmitted();
      onClose();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Submission failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Identity Verification" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="text-xs text-slate-400">ID Number</label><input className="input" value={idNumber} onChange={(e)=>setIdNumber(e.target.value)} /></div>
        <div><label className="text-xs text-slate-400">ID Document (jpg/png/pdf)</label><input type="file" accept="image/*,.pdf" onChange={(e)=>setIdFile(e.target.files?.[0]||null)} /></div>
        <div><label className="text-xs text-slate-400">Selfie / Face Photo</label><input type="file" accept="image/*" onChange={(e)=>setSelfieFile(e.target.files?.[0]||null)} /></div>
        <div className="flex justify-end"><button type="submit" disabled={submitting} className="btn-primary">{submitting? 'Submitting…' : 'Submit for Review'}</button></div>
      </form>
    </ModalShell>
  );
}

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
  const { data: referralSummary } = useQuery({
    queryKey: ['referral-summary'],
    queryFn: () => api.get('/referrals/summary').then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const [emailDraft, setEmailDraft] = useState('');
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [modal, setModal] = useState<null | 'notifications' | 'language' | 'password' | 'achievements' | 'twofa' | 'kyc'>(null);

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

  const totalInvited = referralSummary?.totalInvited ?? (user?.totalReferrals ?? 0);
  const totalReferred = referralSummary?.totalReferred ?? (user?.totalReferrals ?? 0);
  const totalEarnedUSD = referralSummary?.totalEarnedUSD ?? ((user as any)?.totalEarned || 0);
  const totalPendingUSD = referralSummary?.pendingUSD ?? 0;

  const stats = [
    { label: 'EARNED',   value: `$${totalEarnedUSD.toFixed(2)}`, color: 'text-green-300' },
    { label: 'TOKENS',   value: String(user?.tokenBalance || 0),                    color: 'text-cyan-300'  },
    { label: 'REFERRALS',value: String(totalReferred),                               color: 'text-yellow-300'},
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
            {[{ label: 'Identity Verification (KYC)', sublabel: 'Required to withdraw above $50', status: (user as any)?.identityVerificationStatus === 'verified' ? 'Verified' : ((user as any)?.identityVerificationStatus === 'submitted' ? 'Under review' : 'Start →'), statusClass: (user as any)?.identityVerificationStatus === 'verified' ? 'text-green-400' : 'text-orange-400', icon: Shield, action: () => setModal('kyc') }, { label: 'Two-Factor Authentication', sublabel: 'Protects your earnings', status: (user as any)?.twoFactorEnabled ? 'Enabled' : 'Enable ›', statusClass: (user as any)?.twoFactorEnabled ? 'text-green-400' : 'text-orange-400', icon: CheckCircle2 }, { label: 'Email Verified', sublabel: user?.email || 'Not added', status: user?.emailVerified ? '✓ Done' : 'Verify', statusClass: user?.emailVerified ? 'text-green-400' : 'text-yellow-400', icon: Mail }].map((item) => { const Icon = item.icon as any; return (<button key={item.label} onClick={item.action} className="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-2 py-3 hover:border-slate-800 hover:bg-slate-950/40 transition-colors"><div className="flex min-w-0 items-center gap-3"><div className="flex-shrink-0 rounded-xl bg-slate-800/70 p-2 text-slate-400"><Icon size={15} /></div><div className="min-w-0"><div className="text-sm font-medium text-white">{item.label}</div><div className="truncate text-xs text-slate-500">{item.sublabel}</div></div></div><span className={`flex-shrink-0 text-sm font-semibold ${item.statusClass}`}>{item.status}</span></button>); })}
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

      {/* Modals */}
      {modal === 'notifications' && <NotificationsModal user={user} onClose={() => setModal(null)} onSaved={() => refreshUser()} />}
      {modal === 'language' && <LanguageModal user={user} onClose={() => setModal(null)} onSaved={() => refreshUser()} />}
      {modal === 'password' && <PasswordModal onClose={() => setModal(null)} />}
      {modal === 'achievements' && <AchievementsModal user={user} onClose={() => setModal(null)} />}
      {modal === 'twofa' && <TwoFactorModal user={user} onClose={() => setModal(null)} onSaved={() => refreshUser()} />}
      {modal === 'kyc' && <KycModal user={user} onClose={() => setModal(null)} onSubmitted={() => refreshUser()} />}

      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-green-400">Payout Methods</h3>
        {user?.phone ? (<div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3.5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-lg">📱</div><div><div className="text-sm font-semibold text-white">M-Pesa</div><div className="text-xs text-slate-500">{formatPhone(user.phone)} · Primary</div></div></div><ChevronRight size={16} className="text-slate-500" /></div>) : null}
        <button className="mt-3 w-full rounded-2xl border border-dashed border-slate-700 py-3 text-sm text-slate-400 transition-colors hover:border-green-400/40 hover:text-green-300">+ Add Payout Method</button>
      </section>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-widest text-green-400">Achievements</h3><button type="button" onClick={() => setModal('achievements')} className="text-xs font-medium text-green-400 hover:underline">View All →</button></div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">{achievements.map((a) => (<div key={a.id} title={a.label} className={`flex flex-col items-center rounded-2xl border p-2 text-center transition-opacity sm:p-3 ${a.unlocked ? 'border-yellow-400/30 bg-yellow-400/10' : 'border-slate-800 bg-slate-900/50 opacity-40 grayscale'}`}><span className="text-2xl sm:text-3xl">{a.emoji}</span><span className="mt-1 text-[9px] leading-tight text-slate-400 sm:text-[10px]">{a.label}</span></div>))}</div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-400">Refer & Earn</h3>
              <p className="text-sm text-slate-400">Track your invited and activated referrals.</p>
            </div>
            <a href="/dashboard/referrals" className="text-xs font-medium text-green-400 hover:underline">Full Dashboard</a>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4 text-center">
              <div className="text-xs text-slate-400">Invited</div>
              <div className="mt-2 text-2xl font-black text-blue-300">{totalInvited}</div>
              <div className="mt-1 text-xs text-slate-500">Signed up with your code</div>
            </div>
            <div className="rounded-2xl border border-green-400/20 bg-green-400/10 p-4 text-center">
              <div className="text-xs text-slate-400">Referred</div>
              <div className="mt-2 text-2xl font-black text-green-300">{totalReferred}</div>
              <div className="mt-1 text-xs text-slate-500">Activated</div>
            </div>
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-center">
              <div className="text-xs text-slate-400">Earned</div>
              <div className="mt-2 text-2xl font-black text-yellow-300">${totalEarnedUSD.toFixed(2)}</div>
              <div className="mt-1 text-xs text-slate-500">Referral rewards</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-green-400/25 bg-green-400/10 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 truncate font-mono text-base font-black tracking-[0.2em] text-green-300 sm:text-lg">{user?.referralCode || '—'}</div>
              <button type="button" onClick={() => copyText(user?.referralCode || '', 'Referral code')} className="flex-shrink-0 rounded-xl bg-green-400 px-4 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-green-300 active:scale-95">Copy</button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Share your referral code or send this link to earn rewards.</p>
            {referralSummary?.recentInvited?.length === 0 && referralSummary?.recentReferred?.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">No recent referral activity yet. Share your code to get started.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {referralSummary?.recentReferred?.length ? (
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Recent activated referrals</div>
                    <div className="space-y-2">
                      {(referralSummary.recentReferred || []).map((r: any, idx: number) => (
                        <div key={`referred-${idx}`} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm">
                          <div className="font-semibold text-white">{r.name}</div>
                          <div className="text-xs text-slate-400">{r.country} · {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          <div className="mt-1 flex items-center justify-between text-xs text-slate-400"><span>{r.reward} {r.currency}</span><span>{r.status === 'paid' ? '✓ Paid' : '⏳ Pending'}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {referralSummary?.recentInvited?.length ? (
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Recent invited users</div>
                    <div className="space-y-2">
                      {(referralSummary.recentInvited || []).map((u: any, idx: number) => (
                        <div key={`invited-${idx}`} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm">
                          <div className="font-semibold text-white">{u.name || 'Unknown'}</div>
                          <div className="text-xs text-slate-400">{u.country} · {new Date(u.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          <div className="mt-1 text-xs text-slate-400">Awaiting activation</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-green-400">Account Settings</h3>
        <div className="space-y-1">{[{ icon: Bell, label: 'Notifications', sublabel: 'Earnings, tasks, updates', action: () => setModal('notifications') }, { icon: Globe, label: 'Language & Region', sublabel: 'English · EAT (UTC+3)', action: () => setModal('language') }, { icon: Lock, label: 'Change Password', sublabel: 'Last changed: Never', action: () => setModal('password') }, { icon: Shield, label: '2-Step Verification', sublabel: (user as any)?.twoFactorEnabled ? 'Enabled ✓' : 'Not enabled', action: () => setModal('twofa') }].map((item) => { const Icon = item.icon as any; return (<button key={item.label} type="button" onClick={item.action} className="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-2 py-3 text-left transition-colors hover:border-slate-800 hover:bg-slate-950/40"><div className="flex min-w-0 items-center gap-3"><div className="flex-shrink-0 rounded-xl bg-slate-800/70 p-2 text-slate-400"><Icon size={15} /></div><div className="min-w-0"><div className="text-sm font-medium text-white">{item.label}</div><div className="text-xs text-slate-500">{item.sublabel}</div></div></div><ChevronRight size={16} className="flex-shrink-0 text-slate-600" /></button>); })}</div>
      </section>
    </div>
  );
}

