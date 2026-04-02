'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, ClipboardList, Zap, Briefcase, Gift,
  Star, Wallet, LogOut, User, Bell, TrendingUp, Menu
} from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/surveys', icon: ClipboardList, label: 'Surveys' },
  { href: '/dashboard/tasks', icon: Zap, label: 'Tasks' },
  { href: '/dashboard/offerwalls', icon: Gift, label: 'Offerwalls' },
  { href: '/dashboard/jobs', icon: Briefcase, label: 'Remote Jobs' },
  { href: '/dashboard/freelance', icon: TrendingUp, label: 'Freelance' },
  { href: '/dashboard/referrals', icon: Star, label: 'Referrals' },
  { href: '/dashboard/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/dashboard/profile', icon: User, label: 'Profile' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user]);

  if (!user) return null;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center font-bold text-sm">C</div>
          <span className="font-bold">CashflowConnect</span>
        </div>
      </div>

      {/* User card */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold text-sm">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{user.name}</div>
            <div className="text-xs text-slate-400">
              {user.activationStatus
                ? <span className="text-green-400">✓ Active · Lvl {user.level}</span>
                : <span className="text-yellow-400">⚠ Not Activated</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            onClick={() => setMobileOpen(false)}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              pathname === href
                ? 'bg-green-500/20 text-green-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            )}>
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Balance pill */}
      <div className="p-4 border-t border-slate-700">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center mb-3">
          <div className="text-xs text-slate-400">Balance</div>
          <div className="text-xl font-black text-green-400">${(user.balanceUSD || 0).toFixed(2)}</div>
        </div>
        <button onClick={() => { logout(); router.push('/'); }}
          className="w-full flex items-center gap-2 text-slate-400 hover:text-red-400 text-sm px-3 py-2 rounded-xl hover:bg-red-500/10 transition-all">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-slate-800 border-r border-slate-700 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="hidden md:block text-sm text-slate-400">
            👋 Welcome back, <span className="text-white font-medium">{user.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {!user.activationStatus && (
              <Link href="/dashboard/activate" className="btn-primary text-xs py-1.5 px-3">
                Activate Account
              </Link>
            )}
            <div className="flex items-center gap-1 text-xs bg-slate-700 rounded-full px-3 py-1.5">
              <span className="text-yellow-400">⚡</span>
              <span className="text-slate-300">{user.xpPoints || 0} XP</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
