export type AdminPageOption = {
  label: string;
  key: string;
  aliases?: string[];
};

const pageOptions: AdminPageOption[] = [
  { label: 'Overview', key: '/dashboard', aliases: ['overview'] },
  { label: 'Admins', key: '/dashboard/admins', aliases: ['admins', 'admin'] },
  { label: 'Users', key: '/dashboard/users', aliases: ['users'] },
  { label: 'KYC', key: '/dashboard/kyc', aliases: ['kyc', 'kyc queue'] },
  { label: 'Moderation', key: '/dashboard/moderation', aliases: ['moderation'] },
  { label: 'Fraud', key: '/dashboard/fraud', aliases: ['fraud', 'fraud center'] },
  { label: 'Notifications', key: '/dashboard/notifications', aliases: ['notifications', 'broadcasts'] },
  { label: 'Config', key: '/dashboard/config', aliases: ['config'] },
  { label: 'Challenges', key: '/dashboard/challenges', aliases: ['challenges'] },
  { label: 'Referrals', key: '/dashboard/referrals', aliases: ['referrals'] },
  { label: 'Provider Health', key: '/dashboard/provider-health', aliases: ['provider health'] },
  { label: 'Support', key: '/dashboard/support', aliases: ['support'] },
  { label: 'Profile', key: '/dashboard/profile', aliases: ['profile'] },
];

const normalizeToken = (value: string) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const lookup = new Map<string, string>();

for (const page of pageOptions) {
  lookup.set(normalizeToken(page.key), page.key);
  lookup.set(normalizeToken(page.label), page.key);
  for (const alias of page.aliases || []) {
    lookup.set(normalizeToken(alias), page.key);
  }
}

export const ADMIN_PAGE_OPTIONS = pageOptions;

export const normalizeAdminPage = (page: string) => {
  const token = normalizeToken(page);
  if (!token) return '';
  if (lookup.has(token)) return lookup.get(token) || '';
  if (token === '/dashboard' || token.startsWith('/dashboard/')) return token;
  return '';
};

export const normalizeAdminPages = (pages: string[]) => Array.from(new Set((pages || []).map(normalizeAdminPage).filter(Boolean)));
