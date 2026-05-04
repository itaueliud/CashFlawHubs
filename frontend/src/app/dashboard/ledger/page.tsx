'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function LedgerStandalonePage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'ledger') {
      router.replace('/dashboard');
      return;
    }
    router.replace('/dashboard/admin/ledger');
  }, [hasHydrated, router, user]);
  return <div className="card text-sm text-slate-400">Opening ledger workspace...</div>;
}
