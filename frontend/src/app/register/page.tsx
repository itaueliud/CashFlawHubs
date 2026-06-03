'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import { ChevronLeft } from 'lucide-react';

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
  // Phone OTP UI hidden while phone verification is bypassed
  const [referralVerified, setReferralVerified] = useState(false);

  const [form, setForm] = useState({
    referralCode: searchParams?.get('ref') || '',
    firstName: '',
    lastName: '',
    idNumber: '',
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
  const goBack = () => setStep((currentStep) => Math.max(1, currentStep - 1));

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

  useEffect(() => {
    const stepParam = searchParams?.get('step');
    const emailParam = searchParams?.get('email');
    const emailVerifiedParam = searchParams?.get('emailVerified');
    const reasonParam = searchParams?.get('reason');

    // prefer explicit step in URL, otherwise restore saved step from sessionStorage
    if (stepParam === '3') setStep(3);
    else {
      const savedStep = typeof window !== 'undefined' ? sessionStorage.getItem('register-step') : null;
      if (savedStep && ['1', '2', '3', '4', '5'].includes(savedStep)) {
        setStep(Number(savedStep));
      }
    }
    if (emailParam) setField('email', emailParam);

    if (emailVerifiedParam === '1') {
      toast.success('Email verified successfully');
    } else if (emailVerifiedParam === '0' && reasonParam) {
      toast.error('Email verification link is invalid or expired');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Persist step and key form fields so refresh keeps user on the same step
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('register-step', String(step));
        sessionStorage.setItem('register-referral', form.referralCode || '');
        sessionStorage.setItem('register-email', form.email || '');
      }
    } catch (e) {
      // ignore storage errors
    }
  }, [step, form.referralCode, form.email]);

  // Clear persisted state on successful registration
  useEffect(() => {
    const onBeforeUnload = () => {
      // no-op
    };
    return () => {
      // keep persisted values for refresh; do not clear here
    };
  }, []);

  // If user refreshed the page or returned without query params, check server-side email verified flag
  useEffect(() => {
    const checkVerified = async () => {
      const email = form.email?.trim();
      if (!email) return;
      try {
        const res = await api.get(`/auth/email-verified-status?email=${encodeURIComponent(email)}`);
        if (res.data?.verified) {
          toast.success('Email verified successfully');
          // If referral code exists, ensure it's verified before moving to step 3
          if (form.referralCode && !referralVerified) {
            try {
              await verifyReferral();
            } catch (e) {
              // ignore - verifyReferral already shows toast
            }
          }
          setStep(3);
        }
      } catch (err: any) {
        // ignore
      }
    };
    // run check once on mount and whenever email changes
    checkVerified();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email]);

  // Phone verification endpoints exist but the UI is hidden while verification is bypassed.

  const completeSignup = async () => {
    if (!referralVerified) return toast.error('Verify referral code first');
    if (!form.firstName || !form.lastName || !form.country) return toast.error('Complete personal details');
    if (!form.email.trim()) return toast.error('Email is required');
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
            <div>
              <label className="mb-1 block text-sm text-slate-300">First Name</label>
              <input className="input" placeholder="First Name" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Last Name</label>
              <input className="input" placeholder="Last Name" value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-300">ID Number</label>
              <input className="input" placeholder="ID Number" value={form.idNumber} onChange={(e) => setField('idNumber', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-300">Country</label>
              <select className="input md:col-span-2" value={form.country} onChange={(e) => setField('country', e.target.value)}>
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
            </div>
            <div className="md:col-span-2 flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                Back
              </button>
              <button type="button" className="btn-primary" onClick={() => setStep(3)}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5 space-y-4">
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} className="flex justify-center" />
            <div>
              <label className="mb-1 block text-sm text-slate-300">Phone Number</label>
              <input className="input" placeholder="Phone Number (optional)" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <p className="text-xs text-slate-400">Phone number . you will verify phone number after registration from your profile.
            </p>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Email Address</label>
              <input className="input" placeholder="Email Address" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <p className="text-xs text-slate-400">Email verification is optional during registration. You can verify it later after login from your profile.</p>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                Back
              </button>
              <button className="btn-primary" onClick={() => setStep(4)}>Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Password</label>
              <input type="password" className="input" placeholder="Password" value={form.password} onChange={(e) => setField('password', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Confirm Password</label>
              <input type="password" className="input" placeholder="Confirm Password" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Language</label>
            <select className="input" value={form.user_language} onChange={(e) => setField('user_language', e.target.value)}>
              <option value="">Auto-detect language</option>
              {langs.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
            </select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                Back
              </button>
              <button className="btn-primary" onClick={() => setStep(5)}>Review</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mt-5 space-y-3">
            <div className="rounded border border-white/10 p-3 text-sm text-slate-300">Device ID/fingerprint, IP, browser/OS, timezone, registration date, Accept-Language, and CF-IPCountry headers are captured automatically for fraud/security monitoring.</div>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                Back
              </button>
              <button className="btn-primary" disabled={loading} onClick={completeSignup}>{loading ? 'Creating...' : 'Complete Account Creation'}</button>
            </div>
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
