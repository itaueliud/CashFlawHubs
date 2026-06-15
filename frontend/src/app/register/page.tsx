'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowRight, BadgeInfo, CheckCircle2, ChevronLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import LanguageSelect from '@/components/LanguageSelect';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import { normalizeLanguage, setAppLanguage } from '@/i18n';

const langs = ['en', 'sw', 'fr'];

const countries = [
  { code: 'BJ', name: 'Benin',              dialCode: '+229', localDigits: 8,  hint: '9XXXXXXX' },
  { code: 'BF', name: 'Burkina Faso',       dialCode: '+226', localDigits: 8,  hint: '6XXXXXXX' },
  { code: 'CM', name: 'Cameroon',           dialCode: '+237', localDigits: 9,  hint: '6XXXXXXXX' },
  { code: 'CG', name: 'Congo-Brazzaville',  dialCode: '+242', localDigits: 9,  hint: '6XXXXXXXX' },
  { code: 'CD', name: 'DRC (Dem. Rep. Congo)', dialCode: '+243', localDigits: 9,  hint: '8XXXXXXXX' },
  { code: 'ET', name: 'Ethiopia',           dialCode: '+251', localDigits: 9,  hint: '9XXXXXXXX' },
  { code: 'GA', name: 'Gabon',              dialCode: '+241', localDigits: 7,  hint: '6XXXXXX' },
  { code: 'GH', name: 'Ghana',              dialCode: '+233', localDigits: 9,  hint: '2XXXXXXXX' },
  { code: 'CI', name: 'Ivory Coast (Côte d\'Ivoire)', dialCode: '+225', localDigits: 8,  hint: '0XXXXXXX' },
  { code: 'KE', name: 'Kenya',              dialCode: '+254', localDigits: 9,  hint: '7XXXXXXXX' },
  { code: 'LS', name: 'Lesotho',            dialCode: '+266', localDigits: 8,  hint: '2XXXXXXX' },
  { code: 'MW', name: 'Malawi',             dialCode: '+265', localDigits: 9,  hint: '1XXXXXXXX' },
  { code: 'MZ', name: 'Mozambique',         dialCode: '+258', localDigits: 9,  hint: '8XXXXXXXX' },
  { code: 'NG', name: 'Nigeria',            dialCode: '+234', localDigits: 10, hint: '80XXXXXXXX' },
  { code: 'RW', name: 'Rwanda',             dialCode: '+250', localDigits: 9,  hint: '7XXXXXXXX' },
  { code: 'SN', name: 'Senegal',            dialCode: '+221', localDigits: 9,  hint: '7XXXXXXXX' },
  { code: 'SL', name: 'Sierra Leone',       dialCode: '+232', localDigits: 8,  hint: '7XXXXXXX' },
  { code: 'TZ', name: 'Tanzania',           dialCode: '+255', localDigits: 9,  hint: '7XXXXXXXX' },
  { code: 'UG', name: 'Uganda',             dialCode: '+256', localDigits: 9,  hint: '7XXXXXXXX' },
  { code: 'ZM', name: 'Zambia',             dialCode: '+260', localDigits: 9,  hint: '9XXXXXXXX' },
];

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Create Your Account',
    stepOf: 'Step {step} of 6',
    languageLabel: 'Language',
    languageIntro: 'Choose your language first so every step and email matches how you want to read CashFlowHubs.',
    continue: 'Continue',
    back: 'Back',
    review: 'Review',
    createAccount: 'Complete Account Creation',
    creating: 'Creating...',
    login: 'Login',
    alreadyHaveAccount: 'Already have an account?',
    referralLabel: 'Referral Code (Required)',
    verifyReferral: 'Verify Referral Code',
    referralVerified: 'Referral code verified',
    firstName: 'First Name',
    lastName: 'Last Name',
    idNumber: 'ID Number',
    country: 'Country',
    phoneLabel: 'Phone Number',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm Password',
    passwordPlaceholder: 'Password',
    confirmPasswordPlaceholder: 'Confirm Password',
    phonePlaceholder: 'Phone Number',
    emailPlaceholder: 'Email Address',
    referralRequired: 'Referral code is required',
    invalidReferral: 'Invalid referral code',
    verifyReferralFirst: 'Verify the referral code first',
    completePersonal: 'Complete your personal details',
    emailRequired: 'Email is required',
    invalidEmail: 'Enter a valid email address',
    invalidPhone: 'Enter numbers only for the phone number',
    invalidIdNumber: 'ID number must contain numbers only',
    passwordRules: 'Password must be at least 8 characters and include letters, numbers, and symbols.',
    passwordMismatch: 'Passwords do not match',
    securityCheck: 'Complete the security check',
    registrationFailed: 'Registration failed',
    created: 'Account created',
    emailVerifiedSuccess: 'Email verified successfully',
    emailInvalid: 'Email verification link is invalid or expired',
    summaryTitle: 'Review your details',
    summaryNote: 'Please confirm your details before completing registration.',
    termsLabel: 'I agree to the Terms and Conditions',
    termsHelp: 'Read the terms before accepting them.',
    aboutTitle: 'About CashFlowHubs',
    aboutCopy: 'CashFlowHubs helps you earn through paid surveys, microtasks, remote jobs, offerwalls, freelance gigs, and referrals. You can start free, complete tasks on your own schedule, and withdraw earnings through the supported payment methods in your country.',
    howToEarn: 'How to earn',
    howToEarnCopy: 'Register, finish your profile, choose available earning activities, and keep your account active to unlock more opportunities over time.',
    summaryCountryCode: 'Country code is added automatically from the selected country.',
    phoneLocalLabel: 'Local phone number',
    firstNameRequired: 'First name is required',
    lastNameRequired: 'Last name is required',
    countryRequired: 'Country is required',
    termsRequired: 'You must accept the Terms and Conditions',
    passwordAtTime: 'Fix the password requirements now',
    loginPrompt: 'Already have an account? Login',
    reviewStep: 'Review and confirm your information below.',
  },
  sw: {
    title: 'Fungua Akaunti Yako',
    stepOf: 'Hatua {step} kati ya 6',
    languageLabel: 'Lugha',
    languageIntro: 'Chagua lugha yako kwanza ili kila hatua na barua pepe ziendane na jinsi unavyotaka kusoma CashFlowHubs.',
    continue: 'Endelea',
    back: 'Rudi',
    review: 'Kagua',
    createAccount: 'Maliza Kuunda Akaunti',
    creating: 'Inaandaa...',
    login: 'Ingia',
    alreadyHaveAccount: 'Tayari una akaunti?',
    referralLabel: 'Msimbo wa Rejeleo (Lazima)',
    verifyReferral: 'Thibitisha Msimbo',
    referralVerified: 'Msimbo wa rejeleo umethibitishwa',
    firstName: 'Jina la Kwanza',
    lastName: 'Jina la Mwisho',
    idNumber: 'Namba ya Kitambulisho',
    country: 'Nchi',
    phoneLabel: 'Namba ya Simu',
    emailLabel: 'Barua Pepe',
    passwordLabel: 'Nenosiri',
    confirmPasswordLabel: 'Thibitisha Nenosiri',
    passwordPlaceholder: 'Nenosiri',
    confirmPasswordPlaceholder: 'Thibitisha Nenosiri',
    phonePlaceholder: 'Namba ya Simu',
    emailPlaceholder: 'Barua Pepe',
    referralRequired: 'Msimbo wa rejeleo unahitajika',
    invalidReferral: 'Msimbo wa rejeleo si sahihi',
    verifyReferralFirst: 'Thibitisha msimbo wa rejeleo kwanza',
    completePersonal: 'Kamilisha taarifa zako binafsi',
    emailRequired: 'Barua pepe inahitajika',
    invalidEmail: 'Weka barua pepe sahihi',
    invalidPhone: 'Weka namba pekee kwa simu',
    invalidIdNumber: 'Namba ya kitambulisho lazima iwe namba pekee',
    passwordRules: 'Nenosiri lazima liwe na angalau herufi 8 na liwe na herufi, namba, na alama.',
    passwordMismatch: 'Manenosiri hayalingani',
    securityCheck: 'Kamilisha ukaguzi wa usalama',
    registrationFailed: 'Usajili umefeli',
    created: 'Akaunti imeundwa',
    emailVerifiedSuccess: 'Barua pepe imethibitishwa',
    emailInvalid: 'Kiungo cha uthibitisho wa barua pepe si sahihi au kimeisha muda',
    summaryTitle: 'Kagua taarifa zako',
    summaryNote: 'Tafadhali thibitisha taarifa zako kabla ya kukamilisha usajili.',
    termsLabel: 'Nakubali Sheria na Masharti',
    termsHelp: 'Soma masharti kabla ya kuyakubali.',
    aboutTitle: 'Kuhusu CashFlowHubs',
    aboutCopy: 'CashFlowHubs hukusaidia kupata mapato kupitia surveys zilizo na malipo, microtasks, kazi za mbali, offerwalls, freelance gigs, na referrals. Unaweza kuanza bure, kukamilisha kazi kwa ratiba yako, na kutoa mapato kupitia njia za malipo zinazosaidiwa katika nchi yako.',
    howToEarn: 'Jinsi ya kupata mapato',
    howToEarnCopy: 'Jisajili, kamilisha wasifu wako, chagua shughuli zinazopatikana, na weka akaunti yako hai ili kufungua fursa zaidi kadri muda unavyopita.',
    summaryCountryCode: 'Msimbo wa nchi huongezwa kiotomatiki kulingana na nchi uliyochagua.',
    phoneLocalLabel: 'Namba ya simu ya ndani',
    firstNameRequired: 'Jina la kwanza linahitajika',
    lastNameRequired: 'Jina la mwisho linahitajika',
    countryRequired: 'Nchi inahitajika',
    termsRequired: 'Lazima ukubali Sheria na Masharti',
    passwordAtTime: 'Rekebisha masharti ya nenosiri sasa',
    loginPrompt: 'Tayari una akaunti? Ingia',
    reviewStep: 'Kagua na thibitisha taarifa zako hapa chini.',
  },
  fr: {
    title: 'Créer votre compte',
    stepOf: 'Étape {step} sur 6',
    languageLabel: 'Langue',
    languageIntro: 'Choisissez d’abord votre langue pour que chaque étape et chaque e-mail correspondent à votre façon de lire CashFlowHubs.',
    continue: 'Continuer',
    back: 'Retour',
    review: 'Vérifier',
    createAccount: 'Terminer la création du compte',
    creating: 'Création...',
    login: 'Connexion',
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
    referralLabel: 'Code de parrainage (obligatoire)',
    verifyReferral: 'Vérifier le code',
    referralVerified: 'Code de parrainage vérifié',
    firstName: 'Prénom',
    lastName: 'Nom de famille',
    idNumber: "Numéro d'identité",
    country: 'Pays',
    phoneLabel: 'Numéro de téléphone',
    emailLabel: 'Adresse e-mail',
    passwordLabel: 'Mot de passe',
    confirmPasswordLabel: 'Confirmer le mot de passe',
    passwordPlaceholder: 'Mot de passe',
    confirmPasswordPlaceholder: 'Confirmer le mot de passe',
    phonePlaceholder: 'Numéro de téléphone',
    emailPlaceholder: 'Adresse e-mail',
    referralRequired: 'Le code de parrainage est requis',
    invalidReferral: 'Code de parrainage invalide',
    verifyReferralFirst: 'Vérifiez d’abord le code de parrainage',
    completePersonal: 'Complétez vos informations personnelles',
    emailRequired: "L'e-mail est requis",
    invalidEmail: 'Entrez une adresse e-mail valide',
    invalidPhone: 'Le numéro de téléphone doit contenir uniquement des chiffres',
    invalidIdNumber: "Le numéro d'identité doit contenir uniquement des chiffres",
    passwordRules: 'Le mot de passe doit contenir au moins 8 caractères avec des lettres, des chiffres et des symboles.',
    passwordMismatch: 'Les mots de passe ne correspondent pas',
    securityCheck: 'Terminez la vérification de sécurité',
    registrationFailed: "L'inscription a échoué",
    created: 'Compte créé',
    emailVerifiedSuccess: 'E-mail vérifié avec succès',
    emailInvalid: "Le lien de vérification de l'e-mail est invalide ou expiré",
    summaryTitle: 'Vérifiez vos informations',
    summaryNote: 'Veuillez confirmer vos informations avant de terminer l’inscription.',
    termsLabel: "J'accepte les conditions générales",
    termsHelp: 'Lisez les conditions avant de les accepter.',
    aboutTitle: 'À propos de CashFlowHubs',
    aboutCopy: 'CashFlowHubs vous aide à gagner de l’argent grâce aux sondages rémunérés, aux microtâches, aux offres, aux missions freelance, aux emplois à distance et aux parrainages. Vous pouvez commencer gratuitement, travailler à votre rythme et retirer vos gains via les méthodes de paiement prises en charge dans votre pays.',
    howToEarn: 'Comment gagner',
    howToEarnCopy: 'Inscrivez-vous, complétez votre profil, choisissez les activités disponibles et gardez votre compte actif pour débloquer davantage d’opportunités.',
    summaryCountryCode: 'L’indicatif du pays est ajouté automatiquement selon le pays sélectionné.',
    phoneLocalLabel: 'Numéro local',
    firstNameRequired: 'Le prénom est requis',
    lastNameRequired: 'Le nom de famille est requis',
    countryRequired: 'Le pays est requis',
    termsRequired: 'Vous devez accepter les conditions générales',
    passwordAtTime: 'Corrigez maintenant les exigences du mot de passe',
    loginPrompt: 'Vous avez déjà un compte ? Connexion',
    reviewStep: 'Vérifiez et confirmez vos informations ci-dessous.',
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

const digitsOnly = (value: string) => String(value || '').replace(/\D/g, '');

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const isStrongPassword = (value: string) => {
  const password = String(value || '');
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
};

const getCountry = (code: string) => countries.find((country) => country.code === code) || countries[0];

type FormState = {
  referralCode: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  country: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  browser_language: string;
  user_language: string;
  timezone: string;
  device_fingerprint: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  aboutAccepted: boolean;
};

type FormErrors = {
  referralCode: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  country: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: string;
  privacyAccepted: string;
  aboutAccepted: string;
};

const emptyErrors: FormErrors = {
  referralCode: '',
  firstName: '',
  lastName: '',
  idNumber: '',
  country: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  termsAccepted: '',
  privacyAccepted: '',
  aboutAccepted: '',
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
  const [referralVerified, setReferralVerified] = useState(false);
  const [errors, setErrors] = useState<FormErrors>(emptyErrors);
  const [mounted, setMounted] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<'en' | 'sw' | 'fr'>('en');

  const [form, setForm] = useState<FormState>({
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
    termsAccepted: false,
    privacyAccepted: false,
    aboutAccepted: false,
  });

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';
  const progress = useMemo(() => (step / 6) * 100, [step]);
  const selectedLanguage = uiLanguage;
  const copy = translations[selectedLanguage] || translations.en;
  const renderCopy = (value: string) => value.replace('{step}', String(step));
  const phoneCountry = useMemo(() => getCountry(form.country), [form.country]);
  const formattedPhone = useMemo(() => `${phoneCountry.dialCode}${form.phone}`, [phoneCountry.dialCode, form.phone]);
  const passwordChecks = useMemo(() => {
    const password = form.password;
    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'At least one letter', met: /[A-Za-z]/.test(password) },
      { label: 'At least one number', met: /\d/.test(password) },
      { label: 'At least one symbol', met: /[^A-Za-z0-9]/.test(password) },
    ];
  }, [form.password]);
  const passwordValid = passwordChecks.every((rule) => rule.met);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setError = (field: keyof FormErrors, message = '') => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  const validateReferral = async () => {
    const referralCode = form.referralCode.trim();
    if (!referralCode) {
      setError('referralCode', copy.referralRequired);
      toast.error(copy.referralRequired);
      return false;
    }
    setLoading(true);
    try {
      await api.get(`/referrals/validate/${encodeURIComponent(referralCode)}`);
      setReferralVerified(true);
      setError('referralCode', '');
      toast.success(copy.referralVerified);
      setStep(3);
      return true;
    } catch (err: any) {
      setReferralVerified(false);
      const message = err?.response?.data?.message || copy.invalidReferral;
      setError('referralCode', message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const validateStep3 = () => {
    let valid = true;
    if (!form.firstName.trim()) {
      setError('firstName', copy.firstNameRequired);
      valid = false;
    } else {
      setError('firstName', '');
    }
    if (!form.lastName.trim()) {
      setError('lastName', copy.lastNameRequired);
      valid = false;
    } else {
      setError('lastName', '');
    }
    if (!form.country) {
      setError('country', copy.countryRequired);
      valid = false;
    } else {
      setError('country', '');
    }
    if (form.idNumber && /\D/.test(form.idNumber)) {
      setError('idNumber', copy.invalidIdNumber);
      valid = false;
    } else if (!form.idNumber.trim()) {
      setError('idNumber', copy.invalidIdNumber);
      valid = false;
    } else {
      setError('idNumber', '');
    }
    return valid;
  };

  const validateStep4 = () => {
    let valid = true;
    const country = getCountry(form.country);

    if (!form.phone.trim()) {
      setError('phone', `Enter your local phone number without the leading zero`);
      valid = false;
    } else if (!/^\d+$/.test(form.phone)) {
      setError('phone', 'Numbers only');
      valid = false;
    } else if (form.phone.length !== country.localDigits) {
      setError('phone', `${country.name} numbers must be exactly ${country.localDigits} digits after ${country.dialCode}`);
      valid = false;
    } else {
      setError('phone', '');
    }

    if (!form.email.trim()) {
      setError('email', copy.emailRequired);
      valid = false;
    } else if (!isValidEmail(form.email)) {
      setError('email', copy.invalidEmail);
      valid = false;
    } else {
      setError('email', '');
    }

    return valid;
  };

  const validateStep5 = () => {
    let valid = true;
    if (!isStrongPassword(form.password)) {
      setError('password', copy.passwordRules);
      valid = false;
    } else {
      setError('password', '');
    }

    if (form.confirmPassword !== form.password) {
      setError('confirmPassword', copy.passwordMismatch);
      valid = false;
    } else {
      setError('confirmPassword', '');
    }

    return valid;
  };

  const goBack = () => setStep((currentStep) => Math.max(1, currentStep - 1));

  useEffect(() => {
    if (!form.referralCode || referralVerified || step !== 2) return;
    void validateReferral();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.referralCode, referralVerified, step]);

  useEffect(() => {
    setMounted(true);
    try {
      const storedLanguage =
        localStorage.getItem('cfh_language') ||
        localStorage.getItem('cfh-user-language') ||
        '';
      const browserLanguage = typeof navigator !== 'undefined' ? navigator.language.split('-')[0].toLowerCase() : 'en';
      const nextLanguage = normalizeLanguage(form.user_language || storedLanguage || browserLanguage);
      setUiLanguage(nextLanguage);
      setForm((prev) => ({ ...prev, user_language: prev.user_language || nextLanguage }));
      void setAppLanguage(nextLanguage);
      document.documentElement.lang = nextLanguage;
    } catch {
      setUiLanguage('en');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = selectedLanguage;
  }, [mounted, selectedLanguage]);

  useEffect(() => {
    const stepParam = searchParams?.get('step');
    const emailParam = searchParams?.get('email');
    const emailVerifiedParam = searchParams?.get('emailVerified');
    const reasonParam = searchParams?.get('reason');

    if (stepParam === '4') setStep(4);
    else {
      const savedStep = typeof window !== 'undefined' ? sessionStorage.getItem('register-step') : null;
      if (savedStep && ['1', '2', '3', '4', '5', '6'].includes(savedStep)) {
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

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('register-step', String(step));
        sessionStorage.setItem('register-referral', form.referralCode || '');
        sessionStorage.setItem('register-email', form.email || '');
      }
    } catch {
      // ignore storage errors
    }
  }, [step, form.referralCode, form.email]);

  useEffect(() => {
    const checkVerified = async () => {
      const email = form.email?.trim();
      if (!email) return;

    try {
        const res = await api.get(`/auth/email-verified-status?email=${encodeURIComponent(email)}`);
        if (res.data?.verified) {
          toast.success(copy.emailVerifiedSuccess);
          const referralOk = form.referralCode ? await validateReferral() : true;
          if (referralOk) {
            setStep(4);
          }
        }
      } catch {
        // ignore
      }
    };

    void checkVerified();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email]);

  const handleIdNumberChange = (value: string) => {
    const digits = digitsOnly(value);
    setField('idNumber', digits);
    if (value && value !== digits) {
      setError('idNumber', copy.invalidIdNumber);
      return;
    }
    if (digits) setError('idNumber', '');
  };

  const handlePhoneChange = (value: string) => {
    let digits = value.replace(/\D/g, '');

    // Strip leading zero — user typed 07XX, we store 7XX
    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    // Enforce max length for the selected country
    const country = getCountry(form.country);
    if (digits.length > country.localDigits) {
      digits = digits.slice(0, country.localDigits);
    }

    setField('phone', digits);

    if (!digits) {
      setError('phone', '');
      return;
    }

    if (digits.length < country.localDigits) {
      setError('phone', `Enter ${country.localDigits} digits after the country code (${country.dialCode})`);
    } else {
      setError('phone', '');
    }
  };

  const handleEmailChange = (value: string) => {
    setField('email', value);
    if (!value) {
      setError('email', '');
      return;
    }
    if (!isValidEmail(value)) {
      setError('email', copy.invalidEmail);
      return;
    }
    setError('email', '');
  };

  const handlePasswordChange = (value: string) => {
    setField('password', value);
    if (!value) {
      setError('password', '');
    } else if (!isStrongPassword(value)) {
      setError('password', copy.passwordRules);
    } else {
      setError('password', '');
    }

    if (form.confirmPassword) {
      setError('confirmPassword', value === form.confirmPassword ? '' : copy.passwordMismatch);
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setField('confirmPassword', value);
    if (!value) {
      setError('confirmPassword', '');
    } else if (value !== form.password) {
      setError('confirmPassword', copy.passwordMismatch);
    } else {
      setError('confirmPassword', '');
    }
  };

  const continueFromStep3 = () => {
    if (!validateStep3()) return;
    setStep(4);
  };

  const continueFromStep4 = async () => {
    if (!validateStep4()) return;

    setLoading(true);
    try {
      // Check phone uniqueness
      const fullPhone = `${phoneCountry.dialCode}${form.phone}`;
      const phoneRes = await api.post('/auth/check-availability', { phone: fullPhone });
      if (!phoneRes.data.phoneAvailable) {
        setError('phone', 'This phone number is already registered.');
        setLoading(false);
        return;
      }

      // Check email uniqueness
      if (form.email) {
        const emailRes = await api.post('/auth/check-availability', { email: form.email.toLowerCase().trim() });
        if (!emailRes.data.emailAvailable) {
          setError('email', 'This email address is already registered.');
          setLoading(false);
          return;
        }
      }

      setStep(5);
    } catch {
      // If the check endpoint fails, still allow proceeding — backend will catch it at submit
      setStep(5);
    } finally {
      setLoading(false);
    }
  };

  const continueFromStep5 = () => {
    if (!validateStep5()) return;
    setStep(6);
  };

  const completeSignup = async () => {
    if (!referralVerified) return toast.error(copy.verifyReferralFirst);
    if (!validateStep3() || !validateStep4() || !validateStep5()) return;
    if (!form.termsAccepted || !form.privacyAccepted) {
      setError('termsAccepted', 'You must accept both the Terms and Conditions and the Privacy Policy');
      toast.error('Please accept both the Terms and Conditions and the Privacy Policy');
      return;
    }
    if (turnstileSiteKey && !turnstileToken) return toast.error(copy.securityCheck);

    const browserLanguage = (typeof navigator !== 'undefined' ? navigator.language : 'en').split('-')[0].toLowerCase();
    const selectedLang = normalizeLanguage(form.user_language || uiLanguage || browserLanguage);
    const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';

    setLoading(true);
    try {
      const payload = {
        ...form,
        phone: formattedPhone,
        browser_language: browserLanguage,
        user_language: form.user_language || selectedLang,
        timezone,
        device_fingerprint: deviceFingerprint(),
        turnstileToken: turnstileToken || undefined,
      };

      const res = await api.post('/auth/register', payload);
      const resolvedLanguage = normalizeLanguage(res.data?.user?.userLanguage || payload.user_language);
      localStorage.setItem('cfh-user-language', resolvedLanguage);
      localStorage.setItem('cfh_language', resolvedLanguage);
      document.documentElement.lang = resolvedLanguage;
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
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white md:text-3xl">{copy.title}</h1>
            <p className="mt-1 text-sm text-slate-400">{renderCopy(copy.stepOf)}</p>
          </div>
          <div className="hidden rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300 md:block">
            CashFlowHubs
          </div>
        </div>

        <div className="h-2 rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {['Language', 'Referral', 'Identity', 'Contact', 'Password', 'Review'].map((label, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < step;
            const isCurrent = stepNumber === step;

            return (
              <div
                key={label}
                className={`truncate text-center transition-colors ${
                  isCompleted ? 'text-emerald-400' : isCurrent ? 'text-white' : 'text-slate-600'
                }`}
              >
                {isCompleted ? '✓' : `${stepNumber}.`} {label}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-sm font-semibold text-white">{copy.languageLabel}</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{copy.languageIntro}</p>
              <div className="mt-3">
                <LanguageSelect
                  value={form.user_language || selectedLanguage}
                  label={copy.languageLabel}
                  showAuto
                  onSave={(language) => {
                    setField('user_language', language);
                    setUiLanguage(language);
                    void setAppLanguage(language);
                  }}
                />
              </div>
            </div>
            <button
              className="btn-primary inline-flex items-center gap-2"
              onClick={() => {
                const nextLanguage = normalizeLanguage(form.user_language || selectedLanguage);
                setField('user_language', nextLanguage);
                setUiLanguage(nextLanguage);
                void setAppLanguage(nextLanguage);
                setStep(2);
              }}
            >
              {copy.continue}
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.referralLabel}</label>
              <input
                className="input uppercase"
                value={form.referralCode}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setField('referralCode', value);
                  if (value) setError('referralCode', '');
                }}
                placeholder={copy.referralLabel}
              />
              {errors.referralCode && <p className="mt-1 text-xs text-red-400">{errors.referralCode}</p>}
            </div>
            <button className="btn-primary" disabled={loading} onClick={validateReferral}>
              {loading ? copy.creating : copy.verifyReferral}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-300">{copy.firstName}</label>
                <input
                  className="input"
                  placeholder={copy.firstName}
                  value={form.firstName}
                  onChange={(e) => {
                    setField('firstName', e.target.value);
                    if (e.target.value.trim()) setError('firstName', '');
                  }}
                />
                {errors.firstName && <p className="mt-1 text-xs text-red-400">{errors.firstName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">{copy.lastName}</label>
                <input
                  className="input"
                  placeholder={copy.lastName}
                  value={form.lastName}
                  onChange={(e) => {
                    setField('lastName', e.target.value);
                    if (e.target.value.trim()) setError('lastName', '');
                  }}
                />
                {errors.lastName && <p className="mt-1 text-xs text-red-400">{errors.lastName}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-300">{copy.idNumber}</label>
                <input
                  className="input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={copy.idNumber}
                  value={form.idNumber}
                  onChange={(e) => handleIdNumberChange(e.target.value)}
                />
                {errors.idNumber && <p className="mt-1 text-xs text-red-400">{errors.idNumber}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-300">{copy.country}</label>
                <select
                  className="input"
                  value={form.country}
                  onChange={(e) => {
                    setField('country', e.target.value);
                    setField('phone', '');
                    setError('country', '');
                    setError('phone', '');
                  }}
                >
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {errors.country && <p className="mt-1 text-xs text-red-400">{errors.country}</p>}
              </div>
            </div>



            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                {copy.back}
              </button>
              <button type="button" className="btn-primary" onClick={continueFromStep3}>
                {copy.continue}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 space-y-4">
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
              onError={() => setTurnstileToken('')}
              className="flex justify-center"
            />
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.phoneLabel}</label>
              <div className="flex overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/80 focus-within:border-emerald-500/50">
                <div className="flex items-center border-r border-slate-700 bg-slate-900/80 px-4 text-sm font-semibold text-emerald-300 shrink-0">
                  {phoneCountry.dialCode}
                </div>
                <input
                  className="input border-0 bg-transparent flex-1 min-w-0"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={phoneCountry.hint}
                  maxLength={phoneCountry.localDigits + 1} // +1 to catch leading zero before stripping
                  value={form.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
                <div className={`flex items-center pr-4 text-xs font-mono shrink-0 ${
                  form.phone.length === phoneCountry.localDigits ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  {form.phone.length}/{phoneCountry.localDigits}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Enter your number without the leading zero — {phoneCountry.dialCode} is added automatically
              </p>
              {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.emailLabel}</label>
              <input
                className="input"
                placeholder={copy.emailPlaceholder}
                value={form.email}
                onChange={(e) => handleEmailChange(e.target.value)}
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                {copy.back}
              </button>
              <button type="button" className="btn-primary" onClick={continueFromStep4}>
                {copy.continue}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.passwordLabel}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder={copy.passwordPlaceholder}
                  value={form.password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
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
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">{copy.confirmPasswordLabel}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder={copy.confirmPasswordPlaceholder}
                  value={form.confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
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
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>}
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck size={16} className="text-emerald-400" />
                Password must include:
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                {passwordChecks.map((rule) => (
                  <div key={rule.label} className={`flex items-center gap-2 ${rule.met ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {rule.met ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {rule.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                {copy.back}
              </button>
              <button type="button" className="btn-primary" onClick={continueFromStep5}>
                {copy.review}
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <BadgeInfo size={16} className="text-emerald-400" />
                {copy.summaryTitle}
              </div>
              <p className="text-sm text-slate-400">{copy.reviewStep}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Identity</div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div><span className="text-slate-500">Name:</span> {form.firstName} {form.lastName}</div>
                  <div><span className="text-slate-500">ID Number:</span> {form.idNumber}</div>
                  <div><span className="text-slate-500">Country:</span> {getCountry(form.country).name}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Contact</div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div><span className="text-slate-500">Phone:</span> {formattedPhone}</div>
                  <div><span className="text-slate-500">Email:</span> {form.email}</div>
                  <div><span className="text-slate-500">Language:</span> {form.user_language || selectedLanguage}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5 space-y-5">

              {/* Terms */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-600 bg-slate-800 cursor-pointer"
                  onClick={() => {
                    setField('termsAccepted', !form.termsAccepted);
                    if (!form.termsAccepted) setError('termsAccepted', '');
                  }}
                >
                  {form.termsAccepted && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="text-sm text-slate-300 leading-6">
                  I have read and agree to the{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                  >
                    Terms and Conditions
                  </Link>
                </div>
              </div>

              {/* Privacy */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-600 bg-slate-800 cursor-pointer"
                  onClick={() => {
                    setField('privacyAccepted', !form.privacyAccepted);
                  }}
                >
                  {form.privacyAccepted && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="text-sm text-slate-300 leading-6">
                  I have read and agree to the{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                  >
                    Privacy Policy
                  </Link>
                </div>
              </div>

              {errors.termsAccepted && <p className="text-xs text-red-400">{errors.termsAccepted}</p>}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={goBack}>
                <ChevronLeft size={16} />
                {copy.back}
              </button>
              <button className="btn-primary" disabled={loading} onClick={completeSignup}>
                {loading ? copy.creating : copy.createAccount}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>
            {copy.alreadyHaveAccount}{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
              {copy.login}
            </Link>
          </div>
          {step === 6 && (
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/about" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                About CashFlowHubs
              </Link>
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Terms & Conditions
              </Link>
            </div>
          )}
        </div>

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
