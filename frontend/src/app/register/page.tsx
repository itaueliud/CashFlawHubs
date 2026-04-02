'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Loader2, Phone, Lock, User, Globe } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Name too short'),
  phone: z.string().min(9, 'Enter valid phone number'),
  country: z.string().min(2, 'Select your country'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  otp: z.string().length(6, 'Enter 6-digit OTP'),
  referralCode: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const COUNTRIES = [
  { code: 'KE', name: '🇰🇪 Kenya' },
  { code: 'UG', name: '🇺🇬 Uganda' },
  { code: 'TZ', name: '🇹🇿 Tanzania' },
  { code: 'ET', name: '🇪🇹 Ethiopia' },
  { code: 'GH', name: '🇬🇭 Ghana' },
  { code: 'NG', name: '🇳🇬 Nigeria' },
];

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setToken } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { referralCode: searchParams.get('ref') || '' },
  });

  const phone = watch('phone');
  const country = watch('country');

  const sendOTP = async () => {
    if (!phone || !country) return toast.error('Enter phone and select country first');
    setSendingOtp(true);
    try {
      await api.post('/auth/send-otp', { phone, country });
      setOtpSent(true);
      toast.success('OTP sent to your phone!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', data);
      setToken(res.data.token);
      setUser(res.data.user);
      toast.success('Account created! Welcome to CashflowConnect 🎉');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center font-black text-xl mx-auto mb-4">C</div>
          <h1 className="text-2xl font-black">Join CashflowConnect</h1>
          <p className="text-slate-400 text-sm mt-1">Start earning in minutes</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                <User size={14} /> Full Name
              </label>
              <input {...register('name')} placeholder="Jane Doe" className="input" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>

            {/* Country */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                <Globe size={14} /> Country
              </label>
              <select {...register('country')} className="input">
                <option value="">Select your country</option>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              {errors.country && <p className="text-red-400 text-xs mt-1">{errors.country.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                <Phone size={14} /> Phone Number
              </label>
              <div className="flex gap-2">
                <input {...register('phone')} placeholder="+254712345678" className="input flex-1" />
                <button type="button" onClick={sendOTP} disabled={sendingOtp}
                  className="btn-secondary text-sm px-3 whitespace-nowrap">
                  {sendingOtp ? <Loader2 size={16} className="animate-spin" /> : 'Send OTP'}
                </button>
              </div>
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
            </div>

            {/* OTP */}
            {otpSent && (
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">OTP Code</label>
                <input {...register('otp')} placeholder="6-digit code" className="input" maxLength={6} />
                {errors.otp && <p className="text-red-400 text-xs mt-1">{errors.otp.message}</p>}
              </div>
            )}

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                <Lock size={14} /> Password
              </label>
              <div className="relative">
                <input {...register('password')} type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters" className="input pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Referral */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Referral Code (optional)</label>
              <input {...register('referralCode')} placeholder="REF-XXXXXXXX" className="input" />
            </div>

            <button type="submit" disabled={isLoading || !otpSent} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-green-400 hover:text-green-300 font-medium">Login</Link>
          </p>
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
