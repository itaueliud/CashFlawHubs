import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle, Shield, Share2, Star, TrendingUp, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Referral Earnings in Africa - Invite Friends and Earn 200 KES',
  description:
    'Earn referral rewards on CashFlowHubs by inviting friends across Africa. Get paid 200 KES per activated referral and share your link on WhatsApp, Telegram, and more.',
  keywords: [
    'referral program Africa',
    'earn 200 KES referral',
    'WhatsApp referral link Africa',
    'invite friends earn Kenya',
  ],
  alternates: { canonical: 'https://www.cashflowhubs.com/earn/referrals' },
  openGraph: {
    title: 'Referral Earnings in Africa - CashFlowHubs',
    description: 'Invite friends and earn 200 KES per activated referral.',
    url: 'https://www.cashflowhubs.com/earn/referrals',
  },
};

const FAQ = [
  { q: 'How much do I earn per referral?', a: 'You earn 200 KES when your friend registers and activates their account according to the program rules.' },
  { q: 'How do I share my referral link?', a: 'Share the link on WhatsApp, Telegram, Facebook, or directly through SMS and social media.' },
  { q: 'When do referral rewards appear?', a: 'Rewards are credited after your referral completes the required activation step and passes the system checks.' },
  { q: 'Can I track my referrals?', a: 'Yes. Your referral dashboard shows your link, total referrals, and leaderboard ranking.' },
];

const STEPS = [
  'Copy your unique referral link',
  'Share it on WhatsApp or Telegram',
  'Your friend signs up through your link',
  'You earn 200 KES when activation completes',
];

export default function EarnReferralsPage() {
  const shareText = 'Join CashFlowHubs and start earning from surveys, tasks, remote jobs, and referral bonuses. Sign up free today!';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500 font-bold text-sm">C</div>
            <span className="text-lg font-bold">CashFlowHubs</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-outline px-4 py-2 text-sm">Login</Link>
            <Link href="/register" className="btn-primary px-4 py-2 text-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-4 pb-28 pt-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-green-900/20 via-transparent to-slate-900/10" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-sm text-green-400">
            <Share2 size={14} /> Share your link, earn more
          </div>
          <h1 className="mb-6 text-5xl font-black leading-tight md:text-6xl">
            Referral Earnings in Africa
            <br />
            <span className="text-green-400">Invite Friends and Earn 200 KES</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400">
            Share your link with friends and earn when they activate. Referrals are one of the fastest ways to build passive income on CashFlowHubs.
          </p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-lg">
            Create Free Account <ArrowRight size={20} />
          </Link>
          <p className="mt-4 text-sm text-slate-500">{shareText}</p>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Per Referral', value: '200 KES' },
            { label: 'Link Shares', value: 'Unlimited' },
            { label: 'Reward Speed', value: 'Fast' },
            { label: 'Countries Covered', value: '20' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center py-5">
              <div className="text-2xl font-black text-green-400">{stat.value}</div>
              <div className="mt-1 text-xs text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-3xl font-bold">How Referral Earnings Work</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {STEPS.map((step, index) => (
              <div key={step} className="card flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/20 font-bold text-green-300">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="text-sm text-slate-300">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Share Anywhere</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { title: 'WhatsApp', desc: 'Use a short, clear message that shows the value and the signup link.', icon: MessageCircle },
              { title: 'Telegram', desc: 'Post in groups and channels where people already ask about income opportunities.', icon: Share2 },
              { title: 'Social media', desc: 'Share on Facebook, X, and Instagram stories to reach more people quickly.', icon: Star },
            ].map((item) => (
              <div key={item.title} className="card text-center">
                <item.icon className="mx-auto mb-3 text-green-400" size={28} />
                <h3 className="mb-2 text-lg font-bold">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="card">
                <h3 className="mb-2 font-bold">{item.q}</h3>
                <p className="text-sm text-slate-400">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-green-900/30 to-slate-900 px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Users className="mx-auto mb-4 text-green-400" size={48} />
          <h2 className="mb-4 text-4xl font-black">Start Referring Today</h2>
          <p className="mb-8 text-slate-400">200 KES per friend. No limits. Instant rewards after activation.</p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg">
            Create Free Account <ArrowRight size={20} />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={12} /> Instant rewards, no limits, withdraw anytime
          </p>
        </div>
      </section>
    </div>
  );
}
