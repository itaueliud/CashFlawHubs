import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { collectEmbedOrigins } from '@/lib/embeds';

const TARGET_ROUTE_BY_ROLE: Record<string, string> = {
  admin: '/dashboard/admin-console',
  superadmin: '/dashboard/superadmin',
  ledger: '/dashboard/ledger',
};

const SKIP_PREFIXES = ['/api', '/_next', '/favicon.ico'];

const shouldSkip = (pathname: string) => SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const createNonce = () => crypto.randomUUID().replace(/-/g, '');

const getOriginFromUrl = (value: string | undefined) => {
  if (!value) return '';

  try {
    return new URL(value.trim()).origin;
  } catch {
    return '';
  }
};

const getSocketOriginFromHttpOrigin = (origin: string) => {
  if (!origin) return '';
  if (origin.startsWith('https://')) return `wss://${origin.slice('https://'.length)}`;
  if (origin.startsWith('http://')) return `ws://${origin.slice('http://'.length)}`;
  return '';
};

const buildConnectSrc = () => {
  const sources = new Set([
    "'self'",
    'https://challenges.cloudflare.com',
    'https://*.cloudflare.com',
    'wss://challenges.cloudflare.com',
    'https://preferencenail.com',
    'https://al5sm.com',
    'https://nap5k.com',
    'https://zoologyfibre.com',
    'https://kettledroopingcontinuation.com',
  ]);

  const apiOrigin = getOriginFromUrl(process.env.NEXT_PUBLIC_API_URL);
  if (apiOrigin) {
    sources.add(apiOrigin);
    const apiSocketOrigin = getSocketOriginFromHttpOrigin(apiOrigin);
    if (apiSocketOrigin) {
      sources.add(apiSocketOrigin);
    }
  }

  const appOrigin = getOriginFromUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (appOrigin) {
    sources.add(appOrigin);
    const appSocketOrigin = getSocketOriginFromHttpOrigin(appOrigin);
    if (appSocketOrigin) {
      sources.add(appSocketOrigin);
    }
  }

  return Array.from(sources).join(' ');
};


const buildMediaSrc = () => {
  const sources = new Set([
    "'self'",
    'blob:',
    'data:',
    'https:',
  ]);

  const apiOrigin = getOriginFromUrl(process.env.NEXT_PUBLIC_API_URL);
  if (apiOrigin) sources.add(apiOrigin);

  const appOrigin = getOriginFromUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (appOrigin) sources.add(appOrigin);

  return Array.from(sources).join(' ');
};
const ADS_ORIGINS = [
  'https://effectivecpmnetwork.com',
  'https://*.effectivecpmnetwork.com',
  'https://monetag.com',
  'https://*.monetag.com',
  'https://www.monetag.com',
  'https://preferencenail.com',
  'https://al5sm.com',
  'https://nap5k.com',
];

const EMBED_ORIGINS = [
  'https://www.cdnflair.com',
  ...collectEmbedOrigins(
    'NEXT_PUBLIC_FILE_LOCKER_IFRAME',
    'NEXT_PUBLIC_FILE_LOCKER_IFRAME_SRC',
    'NEXT_PUBLIC_FILE_LOCKER_URL',
    'NEXT_PUBLIC_FILE_LOCKER_SRC',
    'NEXT_PUBLIC_FILELOCKER_URL',
    'NEXT_PUBLIC_FILELOCKER_SRC',
    'VITE_FILE_LOCKER_IFRAME',
    'VITE_FILE_LOCKER_URL',
    'NEXT_PUBLIC_LINK_LOCKER_IFRAME',
    'NEXT_PUBLIC_LINK_LOCKER_IFRAME_SRC',
    'NEXT_PUBLIC_LINK_LOCKER_URL',
    'NEXT_PUBLIC_LINK_LOCKER_SRC',
    'NEXT_PUBLIC_LINKLOCKER_URL',
    'NEXT_PUBLIC_LINKLOCKER_SRC',
    'VITE_LINK_LOCKER_IFRAME',
    'VITE_LINK_LOCKER_URL',
    'NEXT_PUBLIC_OFFERS_IFRAME',
    'NEXT_PUBLIC_OFFERS_IFRAME_SRC',
    'NEXT_PUBLIC_OFFERS_URL',
    'NEXT_PUBLIC_OFFERS_SRC',
    'NEXT_PUBLIC_OFFERS_LINK',
    'NEXT_PUBLIC_OFFERS_EMBED',
    'VITE_OFFERS_IFRAME',
    'VITE_OFFERS_URL'
  ),
];

const buildContentSecurityPolicy = (nonce: string) =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' data: https:",
    `media-src ${buildMediaSrc()}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://trianglerockers.com https://playabledownload.com ${ADS_ORIGINS.join(' ')}`,
    `script-src-elem 'self' 'nonce-${nonce}' 'unsafe-inline' https://challenges.cloudflare.com https://trianglerockers.com https://playabledownload.com ${ADS_ORIGINS.join(' ')}`,
    `connect-src ${buildConnectSrc()}`,
    `frame-src 'self' https://docs.google.com https://challenges.cloudflare.com https://trianglerockers.com https://playabledownload.com https://www.ayetstudios.com https://wall.adgaterewards.com https://offers.cpx-research.com https://timewall.io https://api.adgem.com https://adunits.adgem.com ${EMBED_ORIGINS.join(' ')} ${ADS_ORIGINS.join(' ')}`,
    "worker-src 'self' blob: https://challenges.cloudflare.com",
    `child-src 'self' blob: https://docs.google.com https://challenges.cloudflare.com https://trianglerockers.com https://playabledownload.com https://www.ayetstudios.com https://wall.adgaterewards.com https://offers.cpx-research.com https://timewall.io https://api.adgem.com https://adunits.adgem.com ${EMBED_ORIGINS.join(' ')} ${ADS_ORIGINS.join(' ')}`,
  ].join('; ');

const attachSecurityHeaders = (response: NextResponse, nonce: string) => {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
  response.headers.set('x-nonce', nonce);
  return response;
};

const resolveRoleTarget = (request: NextRequest) => {
  const envRole = String(process.env.NEXT_PUBLIC_ROLE_PORTAL_TARGET || '').toLowerCase().trim();
  return envRole in TARGET_ROUTE_BY_ROLE ? envRole : '';
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  // Allow Vercel preview hosts to function locally for branch previews.

  if (shouldSkip(pathname)) {
    return attachSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
  }

  const roleTarget = resolveRoleTarget(request);
  const targetRoute = TARGET_ROUTE_BY_ROLE[roleTarget];
  if (!targetRoute) {
    return attachSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
  }

  // Portal deployments should always start at login on root.
  if (pathname === '/') {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = '/login';
    return attachSecurityHeaders(NextResponse.redirect(nextUrl), nonce);
  }

  // Keep auth routes accessible.
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return attachSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
  }

  // Route root and generic dashboard to the designated role workspace.
  if (pathname === '/' || pathname === '/dashboard') {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = targetRoute;
    return attachSecurityHeaders(NextResponse.redirect(nextUrl), nonce);
  }

  return attachSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};


