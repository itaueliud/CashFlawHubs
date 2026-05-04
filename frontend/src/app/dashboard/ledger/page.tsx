'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LedgerStandalonePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/admin/ledger');
  }, [router]);
  return <div className="card text-sm text-slate-400">Opening ledger workspace...</div>;
}
