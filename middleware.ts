import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/api/auth/login', '/'];
  if (publicRoutes.some(route => pathname === route || (route !== '/' && pathname.startsWith(route)))) {
    return NextResponse.next();
  }

  // Allow API auth routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Allow parse-contract API to be accessed without authentication (for landing page)
  // This includes both POST and OPTIONS requests
  if (pathname === '/api/parse-contract') {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get('session');

  // If no session and trying to access protected route, redirect to login
  // Exclude parse-contract API from this check
  if (!session && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || (pathname.startsWith('/api') && pathname !== '/api/parse-contract'))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For admin routes, we'll verify in the page component
  // Middleware just checks for session cookie existence
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

