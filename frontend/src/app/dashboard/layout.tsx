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
  Radio,
  MessagesSquare,
  Mail,
  BookOpen,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const BASE_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', category: 'Overview' },
  { href: '/dashboard/jobs', icon: Briefcase, labelKey: 'nav.remoteJobs', category: 'Earn Features' },
  { href: '/dashboard/surveys', icon: ClipboardList, labelKey: 'nav.paidSurveys', category: 'Earn Features' },
  { href: '/dashboard/tasks', icon: Zap, labelKey: 'nav.microtasks', category: 'Earn Features' },
  { href: '/dashboard/ads-network', icon: Radio, labelKey: 'nav.adsNetwork', category: 'Earn Features' },
  { href: '/dashboard/offerwalls', icon: Gift, labelKey: 'nav.offerwalls', category: 'Earn Features' },
  { href: '/dashboard/cash-tasks', icon: TrendingUp, labelKey: 'nav.cashTasks', category: 'Earn Features' },
  { href: '/dashboard/challenges', icon: Trophy, labelKey: 'nav.dailyChallenges', category: 'Earn Features' },
  { href: '/dashboard/chat', icon: MessagesSquare, labelKey: 'nav.jobChats', category: 'Social / Community' },
  { href: '/dashboard/jobs/applications', icon: BookOpen, labelKey: 'nav.myApplications', category: 'Social / Community' },
  { href: '/dashboard/referrals', icon: Star, labelKey: 'nav.referAndEarn', category: 'Social / Community' },
  { href: '/dashboard/wallet', icon: Wallet, labelKey: 'nav.wallet', category: 'Account' },
  { href: '/dashboard/profile', icon: User, labelKey: 'nav.profile', category: 'Account' },
];

const REAL_USER_BLOCKED_ROUTES: string[] = ['/dashboard/tasks', '/dashboard/ads-network', '/dashboard/offerwalls'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, logout, hasHydrated, refreshUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const handleResendVerification = useCallback(async () => {
    setSendingVerification(true);
    try {
      await api.post('/auth/resend-verification-email');
      toast.success('Verification email sent! Check your inbox.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send verification email');
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

  if (!mounted || !hasHydrated || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        {t('common.loadingDashboard')}
      </div>
    );
  }

  const nav = BASE_NAV;

  const isNavActive = (href: string) =>
    href.includes('#')
      ? pathname === href.split('#')[0]
      : pathname === href || pathname.startsWith(`${href}/`);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center font-bold text-sm">C</div>
          <span className="font-bold">CashFlowHubs</span>
        </div>
      </div>

      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold text-sm">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{user.name}</div>
            <div className="text-xs text-slate-400">
              {user.activationStatus
                ? <span className="text-green-400">{t('common.active')} · Lvl {user.level}</span>
                : <span className="text-yellow-400">{t('common.notActivated')}</span>}
            </div>
            <div className="text-xs text-yellow-300 mt-1">{user.tokenBalance || 0} {t('common.tokens')}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {Array.from(new Set(nav.map(n => (n as { category?: string }).category || 'Menu'))).map(category => (
          <div key={category}>
            {category !== 'Menu' && <div className="px-3 mb-2 text-xs font-bold tracking-wider text-emerald-400 uppercase">{category}</div>}
            <div className="space-y-1">
              {nav.filter(n => ((n as { category?: string }).category || 'Menu') === category).map(({ href, icon: Icon, labelKey }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                    isNavActive(href) ? 'bg-green-500/20 text-green-400' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  )}
                >
                  <Icon size={18} />
                  {t(labelKey)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center mb-3">
          <div className="text-xs text-slate-400">{t('common.balance')}</div>
          <div className="text-xl font-black text-green-400">${(user.balanceUSD || 0).toFixed(2)}</div>
          <div className="text-xs text-yellow-300 mt-1">{user.tokenBalance || 0} {t('common.tokens')}</div>
        </div>
        <button
          onClick={() => {
            logout();
            router.push('/');
          }}
          className="w-full flex items-center gap-2 text-slate-400 hover:text-red-400 text-sm px-3 py-2 rounded-xl hover:bg-red-500/10 transition-all"
        >
          <LogOut size={16} /> {t('common.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <aside className="hidden md:flex w-64 bg-slate-800 border-r border-slate-700 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-800 border-r border-slate-700 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="hidden md:block text-sm text-slate-400">
            {t('common.welcomeBack', { name: user.name })}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {!user.activationStatus && (
              <Link href="/dashboard/activate" className="btn-primary text-xs py-1.5 px-3">
                {t('common.activateNow')}
              </Link>
            )}
            <div className="flex items-center gap-1 text-xs bg-slate-700 rounded-full px-3 py-1.5">
              <span className="text-yellow-400">XP</span>
              <span className="text-slate-300">{user.xpPoints || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-xs bg-slate-700 rounded-full px-3 py-1.5">
              <span className="text-green-400">T</span>
              <span className="text-slate-300">{user.tokenBalance || 0}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <Breadcrumbs />
          {!!user.email && !user.emailVerified && !bannerDismissed && (
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-yellow-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-yellow-200">Verify your email address</div>
                  <div className="text-xs text-yellow-400/80">Check your inbox for a verification link, or click resend.</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleResendVerification}
                  disabled={sendingVerification}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-yellow-400 disabled:opacity-50"
                >
                  {sendingVerification && <Loader2 size={12} className="animate-spin" />}
                  Resend
                </button>
                <button onClick={() => setBannerDismissed(true)} className="text-yellow-500/60 hover:text-yellow-300 text-xs px-2 py-1">✕</button>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
