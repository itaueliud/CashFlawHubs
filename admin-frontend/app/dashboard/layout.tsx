'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Shield, Flag, Headphones,
  Activity, SlidersHorizontal, ScrollText, User, LogOut, Bell,
  ChevronRight, Menu, X
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

type IconProps = { className?: string };

const IconShell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);

const LayoutDashboardIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="4" rx="1.5" />
    <rect x="14" y="10" width="7" height="11" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </IconShell>
);
const UsersIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <circle cx="8" cy="8" r="3" />
    <path d="M2 21a6 6 0 0 1 12 0" />
    <circle cx="17" cy="9" r="3" />
    <path d="M14 21a5 5 0 0 1 10 0" />
  </IconShell>
);
const ShieldIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M12 3 20 6v6c0 5.5-3.8 8.8-8 12-4.2-3.2-8-6.5-8-12V6z" />
  </IconShell>
);
const FlagIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M5 21V4" />
    <path d="M5 5h11l-2 4 2 4H5" />
  </IconShell>
);
const HeadphonesIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M4 13a8 8 0 0 1 16 0" />
    <rect x="3" y="13" width="4" height="8" rx="1.5" />
    <rect x="17" y="13" width="4" height="8" rx="1.5" />
  </IconShell>
);
const ActivityIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M3 12h4l2-6 4 12 2-6h6" />
  </IconShell>
);
const SlidersIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M4 6h16" />
    <path d="M4 12h10" />
    <path d="M4 18h16" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </IconShell>
);
const ScrollTextIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M6 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4z" />
    <path d="M8 8h6" />
    <path d="M8 12h6" />
  </IconShell>
);
const UserIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <circle cx="12" cy="7" r="4" />
    <path d="M5.5 21a8.5 8.5 0 0 1 13 0" />
  </IconShell>
);
const BellIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V4a2 2 0 1 0-4 0v1.3A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
    <path d="M9 17a3 3 0 0 0 6 0" />
  </IconShell>
);

const navItems = [
  { label: 'Overview',        href: '/dashboard',                   icon: LayoutDashboardIcon },
  { label: 'Users',           href: '/dashboard/users',             icon: UsersIcon },
  { label: 'Referrals',       href: '/dashboard/referrals',         icon: UsersIcon },
  { label: 'Fraud Center',    href: '/dashboard/fraud',             icon: ShieldIcon },
  { label: 'KYC Queue',       href: '/dashboard/kyc',               icon: ShieldIcon },
  { label: 'Challenges',      href: '/dashboard/challenges',        icon: FlagIcon },
  { label: 'Moderation',      href: '/dashboard/moderation',        icon: FlagIcon },
  { label: 'Support',         href: '/dashboard/support',           icon: HeadphonesIcon },
  { label: 'Broadcasts',      href: '/dashboard/notifications',     icon: BellIcon },
  { label: 'Provider Health', href: '/dashboard/provider-health',   icon: ActivityIcon },
  { label: 'Config',          href: '/dashboard/config',            icon: SlidersIcon },
  { label: 'Audit Logs',      href: '/dashboard/audit',             icon: ScrollTextIcon },
  { label: 'Profile',         href: '/dashboard/profile',           icon: UserIcon },
];

const isRouteAllowed = (pathname: string, href: string) => {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hasHydrated, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const allowedPages = useMemo(
    () => (Array.isArray(user?.adminAllowedPages) ? user.adminAllowedPages.filter(Boolean) : []),
    [user?.adminAllowedPages]
  );

  const visibleNavItems = useMemo(() => {
    if (!user) return [];
    if (user.role === 'superadmin') return navItems;
    return navItems.filter((item) => allowedPages.includes(item.href));
  }, [allowedPages, user]);

  const currentSection = visibleNavItems.find((item) => isRouteAllowed(pathname, item.href))?.label || 'Overview';

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
      router.replace('/login');
    }
  }, [hasHydrated, user, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!hasHydrated || !user || !['admin', 'superadmin'].includes(user.role || '')) return;
    if (user.role === 'superadmin') return;
    if (visibleNavItems.length === 0) return;

    const currentRouteAllowed = visibleNavItems.some((item) => isRouteAllowed(pathname, item.href));
    if (currentRouteAllowed) return;

    const fallbackHref = visibleNavItems[0]?.href || '/dashboard';
    if (pathname !== fallbackHref) {
      router.replace(fallbackHref);
    }
  }, [hasHydrated, pathname, router, user, visibleNavItems]);

  if (!mounted || !hasHydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_35%),linear-gradient(180deg,#050816_0%,#07111f_50%,#050816_100%)] px-6 text-slate-100">
        <div className="soft-in w-full max-w-sm rounded-[28px] border border-white/8 bg-white/5 p-6 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div className="text-lg font-black text-white">Checking access</div>
          <p className="mt-2 text-sm text-slate-400">Restoring your session and verifying admin permissions.</p>
        </div>
      </div>
    );
  }

  if (user.role !== 'superadmin' && visibleNavItems.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.10),_transparent_25%),linear-gradient(180deg,#040816_0%,#07111f_48%,#050816_100%)] px-6 text-slate-100">
        <div className="soft-in w-full max-w-md rounded-[28px] border border-white/8 bg-white/5 p-8 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <Shield className="h-5 w-5" />
          </div>
          <div className="text-lg font-black text-white">No pages assigned</div>
          <p className="mt-2 text-sm text-slate-400">
            This admin account currently has no dashboard pages enabled. Add at least one allowed page to restore navigation.
          </p>
          <button
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-sm text-slate-300 transition hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.10),_transparent_25%),linear-gradient(180deg,#040816_0%,#07111f_48%,#050816_100%)] text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[290px_1fr]">
        <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden border-r border-slate-700/50 bg-[#0f172a] backdrop-blur-xl lg:flex">
          <div className="border-b border-slate-700/60 px-5 py-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-black text-white shadow-lg shadow-cyan-500/20">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{user.name}</div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Admin Portal</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300">{user.role}</span>
                  <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 font-medium text-yellow-300">{user.tokenBalance || 0} Tokens</span>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {visibleNavItems.map((item) => {
              const isActive = isRouteAllowed(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${isActive ? 'border-blue-500/20 bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/20 shadow-lg shadow-blue-500/10' : 'border-transparent text-slate-300 hover:border-white/8 hover:bg-slate-700/80 hover:text-white'}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-300' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {isActive && <ChevronRight className="ml-auto h-4 w-4 text-blue-300" />}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-slate-700/60 p-4">
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-4">
              <div className="text-xs text-slate-400">Balance</div>
              <div className="mt-1 text-3xl font-black text-emerald-300 tabular-nums">${(user.balanceUSD || 0).toFixed(2)}</div>
            </div>
            <button onClick={() => { logout(); router.push('/login'); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-300">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/8 bg-[rgba(3,8,22,0.72)] px-4 backdrop-blur-xl lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavOpen((open) => !open)}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10 lg:hidden"
                aria-label="Toggle navigation"
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="text-sm text-slate-300">Welcome back, {user.name}</div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">XP {user.xpPoints || 0}</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{user.role}</div>
              <div className="hidden rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-300 sm:block">{currentSection}</div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="soft-in">{children}</div>
          </main>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />
          <aside className="absolute left-0 top-0 flex h-full w-[82vw] max-w-sm flex-col overflow-hidden border-r border-slate-700/50 bg-[#0f172a] shadow-2xl shadow-black/40">
            <div className="border-b border-slate-700/60 px-5 py-4">
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-black text-white shadow-lg shadow-cyan-500/20">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{user.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Admin Portal</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {visibleNavItems.map((item) => {
                const isActive = isRouteAllowed(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${isActive ? 'border-blue-500/20 bg-blue-500/15 text-blue-300' : 'border-transparent text-slate-300 hover:border-white/8 hover:bg-slate-700/80 hover:text-white'}`}>
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-300' : 'text-slate-400'}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-slate-700/60 p-4">
              <button onClick={() => { logout(); router.push('/login'); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-300">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
