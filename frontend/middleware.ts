import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const TARGET_ROUTE_BY_ROLE: Record<string, string> = {
  admin: '/dashboard/admin-console',
  superadmin: '/dashboard/superadmin',
  ledger: '/dashboard/ledger',
};

const SKIP_PREFIXES = ['/api', '/_next', '/favicon.ico'];

const shouldSkip = (pathname: string) => SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
const resolveRoleTarget = (request: NextRequest) => {
  const envRole = String(process.env.ROLE_PORTAL_TARGET || '').toLowerCase().trim();
  if (envRole in TARGET_ROUTE_BY_ROLE) return envRole;

  const host = String(request.headers.get('host') || '').toLowerCase();
  if (host.includes('ledger')) return 'ledger';
  if (host.includes('superadmin')) return 'superadmin';
  if (host.includes('admin')) return 'admin';
  return '';
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkip(pathname)) {
    return NextResponse.next();
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
