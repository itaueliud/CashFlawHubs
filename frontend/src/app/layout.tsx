import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/Providers';
import { PublicFloatingCTA } from '@/components/PublicFloatingCTA';
import { NonceProvider } from '@/components/security/NonceProvider';
import { OrganizationSchema } from '@/components/seo/OrganizationSchema';
import { WebsiteSchema } from '@/components/seo/WebsiteSchema';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

const inter = Inter({ subsets: ['latin'], display: 'swap' });
function isSafeRemoteUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const adScripts = [
  process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_URL,
  process.env.NEXT_PUBLIC_MONETAG_POPUNDER_URL,
].filter(isSafeRemoteUrl);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'CashFlowHubs - Earn Money Online Across Africa',
    template: '%s | CashFlowHubs',
  },
  description:
    'CashFlowHubs helps people across Africa earn money online with paid surveys, microtasks, remote jobs, offerwalls, referrals, and mobile-money withdrawals.',
  keywords: [
    'earn money online Africa',
    'paid surveys Kenya',
    'paid surveys Nigeria',
    'microtasks online Africa',
    'remote jobs Kenya',
    'M-Pesa withdrawal',
    'MTN MoMo earnings',
    'make money online Ghana',
    'freelance Africa',
    'online jobs Uganda',
    'offerwalls Africa',
    'CashFlowHubs',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'CashFlowHubs - Earn Money Online Across Africa',
    description: 'Surveys, microtasks, remote jobs, and mobile-money withdrawals across Africa.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'CashFlowHubs - Earn Money Online in Africa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CashFlowHubs - Earn Money Online Across Africa',
    description:
      'Surveys, tasks, remote jobs, and instant payouts via mobile money across Africa.',
    images: ['/og-image.svg'],
    creator: '@cashflowhubs',
    site: '@cashflowhubs',
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = headers().get('x-nonce');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="monetag" content="f805e56c8e2a41c32ced55e23cc0368f" />
      </head>
      <body className={`${inter.className} bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-white`}>
        <NonceProvider nonce={nonce}>
          <Providers>
            <OrganizationSchema />
            <WebsiteSchema />
            {adScripts.map((src) => (
              <Script key={src} src={src} strategy="afterInteractive" />
            ))}
            {children}
            <PublicFloatingCTA />
            <Toaster
              position="top-right"
              toastOptions={{
                style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' },
                success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </Providers>
        </NonceProvider>
      </body>
    </html>
  );
}
