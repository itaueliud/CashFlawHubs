'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
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
} from 'lucide-react';
import clsx from 'clsx';

const BASE_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/jobs', icon: Briefcase, label: 'Remote Jobs' },
  { href: '/dashboard/surveys', icon: ClipboardList, label: 'Paid Surveys' },
  { href: '/dashboard/tasks', icon: Zap, label: 'Microtasks' },
  { href: '/dashboard/ads-network', icon: Radio, label: 'Ads / Ad Network' },
  { href: '/dashboard/offerwalls', icon: Gift, label: 'Offerwalls' },
  { href: '/dashboard/cash-tasks', icon: TrendingUp, label: 'Cash Tasks' },
  { href: '/dashboard/referrals', icon: Star, label: 'Referral Earnings' },
  { href: '/dashboard#daily-challenges', icon: Trophy, label: 'Daily Challenges' },
  { href: '/dashboard/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/dashboard/profile', icon: User, label: 'Profile' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (hasHydrated && !user) router.push('/login');
  }, [hasHydrated, router, user]);

  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  if (!user) return null;

  const nav = user.role === 'admin'
    ? [...BASE_NAV, { href: '/dashboard/admin/provider-health', icon: ShieldCheck, label: 'Provider Health' }]
    : BASE_NAV;

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
                ? <span className="text-green-400">Active · Lvl {user.level}</span>
                : <span className="text-yellow-400">Not Activated</span>}
            </div>
            <div className="text-xs text-yellow-300 mt-1">{user.tokenBalance || 0} Tokens</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              pathname === href ? 'bg-green-500/20 text-green-400' : 'text-slate-400 hover:text-white hover:bg-slate-700'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center mb-3">
          <div className="text-xs text-slate-400">Balance</div>
          <div className="text-xl font-black text-green-400">${(user.balanceUSD || 0).toFixed(2)}</div>
          <div className="text-xs text-yellow-300 mt-1">{user.tokenBalance || 0} Tokens</div>
        </div>
        <button
          onClick={() => {
            logout();
            router.push('/');
          }}
          className="w-full flex items-center gap-2 text-slate-400 hover:text-red-400 text-sm px-3 py-2 rounded-xl hover:bg-red-500/10 transition-all"
        >
          <LogOut size={16} /> Logout
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
            Welcome back, <span className="text-white font-medium">{user.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {!user.activationStatus && (
              <Link href="/dashboard/activate" className="btn-primary text-xs py-1.5 px-3">
                Activate Account
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


