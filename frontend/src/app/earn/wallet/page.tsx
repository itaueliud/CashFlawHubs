import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Shield, TrendingUp, Wallet, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Withdraw Earnings via M-Pesa, MTN MoMo, and More - CashFlowHubs Wallet',
  description:
    'CashFlowHubs supports instant withdrawals across Africa. Withdraw your earnings via M-Pesa, MTN MoMo, Flutterwave, Telebirr, and more.',
  keywords: [
    'M-Pesa withdrawal online Kenya',
    'MTN MoMo withdrawal online',
    'withdraw earnings online Africa',
    'Flutterwave payout Nigeria',
    'Telebirr withdrawal Ethiopia',
    'mobile money payout Africa',
  ],
  alternates: { canonical: 'https://www.cashflowhubs.com/earn/wallet' },
  openGraph: {
    title: 'Withdraw via M-Pesa, MTN MoMo, and More | CashFlowHubs Wallet',
    description: 'Instant withdrawals across Africa. Low minimums, fast payouts.',
    url: 'https://www.cashflowhubs.com/earn/wallet',
  },
};

const PAYMENT_METHODS = [
  { flag: '🇰🇪', country: 'Kenya', method: 'M-Pesa', min: 'KSh 200', speed: 'Instant' },
  { flag: '🇺🇬', country: 'Uganda', method: 'MTN MoMo', min: 'UGX 2,000', speed: 'Instant' },
  { flag: '🇬🇭', country: 'Ghana', method: 'MTN MoMo', min: 'GHS 5', speed: 'Instant' },
  { flag: '🇳🇬', country: 'Nigeria', method: 'Flutterwave', min: 'NGN 500', speed: '< 1 min' },
  { flag: '🇪🇹', country: 'Ethiopia', method: 'Telebirr', min: 'ETB 50', speed: 'Instant' },
  { flag: '🇹🇿', country: 'Tanzania', method: 'Vodacom', min: 'TZS 1,000', speed: 'Instant' },
  { flag: '🇷🇼', country: 'Rwanda', method: 'Jenga', min: 'RWF 500', speed: '< 5 min' },
  { flag: '🇿🇦', country: 'South Africa', method: 'Onafriq', min: 'ZAR 20', speed: '< 5 min' },
];

const FAQ = [
  { q: 'How fast are withdrawals processed?', a: 'Most withdrawals are processed instantly or within 1-5 minutes depending on your payment provider and country.' },
  { q: 'What is the minimum withdrawal amount?', a: 'The minimum varies by country. Kenya is KSh 200, Nigeria is NGN 500, and other countries have similarly low thresholds.' },
  { q: 'Are there withdrawal fees?', a: 'CashFlowHubs does not charge withdrawal fees. Standard mobile-money operator fees may apply.' },
  { q: 'How many times can I withdraw per day?', a: 'There is no daily withdrawal limit on the number of requests. The minimum amount per transaction still applies.' },
];

export default function EarnWalletPage() {
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-transparent to-green-900/10" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-400">
            <Zap size={14} /> Instant payouts across Africa
          </div>
          <h1 className="mb-6 text-5xl font-black leading-tight md:text-6xl">
            Withdraw Earnings via M-Pesa,
            <br />
            <span className="text-cyan-400">MTN MoMo, and More</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400">
            CashFlowHubs supports instant withdrawals across Africa with low minimums and mobile-money payout methods.
          </p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-lg">
            Start Earning and Withdrawing <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Payment Methods', value: '8+' },
            { label: 'Countries Covered', value: '20' },
            { label: 'Minimum Deposit', value: 'KSh 100' },
            { label: 'Minimum Withdrawal', value: 'KSh 200' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center py-5">
              <div className="text-2xl font-black text-cyan-400">{stat.value}</div>
              <div className="mt-1 text-xs text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-3xl font-bold">Supported Payment Methods</h2>
          <p className="mb-12 text-center text-slate-400">Withdraw in your local currency with low minimums and fast payouts</p>
          <div className="grid gap-4 md:grid-cols-2">
            {PAYMENT_METHODS.map((method) => (
              <div key={method.country} className="card flex items-center gap-4">
                <span className="text-4xl">{method.flag}</span>
                <div className="flex-1">
                  <div className="font-bold">{method.country} - {method.method}</div>
                  <div className="text-sm text-slate-400">Minimum: {method.min}</div>
                </div>
                <div className="text-right">
                  <span className="badge badge-green">{method.speed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold">How to Withdraw Your Earnings</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '01', title: 'Earn on CashFlowHubs', desc: 'Complete surveys, tasks, offerwalls, or refer friends. All earnings go to your wallet.', icon: TrendingUp },
              { step: '02', title: 'Go to Wallet', desc: 'Open the Wallet section in your dashboard. Your available balance is shown in real time.', icon: Wallet },
              { step: '03', title: 'Withdraw Instantly', desc: 'Enter your mobile money number, confirm the amount, and receive payment within seconds.', icon: CheckCircle },
            ].map((item) => (
              <div key={item.step} className="card relative overflow-hidden text-center">
                <div className="absolute right-4 top-3 text-6xl font-black text-slate-700/50">{item.step}</div>
                <item.icon className="mx-auto mb-3 text-cyan-400" size={32} />
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

      <section className="bg-gradient-to-br from-cyan-900/30 to-slate-900 px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Wallet className="mx-auto mb-4 text-cyan-400" size={48} />
          <h2 className="mb-4 text-4xl font-black">Start Earning and Withdraw Today</h2>
          <p className="mb-8 text-slate-400">Low minimums, secure payouts, and fast mobile-money withdrawals</p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg">
            Create Free Account <ArrowRight size={20} />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={12} /> Secure, real payments, instant withdrawals
          </p>
        </div>
      </section>
    </div>
  );
}
