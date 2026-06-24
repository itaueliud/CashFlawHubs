'use client';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ArrowRight, ClipboardList, Zap, Briefcase, Gift, Star, TrendingUp, Flame, Trophy, Video } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const QUICK_ACTIONS = [
  { href: '/dashboard/jobs', icon: Briefcase, labelKey: 'nav.remoteJobs', color: 'bg-cyan-500/20 text-cyan-400', descKey: 'dashboard.remoteJobsDesc' },
  { href: '/dashboard/surveys', icon: ClipboardList, labelKey: 'nav.paidSurveys', color: 'bg-blue-500/20 text-blue-400', descKey: 'dashboard.paidSurveysDesc' },
  { href: '/dashboard/tasks', icon: Zap, labelKey: 'nav.microtasks', color: 'bg-amber-500/20 text-amber-400', descKey: 'dashboard.microtasksDesc' },
  { href: '/dashboard/ads-network', icon: Video, labelKey: 'nav.adsNetwork', color: 'bg-cyan-500/20 text-cyan-400', descKey: 'dashboard.adsNetworkDesc', hidden: true },
  { href: '/dashboard/offerwalls', icon: Gift, labelKey: 'nav.offerwalls', color: 'bg-pink-500/20 text-pink-400', descKey: 'dashboard.offerwallsDesc' },
  { href: '/dashboard/creator-hub', icon: Video, labelKey: 'nav.creatorHub', color: 'bg-emerald-500/20 text-emerald-400', descKey: 'dashboard.creatorHubDesc' },
  { href: '/dashboard/cash-tasks', icon: TrendingUp, labelKey: 'nav.cashTasks', color: 'bg-orange-500/20 text-orange-400', descKey: 'dashboard.cashTasksDesc' },
  { href: '/dashboard/referrals', icon: Star, labelKey: 'nav.referAndEarn', color: 'bg-green-500/20 text-green-400', descKey: 'dashboard.referralsDesc' },
  { href: '/dashboard/challenges', icon: Trophy, labelKey: 'nav.dailyChallenges', color: 'bg-violet-500/20 text-violet-400', descKey: 'dashboard.dailyChallengesDesc' },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuthStore();
  const isRealUser = user?.role === 'user' && (user?.userAccessType || 'real') === 'real';
  const blockedForRealUser = new Set(['/dashboard/tasks']);

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

  const weekdayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const txByDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  let weeklyTotal = 0;
  transactions.forEach((tx: any) => {
    try {
      const d = new Date(tx.createdAt);
      const day = weekdayOrder[d.getUTCDay()];
      const amt = Number(tx.direction === 'credit' ? tx.amountUSD : -tx.amountUSD) || 0;
      txByDay[day] = (txByDay[day] || 0) + amt;
      weeklyTotal += amt;
    } catch (e) {
      // ignore parsing errors
    }
  });

  const chartData = weekdayOrder.map((day) => ({ day, earn: Number((txByDay[day] || 0).toFixed(4)) }));

  return (
    <div className="space-y-6 animate-fade-in">
      {!user?.activationStatus && (
        <div className="card flex items-center justify-between gap-4 border-amber-500/15 bg-amber-500/10 p-4">
          <div>
            <div className="font-semibold text-amber-300">{t('dashboard.accountNotActivated')}</div>
            <div className="text-sm text-slate-400 mt-0.5">{t('dashboard.payToUnlock')}</div>
          </div>
          <Link href="/dashboard/activate" className="btn-primary ledger-button press text-sm py-2 px-4 whitespace-nowrap">
            {t('common.activateNow')}
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-1 p-5">
          <div className="text-xs text-slate-400 mb-1">{t('dashboard.totalBalance')}</div>
          <div className="text-4xl font-black text-green-400">${(wallet.balanceUSD || 0).toFixed(2)}</div>
          <div className="text-xs text-slate-500 mt-1">{wallet.symbol}{wallet.balanceLocal || 0} {wallet.currency}</div>
          <div className="mt-3 text-xs text-yellow-300">{user?.tokenBalance || 0} {t('dashboard.tokensAvailable')}</div>
          <div className="mt-3 flex gap-2">
            <Link href="/dashboard/wallet" className="btn-secondary ledger-button press text-xs py-1.5 px-3">{t('nav.wallet')}</Link>
            <Link href="/dashboard/wallet#withdraw" className="btn-primary ledger-button press text-xs py-1.5 px-3">{t('common.withdraw')}</Link>
          </div>
        </div>

        <div className="card md:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">{t('dashboard.thisWeeksEarnings')}</div>
            <div className="text-xs text-green-400">{weeklyTotal >= 0 ? `+$${weeklyTotal.toFixed(2)}` : `-$${Math.abs(weeklyTotal).toFixed(2)}`}</div>
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: t('dashboard.surveysDone'), value: user?.surveysCompleted || 0, icon: ClipboardList, color: 'text-blue-400' },
          { label: t('dashboard.tasksDone'), value: user?.tasksCompleted || 0, icon: Zap, color: 'text-yellow-400' },
          { label: t('dashboard.referrals'), value: user?.totalReferrals || 0, icon: Star, color: 'text-green-400' },
          { label: t('common.tokens'), value: wallet.tokenBalance || 0, icon: TrendingUp, color: 'text-cyan-400' },
          { label: t('dashboard.dayStreak'), value: `${user?.streak || 0}`, icon: Flame, color: 'text-orange-400' },
        ].map((stat) => (
          <div key={stat.label} className="stat-card stat-card-cyan">
            <stat.icon size={18} className={`${stat.color} mb-2`} />
            <div className="text-2xl font-black">{stat.value}</div>
            <div className="text-xs text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">{t('dashboard.earningModules')}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {QUICK_ACTIONS.filter((action) => !(action as { hidden?: boolean }).hidden).map((action, index) => {
            const isBlocked = isRealUser && blockedForRealUser.has(action.href);
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`quick-link hover-lift press group relative flex items-center gap-3 ${isBlocked ? 'overflow-hidden' : ''}`}
              >
                {isBlocked ? <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-md" /> : null}
                <div className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${action.color} transition-transform group-hover:scale-110 ${isBlocked ? 'blur-sm' : ''}`}>
                  <action.icon size={18} />
                </div>
                <div className={`relative ${isBlocked ? 'select-none blur-sm' : ''}`}>
                  <div className="font-medium text-sm">{index + 1}. {t(action.labelKey)}</div>
                  <div className="text-xs text-slate-400">{t(action.descKey)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card border border-amber-500/15 bg-gradient-to-br from-amber-950/50 via-slate-950 to-slate-900 p-5">
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
            <Link href="/dashboard/challenges" className="btn-primary ledger-button press text-sm inline-flex items-center gap-2">
              {t('common.viewAll')}
              <Trophy size={14} />
            </Link>
          </div>
        </div>
      </div>

      {transactions.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{t('dashboard.recentActivity')}</h2>
            <Link href="/dashboard/wallet" className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
              {t('common.viewAll')} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="card space-y-2 p-4">
            {transactions.map((tx: any) => (
              <div key={tx._id} className="inner-item flex items-center justify-between px-4 py-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`${tx.direction === 'credit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} flex h-8 w-8 items-center justify-center rounded-full text-sm`}>
                    {tx.direction === 'credit' ? 'v' : '^'}
                  </div>
                  <div>
                    <div className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</div>
                    <div className="text-xs text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className={`text-sm font-semibold ${tx.direction === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
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
