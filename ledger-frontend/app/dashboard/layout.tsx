'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
const CreditCardIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M6 15h4" />
  </IconShell>
);
const SwapIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M7 7h12l-3-3" />
    <path d="M17 17H5l3 3" />
  </IconShell>
);
const SearchIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </IconShell>
);
const RouteIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M4 7h16" />
    <path d="M4 12h10" />
    <path d="M4 17h16" />
  </IconShell>
);
const ClipboardIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <path d="M10 2H8a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2" />
    <path d="M9 10h6" />
    <path d="M9 14h6" />
  </IconShell>
);
const UserIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <circle cx="12" cy="7" r="4" />
    <path d="M5.5 21a8.5 8.5 0 0 1 13 0" />
  </IconShell>
);
const LogOutIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
    <path d="M21 3v18" />
  </IconShell>
);
const BellIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V4a2 2 0 1 0-4 0v1.3A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
    <path d="M9 17a3 3 0 0 0 6 0" />
  </IconShell>
);
const MenuIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </IconShell>
);
const CloseIcon = ({ className = '' }: IconProps) => (
  <IconShell className={className}>
    <path d="M18 6 6 18" />
    <path d="M6 6l12 12" />
  </IconShell>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hasHydrated, logout, refreshUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!hasHydrated || !user || user.role !== 'ledger') return;

    void refreshUser();
    const onFocus = () => {
      void refreshUser();
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [hasHydrated, refreshUser, user?.id]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user || user.role !== 'ledger') {
      router.replace('/login');
    }
  }, [hasHydrated, user, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const navItems = useMemo(
    () => [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboardIcon },
      { label: 'Payout Control', href: '/dashboard/payout-control', icon: CreditCardIcon },
      { label: 'Weekly Report', href: '/dashboard/weekly-report', icon: ClipboardIcon },
      { label: 'Reports', href: '/dashboard/reports', icon: SwapIcon },
      { label: 'Payment Rails', href: '/dashboard/payment-rails', icon: RouteIcon },
      { label: 'Batch History', href: '/dashboard/batch-history', icon: ClipboardIcon },
      { label: 'Manual Payout', href: '/dashboard/manual-payout', icon: CreditCardIcon },
      { label: 'Payout Rules', href: '/dashboard/rules', icon: RouteIcon },
      { label: 'Activations', href: '/dashboard/activations', icon: BellIcon },
      { label: 'Carry-Over', href: '/dashboard/carryover', icon: SwapIcon },
      { label: 'Transactions', href: '/dashboard/transactions', icon: SwapIcon },
      { label: 'Reconciliation', href: '/dashboard/reconciliation', icon: SearchIcon },
      { label: 'Audit Logs', href: '/dashboard/audit', icon: ClipboardIcon },
      { label: 'Analytics', href: '/dashboard/analytics', icon: ClipboardIcon },
      { label: 'Admins', href: '/dashboard/admins', icon: BellIcon },
      { label: 'Profile', href: '/dashboard/profile', icon: UserIcon },
    ],
    []
  );

  const currentSection = navItems.find((item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)))?.label || 'Overview';

  if (!mounted || !hasHydrated || !user || user.role !== 'ledger') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-6 text-slate-100">
        <div className="card-surface soft-in w-full max-w-sm rounded-[28px] p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <BellIcon className="h-5 w-5" />
          </div>
          <div className="text-lg font-black text-white">Checking access</div>
          <p className="mt-2 text-sm text-slate-400">Restoring your session and verifying ledger permissions.</p>
        </div>
      </div>
    );
  }

  const displayName = user.name || 'Ledger Operator';
  const roleLabel = user.role || 'ledger';
  const tokens = Number(user.tokenBalance || 0);

  return (
    <div className="dashboard-shell ledger-app min-h-screen text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
        <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden bg-[rgba(8,17,31,0.94)] shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl lg:flex">
          <div className="flex flex-none items-center gap-3 px-5 py-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 font-black text-white shadow-lg shadow-cyan-500/25">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">CashFlowHubs Ledger</div>
              <div className="mt-1 text-xs text-cyan-300">Ledger operator</div>
              <div className="mt-1 text-xs text-yellow-300">{tokens} Tokens</div>
            </div>
          </div>

          <nav className="scrollbar-none min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'border-cyan-500/20 bg-cyan-500/15 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:border-white/8 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex-none p-4 pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/10 p-4">
              <div className="text-xs text-slate-400">Workspace</div>
              <div className="mt-1 text-xl font-black text-white">Ledger operator</div>
              <div className="mt-2 text-xs text-slate-400">Role</div>
              <div className="mt-1 text-sm font-semibold text-cyan-300 tabular-nums">{roleLabel}</div>
              <div className="mt-2 text-xs text-slate-400">Tokens</div>
              <div className="mt-1 text-sm font-semibold text-yellow-300 tabular-nums">{tokens}</div>
            </div>
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-300"
            >
              <LogOutIcon className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-[rgba(3,7,18,0.76)] px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavOpen((open) => !open)}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10 lg:hidden"
                aria-label="Toggle navigation"
              >
                {mobileNavOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              </button>
              <div className="text-sm text-slate-300">Welcome back, {displayName}</div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">XP {user.xpPoints || 0}</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">T {tokens}</div>
              <div className="hidden rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-300 sm:block">{currentSection}</div>
            </div>
          </header>

          <main className="h-screen flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="soft-in">{children}</div>
          </main>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />
          <aside className="absolute left-0 top-0 flex h-full w-[82vw] max-w-sm flex-col overflow-hidden bg-[rgba(8,17,31,0.98)] shadow-2xl shadow-black/40">
            <div className="flex flex-none items-center gap-3 px-5 py-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 font-black text-white shadow-lg shadow-cyan-500/25">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white">CashFlowHubs Ledger</div>
                <div className="mt-1 text-xs text-cyan-300">Ledger operator</div>
              </div>
            </div>
            <nav className="scrollbar-none min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'border-cyan-500/20 bg-cyan-500/15 text-cyan-300'
                        : 'border-transparent text-slate-400 hover:border-white/8 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="flex-none p-4 pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <button
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-300"
              >
                <LogOutIcon className="h-4 w-4" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

