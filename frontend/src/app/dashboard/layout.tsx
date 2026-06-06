'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import NotificationBell from '@/components/NotificationBell';
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
  ShieldCheck,
  Shield,
  FileBarChart2,
  Download,
  Receipt,
  KeyRound,
  Activity,
  UsersRound,
  Landmark,
  Gauge,
  MessagesSquare,
  SlidersHorizontal,
  ShieldAlert,
  ClipboardCheck,
} from 'lucide-react';
import clsx from 'clsx';

const BASE_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { href: '/dashboard/jobs', icon: Briefcase, labelKey: 'nav.remoteJobs' },
  { href: '/dashboard/surveys', icon: ClipboardList, labelKey: 'nav.paidSurveys' },
  { href: '/dashboard/tasks', icon: Zap, labelKey: 'nav.microtasks' },
  { href: '/dashboard/ads-network', icon: Radio, labelKey: 'nav.adsNetwork' },
  { href: '/dashboard/offerwalls', icon: Gift, labelKey: 'nav.offerwalls' },
  { href: '/dashboard/cash-tasks', icon: TrendingUp, labelKey: 'nav.cashTasks' },
  { href: '/dashboard/referrals', icon: Star, labelKey: 'nav.referAndEarn' },
  { href: '/dashboard/chat', icon: MessagesSquare, labelKey: 'nav.jobChats' },
  { href: '/dashboard/challenges', icon: Trophy, labelKey: 'nav.dailyChallenges' },
  { href: '/dashboard/wallet', icon: Wallet, labelKey: 'nav.wallet' },
  { href: '/dashboard/profile', icon: User, labelKey: 'nav.profile' },
];

const REAL_USER_BLOCKED_ROUTES: string[] = [];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, logout, hasHydrated, refreshUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (hasHydrated && !user) router.push('/login');
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

    if (user.role === 'user') {
      if ((user.userAccessType || 'real') === 'test' && pathname.startsWith('/dashboard/coming-soon')) {
        router.push('/dashboard');
        return;
      }
      if ((user.userAccessType || 'real') === 'real' && REAL_USER_BLOCKED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
        const moduleKey = pathname.split('/')[2] || '';
        router.push(`/dashboard/coming-soon?module=${encodeURIComponent(moduleKey)}`);
        return;
      }
      if (pathname.startsWith('/dashboard/admin') || pathname.startsWith('/dashboard/admin-console') || pathname.startsWith('/dashboard/ledger') || pathname.startsWith('/dashboard/superadmin')) {
        router.push('/dashboard');
      }
      return;
    }

    if (user.role === 'ledger' && pathname.startsWith('/dashboard/admin/users')) {
      router.push('/dashboard/ledger');
      return;
    }

    if (user.role === 'admin' && (pathname === '/dashboard' || pathname.startsWith('/dashboard/surveys') || pathname.startsWith('/dashboard/tasks') || pathname.startsWith('/dashboard/ads-network') || pathname.startsWith('/dashboard/offerwalls') || pathname.startsWith('/dashboard/cash-tasks') || pathname.startsWith('/dashboard/referrals') || pathname.startsWith('/dashboard/wallet') || pathname.startsWith('/dashboard/profile') || pathname.startsWith('/dashboard/activate') || pathname.startsWith('/dashboard/freelance') || pathname.startsWith('/dashboard/admin/ledger') || pathname.startsWith('/dashboard/admin/admins') || pathname.startsWith('/dashboard/ledger') || pathname.startsWith('/dashboard/superadmin'))) {
      router.push('/dashboard/admin-console');
      return;
    }

    if (user.role === 'superadmin' && (pathname === '/dashboard' || pathname.startsWith('/dashboard/surveys') || pathname.startsWith('/dashboard/tasks') || pathname.startsWith('/dashboard/ads-network') || pathname.startsWith('/dashboard/offerwalls') || pathname.startsWith('/dashboard/cash-tasks') || pathname.startsWith('/dashboard/referrals') || pathname.startsWith('/dashboard/wallet') || pathname.startsWith('/dashboard/profile') || pathname.startsWith('/dashboard/activate') || pathname.startsWith('/dashboard/freelance'))) {
      router.push('/dashboard/superadmin');
      return;
    }

    if (user.role === 'ledger' && (pathname === '/dashboard' || pathname.startsWith('/dashboard/jobs') || pathname.startsWith('/dashboard/surveys') || pathname.startsWith('/dashboard/tasks') || pathname.startsWith('/dashboard/ads-network') || pathname.startsWith('/dashboard/offerwalls') || pathname.startsWith('/dashboard/cash-tasks') || pathname.startsWith('/dashboard/referrals') || pathname.startsWith('/dashboard/wallet') || pathname.startsWith('/dashboard/profile') || pathname.startsWith('/dashboard/activate') || pathname.startsWith('/dashboard/freelance'))) {
      router.push('/dashboard/ledger');
    }
  }, [hasHydrated, user, pathname, router]);

  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        {t('common.loadingDashboard')}
      </div>
    );
  }

  if (!user) return null;

  const userBaseNav = BASE_NAV;

  const nav = user.role === 'ledger'
    ? [
        { href: '/dashboard/ledger', icon: Gauge, labelKey: 'nav.overview' },
        { href: '/dashboard/admin/ledger', icon: Landmark, labelKey: 'nav.payoutControl' },
        { href: '/dashboard/admin/admins', icon: ShieldCheck, labelKey: 'nav.admins' },
        { href: '/dashboard/ledger/reports', icon: FileBarChart2, labelKey: 'nav.reports' },
        { href: '/dashboard/ledger/export', icon: Download, labelKey: 'nav.export' },
        { href: '/dashboard/ledger/transactions', icon: Receipt, labelKey: 'nav.transactions' },
        { href: '/dashboard/ledger/reconciliation', icon: ClipboardCheck, labelKey: 'nav.reconciliation' },
        { href: '/dashboard/admin/audit', icon: ShieldAlert, labelKey: 'nav.audit' },
        { href: '/dashboard/admin/config', icon: SlidersHorizontal, labelKey: 'nav.config' },
        { href: '/dashboard/ledger/profile', icon: KeyRound, labelKey: 'nav.profile' },
      ]
    : user.role === 'admin'
    ? [
        { href: '/dashboard/admin-console', icon: Gauge, labelKey: 'nav.overview' },
        { href: '/dashboard/jobs', icon: Briefcase, labelKey: 'nav.remoteJobs' },
        { href: '/dashboard/admin/users', icon: UsersRound, labelKey: 'nav.users' },
        { href: '/dashboard/admin/moderation', icon: ShieldCheck, labelKey: 'nav.moderation' },
        { href: '/dashboard/admin/support', icon: MessagesSquare, labelKey: 'nav.support' },
        { href: '/dashboard/admin/audit', icon: ShieldAlert, labelKey: 'nav.audit' },
        { href: '/dashboard/admin/provider-health', icon: Activity, labelKey: 'nav.providerHealth' },
      ]
    : user.role === 'superadmin'
      ? [
          { href: '/dashboard/superadmin', icon: Shield, labelKey: 'nav.overview' },
          { href: '/dashboard/jobs', icon: Briefcase, labelKey: 'nav.remoteJobs' },
          { href: '/dashboard/admin/users', icon: UsersRound, labelKey: 'nav.users' },
          { href: '/dashboard/admin/admins', icon: ShieldCheck, labelKey: 'nav.admins' },
          { href: '/dashboard/admin/moderation', icon: ShieldCheck, labelKey: 'nav.moderation' },
          { href: '/dashboard/admin/support', icon: MessagesSquare, labelKey: 'nav.support' },
          { href: '/dashboard/admin/audit', icon: ShieldAlert, labelKey: 'nav.audit' },
          { href: '/dashboard/admin/config', icon: SlidersHorizontal, labelKey: 'nav.config' },
          { href: '/dashboard/admin/provider-health', icon: Activity, labelKey: 'nav.providerHealth' },
        ]
      : userBaseNav;

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

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ href, icon: Icon, labelKey }) => (
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
          {children}
        </div>
      </main>
    </div>
  );
}
