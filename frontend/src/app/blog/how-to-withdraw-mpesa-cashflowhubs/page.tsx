import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { SITE_URL } from '@/lib/seo';

const publishDate = '2025-01-05';

export const metadata: Metadata = {
  title: 'How to Withdraw CashFlowHubs Earnings via M-Pesa',
  description:
    'Step-by-step guide to making your first M-Pesa withdrawal on CashFlowHubs, including the minimum amount, processing time, and common fixes.',
  keywords: ['CashFlowHubs M-Pesa withdrawal', 'withdraw online earnings Kenya', 'M-Pesa payout guide', 'how to withdraw earnings Kenya'],
  alternates: { canonical: `${SITE_URL}/blog/how-to-withdraw-mpesa-cashflowhubs` },
  openGraph: {
    title: 'How to Withdraw CashFlowHubs Earnings via M-Pesa',
    description: 'A practical guide to M-Pesa withdrawals, minimums, and troubleshooting.',
    url: `${SITE_URL}/blog/how-to-withdraw-mpesa-cashflowhubs`,
    type: 'article',
  },
};

const steps = [
  {
    title: 'Open your wallet',
    detail: 'Go to the Wallet section from your dashboard and confirm that your available balance is ready to withdraw.',
  },
  {
    title: 'Enter your M-Pesa number',
    detail: 'Use the same Safaricom number linked to your wallet. Double-check the digits before you continue.',
  },
  {
    title: 'Choose the amount',
    detail: 'The minimum withdrawal is KSh 200. You can withdraw any amount up to your available balance.',
  },
  {
    title: 'Confirm the request',
    detail: 'Submit the withdrawal and wait for the payout confirmation. Most withdrawals clear quickly when your account is eligible.',
  },
];

const issues = [
  {
    issue: 'The withdrawal is still pending',
    fix: 'Check that your account is verified and the payout window is open. If the request remains pending, review the withdrawal conditions in your dashboard.',
  },
  {
    issue: 'The amount is below the minimum',
    fix: 'Make sure your available balance is at least KSh 200 before you submit the request.',
  },
  {
    issue: 'Wrong phone number entered',
    fix: 'Contact support immediately. Always confirm the number before submitting because mobile-money payouts are hard to reverse.',
  },
];

export default function WithdrawalGuidePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-amber-400">
            <ArrowLeft size={14} />
            Back to blog
          </Link>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
            Create account <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-3xl px-4 py-14">
        <div className="mb-6 flex items-center gap-3 text-sm text-slate-500">
          <span className="badge badge-yellow">Wallet</span>
          <time dateTime={publishDate}>January 5, 2025</time>
          <span>4 min read</span>
        </div>

        <h1 className="text-4xl font-black leading-tight md:text-5xl">How to Withdraw CashFlowHubs Earnings via M-Pesa</h1>
        <p className="mt-5 text-lg leading-8 text-slate-300">
          Once your earnings are available, withdrawing to M-Pesa is straightforward. This guide walks you through the process, the minimum amount, and what to do if a request needs attention.
        </p>

        <section className="mt-10 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="text-lg font-bold text-amber-400">Before you begin</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            {['A verified account', 'At least KSh 200 in available balance', 'An active M-Pesa number'].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle size={16} className="mt-0.5 text-amber-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">Step-by-step</h2>
          <div className="mt-6 space-y-5">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 font-black text-slate-950">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div>
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">Common issues</h2>
          <div className="mt-6 space-y-4">
            {issues.map((item) => (
              <div key={item.issue} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="font-semibold text-amber-400">{item.issue}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.fix}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-slate-900 p-8 text-center">
          <h2 className="text-2xl font-black">Ready to start earning?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Create your free account, complete tasks, and turn your balance into withdrawable cash.
          </p>
          <Link href="/register" className="btn-primary mt-6 inline-flex items-center gap-2 px-8 py-3">
            Create Free Account <ArrowRight size={16} />
          </Link>
        </section>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'How to Withdraw CashFlowHubs Earnings via M-Pesa',
            description: 'Step-by-step guide to making your first M-Pesa withdrawal on CashFlowHubs.',
            datePublished: publishDate,
            dateModified: publishDate,
            author: { '@type': 'Organization', name: 'CashFlowHubs', url: SITE_URL },
            publisher: { '@type': 'Organization', name: 'CashFlowHubs', url: SITE_URL },
            mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/how-to-withdraw-mpesa-cashflowhubs` },
          }),
        }}
      />
    </div>
  );
}
