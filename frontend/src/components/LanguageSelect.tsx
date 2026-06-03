'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  detectBrowserLanguage,
  normalizeLanguage,
  setAppLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/i18n';

type Props = {
  value?: string;
  label?: string;
  onSave?: (language: SupportedLanguage) => void | Promise<void>;
  className?: string;
  showAuto?: boolean;
};

const AUTO_VALUE = 'auto';

export default function LanguageSelect({ value, label, onSave, className, showAuto = true }: Props) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<SupportedLanguage>(normalizeLanguage(value));

  useEffect(() => {
    setCurrent(normalizeLanguage(value));
  }, [value]);

  const options = useMemo(
    () => [
      ...(showAuto ? [{ value: AUTO_VALUE, label: t('auth.autoDetectLanguage') }] : []),
      { value: 'en', label: t('language.english') },
      { value: 'sw', label: t('language.swahili') },
      { value: 'fr', label: t('language.french') },
    ],
    [showAuto, t]
  );

  const handleChange = async (nextValue: string) => {
    const next = nextValue === AUTO_VALUE ? detectBrowserLanguage() : normalizeLanguage(nextValue);
    setCurrent(next);
    await setAppLanguage(next);
    await onSave?.(next);
  };

  return (
    <label className={`block ${className || ''}`}>
      {label ? <span className="mb-1.5 block text-sm text-slate-300">{label}</span> : null}
      <select
        className="input"
        value={current}
        onChange={(event) => void handleChange(event.target.value)}
      >
        {showAuto ? <option value={AUTO_VALUE}>{t('auth.autoDetectLanguage')}</option> : null}
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {lang === 'en' ? t('language.english') : lang === 'sw' ? t('language.swahili') : t('language.french')}
          </option>
        ))}
      </select>
      <div className="mt-1 text-xs text-slate-500">
        {t('language.selected')}: {current.toUpperCase()}
      </div>
    </label>
  );
}
