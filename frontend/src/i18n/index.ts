'use client';

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import fr from './locales/fr/translation.json';
import sw from './locales/sw/translation.json';

export const SUPPORTED_LANGUAGES = ['en', 'sw', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const LANGUAGE_STORAGE_KEY = 'cfh_language';
export const LEGACY_LANGUAGE_STORAGE_KEY = 'cfh-user-language';

const resources = {
  en: { translation: en },
  sw: { translation: sw },
  fr: { translation: fr },
};

export const normalizeLanguage = (language?: string | null): SupportedLanguage => {
  const value = String(language || '').trim().toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value) ? (value as SupportedLanguage) : 'en';
};

export const detectBrowserLanguage = (): SupportedLanguage => {
  if (typeof navigator === 'undefined') return 'en';
  return normalizeLanguage(navigator.language);
};

export const getStoredLanguage = (): SupportedLanguage | null => {
  if (typeof window === 'undefined') return null;
  const direct = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  const legacy = localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
  const stored = direct || legacy;
  return stored ? normalizeLanguage(stored) : null;
};

export const setAppLanguage = async (language?: string | null) => {
  const next = normalizeLanguage(language);
  if (!i18n.isInitialized) {
    await ensureI18nInitialized();
  }
  await i18n.changeLanguage(next);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    localStorage.setItem(LEGACY_LANGUAGE_STORAGE_KEY, next);
    document.documentElement.lang = next;
  }
  return next;
};

export const ensureI18nInitialized = async () => {
  if (i18n.isInitialized) return i18n;

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      },
      react: {
        useSuspense: false,
      },
      defaultNS: 'translation',
    });

  return i18n;
};

if (typeof window !== 'undefined') {
  void ensureI18nInitialized();
}

export default i18n;
