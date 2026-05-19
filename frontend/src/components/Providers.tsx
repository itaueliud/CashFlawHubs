'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const chosen = user?.userLanguage || localStorage.getItem('cfh-user-language') || navigator.language.split('-')[0].toLowerCase() || 'en';
    document.documentElement.lang = chosen;
  }, [user?.userLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = async () => {
      const browserLanguage = navigator.language.split('-')[0].toLowerCase();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const manualLang = localStorage.getItem('cfh-user-language');
      if (!manualLang) {
        document.documentElement.lang = browserLanguage;
      }
      if (token) {
        await api.put('/users/profile', {
          browserLanguage,
          timezone,
        }).catch(() => null);
      }
    };
    window.addEventListener('languagechange', handler);
    return () => window.removeEventListener('languagechange', handler);
  }, [token]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
