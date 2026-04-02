'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

function ActivationCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    if (!reference) {
      setStatus('error');
      setMessage('Missing payment reference.');
      return;
    }

    const verify = async () => {
      try {
        const response = await api.get(`/payments/verify/${encodeURIComponent(reference)}`);

        if (!response.data.verified) {
          setStatus('error');
          setMessage('Payment has not been confirmed yet. Please try again shortly.');
          return;
        }

        await refreshUser();
        setStatus('success');
        setMessage('Payment verified. Redirecting to your dashboard...');
        toast.success('Account activated successfully.');
        setTimeout(() => router.replace('/dashboard'), 1500);
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Failed to verify payment.');
      }
    };

    verify();
  }, [refreshUser, router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="card w-full max-w-md text-center">
        <div className="mb-4 flex justify-center">
          {status === 'loading' && <Loader2 size={28} className="animate-spin text-green-400" />}
          {status === 'success' && <CheckCircle size={28} className="text-green-400" />}
          {status === 'error' && <XCircle size={28} className="text-red-400" />}
        </div>

        <h1 className="text-xl font-black">
          {status === 'loading' && 'Verifying Payment'}
          {status === 'success' && 'Payment Confirmed'}
          {status === 'error' && 'Verification Failed'}
        </h1>

        <p className="mt-2 text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
}

export default function ActivationCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <ActivationCallbackContent />
    </Suspense>
  );
}
