import { SITE_URL } from '@/lib/seo';

const buildSitemapXml = () => {
  const now = new Date().toISOString();
  const urls = [
    SITE_URL,
    `${SITE_URL}/about`,
    `${SITE_URL}/register`,
    `${SITE_URL}/privacy`,
    `${SITE_URL}/terms`,
    `${SITE_URL}/earn/surveys`,
    `${SITE_URL}/earn/jobs`,
    `${SITE_URL}/earn/tasks`,
    `${SITE_URL}/earn/offerwalls`,
    `${SITE_URL}/earn/referrals`,
    `${SITE_URL}/earn/wallet`,
    `${SITE_URL}/blog`,
    `${SITE_URL}/blog/how-to-withdraw-mpesa-cashflowhubs`,
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
    <lastmod>${now}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>`;
};

export function GET() {
  return new Response(buildSitemapXml(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
