'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import { setAppLanguage, normalizeLanguage } from '@/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [twoFactorChallengeId, setTwoFactorChallengeId] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const { register, handleSubmit, getValues } = useForm<{ identifier: string; password: string }>();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

  const onSubmit = async (data: { identifier: string; password: string }) => {
    if (turnstileSiteKey && !turnstileToken) {
      toast.error('Please complete the security check');
      return;
    }

    if (requiresTwoFactor && !twoFactorCode.trim()) {
      toast.error('Enter your 2FA code');
      return;
    }

    setIsLoading(true);
    try {
      const browserLanguage = (typeof navigator !== 'undefined' ? navigator.language : 'en').split('-')[0].toLowerCase();
      const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
      const isTwoFactorStep = requiresTwoFactor && twoFactorChallengeId;
      const currentUser = await login(
        data.identifier,
        data.password,
        turnstileToken || undefined,
        browserLanguage,
        timezone,
        undefined,
        isTwoFactorStep ? twoFactorCode.trim() : undefined,
        isTwoFactorStep ? twoFactorChallengeId : undefined
      );

      if ((currentUser as any)?.requires2FA) {
        setRequiresTwoFactor(true);
        setTwoFactorChallengeId((currentUser as any).challengeId);
        setTwoFactorCode('');
        toast.success('Enter your authenticator code to finish signing in');
        return;
      }

      if ('role' in currentUser && currentUser.role && currentUser.role !== 'user') {
        toast.error('Staff accounts must use their dedicated portal.');
        router.replace('/login');
        return;
      }
      const language = normalizeLanguage(('userLanguage' in currentUser ? currentUser.userLanguage : undefined) || browserLanguage || 'en');
      await setAppLanguage(language);
      setRequiresTwoFactor(false);
      setTwoFactorChallengeId('');
      setTwoFactorCode('');
      toast.success('Welcome back');
      if (typeof window !== 'undefined') {
        window.location.assign('/dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      if (status === 403) {
        if (String(serverMsg || '').toLowerCase().includes('staff')) {
          toast.error('Staff accounts must use the dedicated staff portal.');
        } else if (String(serverMsg || '').toLowerCase().includes('admin')) {
          toast.error('Admin credentials required. Please use the admin portal.');
        } else {
          toast.error(serverMsg || 'Access denied');
        }
      } else {
        toast.error(serverMsg || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center font-black text-xl mx-auto mb-4">C</div>
          <h1 className="text-2xl font-black">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Login to your CashFlowHubs account</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Email or Phone Number</label>
              <input {...register('identifier')} placeholder="name@example.com or +254712345678" className="input" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Password</label>
              <div className="relative">
                <input {...register('password')} type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password" className="input pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {requiresTwoFactor && (
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Authenticator code</label>
                <input
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123 456"
                  className="input tracking-[0.35em] text-center font-semibold"
                />
                <p className="mt-1 text-xs text-slate-500">Enter the 6-digit code from your authenticator app.</p>
              </div>
            )}
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
              onError={() => setTurnstileToken('')}
              className="flex justify-center"
            />
            <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Log in'}
            </button>
          </form>
          <p className="text-center text-slate-400 text-sm mt-5">
            Don't have an account?{' '}
            <Link href="/register" className="text-green-400 hover:text-green-300 font-medium">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
