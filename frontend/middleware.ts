import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const TARGET_ROUTE_BY_ROLE: Record<string, string> = {
  admin: '/dashboard/admin-console',
  superadmin: '/dashboard/superadmin',
  ledger: '/dashboard/ledger',
};

const SKIP_PREFIXES = ['/api', '/_next', '/favicon.ico'];

const shouldSkip = (pathname: string) => SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const createNonce = () => crypto.randomUUID().replace(/-/g, '');

const buildContentSecurityPolicy = (nonce: string) =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://challenges.cloudflare.com`,
    "connect-src 'self' https://challenges.cloudflare.com https://*.cloudflare.com wss://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob: https://challenges.cloudflare.com",
    "child-src 'self' blob: https://challenges.cloudflare.com",
  ].join('; ');

const attachSecurityHeaders = (response: NextResponse, nonce: string) => {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
  response.headers.set('x-nonce', nonce);
  return response;
};

const resolvePortalFromHost = (host: string) => {
  const normalizedHost = String(host || '').toLowerCase();
  if (normalizedHost.includes('ledger')) return 'ledger';
  if (normalizedHost.includes('superadmin')) return 'superadmin';
  if (normalizedHost.includes('admin')) return 'admin';
  return '';
};

const resolveRoleTarget = (request: NextRequest) => {
  const envRole = String(process.env.ROLE_PORTAL_TARGET || '').toLowerCase().trim();
  if (envRole in TARGET_ROUTE_BY_ROLE) return envRole;

  return resolvePortalFromHost(String(request.headers.get('host') || ''));
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = String(request.headers.get('host') || '');
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  if (shouldSkip(pathname)) {
    return attachSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
  }

  // Explicitly force root to login for portal hosts, regardless of env configuration.
  const hostPortal = resolvePortalFromHost(host);
  if (hostPortal && pathname === '/') {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = '/login';
    nextUrl.searchParams.set('portal', hostPortal);
    return attachSecurityHeaders(NextResponse.redirect(nextUrl), nonce);
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
    nextUrl.searchParams.set('portal', roleTarget);
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
