import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Briefcase, CheckCircle, DollarSign, Shield, TrendingUp, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Remote Jobs in Africa - Work From Home and Get Paid in KES/NGN',
  description:
    'Find legitimate remote jobs across Africa on CashFlowHubs. Full-time, part-time, contract, and internship roles. Apply directly and get paid via M-Pesa, MTN MoMo, Flutterwave.',
  keywords: [
    'remote jobs Kenya',
    'remote jobs Nigeria',
    'remote jobs Africa',
    'online jobs Africa',
    'work from home Kenya',
    'work from home Nigeria',
    'freelance jobs Africa',
    'part time online jobs Africa',
  ],
  alternates: { canonical: 'https://www.cashflowhubs.com/earn/jobs' },
  openGraph: {
    title: 'Remote Jobs in Africa - CashFlowHubs',
    description: 'Full-time, part-time, contract, and internship remote roles across Africa.',
    url: 'https://www.cashflowhubs.com/earn/jobs',
  },
};

const JOB_CATEGORIES = [
  { icon: '💻', title: 'Tech and Development', examples: 'Web dev, mobile apps, data science' },
  { icon: '✍️', title: 'Writing and Content', examples: 'Copywriting, blogging, translation' },
  { icon: '🎨', title: 'Design and Creative', examples: 'Graphic design, UI/UX, video editing' },
  { icon: '📊', title: 'Data and Research', examples: 'Data entry, analysis, annotation' },
  { icon: '🎧', title: 'Customer Support', examples: 'Live chat, email support, VA roles' },
  { icon: '📈', title: 'Sales and Marketing', examples: 'Social media, SEO, ads management' },
];

const FAQ = [
  { q: 'Are the remote jobs on CashFlowHubs legitimate?', a: 'Yes. Each job listing is reviewed before publication, and employers are verified by the moderation team.' },
  { q: 'How do I get paid for remote jobs?', a: 'Payment terms are set by each employer. Many use the CashFlowHubs wallet for payouts with mobile-money withdrawals.' },
  { q: 'Can I post a remote job on CashFlowHubs?', a: 'Yes. Employers can post from the dashboard and listings are reviewed before going live.' },
  { q: 'What job types are available?', a: 'Full-time, part-time, contract, and internship roles across tech, writing, design, data, support, and more.' },
];

export default function EarnJobsPage() {
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-green-900/10" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-400">
            <Zap size={14} /> Full-time, part-time, contract, internship
          </div>
          <h1 className="mb-6 text-5xl font-black leading-tight md:text-6xl">
            Remote Jobs in Africa
            <br />
            <span className="text-purple-400">Apply and Get Paid Locally</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400">
            Find legitimate work-from-home jobs across Africa and get paid in your local currency via mobile money.
          </p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-lg">
            Browse Jobs Free <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Active Job Listings', value: '320+' },
            { label: 'Employers', value: '80+' },
            { label: 'Job Categories', value: '12+' },
            { label: 'Countries Covered', value: '20' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center py-5">
              <div className="text-2xl font-black text-purple-400">{stat.value}</div>
              <div className="mt-1 text-xs text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-3xl font-bold">Job Categories</h2>
          <p className="mb-12 text-center text-slate-400">Roles across all skill levels, from beginner to expert</p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {JOB_CATEGORIES.map((category) => (
              <div key={category.title} className="card transition-all hover:border-purple-500/50">
                <div className="mb-3 text-3xl">{category.icon}</div>
                <h3 className="mb-1 text-lg font-bold">{category.title}</h3>
                <p className="text-sm text-slate-400">{category.examples}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900/50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold">How to Get a Remote Job</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '01', title: 'Create Profile', desc: 'Sign up free and complete your profile with your skills and experience.', icon: CheckCircle },
              { step: '02', title: 'Apply to Jobs', desc: 'Browse listings and apply directly. Employers respond via in-app chat.', icon: Briefcase },
              { step: '03', title: 'Get Paid Locally', desc: 'Receive payments in your local currency via M-Pesa, MTN MoMo, or bank.', icon: DollarSign },
            ].map((item) => (
              <div key={item.step} className="card relative overflow-hidden text-center">
                <div className="absolute right-4 top-3 text-6xl font-black text-slate-700/50">{item.step}</div>
                <item.icon className="mx-auto mb-3 text-purple-400" size={32} />
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

      <section className="bg-gradient-to-br from-purple-900/30 to-slate-900 px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <TrendingUp className="mx-auto mb-4 text-purple-400" size={48} />
          <h2 className="mb-4 text-4xl font-black">Apply to Remote Jobs Today</h2>
          <p className="mb-8 text-slate-400">Join thousands of Africans already earning on CashFlowHubs</p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg">
            Create Free Account <ArrowRight size={20} />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={12} /> Real employers, verified listings, fair payouts
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-800 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 md:flex-row">
          <p>2025 CashFlowHubs. Built for Africa.</p>
          <div className="flex gap-6">
            <Link href="/earn/surveys" className="hover:text-white">Surveys</Link>
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
