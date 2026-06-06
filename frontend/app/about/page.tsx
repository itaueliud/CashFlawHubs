import Link from 'next/link';
import { ArrowLeft, ArrowRight, BadgeInfo, CheckCircle2, Coins, Globe2, ShieldCheck, Sparkles, Zap } from 'lucide-react';

const earningPaths = [
  {
    title: 'Paid surveys',
    text: 'Answer simple questions from brands and research partners. Some surveys take just a few minutes and can fit into spare time.',
  },
  {
    title: 'Microtasks',
    text: 'Complete quick actions like tagging, categorization, testing, or simple data checks to build up earnings steadily.',
  },
  {
    title: 'Remote jobs and gigs',
    text: 'Explore job listings and freelance opportunities that match your skills, experience, and schedule.',
  },
  {
    title: 'Offerwalls and promotions',
    text: 'Complete partner offers and supported campaigns for extra rewards when they are available in your region.',
  },
  {
    title: 'Referrals',
    text: 'Invite friends to join the platform and earn when they complete eligible actions according to the program rules.',
  },
  {
    title: 'Consistent activity',
    text: 'Stay active, keep your profile updated, and return regularly to unlock more earning opportunities over time.',
  },
];

const highlights = [
  'Free to start',
  'Country-aware payment routing',
  'Multiple ways to earn',
  'Built for mobile users',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/register" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
          <ArrowLeft size={16} />
          Back to registration
        </Link>

        <section className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/20 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
            <BadgeInfo size={14} />
            About CashFlowHubs
          </div>
          <h1 className="mt-5 text-3xl font-black md:text-5xl">Earn through simple online work, in a system built for African users.</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
            CashFlowHubs brings together paid surveys, microtasks, remote jobs, freelance gigs, offerwalls, and referrals in one place.
            You can get started for free, work from your phone or laptop, and use the payment options available in your country when you are ready to withdraw.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {highlights.map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <ShieldCheck className="text-emerald-400" size={24} />
            <h2 className="mt-3 text-lg font-bold">Start safely</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Create your account, review the terms, and keep your profile information accurate so the platform can match you with the right opportunities.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <Globe2 className="text-emerald-400" size={24} />
            <h2 className="mt-3 text-lg font-bold">Work from anywhere</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Many activities are mobile-friendly, so you can complete tasks during free time without needing a full desktop setup.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <Coins className="text-emerald-400" size={24} />
            <h2 className="mt-3 text-lg font-bold">Withdraw locally</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Payment routing is tuned for supported countries so withdrawals can be processed using the methods most people already use.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-6 md:p-8">
          <div className="flex items-center gap-2 text-emerald-400">
            <Sparkles size={18} />
            <span className="text-sm font-semibold uppercase tracking-[0.14em]">How to earn</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {earningPaths.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  {item.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 md:p-8">
          <div className="flex items-center gap-2 text-emerald-400">
            <Zap size={18} />
            <span className="text-sm font-semibold uppercase tracking-[0.14em]">What to expect</span>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Earning depends on the tasks available, your country, your profile, and your activity on the platform.
            CashFlowHubs is designed to give you flexible ways to participate, not guaranteed income.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary inline-flex items-center gap-2">
              Create account
              <ArrowRight size={16} />
            </Link>
            <Link href="/terms" className="btn-secondary inline-flex items-center gap-2">
              Read terms
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
