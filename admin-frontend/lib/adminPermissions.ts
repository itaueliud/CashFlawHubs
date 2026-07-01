export type AdminRole = 'admin' | 'superadmin' | 'ledger';

export type AdminPageOption = {
  label: string;
  href: string;
  aliases?: string[];
};

const pageOptions: AdminPageOption[] = [
  { label: 'Overview', href: '/dashboard', aliases: ['overview'] },
  { label: 'Admins', href: '/dashboard/admins', aliases: ['admins', 'admin'] },
  { label: 'Users', href: '/dashboard/users', aliases: ['users'] },
  { label: 'Referrals', href: '/dashboard/referrals', aliases: ['referrals'] },
  { label: 'Fraud', href: '/dashboard/fraud', aliases: ['fraud', 'fraud center'] },
  { label: 'KYC', href: '/dashboard/kyc', aliases: ['kyc', 'kyc queue'] },
  { label: 'Challenges', href: '/dashboard/challenges', aliases: ['challenges'] },
  { label: 'Moderation', href: '/dashboard/moderation', aliases: ['moderation'] },
  { label: 'Support', href: '/dashboard/support', aliases: ['support'] },
  { label: 'Notifications', href: '/dashboard/notifications', aliases: ['notifications', 'broadcasts'] },
  { label: 'Provider Health', href: '/dashboard/provider-health', aliases: ['provider health'] },
  { label: 'Config', href: '/dashboard/config', aliases: ['config'] },
  { label: 'Audit Logs', href: '/dashboard/audit', aliases: ['audit', 'audit logs'] },
  { label: 'Profile', href: '/dashboard/profile', aliases: ['profile'] },
];

const normalizeToken = (value: string) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const routeLookup = new Map<string, string>();

for (const page of pageOptions) {
  routeLookup.set(normalizeToken(page.href), page.href);
  routeLookup.set(normalizeToken(page.label), page.href);
  for (const alias of page.aliases || []) {
    routeLookup.set(normalizeToken(alias), page.href);
  }
}

export const ADMIN_PAGE_OPTIONS = pageOptions;

export const normalizeAdminPage = (page: string) => {
  const token = normalizeToken(page);
  if (!token) return '';
  if (routeLookup.has(token)) return routeLookup.get(token) || '';
  if (token === '/dashboard') return '/dashboard';
  if (token.startsWith('/dashboard/')) return token;
  return '';
};

export const normalizeAdminPages = (pages: string[]) => Array.from(new Set((pages || []).map(normalizeAdminPage).filter(Boolean)));

export const canManageAllAdminPages = (role?: string) => ['ledger', 'superadmin'].includes(String(role || '').toLowerCase());