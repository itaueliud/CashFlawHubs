'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Suspense } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const { refreshUser } = useAuthStore();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the URL.');
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/auth/verify-email-token?token=${encodeURIComponent(token)}`);
        if (res.data?.success) {
          setStatus('success');
          setMessage(res.data.message || 'Email verified successfully!');
          refreshUser();
          setTimeout(() => {
            router.push('/dashboard/profile');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(res.data?.message || 'Verification failed.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'Invalid or expired verification link.');
      }
    };

    verify();
  }, [token, refreshUser, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="mx-auto max-w-md w-full rounded-[2rem] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/20 text-center">
        {status === 'loading' && (
          <div className="space-y-4">
            <Loader2 size={48} className="mx-auto animate-spin text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Verifying your email...</h1>
            <p className="text-sm text-slate-400">Please wait while we confirm your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black text-white">Email Verified!</h1>
            <p className="text-sm text-slate-400">{message}</p>
            <Link
              href="/dashboard/profile"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Go to Profile
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
              <XCircle size={32} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-black text-white">Verification Failed</h1>
            <p className="text-sm text-slate-400">{message}</p>
            <Link
              href="/dashboard/profile"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Go to Profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
