'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';

const langs = ['en', 'sw', 'fr'];
const countries = [
  { code: 'KE', name: 'Kenya' },
  { code: 'UG', name: 'Uganda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigeria' },
];

const deviceFingerprint = () => {
  if (typeof window === 'undefined') return '';
  const key = 'cfh-device-fingerprint';
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = btoa(`${navigator.userAgent}|${navigator.platform}|${screen.width}x${screen.height}`).slice(0, 64);
    localStorage.setItem(key, fp);
  }
  return fp;
};

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setToken, setUser } = useAuthStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [referralVerified, setReferralVerified] = useState(false);

  const [form, setForm] = useState({
    referralCode: searchParams?.get('ref') || '',
    firstName: '',
    lastName: '',
    idNumber: '',
    dateOfBirth: '',
    country: 'KE',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    browser_language: '',
    user_language: '',
    timezone: '',
    device_fingerprint: '',
  });

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';
  const progress = useMemo(() => (step / 5) * 100, [step]);

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const verifyReferral = async () => {
    if (!form.referralCode.trim()) return toast.error('Referral code is required');
    setLoading(true);
    try {
      await api.get(`/referrals/validate/${encodeURIComponent(form.referralCode.trim())}`);
      setReferralVerified(true);
      toast.success('Referral code verified');
      setStep(2);
    } catch (err: any) {
      setReferralVerified(false);
      toast.error(err?.response?.data?.message || 'Invalid referral code');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!form.referralCode || referralVerified || step !== 1) return;
    verifyReferral();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.referralCode, referralVerified, step]);

  const sendPhoneOtp = async () => {
    if (turnstileSiteKey && !turnstileToken) return toast.error('Complete security check first');
    if (!form.phone.trim()) return toast.error('Phone number is required');
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone: form.phone.trim(), country: form.country, turnstileToken: turnstileToken || undefined });
      toast.success('Phone OTP sent');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send phone OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyPhone = async () => {
    if (!phoneOtp.trim()) return toast.error('Enter phone OTP');
    setLoading(true);
    try {
      await api.post('/auth/verify-phone-otp', { phone: form.phone.trim(), otp: phoneOtp.trim() });
      setPhoneVerified(true);
      toast.success('Phone verified');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Phone OTP invalid');
    } finally {
      setLoading(false);
    }
  };

  const sendEmailOtp = async () => {
    if (turnstileSiteKey && !turnstileToken) return toast.error('Complete security check first');
    if (!form.email.trim()) return toast.error('Email is required');
    setLoading(true);
    try {
      await api.post('/auth/send-email-verification', { email: form.email.trim(), firstName: form.firstName, turnstileToken: turnstileToken || undefined });
      toast.success('Email code sent');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send email code');
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async () => {
    if (!emailOtp.trim()) return toast.error('Enter email verification code');
    setLoading(true);
    try {
      await api.post('/auth/verify-email', { email: form.email.trim(), code: emailOtp.trim() });
      setEmailVerified(true);
      toast.success('Email verified');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Email code invalid');
    } finally {
      setLoading(false);
    }
  };

  const completeSignup = async () => {
    if (!referralVerified) return toast.error('Verify referral code first');
    if (!form.firstName || !form.lastName || !form.country || !form.dateOfBirth) return toast.error('Complete personal details');
    if (!phoneVerified || !emailVerified) return toast.error('Verify phone and email first');
    if (!form.password || form.password.length < 6 || form.password !== form.confirmPassword) return toast.error('Password check failed');
    if (turnstileSiteKey && !turnstileToken) return toast.error('Complete security check');

    const browserLanguage = (typeof navigator !== 'undefined' ? navigator.language : 'en').split('-')[0].toLowerCase();
    const selectedLang = langs.includes(browserLanguage) ? browserLanguage : 'en';
    const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';

    setLoading(true);
    try {
      const payload = {
        ...form,
        browser_language: browserLanguage,
        user_language: form.user_language || selectedLang,
        timezone,
        device_fingerprint: deviceFingerprint(),
        turnstileToken: turnstileToken || undefined,
      };

      const res = await api.post('/auth/register', payload);
      localStorage.setItem('cfh-user-language', res.data?.user?.userLanguage || payload.user_language);
      document.documentElement.lang = res.data?.user?.userLanguage || payload.user_language;
      setToken(res.data.token);
      setUser(res.data.user);
      toast.success('Account created');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h1 className="text-2xl font-black">Create Your Account</h1>
        <p className="mt-1 text-sm text-slate-400">Step {step} of 5</p>
        <div className="mt-3 h-2 rounded bg-slate-800"><div className="h-2 rounded bg-green-500" style={{ width: `${progress}%` }} /></div>

        {step === 1 && (
          <div className="mt-5 space-y-3">
            <label className="block text-sm">Referral Code (Required)</label>
            <input className="input" value={form.referralCode} onChange={(e) => setField('referralCode', e.target.value.toUpperCase())} />
            <button className="btn-primary" disabled={loading} onClick={verifyReferral}>Verify Referral Code</button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="First Name" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
            <input className="input" placeholder="Last Name" value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
            <input className="input" placeholder="ID Number" value={form.idNumber} onChange={(e) => setField('idNumber', e.target.value)} />
            <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} />
            <select className="input md:col-span-2" value={form.country} onChange={(e) => setField('country', e.target.value)}>
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
            <button className="btn-primary md:col-span-2" onClick={() => setStep(3)}>Continue</button>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5 space-y-4">
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} className="flex justify-center" />
            <input className="input" placeholder="Phone Number" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            <div className="flex gap-2"><input className="input" placeholder="Phone OTP" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} /><button className="btn-secondary" onClick={sendPhoneOtp}>Send OTP</button><button className="btn-primary" onClick={verifyPhone}>Verify</button></div>
            <input className="input" placeholder="Email Address" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            <div className="flex gap-2"><input className="input" placeholder="Email Code" value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} /><button className="btn-secondary" onClick={sendEmailOtp}>Send Code</button><button className="btn-primary" onClick={verifyEmail}>Verify</button></div>
            <button className="btn-primary" disabled={!phoneVerified || !emailVerified} onClick={() => setStep(4)}>Continue</button>
          </div>
        )}

        {step === 4 && (
          <div className="mt-5 space-y-3">
            <input type="password" className="input" placeholder="Password" value={form.password} onChange={(e) => setField('password', e.target.value)} />
            <input type="password" className="input" placeholder="Confirm Password" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} />
            <select className="input" value={form.user_language} onChange={(e) => setField('user_language', e.target.value)}>
              <option value="">Auto-detect language</option>
              {langs.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
            </select>
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} className="flex justify-center" />
            <button className="btn-primary" onClick={() => setStep(5)}>Review</button>
          </div>
        )}

        {step === 5 && (
          <div className="mt-5 space-y-3">
            <div className="rounded border border-white/10 p-3 text-sm text-slate-300">Device ID/fingerprint, IP, browser/OS, timezone, registration date, Accept-Language, and CF-IPCountry headers are captured automatically for fraud/security monitoring.</div>
            <button className="btn-primary" disabled={loading} onClick={completeSignup}>{loading ? 'Creating...' : 'Complete Account Creation'}</button>
          </div>
        )}

        <div className="mt-6 text-sm text-slate-400">Already have an account? <Link href="/login" className="text-green-400">Login</Link></div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
