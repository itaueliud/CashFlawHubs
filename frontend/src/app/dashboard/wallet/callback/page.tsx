'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

function WalletCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirming your token purchase...');

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    if (!reference) {
      setStatus('error');
      setMessage('Missing token purchase reference.');
      return;
    }

    const verify = async () => {
      try {
        const response = await api.get(`/payments/verify/${encodeURIComponent(reference)}`);

        if (!response.data.verified) {
          setStatus('error');
          setMessage('Payment has not been confirmed yet. Please wait a moment and check your wallet again.');
          return;
        }

        await refreshUser();
        localStorage.removeItem('cashflawhubs-pending-token-purchase');
        setStatus('success');
        setMessage('Tokens credited successfully. Returning to your wallet...');
        toast.success('Token purchase completed.');
        setTimeout(() => router.replace('/dashboard/wallet'), 1500);
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Failed to verify token purchase.');
      }
    };

    verify();
  }, [refreshUser, router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="card w-full max-w-md text-center">
        <div className="mb-4 flex justify-center">
          {status === 'loading' && <Loader2 size={28} className="animate-spin text-cyan-300" />}
          {status === 'success' && <CheckCircle size={28} className="text-green-400" />}
          {status === 'error' && <XCircle size={28} className="text-red-400" />}
        </div>

        <h1 className="text-xl font-black">
          {status === 'loading' && 'Verifying Tokens'}
          {status === 'success' && 'Tokens Added'}
          {status === 'error' && 'Verification Failed'}
        </h1>

        <p className="mt-2 text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
}

export default function WalletCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <WalletCallbackContent />
    </Suspense>
  );
}
