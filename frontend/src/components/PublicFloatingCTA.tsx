'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WhatsAppButton } from './WhatsAppButton';

export function PublicFloatingCTA() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname() || '';
  const hiddenPrefixes = ['/dashboard', '/login', '/register', '/activation', '/verify-email'];
  const isHidden = hiddenPrefixes.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isHidden) return null;

  return <WhatsAppButton phoneNumber="254712345678" message="Hi CashFlowHubs, I need help getting started." />;
}
