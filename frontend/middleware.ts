import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const TARGET_ROUTE_BY_ROLE: Record<string, string> = {
  admin: '/dashboard/admin-console',
  superadmin: '/dashboard/superadmin',
  ledger: '/dashboard/ledger',
};

const SKIP_PREFIXES = ['/api', '/_next', '/favicon.ico'];

const shouldSkip = (pathname: string) => SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  // Explicitly force root to login for portal hosts, regardless of env configuration.
  const hostPortal = resolvePortalFromHost(host);
  if (hostPortal && pathname === '/') {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = '/login';
    nextUrl.searchParams.set('portal', hostPortal);
    return NextResponse.redirect(nextUrl);
  }

  const roleTarget = resolveRoleTarget(request);
  const targetRoute = TARGET_ROUTE_BY_ROLE[roleTarget];
  if (!targetRoute) {
    return NextResponse.next();
  }

  // Portal deployments should always start at login on root.
  if (pathname === '/') {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = '/login';
    nextUrl.searchParams.set('portal', roleTarget);
    return NextResponse.redirect(nextUrl);
  }

  // Keep auth routes accessible.
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return NextResponse.next();
  }

  // Route root and generic dashboard to the designated role workspace.
  if (pathname === '/' || pathname === '/dashboard') {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = targetRoute;
    return NextResponse.redirect(nextUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
