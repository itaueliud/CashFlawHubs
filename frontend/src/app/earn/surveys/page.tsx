import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Clock, DollarSign, Shield, Star, TrendingUp, Zap } from 'lucide-react';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Paid Surveys in Kenya and Africa - Share Opinions, Withdraw via M-Pesa',
  description:
    'Complete paid surveys on CashFlowHubs and earn real money across Africa. New surveys are added daily from top providers. Withdraw via M-Pesa, MTN MoMo, Flutterwave, and more.',
  keywords: [
    'paid surveys Kenya',
    'paid surveys Nigeria',
    'paid surveys Africa',
    'earn money online surveys',
    'online surveys that pay cash Africa',
    'survey sites Kenya',
    'best survey sites Africa',
  ],
  alternates: { canonical: 'https://www.cashflowhubs.com/earn/surveys' },
  openGraph: {
    title: 'Paid Surveys in Kenya and Africa - CashFlowHubs',
    description: 'New surveys daily. Withdraw via M-Pesa, MTN MoMo, Flutterwave, and more.',
    url: 'https://www.cashflowhubs.com/earn/surveys',
  },
};

const SURVEY_PROVIDERS = [
  { name: 'CPX Research', reward: 'Up to $3.00', time: '5-20 min', badge: 'Top Rated' },
  { name: 'Pollfish', reward: 'Up to $1.50', time: '2-10 min', badge: 'Fast' },
  { name: 'Bitlabs', reward: 'Up to $2.50', time: '10-15 min', badge: 'Popular' },
  { name: 'Ysense', reward: 'Up to $1.20', time: '5-12 min', badge: 'Daily' },
  { name: 'Theorem Reach', reward: 'Up to $2.00', time: '8-18 min', badge: 'High Pay' },
];

const FAQ = [
  { q: 'How do I get paid for surveys?', a: 'Your earnings are credited to your CashFlowHubs wallet after each completed survey. Withdraw via M-Pesa, MTN MoMo, Flutterwave, or Telebirr anytime.' },
  { q: 'How many surveys can I complete per day?', a: 'There is no daily limit. New surveys are added continuously from multiple providers, so availability varies by your profile.' },
  { q: 'Which countries can do paid surveys?', a: 'CashFlowHubs surveys are available in Kenya, Nigeria, Ghana, Uganda, Tanzania, Ethiopia, Rwanda, South Africa, and more African countries.' },
  { q: 'What is the minimum withdrawal?', a: 'You can withdraw from as little as KSh 200 or the local equivalent depending on your country and payment method.' },
];

export default function EarnSurveysPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-outline px-4 py-2 text-sm">Login</Link>
            <Link href="/register" className="btn-primary px-4 py-2 text-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-4 pb-28 pt-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-green-900/10" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-400">
            <Zap size={14} /> 5 Survey Providers - New Surveys Daily
          </div>
          <h1 className="mb-6 text-5xl font-black leading-tight md:text-6xl">
            Earn Money With
            <br />
            <span className="text-blue-400">Paid Surveys</span> in Africa
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400">
            Share your opinion and earn up to $3 per survey. Withdraw instantly via M-Pesa, MTN MoMo, Flutterwave, and more.
          </p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-lg">
            Start Earning Free <ArrowRight size={20} />
          </Link>
          <p className="mt-4 text-sm text-slate-500">No credit card, no minimum hours, instant payouts</p>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Survey Providers', value: '5+' },
            { label: 'Countries Covered', value: '20' },
            { label: 'Minimum Withdrawal', value: 'KSh 200' },
            { label: 'Payout Methods', value: 'Mobile money' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center py-5">
              <div className="text-2xl font-black text-amber-400">{stat.value}</div>
              <div className="mt-1 text-xs text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-3xl font-bold">Survey Providers on CashFlowHubs</h2>
          <p className="mb-12 text-center text-slate-400">Multiple providers mean more surveys and more earnings for you</p>
          <div className="space-y-4">
            {SURVEY_PROVIDERS.map((provider) => (
              <div key={provider.name} className="card flex items-center justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-bold">{provider.name}</span>
                    <span className="badge badge-blue">{provider.badge}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1"><Clock size={12} /> {provider.time}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-400">{provider.reward}</div>
                  <div className="text-xs text-slate-500">per survey</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold">How Paid Surveys Work</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '01', title: 'Create Free Account', desc: 'Sign up in 2 minutes. Complete your profile to qualify for more surveys.', icon: CheckCircle },
              { step: '02', title: 'Pick a Survey', desc: 'Browse available surveys from 5+ providers. See reward and time before you start.', icon: Star },
              { step: '03', title: 'Withdraw Earnings', desc: 'Earnings land in your wallet instantly. Withdraw via M-Pesa or other mobile wallets.', icon: DollarSign },
            ].map((item) => (
              <div key={item.step} className="card relative overflow-hidden text-center">
                <div className="absolute right-4 top-3 text-6xl font-black text-slate-700/50">{item.step}</div>
                <item.icon className="mx-auto mb-3 text-blue-400" size={32} />
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

      <section className="bg-gradient-to-br from-blue-900/30 to-slate-900 px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <TrendingUp className="mx-auto mb-4 text-amber-400" size={48} />
          <h2 className="mb-4 text-4xl font-black">Start Earning From Surveys Today</h2>
          <p className="mb-8 text-slate-400">Join thousands of Africans already earning on CashFlowHubs</p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg">
            Create Free Account <ArrowRight size={20} />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={12} /> Secure, verified, real payments
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-800 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 md:flex-row">
          <p>2025 CashFlowHubs. Built for Africa.</p>
          <div className="flex gap-6">
            <Link href="/earn/jobs" className="hover:text-white">Remote Jobs</Link>
            <Link href="/earn/tasks" className="hover:text-white">Microtasks</Link>
            <Link href="/earn/offerwalls" className="hover:text-white">Offerwalls</Link>
            <Link href="/earn/referrals" className="hover:text-white">Referrals</Link>
          </div>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
    </div>
  );
}
