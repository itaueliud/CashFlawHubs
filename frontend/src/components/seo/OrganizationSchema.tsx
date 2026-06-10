import { SITE_NAME, SITE_URL } from '@/lib/seo';

export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description:
      'CashFlowHubs helps people across Africa earn money online through surveys, microtasks, remote jobs, offerwalls, and referrals with local payment options.',
    sameAs: [
      'https://twitter.com/cashflowhubs',
      'https://www.facebook.com/cashflowhubs',
      'https://www.linkedin.com/company/cashflowhubs',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      availableLanguage: ['English', 'Swahili'],
    },
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}
