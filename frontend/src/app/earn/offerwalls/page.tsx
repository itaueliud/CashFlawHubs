import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Shield, ShoppingBag, TrendingUp, Zap } from 'lucide-react';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Offerwalls in Africa - Apps, Trials, and Offers That Pay',
  description:
    'Complete offerwalls on CashFlowHubs: install apps, sign up for services, and complete partner campaigns for cash rewards across Africa.',
  keywords: [
    'offerwalls Africa',
    'offerwall tasks Kenya',
    'app install offers Africa',
    'paid offers online Africa',
    'cash offers Kenya',
  ],
  alternates: { canonical: 'https://www.cashflowhubs.com/earn/offerwalls' },
  openGraph: {
    title: 'Offerwalls in Africa - CashFlowHubs',
    description: 'Apps, trials, and offers that pay real cash across Africa.',
    url: 'https://www.cashflowhubs.com/earn/offerwalls',
  },
};

const OFFERWALLS = [
  { title: 'App installs', desc: 'Install and open partner apps for rewards.' },
  { title: 'Free trials', desc: 'Sign up for services and complete the required steps.' },
  { title: 'Short offers', desc: 'Finish quick campaigns like account creation or form submissions.' },
  { title: 'Newsletter signups', desc: 'Join newsletters and promotional lists for small payouts.' },
  { title: 'Survey bridges', desc: 'Complete short offerwall surveys before entering the main survey wall.' },
  { title: 'Bonus campaigns', desc: 'Limited-time offers with extra payout during promotions.' },
];

const FAQ = [
  { q: 'Are offerwall rewards safe?', a: 'Yes. CashFlowHubs tracks offer completion and only credits valid rewards after confirmation from the provider.' },
  { q: 'Why do some offers require verification?', a: 'Verification helps ensure the reward is legitimate and prevents duplicate submissions or fraud.' },
  { q: 'How much can I earn?', a: 'Offer rewards vary by campaign, but bonuses can add up quickly when you complete multiple offers consistently.' },
  { q: 'Can I use offerwalls on mobile?', a: 'Yes. Most offers are mobile-friendly and can be completed from a phone browser.' },
];

export default function EarnOfferwallsPage() {
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-900/20 via-transparent to-green-900/10" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-sm text-pink-400">
            <Zap size={14} /> Apps, trials, and offers
          </div>
          <h1 className="mb-6 text-5xl font-black leading-tight md:text-6xl">
            Offerwalls in Africa
            <br />
            <span className="text-pink-400">Apps, Trials, and Offers for Cash</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400">
            Complete partner campaigns and earn real cash. Offerwalls are a fast way to boost your wallet balance.
          </p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-lg">
            Start Earning Free <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Campaign Types', value: '6' },
            { label: 'Providers', value: 'Multiple' },
            { label: 'Countries Covered', value: '20' },
            { label: 'Rewards', value: 'Varies' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center py-5">
              <div className="text-2xl font-black text-amber-400">{stat.value}</div>
              <div className="mt-1 text-xs text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-3xl font-bold">Offerwall Campaign Types</h2>
          <p className="mb-12 text-center text-slate-400">Choose the kind of offer that fits your time and phone data budget</p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {OFFERWALLS.map((offer) => (
              <div key={offer.title} className="card">
                <h3 className="mb-2 text-lg font-bold">{offer.title}</h3>
                <p className="text-sm text-slate-400">{offer.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold">How Offerwalls Work</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '01', title: 'Open an Offer', desc: 'Pick a partner campaign from the dashboard and read the instructions carefully.', icon: ShoppingBag },
              { step: '02', title: 'Complete the Steps', desc: 'Install, sign up, or test the offer exactly as required to qualify for the reward.', icon: CheckCircle },
              { step: '03', title: 'Receive Reward', desc: 'When the partner confirms completion, the reward is added to your wallet.', icon: TrendingUp },
            ].map((item) => (
              <div key={item.step} className="card relative overflow-hidden text-center">
                <div className="absolute right-4 top-3 text-6xl font-black text-slate-700/50">{item.step}</div>
                <item.icon className="mx-auto mb-3 text-pink-400" size={32} />
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

      <section className="bg-gradient-to-br from-pink-900/30 to-slate-900 px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <TrendingUp className="mx-auto mb-4 text-amber-400" size={48} />
          <h2 className="mb-4 text-4xl font-black">Boost Your Balance With Offerwalls</h2>
          <p className="mb-8 text-slate-400">Earn on simple actions and cash out faster</p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg">
            Create Free Account <ArrowRight size={20} />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={12} /> Reliable campaigns, verified rewards
          </p>
        </div>
      </section>
    </div>
  );
}
