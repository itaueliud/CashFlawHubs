'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { SITE_URL } from '@/lib/seo';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  jobs: 'Remote Jobs',
  surveys: 'Paid Surveys',
  tasks: 'Microtasks',
  'ads-network': 'Creator HUB',
  offerwalls: 'Offerwalls',
  'file-locker': 'File Locker',
  'link-locker': 'Link Locker',
  offers: 'Offers',
  'cash-tasks': 'Coming Soon',
  referrals: 'Referral Earnings',
  chat: 'Job Chats',
  wallet: 'Wallet',
  profile: 'Profile',
  freelance: 'Freelance',
  challenges: 'Daily Challenges',
  ledger: 'Ledger',
  transactions: 'Transactions',
  reports: 'Reports',
  export: 'Export',
  reconciliation: 'Reconciliation',
  admin: 'Admin',
  users: 'Users',
  admins: 'Admins',
  audit: 'Audit Log',
  config: 'Config',
  support: 'Support',
  moderation: 'Moderation',
  activate: 'Activate',
  'superadmin': 'Superadmin',
};

export function Breadcrumbs() {
  const pathname = usePathname() ?? '';
  const segments = pathname.split('/').filter(Boolean);
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const baseSegments = isDashboardRoute ? segments.slice(1) : segments;

  const rootCrumb = isDashboardRoute
    ? { label: 'Dashboard', href: '/dashboard' }
    : { label: 'Home', href: '/' };

  const crumbs = baseSegments.map((segment, index) => ({
    label: LABELS[segment] ?? segment.replace(/-/g, ' '),
    href: isDashboardRoute
      ? `/dashboard/${baseSegments.slice(0, index + 1).join('/')}`
      : `/${baseSegments.slice(0, index + 1).join('/')}`,
  }));

  const allCrumbs = [rootCrumb, ...crumbs];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: allCrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: `${SITE_URL}${crumb.href}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-slate-400">
        {allCrumbs.map((crumb, index) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3" />}
            {index === 0 && <Home className="h-3 w-3" />}
            {index < allCrumbs.length - 1 ? (
              <Link href={crumb.href} className="transition-colors hover:text-white">
                {crumb.label}
              </Link>
            ) : (
              <span className="font-medium text-white">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}
