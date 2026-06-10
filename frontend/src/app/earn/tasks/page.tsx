import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Clock, DollarSign, Shield, TrendingUp, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Microtasks in Africa - Quick Online Tasks for Cash',
  description:
    'Complete microtasks on CashFlowHubs and earn cash for image tagging, data labeling, app testing, and more. Fast payouts across Africa.',
  keywords: [
    'microtasks online Africa',
    'microtasks Kenya',
    'earn money quick tasks Africa',
    'data labeling jobs Africa',
    'image tagging jobs Africa',
    'app testing jobs Africa',
  ],
  alternates: { canonical: 'https://www.cashflowhubs.com/earn/tasks' },
  openGraph: {
    title: 'Microtasks in Africa - CashFlowHubs',
    description: 'Quick tasks, fast rewards, and mobile-money withdrawals across Africa.',
    url: 'https://www.cashflowhubs.com/earn/tasks',
  },
};

const TASK_TYPES = [
  { title: 'Image Tagging', desc: 'Label product, scene, and object images for AI and research teams.' },
  { title: 'Data Labeling', desc: 'Classify text, audio, and short datasets to help improve products.' },
  { title: 'App Testing', desc: 'Try new apps and websites, then share simple feedback.' },
  { title: 'Survey Validation', desc: 'Review responses and help ensure data quality.' },
  { title: 'Short Research', desc: 'Collect quick information that helps businesses make decisions.' },
  { title: 'Content Checks', desc: 'Verify spelling, formatting, and basic quality on short content tasks.' },
];

const FAQ = [
  { q: 'How fast do microtasks pay?', a: 'Most tasks pay as soon as they are approved. Some are instant, while others may take a short review window.' },
  { q: 'Do I need special skills?', a: 'No. Many microtasks are simple and suitable for beginners. More advanced tasks appear as you complete more work.' },
  { q: 'How much can I earn?', a: 'Earnings vary by task type and provider, but microtasks are designed for quick, steady income.' },
  { q: 'Can I do tasks from my phone?', a: 'Yes. Most tasks are mobile-friendly and can be completed from any modern browser.' },
];

export default function EarnTasksPage() {
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-yellow-900/20 via-transparent to-green-900/10" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-sm text-yellow-400">
            <Zap size={14} /> Quick tasks, quick cash
          </div>
          <h1 className="mb-6 text-5xl font-black leading-tight md:text-6xl">
            Microtasks in Africa
            <br />
            <span className="text-yellow-400">Quick Online Tasks for Cash</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400">
            Complete image tagging, data labeling, app testing, and other quick tasks. Earn cash and withdraw with mobile money.
          </p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-lg">
            Start Earning Free <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Active Tasks', value: '120+' },
            { label: 'Average Task Time', value: '2-10 min' },
            { label: 'Task Types', value: '6+' },
            { label: 'Countries Covered', value: '20' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center py-5">
              <div className="text-2xl font-black text-yellow-400">{stat.value}</div>
              <div className="mt-1 text-xs text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-3xl font-bold">Common Microtask Types</h2>
          <p className="mb-12 text-center text-slate-400">Short tasks designed for steady earnings throughout the day</p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {TASK_TYPES.map((task) => (
              <div key={task.title} className="card">
                <h3 className="mb-2 text-lg font-bold">{task.title}</h3>
                <p className="text-sm text-slate-400">{task.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold">How Microtasks Work</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '01', title: 'Open a Task', desc: 'Choose a quick task from the dashboard based on your interest and time.', icon: Clock },
              { step: '02', title: 'Complete It', desc: 'Follow the instructions carefully and submit the result for review.', icon: CheckCircle },
              { step: '03', title: 'Get Paid', desc: 'Approved tasks credit your wallet and can be withdrawn via mobile money.', icon: DollarSign },
            ].map((item) => (
              <div key={item.step} className="card relative overflow-hidden text-center">
                <div className="absolute right-4 top-3 text-6xl font-black text-slate-700/50">{item.step}</div>
                <item.icon className="mx-auto mb-3 text-yellow-400" size={32} />
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

      <section className="bg-gradient-to-br from-yellow-900/30 to-slate-900 px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <TrendingUp className="mx-auto mb-4 text-yellow-400" size={48} />
          <h2 className="mb-4 text-4xl font-black">Start Microtasking Today</h2>
          <p className="mb-8 text-slate-400">Short tasks, steady earnings, and mobile-money withdrawals</p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg">
            Create Free Account <ArrowRight size={20} />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={12} /> Safe, simple, and fast
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-800 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 md:flex-row">
          <p>2025 CashFlowHubs. Built for Africa.</p>
          <div className="flex gap-6">
            <Link href="/earn/surveys" className="hover:text-white">Surveys</Link>
            <Link href="/earn/jobs" className="hover:text-white">Remote Jobs</Link>
            <Link href="/earn/offerwalls" className="hover:text-white">Offerwalls</Link>
            <Link href="/earn/referrals" className="hover:text-white">Referrals</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
