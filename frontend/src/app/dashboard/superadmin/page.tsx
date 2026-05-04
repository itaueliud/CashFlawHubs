'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperadminStandalonePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/admin/admins');
  }, [router]);
  return <div className="card text-sm text-slate-400">Opening superadmin workspace...</div>;
}
