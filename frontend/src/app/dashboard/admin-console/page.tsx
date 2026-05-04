'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminConsoleStandalonePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/admin/users');
  }, [router]);
  return <div className="card text-sm text-slate-400">Opening admin console...</div>;
}
