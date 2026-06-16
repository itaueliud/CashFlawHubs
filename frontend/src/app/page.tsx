import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle, DollarSign, Globe, Shield, Star, TrendingUp, Users, Zap } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { SITE_URL } from '@/lib/seo';

const EARN_METHODS = [
  { icon: '📋', title: 'Paid Surveys', desc: 'Share your opinion and earn up to $3 per survey', color: 'from-blue-500 to-blue-600' },
  { icon: '⚡', title: 'Microtasks', desc: 'Quick tasks: labeling, testing, tagging', color: 'from-yellow-500 to-yellow-600' },
  { icon: '💼', title: 'Remote Jobs', desc: 'Find legitimate remote jobs across Africa', color: 'from-purple-500 to-purple-600' },
  { icon: '🎯', title: 'Offerwalls', desc: 'Install apps and complete offers for rewards', color: 'from-pink-500 to-pink-600' },
  { icon: '🛠️', title: 'Freelance Gigs', desc: 'Sell your skills to clients globally', color: 'from-orange-500 to-orange-600' },
  { icon: '🤝', title: 'Referrals', desc: 'Earn 200 KES for every friend you invite', color: 'from-green-500 to-green-600' },
];

const COUNTRIES = [
  { flag: '🇰🇪', name: 'Kenya', payment: 'M-Pesa' },
  { flag: '🇺🇬', name: 'Uganda', payment: 'MTN MoMo' },
  { flag: '🇹🇿', name: 'Tanzania', payment: 'Vodacom' },
  { flag: '🇪🇹', name: 'Ethiopia', payment: 'Telebirr' },
  { flag: '🇬🇭', name: 'Ghana', payment: 'Flutterwave' },
  { flag: '🇳🇬', name: 'Nigeria', payment: 'Flutterwave' },
  { flag: '🇷🇼', name: 'Rwanda', payment: 'Jenga' },
  { flag: '🇨🇩', name: 'DR Congo', payment: 'Jenga' },
  { flag: '🇸🇸', name: 'South Sudan', payment: 'Jenga' },
  { flag: '🇿🇲', name: 'Zambia', payment: 'Tingg' },
  { flag: '🇧🇼', name: 'Botswana', payment: 'Tingg' },
  { flag: '🇧🇯', name: 'Benin', payment: 'Tingg' },
  { flag: '🇿🇦', name: 'South Africa', payment: 'Onafriq' },
  { flag: '🇸🇳', name: 'Senegal', payment: 'Onafriq' },
  { flag: '🇨🇲', name: 'Cameroon', payment: 'Onafriq' },
  { flag: '🇲🇱', name: 'Mali', payment: 'Onafriq' },
  { flag: '🇨🇮', name: 'Ivory Coast', payment: 'Paystack' },
  { flag: '🇪🇬', name: 'Egypt', payment: 'Paystack' },
  { flag: '🇳🇪', name: 'Niger', payment: 'Onafriq' },
  { flag: '🇲🇼', name: 'Malawi', payment: 'Tingg' },
];


export const metadata: Metadata = {
  title: 'Earn Money Online Across Africa - Surveys, Tasks & Remote Jobs',
  description:
    'CashFlowHubs lets you earn real money online across Africa. Complete paid surveys, microtasks, and find remote jobs, then withdraw via M-Pesa, MTN MoMo, Flutterwave, Telebirr, and more.',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    url: SITE_URL,
    title: 'Earn Money Online Across Africa - CashFlowHubs',
    description: 'Paid surveys, microtasks, remote jobs, and mobile-money payouts across Africa.',
  },
};

function HomeFaqSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How do I earn money on CashFlowHubs?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You can earn by completing paid surveys, microtasks, finding remote jobs, completing offerwalls, or referring friends. Earnings are credited to your wallet as tasks are completed.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I withdraw my earnings?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Withdraw via M-Pesa, MTN MoMo, Flutterwave-supported wallets, Telebirr, and other supported payout methods depending on your country.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is CashFlowHubs free to join?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Creating an account on CashFlowHubs is free, and you can start exploring earning opportunities after registration.',
        },
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}

export default function HomePage() {
  const host = String(headers().get('host') || '').toLowerCase();
  const portal = host.includes('ledger')
    ? 'ledger'
    : host.includes('superadmin')
      ? 'superadmin'
      : host.includes('admin')
        ? 'admin'
        : '';

  if (portal) {
    redirect(`/login?portal=${portal}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-outline px-4 py-2 text-sm">
              Login
            </Link>
            <Link href="/register" className="btn-primary px-4 py-2 text-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-4 pb-32 pt-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-green-900/20 via-transparent to-blue-900/10" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-300">
            <Zap size={14} /> Available in 20 African Countries
          </div>
          <h1 className="mb-6 text-5xl font-black leading-tight md:text-7xl">
            Earn Money Online
            <br />
            <span className="text-amber-400">From Africa</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400">
            Surveys · Tasks · Remote Jobs · Offerwalls · Freelance
            <br />
            Withdraw via M-Pesa, MTN MoMo, and more.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register" className="btn-primary flex items-center justify-center gap-2 px-8 py-4 text-lg">
              Start Earning Free <ArrowRight size={20} />
            </Link>
            <Link href="#how-it-works" className="btn-outline px-8 py-4 text-lg">
              How It Works
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">No credit card required · Withdraw from KSh 200</p>

          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-4">
            {[
              { label: 'Earning Methods', value: '6+' },
              { label: 'Countries Covered', value: '20' },
              { label: 'Min. Withdrawal', value: 'KSh 200' },
            ].map((stat) => (
              <div key={stat.label} className="card py-4 text-center">
                <div className="text-2xl font-black text-amber-400">{stat.value}</div>
                <div className="mt-1 text-xs text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-slate-900/50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-3xl font-bold">How It Works</h2>
          <p className="mb-12 text-center text-slate-400">3 simple steps to start earning</p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '01', title: 'Register', desc: 'Sign up with your phone number in 2 minutes. No paperwork.', icon: Users },
              { step: '02', title: 'Complete Tasks', desc: 'Surveys, microtasks, offerwalls, or browse remote jobs.', icon: CheckCircle },
              { step: '03', title: 'Withdraw', desc: 'Cash out via M-Pesa, MTN MoMo, or bank. Minimum KSh 200.', icon: DollarSign },
            ].map((item) => (
              <div key={item.step} className="card relative overflow-hidden text-center">
                <div className="absolute right-4 top-3 text-6xl font-black text-slate-700/50">{item.step}</div>
                <item.icon className="mx-auto mb-3 text-green-400" size={32} />
                <h3 className="mb-2 text-lg font-bold">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-3xl font-bold">Ways to Earn</h2>
          <p className="mb-12 text-center text-slate-400">Multiple income streams, one platform</p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {EARN_METHODS.map((method) => (
              <div key={method.title} className="card group cursor-pointer border-slate-700 transition-all hover:border-green-500/50">
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${method.color} text-2xl transition-transform group-hover:scale-110`}>
                  {method.icon}
                </div>
                <h3 className="mb-1 text-lg font-bold">{method.title}</h3>
                <p className="text-sm text-slate-400">{method.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Globe className="mx-auto mb-4 text-green-400" size={40} />
          <h2 className="mb-4 text-3xl font-bold">Available Across Africa</h2>
          <p className="mb-10 text-slate-400">Withdraw in your local currency via your preferred payment method</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {COUNTRIES.map((country) => (
              <div key={country.name} className="card flex items-center gap-3">
                <span className="text-3xl">{country.flag}</span>
                <div className="text-left">
                  <div className="font-semibold">{country.name}</div>
                  <div className="text-xs text-green-400">{country.payment}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-green-900/30 to-slate-900 px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <TrendingUp className="mx-auto mb-4 text-green-400" size={48} />
          <h2 className="mb-4 text-4xl font-black">Ready to Start Earning?</h2>
          <p className="mb-8 text-slate-400">Available in 20 African countries. Withdraw via M-Pesa, MTN MoMo, Flutterwave, and more.</p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg">
            Create Free Account <ArrowRight size={20} />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={12} /> Secure · Verified · Real Payments
          </p>
        </div>
      </section>

      <HomeFaqSchema />

      <footer className="border-t border-slate-800 px-4 py-12 text-sm text-slate-500">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          <div>
            <p className="mb-3 font-bold text-white">Ways to Earn</p>
            <ul className="space-y-2">
              <li><Link href="/earn/surveys" className="transition-colors hover:text-amber-400">Paid Surveys</Link></li>
              <li><Link href="/earn/jobs" className="transition-colors hover:text-amber-400">Remote Jobs</Link></li>
              <li><Link href="/earn/tasks" className="transition-colors hover:text-amber-400">Microtasks</Link></li>
              <li><Link href="/earn/offerwalls" className="transition-colors hover:text-amber-400">Offerwalls</Link></li>
              <li><Link href="/earn/referrals" className="transition-colors hover:text-amber-400">Referrals</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-bold text-white">Payments</p>
            <ul className="space-y-2">
              <li><Link href="/earn/wallet" className="transition-colors hover:text-amber-400">Wallet & Withdrawals</Link></li>
              <li>M-Pesa</li>
              <li>MTN MoMo</li>
              <li>Flutterwave</li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-bold text-white">Company</p>
            <ul className="space-y-2">
              <li><Link href="/about" className="transition-colors hover:text-amber-400">About</Link></li>
              <li><Link href="/blog" className="transition-colors hover:text-amber-400">Blog</Link></li>
              <li><Link href="/terms" className="transition-colors hover:text-amber-400">Terms</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-bold text-white">Account</p>
            <ul className="space-y-2">
              <li><Link href="/register" className="transition-colors hover:text-amber-400">Create Account</Link></li>
              <li><Link href="/login" className="transition-colors hover:text-amber-400">Login</Link></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-2 border-t border-slate-800 pt-6 text-slate-600 md:flex-row md:items-center md:justify-between">
          <p>© 2025 CashFlowHubs. Built for Africa.</p>
          <p className="text-xs">Available in Kenya, Nigeria, Ghana, Uganda, Tanzania, Ethiopia, and more.</p>
        </div>
      </footer>
    </div>
  );
}
