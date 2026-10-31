import { NextResponse, type NextRequest } from 'next/server';

// Server-side gate for the admin area.
// Anonymous visitors are sent straight to the dedicated admin sign-in page
// (/admin/login), so they never land on the customer login by mistake.
// The real role check still runs on every admin action (lib/admin-guard.ts).
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    // Better Auth uses "better-auth.session_token" (with a __Secure- prefix on HTTPS).
    const hasToken = req.cookies
      .getAll()
      .some((c) => c.value && c.name.endsWith('better-auth.session_token'));
    if (!hasToken) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
