import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Blog - Tips to Earn More Money Online in Africa',
  description:
    'Read the CashFlowHubs blog for tips, guides, and strategies to earn more money online across Africa. Surveys, microtasks, remote jobs, referrals, and mobile money guides.',
  keywords: [
    'earn money online Africa tips',
    'how to make money online Kenya',
    'paid surveys tips Africa',
    'remote jobs Africa guide',
    'CashFlowHubs blog',
    'online earning guide Africa',
  ],
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: 'CashFlowHubs Blog - Tips to Earn More Money Online in Africa',
    description: 'Guides and strategies to maximize your online earnings across Africa.',
    url: `${SITE_URL}/blog`,
  },
};

const POSTS = [
  {
    slug: 'how-to-withdraw-mpesa-cashflowhubs',
    title: 'How to Withdraw Your Earnings via M-Pesa on CashFlowHubs',
    date: '2025-01-05',
    category: 'Wallet',
    excerpt: 'A step-by-step guide to making your first M-Pesa withdrawal on CashFlowHubs, including the minimum amount and common fixes.',
    live: true,
  },
  { slug: 'how-to-earn-with-paid-surveys-kenya', title: 'How to Earn More With Paid Surveys in Kenya', date: '2025-01-10', category: 'Surveys', excerpt: 'A step-by-step guide to maximizing your daily survey earnings on CashFlowHubs.', live: false },
  { slug: 'best-remote-jobs-africa-2025', title: 'Best Remote Jobs in Africa in 2025', date: '2025-01-08', category: 'Remote Jobs', excerpt: 'A breakdown of the highest-paying remote job categories available to African workers.', live: false },
  { slug: 'referral-program-guide', title: 'How to Earn 20,000 KES With Referrals', date: '2025-01-02', category: 'Referrals', excerpt: 'Strategies users use to build referral income using WhatsApp groups and social media.', live: false },
  { slug: 'microtasks-guide-africa', title: 'Microtasks Guide: Earn $1-$3 Per Day', date: '2024-12-28', category: 'Microtasks', excerpt: 'Everything you need to know about completing microtasks on CashFlowHubs.', live: false },
  { slug: 'offerwalls-guide-africa', title: 'Offerwall Guide: Best Offers for Africans', date: '2024-12-20', category: 'Offerwalls', excerpt: 'Which offerwall campaigns pay best for users in Kenya, Nigeria, and Ghana.', live: false },
];

const CATEGORY_COLORS: Record<string, string> = {
  Surveys: 'badge badge-blue',
  'Remote Jobs': 'badge badge-blue',
  Wallet: 'badge badge-green',
  Referrals: 'badge badge-green',
  Microtasks: 'badge badge-yellow',
  Offerwalls: 'badge badge-yellow',
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-outline px-4 py-2 text-sm">Login</Link>
            <Link href="/register" className="btn-primary px-4 py-2 text-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-16 pt-20 text-center">
        <BookOpen className="mx-auto mb-4 text-green-400" size={40} />
        <h1 className="mb-4 text-4xl font-black md:text-5xl">CashFlowHubs Blog</h1>
        <p className="mx-auto max-w-xl text-lg text-slate-400">
          Tips, guides, and strategies to earn more money online across Africa.
        </p>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {POSTS.map((post) => (
            <article key={post.slug} className="card flex flex-col transition-all hover:border-green-500/50">
              <div className="mb-3 flex items-center justify-between">
                <span className={CATEGORY_COLORS[post.category] || 'badge badge-blue'}>{post.category}</span>
                <time className="text-xs text-slate-500">{post.date}</time>
              </div>
              <h2 className="mb-2 text-lg font-bold leading-snug">{post.title}</h2>
              <p className="mb-4 flex-1 text-sm text-slate-400">{post.excerpt}</p>
              {post.live ? (
                <Link href={`/blog/${post.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-amber-400 transition-all hover:gap-2">
                  Read Article <ArrowRight size={14} />
                </Link>
              ) : (
                <span className="text-sm text-slate-600">Coming soon</span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-green-900/20 to-slate-900 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-black">Ready to Start Earning?</h2>
          <p className="mb-8 text-slate-400">Read the latest CashFlowHubs guides, then join the platform and start earning.</p>
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg">
            Create Free Account <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}
