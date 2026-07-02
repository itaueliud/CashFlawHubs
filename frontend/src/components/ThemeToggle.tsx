'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function ThemeToggle({
  className = '',
  theme: explicitTheme,
  toggleTheme: explicitToggleTheme,
}: {
  className?: string;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
}) {
  const globalThemeCtx = useTheme();
  
  const theme = explicitTheme ?? globalThemeCtx.theme;
  const toggleTheme = explicitToggleTheme ?? globalThemeCtx.toggleTheme;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition
        border-slate-300 bg-white text-slate-600 hover:border-emerald-500/50 hover:text-slate-900
        dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-400/40 dark:hover:text-white
        ${className}`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
