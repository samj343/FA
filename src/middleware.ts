import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth-edge';

// Cheap edge gate: checks cookie *presence* only (DB validation happens in
// route handlers / pages via getSessionUser). Unauthenticated page requests
// redirect to /login; API requests get a 401.

const PUBLIC_PATHS = ['/login', '/register'];
const PUBLIC_API_PREFIXES = ['/api/auth/'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = '/login';
  login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
