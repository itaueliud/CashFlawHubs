'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { setAppLanguage, normalizeLanguage, detectBrowserLanguage } from '@/i18n';

const langs = ['en', 'sw', 'fr'];
const countries = [
  { code: 'KE', name: 'Kenya' },
  { code: 'UG', name: 'Uganda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigeria' },
];

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Create Your Account',
    stepOf: 'Step {step} of 5',
    referralLabel: 'Referral Code (Required)',
    verifyReferral: 'Verify Referral Code',
    referralVerified: 'Referral code verified',
    firstName: 'First Name',
    lastName: 'Last Name',
    idNumber: 'ID Number',
    country: 'Country',
    continue: 'Continue',
    back: 'Back',
    phoneLabel: 'Phone Number',
    phonePlaceholder: 'Phone Number',
    emailLabel: 'Email Address',
    emailPlaceholder: 'Email Address',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm Password',
    passwordPlaceholder: 'Password',
    confirmPasswordPlaceholder: 'Confirm Password',
    languageLabel: 'Language',
    autoDetectLanguage: 'Auto-detect language',
    review: 'Review',
    createAccount: 'Complete Account Creation',
    creating: 'Creating...',
    alreadyHaveAccount: 'Already have an account?',
    login: 'Login',
    emailVerifiedSuccess: 'Email verified successfully',
    emailInvalid: 'Email verification link is invalid or expired',
    invalidReferral: 'Invalid referral code',
    securityCheck: 'Complete security check',
    passwordCheckFailed: 'Password check failed',
    referralRequired: 'Referral code is required',
    completePersonal: 'Complete personal details',
    emailRequired: 'Email is required',
    verifyReferralFirst: 'Verify referral code first',
    created: 'Account created',
    registrationFailed: 'Registration failed',
    phoneNote: '',
    emailNote: '',
    selected: 'Selected',
    languageEnglish: 'English',
    languageSwahili: 'Swahili',
    languageFrench: 'French',
    summaryNote: 'Device ID/fingerprint, IP, browser/OS, timezone, registration date, Accept-Language, and CF-IPCountry headers are captured automatically for fraud/security monitoring.',
  },
  sw: {
    title: 'Fungua Akaunti Yako',
    stepOf: 'Hatua {step} kati ya 5',
    referralLabel: 'Msimbo wa Rejeleo (Lazima)',
    verifyReferral: 'Thibitisha Msimbo',
    referralVerified: 'Msimbo wa rejeleo umethibitishwa',
    firstName: 'Jina la Kwanza',
    lastName: 'Jina la Mwisho',
    idNumber: 'Namba ya Kitambulisho',
    country: 'Nchi',
    continue: 'Endelea',
    back: 'Rudi',
    phoneLabel: 'Namba ya Simu',
    phonePlaceholder: 'Namba ya Simu',
    emailLabel: 'Barua Pepe',
    emailPlaceholder: 'Barua Pepe',
    passwordLabel: 'Nenosiri',
    confirmPasswordLabel: 'Thibitisha Nenosiri',
    passwordPlaceholder: 'Nenosiri',
    confirmPasswordPlaceholder: 'Thibitisha Nenosiri',
    languageLabel: 'Lugha',
    autoDetectLanguage: 'Tambua lugha kiotomatiki',
    review: 'Kagua',
    createAccount: 'Maliza Kuunda Akaunti',
    creating: 'Inaandaa...',
    alreadyHaveAccount: 'Tayari una akaunti?',
    login: 'Ingia',
    emailVerifiedSuccess: 'Barua pepe imethibitishwa',
    emailInvalid: 'Kiungo cha uthibitisho wa barua pepe si sahihi au kimeisha muda',
    invalidReferral: 'Msimbo wa rejeleo si sahihi',
    securityCheck: 'Kamilisha ukaguzi wa usalama',
    passwordCheckFailed: 'Ukaguzi wa nenosiri umefeli',
    referralRequired: 'Msimbo wa rejeleo unahitajika',
    completePersonal: 'Kamilisha taarifa binafsi',
    emailRequired: 'Barua pepe inahitajika',
    verifyReferralFirst: 'Thibitisha msimbo wa rejeleo kwanza',
    created: 'Akaunti imeundwa',
    registrationFailed: 'Usajili umefeli',
    phoneNote: '',
    emailNote: '',
    selected: 'Iliyoteuliwa',
    languageEnglish: 'Kiingereza',
    languageSwahili: 'Kiswahili',
    languageFrench: 'Kifaransa',
    summaryNote: 'Kitambulisho cha kifaa, IP, kivinjari/OS, saa za eneo, tarehe ya usajili, Accept-Language, na vichwa vya CF-IPCountry hukusanywa kiotomatiki kwa usalama na udhibiti wa udanganyifu.',
  },
  fr: {
    title: 'Créer votre compte',
    stepOf: 'Étape {step} sur 5',
    referralLabel: 'Code de parrainage (obligatoire)',
    verifyReferral: 'Vérifier le code',
    referralVerified: 'Code de parrainage vérifié',
    firstName: 'Prénom',
    lastName: 'Nom de famille',
    idNumber: "Numéro d'identité",
    country: 'Pays',
    continue: 'Continuer',
    back: 'Retour',
    phoneLabel: 'Numéro de téléphone',
    phonePlaceholder: 'Numéro de téléphone',
    emailLabel: 'Adresse e-mail',
    emailPlaceholder: 'Adresse e-mail',
    passwordLabel: 'Mot de passe',
    confirmPasswordLabel: 'Confirmer le mot de passe',
    passwordPlaceholder: 'Mot de passe',
    confirmPasswordPlaceholder: 'Confirmer le mot de passe',
    languageLabel: 'Langue',
    autoDetectLanguage: 'Détection automatique',
    review: 'Vérifier',
    createAccount: 'Terminer la création du compte',
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
    login: 'Connexion',
    emailVerifiedSuccess: 'E-mail vérifié avec succès',
    emailInvalid: "Le lien de vérification de l'e-mail est invalide ou expiré",
    securityCheck: 'Terminez la vérification de sécurité',
    passwordCheckFailed: 'La vérification du mot de passe a échoué',
    referralRequired: 'Le code de parrainage est requis',
    completePersonal: 'Complétez vos informations personnelles',
    emailRequired: "L'e-mail est requis",
    verifyReferralFirst: 'Vérifiez d’abord le code de parrainage',
    created: 'Compte créé',
    registrationFailed: "L'inscription a échoué",
    phoneNote: '',
    emailNote: '',
    selected: 'Sélectionné',
    languageEnglish: 'Anglais',
    languageSwahili: 'Swahili',
    languageFrench: 'Français',
    summaryNote: 'L’identifiant de l’appareil, IP, navigateur/OS, fuseau horaire, date d’inscription, Accept-Language et les en-têtes CF-IPCountry sont collectés automatiquement pour la sécurité et la prévention de la fraude.',
  },
};

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  const browserLanguage = useMemo(() => {
    if (typeof navigator === 'undefined') return 'en';
    return navigator.language.split('-')[0].toLowerCase();
  }, []);
  const storedLanguage = typeof window !== 'undefined' ? localStorage.getItem('cfh_language') || localStorage.getItem('cfh-user-language') || '' : '';
  const selectedLanguage = langs.includes(form.user_language)
    ? form.user_language
    : langs.includes(storedLanguage)
      ? storedLanguage
      : (langs.includes(browserLanguage) ? browserLanguage : 'en');
  const copy = translations[selectedLanguage] || translations.en;
  const renderCopy = (value: string) => value.replace('{step}', String(step));

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const goBack = () => setStep((currentStep) => Math.max(1, currentStep - 1));

  const verifyReferral = async () => {
    if (!form.referralCode.trim()) return toast.error(copy.referralRequired);
    setLoading(true);
    try {
      await api.get(`/referrals/validate/${encodeURIComponent(form.referralCode.trim())}`);
      setReferralVerified(true);
      toast.success(copy.referralVerified);
      setStep(2);
    } catch (err: any) {
      setReferralVerified(false);
      toast.error(err?.response?.data?.message || copy.invalidReferral || 'Invalid referral code');
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
      toast.success(copy.emailVerifiedSuccess);
    } else if (emailVerifiedParam === '0' && reasonParam) {
      toast.error(copy.emailInvalid);
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
          toast.success(copy.emailVerifiedSuccess);
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
    if (!referralVerified) return toast.error(copy.verifyReferralFirst);
    if (!form.firstName || !form.lastName || !form.country) return toast.error(copy.completePersonal);
    if (!form.email.trim()) return toast.error(copy.emailRequired);
    if (!form.password || form.password.length < 6 || form.password !== form.confirmPassword) return toast.error(copy.passwordCheckFailed);
    if (turnstileSiteKey && !turnstileToken) return toast.error(copy.securityCheck);

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
      localStorage.setItem('cfh_language', res.data?.user?.userLanguage || payload.user_language);
      document.documentElement.lang = res.data?.user?.userLanguage || payload.user_language;
      setToken(res.data.token);
      setUser(res.data.user);
      toast.success(copy.created);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || copy.registrationFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h1 className="text-2xl font-black">{copy.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{renderCopy(copy.stepOf)}</p>
        <div className="mt-3 h-2 rounded bg-slate-800"><div className="h-2 rounded bg-green-500" style={{ width: `${progress}%` }} /></div>

        {step === 1 && (
          <div className="mt-5 space-y-3">
            <label className="block text-sm">{copy.referralLabel}</label>
            <input className="input" value={form.referralCode} onChange={(e) => setField('referralCode', e.target.value.toUpperCase())} />
            <button className="btn-primary" disabled={loading} onClick={verifyReferral}>{copy.verifyReferral}</button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.firstName}</label>
              <input className="input" placeholder={copy.firstName} value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.lastName}</label>
              <input className="input" placeholder={copy.lastName} value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-300">{copy.idNumber}</label>
              <input className="input" placeholder={copy.idNumber} value={form.idNumber} onChange={(e) => setField('idNumber', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-300">{copy.country}</label>
              <select className="input md:col-span-2" value={form.country} onChange={(e) => setField('country', e.target.value)}>
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
            </div>
            <div className="md:col-span-2 flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                {copy.back}
              </button>
              <button type="button" className="btn-primary" onClick={() => setStep(3)}>{copy.continue}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5 space-y-4">
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')} className="flex justify-center" />
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.phoneLabel}</label>
              <input className="input" placeholder={copy.phonePlaceholder} value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.emailLabel}</label>
              <input className="input" placeholder={copy.emailPlaceholder} value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                {copy.back}
              </button>
              <button className="btn-primary" onClick={() => setStep(4)}>{copy.continue}</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.passwordLabel}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder={copy.passwordPlaceholder}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.confirmPasswordLabel}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder={copy.confirmPasswordPlaceholder}
                  value={form.confirmPassword}
                  onChange={(e) => setField('confirmPassword', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.languageLabel}</label>
              <select
                className="input"
                value={form.user_language}
                onChange={(e) => {
                  const next = e.target.value ? normalizeLanguage(e.target.value) : detectBrowserLanguage();
                  setField('user_language', next);
                  void setAppLanguage(next);
                }}
              >
                <option value="">{copy.autoDetectLanguage}</option>
                <option value="en">{copy.languageEnglish}</option>
                <option value="sw">{copy.languageSwahili}</option>
                <option value="fr">{copy.languageFrench}</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                {copy.back}
              </button>
              <button className="btn-primary" onClick={() => setStep(5)}>{copy.review}</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mt-5 space-y-3">
            <div className="rounded border border-white/10 p-3 text-sm text-slate-300">{copy.summaryNote}</div>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                {copy.back}
              </button>
              <button className="btn-primary" disabled={loading} onClick={completeSignup}>{loading ? (copy.creating || 'Creating...') : copy.createAccount}</button>
            </div>
          </div>
        )}

        <div className="mt-6 text-sm text-slate-400">{copy.alreadyHaveAccount} <Link href="/login" className="text-green-400">{copy.login}</Link></div>
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
