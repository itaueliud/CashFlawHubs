'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeftRight, LayoutGrid, List, Bookmark, UploadCloud, SunMedium, MoonStar } from 'lucide-react';
import clsx from 'clsx';

const TOP_NAV = [
  { href: '/dashboard/creator-hub', label: 'Browse', icon: LayoutGrid },
  { href: '/dashboard/creator-hub/upload', label: 'Upload', icon: UploadCloud },
  { href: '/dashboard/creator-hub/my-uploads', label: 'My Uploads', icon: List },
  { href: '/dashboard/creator-hub/saved', label: 'Saved', icon: Bookmark },
];

export default function CreatorHubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const { user } = useAuthStore();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('creatorHubTheme');
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    } else {
      setTheme('dark');
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    window.localStorage.setItem('creatorHubTheme', theme);
  }, [hydrated, theme]);

  const shellClass = theme === 'dark'
    ? 'border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-black/20'
    : 'border-stone-200 bg-gradient-to-br from-stone-50 via-white to-amber-50 text-slate-900 shadow-[0_20px_80px_rgba(120,53,15,0.08)]';

  const activeMatch = useMemo(() => (href: string) => {
    if (href.includes('#')) return pathname === '/dashboard/creator-hub';
    return pathname === href || pathname.startsWith(`${href}/`);
  }, [pathname]);

  return (
    <section className={clsx('min-h-screen rounded-[28px] border p-4 md:p-6', shellClass, theme === 'dark' ? 'dark' : '')}>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 rounded-[24px] border border-black/5 bg-white/70 p-4 backdrop-blur md:flex-row md:items-end md:justify-between dark:border-white/5 dark:bg-slate-900/70">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <ArrowLeftRight size={12} /> Creator Hub
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">Discover Talent. Promote Your Work. Create Opportunities.</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Browse, unlock, save, and publish premium creator videos with the same token wallet you already use across CashFlowHubs.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {user?.tokenBalance || 0} Tokens
            </div>
            <button
              onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-emerald-300"
            >
              {theme === 'light' ? <MoonStar size={16} /> : <SunMedium size={16} />}
              {theme === 'light' ? 'Dark' : 'Light'} mode
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-black/5 bg-white/80 p-3 backdrop-blur dark:border-white/5 dark:bg-slate-900/80">
          {TOP_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition',
                activeMatch(href)
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>

        <div className="rounded-[28px] border border-black/5 bg-white/90 p-4 text-slate-900 shadow-sm backdrop-blur dark:border-white/5 dark:bg-slate-900/70 dark:text-slate-100 md:p-6">
          {children}
        </div>
      </div>
    </section>
  );
}