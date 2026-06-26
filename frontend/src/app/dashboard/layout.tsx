'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import NotificationBell from '@/components/NotificationBell';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import {
  LayoutDashboard,
  ClipboardList,
  Zap,
  Briefcase,
  Gift,
  Star,
  Wallet,
  LogOut,
  User,
  TrendingUp,
  Menu,
  Trophy,
  Video,
  MessagesSquare,
  Mail,
  BookOpen,
  Layers,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type NavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  category?: string;
  hidden?: boolean;
  accent?: 'amber' | 'blue' | 'violet';
};

const BASE_NAV: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', category: 'Overview' },
  { href: '/dashboard/jobs', icon: Briefcase, labelKey: 'nav.remoteJobs', category: 'Earn Features', accent: 'blue' },
  { href: '/dashboard/surveys', icon: ClipboardList, labelKey: 'nav.paidSurveys', category: 'Earn Features' },
  { href: '/dashboard/tasks', icon: Zap, labelKey: 'nav.microtasks', category: 'Earn Features' },
  { href: '/dashboard/ads-network', icon: Video, labelKey: 'nav.adsNetwork', category: 'Earn Features', hidden: true },
  { href: '/dashboard/offerwalls', icon: Gift, labelKey: 'nav.offerwalls', category: 'Earn Features' },
  { href: '/dashboard/creator-hub', icon: Video, labelKey: 'nav.creatorHub', category: 'Earn Features', accent: 'amber' },
  { href: '/dashboard/cash-tasks', icon: TrendingUp, labelKey: 'nav.cashTasks', category: 'Earn Features', accent: 'violet' },
  { href: '/dashboard/challenges', icon: Trophy, labelKey: 'nav.dailyChallenges', category: 'Earn Features' },
  { href: '/dashboard/chat', icon: MessagesSquare, labelKey: 'nav.jobChats', category: 'Social / Community' },
  { href: '/dashboard/jobs/applications', icon: BookOpen, labelKey: 'nav.myApplications', category: 'Social / Community' },
  { href: '/dashboard/jobs/my-posts', icon: Layers, labelKey: 'nav.myPosts', category: 'Social / Community' },
  { href: '/dashboard/referrals', icon: Star, labelKey: 'nav.referAndEarn', category: 'Social / Community' },
  { href: '/dashboard/wallet', icon: Wallet, labelKey: 'nav.wallet', category: 'Account' },
  { href: '/dashboard/profile', icon: User, labelKey: 'nav.profile', category: 'Account' },
];

const REAL_USER_BLOCKED_ROUTES: string[] = ['/dashboard/tasks'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, logout, hasHydrated, refreshUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showMyPosts, setShowMyPosts] = useState<boolean | null>(null);

  const handleResendVerification = useCallback(async () => {
    setSendingVerification(true);
    try {
      await api.post('/auth/resend-verification-email');
      toast.success('Verification email sent! Check your inbox.');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      toast.error(apiError?.response?.data?.message || 'Failed to send verification email');
    } finally {
      setSendingVerification(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      const timer = setTimeout(() => {
        if (!useAuthStore.getState().user) {
          router.push('/login');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasHydrated, router, user]);

  useEffect(() => {
    if (!hasHydrated || !user) return;

    refreshUser();
    const onFocus = () => refreshUser();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [hasHydrated, refreshUser, user?.id]);

  const loadMyPostsVisibility = useCallback(async () => {
    if (!hasHydrated || !user || user.role !== 'user') {
      setShowMyPosts(false);
      return;
    }

    try {
      const { data } = await api.get('/jobs/my-posts?limit=1');
      setShowMyPosts((data?.pagination?.total || 0) > 0);
    } catch {
      setShowMyPosts(false);
    }
  }, [hasHydrated, user?.id, user?.role]);

  useEffect(() => {
    let cancelled = false;

    const syncMyPostsVisibility = async () => {
      if (cancelled) return;
      await loadMyPostsVisibility();
    };

    void syncMyPostsVisibility();

    const onUpdated = () => {
      void syncMyPostsVisibility();
    };

    window.addEventListener('dashboard-my-posts-updated', onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('dashboard-my-posts-updated', onUpdated);
    };
  }, [loadMyPostsVisibility]);

  useEffect(() => {
    if (!hasHydrated || !user) return;

    if (user.role !== 'user') {
      router.replace('/login');
      return;
    }

    if ((user.userAccessType || 'real') === 'test' && pathname.startsWith('/dashboard/coming-soon')) {
      router.push('/dashboard');
      return;
    }
    if ((user.userAccessType || 'real') === 'real' && REAL_USER_BLOCKED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
      const moduleKey = pathname.split('/')[2] || '';
      router.push(`/dashboard/coming-soon?module=${encodeURIComponent(moduleKey)}`);
    }
  }, [hasHydrated, user, pathname, router]);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  if (!mounted || !hasHydrated || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        {t('common.loadingDashboard')}
      </div>
    );
  }

  const nav = BASE_NAV;
  const visibleNav = nav.filter((item) => !(item as { hidden?: boolean }).hidden && (item.href !== '/dashboard/jobs/my-posts' || showMyPosts === true));

  const isNavActive = (href: string) =>
    href.includes('#')
      ? pathname === href.split('#')[0]
      : pathname === href || pathname.startsWith(`${href}/`);

  const SidebarContent = () => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-slate-700 p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500 font-bold text-sm">C</div>
          <span className="font-bold">CashFlowHubs</span>
        </div>
      </div>

      <div className="border-b border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/20 font-bold text-sm text-green-400">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="text-xs text-slate-400">
              {user.activationStatus
                ? <span className="text-green-400">{t('common.active')} - Lvl {user.level}</span>
                : <span className="text-yellow-400">{t('common.notActivated')}</span>}
            </div>
            <div className="mt-1 text-xs text-yellow-300">{user.tokenBalance || 0} {t('common.tokens')}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 space-y-4 overflow-y-auto p-3">
        {Array.from(new Set(visibleNav.map(n => (n as { category?: string }).category || 'Menu'))).map(category => (
          <div key={category}>
            {category !== 'Menu' && <div className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-emerald-400">{category}</div>}
            <div className="space-y-1">
              {visibleNav.filter(n => ((n as { category?: string }).category || 'Menu') === category).map(({ href, icon: Icon, labelKey, accent }) => {
                const active = isNavActive(href);
                const activeClass =
                  accent === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                  accent === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                  accent === 'violet' ? 'bg-violet-500/20 text-violet-400' :
                  'bg-green-500/20 text-green-400';
                const inactiveClass =
                  accent === 'amber' ? 'text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-300' :
                  accent === 'blue' ? 'text-blue-400/60 hover:bg-blue-500/10 hover:text-blue-300' :
                  accent === 'violet' ? 'text-violet-400/60 hover:bg-violet-500/10 hover:text-violet-300' :
                  'text-slate-400 hover:bg-slate-700 hover:text-white';
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                      active ? activeClass : inactiveClass
                    )}
                  >
                    <Icon size={18} />
                    {t(labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-700 p-4">
        <div className="mb-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-center">
          <div className="text-xs text-slate-400">{t('common.balance')}</div>
          <div className="text-xl font-black text-green-400">${(user.balanceUSD || 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-yellow-300">{user.tokenBalance || 0} {t('common.tokens')}</div>
        </div>
        <button
          onClick={() => {
            logout();
            router.push('/');
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={16} /> {t('common.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950 overflow-hidden">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-shrink-0 flex-col border-r border-slate-700 bg-slate-800 md:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute bottom-0 left-0 top-0 w-[min(20rem,86vw)] border-r border-slate-700 bg-slate-800 shadow-2xl shadow-black/40">
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-visible md:ml-64">
        <header className="sticky top-0 z-40 flex flex-col gap-3 border-b border-slate-700 bg-slate-900/95 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-3 md:justify-start">
            <button onClick={() => setMobileOpen(true)} className="text-slate-400 transition hover:text-white md:hidden">
              <Menu size={20} />
            </button>
            <div className="hidden text-sm text-slate-400 md:block">
              {t('common.welcomeBack', { name: user.name })}
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <NotificationBell />
            {!user.activationStatus && (
              <Link href="/dashboard/activate" className="btn-primary text-xs py-1.5 px-3 sm:w-auto">
                {t('common.activateNow')}
              </Link>
            )}
            <div className="flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1.5 text-xs sm:px-3.5">
              <span className="text-yellow-400">XP</span>
              <span className="text-slate-300">{user.xpPoints || 0}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1.5 text-xs sm:px-3.5">
              <span className="text-green-400">T</span>
              <span className="text-slate-300">{user.tokenBalance || 0}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <Breadcrumbs />
          {!!user.email && !user.emailVerified && !bannerDismissed && (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Mail size={18} className="mt-0.5 shrink-0 text-yellow-400" />
                <div>
                  <div className="text-sm font-semibold text-yellow-200">Verify your email address</div>
                  <div className="text-xs text-yellow-400/80">Check your inbox for a verification link, or click resend.</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleResendVerification}
                  disabled={sendingVerification}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-yellow-400 disabled:opacity-50"
                >
                  {sendingVerification && <Loader2 size={12} className="animate-spin" />}
                  Resend
                </button>
                <button onClick={() => setBannerDismissed(true)} className="rounded-lg px-2 py-1 text-xs text-yellow-500/60 transition hover:text-yellow-300">x</button>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}


