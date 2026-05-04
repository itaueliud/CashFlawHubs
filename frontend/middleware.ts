import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const TARGET_ROUTE_BY_ROLE: Record<string, string> = {
  admin: '/dashboard/admin-console',
  superadmin: '/dashboard/superadmin',
  ledger: '/dashboard/ledger',
};

const SKIP_PREFIXES = ['/api', '/_next', '/favicon.ico'];

const shouldSkip = (pathname: string) => SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  const roleTarget = String(process.env.ROLE_PORTAL_TARGET || '').toLowerCase().trim();
  const targetRoute = TARGET_ROUTE_BY_ROLE[roleTarget];
  if (!targetRoute) {
    return NextResponse.next();
  }

  // Managed staff portals should always start at login on root.
  if ((roleTarget === 'admin' || roleTarget === 'superadmin') && pathname === '/') {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = '/login';
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
