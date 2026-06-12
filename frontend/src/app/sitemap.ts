import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const routes = [
  '/',
  '/about',
  '/register',
  '/privacy',
  '/terms',
  '/earn/surveys',
  '/earn/jobs',
  '/earn/tasks',
  '/earn/offerwalls',
  '/earn/referrals',
  '/earn/wallet',
  '/blog',
  '/blog/how-to-withdraw-mpesa-cashflowhubs',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.7,
  }));
}
