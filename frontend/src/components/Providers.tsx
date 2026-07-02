'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/ThemeProvider';
import { I18nextProvider } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import i18n, { detectBrowserLanguage, ensureI18nInitialized, getStoredLanguage, normalizeLanguage, setAppLanguage } from '@/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await ensureI18nInitialized();
      if (mounted) setI18nReady(true);
    };
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const chosen = normalizeLanguage(user?.userLanguage || getStoredLanguage() || detectBrowserLanguage());
    void setAppLanguage(chosen);
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
      <ThemeProvider>
        {i18nReady ? <I18nextProvider i18n={i18n}>{children}</I18nextProvider> : null}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
