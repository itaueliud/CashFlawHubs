'use client';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  ArrowRight,
  ClipboardList,
  Zap,
  Briefcase,
  Gift,
  Star,
  TrendingUp,
  Flame,
  Trophy,
  Radio,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const QUICK_ACTIONS = [
  { href: '/dashboard/jobs', icon: Briefcase, labelKey: 'nav.remoteJobs', color: 'bg-purple-500/20 text-purple-400', descKey: 'dashboard.remoteJobsDesc' },
  { href: '/dashboard/surveys', icon: ClipboardList, labelKey: 'nav.paidSurveys', color: 'bg-blue-500/20 text-blue-400', descKey: 'dashboard.paidSurveysDesc' },
  { href: '/dashboard/tasks', icon: Zap, labelKey: 'nav.microtasks', color: 'bg-yellow-500/20 text-yellow-400', descKey: 'dashboard.microtasksDesc' },
  { href: '/dashboard/ads-network', icon: Radio, labelKey: 'nav.adsNetwork', color: 'bg-cyan-500/20 text-cyan-400', descKey: 'dashboard.adsNetworkDesc' },
  { href: '/dashboard/offerwalls', icon: Gift, labelKey: 'nav.offerwalls', color: 'bg-pink-500/20 text-pink-400', descKey: 'dashboard.offerwallsDesc' },
  { href: '/dashboard/cash-tasks', icon: TrendingUp, labelKey: 'nav.cashTasks', color: 'bg-orange-500/20 text-orange-400', descKey: 'dashboard.cashTasksDesc' },
  { href: '/dashboard/referrals', icon: Star, labelKey: 'nav.referAndEarn', color: 'bg-green-500/20 text-green-400', descKey: 'dashboard.referralsDesc' },
  { href: '/dashboard/challenges', icon: Trophy, labelKey: 'nav.dailyChallenges', color: 'bg-amber-500/20 text-amber-400', descKey: 'dashboard.dailyChallengesDesc' },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuthStore();
  const isRealUser = user?.role === 'user' && (user?.userAccessType || 'real') === 'real';
  const blockedForRealUser = new Set(['/dashboard/surveys', '/dashboard/tasks', '/dashboard/ads-network', '/dashboard/offerwalls']);

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/wallet').then((r) => r.data.wallet),
    refetchInterval: 30000,
  });

  const { data: txData } = useQuery({
    queryKey: ['recent-tx'],
    queryFn: () => api.get('/wallet/transactions?limit=5').then((r) => r.data.transactions),
  });

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const wallet = walletData || {};
  const transactions = txData || [];

  const chartData = [
    { day: 'Mon', earn: 0.4 },
    { day: 'Tue', earn: 1.2 },
    { day: 'Wed', earn: 0.8 },
    { day: 'Thu', earn: 2.1 },
    { day: 'Fri', earn: 1.5 },
    { day: 'Sat', earn: 3.2 },
    { day: 'Sun', earn: 1.8 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {!user?.activationStatus && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="font-semibold text-yellow-400">{t('dashboard.accountNotActivated')}</div>
            <div className="text-sm text-slate-400 mt-0.5">{t('dashboard.payToUnlock')}</div>
          </div>
          <Link href="/dashboard/activate" className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
            {t('common.activateNow')}
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card md:col-span-1">
          <div className="text-xs text-slate-400 mb-1">{t('dashboard.totalBalance')}</div>
          <div className="text-4xl font-black text-green-400">${(wallet.balanceUSD || 0).toFixed(2)}</div>
          <div className="text-xs text-slate-500 mt-1">{wallet.symbol}{wallet.balanceLocal || 0} {wallet.currency}</div>
          <div className="mt-3 text-xs text-yellow-300">{user?.tokenBalance || 0} {t('dashboard.tokensAvailable')}</div>
          <div className="mt-3 flex gap-2">
            <Link href="/dashboard/wallet" className="btn-secondary text-xs py-1.5 px-3">{t('nav.wallet')}</Link>
            <Link href="/dashboard/wallet#withdraw" className="btn-primary text-xs py-1.5 px-3">{t('common.withdraw')}</Link>
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">{t('dashboard.thisWeeksEarnings')}</div>
            <div className="text-xs text-green-400">+$9.00</div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="earn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="earn" stroke="#22c55e" fill="url(#earn)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: t('dashboard.surveysDone'), value: user?.surveysCompleted || 0, icon: ClipboardList, color: 'text-blue-400' },
          { label: t('dashboard.tasksDone'), value: user?.tasksCompleted || 0, icon: Zap, color: 'text-yellow-400' },
          { label: t('dashboard.referrals'), value: user?.totalReferrals || 0, icon: Star, color: 'text-green-400' },
          { label: t('common.tokens'), value: user?.tokenBalance || 0, icon: TrendingUp, color: 'text-cyan-400' },
          { label: t('dashboard.dayStreak'), value: `${user?.streak || 0}`, icon: Flame, color: 'text-orange-400' },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <stat.icon size={18} className={`${stat.color} mb-2`} />
            <div className="text-2xl font-black">{stat.value}</div>
            <div className="text-xs text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-bold text-lg mb-3">{t('dashboard.earningModules')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action, index) => {
            const isBlocked = isRealUser && blockedForRealUser.has(action.href);
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`card group relative flex items-center gap-3 transition-all hover:border-slate-500 ${isBlocked ? 'overflow-hidden' : ''}`}
              >
                {isBlocked ? <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-md" /> : null}
                <div className={`relative w-10 h-10 rounded-xl ${action.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${isBlocked ? 'blur-sm' : ''}`}>
                  <action.icon size={18} />
                </div>
                <div className={`relative ${isBlocked ? 'blur-sm select-none' : ''}`}>
                  <div className="font-medium text-sm">{index + 1}. {t(action.labelKey)}</div>
                  <div className="text-xs text-slate-400">{t(action.descKey)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-amber-500/15 bg-gradient-to-br from-amber-950/50 via-slate-950 to-slate-900 p-5 shadow-xl shadow-amber-950/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-300">
              <Trophy size={18} />
              <span className="text-sm font-semibold uppercase tracking-[0.16em]">{t('dashboard.dailyChallenges')}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{t('dashboard.dailyChallengesDesc')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{t('dashboard.resetsAtMidnight')}</span>
            <Link href="/dashboard/challenges" className="btn-primary text-sm inline-flex items-center gap-2">
              {t('common.viewAll')}
              <Trophy size={14} />
            </Link>
          </div>
        </div>
      </div>

      {transactions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">{t('dashboard.recentActivity')}</h2>
            <Link href="/dashboard/wallet" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
              {t('common.viewAll')} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="card space-y-3">
            {transactions.map((tx: any) => (
              <div key={tx._id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`${tx.direction === 'credit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} w-8 h-8 rounded-full flex items-center justify-center text-sm`}>
                    {tx.direction === 'credit' ? '↓' : '↑'}
                  </div>
                  <div>
                    <div className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</div>
                    <div className="text-xs text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className={`font-semibold text-sm ${tx.direction === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.direction === 'credit' ? '+' : '-'}${tx.amountUSD.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
